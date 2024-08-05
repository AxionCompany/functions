
import { toSqlQuery, toSqlWrite } from "./sqlUtils.js";
import { Validator as SchemaValidator } from "../../connectors/validator.ts";
import Database from 'npm:libsql';
let hasConnected = false;
let db;

// To use with Sqlite3 lib: serializers are not necessary; Should set config.finalizePreparedStatements to true so there's no leak;
// To use with better-sqlite-3, use the stringifyObjects serializer. Should set config.finalizePreparedStatements to false as there's no need for it;
const serializers = {
    stringifyObjects: {
        serialize: (value) => {
            return value
                ? Object.entries(value).reduce((acc, [key, value]) => {
                    acc[key] = typeof value === 'object' ? JSON.stringify(value) : value;
                    return acc;
                }, {})
                : null
        },
        deserialize: (value) => {
            return value
                ? Object.entries(value).reduce((acc, [key, value]) => {
                    try {
                        acc[key] = JSON.parse(value);
                    } catch (_) {
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
                ? value.map((i) => typeof i === 'object' ? JSON.stringify(i) : i)
                : null
        },
        deserialize: (value) => {
            return value
                ? Object.entries(value).reduce((acc, [key, value]) => {
                    try {
                        acc[key] = JSON.parse(value);
                    } catch (_) {
                        acc[key] = value;
                    }
                    return acc;
                }, {})
                : null
        }
    },

}

function convertToPositionalParams(sql, params) {
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

export default ({ config, db: _db, schemas, Validator }) => {
    const path = config.dbPath || './data/my.db';
    if (!db) {
        const start = Date.now();
        db = _db || new Database(path, config.dbOptions);
        console.log('Database connection time:', Date.now() - start, 'ms');
    } else {
        console.log('Database already connected');
    }

    Validator = Validator || SchemaValidator(schemas);
    const models = {};
    const serializeParams = config?.serializer && serializers[config.serializer]?.serialize || ((d) => d);
    const deserializeParams = config?.serializer && serializers[config?.serializer]?.deserialize || ((d) => d)

    const createTable = async (schema, tableName) => {
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
        await db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`);
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

    for (const key in schemas) {
        const schema = schemas[key];
        config.addTimestamps && (schema.createdAt = "string");
        config.addTimestamps && (schema.updatedAt = "string");
        const start = Date.now();
        if (!hasConnected) {
            createTable(schema, key);  // Ensure table creation
        }
        console.log('Table creation time:', Date.now() - start, 'ms');

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

                config.debug && console.log('CRUD Execution Id:', executionId, '| create', '| SQL:', insertSql, '| Params:', JSON.stringify(validatedParams));
                const start = Date.now();
                const response = db.transaction(() => {
                    // Prepare Statemens
                    const queryStmt = db.prepare(querySql);
                    const insertStmt = db.prepare(insertSql);
                    // Execute Statements
                    insertStmt.run(serializeParams(params));
                    const insertedRow = queryStmt.get()
                    // Validate the response
                    const validatedResponse = Validator(schema, deserializeParams(insertedRow), {
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
                // Validate data
                const validatedData = Validator([schema], data, {
                    path: `createMany_input_sql:${key}`,
                });
                const validatedParams = Validator([schema], data, {
                    path: `createMany_input_params:${key}`,
                    removeOperators: true,
                });

                if (config.addTimestamps) {
                    validatedData.forEach((row) => {
                        row.createdAt = new Date().toISOString();
                        row.updatedAt = new Date().toISOString();
                    });
                    validatedParams.forEach((row) => {
                        row.createdAt = new Date().toISOString();
                        row.updatedAt = new Date().toISOString();
                    });
                }


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
                const { sql: insertSql } = convertToPositionalParams(_insertSql, validatedParams[0]);

                const start = Date.now();
                config.debug && console.log('CRUD Execution Id:', executionId, '| createMany', '| SQL:', insertSql, '| Params:', JSON.stringify(validatedParams));
                const result = db.transaction(() => {
                    // Prepare Statemens
                    const insertStmt = db.prepare(insertSql);
                    const queryStmt = db.prepare(querySql);
                    // Execute Statements
                    const inserted = [];
                    for (const row of validatedParams) {
                        const { params } = convertToPositionalParams(_insertSql, row);
                        insertStmt.run(serializeParams(params));
                        const insertedRow = queryStmt.get();
                        inserted.push(deserializeParams(insertedRow));
                    }
                    // Validate the response
                    const validatedResponse = Validator([schema], inserted, {
                        path: `createMany_output:${key}`,
                    });
                    // Close the Transactions
                    return validatedResponse;
                })();
                config.debug && console.log('CRUD Execution Id:', executionId, '| createMany', '| Response:', JSON.stringify(result), '| Duration:', Date.now() - start, 'ms');
                config.finalizePreparedStatements && insertStmt.finalize();
                config.finalizePreparedStatements && queryStmt.finalize();
                return result;
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
                const stmt = db.prepare(sql);
                // Execute SQL Statement
                const responses = stmt.all(serializeParams(params));
                // Close the statement
                config.finalizePreparedStatements && stmt.finalize();
                // Validate the response
                const validatedResponse = Validator([schema], responses?.map(deserializeParams), {
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
                const stmt = db.prepare(sql);
                // Execute SQL Statement
                const response = stmt.get(serializeParams(params)) || null;
                // Close the statement
                config.finalizePreparedStatements && stmt.finalize();
                // Validate the response
                const validatedResponse = Validator(schema, deserializeParams(response), {
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
                    path: `update_inputQuery:${key}`,
                });
                const _validatedQueryParams = Validator(schema, query, {
                    query: true,
                    path: `update_inputParams:${key}`,
                    removeOperators: true,
                });
                // Validate data
                const validatedData = Validator(schema, data, {
                    path: `update_inputData:${key}`,
                });
                const validatedDataParams = Validator(schema, data, {
                    path: `update_inputDataParams:${key}`,
                    removeOperators: true,
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
                const start = Date.now();
                config.debug && console.log('CRUD Execution Id:', executionId, '| update', '| SQL:', _updateSql, '| Params:', JSON.stringify(_sqlParams));

                const { sql: updateSql, params: sqlParams } = convertToPositionalParams(_updateSql, _sqlParams);
                const { sql, params: validatedQueryParams } = convertToPositionalParams(querySql, _validatedQueryParams);
                querySql = sql;


                const response = db.transaction(() => {
                    // Prepare Statemens
                    const queryStmt = db.prepare(querySql);
                    const updateStmt = db.prepare(updateSql);
                    // Execute Statements
                    updateStmt.run(serializeParams(sqlParams));
                    const updatedRow = queryStmt.get(serializeParams(validatedQueryParams));
                    // Validate the response
                    const validatedResponse = Validator(schema, deserializeParams(updatedRow), {
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
                const validatedQueryParams = Validator(schema, query, {
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

                const sqlParams = { ...validatedQueryParams, ...validatedDataParams };

                // Query SQL Statement
                const whereClauses = toSqlQuery(validatedQuery, { table: key });
                const setClauses = toSqlWrite(validatedData);
                const updateSql = `UPDATE ${key} SET ${setClauses} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                const querySql = `SELECT * FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;



                config.addTimestamps && (sqlParams.updatedAt = new Date().toISOString());
                const start = Date.now();
                config.debug && console.log("CRUD Execution Id:", executionId, "| updateMany", "| SQL:", updateSql, "| Params:", JSON.stringify(sqlParams));
                // Execute SQL Statement
                const respose = db.transaction(() => {
                    // Prepare Statemens
                    const updateStmt = db.prepare(updateSql);
                    const queryStmt = db.prepare(querySql);
                    // Execute Statements
                    updateStmt.run(serializeParams({ ...sqlParams, ...(config.addTimestamps ? { updatedAt: new Date().toISOString() } : {}) }));
                    // Validate the response
                    const updatedRows = queryStmt.all(serializeParams(validatedQuery));
                    const validatedResponse = Validator([schema], updatedRows?.map(deserializeParams), {
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
                const deleteSql = `DELETE FROM ${key} ${whereClauses ? `WHERE _id = (SELECT _id FROM ${key} WHERE ${whereClauses} LIMIT 1)` : ""}`;
                const start = Date.now();
                config.debug && console.log('CRUD Execution Id:', executionId, '| delete', '| SQL:', deleteSql, '| Params:', JSON.stringify(validatedQueryParams));

                // Prepare Statemens
                const deleteStmt = db.prepare(deleteSql);
                // Execute SQL Statement
                deleteStmt.run(serializeParams(validatedQueryParams));
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
                    path: `delete_input:${key}`,
                });

                const whereClauses = toSqlQuery(validatedQuery, { table: key });
                const sqlParams = { ...validatedQuery };

                const deleteSql = `DELETE FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                const start = Date.now();
                config.debug && console.log('CRUD Execution Id:', executionId, '| deleteMany', '| SQL:', deleteSql, '| Params:', JSON.stringify(sqlParams));
                const response = db.transaction(() => {
                    const deleteStmt = db.prepare(deleteSql);
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
                const stmt = db.prepare(queryStatement);
                const response = stmt.all();
                config.finalizePreparedStatements && stmt.finalize();
                // Add validation if needed
                return response;
            },
        };
    }
    hasConnected = true;

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
