import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type {
  RawInvoice, RawPayment, RawCustomer, RawDelivery,
  Graph, GraphNode, GraphEdge, NodeType,
} from './types.ts';


const REPO_ROOT      = path.resolve(__dirname, '../../..');
const DATA_DIR       = path.join(REPO_ROOT, 'data');
const SAP_ROOT       = path.join(DATA_DIR, 'sap-o2c-data');
const DB_PATH        = path.join(DATA_DIR, 'o2c.sqlite');
const GRAPH_OUT      = path.join(DATA_DIR, 'graph.json');

function readJSONLDir(dirPath: string): Record<string, unknown>[] {
  if (!fs.existsSync(dirPath)) {
    console.warn(`  [SKIP] Directory not found: ${dirPath}`);
    return [];
  }
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'));
  if (files.length === 0) {
    console.warn(`  [SKIP] No .jsonl files in: ${dirPath}`);
    return [];
  }
  const records: Record<string, unknown>[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(dirPath, file), 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed));
      } catch {
       
      }
    }
  }
  return records;
}

function toStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

function toFloat(val: unknown): number | null {
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function toDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).trim();
  return s === '' || s === 'null' ? null : s;
}

function createSchema(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS invoice_items;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS invoices;
    DROP TABLE IF EXISTS deliveries;
    DROP TABLE IF EXISTS customers;

    CREATE TABLE customers (
      id                  TEXT PRIMARY KEY,
      sales_organization  TEXT,
      distribution_channel TEXT,
      division            TEXT,
      raw_json            TEXT
    );

    CREATE TABLE deliveries (
      id                          TEXT PRIMARY KEY,
      creation_date               TEXT,
      shipping_point              TEXT,
      goods_movement_status       TEXT,
      picking_status              TEXT,
      actual_goods_movement_date  TEXT,
      header_billing_block        TEXT,
      delivery_block_reason       TEXT,
      raw_json                    TEXT
    );

    CREATE TABLE invoices (
      id                            TEXT PRIMARY KEY,
      billing_document_type         TEXT,
      creation_date                 TEXT,
      billing_document_date         TEXT,
      is_cancelled                  INTEGER DEFAULT 0,
      total_net_amount              REAL,
      transaction_currency          TEXT,
      company_code                  TEXT,
      fiscal_year                   TEXT,
      accounting_document           TEXT,
      sold_to_party                 TEXT REFERENCES customers(id),
      raw_json                      TEXT
    );

    CREATE TABLE payments (
      id                            TEXT PRIMARY KEY,
      company_code                  TEXT,
      fiscal_year                   TEXT,
      gl_account                    TEXT,
      reference_document            TEXT,
      cost_center                   TEXT,
      profit_center                 TEXT,
      transaction_currency          TEXT,
      amount                        REAL,
      posting_date                  TEXT,
      document_date                 TEXT,
      accounting_document_type      TEXT,
      raw_json                      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_sold_to   ON invoices(sold_to_party);
    CREATE INDEX IF NOT EXISTS idx_invoices_acc_doc   ON invoices(accounting_document);
    CREATE INDEX IF NOT EXISTS idx_invoices_cancelled ON invoices(is_cancelled);
  `);
  console.log('  Schema created.');
}

function loadCustomers(db: Database.Database, records: RawCustomer[]): number {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO customers VALUES (?,?,?,?,?)
  `);
  const run = db.transaction((rows: RawCustomer[]) => {
    let n = 0;
    for (const r of rows) {
      const id = toStr(r.customer);
      if (!id) continue;
      stmt.run(
        id,
        toStr(r.salesOrganization),
        toStr(r.distributionChannel),
        toStr(r.division),
        JSON.stringify(r)
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadDeliveries(db: Database.Database, records: RawDelivery[]): number {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO deliveries VALUES (?,?,?,?,?,?,?,?,?)
  `);
  const run = db.transaction((rows: RawDelivery[]) => {
    let n = 0;
    for (const r of rows) {
      const id = toStr(r.deliveryDocument);
      if (!id) continue;
      stmt.run(
        id,
        toDate(r.creationDate),
        toStr(r.shippingPoint),
        toStr(r.overallGoodsMovementStatus),
        toStr(r.overallPickingStatus),
        toDate(r.actualGoodsMovementDate),
        toStr(r.headerBillingBlockReason),
        toStr(r.deliveryBlockReason),
        JSON.stringify(r)
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadInvoices(db: Database.Database, records: RawInvoice[]): number {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO invoices VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const run = db.transaction((rows: RawInvoice[]) => {
    let n = 0;
    for (const r of rows) {
      const id = toStr(r.billingDocument);
      if (!id) continue;
      stmt.run(
        id,
        toStr(r.billingDocumentType),
        toDate(r.creationDate),
        toDate(r.billingDocumentDate),
        r.billingDocumentIsCancelled ? 1 : 0,
        toFloat(r.totalNetAmount),
        toStr(r.transactionCurrency),
        toStr(r.companyCode),
        toStr(r.fiscalYear),
        toStr(r.accountingDocument),
        toStr(r.soldToParty),
        JSON.stringify(r)
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadPayments(db: Database.Database, records: RawPayment[]): number {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO payments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const run = db.transaction((rows: RawPayment[]) => {
    let n = 0;
    for (const r of rows) {
      const id = toStr(r.accountingDocument);
      if (!id) continue;
      stmt.run(
        id,
        toStr(r.companyCode),
        toStr(r.fiscalYear),
        toStr(r.glAccount),
        toStr(r.referenceDocument),
        toStr(r.costCenter),
        toStr(r.profitCenter),
        toStr(r.transactionCurrency),
        toFloat(r.amountInTransactionCurrency),
        toDate(r.postingDate),
        toDate(r.documentDate),
        toStr(r.accountingDocumentType),
        JSON.stringify(r)
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}


function buildGraph(
  invoices: RawInvoice[],
  payments: RawPayment[],
  customers: RawCustomer[],
  deliveries: RawDelivery[]
): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeSet = new Set<string>();
  const edgeSet = new Set<string>();

  function addNode(node: GraphNode): void {
    if (!nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      nodes.push(node);
    }
  }

  function addEdge(edge: GraphEdge): void {
    if (!edgeSet.has(edge.id)) {
      edgeSet.add(edge.id);
      edges.push(edge);
    }
  }

  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime()
  );
  const sortedDeliveries = [...deliveries].sort(
    (a, b) => new Date(a.creationDate ?? 0).getTime() - new Date(b.creationDate ?? 0).getTime()
  );

  sortedInvoices.forEach((inv) => {
    if (!inv.billingDocument) return;
    addNode({
      id:       `invoice-${inv.billingDocument}`,
      type:     'invoice' as NodeType,
      label:    `Invoice ${inv.billingDocument}`,
      metadata: inv as unknown as Record<string, unknown>,
    });
  });

  payments.forEach((p) => {
    if (!p.accountingDocument) return;
    addNode({
      id:       `payment-${p.accountingDocument}`,
      type:     'payment' as NodeType,
      label:    `Payment ${p.accountingDocument}`,
      metadata: p as unknown as Record<string, unknown>,
    });
  });

  customers.forEach((c) => {
    if (!c.customer) return;
    addNode({
      id:       `customer-${c.customer}`,
      type:     'customer' as NodeType,
      label:    `Customer ${c.customer}`,
      metadata: c as unknown as Record<string, unknown>,
    });
  });

  sortedDeliveries.forEach((d) => {
    if (!d.deliveryDocument) return;
    addNode({
      id:       `delivery-${d.deliveryDocument}`,
      type:     'delivery' as NodeType,
      label:    `Delivery ${d.deliveryDocument}`,
      metadata: d as unknown as Record<string, unknown>,
    });
  });

  sortedInvoices.forEach((inv) => {
    if (inv.accountingDocument) {
      addEdge({
        id:     `invoice-${inv.billingDocument}-payment-${inv.accountingDocument}`,
        source: `invoice-${inv.billingDocument}`,
        target: `payment-${inv.accountingDocument}`,
        type:   'PAID_BY',
      });
    }
  });

  sortedInvoices.forEach((inv) => {
    if (inv.soldToParty) {
      addEdge({
        id:     `invoice-${inv.billingDocument}-customer-${inv.soldToParty}`,
        source: `invoice-${inv.billingDocument}`,
        target: `customer-${inv.soldToParty}`,
        type:   'BELONGS_TO',
      });
    }
  });

  const minLen = Math.min(sortedDeliveries.length, sortedInvoices.length);
  for (let i = 0; i < minLen; i++) {
    const delivery = sortedDeliveries[i];
    const invoice  = sortedInvoices[i];
    if (delivery?.deliveryDocument && invoice?.billingDocument) {
      addEdge({
        id:     `delivery-${delivery.deliveryDocument}-invoice-${invoice.billingDocument}`,
        source: `delivery-${delivery.deliveryDocument}`,
        target: `invoice-${invoice.billingDocument}`,
        type:   'BILLED_BY',
        metadata: { method: 'time-based', confidence: 'medium' },
      });
    }
  }

  return { nodes, edges };
}

function main(): void {
  console.log('\n=== SAP O2C Graph Ingestion ===\n');

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const invoices   = readJSONLDir(path.join(SAP_ROOT, 'billing_document_headers'))   as RawInvoice[];
  const payments   = readJSONLDir(path.join(SAP_ROOT, 'payments_accounts_receivable')) as RawPayment[];
  const customers  = readJSONLDir(path.join(SAP_ROOT, 'customer_sales_area_assignments')) as RawCustomer[];
  const deliveries = readJSONLDir(path.join(SAP_ROOT, 'outbound_delivery_headers'))   as RawDelivery[];

  console.log(`Invoices loaded:   ${invoices.length}`);
  console.log(`Payments loaded:   ${payments.length}`);
  console.log(`Customers loaded:  ${customers.length}`);
  console.log(`Deliveries loaded: ${deliveries.length}`);

  console.log('\nPopulating SQLite...');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  createSchema(db);
  const c = loadCustomers(db, customers);   console.log(`  customers:  ${c}`);
  const d = loadDeliveries(db, deliveries); console.log(`  deliveries: ${d}`);
  const inv = loadInvoices(db, invoices);   console.log(`  invoices:   ${inv}`);
  const pay = loadPayments(db, payments);   console.log(`  payments:   ${pay}`);
  db.close();

  console.log('\nBuilding graph.json...');
  const graph = buildGraph(invoices, payments, customers, deliveries);
  console.log(`  Nodes: ${graph.nodes.length}`);
  console.log(`  Edges: ${graph.edges.length}`);

  fs.writeFileSync(GRAPH_OUT, JSON.stringify(graph, null, 2));
  console.log(`  Saved → ${GRAPH_OUT}`);

  console.log('\n✓ Ingestion complete.\n');
}

main();