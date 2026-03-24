import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, 'data');
const dbPath = join(dbDir, 'feedback.db');

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // Sessions Table (represents a class/lecture question)
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        question_type TEXT DEFAULT 'open_ended',
        options TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration for existing databases
    db.run("ALTER TABLE sessions ADD COLUMN question_type TEXT DEFAULT 'open_ended'", (err) => { /* ignore if exists */ });
    db.run("ALTER TABLE sessions ADD COLUMN options TEXT", (err) => { /* ignore if exists */ });

    // Answers Table (stores raw student feedback)
    db.run(`
      CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        student_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      )
    `);

    // History Log Table (stores Gemini analysis over time)
    db.run(`
      CREATE TABLE IF NOT EXISTS history_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        markdown_synthesis TEXT NOT NULL,
        answer_count INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      )
    `);
  });
}

// Helper query functions wrapped in Promises for async/await
export function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('Error running sql ' + sql, err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

export function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error running sql ' + sql, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

export default db;
