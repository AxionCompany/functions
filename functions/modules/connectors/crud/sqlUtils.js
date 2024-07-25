function toSqlQuery(query, config = { dialect: 'sqlite' }) {

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
            jsonContains: (field, value) => `EXISTS (SELECT 1 FROM json_each(${field}) WHERE json_each.value = ${stringify(value)})`,
            jsonNotContains: (field, value) => `NOT EXISTS (SELECT 1 FROM json_each(json_extract(${field}, '$')) WHERE json_each.value = ${stringify(value)})`,
            operatorsMap: {
                ...defaultOperatorsMap,
                $regex: "REGEXP"
            }
        },
        postgres: {
            jsonExtract: (field) => field.split('.').reduce((acc, part, index) => index === 0 ? `${acc}->'${part}'` : `${acc}->'${part}'`, 'data'),
            jsonContains: (field, value) => `${field.split('.').reduce((acc, part, index) => index === 0 ? `${acc}->'${part}'` : `${acc}->'${part}'`, 'data')} ? '${value}'`,
            jsonNotContains: (field, value) => `NOT (${field.split('.').reduce((acc, part, index) => index === 0 ? `${acc}->'${part}'` : `${acc}->'${part}'`, 'data')} ? '${value}')`,
            operatorsMap: {
                ...defaultOperatorsMap,
                $regex: "~"
            }
        },
        mysql: {
            jsonExtract: (field) => `JSON_EXTRACT(data, '$.${field.replace(/\./g, ".")}')`,
            jsonContains: (field, value) => `JSON_CONTAINS(JSON_EXTRACT(data, '$.${field.replace(/\./g, ".")}'), '"${value}"')`,
            jsonNotContains: (field, value) => `NOT JSON_CONTAINS(JSON_EXTRACT(data, '$.${field.replace(/\./g, ".")}'), '"${value}"')`,
            operatorsMap: {
                ...defaultOperatorsMap,
                $regex: "REGEXP"
            }
        },
        sqlserver: {
            jsonExtract: (field) => `JSON_VALUE(data, '$.${field.replace(/\./g, ".")}')`,
            jsonContains: (field, value) => `JSON_QUERY(data, '$.${field.replace(/\./g, ".")}') LIKE '%" + value + "%'`,
            jsonNotContains: (field, value) => `JSON_QUERY(data, '$.${field.replace(/\./g, ".")}') NOT LIKE '%" + value + "%'`,
            operatorsMap: {
                ...defaultOperatorsMap,
                $regex: "LIKE"
            }
        },
        oracle: {
            jsonExtract: (field) => `JSON_VALUE(data, '$.${field.replace(/\./g, ".")}')`,
            jsonContains: (field, value) => `JSON_EXISTS(data, '$.${field}[*]?(@ == "${value}")')`,
            jsonNotContains: (field, value) => `NOT JSON_EXISTS(data, '$.${field}[*]?(@ == "${value}")')`,
            operatorsMap: {
                ...defaultOperatorsMap,
                $regex: "LIKE"
            }
        }
    };

    const { jsonExtract, jsonContains, jsonNotContains, operatorsMap } = dialectConfigs[config.dialect];

    function parseCondition(field, condition, isNested = false) {
        const path = isNested ? jsonExtract(field) : field;

        if (typeof condition === 'object' && !Array.isArray(condition)) {
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
                            sqlConditions.push(`${path} ${operatorsMap[operator]} ${value}`);
                    }
                }
            }
        } else {
            if (Array.isArray(condition)) {
                sqlConditions.push(jsonContains(field, condition));
            } else {
                sqlConditions.push(`${path} = ${condition}`);
            }
        }
    }

    function parseQuery(query) {
        for (const [field, condition] of Object.entries(query)) {
            const isNested = field.includes('.');
            if (field === '$and' || field === '$or' || field === '$nor') {
                const subConditions = condition.map(subQuery => {
                    const subConditionList = [];
                    const subQueryConditions = toSqlQuery(subQuery, config);
                    subConditionList.push(subQueryConditions);
                    return subConditionList.join(` ${operatorsMap[field]} `);
                });
                sqlConditions.push(`(${subConditions.join(` ${operatorsMap[field]} `)})`);
            } else {
                parseCondition(field, condition, isNested);
            }
        }
    }

    parseQuery(query);

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
            jsonSet: (field, value) => `json_set(COALESCE(${field}, '{}'), '$', json(${stringify(value)}))`,
            jsonInsert: (field, value) => `${field} = json(${stringify(value)})`,
            jsonRemove: (field) => `json_remove(${field}, '$')`,
            arrayInsert: (field, value) => {
                return `${field} = json_set(COALESCE(${field}, '[]'), '$[#]',json('${(value)}'))`;
            }
        },
        postgres: {
            jsonSet: (field, value) => `${field} = jsonb_set(${field}, '{}', '${stringify(value)}', true)`,
            jsonInsert: (field, value) => `${field} = jsonb_set(${field}, '{}', '${stringify(value)}', true)`,
            jsonRemove: (field) => `${field} = ${field} #- '{}'`,
            arrayInsert: (field, value) => `${field} = jsonb_set(${field}, '{}', ${field} || '${stringify([value])}')`
        },
        mysql: {
            jsonSet: (field, value) => `JSON_SET(${field}, '$', '${stringify(value)}')`,
            jsonInsert: (field, value) => `JSON_SET(${field}, '$', JSON_ARRAY_APPEND(JSON_EXTRACT(${field}, '$'), '$', '${value}'))`,
            jsonRemove: (field) => `JSON_REMOVE(${field}, '$')`,
            arrayInsert: (field, value) => `JSON_ARRAY_APPEND(${field}, '$', '${value}')`
        },
        sqlserver: {
            jsonSet: (field, value) => `JSON_MODIFY(${field}, '$', '${stringify(value)}')`,
            jsonInsert: (field, value) => `JSON_MODIFY(${field}, '$', '${stringify(value)}')`,
            jsonRemove: (field) => `JSON_MODIFY(${field}, '$', NULL)`,
            arrayInsert: (field, value) => `JSON_MODIFY(${field}, '$', JSON_QUERY(${field}, '$') + '${stringify([value])}')`
        },
        oracle: {
            jsonSet: (field, value) => `JSON_MERGEPATCH(${field}, '{"${field.replace(/\./g, '":{"')}": ${stringify(value)}}')`,
            jsonInsert: (field, value) => `JSON_MERGEPATCH(${field}, '{"${field.replace(/\./g, '":{"')}": ${stringify(value)}}')`,
            jsonRemove: (field) => `JSON_REMOVE(${field}, '$')`,
            arrayInsert: (field, value) => `JSON_MERGEPATCH(${field}, '{"${field.replace(/\./g, '":{"')}": [${stringify(value)}]}')`
        }
    };

    const { jsonSet, jsonInsert, jsonRemove, arrayInsert } = dialectConfigs[config.dialect];

    let sqlQuery = '';

    switch (operation) {
        case 'insert': {
            const columns = Object.keys(data).join(', ');
            const values = Object.entries(data).map(([key, value]) => {
                if (typeof value === 'object') {
                    return `'${JSON.stringify(value)}'`;
                } else {
                    return `'${value}'`;
                }
            }).join(', ');
            sqlQuery = `(${columns}) VALUES (${values})`;
            console.log(sqlQuery, data)
            break;
        }

        case 'update': {

            const updateConditions = Object.entries(data).map(([field, value]) => {
                if (typeof value === 'object' && !Array.isArray(value)) {
                    if (value.$set) {
                        return `${jsonSet(field, value.$set)}`;
                    } else if (value.$insert) {
                        return `${jsonInsert(field, value.$insert)}`;
                    } else if (value.$remove) {
                        return `${jsonRemove(field)}`;
                    } else if (value.$push) {
                        return `${arrayInsert(field, value.$push)}`;
                    }

                } 
                else if(Array.isArray(value)){
                    return `${jsonInsert(field, value)}`;
                }
                else {
                    return `${field} = '${value}'`;
                }
            }).join(', ');
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
