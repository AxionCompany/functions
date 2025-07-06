/**
 * Example API function demonstrating the enhanced database system
 * 
 * This function shows how to:
 * - Use type-safe Drizzle ORM queries
 * - Access schema exports  
 * - Handle different HTTP methods
 * - Use the enhanced database features
 */

import { eq, desc } from "npm:drizzle-orm";

// Types for function parameters
interface Response {
  status(code: number): void;
}

interface RequestData {
  [key: string]: any;
}

// GET /api/users - List users with optional filtering
export async function GET(this: any, response?: Response) {
  const { db, schema } = this;
  
  if (!db) {
    response?.status(500);
    return { error: 'Database not configured for this isolate' };
  }

  try {
    const { users } = schema;
    
    // Type-safe query with Drizzle ORM
    const activeUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        active: users.active,
        updated_at: users.updated_at
      })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(desc(users.updated_at))
      .limit(50);

    // Optional: Manual sync to get latest data from remote
    // const syncResult = await db.sync();
    
    return { 
      users: activeUsers,
      count: activeUsers.length
      // sync: { pushed: syncResult.pushed }
    };

  } catch (error) {
    console.error('Error fetching users:', error);
    response?.status(500);
    return { error: 'Failed to fetch users' };
  }
}

// POST /api/users - Create a new user  
export async function POST(this: any, requestData?: RequestData,response?: Response) {
  const { db, schema } = this;
  
  if (!db) {
    response?.status(500);
    return { error: 'Database not configured for this isolate' };
  }

  try {
    const { name, email } = requestData || {};
    
    if (!name || !email) {
      response?.status(400);
      return { error: 'Name and email are required' };
    }

    const { users } = schema;

    // Type-safe insert with Drizzle ORM
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        active: true
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        active: users.active,
        updated_at: users.updated_at
      });

    response?.status(201);
    return { user: newUser };

  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message?.includes('unique')) {
      response?.status(409);
      return { error: 'Email already exists' };
    }

    response?.status(500);
    return { error: 'Failed to create user' };
  }
}

// PUT /api/users/:id - Update a user
export async function PUT(this: any, response?: Response, requestData?: RequestData) {
  
  const { db, schema } = this;
  
  if (!db) {
    response?.status(500);
    return { error: 'Database not configured for this isolate' };
  }

  try {
    const { id, name, email, active } = requestData || {};
    
    if (!id) {
      response?.status(400);
      return { error: 'User ID is required' };
    }

    const { users } = schema;

    // Build update object dynamically
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (active !== undefined) updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      response?.status(400);
      return { error: 'No fields to update' };
    }

    // Type-safe update with Drizzle ORM
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, parseInt(id)))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        active: users.active,
        updated_at: users.updated_at
      });

    if (!updatedUser) {
      response?.status(404);
      return { error: 'User not found' };
    }

    return { user: updatedUser };

  } catch (error) {
    console.error('Error updating user:', error);
    response?.status(500);
    return { error: 'Failed to update user' };
  }
}

// DELETE /api/users/:id - Delete a user (soft delete)
export async function DELETE(this: any, response?: Response, requestData?: RequestData) {
  const { db, schema } = this;
  
  if (!db) {
    response?.status(500);
    return { error: 'Database not configured for this isolate' };
  }

  try {
    const { id } = requestData || {};
    
    if (!id) {
      response?.status(400);
      return { error: 'User ID is required' };
    }

    const { users } = schema;

    // Soft delete by setting active to false
    const [deletedUser] = await db
      .update(users)
      .set({ active: false })
      .where(eq(users.id, parseInt(id)))
      .returning({
        id: users.id,
        name: users.name,
        active: users.active
      });

    if (!deletedUser) {
      response?.status(404);
      return { error: 'User not found' };
    }

    response?.status(204);
    return { message: 'User deleted successfully' };

  } catch (error) {
    console.error('Error deleting user:', error);
    response?.status(500);
    return { error: 'Failed to delete user' };
  }
}

// Default export for backward compatibility
export default GET; 