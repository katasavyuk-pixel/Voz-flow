/**
 * Local SQLite database for transcription history.
 * Ported from SFlow's database.py — enhanced with dual text (original + refined)
 * and full-text search via FTS5.
 */
const path = require("path");
const { app } = require("electron");

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  Database = null;
}

class TranscriptionDB {
  constructor(dbPath) {
    this._dbPath = dbPath || path.join(app.getPath("userData"), "transcriptions.db");
    this._db = null;
  }

  _ensureDb() {
    if (this._db) return this._db;
    if (!Database) {
      console.warn("[TranscriptionDB] better-sqlite3 not available — history disabled");
      return null;
    }

    this._db = new Database(this._dbPath);
    this._db.pragma("journal_mode = WAL");
    this._db.pragma("foreign_keys = ON");

    this._db.exec(`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_text TEXT NOT NULL,
        refined_text TEXT NOT NULL,
        language TEXT,
        duration_seconds REAL,
        model TEXT DEFAULT 'whisper-large-v3',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_created_at ON transcriptions(created_at);
    `);

    // FTS5 for full-text search
    try {
      this._db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS transcriptions_fts USING fts5(
          original_text, refined_text,
          content=transcriptions, content_rowid=id
        );
      `);

      // Triggers to keep FTS in sync
      this._db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_ai AFTER INSERT ON transcriptions BEGIN
          INSERT INTO transcriptions_fts(rowid, original_text, refined_text)
          VALUES (new.id, new.original_text, new.refined_text);
        END;
      `);
      this._db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_ad AFTER DELETE ON transcriptions BEGIN
          INSERT INTO transcriptions_fts(transcriptions_fts, rowid, original_text, refined_text)
          VALUES ('delete', old.id, old.original_text, old.refined_text);
        END;
      `);
    } catch (err) {
      console.warn("[TranscriptionDB] FTS5 setup failed (search will use LIKE):", err.message);
    }

    return this._db;
  }

  insert({ originalText, refinedText, language, durationSeconds, model }) {
    const db = this._ensureDb();
    if (!db) return null;

    const stmt = db.prepare(`
      INSERT INTO transcriptions (original_text, refined_text, language, duration_seconds, model)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      originalText || "",
      refinedText || "",
      language || null,
      durationSeconds || null,
      model || "whisper-large-v3",
    );
    return result.lastInsertRowid;
  }

  getRecent(limit = 50) {
    const db = this._ensureDb();
    if (!db) return [];

    return db
      .prepare("SELECT * FROM transcriptions ORDER BY created_at DESC LIMIT ?")
      .all(limit);
  }

  search(query, limit = 50) {
    const db = this._ensureDb();
    if (!db) return [];

    // Try FTS5 first, fallback to LIKE
    try {
      return db
        .prepare(
          `SELECT t.* FROM transcriptions_fts fts
           JOIN transcriptions t ON t.id = fts.rowid
           WHERE transcriptions_fts MATCH ?
           ORDER BY rank LIMIT ?`,
        )
        .all(query, limit);
    } catch {
      const pattern = `%${query}%`;
      return db
        .prepare(
          `SELECT * FROM transcriptions
           WHERE original_text LIKE ? OR refined_text LIKE ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(pattern, pattern, limit);
    }
  }

  count() {
    const db = this._ensureDb();
    if (!db) return 0;
    return db.prepare("SELECT COUNT(*) as cnt FROM transcriptions").get().cnt;
  }

  deleteById(id) {
    const db = this._ensureDb();
    if (!db) return false;
    const result = db.prepare("DELETE FROM transcriptions WHERE id = ?").run(id);
    return result.changes > 0;
  }

  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
}

module.exports = { TranscriptionDB };
