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
const edgeSet = new Set<string>();

function safeAddNode(node: any) {
  if (!nodeSet.has(node.id)) {
    nodeSet.add(node.id);
    graph.nodes.push(node);
  }
}

function safeAddEdge(edge: any) {
  if (!edgeSet.has(edge.id)) {
    edgeSet.add(edge.id);
    graph.edges.push(edge);
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

const deliveries = readJSONL(
  path.join(
    SAP_EXPORT_ROOT,
    "outbound_delivery_headers",
    "part-20251119-133431-414.jsonl"
  )
);

const sortedInvoices = [...invoices].sort(
  (a, b) =>
    new Date(a.creationDate).getTime() -
    new Date(b.creationDate).getTime()
);

const sortedDeliveries = [...deliveries].sort(
  (a, b) =>
    new Date(a.creationDate).getTime() -
    new Date(b.creationDate).getTime()
);

sortedInvoices.forEach((inv) => {
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

sortedDeliveries.forEach((d) => {
  if (!d.deliveryDocument) return;

  safeAddNode({
    id: `delivery-${d.deliveryDocument}`,
    type: "delivery",
    label: `Delivery ${d.deliveryDocument}`,
    metadata: d,
  });
});

sortedInvoices.forEach((inv) => {
  if (inv.accountingDocument) {
    safeAddEdge({
      id: `invoice-${inv.billingDocument}-payment-${inv.accountingDocument}`,
      source: `invoice-${inv.billingDocument}`,
      target: `payment-${inv.accountingDocument}`,
      type: "PAID_BY",
    });
  }
});

sortedInvoices.forEach((inv) => {
  if (inv.soldToParty) {
    safeAddEdge({
      id: `invoice-${inv.billingDocument}-customer-${inv.soldToParty}`,
      source: `invoice-${inv.billingDocument}`,
      target: `customer-${inv.soldToParty}`,
      type: "BELONGS_TO",
    });
  }
});

const minLen = Math.min(
  sortedDeliveries.length,
  sortedInvoices.length
);

for (let i = 0; i < minLen; i++) {
  const delivery = sortedDeliveries[i];
  const invoice = sortedInvoices[i];

  if (delivery?.deliveryDocument && invoice?.billingDocument) {
    safeAddEdge({
      id: `delivery-${delivery.deliveryDocument}-invoice-${invoice.billingDocument}`,
      source: `delivery-${delivery.deliveryDocument}`,
      target: `invoice-${invoice.billingDocument}`,
      type: "BILLED_BY",
      metadata: {
        method: "time-based",
        confidence: "medium",
      },
    });
  }
}

console.log("Invoices loaded:", invoices.length);
console.log("Payments loaded:", payments.length);
console.log("Customers loaded:", customers.length);
console.log("Deliveries loaded:", deliveries.length);
console.log("Final Nodes:", graph.nodes.length);
console.log("Final Edges:", graph.edges.length);

console.log("Sample Invoice:", invoices[0]);
console.log("Sample Delivery:", deliveries[0]);
console.log("Sample Edge:", graph.edges[0]);

fs.writeFileSync(
  path.join(repoRoot, "data", "graph.json"),
  JSON.stringify(graph, null, 2)
);

console.log("Graph created successfully!");