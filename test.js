const userSchema = {
    _id: "_id",
    name: "string",
    email: "string",
    age: "number",
    posts: ["_id->Post"] // Foreign key referencing Post._id
};

const postSchema = {
    _id: "_id",
    title: "string",
    content: "string",
    user: "_id->User"  // Foreign key referencing User._id
};

const schemas = {
    User: userSchema,
    Post: postSchema
};
const Validator = (schema, data, options) => {
    return data;  // In a real application, this would validate data against the schema
};

import { Database } from "jsr:@db/sqlite@0.11";
const db = new Database(":memory:");  // In-memory database for testing
// const db = new Database("./data/test.db");  // Persistent database for testing
db.exec("pragma journal_mode = WAL");
db.exec("pragma synchronous = normal");
db.exec("pragma temp_store = memory");

import Crud from './functions/modules/connectors/crud/sql.js';  // Assuming the models module is in modelsModule.js

const models = Crud({ config: {}, db, schemas });

// Create Users
const user1 = await models.User.create({ name: "Alice", email: "alice@example.com", age: 30, posts:[] });
console.log("User 1:", user1);
const user2 = await models.User.create({ name: "Bob", email: "bob@example.com", age: 25 });
console.log("User 2:", user2);
const users3and4 = await models.User.createMany([
    { name: "Charlie", email: "charlie@example.com", age: 35 },
    { name: "David", email: "david@example.com", age: 40 }
]);
console.log("Users 3 and 4:", users3and4);

// Create Posts
const post1 = await models.Post.create({ title: "First Post", content: "This is the first post", user: 1 });
console.log("Post 1:", post1);
const post2 = await models.Post.create({ title: "Second Post", content: "This is the second post", user: 2 });
console.log("Post 2:", post2);
const post3 = await models.Post.create({ title: "Third Post", content: "This is the third post", user: 2 });
console.log("Post 3:", post3);

// Update Users with Posts
const updatedUser1 = await models.User.update({ _id: 1 }, { posts:[1]  });
console.log("Updated User 1:", updatedUser1);
const updatedUser2 = await models.User.update({ _id: 2 }, { posts: { $insert: [2] } });
console.log("Updated User 2 - first interaction:", updatedUser2);
const updatedUser21 = await models.User.update({ _id: 2 }, { posts: { $push: [3] } });
console.log("Updated User 2 - second interaction:", updatedUser21);

// Find a User with Post number 1
const userWithPost1 = await models.User.findOne({ "posts": 1 });
console.log('User with Post number 1', userWithPost1)

// Find all Users
const users = await models.User.find({});
console.log("Users:", users);

// Find all Posts
const posts = await models.Post.find({});
console.log("Posts:", posts);

// Find Posts and populate its User
const userWithPosts = await models.Post.find({}, { populate: ["user"] });
console.log("User with Posts:", userWithPosts);

// Update a User
const updatedUser = await models.User.update({ _id: 1 }, { age: 31 });
console.log("Updated User:", updatedUser);

// Delete a Post
await models.Post.delete({ _id: 1 });
const remainingPosts = await models.Post.find({});
console.log("Remaining Posts:", remainingPosts);