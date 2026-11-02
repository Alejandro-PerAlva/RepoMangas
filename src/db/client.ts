import * as SQLite from 'expo-sqlite';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  genre TEXT,
  synopsis TEXT
);
CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS work_authors (
  work_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (work_id, author_id, role)
);
CREATE TABLE IF NOT EXISTS editions (
  id INTEGER PRIMARY KEY,
  work_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  publisher_id INTEGER,
  publisher TEXT,
  format TEXT,
  size TEXT,
  reading_dir TEXT,
  status TEXT NOT NULL DEFAULT 'Desconocido',
  total_jp INTEGER,
  total_es INTEGER,
  followed INTEGER NOT NULL DEFAULT 0,
  scraped_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS volumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id INTEGER NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  release_date TEXT,
  price REAL,
  pages INTEGER,
  cover_url TEXT,
  UNIQUE (edition_id, number)
);
CREATE TABLE IF NOT EXISTS user_volume_state (
  volume_id INTEGER PRIMARY KEY,
  owned INTEGER NOT NULL DEFAULT 0,
  wishlisted INTEGER NOT NULL DEFAULT 0,
  read INTEGER NOT NULL DEFAULT 0,
  tag TEXT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  number INTEGER,
  date TEXT NOT NULL,
  publisher TEXT NOT NULL,
  cover_url TEXT,
  UNIQUE (edition_id, title, date)
);
CREATE TABLE IF NOT EXISTS author_editions (
  author_id INTEGER NOT NULL,
  edition_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  cover_url TEXT,
  PRIMARY KEY (author_id, edition_id)
);
CREATE TABLE IF NOT EXISTS publisher_editions (
  publisher_id INTEGER NOT NULL,
  edition_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (publisher_id, edition_id)
);
CREATE TABLE IF NOT EXISTS publishers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS idx_vol_ed ON volumes(edition_id);
CREATE INDEX IF NOT EXISTS idx_rel_date ON releases(date);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('repomangas.db');
      await db.execAsync(SCHEMA);
      const v = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
      if (v < 2) {
        const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(volumes)');
        if (!cols.some((c) => c.name === 'is_pack')) await db.execAsync('ALTER TABLE volumes ADD COLUMN is_pack INTEGER NOT NULL DEFAULT 0');
        // v1 scraped unedited volumes by mistake: drop untouched ones and force re-scrape
        await db.execAsync('DELETE FROM volumes WHERE id NOT IN (SELECT volume_id FROM user_volume_state); UPDATE editions SET scraped_at = 0; PRAGMA user_version = 2;');
      }
      return db;
    })();
  }
  return dbPromise;
}

// --- reactive invalidation ---
let version = 0;
const listeners = new Set<() => void>();
export const dbSubscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const dbVersion = () => version;
export const bump = () => {
  version++;
  listeners.forEach((l) => l());
};
