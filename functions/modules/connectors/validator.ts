import { z, ZodType } from "https://deno.land/x/zod/mod.ts";
import { ObjectId } from "npm:mongodb@6.7.0";

type CustomTypeGenerator = () => ZodType<any, any>;

const customTypes = function (type: string, options: ValidationOptions = {}): CustomTypeGenerator | undefined {
    const types: Record<string, CustomTypeGenerator> = {
        "objectId": () =>
            z.any().transform((value) => {
                if (Array.isArray(value)) {
                    return value.map(item => item instanceof ObjectId ? item : new ObjectId(String(item)));
                } else {
                    return value instanceof ObjectId ? value : new ObjectId(String(value));
                }
            }),
        "blob": () =>
            z.any().transform((value) => {
                return value instanceof Blob ? value : new Blob([new TextEncoder().encode(String(value))]);
            }),
        "(.*)->(.*)": () => {
            return z.any().transform((value) => {
                const [localType, relationType] = type.split('->');
                let result
                try {
                    result = validateParams(localType, value, options)
                } catch (_) {
                    if (options?.schemas?.[relationType]) {
                        result = validateParams(options?.schemas[relationType], value, options)
                    } else {
                        throw new Error(`Undefined schema type: ${relationType} at path: ${options?.path}`);
                    }
                }
                return result

            })
        },
    };
    for (const key in types) {
        if (type.match(new RegExp(key))) {
            return types[key];
        }
    };
    return;
}

const defaultOptions = {
    query: true,
    optional: true,
    removeOperators: false,
    useDotNotation: false
};

interface ValidationOptions {
    query?: boolean;
    useDotNotation?: boolean;
    dotNotationWithBrackets?: boolean;
    optional?: boolean;
    shouldIgnore?: (args: { schemaKey: string; schema: any; valueKey: string; value: any }) => boolean;
    valueKey?: string;
    schemaKey?: string;
    model?: string;
    path?: string;
    removeOperators?: boolean,
    schemas?: Record<string, any>
}

const mongoOperators: Record<string, (type: any) => any> = {
    "$set": (type) => type,
    "$insert": (type) => type,
    "$unset": (type) => type,
    "$inc": (type) => type,
    "$push": (type) => Array.isArray(type) ? type[0] : type,
    "$pull": (type) => Array.isArray(type) ? type[0] : type,
    "$addToSet": (type) => Array.isArray(type) ? type[0] : type
};

const operators = {
    // MongoDB Write Operators
    $set: (schema: any, value: any) => schema,
    $unset: () => null,
    $inc: (schema: any) => schema,
    $mul: (schema: any) => schema,
    $push: (schema: any, value: any, field: string) => {
        if (!Array.isArray(schema[field])) {
            throw new Error(`$push requires an array schema for field "${field}"`);
        }
        return schema[field][0]; // Return the schema for the array items
    },
    $pop: (schema: any) => schema,
    $pull: (schema: any) => schema,
    $addToSet: (schema: any, value: any, field: string) => {
        if (!Array.isArray(schema[field])) {
            throw new Error(`$addToSet requires an array schema for field "${field}"`);
        }
        return schema[field][0]; // Return schema for array items
    },
    $rename: (schema: any, value: any) => schema,
    $min: (schema: any) => schema,
    $max: (schema: any) => schema,

    // MongoDB Read Operators
    $eq: (schema: any) => schema,
    $ne: (schema: any) => schema,
    $gt: (schema: any) => schema,
    $gte: (schema: any) => schema,
    $lt: (schema: any) => schema,
    $lte: (schema: any) => schema,
    $in: (schema: any) => 'any',
    $nin: (schema: any) => 'any',
    $exists: (schema: any) => schema,
    $regex: (schema: any) => schema,

    // MongoDB Logical Operators
    $or: (schema: any, value: any) => {
        if (!Array.isArray(value)) {
            throw new Error(`$or requires an array of conditions`);
        }
        return schema; // Return schema for further validation
    },
    $and: (schema: any, value: any) => {
        if (!Array.isArray(value)) {
            throw new Error(`$and requires an array of conditions`);
        }
        return schema;
    },
    $nor: (schema: any, value: any) => {
        if (!Array.isArray(value)) {
            throw new Error(`$nor requires an array of conditions`);
        }
        return schema;
    },
    $not: (schema: any, value: any) => schema // Handle $not condition
};


/**
 * Validates and transforms data according to the provided schema.
 * @param type - The schema type or structure to validate against.
 * @param value - The data to be validated.
 * @param options - Additional options for validation.
 * @returns The validated and transformed data.
 * @throws Will throw an error if validation fails.
 */

