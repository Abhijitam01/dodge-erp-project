import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const DB_PATH = path.join(repoRoot, "data", "o2c.sqlite");
const SAP_EXPORT_ROOT = path.join(repoRoot, "data", "sap-o2c-data");

const db = new Database(DB_PATH);

const graph = {
  nodes: [] as any[],
  edges: [] as any[],
};

const nodeSet = new Set<string>();

function safeAddNode(node: any) {
  if (!nodeSet.has(node.id)) {
    nodeSet.add(node.id);
    graph.nodes.push(node);
  }
}

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
    "part-20251119-133433-228.jsonl"
  )
);

const payments = readJSONL(
  path.join(
    SAP_EXPORT_ROOT,
    "payments_accounts_receivable",
    "part-20251119-133434-100.jsonl"
  )
);

const customers = readJSONL(
  path.join(
    SAP_EXPORT_ROOT,
    "customer_sales_area_assignments",
    "part-20251119-133437-884.jsonl"
  )
);

invoices.forEach((inv) => {
  if (!inv.billingDocument) return;

  safeAddNode({
    id: `invoice-${inv.billingDocument}`,
    type: "invoice",
    label: `Invoice ${inv.billingDocument}`,
    metadata: inv,
  });
});

payments.forEach((p) => {
  if (!p.accountingDocument) return;

  safeAddNode({
    id: `payment-${p.accountingDocument}`,
    type: "payment",
    label: `Payment ${p.accountingDocument}`,
    metadata: p,
  });
});


customers.forEach((c) => {
  if (!c.customer) return;

  safeAddNode({
    id: `customer-${c.customer}`,
    type: "customer",
    label: `Customer ${c.customer}`,
    metadata: c,
  });
});


invoices.forEach((inv) => {
  if (inv.accountingDocument) {
    graph.edges.push({
      id: `invoice-${inv.billingDocument}-payment-${inv.accountingDocument}`,
      source: `invoice-${inv.billingDocument}`,
      target: `payment-${inv.accountingDocument}`,
      type: "PAID_BY",
    });
  }
});


invoices.forEach((inv) => {
  if (inv.soldToParty) {
    graph.edges.push({
      id: `invoice-${inv.billingDocument}-customer-${inv.soldToParty}`,
      source: `invoice-${inv.billingDocument}`,
      target: `customer-${inv.soldToParty}`,
      type: "BELONGS_TO",
    });
  }
});


console.log("Invoices loaded:", invoices.length);
console.log("Payments loaded:", payments.length);
console.log("Customers loaded:", customers.length);
console.log("Nodes created:", graph.nodes.length);
console.log("Edges created:", graph.edges.length);

fs.writeFileSync(
  path.join(repoRoot, "data", "graph.json"),
  JSON.stringify(graph, null, 2)
);
console.log(invoices[0]);