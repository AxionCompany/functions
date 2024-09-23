
import { toSqlQuery, toSqlWrite } from "./sqlUtils.js";
import { Validator as SchemaValidator, getDotNotationObject } from "../../connectors/validator.ts";
// import Database from 'npm:libsql@0.4.0-pre.10/promise'; // Using the promise api. 
import { createClient } from "npm:@libsql/client/node";

import _get from 'npm:lodash.get';
import _has from 'npm:lodash.has';

const DB_POOL_SIZE = 5; // Adjust this value based on your needs

class DatabasePool {
    constructor(url, options) {
        this.url = url;
        this.options = options;
        this.pool = [];
        this.initPool();
    }

    initPool() {
        for (let i = 0; i < DB_POOL_SIZE; i++) {
            const client = createClient({
                url: this.url,
                ...this.options
            });
            this.pool.push(client);
        }
    }

    async getConnection() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        // If all connections are in use, create a new one
        return createClient({
            url: this.url,
            ...this.options
        });
    }

    releaseConnection(connection) {
        if (this.pool.length < DB_POOL_SIZE) {
            this.pool.push(connection);
        } else {
            // If the pool is full, close the connection
            connection.close();
        }
    }
}

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
                ? value.map((i) => ['number', 'bigint', 'string', 'function'].indexOf(typeof i) === -1
                    ? JSON.stringify(i)
                    : typeof i === 'function'
                        ? `function:${i.name}`
                        : typeof i === 'string' && i.indexOf(' ') >= 0
                            ? `${i}`
                            : i)
                : null
        },
        deserialize: (value, schema) => {
            return value
                ? Object.entries(value).reduce((acc, [key, value]) => {
                    const currentSchema = schema[key];
                    if (
                        schema[key] === 'any' ||
                        typeof schema[key] === 'object' ||
                        (typeof currentSchema === 'string' && currentSchema?.includes("->"))
                    ) {
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
            if (!acc[newField]) {
                acc[newField] = { [fields.join('.')]: value }
            } else {
                acc[newField][fields.join('.')] = value;
            }
        }
        else {
            acc[field] = value;
        }
        return acc;
    }, {})

function convertToPositionalParams(sql, params) {

    const positionalParams = [];
    const paramMap = {};

    // Replace named parameters in the SQL with positional parameters (?)
    const transformedSql = sql.replace(/\?([a-zA-Z_$][a-zA-Z0-9_$]*)/g, (_, paramName) => {

        paramName = paramName // replace placeholders for special characters in variable names by the actual characters
            .replaceAll('_dot_', '.')
            .replaceAll('_openbracket_', '[')
            .replaceAll('_closebracket_', ']');

        if (_has(params, paramName)) {
            // if (!(paramName in paramMap)) {
            //     positionalParams.push(_get(params, paramName) || null);
            //     paramMap[paramName] = positionalParams.length;  // Track the index of each parameter
            // }
            positionalParams.push(_get(params, paramName) || null);
            return '?';
        } else {
            throw new Error(`Parameter ${paramName} not found in params object`);
        }
    });

    return {
        sql: transformedSql,
        params: positionalParams.map(param => typeof param === 'undefined' ? null : param)
    };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const writeQueues = new Map();
const maxRetries = 3;

const processQueue = async () => {

    for (const [dbPath, { queue }] of writeQueues) {

        if (queue.length === 0 || !connectedDbs.has(dbPath)) return;

        const dbPool = connectedDbs.get(dbPath).dbPool;
        const db = await dbPool.getConnection();
        try {

            const batch = queue.map(({ sql, params, id, resolve, reject }) => ({ sql, args: params, id, resolve, reject }));
            batch.forEach(b => {
                b.args = b.args.map(arg => arg === undefined ? 'nulo' : arg);
            })
            const results = await db.batch(batch.map(({ sql, args }) => ({ sql, args }))).catch((e) => {
                console.log('ERROR:', e);
            });

            results?.forEach((result, i) => {
                const { id, resolve, reject } = batch[i];
                if (!result || result.error) {
                    console.log('ERROR:', result.error);
                }
                resolve(result);

                const updatedQueue = writeQueues.get(dbPath).queue;
                updatedQueue.splice(updatedQueue.findIndex((item) => item.id === id), 1);
            });
        }
        catch (e) { console.log('ERROR IN PROCESS QUEUE:', e) }
        finally {
            dbPool.releaseConnection(db);
        }
    }
};

setInterval(processQueue, 1000);

export default (args) => {
    let dbPool;
    const config = args.config || {};
    const schemas = args.schemas;
    const Validator = args.Validator || SchemaValidator(schemas)
    const path = config.dbPath || './data/my.db';

    if (!connectedDbs.has(path)) {
        const start = Date.now();

        dbPool = new DatabasePool(path, config.dbOptions);

        console.log('Database connection pool created in:', Date.now() - start, 'ms');
        connectedDbs.set(path, { dbPool, config: config.dbOptions });
    } else {
        dbPool = connectedDbs.get(path).dbPool;
        console.log('Database pool already exists');
    }

    const writeQueue = {
        push: (data) => {
            if (!writeQueues.has(path)) writeQueues.set(path, { isProcessing: false, queue: [] });
            const { queue } = writeQueues.get(path);
            queue.push({ id: crypto.randomUUID(), ...data });
        }
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

        return `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
    };

    const buildJsonObjectQuery = (schema, alias, isArray = false) => {

        const fields = Object.keys(schema);
        return `${isArray ? ` json_group_array( CASE WHEN ${alias}._id IS NOT NULL THEN ` : ''}json_object(${fields.map(field => `'${field}', ${(schema[field] === 'any' || typeof schema[field] === 'object')
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
            if (!schemas[from]) {
                throw new Error(`Error while populating field '${key}': The schema '${from}' does not exist`);
            }
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
                const db = await dbPool.getConnection();
                try {

                    const executionId = crypto.randomUUID();

                    const validatedData = Validator(schema, data, {
                        path: `create_input:${key}`,
                        allowOperators: true,
                    });
                    const validatedParams = Validator(schema, data, {
                        path: `create_input:${key}`,
                        allowOperators: true,
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

                    querySql += ` FROM ${key} WHERE _id = ?`;
                    // Inster SQL Statement
                    const _insertSql = `INSERT INTO ${key} ${toSqlWrite('insert', validatedData)}`;
                    const { sql: insertSql, params } = convertToPositionalParams(_insertSql, validatedParams);

                    config.debug && console.log('CRUD Execution Id:', executionId, '| create', '| SQL:', insertSql, '| Params:', JSON.stringify(params));
                    const start = Date.now();

                    if (options?.async) {
                        // return
                        return new Promise((resolve, reject) => {
                            writeQueue.push({
                                dbPath: path,
                                sql: insertSql,
                                params: serializeParams(params),
                                resolve,
                                reject
                            });
                        });
                    }

                    const { rows: _0, columns: _1, rowsAffected: _2, lastInsertRowid } = await db.execute({
                        sql: insertSql,
                        args: serializeParams(params)
                    });

                    const { rows } = await db.execute({
                        sql: querySql,
                        args: serializeParams([lastInsertRowid])
                    });

                    const insertedRow = rows[0];

                    const validatedResponse = Validator(schema, deserializeParams(insertedRow, schema), {
                        path: `create_output:${key}`,
                    });

                    config.debug && console.log('CRUD Execution Id:', executionId, '| create', '| Response:', JSON.stringify(validatedResponse), '| Duration:', Date.now() - start, 'ms');

                    return validatedResponse;
                } finally {
                    dbPool.releaseConnection(db);
                }

            },
            createMany: async (data, options) => {
                const db = await dbPool.getConnection();
                try {
                    const executionId = crypto.randomUUID();

                    const validatedData = Validator([schema], data, {
                        path: `create_input:${key}`,
                        allowOperators: true,
                    });
                    const validatedParams = Validator([schema], data, {
                        path: `create_input:${key}`,
                        allowOperators: true,
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

                    querySql += ` FROM ${key} WHERE _id = ?`;
                    // Inster SQL Statement
                    const _insertSql = `INSERT INTO ${key} ${toSqlWrite('insert', validatedData[0])}`;
                    const arrayParams = validatedParams.map((params) => convertToPositionalParams(_insertSql, params));

                    const start = Date.now();
                    // const results = [];

                    if (options?.async) {
                        for (const { sql, params } of arrayParams) {
                            new Promise((resolve, reject) => {
                                writeQueue.push({
                                    dbPath: path,
                                    sql: sql,
                                    params: serializeParams(params),
                                    resolve,
                                    reject
                                });
                            });
                        }
                        return
                    }

                    const responseRaw = await db.batch(arrayParams.map(({ sql, params }) => ({ sql, args: params })))
                    const response = Promise.all(responseRaw.map(async (responseItem) => {
                        const { rows } = await db.execute({
                            sql: querySql,
                            args: serializeParams([responseItem.lastInsertRowid])
                        });

                        return deserializeParams(rows[0], schema);
                    }));

                    const results = Validator([schema], response, {
                        path: `create_output:${key}`,
                    });

                    config.debug && console.log('CRUD Execution Id:', executionId, '| create', '| Response:', JSON.stringify(results), '| Duration:', Date.now() - start, 'ms');

                    return results;
                } finally {
                    dbPool.releaseConnection(db);
                }
            },
            find: async (query, options) => {
                const db = await dbPool.getConnection();
                try {
                    const executionId = crypto.randomUUID();

                    // Validate query
                    const validatedQuery = formattedNestedData(Validator(schema, query, {
                        path: `find_input_sql:${key}`,
                        allowOperators: true,
                    }));

                    const validatedParams = Validator(schema, query, {
                        allowOperators: true,
                        removeOperators: true,
                        path: `find_input_params:${key}`,
                    });

                    // Query SQL Statement
                    let whereClauses = toSqlQuery(validatedQuery, { table: key });
                    let groupClauses = [];
                    // use json to parse JSON objects from schema (schema type ==='any' or typeof schema type === 'object')
                    let sql = `SELECT ${Object.entries(schema).map(([field, value]) => {
                        if (options?.populate?.includes(field)) return;
                        if ((typeof value === 'object' || value === 'any')) {
                            return `json_extract(${key}.${field}, '$') as ${field}`;
                        }
                        return `${key}.${field}`;
                    }).filter(Boolean).join(", ")}`;
                    if (options?.populate) {
                        if (!(typeof options?.populate === 'string' || Array.isArray(options?.populate))) {
                            throw new Error(`Invalid populate option for 'models.${key}.findOne': Expected a string or an array of strings, but received ${options.populate}`);
                        }
                        if (typeof options?.populate === 'string') options.populate = options?.populate.split(',');
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

                    console.log('SQL:', sql);
                    console.log('Params:', JSON.stringify(validatedParams));

                    const { sql: _sql, params } = convertToPositionalParams(sql, validatedParams);
                    sql = _sql;
                    const start = Date.now();

                    config.debug && console.log("CRUD Execution Id:", executionId, "| find", "| SQL:", sql, "| Params:", JSON.stringify(params));

                    // Execute SQL Statement
                    const { rows: responses } = await db.execute({
                        sql,
                        args: serializeParams(params)
                    });

                    // Validate the response
                    const validatedResponse = Validator([schema], responses?.map((i) => deserializeParams(i, schema)), {
                        path: `find_output:${key}`,
                    });
                    config.debug && console.log("CRUD Execution Id:", executionId, "| find", "| Response:", JSON.stringify(validatedResponse), "| Duration:", Date.now() - start, "ms");

                    return validatedResponse;
                } finally {
                    dbPool.releaseConnection(db);
                }
            },
            findOne: async (query, options) => {
                const db = await dbPool.getConnection();
                try {
                    const executionId = crypto.randomUUID();
                    // Validate query
                    const validatedQuery = formattedNestedData(Validator(schema, query, {
                        allowOperators: true,
                        path: `findOne_input_sql:${key}`,
                    }));
                    const validatedParams = Validator(schema, query, {
                        allowOperators: true,
                        removeOperators: true,
                        path: `findOne_input_params:${key}`,
                    });

                    // Query SQL Statement
                    const whereClauses = toSqlQuery(validatedQuery, { table: key });
                    let groupClauses = [];

                    let sql = `SELECT ${Object.entries(schema).map(([field, value]) => {
                        if (options?.populate?.includes(field)) return;
                        if ((typeof value === 'object' || value === 'any')) {
                            return `json_extract(${key}.${field}, '$') as ${field}`;
                        }
                        return `${key}.${field}`;
                    }).filter(Boolean).join(", ")}`;
                    if (options?.populate) {
                        if (!(typeof options?.populate === 'string' || Array.isArray(options?.populate))) {
                            throw new Error(`Invalid populate option for 'models.${key}.findOne': Expected a string or an array of strings, but received ${options.populate}`);
                        }
                        if (typeof options?.populate === 'string') options.populate = options?.populate.split(',');
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
                    if (groupClauses?.length) {
                        sql += ` GROUP BY ${groupClauses.join(", ")}`;
                    }
                    sql += ` LIMIT 1`;

                    const { sql: _sql, params } = convertToPositionalParams(sql, validatedParams);
                    sql = _sql;

                    const start = Date.now();
                    config.debug && console.log("CRUD Execution Id:", executionId, "| findOne", "| SQL:", sql, "| Params:", JSON.stringify(params));

                    const { rows: [response] } = await db.execute({
                        sql,
                        args: serializeParams(params)
                    });
                    // Validate the response
                    const validatedResponse = Validator(schema, deserializeParams(response, schema), {
                        path: `findOne_output:${key}`,
                    });
                    config.debug && console.log("CRUD Execution Id:", executionId, "| findOne", "| Response:", JSON.stringify(validatedResponse), "| Duration:", Date.now() - start, "ms");
                    // Return the response
                    return validatedResponse;
                } finally {
                    dbPool.releaseConnection(db);
                }
            },
            update: async (query, data, options) => {
                const db = await dbPool.getConnection();
                try {
                    const executionId = crypto.randomUUID();
                    // Validate query
                    const validatedQuery = formattedNestedData(Validator(schema, query, {
                        allowOperators: true,
                    }));
                    const _validatedQueryParams = Validator(schema, query, {
                        allowOperators: true,
                        removeOperators: true,
                        path: `update_inputParams:${key}`,
                    });
                    // Validate data
                    const validatedData = formattedNestedData(Validator(schema, data, {
                        allowOperators: true,
                        path: `update_inputData:${key}`,
                    }));
                    const validatedDataParams = Validator(schema, data, {
                        allowOperators: true,
                        removeOperators: true,
                        path: `update_inputDataParams:${key}`,
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
                    querySql = sql;

                    const start = Date.now();
                    config.debug && console.log('CRUD Execution Id:', executionId, '| update', '| SQL:', updateSql, '| Params:', JSON.stringify(sqlParams));

                    if (options?.async) {
                        return new Promise((resolve, reject) => {
                            writeQueue.push({
                                dbPath: path,
                                sql: updateSql,
                                params: serializeParams(sqlParams),
                                resolve,
                                reject
                            });
                        });
                    }

                    await db.execute({
                        sql: updateSql,
                        args: serializeParams(sqlParams)
                    });

                    const { rows: [updatedRow] } = await db.execute({
                        sql: querySql,
                        args: serializeParams(validatedQueryParams)
                    });

                    const response = Validator(schema, deserializeParams(updatedRow, schema), {
                        path: `update_output:${key}`
                    });

                    config.debug && console.log('CRUD Execution Id:', executionId, '| update', '| Response:', JSON.stringify(response)), '| Duration:', Date.now() - start, 'ms';

                    return response;
                } finally {
                    dbPool.releaseConnection(db);
                }
            },
            updateMany: async (query, data, options) => {
                const db = await dbPool.getConnection();
                try {
                    const executionId = crypto.randomUUID();

                    // Validate query
                    const validatedQuery = formattedNestedData(Validator(schema, query, {
                        allowOperators: true,
                        path: `updateMany_inputQuery:${key}`,
                    }));
                    const _validatedQueryParams = Validator(schema, query, {
                        allowOperators: true,
                        removeOperators: true,
                    });
                    const validatedData = formattedNestedData(Validator(schema, data, {
                        allowOperators: true,
                        path: `updateMany_inputData:${key}`,
                    }));
                    const validatedDataParams = Validator(schema, data, {
                        allowOperators: true,
                        removeOperators: true,
                        path: `updateMany_inputDataParams:${key}`,
                    });

                    if (config.addTimestamps) {
                        validatedData.updatedAt = new Date().toISOString();
                        validatedDataParams.updatedAt = new Date().toISOString();
                    }

                    const _sqlParams = { ...validatedQueryParams, ...validatedDataParams };

                    // Query SQL Statement
                    // Where clause
                    const whereClauses = toSqlQuery(validatedQuery, { table: key })
                    let querySql = `SELECT ${Object.entries(schema).map(([field, value]) => {
                        if (typeof value === 'object' || value === 'any') {
                            return `json_extract(${key}.${field}, '$') as ${field}`;
                        }
                        return `${key}.${field}`;
                    }).join(", ")}`;
                    querySql += ` FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ''}`;

                    const setClauses = toSqlWrite(validatedData);
                    const _updateSql = `UPDATE ${key} ${setClauses} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;

                    config.addTimestamps && (sqlParams.updatedAt = new Date().toISOString());

                    const { sql: updateSql, params: sqlParams } = convertToPositionalParams(_updateSql, _sqlParams);
                    const { sql, params: validatedQueryParams } = convertToPositionalParams(querySql, _validatedQueryParams);
                    querySql = sql;

                    const start = Date.now();
                    config.debug && console.log("CRUD Execution Id:", executionId, "| updateMany", "| SQL:", updateSql, "| Params:", JSON.stringify(sqlParams));
                    // Execute SQL Statement

                    if (options?.async) {
                        return new Promise((resolve, reject) => {
                            writeQueue.push({
                                dbPath: path,
                                sql: updateSql,
                                params: serializeParams(sqlParams),
                                resolve,
                                reject
                            });
                        });
                    }

                    await db.execute({
                        sql: updateSql,
                        args: serializeParams(sqlParams)
                    });
                    const { rows: updatedRows } = await db.execute({
                        sql: querySql,
                        args: serializeParams(validatedQueryParams)
                    });

                    const respose = Validator([schema], updatedRows?.map((i) => deserializeParams(i, schema)), {
                        path: `updateMany_output:${key}`,
                    });

                    config.debug && console.log("CRUD Execution Id:", executionId, "| updateMany", "| Response:", JSON.stringify(respose), "| Duration:", Date.now() - start, "ms");

                    // Return the response
                    return respose;
                } finally {
                    dbPool.releaseConnection(db);
                }
            },
            delete: async (query, options) => {
                const db = await dbPool.getConnection();
                try {
                    const executionId = crypto.randomUUID();
                    // Validate query
                    const validatedQuery = Validator(schema, query, {
                        allowOperators: true,
                        path: `delete_input:${key}`,
                    });
                    const validatedQueryParams = Validator(schema, query, {
                        allowOperators: true,
                        path: `delete_inputParams:${key}`,
                        removeOperators: true,
                    });

                    // Query SQL Statement
                    const whereClauses = toSqlQuery(validatedQuery, { table: key });
                    const _deleteSql = `DELETE FROM ${key} ${whereClauses ? `WHERE _id = (SELECT _id FROM ${key} WHERE ${whereClauses} LIMIT 1)` : ""}`;
                    const { sql: deleteSql, params: sqlParams } = convertToPositionalParams(_deleteSql, validatedQueryParams);

                    config.debug && console.log('CRUD Execution Id:', executionId, '| delete', '| SQL:', deleteSql, '| Params:', JSON.stringify(validatedQueryParams));

                    if (options?.async) {
                        return new Promise((resolve, reject) => {
                            writeQueue.push({
                                dbPath: path,
                                sql: deleteSql,
                                params: serializeParams(sqlParams),
                                resolve,
                                reject
                            });
                        });
                    }

                    // // Execute SQL Statement
                    const start = Date.now();

                    db.execute({
                        sql: deleteSql,
                        args: serializeParams(sqlParams)
                    });

                    // Validate the response
                    const validatedResponse = Validator(schema, { success: true }, {
                        path: `delete_output:${key}`,
                    });

                    // Close the Statement
                    config.finalizePreparedStatements && deleteStmt.finalize();

                    config.debug && console.log('CRUD Execution Id:', executionId, '| delete', '| Response:', JSON.stringify(validatedResponse), '| Duration:', Date.now() - start, 'ms');
                    // Return the response
                    return validatedResponse;
                } finally {
                    dbPool.releaseConnection(db);
                }
            },
            deleteMany: async (query, options) => {
                const db = await dbPool.getConnection();
                try {
                    const executionId = crypto.randomUUID();

                    const validatedQuery = Validator(schema, query, {
                        allowOperators: true,
                        path: `deleteMany_input:${key}`,
                    });
                    const validatedQueryParams = Validator(schema, query, {
                        allowOperators: true,
                        removeOperators: true,
                        path: `deleteMany_inputParams:${key}`,
                    });

                    const whereClauses = toSqlQuery(validatedQuery, { table: key });

                    const _deleteSql = `DELETE FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                    const start = Date.now();
                    const { sql: deleteSql, params: sqlParams } = convertToPositionalParams(_deleteSql, validatedQueryParams);

                    config.debug && console.log('CRUD Execution Id:', executionId, '| deleteMany', '| SQL:', deleteSql, '| Params:', JSON.stringify(sqlParams));

                    if (options?.async) {
                        return new Promise((resolve, reject) => {
                            writeQueue.push({
                                dbPath: path,
                                sql: deleteSql,
                                params: serializeParams(sqlParams),
                                resolve,
                                reject
                            });
                        });
                    }

                    // Execute SQL Statement
                     await db.execute({
                        sql: deleteSql,
                        args: serializeParams(sqlParams)
                    });

                   // Validate the response
                   const validatedResponse = Validator(schema, { success: true }, {
                    path: `delete_output:${key}`,
                });
                    config.debug && console.log('CRUD Execution Id:', executionId, '| deleteMany', '| Response:', JSON.stringify(validatedResponse), '| Duration:', Date.now() - start, 'ms');
                    config.finalizePreparedStatements && deleteStmt.finalize();
                    return response;
                } finally {
                    dbPool.releaseConnection(db);
                }
            },
            customQuery: async (queryStatement) => {
                const db = await dbPool.getConnection();
                try {
                    const stmt = await db.prepare(queryStatement);
                    const response = stmt.all();
                    config.finalizePreparedStatements && stmt.finalize();
                    // Add validation if needed
                    return response;
                } finally {
                    dbPool.releaseConnection(db);
                }
            },
        };
    }

    dbPool.getConnection().then(db => {
        const start = Date.now();
        !config.syncUrl && commands.forEach((command) => {
            db.execute({ sql: command, args: [] })
        })
        dbPool.releaseConnection(db);
        console.log('db connected', Date.now() - start, 'ms');
    })

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
