import { z, ZodType } from "https://deno.land/x/zod/mod.ts";
import { ObjectId } from "npm:mongodb@6.7.0";

type CustomTypeGenerator = () => ZodType<any, any>;

const customTypes = function (type: string, options: ValidationOptions = {}): CustomTypeGenerator | undefined {
    const types: Record<string, CustomTypeGenerator> = {
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
    removeOperators?: boolean;
    schemas?: Record<string, any>;
    allowDotNotation?: boolean;
    rejectExtraProperties?: boolean;
    allowOperators?: boolean;
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

type OperatorFunction = (schema: any, value: any, field?: string) => any;
const operators: Record<string, OperatorFunction> = {
    // MongoDB Write Operators
    $set: (schema: any, value: any) => schema,
    $unset: () => null,
    $inc: (schema: any) => schema,
    $mul: (schema: any) => schema,
    $push: (schema: any, value: any, field?: string) => {
        if (!field) return schema;
        if (!Array.isArray(schema[field])) {
            throw new Error(`$push requires an array schema for field "${field}"`);
        }
        return schema[field][0];
    },
    $pop: (schema: any) => schema,
    $pull: (schema: any) => schema,
    $addToSet: (schema: any, value: any, field?: string) => {
        if (!field) return schema;
        if (!Array.isArray(schema[field])) {
            throw new Error(`$addToSet requires an array schema for field "${field}"`);
        }
        return schema[field][0];
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
        return schema;
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

// Create a type for Zod methods
type ZodPrimitiveTypes = 'string' | 'number' | 'boolean' | 'date' | 'bigint' | 'symbol' | 'undefined' | 'null' | 'void' | 'any' | 'unknown' | 'never';

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
        const result = validateParams(type, value, { ...options, schemas });
        return options.useDotNotation ? getDotNotationObject(result) : result;
    }

    const validateParams = (type: any, value: any, options: ValidationOptions = {}): any => {
        options = { ...defaultOptions, ...options };

        const recursiveValidation = (schema: any, val: any, currentPath: string): any => {
            // Handle null/undefined values for required fields first
            if (val === undefined || val === null) {
                if (typeof schema === "string" && schema.includes("!")) {
                    throw new Error(`Field "${currentPath}" is required but missing or null.`);
                }
                return val;
            }

            // Handle string schema types
            if (typeof schema === "string") {
                let localSchema = schema;
                const isRequired = localSchema.includes("!");
                
                if (isRequired) {
                    localSchema = localSchema.replace("!", "");
                }
                
                // Parse modifiers: "!", "?", and "^"
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

                let validateValue: ZodType;

                if (localSchema === 'string') {
                    validateValue = z.string();
                } else if (localSchema === 'number') {
                    validateValue = z.number();
                } else if (localSchema === 'boolean') {
                    validateValue = z.boolean();
                } else if (localSchema === 'date') {
                    validateValue = z.date();
                } else if (localSchema === 'any') {
                    validateValue = z.any();
                } else {
                    const customValidator = customTypes(localSchema, options);
                    if (!customValidator) {
                        throw new Error(`Undefined schema type: ${localSchema} at path: ${currentPath}`);
                    }
                    validateValue = customValidator();
                }

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
                // Handle arrays
                if (Array.isArray(schema)) {
                    if (!Array.isArray(val)) {
                        throw new Error(`Expected array at path "${currentPath}", but got ${typeof val}`);
                    }
                    return val.map((item, idx) => 
                        recursiveValidation(schema[0], item, `${currentPath}[${idx}]`)
                    );
                }

                let validatedResult: any = {};

                // Special handling for logical operators
                const isLogicalOperator = (key: string) => ['$or', '$and', '$nor'].includes(key);
                const hasLogicalOperator = Object.keys(val).some(isLogicalOperator);

                if (hasLogicalOperator) {
                    // Handle logical operators
                    Object.entries(val).forEach(([key, v]) => {
                        if (isLogicalOperator(key)) {
                            if (!Array.isArray(v)) {
                                throw new Error(`${key} requires an array of conditions`);
                            }
                            // Keep all conditions for logical operators
                            validatedResult[key] = v.map((condition: any) => {
                                if (typeof condition !== 'object') {
                                    return condition;
                                }
                                // For nested logical operators
                                if (Object.keys(condition).some(isLogicalOperator)) {
                                    return recursiveValidation(schema, condition, `${currentPath}.${key}`);
                                }
                                // For regular conditions
                                const validatedCondition: any = {};
                                Object.entries(condition).forEach(([fieldKey, fieldValue]) => {
                                    if (schema[fieldKey]) {
                                        try {
                                            const validated = recursiveValidation(
                                                schema[fieldKey],
                                                fieldValue,
                                                `${currentPath}.${key}.${fieldKey}`
                                            );
                                            if (validated !== undefined) {
                                                validatedCondition[fieldKey] = validated;
                                            }
                                        } catch (error) {
                                            // Ignore validation errors for logical operators
                                        }
                                    } else {
                                        // Keep invalid fields in logical operators
                                        validatedCondition[fieldKey] = fieldValue;
                                    }
                                });
                                return validatedCondition;
                            });
                        } else if (schema[key]) {
                            // Handle non-operator fields
                            try {
                                const result = recursiveValidation(schema[key], v, `${currentPath}.${key}`);
                                if (result !== undefined) {
                                    validatedResult[key] = result;
                                }
                            } catch (error) {
                                // Ignore validation errors for regular fields in logical operator context
                            }
                        }
                    });
                } else {
                    // Handle regular fields and non-logical operators
                    Object.entries(val).forEach(([key, v]) => {
                        if (key in operators && !isLogicalOperator(key)) {
                            // Handle MongoDB operators
                            validatedResult[key] = v;
                        } else if (!key.includes('.')) {
                            // Handle regular fields
                            if (schema[key]) {
                                try {
                                    const result = recursiveValidation(schema[key], v, `${currentPath}.${key}`);
                                    if (result !== undefined) {
                                        validatedResult[key] = result;
                                    }
                                } catch (error) {
                                    if (error.message.includes('required')) {
                                        throw error;
                                    }
                                }
                            } else if (options.rejectExtraProperties) {
                                throw new Error(`Extra property "${key}" is not allowed at path: ${currentPath}`);
                            }
                        }
                    });
                }

                return validatedResult;
            }

            return val;
        };

        return recursiveValidation(type, value, options.path || "");
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
function getDotNotationObject(obj: Record<string, any>, parentPath: string = ""): Record<string, any> {
    const result: Record<string, any> = {};

    const isObject = (val: any) => 
        typeof val === "object" && 
        val !== null && 
        !(val instanceof Date) && 
        !(val instanceof ObjectId) &&
        !Array.isArray(val);

    const traverse = (currentObject: any, currentPath: string) => {
        if (isObject(currentObject)) {
            for (const key in currentObject) {
                const newPath = currentPath ? `${currentPath}.${key}` : key;
                traverse(currentObject[key], newPath);
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
