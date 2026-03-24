import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const DB_PATH = path.join(repoRoot, "data", "o2c.sqlite");
const SAP_EXPORT_ROOT = path.join(repoRoot, "data", "sap-o2c-data");

const db = new Database(DB_PATH);

function readJSONL(filePath: string) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");

    return lines
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line));
}

const invoices = readJSONL(
    path.join(
        SAP_EXPORT_ROOT,
        "billing_document_headers",
        "part-20251119-133433-228.jsonl",
    ),
);
