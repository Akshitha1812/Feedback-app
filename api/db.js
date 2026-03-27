import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// On Vercel, we should use /tmp for any local file operations
const isProduction = process.env.NODE_ENV === 'production';
const dbDir = isProduction ? '/tmp' : join(__dirname, 'data');
const localDbPath = join(dbDir, 'feedback.db');

// Ensure local data directory exists for local development
if (!isProduction && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Use Turso cloud DB if URL is provided, otherwise fall back to local SQLite file
let dbUrl = process.env.TURSO_DATABASE_URL || `file:${localDbPath}`;

// Diagnostic: Check if this is a Turso Dashboard URL (common mistake)
const isDashboardUrl = dbUrl.includes('turso.tech/organizations') || dbUrl.includes('turso.tech/databases');

// Normalize Turso URLs (must use libsql:// protocol for the driver to be happy)
if (dbUrl.startsWith('https://')) {
  dbUrl = dbUrl.replace('https://', 'libsql://');
}

const dbToken = process.env.TURSO_AUTH_TOKEN;

console.log("Initializing database with URL:", dbUrl.startsWith('libsql') ? "Turso Cloud" : "Local File");
if (isDashboardUrl) {
  console.error("CRITICAL: It looks like you pasted the Turso Dashboard URL instead of the Connection URL!");
}

if (!process.env.TURSO_DATABASE_URL && process.env.NODE_ENV === 'production') {
  console.warn("WARNING: TURSO_DATABASE_URL is not set in production. Local SQLite file might not persist on Vercel.");
}

const client = createClient({
  url: dbUrl,
  authToken: dbToken,
});

let dbReadyPromise = null;

// Initialize database schema
async function initDb() {
  try {
    // Basic connectivity check
    await client.execute("SELECT 1");

    // Create tables one by one for maximum compatibility
    await client.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    await client.execute("CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users (id))");
    await client.execute("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, question TEXT NOT NULL, question_type TEXT DEFAULT 'open_ended', options TEXT, course_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (course_id) REFERENCES courses (id))");
    await client.execute("CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, text TEXT NOT NULL, student_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (session_id) REFERENCES sessions (id))");
    await client.execute("CREATE TABLE IF NOT EXISTS history_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, markdown_synthesis TEXT NOT NULL, answer_count INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (session_id) REFERENCES sessions (id))");

    // Migrations (ignore errors if columns already exist)
    try { await client.execute("ALTER TABLE sessions ADD COLUMN question_type TEXT DEFAULT 'open_ended'"); } catch (e) { }
    try { await client.execute("ALTER TABLE sessions ADD COLUMN options TEXT"); } catch (e) { }
    try { await client.execute("ALTER TABLE sessions ADD COLUMN course_id TEXT REFERENCES courses (id)"); } catch (e) { }

    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("CRITICAL: Database initialization failed:", error.message);
    throw error;
  }
}

// Ensure initDb is only called once and we can wait for it
function getDbReady() {
  if (!dbReadyPromise) {
    dbReadyPromise = initDb();
  }
  return dbReadyPromise;
}

export async function runQuery(sql, params = []) {
  try {
    await getDbReady();
    const result = await client.execute({ sql, args: params });
    // Use string conversion for BigInt safety
    const lastId = result.lastInsertRowid ? result.lastInsertRowid.toString() : null;
    return { id: lastId, changes: result.rowsAffected };
  } catch (error) {
    console.error('Database runQuery Error:', error.message, '| SQL:', sql);
    throw error;
  }
}

export async function getQuery(sql, params = []) {
  try {
    await getDbReady();
    console.log(`Executing getQuery: ${sql.substring(0, 50)}...`);
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
    console.error('Database getQuery Error:', error.message, '| SQL:', sql);
    throw error;
  }
}

export default client;
