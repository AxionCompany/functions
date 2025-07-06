import { pgTable, serial, text, timestamp, integer, boolean } from "npm:drizzle-orm/pg-core";

/**
 * Example schema definition using Drizzle ORM
 * This file demonstrates the recommended structure for database schemas
 */

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  active: boolean("active").default(true),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Posts table  
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  userId: integer("user_id").references(() => users.id),
  published: boolean("published").default(false),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  postId: integer("post_id").references(() => posts.id),
  userId: integer("user_id").references(() => users.id),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * DDL statements for database initialization
 * These should match your Drizzle schema definitions
 */
export const schemaDDL = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Posts table
  `CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    user_id INTEGER REFERENCES users(id),
    published BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Comments table  
  `CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    post_id INTEGER REFERENCES posts(id),
    user_id INTEGER REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Create sync triggers for all tables
  // `DO $$
  // DECLARE
  //   table_name TEXT;
  // BEGIN
  //   FOR table_name IN 
  //     SELECT tablename FROM pg_tables 
  //     WHERE schemaname = 'public' 
  //     AND tablename NOT LIKE '_%'
  //   LOOP
  //     -- Create trigger for each table
  //     EXECUTE format('
  //       DROP TRIGGER IF EXISTS %I_sync_trigger ON %I;
  //       CREATE TRIGGER %I_sync_trigger
  //         AFTER INSERT OR UPDATE OR DELETE ON %I
  //         FOR EACH ROW EXECUTE FUNCTION outbox_trigger_fn();
  //     ', table_name, table_name, table_name, table_name);
  //   END LOOP;
  // END $$`,
];

/**
 * Type helpers for use in functions
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

/**
 * Common query helpers
 */
export const queries = {
  // Get user with their posts
  getUserWithPosts: `
    SELECT u.*, 
           json_agg(
             json_build_object(
               'id', p.id,
               'title', p.title,
               'content', p.content,
               'published', p.published,
               'updated_at', p.updated_at
             )
           ) FILTER (WHERE p.id IS NOT NULL) as posts
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    WHERE u.id = $1
    GROUP BY u.id
  `,

  // Get post with comments and authors
  getPostWithComments: `
    SELECT p.*,
           u.name as author_name,
           json_agg(
             json_build_object(
               'id', c.id,
               'content', c.content,
               'updated_at', c.updated_at,
               'author', cu.name
             )
           ) FILTER (WHERE c.id IS NOT NULL) as comments
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN comments c ON p.id = c.post_id
    LEFT JOIN users cu ON c.user_id = cu.id
    WHERE p.id = $1
    GROUP BY p.id, u.name
  `,
}; 