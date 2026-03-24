import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, 'data');
const localDbPath = join(dbDir, 'feedback.db');

// Ensure local data directory exists for local development
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Use Turso cloud DB if URL is provided, otherwise fall back to local SQLite file
const dbUrl = process.env.TURSO_DATABASE_URL || `file:${localDbPath}`;
const dbToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url: dbUrl,
  authToken: dbToken,
});

// Initialize database schema
async function initDb() {
  try {
    await client.batch([
      // Sessions Table
      "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, question TEXT NOT NULL, question_type TEXT DEFAULT 'open_ended', options TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
      // Answers Table
      "CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, text TEXT NOT NULL, student_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (session_id) REFERENCES sessions (id))",
      // History Log Table
      "CREATE TABLE IF NOT EXISTS history_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, markdown_synthesis TEXT NOT NULL, answer_count INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (session_id) REFERENCES sessions (id))"
    ], "write");

    // Migrations (ignore errors if columns already exist)
    try { await client.execute("ALTER TABLE sessions ADD COLUMN question_type TEXT DEFAULT 'open_ended'"); } catch (e) { }
    try { await client.execute("ALTER TABLE sessions ADD COLUMN options TEXT"); } catch (e) { }

    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Initial call
initDb();

export async function runQuery(sql, params = []) {
  try {
    const result = await client.execute({ sql, args: params });
    return { id: Number(result.lastInsertRowid), changes: result.rowsAffected };
  } catch (error) {
    console.error('Error running sql ' + sql, error);
    throw error;
  }
}

export async function getQuery(sql, params = []) {
  try {
    const result = await client.execute({ sql, args: params });
    // Normalize result to match old sqlite3 format (array of objects)
    return result.rows.map(row => {
      const obj = {};
      result.columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  } catch (error) {
    console.error('Error running sql ' + sql, error);
    throw error;
  }
}

export default client;
