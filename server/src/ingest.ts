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

const graph = {
    "nodes": [] as any[],
    "edges": [] as any[]
}

invoices.forEach((inv) => {
    if (!inv.billingDocument) return;

    graph.nodes.push({
        id: `invoice-${inv.billingDocument}`,
        type: "invoice",
        label: `Invoice ${inv.billingDocument}`,
        metadata:inv
    });
});

console.log("Invoices loaded:", invoices.length);
console.log("Nodes created:", graph.nodes.length);
console.log(invoices[0]);

fs.writeFileSync(
    path.join(repoRoot, "data", "graph.json"),
    JSON.stringify(graph, null, 2)
)