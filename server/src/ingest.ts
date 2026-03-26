/**
 * One-off / batch data pipeline (run via package script, not on every HTTP request).
 *
 * Reads SAP O2C JSONL under data/sap-o2c-data/, writes normalized rows into
 * data/o2c.sqlite and a derived graph to data/graph.json for the UI + API.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import type {
  RawInvoice, RawPayment, RawCustomer, RawDelivery,
  RawSalesOrder, RawSalesOrderItem, RawProduct, RawBillingDocumentItem,
  Graph, GraphNode, GraphEdge, NodeType,
} from './types.ts';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '../..');
const DATA_DIR   = path.join(REPO_ROOT, 'data');
const SAP_ROOT   = path.join(DATA_DIR, 'sap-o2c-data');
const DB_PATH    = path.join(DATA_DIR, 'o2c.sqlite');
const GRAPH_OUT  = path.join(DATA_DIR, 'graph.json');

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
        // skip malformed lines
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
    DROP TABLE IF EXISTS billing_document_items;
    DROP TABLE IF EXISTS sales_order_items;
    DROP TABLE IF EXISTS invoice_items;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS invoices;
    DROP TABLE IF EXISTS deliveries;
    DROP TABLE IF EXISTS sales_orders;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS customers;

    CREATE TABLE customers (
      id                   TEXT PRIMARY KEY,
      sales_organization   TEXT,
      distribution_channel TEXT,
      division             TEXT,
      raw_json             TEXT
    );

    CREATE TABLE products (
      id             TEXT PRIMARY KEY,
      product_type   TEXT,
      product_old_id TEXT,
      product_group  TEXT,
      base_unit      TEXT,
      division       TEXT,
      gross_weight   REAL,
      weight_unit    TEXT,
      raw_json       TEXT
    );

    CREATE TABLE sales_orders (
      id                      TEXT PRIMARY KEY,
      sales_order_type        TEXT,
      sales_organization      TEXT,
      sold_to_party           TEXT REFERENCES customers(id),
      creation_date           TEXT,
      total_net_amount        REAL,
      overall_delivery_status TEXT,
      transaction_currency    TEXT,
      raw_json                TEXT
    );

    CREATE TABLE sales_order_items (
      id           TEXT PRIMARY KEY,
      sales_order  TEXT REFERENCES sales_orders(id),
      item_number  TEXT,
      material     TEXT REFERENCES products(id),
      quantity     REAL,
      quantity_unit TEXT,
      net_amount   REAL,
      currency     TEXT,
      plant        TEXT,
      raw_json     TEXT
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
      id                    TEXT PRIMARY KEY,
      billing_document_type TEXT,
      creation_date         TEXT,
      billing_document_date TEXT,
      is_cancelled          INTEGER DEFAULT 0,
      total_net_amount      REAL,
      transaction_currency  TEXT,
      company_code          TEXT,
      fiscal_year           TEXT,
      accounting_document   TEXT,
      sold_to_party         TEXT REFERENCES customers(id),
      raw_json              TEXT
    );

    CREATE TABLE billing_document_items (
      id                 TEXT PRIMARY KEY,
      billing_document   TEXT REFERENCES invoices(id),
      item_number        TEXT,
      material           TEXT REFERENCES products(id),
      quantity           REAL,
      net_amount         REAL,
      currency           TEXT,
      reference_delivery TEXT REFERENCES deliveries(id),
      raw_json           TEXT
    );

    CREATE TABLE payments (
      id                       TEXT PRIMARY KEY,
      company_code             TEXT,
      fiscal_year              TEXT,
      gl_account               TEXT,
      reference_document       TEXT,
      cost_center              TEXT,
      profit_center            TEXT,
      transaction_currency     TEXT,
      amount                   REAL,
      posting_date             TEXT,
      document_date            TEXT,
      accounting_document_type TEXT,
      raw_json                 TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_sold_to       ON invoices(sold_to_party);
    CREATE INDEX IF NOT EXISTS idx_invoices_acc_doc       ON invoices(accounting_document);
    CREATE INDEX IF NOT EXISTS idx_invoices_cancelled     ON invoices(is_cancelled);
    CREATE INDEX IF NOT EXISTS idx_sales_orders_sold_to   ON sales_orders(sold_to_party);
    CREATE INDEX IF NOT EXISTS idx_so_items_order         ON sales_order_items(sales_order);
    CREATE INDEX IF NOT EXISTS idx_so_items_material      ON sales_order_items(material);
    CREATE INDEX IF NOT EXISTS idx_bdi_billing_doc        ON billing_document_items(billing_document);
    CREATE INDEX IF NOT EXISTS idx_bdi_material           ON billing_document_items(material);
    CREATE INDEX IF NOT EXISTS idx_bdi_ref_delivery       ON billing_document_items(reference_delivery);
  `);
  console.log('  Schema created.');
}

function loadCustomers(db: Database.Database, records: RawCustomer[]): number {
  const stmt = db.prepare(`INSERT OR REPLACE INTO customers VALUES (?,?,?,?,?)`);
  const run = db.transaction((rows: RawCustomer[]) => {
    let n = 0;
    for (const r of rows) {
      const id = toStr(r.customer);
      if (!id) continue;
      stmt.run(id, toStr(r.salesOrganization), toStr(r.distributionChannel), toStr(r.division), JSON.stringify(r));
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadProducts(db: Database.Database, records: RawProduct[]): number {
  const stmt = db.prepare(`INSERT OR REPLACE INTO products VALUES (?,?,?,?,?,?,?,?,?)`);
  const run = db.transaction((rows: RawProduct[]) => {
    let n = 0;
    for (const r of rows) {
      const id = toStr(r.product);
      if (!id) continue;
      stmt.run(
        id,
        toStr(r.productType),
        toStr(r.productOldId),
        toStr(r.productGroup),
        toStr(r.baseUnit),
        toStr(r.division),
        toFloat(r.grossWeight),
        toStr(r.weightUnit),
        JSON.stringify(r),
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadSalesOrders(db: Database.Database, records: RawSalesOrder[]): number {
  const stmt = db.prepare(`INSERT OR REPLACE INTO sales_orders VALUES (?,?,?,?,?,?,?,?,?)`);
  const run = db.transaction((rows: RawSalesOrder[]) => {
    let n = 0;
    for (const r of rows) {
      const id = toStr(r.salesOrder);
      if (!id) continue;
      stmt.run(
        id,
        toStr(r.salesOrderType),
        toStr(r.salesOrganization),
        toStr(r.soldToParty),
        toDate(r.creationDate),
        toFloat(r.totalNetAmount),
        toStr(r.overallDeliveryStatus),
        toStr(r.transactionCurrency),
        JSON.stringify(r),
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadSalesOrderItems(db: Database.Database, records: RawSalesOrderItem[]): number {
  const stmt = db.prepare(`INSERT OR REPLACE INTO sales_order_items VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const run = db.transaction((rows: RawSalesOrderItem[]) => {
    let n = 0;
    for (const r of rows) {
      if (!r.salesOrder || !r.salesOrderItem) continue;
      const id = `${r.salesOrder}-${r.salesOrderItem}`;
      stmt.run(
        id,
        toStr(r.salesOrder),
        toStr(r.salesOrderItem),
        toStr(r.material),
        toFloat(r.requestedQuantity),
        toStr(r.requestedQuantityUnit),
        toFloat(r.netAmount),
        toStr(r.transactionCurrency),
        toStr(r.productionPlant),
        JSON.stringify(r),
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadDeliveries(db: Database.Database, records: RawDelivery[]): number {
  const stmt = db.prepare(`INSERT OR REPLACE INTO deliveries VALUES (?,?,?,?,?,?,?,?,?)`);
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
        JSON.stringify(r),
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadInvoices(db: Database.Database, records: RawInvoice[]): number {
  const stmt = db.prepare(`INSERT OR REPLACE INTO invoices VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
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
        JSON.stringify(r),
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadBillingDocumentItems(db: Database.Database, records: RawBillingDocumentItem[]): number {
  const stmt = db.prepare(`INSERT OR REPLACE INTO billing_document_items VALUES (?,?,?,?,?,?,?,?,?)`);
  const run = db.transaction((rows: RawBillingDocumentItem[]) => {
    let n = 0;
    for (const r of rows) {
      if (!r.billingDocument || !r.billingDocumentItem) continue;
      const id = `${r.billingDocument}-${r.billingDocumentItem}`;
      stmt.run(
        id,
        toStr(r.billingDocument),
        toStr(r.billingDocumentItem),
        toStr(r.material),
        toFloat(r.billingQuantity),
        toFloat(r.netAmount),
        toStr(r.transactionCurrency),
        toStr(r.referenceSdDocument),
        JSON.stringify(r),
      );
      n++;
    }
    return n;
  });
  return run(records) as number;
}

function loadPayments(db: Database.Database, records: RawPayment[]): number {
  const stmt = db.prepare(`INSERT OR REPLACE INTO payments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
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
        JSON.stringify(r),
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
  deliveries: RawDelivery[],
  salesOrders: RawSalesOrder[],
  products: RawProduct[],
  billingDocItems: RawBillingDocumentItem[],
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

  // Add nodes
  for (const c of customers) {
    if (!c.customer) continue;
    addNode({ id: `customer-${c.customer}`, type: 'customer' as NodeType, label: `Customer ${c.customer}`, metadata: c as unknown as Record<string, unknown> });
  }

  for (const p of products) {
    if (!p.product) continue;
    addNode({ id: `product-${p.product}`, type: 'product' as NodeType, label: p.productOldId ? `${p.productOldId} (${p.product})` : `Product ${p.product}`, metadata: p as unknown as Record<string, unknown> });
  }

  for (const so of salesOrders) {
    if (!so.salesOrder) continue;
    addNode({ id: `sales_order-${so.salesOrder}`, type: 'sales_order' as NodeType, label: `Sales Order ${so.salesOrder}`, metadata: so as unknown as Record<string, unknown> });
  }

  for (const d of deliveries) {
    if (!d.deliveryDocument) continue;
    addNode({ id: `delivery-${d.deliveryDocument}`, type: 'delivery' as NodeType, label: `Delivery ${d.deliveryDocument}`, metadata: d as unknown as Record<string, unknown> });
  }

  for (const inv of invoices) {
    if (!inv.billingDocument) continue;
    addNode({ id: `invoice-${inv.billingDocument}`, type: 'invoice' as NodeType, label: `Invoice ${inv.billingDocument}`, metadata: inv as unknown as Record<string, unknown> });
  }

  for (const pay of payments) {
    if (!pay.accountingDocument) continue;
    addNode({ id: `payment-${pay.accountingDocument}`, type: 'payment' as NodeType, label: `Payment ${pay.accountingDocument}`, metadata: pay as unknown as Record<string, unknown> });
  }

  // Sales order → customer (BELONGS_TO)
  for (const so of salesOrders) {
    if (so.salesOrder && so.soldToParty) {
      addEdge({ id: `so-${so.salesOrder}-cust-${so.soldToParty}`, source: `sales_order-${so.salesOrder}`, target: `customer-${so.soldToParty}`, type: 'BELONGS_TO' });
    }
  }

  // Invoice → customer (BELONGS_TO)
  for (const inv of invoices) {
    if (inv.billingDocument && inv.soldToParty) {
      addEdge({ id: `inv-${inv.billingDocument}-cust-${inv.soldToParty}`, source: `invoice-${inv.billingDocument}`, target: `customer-${inv.soldToParty}`, type: 'BELONGS_TO' });
    }
  }

  // Invoice → payment (PAID_BY) — via accounting_document FK
  for (const inv of invoices) {
    if (inv.billingDocument && inv.accountingDocument) {
      addEdge({ id: `inv-${inv.billingDocument}-pay-${inv.accountingDocument}`, source: `invoice-${inv.billingDocument}`, target: `payment-${inv.accountingDocument}`, type: 'PAID_BY' });
    }
  }

  // Invoice → delivery (BILLED_BY) and Invoice → product (HAS_PRODUCT) — via billing_document_items real FK
  for (const bdi of billingDocItems) {
    if (bdi.billingDocument && bdi.referenceSdDocument) {
      const eid = `inv-${bdi.billingDocument}-del-${bdi.referenceSdDocument}`;
      addEdge({ id: eid, source: `invoice-${bdi.billingDocument}`, target: `delivery-${bdi.referenceSdDocument}`, type: 'BILLED_BY' });
    }
    if (bdi.billingDocument && bdi.material) {
      const eid = `inv-${bdi.billingDocument}-prod-${bdi.material}-item-${bdi.billingDocumentItem}`;
      addEdge({ id: eid, source: `invoice-${bdi.billingDocument}`, target: `product-${bdi.material}`, type: 'HAS_PRODUCT' });
    }
  }

  return { nodes, edges };
}

function main(): void {
  console.log('\n=== SAP O2C Graph Ingestion ===\n');

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log('Reading JSONL files...');
  const invoices       = readJSONLDir(path.join(SAP_ROOT, 'billing_document_headers'))    as RawInvoice[];
  const billingItems   = readJSONLDir(path.join(SAP_ROOT, 'billing_document_items'))      as RawBillingDocumentItem[];
  const payments       = readJSONLDir(path.join(SAP_ROOT, 'payments_accounts_receivable')) as RawPayment[];
  const customers      = readJSONLDir(path.join(SAP_ROOT, 'customer_sales_area_assignments')) as RawCustomer[];
  const deliveries     = readJSONLDir(path.join(SAP_ROOT, 'outbound_delivery_headers'))   as RawDelivery[];
  const salesOrders    = readJSONLDir(path.join(SAP_ROOT, 'sales_order_headers'))         as RawSalesOrder[];
  const salesOrderItems = readJSONLDir(path.join(SAP_ROOT, 'sales_order_items'))          as RawSalesOrderItem[];
  const products       = readJSONLDir(path.join(SAP_ROOT, 'products'))                    as RawProduct[];

  console.log(`  Invoices:           ${invoices.length}`);
  console.log(`  Billing items:      ${billingItems.length}`);
  console.log(`  Payments:           ${payments.length}`);
  console.log(`  Customers:          ${customers.length}`);
  console.log(`  Deliveries:         ${deliveries.length}`);
  console.log(`  Sales orders:       ${salesOrders.length}`);
  console.log(`  Sales order items:  ${salesOrderItems.length}`);
  console.log(`  Products:           ${products.length}`);

  console.log('\nPopulating SQLite...');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  createSchema(db);
  console.log(`  customers:           ${loadCustomers(db, customers)}`);
  console.log(`  products:            ${loadProducts(db, products)}`);
  console.log(`  sales_orders:        ${loadSalesOrders(db, salesOrders)}`);
  console.log(`  sales_order_items:   ${loadSalesOrderItems(db, salesOrderItems)}`);
  console.log(`  deliveries:          ${loadDeliveries(db, deliveries)}`);
  console.log(`  invoices:            ${loadInvoices(db, invoices)}`);
  console.log(`  billing_doc_items:   ${loadBillingDocumentItems(db, billingItems)}`);
  console.log(`  payments:            ${loadPayments(db, payments)}`);
  db.close();

  console.log('\nBuilding graph.json...');
  const graph = buildGraph(invoices, payments, customers, deliveries, salesOrders, products, billingItems);
  console.log(`  Nodes: ${graph.nodes.length}`);
  console.log(`  Edges: ${graph.edges.length}`);

  fs.writeFileSync(GRAPH_OUT, JSON.stringify(graph, null, 2));
  console.log(`  Saved → ${GRAPH_OUT}`);

  console.log('\n✓ Ingestion complete.\n');
}

main();