const Validator = (schemas: Record<string, any>) =>
    (type: any, value: any, options: ValidationOptions = {}) => {
        options = { ...defaultOptions, ...options };
        return options.useDotNotation
            ? getDotNotationObject(validateParams(type, value, { ...options, schemas }))
            : validateParams(type, value, { ...options, schemas });
    }

    const validateParams = (type: any, value: any, options: ValidationOptions = {}): any => {

        options = { ...defaultOptions, ...options };
    
        const allowDotNotation = options.allowDotNotation ?? true;
        const rejectExtraProperties = options.rejectExtraProperties ?? false;
        const allowOperators = options.allowOperators ?? true;
        const removeOperators = options.removeOperators ?? false;
    
        options.path = (options.model ? `${options.model}` : "") + (options.path || "");
        delete options.model;
    
        const recursiveValidation = (schema: any, val: any, currentPath: string): any => {
            let isRequired = false;
    
            if (typeof schema === "string") {
                let localSchema = schema;
    
                // Parse modifiers: "!", "?", and "^"
                if (localSchema.includes("!")) {
                    isRequired = true;
                    localSchema = localSchema.replace("!", "");
                }
                if (localSchema.includes("?")) {
                    localSchema = localSchema.replace("?", "");
                }
                if (localSchema.includes("^")) {
                    // Skip uniqueness enforcement for now, but remove the symbol
                    localSchema = localSchema.replace("^", "");
                }
    
                // Handle 'object' type
                if (localSchema === 'object') {
                    localSchema = 'any';
                }
    
                let validateValue = z.coerce?.[localSchema] || z[localSchema] || customTypes(localSchema, options);
    
                if (!validateValue) {
                    throw new Error(`Undefined schema type: ${localSchema} at path: ${currentPath}`);
                }
    
                validateValue = validateValue();
    
                if (!isRequired) {
                    validateValue = validateValue.optional().nullable();
                }
    
                // If the field is required and missing or undefined, throw an error
                if (isRequired && (val === undefined || val === null)) {
                    throw new Error(`Field "${currentPath}" is required but missing or null.`);
                }
    
                try {
                    const parsedValue = validateValue.parse(val);
                    return parsedValue;
                } catch (err) {
                    throw new Error(
                        `Error in schema validation at path "${currentPath}". | Received ${stringify(val)} | Expected:${stringify(localSchema)} | ${JSON.stringify({
                            ...err?.issues?.[0],
                            path: currentPath,
                            value: val,
                            type: localSchema,
                        })}`
                    );
                }
            }
    
            // Handle arrays and objects
            else if (schema && typeof schema === 'object') {
                if (!isRequired && !val) return;
    
                let validatedResult: any = Array.isArray(schema) ? [] : {};
    
                // Check for null or undefined values before calling Object.entries
                if (val === null || val === undefined) {
                    throw new Error(`Invalid value at path "${currentPath}": expected an object, but received ${val}.`);
                }
    
                if (Array.isArray(schema)) {
                    const arraySchema = schema[0];
    
                    if (Array.isArray(val)) {
                        return val.map((item, idx) => recursiveValidation(arraySchema, item, `${currentPath}[${idx}]`));
                    } else if (typeof val === 'object') {
                        // Handle object notation like $[n]
                        Object.entries(val).forEach(([key, v]) => {
                            const match = key.match(/^\$\[(\d+)\]$/); // Match $[n] array notation
    
                            if (match) {
                                const index = parseInt(match[1], 10);
                                const result = recursiveValidation(arraySchema, v, `${currentPath}[$${index}]`);
                                if (typeof result !== "undefined") {
                                    validatedResult[key] = result;
                                }
                            } else {
                                throw new Error(`Expected array at "${currentPath}", but got non-array key: ${key}`);
                            }
                        });
                        return validatedResult;
                    } else {
                        // If val is a scalar, wrap it in an array for validation
                        return [recursiveValidation(arraySchema, val, currentPath)];
                    }
                }
    
                // Process each key in the value
                Object.entries(val).forEach(([originalKey, v]) => {
                    let key = originalKey;
    
                    // Handle operators in keys if allowed
                    let pathParts = key.includes(".") ? (allowDotNotation ? key.split(".") : [key]) : [key];
                    let currentSchema = schema;
                    let reconstructedKeyParts: string[] = [];
                    let newCurrentPath = currentPath;
    
                    for (let i = 0; i < pathParts.length; i++) {
                        let part = pathParts[i];
    
                        // If removeOperators is true, remove operators from key
                        if (removeOperators && allowOperators && operators.hasOwnProperty(part)) {
                            // Skip adding operator to reconstructed key parts
                            const operatorCallback = operators[part];
    
                            // Adjust the schema based on the operator
                            currentSchema = operatorCallback(currentSchema, v, reconstructedKeyParts.join('.'));
                            continue;
                        } else if (allowOperators && operators.hasOwnProperty(part)) {
                            // Operator found in key path
                            const operatorCallback = operators[part];
    
                            // Adjust the schema based on the operator
                            currentSchema = operatorCallback(currentSchema, v, reconstructedKeyParts.join('.'));
    
                            // Include operator in reconstructed key if not removing operators
                            reconstructedKeyParts.push(part);
                        } else {
                            reconstructedKeyParts.push(part);
    
                            if (currentSchema && typeof currentSchema === 'object') {
                                if (Array.isArray(currentSchema)) {
                                    currentSchema = currentSchema[0];
                                } else {
                                    currentSchema = currentSchema[part];
                                }
                                newCurrentPath = i === 0 ? `${currentPath}.${part}` : `${newCurrentPath}.${part}`;
                            } else {
                                throw new Error(`Invalid schema at path "${newCurrentPath}": no schema for key "${part}"`);
                            }
                        }
                    }
    
                    const reconstructedKey = reconstructedKeyParts.join('.');
    
                    // Check for extra properties
                    const topKey = reconstructedKeyParts[0];
                    if (!schema.hasOwnProperty(topKey)) {
                        if (rejectExtraProperties) {
                            throw new Error(`Extra property "${reconstructedKey}" is not allowed at path: ${currentPath}`);
                        }
                        return;
                    }
    
                    // Now validate v against currentSchema
                    const result = recursiveValidation(currentSchema, v, newCurrentPath);
    
                    if (typeof result !== "undefined") {
                        validatedResult[reconstructedKey] = result;
                    }
                });
    
                return validatedResult;
            }
    
            throw new Error(`Unsupported schema type at path: ${currentPath}`);
        };
    
        return recursiveValidation(type, value, options.path);
    };


