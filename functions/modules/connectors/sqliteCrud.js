
export default ({ db, schemas, Validator }) => {
    const models = {};

    const createTable = async (schema, tableName) => {
        const columns = Object.entries(schema).map(([key, type]) => {
            if (typeof type === "string" && type.includes("->")) return `${key} INTEGER`;
            if (key === "_id") return `${key} INTEGER PRIMARY KEY AUTOINCREMENT`;
            if (type === "string") return `${key} TEXT`;
            if (type === "number") return `${key} REAL`;
            if (type === "boolean") return `${key} INTEGER`;
            if (type === "date") return `${key} TEXT`;
            if (type === "any") return `${key} TEXT`;   
            // Add more type mappings as needed
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

                const columns = Object.keys(validatedData);
                const placeholders = columns.map((col) => `:${col}`).join(", ");
                const sql = `INSERT INTO ${key} (${columns.join(", ")}) VALUES (${placeholders})`;


                return db.transaction(() => {
                    const insertStmt = db.prepare(sql);
                    insertStmt.run(validatedData);
                    insertStmt.finalize();
                    const queryStmt = db.prepare(`SELECT * FROM ${key} WHERE _id = last_insert_rowid()`)
                    const insertedRow = queryStmt.get();
                    queryStmt.finalize();
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

                const columns = Object.keys(validatedData[0]).join(", ");
                const sql = `INSERT INTO ${key} (${columns}) VALUES (${Object.keys(validatedData[0]).map((col) => `:${col}`).join(", ")})`;

                return db.transaction(() => {
                    const insertStmt = db.prepare(sql);
                    const queryStmt = db.prepare(`SELECT * FROM ${key} WHERE _id = last_insert_rowid()`);
                    const inserted = [];
                    for (const row of validatedData) {
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

                const whereClauses = Object.entries(query).map(([k, v]) => `${k} = :${k}`).join(" AND ");
                const sqlParams = { ...query };

                let sql = `SELECT ${key}.*`;

                if (options?.populate) {
                    const { joins, selectFields } = populate(schema, options.populate);
                    sql += `, ${selectFields.join(", ")} FROM ${key} ${joins.join(" ")}  ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
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
                const validatedResponse = Validator([schema], responses, {
                    path: `find_output:${key}`,
                });

                return validatedResponse;
            },
            findOne: async (query, options) => {
                const whereClauses = Object.entries(query).map(([k, v]) => `${k} = :${k}`).join(" AND ");
                const sqlParams = { ...query };

                let sql = `SELECT ${key}.*`;
                if (options?.populate) {
                    const { joins, selectFields } = populate(schema, options.populate);
                    sql += `, ${selectFields.join(", ")} FROM ${key} ${joins.join(" ")}  ${whereClauses ? `WHERE ${whereClauses}` : ""} LIMIT 1`;
                } else {
                    sql += ` FROM ${key}  ${whereClauses ? `WHERE ${whereClauses}` : ""} LIMIT 1`;
                }
                const stmt = db.prepare(sql);
                const [response] = stmt.all(sqlParams) || [null];
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

                const setClauses = Object.keys(validatedData).map(k => `${k} = :${k}`).join(", ");
                const whereClauses = Object.entries(validatedQuery).map(([k, v]) => `${k} = :${k}`).join(" AND ");
                const sqlParams = { ...validatedData, ...validatedQuery };

                return db.transaction(() => {
                    const updateSql = `UPDATE ${key} SET ${setClauses} ${whereClauses ? `WHERE _id = (SELECT _id FROM ${key} WHERE ${whereClauses}  LIMIT 1)` : ""}`;
                    const querySql = `SELECT * FROM ${key} ${whereClauses ? `WHERE _id = (SELECT _id FROM ${key} WHERE ${whereClauses}  LIMIT 1)` : ""}`;
                    const updateStmt = db.prepare(updateSql);
                    const queryStmt = db.prepare(querySql);
                    updateStmt.run(sqlParams);
                    const updatedRow = queryStmt.get(validatedQuery);
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

                const setClauses = Object.keys(validatedData).map(k => `${k} = :${k}`).join(", ");
                const whereClauses = Object.entries(validatedQuery).map(([k, v]) => `${k} = :${k}`).join(" AND ");
                const sqlParams = { ...validatedData, ...validatedQuery };

                return db.transaction(() => {
                    const updateSql = `UPDATE ${key} SET ${setClauses}  ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                    const querysql = `SELECT * FROM ${key}  ${whereClauses ? `WHERE ${whereClauses}` : ""}`;
                    const updateStmt = db.prepare(updateSql);
                    const queryStmt = db.prepare(querysql);
                    updateStmt.run(sqlParams);
                    updateStmt.finalize();
                    queryStmt.finalize();
                    const updatedRows = queryStmt.all(validatedQuery);
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

                const whereClauses = Object.entries(validatedQuery).map(([k, v]) => `${k} = :${k}`).join(" AND ");
                const sqlParams = { ...validatedQuery };

                return db.transaction(() => {
                    const sql = `DELETE FROM ${key} WHERE ${whereClauses}`;
                    const deleteStmt = db.prepare(sql);
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
