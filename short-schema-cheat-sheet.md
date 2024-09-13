
# Short-Schema Cheat Sheet

## Basic Types

- **String**: `"string"`
- **Number**: `"number"`
- **Boolean**: `"boolean"`
- **Date**: `"date"`

## Required & Optional Fields

- **Required**: `!` after type  
  Example: `"string!"` → Required string
- **Optional**: `?` after type  
  Example: `"number?"` → Optional number

## Unique Fields

- **Unique**: `^` after type  
  Example: `"string^"` → Unique string
- **Unique & Required**: `^!`  
  Example: `"string^!"` → Required and unique string

## Nested Objects

- Define objects inside properties:

```js
"property": {
    "subproperty": "string"
}
```

## Arrays

- **Array of Strings**: `["string"]`
- **Array of Numbers**: `["number"]`
- **Array of Objects**: `[ { ... } ]`

Example:
```js
"property": ["string"]  // Array of strings
```

## Schema References

- **Reference another schema**: `"string->schemaName"`  
  Example: `"property": "string->schema2"`

## Example Schema

```js
const schema1 = {
    "_id": "number",                 // ID field (number, string, objectId)
    "property1": "string!",          // Required string
    "property2": "number?",          // Optional number
    "property3": {
        "subproperty1": ["string"],  // Array of strings
        "subproperty2": ["number"],  // Array of numbers
        "subproperty3": [{           // Array of nested objects
            "subProp1": "string",
            "subProp2": "number"
        }]
    },
    "property4": "boolean",          // Boolean type
    "property5": "date",             // Date type
    "property6": "string->schema2"   // Reference to another schema
}

const schema2 = {
    "_id": "string^!",               // Unique, required ID string
    "property1": "string",
    "property2": "number"
}
```

## Quick Rules

- Use `!` for **required** fields.
- Use `?` for **optional** fields.
- Use `^` for **unique** fields.
- Nest objects directly inside properties.
- Arrays are defined by wrapping the type in brackets (`[]`).
- Schema references use `->schemaName`.
