/**
 * SQLite access layer.
 *
 * The ingest script fills `data/o2c.sqlite`. This module opens one shared connection
 * (lazy singleton) and exposes small helpers so the rest of the app never touches
 * better-sqlite3 directly.
 *
 * Security note: `query` / `queryOne` only allow SELECT so chat-generated SQL
 * cannot mutate or drop data even if the model misbehaves.
 */

import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../data/o2c.sqlite");

// Single connection reused across requests — opening a DB per request would be slow.
let _db: Database.Database | null = null;

/** Open the DB on first use; return the same instance afterward. */
export function getDB() {
    if(!_db) {
        _db = new Database(DB_PATH);
        _db.pragma("journal_mode = WAL");
        _db.pragma('foreign_keys = ON');
    }
    return _db;
}

/** Run a SELECT; returns an array of rows (possibly empty). */
export function query<T = Record<string , unknown>>(
    sql: string,
    params: unknown[] = []
): T[] {
    if(!sql.trim().toUpperCase().startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed');
    }
    return getDB().prepare(sql).all(...params) as T[];
}

/** Run a SELECT; returns one row or undefined (e.g. COUNT(*), lookup by id). */
export function queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
): T | undefined {
    if (!sql.trim().toUpperCase().startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed');
    }
    return getDB().prepare(sql).get(...params) as T | undefined;
}

export function closeDB() {
    if(_db) {
        _db.close();
        _db = null;
    }
}

// Clean shutdown so WAL files flush nicely when the process stops.
process.on('exit', closeDB);
process.on('SIGINT', () => {
    closeDB();
    process.exit(0);
});
process.on('SIGTERM',() => {
    closeDB();
    process.exit(0);
})