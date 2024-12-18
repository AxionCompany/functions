import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import validateParams from '../functions/modules/connectors/validator.ts';
import { ObjectId } from "npm:mongodb@6.7.0";

const schema = {
    "_id": "objectId",
    "name": "string",
    "description": "string",
    "type": "string",
    "extId": "string",
    "isPublished": "boolean",
    "status": "string",
    "context": "any",
    "account": "objectId->credentials",
    "integration": "objectId->integrations",
    "workspace": "objectId->workspaces"
};

const options = {
    query: true,
    path: "find_input",
    allowOperators: true,
    schemas: {
        credentials: { /* schema */ },
        integrations: { /* schema */ },
        workspaces: { /* schema */ }
    }
};

Deno.test("should handle $or operator with valid and invalid fields", () => {
    const value = {
        "$or": [
            { workspace: new ObjectId("6744e025f5b4e6895e25d889") },
            { visibility: "public" }
        ]
    };

    const result = validateParams(schema, value, options);

    assertEquals(result, {
        "$or": [
            { workspace: new ObjectId("6744e025f5b4e6895e25d889") }
        ]
    });
});

Deno.test("should handle $or operator with all valid fields", () => {
    const value = {
        "$or": [
            { workspace: new ObjectId("6744e025f5b4e6895e25d889") },
            { name: "test" }
        ]
    };

    const result = validateParams(schema, value, options);
    assertEquals(result, {
        "$or": [
            { workspace: new ObjectId("6744e025f5b4e6895e25d889") },
            { name: "test" }
        ]
    });
});

Deno.test("should handle $or operator with all invalid fields", () => {
    const value = {
        "$or": [
            { invalid1: "value1" },
            { invalid2: "value2" }
        ]
    };

    const result = validateParams(schema, value, options);
    assertEquals(result, {});
});

Deno.test("should handle nested $or operators", () => {
    const value = {
        "$or": [
            {
                "$or": [
                    { workspace: new ObjectId("6744e025f5b4e6895e25d889") },
                    { visibility: "public" }
                ]
            },
            { name: "test" }
        ]
    };

    const result = validateParams(schema, value, options);
    assertEquals(result, {
        "$or": [
            {
                "$or": [
                    { workspace: new ObjectId("6744e025f5b4e6895e25d889") }
                ]
            },
            { name: "test" }
        ]
    });
});

Deno.test("should handle mixed operators and fields", () => {
    const value = {
        "$or": [
            { workspace: new ObjectId("6744e025f5b4e6895e25d889") },
            { visibility: "public" }
        ],
        name: "test",
        "$in": { status: ["active", "pending"] }
    };

    const result = validateParams(schema, value, options);
    assertEquals(result, {
        "$or": [
            { workspace: new ObjectId("6744e025f5b4e6895e25d889") }
        ],
        name: "test",
        "$in": { status: ["active", "pending"] }
    });
});

Deno.test("should handle empty operator results", () => {
    const value = {
        "$or": [
            { invalidField1: "value1" },
            { invalidField2: "value2" }
        ],
        name: "test"
    };

    const result = validateParams(schema, value, options);
    assertEquals(result, {
        name: "test"
    });
});

Deno.test("should handle multiple logical operators", () => {
    const value = {
        "$and": [
            { name: "test" },
            {
                "$or": [
                    { workspace: new ObjectId("6744e025f5b4e6895e25d889") },
                    { status: "active" }
                ]
            }
        ]
    };

    const result = validateParams(schema, value, options);
    assertEquals(result, {
        "$and": [
            { name: "test" },
            {
                "$or": [
                    { workspace: new ObjectId("6744e025f5b4e6895e25d889") },
                    { status: "active" }
                ]
            }
        ]
    });
});

// Dot Notation Tests
Deno.test("should handle dot notation in field names", () => {
    const value = {
        "user.name": "John",
        "user.address.city": "New York",
    };
    
    const nestedSchema = {
        user: {
            name: "string",
            address: {
                city: "string"
            }
        }
    };

    const result = validateParams(nestedSchema, value, { 
        ...options, 
        allowDotNotation: true 
    });
    
    assertEquals(result, {
        "user.name": "John",
        "user.address.city": "New York"
    });
});

