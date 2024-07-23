import { Database } from "jsr:@db/sqlite@0.11";

// Open a database
const db = new Database("test.db");

db.exec("pragma journal_mode = WAL");
db.exec("pragma synchronous = normal");
db.exec("pragma temp_store = memory");

// Create a table
db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)");

// Insert a row
db.exec("INSERT INTO users (name) VALUES (?)", ["Alice"]);
