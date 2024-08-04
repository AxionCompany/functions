import { z } from "https://deno.land/x/zod/mod.ts";
import { ObjectId } from "npm:mongodb@6.7.0";

const customTypes = {
  "objectId": () =>
    z.any().transform((value) => {
      if (Array.isArray(value)) {
        // Transform each element of the array into ObjectId
        return value.map(item => {
          if (item instanceof ObjectId) return item;
          return new ObjectId(String(item));
        });
      } else {
        // Transform single value into ObjectId
        if (value instanceof ObjectId) return value;
        return new ObjectId(String(value));
      }
    }),
  "blob": () =>
    z.any().transform((value) => {
      return value instanceof Blob ? value : new Blob(new TextEncoder().encode(value));
    }),
};

const defaultOptions = {
  query: false,
  optional: true,
  clean: true,
};

const validateParams = (type, value, options) => {
  let isOptional = true;
  const valueKey = options?.valueKey;
  const schemaKey = options?.schemaKey;
  if (options?.shouldIgnore) {
    if (options?.shouldIgnore({ schemaKey, schema: type, valueKey, value })) return value;
  }
  options = { ...defaultOptions, ...options };

  if (options.query && value) value = expandAndMergeDotNotation(value);
  options.path = (options.model ? `${options.model}` : "") +
    (options.path ? options.path : "");
  delete options.model;
  if (typeof type === "string") {
    // defining required params
    if (type?.endsWith("!")) {
      isOptional = false;
      type = type.slice(0, -1);
    };
    let foreignField;
    if (type?.includes("->")) {
      type = type.split("->");
      type = type[0];
      foreignField = type[1];
    }
    let validateValue;

    validateValue = (z[type] || customTypes[type] || z["undefined"])();

    if (isOptional) {
      validateValue = validateValue.optional().nullable();
    }

    try {
      const parsedValue = validateValue.parse(value);
      return parsedValue;
    } catch (err) {
      if (foreignField) {
        return z.any().parse(value);
      }
      throw `Error in schema validation: ${JSON.stringify({
        ...err?.issues?.[0],
        path: options.path,
        value,
      })
      }`;
    }
  } else {
    if (type) {
      let newFieldType = {};
      if (Array.isArray(type)) {
        if (value && !Array.isArray(value)) {
          throw `Error in schema validation: ${JSON.stringify({
            path: options.path,
            message: `Expected an array.`,
            value,
          })}`;
        }
        value?.forEach((_, index) => type[index] = type[0]);
      }
      Object.keys(type)?.forEach((key) => {
        newFieldType[key] = validateParams(type?.[key], value?.[key], {
          valueKey: key,
          ...options,
          path: [options?.path, key].join("."),
          query: false,
        });
      });

      if (Array.isArray(type)) {
        newFieldType = Object.values(newFieldType);
      }

      let res = newFieldType;

      if (options.clean) res = cleanObject(newFieldType);
      if (options.query) res = getDotNotationObject(newFieldType);

      return res;
    }
  }
};

// Function to check if a value is a special object
function isSpecialObject(value) {
  // Check for instances of special classes (e.g., Date, ObjectId)
  return value instanceof Date || value instanceof ObjectId;
}

// Function to check if a value is empty
function isEmpty(value) {
  if (value === null) {
    return true;
  };
  if (Array.isArray(value)) {
    return value.every((item) => item === undefined || isEmpty(item));
  } else {
    return (
      Object.keys(value).length === 0 && value.constructor === Object
    );
  }
}

// Function to clean an object by removing undefined and empty values
function cleanObject(obj) {
  if (Array.isArray(obj)) {
    // Clean each element in the array
    const cleanedArray = obj
      .map((item) => {
        if (
          typeof item === "object" && item !== null && !isSpecialObject(item)
        ) {
          return cleanObject(item);
        } else {
          return item;
        }
      })
      .filter((item) => item !== undefined && !isEmpty(item)); // Remove undefined and empty items

    return cleanedArray.length > 0 ? cleanedArray : undefined;
  } else if (typeof obj === "object" && obj !== null && !isSpecialObject(obj)) {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (value === undefined || isEmpty(value)) {
        delete obj[key]; // Remove undefined and empty objects
      } else if (typeof value === "object" && value !== null) {
        obj[key] = cleanObject(value); // Recurse into non-null objects
        if (obj[key] === undefined || isEmpty(obj[key])) {
          delete obj[key]; // Cleanup resulted in an empty object, remove it
        }
      }
    });

    return Object.keys(obj).length > 0 ? obj : undefined;
  } else {
    return obj; // Return non-object and non-array values unchanged
  }
}

// Function to expand and merge dot notation keys in an object
export function expandAndMergeDotNotation(obj) {
  // Function to deeply merge two objects
  const mergeDeep = (target, source) => {
    Object.keys(source).forEach((key) => {
      if (source[key] && typeof source[key] === "object") {
        if (!target[key]) target[key] = {};
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
  };

  // Function to expand a single dot notation key
  const expandKey = (key, value) => {
    const parts = key.split(".");
    let current = {};
    let temp = current;
    for (let i = 0; i < parts.length - 1; i++) {
      temp = temp[parts[i]] = {};
    }
    temp[parts[parts.length - 1]] = value;
    return current;
  };

  Object.keys(obj).forEach((key) => {
    if (key.includes(".")) {
      const value = obj[key];
      const expanded = expandKey(key, value);
      mergeDeep(obj, expanded);
      delete obj[key]; // Remove the original dot notation key
    }
  });

  return obj;
}

// Function to convert an object to dot notation
export function getDotNotationObject(obj, parentPath = "") {
  const result = {};

  // Helper function to check if a value is an object that should be traversed
  const isObject = (val) =>
    typeof val === "object" &&
    val !== null &&
    // !(val instanceof Array) &&  ==> arrays treated as dot notation object
    !(val instanceof Date) &&
    !(val instanceof ObjectId);

  const traverse = (currentObject, currentPath) => {
    if (isObject(currentObject)) {
      // If the current object is a traversable object, recurse into its properties
      Object.keys(currentObject).forEach((key) => {
        traverse(
          currentObject[key],
          `${currentPath}${currentPath ? "." : ""}${key}`,
        );
      });
    } else if (Array.isArray(currentObject)) {
      // If the current object is an array, recurse into its elements
      currentObject.forEach((item, index) => {
        traverse(item, `${currentPath}[${index}]`);
      });
    } else {
      // If the current object is a leaf node, add it to the result
      result[currentPath] = currentObject;
    }
  };

  traverse(obj, parentPath);
  return result;
}

export default validateParams;