// Required Fields Tests
Deno.test("should validate required fields", () => {
    const schemaWithRequired = {
        name: "string!",
        email: "string!",
        age: "number"
    };

    const value = {
        name: "John",
        age: 30
    };

    try {
        validateParams(schemaWithRequired, value, options);
        throw new Error("Should have failed due to missing required field");
    } catch (error) {
        assertEquals(
            error.message.includes("Field"),
            true,
            "Should throw error for missing required field"
        );
    }
});

// Array Validation Tests
Deno.test("should validate array fields", () => {
    const arraySchema = {
        tags: ["string"],
        users: [{
            id: "objectId",
            name: "string"
        }]
    };

    const value = {
        tags: ["tag1", "tag2"],
        users: [
            { id: new ObjectId("6744e025f5b4e6895e25d889"), name: "John" },
            { id: new ObjectId("6744e025f5b4e6895e25d88a"), name: "Jane" }
        ]
    };

    const result = validateParams(arraySchema, value, options);
    assertEquals(result, value);
});

// MongoDB Operators Tests
Deno.test("should handle MongoDB update operators", () => {
    const value = {
        "$set": { name: "John", status: "active" },
        "$inc": { count: 1 },
        "$push": { tags: "new-tag" }
    };

    const updateSchema = {
        name: "string",
        status: "string",
        count: "number",
        tags: ["string"]
    };

    const result = validateParams(updateSchema, value, { 
        ...options, 
        allowOperators: true 
    });

    assertEquals(result, {
        "$set": { name: "John", status: "active" },
        "$inc": { count: 1 },
        "$push": { tags: "new-tag" }
    });
});

// Custom Type Tests
Deno.test("should handle custom type transformations", () => {
    const value = {
        file: "Hello World",
        id: "6744e025f5b4e6895e25d889"
    };

    const customSchema = {
        file: "blob",
        id: "objectId"
    };

    const result = validateParams(customSchema, value, options);
    assertEquals(result.id instanceof ObjectId, true);
    assertEquals(result.file instanceof Blob, true);
});

// Relationship Type Tests
Deno.test("should handle relationship type validations", () => {
    const value = {
        user: new ObjectId("6744e025f5b4e6895e25d889"),
        organization: new ObjectId("6744e025f5b4e6895e25d88a")
    };

    const relationSchema = {
        user: "objectId->users",
        organization: "objectId->organizations"
    };

    const relationOptions = {
        ...options,
        schemas: {
            users: { _id: "objectId", name: "string" },
            organizations: { _id: "objectId", name: "string" }
        }
    };

    const result = validateParams(relationSchema, value, relationOptions);
    assertEquals(result, value);
});

// Extra Properties Tests
Deno.test("should handle extra properties based on options", () => {
    const value = {
        name: "John",
        extra: "field"
    };

    // Should include extra field when rejectExtraProperties is false
    let result = validateParams(schema, value, { 
        ...options, 
        rejectExtraProperties: false 
    });
    assertEquals(result, { name: "John" });

    // Should throw error when rejectExtraProperties is true
    try {
        validateParams(schema, value, { 
            ...options, 
            rejectExtraProperties: true 
        });
        throw new Error("Should have failed due to extra property");
    } catch (error) {
        assertEquals(
            error.message.includes("Extra property"),
            true,
            "Should throw error for extra property"
        );
    }
});

// Dot Notation Output Tests
Deno.test("should handle dot notation output transformation", () => {
    const nestedValue = {
        user: {
            name: "John",
            address: {
                city: "New York"
            }
        }
    };

    const nestedSchema = {
        user: {
            name: "string",
            address: {
                city: "string"
            }
        }
    };

    const result = validateParams(nestedSchema, nestedValue, { 
        ...options, 
        useDotNotation: true 
    });

    assertEquals(result, {
        "user.name": "John",
        "user.address.city": "New York"
    });
});

// Optional Fields Tests
Deno.test("should handle optional fields correctly", () => {
    const optionalSchema = {
        name: "string!",
        email: "string?",
        age: "number?"
    };

    const value = {
        name: "John",
        age: null
    };

    const result = validateParams(optionalSchema, value, options);
    assertEquals(result, {
        name: "John",
        age: null
    });
}); 