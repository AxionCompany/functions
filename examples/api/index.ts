/**
 * API Root Endpoint
 * 
 * This is the main entry point for the API. It returns information about
 * available endpoints and API version.
 */

/**
 * Default handler for all HTTP methods
 */

import('http://localhost:9000/examples/api/users').then(module => {
    console.log(module.get({env: {ENV: 'development'}}));
});
// export default function handler(context: any) {
//     import('http://localhost:9000/api').then(module => {
//         console.log(module);
//     });
//     return {
//         name: "Axion File Loader API",
//         version: "1.0.0",
//         description: "A file-based API router powered by Axion File Loader",
//         endpoints: [
//             {
//                 path: "/api",
//                 description: "API information",
//                 methods: ["GET"]
//             },
//             {
//                 path: "/api/users",
//                 description: "List all users",
//                 methods: ["GET"]
//             },
//             {
//                 path: "/api/users/:id",
//                 description: "Get user by ID",
//                 methods: ["GET"]
//             },
//             {
//                 path: "/api/health",
//                 description: "API health check",
//                 methods: ["GET"]
//             }
//         ],
//         environment: context.env.ENV || "development"
//     };
// } 