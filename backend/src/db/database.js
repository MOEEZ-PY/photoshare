'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Ensure data directory exists
const dbDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('creator','consumer')),
    display_name  TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media (
    id            TEXT PRIMARY KEY,
    creator_id    TEXT NOT NULL REFERENCES users(id),
    type          TEXT NOT NULL CHECK(type IN ('photo','video')),
    filename      TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type     TEXT NOT NULL,
    file_size     INTEGER NOT NULL,
    title         TEXT NOT NULL,
    caption       TEXT DEFAULT '',
    location      TEXT DEFAULT '',
    people        TEXT DEFAULT '[]',
    deleted_at    INTEGER,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_media_creator ON media(creator_id);
  CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);

  CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    media_id   TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_comments_media ON comments(media_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS ratings (
    id         TEXT PRIMARY KEY,
    media_id   TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value      INTEGER NOT NULL CHECK(value BETWEEN 1 AND 5),
    created_at INTEGER NOT NULL,
    UNIQUE(media_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_ratings_media ON ratings(media_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id),
    type       TEXT NOT NULL CHECK(type IN ('like','comment')),
    actor_id   TEXT NOT NULL REFERENCES users(id),
    media_id   TEXT NOT NULL REFERENCES media(id),
    read_at    INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
`);

// ─── Migrations (safe ALTER TABLE) ───────────────────────────────────────────
const existingCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!existingCols.includes('bio'))      db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''");
if (!existingCols.includes('location')) db.exec("ALTER TABLE users ADD COLUMN location TEXT DEFAULT ''");

// ─── FTS Setup ────────────────────────────────────────────────────────────────
// Recreate FTS5 as a standalone table on every startup so the schema and
// triggers are always correct (fixes the content-table rowid DELETE bug).

db.exec(`
  DROP TABLE IF EXISTS media_fts;
  CREATE VIRTUAL TABLE media_fts USING fts5(
    media_id UNINDEXED, title, caption, location, people
  );
  INSERT INTO media_fts(rowid, media_id, title, caption, location, people)
    SELECT rowid, id, title, caption, location, people
    FROM media WHERE deleted_at IS NULL;
`);

db.exec(`
  DROP TRIGGER IF EXISTS media_fts_insert;
  DROP TRIGGER IF EXISTS media_fts_update;
  DROP TRIGGER IF EXISTS media_fts_delete;

  CREATE TRIGGER media_fts_insert AFTER INSERT ON media BEGIN
    INSERT INTO media_fts(rowid, media_id, title, caption, location, people)
    VALUES (new.rowid, new.id, new.title, new.caption, new.location, new.people);
  END;

  CREATE TRIGGER media_fts_update AFTER UPDATE ON media BEGIN
    DELETE FROM media_fts WHERE rowid = old.rowid;
    INSERT INTO media_fts(rowid, media_id, title, caption, location, people)
    SELECT new.rowid, new.id, new.title, new.caption, new.location, new.people
    WHERE new.deleted_at IS NULL;
  END;

  CREATE TRIGGER media_fts_delete AFTER DELETE ON media BEGIN
    DELETE FROM media_fts WHERE rowid = old.rowid;
  END;
`);

// ─── Seed creators ────────────────────────────────────────────────────────────

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, username, email, password_hash, role, display_name, created_at)
  VALUES (@id, @username, @email, @password_hash, @role, @display_name, @created_at)
`);

const seedCreators = db.transaction(() => {
  for (const creator of config.SEED_CREATORS) {
    const hash = bcrypt.hashSync(creator.password, 12);
    insertUser.run({
      id: uuidv4(),
      username: creator.username,
      email: creator.email,
      password_hash: hash,
      role: 'creator',
      display_name: creator.display_name,
      created_at: Date.now(),
    });
  }
});

seedCreators();

console.log('[db] SQLite ready:', config.DB_PATH);

module.exports = db;
