
import { toSqlQuery, toSqlWrite } from "./sqlUtils.js";
import SchemaValidator from "../validator.js";

export default ({ db, schemas, Validator }) => {

    Validator = Validator || SchemaValidator;
    const models = {};

    const createTable = async (schema, tableName) => {
        const columns = Object.entries(schema).map(([key, type]) => {
            if (typeof type === "string" && type.includes("->")) return `${key} INTEGER`;
            if (key === "_id") return `${key} INTEGER PRIMARY KEY AUTOINCREMENT`;
            if (type === "string") return `${key} TEXT`;
            if (type === "number") return `${key} REAL`;
            if (type === "boolean") return `${key} INTEGER`;
            if (type === "date") return `${key} TEXT`;
            if (type === "any" || typeof type === 'object') return `${key} TEXT`;
            // Add more type mappings 
        })?.filter(Boolean)?.join(", ");
        await db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`);
    };

    const buildJsonObjectQuery = (schema, alias) => {
        const fields = Object.keys(schema);
        return `json_object(${fields.map(field => `'${field}', ${alias}.${field}`).join(", ")})`;
    };

    const populate = (schema, populateKeys) => {
        const joins = [];
        const selectFields = [];
        const dynamicPopulate = {};

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
                const jsonObjectQuery = buildJsonObjectQuery(schemas[fromTable], fromTable);
                joins.push(`LEFT JOIN ${fromTable} ON ${key} = ${fromTable}._id`);
                selectFields.push(`(${jsonObjectQuery}) AS ${key}`);
            }
        }

        return { dynamicPopulate, joins, selectFields };
    };

    for (const key in schemas) {
        const schema = schemas[key];
        createTable(schema, key);  // Ensure table creation

        models[key] = {
            create: async (data, options) => {
                const validatedData = Validator(schema, data, {
                    path: `create_input:${key}`,
                    clean: false,
                });
                console.log(validatedData, schema, data);

                return db.transaction(() => {
                    const insertSql = `INSERT INTO ${key} ${toSqlWrite('insert', validatedData)}`;
                    const insertStmt = db.prepare(insertSql);
                    insertStmt.run();
                    insertStmt.finalize();
                    const queryStmt = db.prepare(`SELECT * FROM ${key} WHERE _id = last_insert_rowid()`)
                    const insertedRow = queryStmt.get();
                    queryStmt.finalize();
                    console.log(insertedRow, schema);
                    const validatedResponse = Validator(schema, insertedRow, {
                        path: `create_output:${key}`,
                    });

                    return validatedResponse;
                })();
            },
            createMany: async (data, options) => {
                const validatedData = Validator([schema], data, {
                    path: `createMany_input:${key}`,
                });

                return db.transaction(() => {
                    const queryStmt = db.prepare(`SELECT * FROM ${key} WHERE _id = last_insert_rowid()`);
                    const inserted = [];
                    let insertStmt;
                    for (const row of validatedData) {
                        const insertSql = `INSERT INTO ${key} ${toSqlWrite('insert', validatedData[0])}`;
                        insertStmt = db.prepare(insertSql);
                        insertStmt.run(row);
                        const insertedRow = queryStmt.get();
                        inserted.push(insertedRow);
                    }
                    insertStmt.finalize();
                    queryStmt.finalize();
                    const validatedResponse = Validator([schema], inserted, {
                        path: `createMany_output:${key}`,
                    });
                    return validatedResponse;
                })();
            },
            find: async (query, options) => {

                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `find_input:${key}`,
                });

                const whereClauses = toSqlQuery(validatedQuery);
                const sqlParams = { ...query };

                let sql = `SELECT ${key}.*`;

                if (options?.populate) {
                    const { joins, selectFields } = populate(schema, options.populate);
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

                const stmt = db.prepare(sql);
                const responses = stmt.all(sqlParams);
                stmt.finalize();
                const validatedResponse = Validator([schema], responses, {
                    path: `find_output:${key}`,
                });

                return validatedResponse;
            },
            findOne: async (query, options) => {
                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `findOne_input:${key}`,
                });
                const whereClauses = toSqlQuery(validatedQuery);
                const sqlParams = { ...query };

                let sql = `SELECT ${key}.*`;
                if (options?.populate) {
                    const { joins, selectFields } = populate(schema, options.populate);
                    sql += `, ${selectFields.join(", ")} FROM ${key} ${joins.join(" ")} ${whereClauses ? `WHERE ${whereClauses}` : ""} LIMIT 1`;
                } else {
                    sql += ` FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ""} LIMIT 1`;
                }
                const stmt = db.prepare(sql);
                const response = stmt.get(sqlParams) || null;
                stmt.finalize();
                const validatedResponse = Validator(schema, response, {
                    path: `findOne_output:${key}`,
                });

                return validatedResponse;
            },
            update: async (query, data, options) => {
                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `update_inputQuery:${key}`,
                });
                const validatedData = Validator(schema, data, {
                    path: `update_inputData:${key}`,
                });

                const setClauses = toSqlWrite('update', validatedData, { table: key, dialect: 'sqlite' });
                const whereClauses = toSqlQuery(validatedQuery);
                const sqlParams = { ...validatedData, ...validatedQuery };

                return db.transaction(() => {
                    const updateSql = `UPDATE ${key} ${setClauses} ${whereClauses ? `WHERE _id = (SELECT _id FROM ${key} WHERE ${whereClauses} LIMIT 1)` : ""}`;
                    const querySql = `SELECT * FROM ${key} ${whereClauses ? `WHERE _id = (SELECT _id FROM ${key} WHERE ${whereClauses} LIMIT 1)` : ""}`;
                    const updateStmt = db.prepare(updateSql);
                    const queryStmt = db.prepare(querySql);
                    updateStmt.run(sqlParams);
                    const updatedRow = queryStmt.get();
                    updateStmt.finalize();
                    queryStmt.finalize();
                    const validatedResponse = Validator(schema, updatedRow, {
                        path: `update_output:${key}`,
                    });
                    return validatedResponse;
                })();
            },
            updateMany: async (query, data, options) => {

                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `updateMany_inputQuery:${key}`,
                });
                const validatedData = Validator(schema, data, {
                    path: `updateMany_inputData:${key}`,
                });

                const setClauses = toSqlQuery(validatedData);
                const whereClauses = toSqlQuery(validatedQuery);
                const sqlParams = { ...validatedData, ...validatedQuery };

                return db.transaction(() => {
                    const updateSql = `UPDATE ${key} SET ${setClauses} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                    const querySql = `SELECT * FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                    const updateStmt = db.prepare(updateSql);
                    const queryStmt = db.prepare(querySql);
                    updateStmt.run(sqlParams);
                    const updatedRows = queryStmt.all(validatedQuery);
                    updateStmt.finalize();
                    queryStmt.finalize();
                    const validatedResponse = Validator([schema], updatedRows, {
                        path: `updateMany_output:${key}`,
                    });
                    return validatedResponse;
                })();
            },
            delete: async (query, options) => {
                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `delete_input:${key}`,
                });

                const whereClauses = toSqlQuery(validatedQuery);
                const sqlParams = { ...validatedQuery };

                return db.transaction(() => {
                    const deleteSql = `DELETE FROM ${key} ${whereClauses ? `WHERE _id = (SELECT _id FROM ${key} WHERE ${whereClauses} LIMIT 1)` : ""}`;
                    const deleteStmt = db.prepare(deleteSql);
                    deleteStmt.run(sqlParams);
                    deleteStmt.finalize();

                    const validatedResponse = Validator(schema, { success: true }, {
                        path: `delete_output:${key}`,
                    });
                    return validatedResponse;
                })();
            },
            deleteMany: async (query, options) => {
                const validatedQuery = Validator(schema, query, {
                    query: true,
                    path: `delete_input:${key}`,
                });

                const whereClauses = toSqlQuery(validatedQuery);
                const sqlParams = { ...validatedQuery };

                return db.transaction(() => {
                    const deleteSql = `DELETE FROM ${key} ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                    const deleteStmt = db.prepare(deleteSql);
                    deleteStmt.run(sqlParams);
                    deleteStmt.finalize();

                    const validatedResponse = Validator(schema, { success: true }, {
                        path: `delete_output:${key}`,
                    });
                    return validatedResponse;
                })();
            },
            customQuery: async (queryStatement) => {
                const stmt = db.prepare(queryStatement);
                const response = stmt.all();
                stmt.finalize();
                // Add validation if needed
                return response;
            },
        };
    }

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
