import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../data/o2c.sqlite");

let _db: Database.Database | null = null;

export function getDB() {
    if(!_db) {
        _db = new Database(DB_PATH);
        _db.pragma("journal_mode = WAL");
        _db.pragma('foreign_keys = ON');
    }
    return _db;
}

export function query<T = Record<string , unknown>>(
    sql: string,
    params: unknown[] = []
): T[] {
    if(!sql.trim().toUpperCase().startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed');
    }
    return getDB().prepare(sql).all(...params) as T[];
}

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

process.on('exit', closeDB);
process.on('SIGINT', () => {
    closeDB();
    process.exit(0);
});
process.on('SIGTERM',() => {
    closeDB();
    process.exit(0);
});
