
import { toSqlQuery, toSqlWrite } from "./sqlUtils.js";
import { Validator as SchemaValidator } from "../../connectors/validator.ts";
// import Database from 'npm:libsql';
import Database from 'npm:libsql@0.4.0-pre.10/promise'; // Using the promise api. 

// let hasConnected = false;
// let db;

const connectedDbs = new Map();

// To use with Sqlite3 lib: serializers are not necessary; Should set config.finalizePreparedStatements to true so there's no leak;
// To use with better-sqlite-3, use the stringifyObjects serializer. Should set config.finalizePreparedStatements to false as there's no need for it;
const serializers = {
    stringifyObjects: {
        serialize: (value) => {
            return value
                ? Object.entries(value).reduce((acc, [key, value]) => {
                    acc[key] = ['number', 'string'].indexOf(typeof value) === -1
                        ? JSON.stringify(value)
                        : typeof value === 'string'
                            ? `'${value}'`
                            : value;
                    return acc;
                }, {})
                : null
        },
        deserialize: (value, schema) => {
            return value
                ? Object.entries(value).reduce((acc, [key, value]) => {
                    const currentSchema = schema[key];

                    if (schema[key] === 'any' || typeof schema[key] === 'object' || (typeof currentSchema === 'string' && currentSchema?.includes("->"))) {
                        acc[key] = JSON.parse(value);
                    } else {
                        acc[key] = value;
                    }

                    return acc;
                }, {})
                : null
        }
    },
    stringifyArrays: {
        serialize: (value) => {
            return value
                ? value.map((i) => ['number', 'string'].indexOf(typeof i) === -1
                    ? JSON.stringify(i)
                    : typeof i === 'string' && i.indexOf(' ') >= 0
                        ? `${i}`
                        : i)
                : null
        },
        deserialize: (value, schema) => {
            return value
                ? Object.entries(value).reduce((acc, [key, value]) => {
                    const currentSchema = schema[key];
                    if (schema[key] === 'any' || typeof schema[key] === 'object' || (typeof currentSchema === 'string' && currentSchema?.includes("->"))) {
                        acc[key] = JSON.parse(value);
                    } else {
                        acc[key] = value;
                    }
                    return acc

                }, {})
                : null
        }
    },

}

const formattedNestedData = (data) => Object.entries(data)
    .reduce((acc, [field, value]) => {
        if (field.includes('.')) {
            const [newField, ...fields] = field.split('.');
            field = newField;
            if (!acc[field]) {
                acc[field] = { [fields.join('.')]: value }
            } else {
                acc[field][fields.join('.')] = value;
            }
        }
        else {
            acc[field] = value;
        }
        return acc;
    }, {})

function convertToPositionalParams(sql, params) {
    params = Object.entries(params).reduce((acc, [key, value]) => {
        if (key.includes('.')) {
            key = key.replaceAll('.', '_');
        }
        acc[key] = value;
        return acc;
    }, {});


    const paramNames = Object.keys(params);
    const positionalParams = [];
    const paramMap = {};

    // Replace named parameters in the SQL with positional parameters (?)
    const transformedSql = sql.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, paramName) => {
        if (paramNames.includes(paramName)) {
            if (!(paramName in paramMap)) {
                positionalParams.push(params[paramName]);
                paramMap[paramName] = positionalParams.length;  // Track the index of each parameter
            }
            return '?';
        } else {
            throw new Error(`Parameter ${paramName} not found in params object`);
        }
    });

    return {
        sql: transformedSql,
        params: positionalParams
    };
}


