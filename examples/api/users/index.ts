/**
 * Users API Endpoint
 * 
 * This endpoint returns a list of users. It demonstrates how the file-based
 * routing system maps directory structures to API endpoints.
 */

// Mock database of users
const users = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com", role: "admin" },
  { id: "2", name: "Bob Smith", email: "bob@example.com", role: "user" },
  { id: "3", name: "Charlie Brown", email: "charlie@example.com", role: "user" },
  { id: "4", name: "Diana Prince", email: "diana@example.com", role: "moderator" },
  { id: "5", name: "Ethan Hunt", email: "ethan@example.com", role: "user" }
];

/**
 * GET handler for listing users
 * 
 * Supports filtering by role using query parameters
 */
export function get(context: any) {
  const { query } = context;
  let filteredUsers = [...users];
  
  // Filter by role if provided
  if (query.role) {
    filteredUsers = filteredUsers.filter(user => user.role === query.role);
  }
  
  // Pagination
  const page = parseInt(query.page || "1");
  const limit = parseInt(query.limit || "10");
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
  
  return {
    total: filteredUsers.length,
    page,
    limit,
    data: paginatedUsers
  };
}

/**
 * POST handler for creating a new user
 */
export async function post(context: any) {
  try {
    const body = await context.request.json();
    
    // Validate required fields
    if (!body.name || !body.email) {
      return new Response(
        JSON.stringify({ error: "Name and email are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Create new user
    const newUser = {
      id: (users.length + 1).toString(),
      name: body.name,
      email: body.email,
      role: body.role || "user"
    };
    
    // In a real app, we would save to a database
    users.push(newUser);
    
    return new Response(
      JSON.stringify({ message: "User created successfully", user: newUser }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
} 