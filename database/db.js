const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./macros.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS macros (
    id INTEGER PRIMARY KEY,
    url TEXT,
    title TEXT,
    active BOOLEAN,
    updated_at TEXT,
    created_at TEXT,
    actions TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    feedback_type TEXT CHECK(feedback_type IN ('positive', 'negative')),
    feedback_presets TEXT,
    written_feedback TEXT,
    text_editor_content TEXT,
    generation_type TEXT CHECK(generation_type IN ('macro', 'ai')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
