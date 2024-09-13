function toSqlQuery(query, config) {
    config.dialect = config.dialect || 'sqlite';

    const sqlConditions = [];

    const defaultOperatorsMap = {
        $eq: "=",
        $gt: ">",
        $gte: ">=",
        $in: "IN",
        $lt: "<",
        $lte: "<=",
        $ne: "!=",
        $nin: "NOT IN",
        $and: "AND",
        $or: "OR",
        $not: "NOT",
        $nor: "NOR",
        $exists: "EXISTS",
        $mod: "MOD",
        $regex: "REGEXP",
        $size: "json_array_length"
    };

    const dialectConfigs = {
        sqlite: {
            jsonExtract: (field) => `json_extract(${field}, '$')`,
            jsonContains: (field, value) => `EXISTS (SELECT 1 FROM json_each(${field}) WHERE json_each.value = ${value ? value : `?${field}`})`,
            jsonNotContains: (field, value) => `NOT EXISTS (SELECT 1 FROM json_each(json_extract(${field}, '$')) WHERE json_each.value = ${value ? value : `?${field}`})`,
            operatorsMap: {
                ...defaultOperatorsMap,
                $regex: "REGEXP"
            }
        }
    };

    const { jsonExtract, jsonContains, jsonNotContains, operatorsMap } = dialectConfigs[config.dialect];

    function parseCondition(field, condition, table) {
        const path = field;

        if (condition === null || condition === undefined) {
            sqlConditions.push(`${table}.${field} IS NULL`);
        } else if (typeof condition === 'object' && !Array.isArray(condition)) {
            for (const [operator, value] of Object.entries(condition)) {
                if (operatorsMap[operator]) {
                    switch (operator) {
                        case '$in':
                            if (Array.isArray(value)) {
                                const inConditions = value.map(v => jsonContains(field, v)).join(' OR ');
                                sqlConditions.push(`(${inConditions})`);
                            } else {
                                sqlConditions.push(`${path} ${operatorsMap[operator]} (${value.map(v => `'${v}'`).join(", ")})`);
                            }
                            break;
                        case '$nin':
                            if (Array.isArray(value)) {
                                const ninConditions = value.map(v => jsonNotContains(field, v)).join(' AND ');
                                sqlConditions.push(`(${ninConditions})`);
                            } else {
                                sqlConditions.push(`${path} ${operatorsMap[operator]} (${value.map(v => `'${v}'`).join(", ")})`);
                            }
                            break;
                        case '$exists':
                            sqlConditions.push(`${path} IS ${value ? 'NOT NULL' : 'NULL'}`);
                            break;
                        case '$mod':
                            sqlConditions.push(`${path} % ${value[0]} = ${value[1]}`);
                            break;
                        case '$regex':
                            sqlConditions.push(`${path} ${operatorsMap[operator]} '${value}'`);
                            break;
                        case '$size':
                            sqlConditions.push(`${operatorsMap.$size}(${path}) = ${value}`);
                            break;
                        case '$all': {
                            const allConditions = value.map(v => jsonContains(field, v)).join(' AND ');
                            sqlConditions.push(allConditions);
                            break;
                        }
                        default:
                            sqlConditions.push(`${table}.${path} ${operatorsMap[operator]} ${value}`);
                    }
                } else {
                    const jsonPath = `json_type(${field}, '$') = 'array'`;
                    sqlConditions.push(`json_extract(${table}.${path}, CASE WHEN ${jsonPath} THEN '${operator}' ELSE '$.${operator}' END) = ?${path}_dot_${(operator.replaceAll('.', '_dot_').replaceAll('[', '_openbracket_',).replaceAll(']', '_closebracket_'))}`);
                }
            }
        } else {
            sqlConditions.push(`${table}.${field} = ?${(path)}`);
        }
    }

    function parseQuery(query, table) {
        for (const [field, condition] of Object.entries(query)) {
            if (field === '$and' || field === '$or' || field === '$nor') {
                const subConditions = condition.map(subQuery => {
                    const subConditionList = [];
                    const subQueryConditions = toSqlQuery(subQuery, config);
                    subConditionList.push(subQueryConditions);
                    return subConditionList.join(` ${operatorsMap[field]} `);
                });
                sqlConditions.push(`(${subConditions.join(` ${operatorsMap[field]} `)})`);
            } else {
                parseCondition(field, condition, table);
            }
        }
    }

    parseQuery(query, config.table);

    return sqlConditions.join(' AND ');
}
// Example usage:
// const mongoQuery = {
//     age: { $gte: 21 },
//     friends: { $nin: ["Gary", "Marcus"] }, // This condition is for array elements check
//     $or: [
//         { name: "John" },
//         { name: { $ne: "Doe" } }
//     ]
// };