const stringify = (value: any) => {
    if (typeof value === 'object') {
        return JSON.stringify(value);
    } else {
        return value;
    }
}


/**
 * Expands and merges dot notation keys into nested objects.
 * @param obj - The object with dot notation keys.
 * @returns The expanded object.
 */
function expandAndMergeDotNotation(obj: Record<string, any>, { useBrackets = false } = {}) {
    const mergeDeep = (target: Record<string, any>, source: Record<string, any>) => {
        for (const key in source) {
            if (source[key] && typeof source[key] === "object") {
                if (!target[key]) target[key] = {};
                mergeDeep(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    };

    const expandKey = (key: string, value: any, useBrackets: boolean = false) => {
        const parts = useBrackets ? key.split(/[\[\]]+/).filter(Boolean) : key.split(".");
        let current: Record<string, any> = {};
        let temp = current;
        for (let i = 0; i < parts.length - 1; i++) {
            temp = temp[parts[i]] = {};
        }
        temp[parts[parts.length - 1]] = value;
        return current;
    };

    for (const key in obj) {
        if (key.includes(".") || (useBrackets && key.includes("["))) {
            const value = obj[key];
            const expanded = expandKey(key, value, useBrackets);
            mergeDeep(obj, expanded);
            delete obj[key];
        }
    }


    return obj;
}

/**
 * Converts an object with nested keys into dot notation keys.
 * @param obj - The object to convert.
 * @param parentPath - The parent path for nested keys.
 * @returns The object with dot notation keys.
 */
function getDotNotationObject(obj: Record<string, any>, parentPath: string = "") {
    const result: Record<string, any> = {};

    const isObject = (val: any) => typeof val === "object" && val !== null && !(val instanceof Date) && !(val instanceof ObjectId);

    const traverse = (currentObject: any, currentPath: string) => {
        if (Array.isArray(currentObject)) {
            currentObject.forEach((item, index) => traverse(item, `${currentPath}[${index}]`));
        } else if (isObject(currentObject)) {
            for (const key in currentObject) {
                traverse(currentObject[key], `${currentPath}${currentPath ? "." : ""}${key}`);
            }
        } else {
            result[currentPath] = currentObject;
        }
    };

    traverse(obj, parentPath);
    return result;
}

export default validateParams;
export { expandAndMergeDotNotation, getDotNotationObject, Validator };
