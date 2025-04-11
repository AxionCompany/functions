/**
 * User Detail API Endpoint
 * 
 * This endpoint demonstrates dynamic routing with path parameters.
 * The [id] in the filename becomes a path parameter that can be accessed
 * in the handler function.
 */

// Mock database of users (same as in index.ts)
const users = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com", role: "admin" },
  { id: "2", name: "Bob Smith", email: "bob@example.com", role: "user" },
  { id: "3", name: "Charlie Brown", email: "charlie@example.com", role: "user" },
  { id: "4", name: "Diana Prince", email: "diana@example.com", role: "moderator" },
  { id: "5", name: "Ethan Hunt", email: "ethan@example.com", role: "user" }
];

/**
 * GET handler for retrieving a specific user by ID
 */
export function get(context: any) {
  const { params, query } = context;
  const userId = params.id || query.id;
  
  // Find the user with the specified ID
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return new Response(
      JSON.stringify({ error: "User not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  
  return user;
}

/**
 * PUT handler for updating a user
 */
export async function put(context: any) {
  const { params } = context;
  const userId = params.id;
  
  // Find the user with the specified ID
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return new Response(
      JSON.stringify({ error: "User not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  
  try {
    const body = await context.request.json();
    
    // Update user data
    const updatedUser = {
      ...users[userIndex],
      name: body.name || users[userIndex].name,
      email: body.email || users[userIndex].email,
      role: body.role || users[userIndex].role
    };
    
    // In a real app, we would update the database
    users[userIndex] = updatedUser;
    
    return {
      message: "User updated successfully",
      user: updatedUser
    };
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * DELETE handler for removing a user
 */
export function del(context: any) {
  const { params } = context;
  const userId = params.id;
  
  // Find the user with the specified ID
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return new Response(
      JSON.stringify({ error: "User not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  
  // In a real app, we would delete from the database
  const deletedUser = users[userIndex];
  users.splice(userIndex, 1);
  
  return {
    message: "User deleted successfully",
    user: deletedUser
  };
} 