export default (args) => {
    let db;
    const config = args.config || {};
    const schemas = args.schemas;
    const Validator = args.Validator || SchemaValidator(schemas)
    const path = config.dbPath || './data/my.db';
    // ensure the directory exists (config.dbPath)
    if (!connectedDbs.has(path)) {
        const start = Date.now();
        db = new Database(path, config.dbOptions);
        console.log('Database connection time:', Date.now() - start, 'ms');
        connectedDbs.set(path, { db });
    } else {
        db = connectedDbs.get(path).db;
        console.log('Database already connected');
    }

    const models = {};
    const serializeParams = config?.serializer && serializers[config.serializer]?.serialize || ((d) => d);
    const deserializeParams = config?.serializer && serializers[config?.serializer]?.deserialize || ((d) => d)

    const createTable = (schema, tableName) => {
        const columns = Object.entries(schema).map(([key, type]) => {
            let isUnique = false
            let isNullable = true
            if (typeof type === "string" && type.includes("->")) return `${key} INTEGER`;
            if (typeof type === 'string' && type.includes('^')) {
                isUnique = true;
                type = type.replace('^', '');
            }
            if (typeof type === 'string' && type.includes('!')) {
                type = type.replace('!', '');
                isNullable = false;
            }
            if (typeof type === 'string' && type.includes('?')) {
                type = type.replace('?', '');
            }
            if (key === "_id") return `${key} INTEGER PRIMARY KEY AUTOINCREMENT${isUnique ? ' UNIQUE' : ''}${isNullable ? '' : ' NOT NULL'}`;
            if (type === "string") return `${key} TEXT${isUnique ? ' UNIQUE' : ''}${isNullable ? '' : ' NOT NULL'}`;
            if (type === "number") return `${key} REAL${isUnique ? ' UNIQUE' : ''}${isNullable ? '' : ' NOT NULL'}`;
            if (type === "boolean") return `${key} INTEGER${isUnique ? ' UNIQUE' : ''}${isNullable ? '' : ' NOT NULL'}`;
            if (type === "date") return `${key} TEXT${isUnique ? ' UNIQUE' : ''}${isNullable ? '' : ' NOT NULL'}`;
            if (type === "any" || typeof type === 'object') return `${key} TEXT${isUnique ? ' UNIQUE' : ''}${isNullable ? '' : ' NOT NULL'}`;
            // Add more type mappings 
        })?.filter(Boolean)?.join(", ");

        console.log(`CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`);

        return `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
    };

    const buildJsonObjectQuery = (schema, alias, isArray = false) => {
        const fields = Object.keys(schema);
        return `${isArray ? ` json_group_array( CASE WHEN Post._id IS NOT NULL THEN ` : ''}json_object(${fields.map(field => `'${field}', ${(schema[field] === 'any' || typeof schema[field] === 'object')
            ? `json(${alias}.${field})`
            : `${alias}.${field}`
            }`).join(", ")
            }) ${isArray ? 'END)' : ''}`;
    };

    const populate = (schema, populateKeys, table = null) => {
        const joins = [];
        const selectFields = [];
        const dynamicPopulate = {};
        const groupClauses = [];
        const whereClauses = [];

        for (const key of populateKeys) {
            let isArray = false;
            let relation = getValueByPath(schema, key);
            if (Array.isArray(relation)) {
                relation = relation[0];
                isArray = true;
            }
            const [type, from] = relation?.split("->") ?? [];
            const isDynamic = from?.startsWith('$');
            const fromTable = isDynamic ? schema[from.slice(1)] : from;

            if (isDynamic) {
                dynamicPopulate[from.slice(1)] = key;
            } else if (from) {
                let jsonObjectQuery

                if (!isArray) {
                    jsonObjectQuery = buildJsonObjectQuery(schemas[fromTable], fromTable, isArray);
                    joins.push(`LEFT JOIN ${fromTable} ON ${key} = ${fromTable}._id`);
                } else {
                    jsonObjectQuery = buildJsonObjectQuery(schemas[fromTable], fromTable, isArray);
                    joins.push(`LEFT JOIN ${fromTable} ON ${fromTable}._id IN (SELECT value FROM json_each(${table}.${key}))`);
                    groupClauses.push(`${table}._id`);
                }
                selectFields.push(`(${jsonObjectQuery}) AS ${key}`);
            }
        }

        return { dynamicPopulate, joins, selectFields, whereClauses, groupClauses };
    };

    const commands = [];
    for (const key in schemas) {
        const schema = schemas[key];
        config.addTimestamps && (schema.createdAt = "string");
        config.addTimestamps && (schema.updatedAt = "string");
        if (!connectedDbs.get(path).status) {
            commands.push(createTable(schema, key));  // Ensure table creation
        }

        models[key] = {
            create: async (data, options) => {
                const executionId = crypto.randomUUID();

                const validatedData = Validator(schema, data, {
                    path: `create_input:${key}`,
                });
                const validatedParams = Validator(schema, data, {
                    path: `create_input:${key}`,
                    removeOperators: true,
                });

                if (config.addTimestamps) {
                    validatedData.createdAt = new Date().toISOString();
                    validatedData.updatedAt = new Date().toISOString();
                    validatedParams.createdAt = new Date().toISOString()
                    validatedParams.updatedAt = new Date().toISOString()
                };

                // Query SQL Statement
                let querySql = `SELECT ${Object.entries(schema).map(([field, value]) => {
                    if (typeof value === 'object' || value === 'any') {
                        return `json_extract(${key}.${field}, '$') as ${field}`;
                    }
                    return `${key}.${field}`;
                }).join(", ")}`;

                querySql += ` FROM ${key} WHERE _id = last_insert_rowid()`;
                // Inster SQL Statement
                const _insertSql = `INSERT INTO ${key} ${toSqlWrite('insert', validatedData)}`;
                const { sql: insertSql, params } = convertToPositionalParams(_insertSql, validatedParams);

                config.debug && console.log('CRUD Execution Id:', executionId, '| create', '| SQL:', insertSql, '| Params:', JSON.stringify(params));
                const start = Date.now();

                console.log('DB STATUS', db)

                const response = await db.transaction(async () => {
                    // Prepare Statemens
                    const queryStmt = await db.prepare(querySql);
                    const insertStmt = await db.prepare(insertSql);
                    // Execute Statements
                    await insertStmt.run(serializeParams(params));
                    const insertedRow = await queryStmt.get()
                    // Validate the response
                    const validatedResponse = Validator(schema, deserializeParams(insertedRow, schema), {
                        path: `create_output:${key}`,
                    });
                    // Close the Transactions
                    return validatedResponse;
                })();

                config.debug && console.log('CRUD Execution Id:', executionId, '| create', '| Response:', JSON.stringify(response), '| Duration:', Date.now() - start, 'ms');

                config.finalizePreparedStatements && queryStmt.finalize();
                config.finalizePreparedStatements && insertStmt.finalize();

                return response;
            },
            createMany: async (data, options) => {
                const executionId = crypto.randomUUID();

                const validatedData = Validator([schema], data, {
                    path: `create_input:${key}`,
                });
                const validatedParams = Validator([schema], data, {
                    path: `create_input:${key}`,
                    removeOperators: true,
                });

                if (config.addTimestamps) {
                    validatedData.forEach(d => d.createdAt = new Date().toISOString());
                    validatedData.forEach(d => d.updatedAt = new Date().toISOString());
                    validatedParams.forEach(d => d.createdAt = new Date().toISOString());
                    validatedParams.forEach(d => d.updatedAt = new Date().toISOString());
                };

                // Query SQL Statement
                let querySql = `SELECT ${Object.entries(schema).map(([field, value]) => {
                    if (typeof value === 'object' || value === 'any') {
                        return `json_extract(${key}.${field}, '$') as ${field}`;
                    }
                    return `${key}.${field}`;
                }).join(", ")}`;

                querySql += ` FROM ${key} WHERE _id = last_insert_rowid()`;
                // Inster SQL Statement
                const _insertSql = `INSERT INTO ${key} ${toSqlWrite('insert', validatedData[0])}`;
                const arrayParams = validatedParams.map((params) => convertToPositionalParams(_insertSql, params));

                const start = Date.now();
                const results = [];
                for (const { sql, params } of arrayParams) {
                    const response = await db.transaction(async () => {
                        config.debug && console.log('CRUD Execution Id:', executionId, '| create', '| SQL:', sql, '| Params:', JSON.stringify(params));
                        // Prepare Statemens
                        const queryStmt = await db.prepare(querySql);
                        const insertStmt = await db.prepare(sql);
                        // Execute Statements
                        await insertStmt.run(serializeParams(params));
                        const insertedRow = await queryStmt.get()

                        // Validate the response
                        const validatedResponse = Validator(schema, deserializeParams(insertedRow, schema), {
                            path: `create_output:${key}`,
                        });
                        return validatedResponse;
                    })();
                    results.push(response);
                }
                // Close the Transactions

                config.debug && console.log('CRUD Execution Id:', executionId, '| create', '| Response:', JSON.stringify(results), '| Duration:', Date.now() - start, 'ms');

                config.finalizePreparedStatements && queryStmt.finalize();
                config.finalizePreparedStatements && insertStmt.finalize();

                return results;
            },
            find: async (query, options) => {
                const executionId = crypto.randomUUID();

                // Validate query
                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `find_input_sql:${key}`,
                });
                const validatedParams = Validator(schema, query, {
                    query: true,
                    path: `find_input_params:${key}`,
                    removeOperators: true,
                });

                // Query SQL Statement
                let whereClauses = toSqlQuery(validatedQuery, { table: key });
                let groupClauses = [];
                // use json to parse JSON objects from schema (schema type ==='any' or typeof schema type === 'object')
                let sql = `SELECT ${Object.entries(schema).map(([field, value]) => {
                    if ((typeof value === 'object' || value === 'any') && !options?.populate?.includes(field)) {
                        return `json_extract(${key}.${field}, '$') as ${field}`;
                    }
                    return `${key}.${field}`;
                }).join(", ")}`;
                if (options?.populate) {
                    const { joins, selectFields, whereClauses: populateWhereClauses, groupClauses: populateGroupClauses } = populate(schema, options.populate, key);
                    groupClauses = populateGroupClauses;
                    if (populateWhereClauses.length) {
                        whereClauses = populateWhereClauses.join(" AND ");
                    }
                    sql += `, ${selectFields.join(", ")} FROM ${key} ${joins.join(" ")} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                } else {
                    sql += ` FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                }
                if (options?.sort) {
                    const sortClause = Object.entries(options.sort).map(([k, v]) => `${k} ${v === 1 ? "ASC" : "DESC"}`).join(", ");
                    sql += ` ORDER BY ${sortClause}`;
                }
                if (options?.limit) {
                    sql += ` LIMIT ${options.limit}`;
                }
                if (options?.skip) {
                    sql += ` OFFSET ${options.skip}`;
                }
                if (groupClauses?.length) {
                    sql += ` GROUP BY ${groupClauses.join(", ")}`;
                }
                const { sql: _sql, params } = convertToPositionalParams(sql, validatedParams);
                sql = _sql;
                const start = Date.now();

                config.debug && console.log("CRUD Execution Id:", executionId, "| find", "| SQL:", sql, "| Params:", JSON.stringify(params));
                // Prepare Statemens
                const stmt = await db.prepare(sql);
                // Execute SQL Statement
                const responses = await stmt.all(serializeParams(params));
                // Close the statement
                config.finalizePreparedStatements && stmt.finalize();
                // Validate the response
                const validatedResponse = Validator([schema], responses?.map((i) => deserializeParams(i, schema)), {
                    path: `find_output:${key}`,
                });
                config.debug && console.log("CRUD Execution Id:", executionId, "| find", "| Response:", JSON.stringify(validatedResponse), "| Duration:", Date.now() - start, "ms");

                return validatedResponse;
            },
            findOne: async (query, options) => {
                const executionId = crypto.randomUUID();
                // Validate query
                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `findOne_input_sql:${key}`,
                });
                const validatedParams = Validator(schema, query, {
                    query: true,
                    path: `findOne_input_params:${key}`,
                    removeOperators: true,
                });

                // Query SQL Statement
                const whereClauses = toSqlQuery(validatedQuery, { table: key });
                let sql = `SELECT ${Object.entries(schema).map(([field, value]) => {
                    if (typeof value === 'object' || value === 'any') {
                        return `json_extract(${key}.${field}, '$') as ${field}`;
                    }
                    return `${key}.${field}`;
                }).join(", ")}`;
                if (options?.populate) {
                    const { joins, selectFields } = populate(schema, options.populate);
                    sql += `, ${selectFields.join(", ")} FROM ${key} ${joins.join(" ")} ${whereClauses ? `WHERE ${whereClauses}` : ""} LIMIT 1`;
                } else {
                    sql += ` FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ""} LIMIT 1`;
                }

                const { sql: _sql, params } = convertToPositionalParams(sql, validatedParams);
                sql = _sql;

                const start = Date.now();
                config.debug && console.log("CRUD Execution Id:", executionId, "| findOne", "| SQL:", sql, "| Params:", JSON.stringify(validatedParams));
                // Prepare Statemens
                const stmt = await db.prepare(sql);
                // Execute SQL Statement
                const response = await stmt.get(serializeParams(params)) || null;
                // Close the statement
                config.finalizePreparedStatements && stmt.finalize();
                // Validate the response
                const validatedResponse = Validator(schema, deserializeParams(response, schema), {
                    path: `findOne_output:${key}`,
                });
                config.debug && console.log("CRUD Execution Id:", executionId, "| findOne", "| Response:", JSON.stringify(validatedResponse), "| Duration:", Date.now() - start, "ms");
                // Return the response
                return validatedResponse;
            },
            update: async (query, data, options) => {
                const executionId = crypto.randomUUID();
                // Validate query
                const validatedQuery = Validator(schema, query, {
                    query: true,
                    useDotNotation: true,
                    path: `update_inputQuery:${key}`,
                });
                const _validatedQueryParams = Validator(schema, query, {
                    path: `update_inputParams:${key}`,
                    removeOperators: true,
                });
                // Validate data
                const validatedData = formattedNestedData(Validator(schema, data, {
                    path: `update_inputData:${key}`,
                    query: true,
                    useDotNotation: true,
                }));
                const validatedDataParams = Validator(schema, data, {
                    path: `update_inputDataParams:${key}`,
                    removeOperators: true,
                    query: true,
                    useDotNotation: true,
                });

                if (config.addTimestamps) {
                    validatedData.updatedAt = new Date().toISOString();
                    validatedDataParams.updatedAt = new Date().toISOString();
                }

                const _sqlParams = { ..._validatedQueryParams, ...validatedDataParams };


                // Query SQL Statement
                const whereClauses = toSqlQuery(validatedQuery, { table: key })
                let querySql = `SELECT ${Object.entries(schema).map(([field, value]) => {
                    if (typeof value === 'object' || value === 'any') {
                        return `json_extract(${key}.${field}, '$') as ${field}`;
                    }
                    return `${key}.${field}`;
                }).join(", ")}`;
                querySql += ` FROM ${key} WHERE _id = (SELECT _id FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ''} LIMIT 1)`;
                // Update SQL Statement
                const setClauses = toSqlWrite('update', validatedData, { table: key, dialect: 'sqlite' });
                const _updateSql = `UPDATE ${key} ${setClauses} ${whereClauses ? `WHERE _id = (SELECT _id FROM ${key} WHERE ${whereClauses} LIMIT 1)` : ""}`;

                config.addTimestamps && (_sqlParams.updatedAt = new Date().toISOString());
                const { sql: updateSql, params: sqlParams } = convertToPositionalParams(_updateSql, _sqlParams);
                const { sql, params: validatedQueryParams } = convertToPositionalParams(querySql, _validatedQueryParams);
                console.log('SQL PARAMS', _sqlParams, _updateSql, querySql, _validatedQueryParams)
                querySql = sql;

                const start = Date.now();
                config.debug && console.log('CRUD Execution Id:', executionId, '| update', '| SQL:', updateSql, '| Params:', JSON.stringify(sqlParams));

                const response = await db.transaction(async () => {
                    // Prepare Statemens
                    const queryStmt = await db.prepare(querySql);
                    const updateStmt = await db.prepare(updateSql);
                    // Execute Statements
                    await updateStmt.run(serializeParams(sqlParams));
                    const updatedRow = await queryStmt.get(serializeParams(validatedQueryParams));
                    // Validate the response
                    const validatedResponse = Validator(schema, deserializeParams(updatedRow, schema), {
                        path: `update_output:${key}`,
                    });
                    // Close the Transactions
                    return validatedResponse;
                })();

                config.debug && console.log('CRUD Execution Id:', executionId, '| update', '| Response:', JSON.stringify(response)), '| Duration:', Date.now() - start, 'ms';

                config.finalizePreparedStatements && updateStmt.finalize();
                config.finalizePreparedStatements && queryStmt.finalize();
                return response;
            },
            updateMany: async (query, data, options) => {
                const executionId = crypto.randomUUID();

                // Validate query
                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `updateMany_inputQuery:${key}`,
                });
                const _validatedQueryParams = Validator(schema, query, {
                    query: true,
                    removeOperators: true,
                });
                const validatedData = Validator(schema, data, {
                    path: `updateMany_inputData:${key}`,
                });
                const validatedDataParams = Validator(schema, data, {
                    path: `updateMany_inputDataParams:${key}`,
                    removeOperators: true,
                });

                if (config.addTimestamps) {
                    validatedData.updatedAt = new Date().toISOString();
                    validatedDataParams.updatedAt = new Date().toISOString();
                }

                const _sqlParams = { ...validatedQueryParams, ...validatedDataParams };

                // Query SQL Statement
                // Where clause
                // Query SQL Statement
                const whereClauses = toSqlQuery(validatedQuery, { table: key })
                let querySql = `SELECT ${Object.entries(schema).map(([field, value]) => {
                    if (typeof value === 'object' || value === 'any') {
                        return `json_extract(${key}.${field}, '$') as ${field}`;
                    }
                    return `${key}.${field}`;
                }).join(", ")}`;
                querySql += ` FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ''}`;
                // const whereClauses = toSqlQuery(validatedQuery, { table: key });
                const setClauses = toSqlWrite(validatedData);
                const _updateSql = `UPDATE ${key} ${setClauses} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;

                config.addTimestamps && (sqlParams.updatedAt = new Date().toISOString());

                const { sql: updateSql, params: sqlParams } = convertToPositionalParams(_updateSql, _sqlParams);
                const { sql, params: validatedQueryParams } = convertToPositionalParams(querySql, _validatedQueryParams);
                querySql = sql;

                const start = Date.now();
                config.debug && console.log("CRUD Execution Id:", executionId, "| updateMany", "| SQL:", updateSql, "| Params:", JSON.stringify(sqlParams));
                // Execute SQL Statement
                const respose = await db.transaction(async () => {
                    // Prepare Statemens
                    const updateStmt = await db.prepare(updateSql);
                    const queryStmt = await db.prepare(querySql);
                    // Execute Statements
                    await updateStmt.run(serializeParams({ ...sqlParams, ...(config.addTimestamps ? { updatedAt: new Date().toISOString() } : {}) }));
                    // Validate the response
                    const updatedRows = await queryStmt.all(serializeParams(validatedQuery));
                    const validatedResponse = Validator([schema], updatedRows?.map((i) => deserializeParams(i, schema)), {
                        path: `updateMany_output:${key}`,
                    });
                    // Close the Transactions
                    return validatedResponse;
                })();

                config.debug && console.log("CRUD Execution Id:", executionId, "| updateMany", "| Response:", JSON.stringify(respose), "| Duration:", Date.now() - start, "ms");
                // Close the statement
                config.finalizePreparedStatements && updateStmt.finalize();
                config.finalizePreparedStatements && queryStmt.finalize();
                // Return the response
                return respose;
            },
            delete: async (query, options) => {
                const executionId = crypto.randomUUID();
                // Validate query
                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `delete_input:${key}`,
                });
                const validatedQueryParams = Validator(schema, query, {
                    query: true,
                    path: `delete_inputParams:${key}`,
                    removeOperators: true,
                });

                // Query SQL Statement
                const whereClauses = toSqlQuery(validatedQuery, { table: key });
                const _deleteSql = `DELETE FROM ${key} ${whereClauses ? `WHERE _id = (SELECT _id FROM ${key} WHERE ${whereClauses} LIMIT 1)` : ""}`;
                const { sql: deleteSql, params: sqlParams } = convertToPositionalParams(_deleteSql, validatedQueryParams);

                config.debug && console.log('CRUD Execution Id:', executionId, '| delete', '| SQL:', deleteSql, '| Params:', JSON.stringify(validatedQueryParams));
                // Prepare Statemens
                const start = Date.now();
                const deleteStmt = await db.prepare(deleteSql);
                // Execute SQL Statement
                deleteStmt.run(serializeParams(sqlParams));
                // Validate the response
                const validatedResponse = Validator(schema, { success: true }, {
                    path: `delete_output:${key}`,
                });

                // Close the Statement
                config.finalizePreparedStatements && deleteStmt.finalize();

                config.debug && console.log('CRUD Execution Id:', executionId, '| delete', '| Response:', JSON.stringify(validatedResponse), '| Duration:', Date.now() - start, 'ms');
                // Return the response
                return validatedResponse;
            },
            deleteMany: async (query, options) => {
                const executionId = crypto.randomUUID();

                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `deleteMany_input:${key}`,
                });
                const validatedQueryParams = Validator(schema, query, {
                    query: true,
                    path: `deleteMany_inputParams:${key}`,
                    removeOperators: true,
                });

                const whereClauses = toSqlQuery(validatedQuery, { table: key });

                const _deleteSql = `DELETE FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                const start = Date.now();
                const { sql: deleteSql, params: sqlParams } = convertToPositionalParams(_deleteSql, validatedQueryParams);

                config.debug && console.log('CRUD Execution Id:', executionId, '| deleteMany', '| SQL:', deleteSql, '| Params:', JSON.stringify(sqlParams));

                const response = await db.transaction(async () => {
                    const deleteStmt = await db.prepare(deleteSql);
                    deleteStmt.run(serializeParams(sqlParams));
                    const validatedResponse = Validator(schema, { success: true }, {
                        path: `delete_output:${key}`,
                    });
                    return validatedResponse;
                })();

                config.debug && console.log('CRUD Execution Id:', executionId, '| deleteMany', '| Response:', JSON.stringify(response), '| Duration:', Date.now() - start, 'ms');
                config.finalizePreparedStatements && deleteStmt.finalize();
                return response;
            },
            customQuery: async (queryStatement) => {
                const stmt = await db.prepare(queryStatement);
                const response = stmt.all();
                config.finalizePreparedStatements && stmt.finalize();
                // Add validation if needed
                return response;
            },
        };
    }
    const start = Date.now();

    db.exec(commands.join(";")).then(res => console.log('Table creation time:', Date.now() - start, 'ms'));

    connectedDbs.get(path).status = 'connected';

    return models;
};

function getValueByPath(obj, path) {
    const segments = path.match(/[^.\[\]"']+|(?<=\[)"(.*?)(?="\])/g);

    function getValue(current, segmentIndex) {
        if (current === undefined || segmentIndex === segments.length) {
            return current;
        }

        const segment = segments[segmentIndex];
        const next = current[segment];

        if (Array.isArray(next)) {
            return next.map(item => getValue(item, segmentIndex + 1));
        } else {
            return getValue(next, segmentIndex + 1);
        }
    }

    const value = getValue(obj, 0);

    return value;
}
