// import { Database } from "jsr:@db/sqlite@0.11";

// // Open a database
// const db = new Database("test.db");

// db.exec("pragma journal_mode = WAL");
// db.exec("pragma synchronous = normal");
// db.exec("pragma temp_store = memory");

// // Create a table
// db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)");

// // Insert a row
// db.exec("INSERT INTO users (name) VALUES (?)", ["Alice"]);
'use strict';

function callerFunction() {
    console.log("Caller function is called");
    calledFunction("arg1", "arg2");
}

function calledFunction() {
    console.log("Called function is called");

    // Get the stack trace
    const stack = new Error().stack;
    // console.log("Stack trace:", stack);

    // Extract the caller function information using a regular expression
    const stackLines = stack.split('\n');
    const callerInfo = stackLines[2]; // The caller is on the third line of the stack trace

    const regex = /at (\S+) \((.*):(\d+):(\d+)\)/;
    const match = callerInfo.match(regex);

    if (match) {
        const callerFunctionName = match[1];
        const callerFilePath = match[2];
        const callerLineNumber = match[3];
        const callerColumnNumber = match[4];

        console.log("Caller function name:", callerFunctionName);
        console.log("Caller function path:", callerFilePath);
        console.log("Caller function line number:", callerLineNumber);
        console.log("Caller function column number:", callerColumnNumber);
    } else {
        console.log("Could not parse caller information");
    }

    // Get the arguments of this function
    console.log("Arguments of called function:", ...arguments);
}

callerFunction();



