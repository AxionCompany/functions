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
    let isOptional = true;

    const valueKey = options?.valueKey;
    const schemaKey = options?.schemaKey;
    const shouldIgnore = options?.shouldIgnore;

    if (shouldIgnore && shouldIgnore({ schemaKey, schema: type, valueKey, value })) {
        return value;
    }

    if (options.query && value) value = expandAndMergeDotNotation(value, { useBrackets: options.dotNotationWithBrackets });

    options.path = (options.model ? `${options.model}` : "") + (options.path || "");
    delete options.model;

    if (typeof type === "string") {
        if (type.includes("!")) {
            isOptional = false;
            type = type.replace("!", "");
        }
        if (type.includes("?")) {
            isOptional = true;
            type = type.replace("?", "");
        }
        if (type.includes("^")) {
            // is unique. only remove the symbol
            type = type.replace("^", "");
        }

        let validateValue = z[type] || customTypes(type, options);

        if (!validateValue) {
            throw new Error(`Undefined schema type: ${type} at path: ${options.path}`);
        }

        validateValue = validateValue();

        if (isOptional) {
            validateValue = validateValue.optional().nullable();
        }
        try {
            return validateValue.parse(value);
        } catch (err) {
            throw new Error(`Error in schema validation at path "${options.path}". | Received ${stringify(value)} | Expected:${stringify(type)} | ${JSON.stringify({
                ...err?.issues?.[0],
                path: options.path,
                value,
                type,
            })}`);
        }
    } else if (type && typeof type === 'object') {
        if (isOptional && !value) return
        if (typeof value === 'string') {
            throw new Error(
                `Error in schema validation at path "${options.path}". | Received ${stringify(value)} | Expected:${stringify(type)} | ${JSON.stringify({
                    path: options.path,
                    value,
                    type,
                })}`);
        }

        let newFieldType: any = {};
        Object.entries(value).forEach(([k, v], index) => {
            const _isArray = Array.isArray(type);

            const operator: Function | undefined = mongoOperators[k];
            const newType = operator ?
                operator(type)
                : _isArray
                    ? type[0]
                    : type[k];

            const validatedResult = validateParams(newType, v, {
                ...options,
                valueKey: k,
                path: [options.path, k].join(".")
            });
            if (operator && operator(type) && options.removeOperators) {
                newFieldType = validatedResult;
                return
            }
            if (typeof validatedResult === "undefined") return
            newFieldType[k] = validatedResult;
        });
        // transform newFieldType to array if type is array
        if (Array.isArray(value)) newFieldType = Object.values(newFieldType).filter(Boolean);

        return newFieldType;
    }
}

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