// const sqlQuery = translateMongoToSQL(mongoQuery);
// console.log(sqlQuery);  // Outputs: "age >= '21' AND (NOT EXISTS (SELECT 1 FROM json_each(json_extract(data, '$.friends')) WHERE json_each.value = 'Gary') AND NOT EXISTS (SELECT 1 FROM json_each(json_extract(data, '$.friends')) WHERE json_each.value = 'Marcus')) AND (name = 'John' OR name != 'Doe')"

function toSqlWrite(operation, data, config = { dialect: 'sqlite' }) {
    const dialectConfigs = {
        sqlite: {
            jsonSet: (field, value) => {
                const isNested = typeof value === 'object';
                const setSql = `${field} = json_set(COALESCE(${field},'{}'), ${isNested
                    ? Object.keys(value).map((key) => {
                        const isObject = typeof value[key] === 'object';
                        const sql = `'${key.startsWith('$[') ? key : `$.${key}`}', ${isObject ? `json` : ''}(?${field}_dot_${key.replaceAll('.', '_dot_').replaceAll('[', '_openbracket_').replaceAll(']', '_closebracket_')})`
                        return sql;
                    }).join(', ')
                    : `'$', json(?${field})`
                    })`;
                return setSql;
            },
            jsonInsert: (field) => `${field} = json(?${field})`,
            jsonRemove: (field) => `json_remove(${field}, '$')`,
            arrayInsert: (field) => {
                return `${field} = json_set(COALESCE(${field}, '[]'), '$[#]',json(?${(field)}))`;
            }
        }
    };

    const { jsonSet, jsonInsert, jsonRemove, arrayInsert } = dialectConfigs[config.dialect];

    let sqlQuery = '';

    switch (operation) {
        case 'insert': {
            const columns = [];
            const values = [];
            Object.entries(data).forEach(([key, value]) => {
                if (typeof value === 'undefined') return
                columns.push(key);
                values.push(`?${key}`);
            })
            sqlQuery = `(${columns.join(', ')}) VALUES (${values.join(', ')})`;
            break;
        }

        case 'update': {
            const updateConditions = Object.entries(data).map(([field, value]) => {
                if (typeof value === 'undefined' || value === null) return;
                if (Array.isArray(value)) {
                    return `${jsonInsert(field)}`;
                } else if (typeof value === 'object') {
                    if (value.$set) {
                        return `${jsonSet(field)}`;
                    } else if (value.$insert) {
                        return `${jsonInsert(field)}`;
                    } else if (value.$remove) {
                        return `${jsonRemove(field)}`;
                    } else if (value.$push) {
                        return `${arrayInsert(field)}`;
                    } else {
                        return `${jsonSet(field, value)}`;
                    }
                }
        
                return `${field} = ?${field}`;
            }).filter(Boolean).join(', ');
        
            sqlQuery = `SET ${updateConditions}`;
            break;
        }        

        default:
            throw new Error('Unsupported operation');
    }

    return sqlQuery;
}

const stringify = (value) => {
    if (typeof value === 'string') {
        return `'${value}'`;
    } else if (typeof value === 'object') {
        return `'${JSON.stringify(value)}'`;
    } else {
        return value;
    }

}

// Example usage
// const insertData = {
//     id: 1,
//     data: {
//         name: "John",
//         age: 30,
//         friends: ["Gary", "Marcus"]
//     }
// };

// const updateData = {
//     "data.age": { $set: 31 },
//     "data.address": { $insert: { city: "New York", zip: "10001" } },
//     "data.friends": { $push: "Alice" },
//     "data.name": { $remove: true }
// };

// const configInsert = { dialect: 'sqlite', table: 'users' };
// const configUpdate = { dialect: 'sqlite', table: 'users', where: "id = 1" };

// const insertQuery = translateMongoToSQLWrite('insert', insertData, configInsert);
// const updateQuery = translateMongoToSQLWrite('update', updateData, configUpdate);

// console.log(insertQuery);  // Outputs SQL insert query based on specified dialect
// console.log(updateQuery);  // Outputs SQL update query based on specified dialect


export {
    toSqlQuery,
    toSqlWrite
}
