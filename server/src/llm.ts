/**
 * Groq (LLM) integration — two jobs:
 *
 * 1) naturalLanguageToSQL — turn a question into a safe SELECT (JSON from the model).
 * 2) synthesizeAnswer — turn result rows back into a short natural-language reply.
 *
 * Flow guard: we first check DOMAIN_KEYWORDS so random questions skip the API
 * and return OUT_OF_DOMAIN without spending tokens.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// OpenAI-compatible Chat Completions endpoint hosted by Groq.
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL        = 'llama-3.3-70b-versatile';

// Embedded "cheat sheet" for the model: table names, columns, and join rules.
const DB_SCHEMA = `
You have access to a SQLite database for an SAP Order-to-Cash (O2C) process.

TABLES:

customers (
  id                   TEXT PRIMARY KEY,   -- customer number e.g. '320000083'
  sales_organization   TEXT,
  distribution_channel TEXT,
  division             TEXT,
  raw_json             TEXT
)

sales_orders (
  id                       TEXT PRIMARY KEY,  -- sales order number e.g. '740506'
  sales_order_type         TEXT,              -- 'OR'=standard order
  sales_organization       TEXT,
  sold_to_party            TEXT,              -- links to customers.id
  creation_date            TEXT,
  total_net_amount         REAL,
  overall_delivery_status  TEXT,              -- 'A'=not started 'B'=partial 'C'=complete
  transaction_currency     TEXT,
  raw_json                 TEXT
)

sales_order_items (
  id               TEXT PRIMARY KEY,   -- composite: salesOrder-salesOrderItem
  sales_order      TEXT,               -- links to sales_orders.id
  item_number      TEXT,
  material         TEXT,               -- links to products.id
  quantity         REAL,
  quantity_unit    TEXT,
  net_amount       REAL,
  currency         TEXT,
  plant            TEXT,
  raw_json         TEXT
)

deliveries (
  id                         TEXT PRIMARY KEY,  -- delivery document e.g. '80737721'
  creation_date              TEXT,
  shipping_point             TEXT,
  goods_movement_status      TEXT,              -- 'A'=not started 'B'=partial 'C'=complete
  picking_status             TEXT,
  actual_goods_movement_date TEXT,
  header_billing_block       TEXT,
  delivery_block_reason      TEXT,
  raw_json                   TEXT
)

invoices (
  id                     TEXT PRIMARY KEY,   -- billing document e.g. '90504248'
  billing_document_type  TEXT,               -- 'F2'=standard invoice
  creation_date          TEXT,
  billing_document_date  TEXT,
  is_cancelled           INTEGER,            -- 0 or 1
  total_net_amount       REAL,
  transaction_currency   TEXT,
  company_code           TEXT,
  fiscal_year            TEXT,
  accounting_document    TEXT,               -- links to payments.id
  sold_to_party          TEXT,               -- links to customers.id
  raw_json               TEXT
)

billing_document_items (
  id                    TEXT PRIMARY KEY,   -- composite: billingDocument-billingDocumentItem
  billing_document      TEXT,               -- links to invoices.id
  item_number           TEXT,
  material              TEXT,               -- links to products.id
  quantity              REAL,
  net_amount            REAL,
  currency              TEXT,
  reference_delivery    TEXT,               -- links to deliveries.id (referenceSdDocument)
  raw_json              TEXT
)

payments (
  id                        TEXT PRIMARY KEY,  -- accounting document e.g. '9400000249'
  company_code              TEXT,
  fiscal_year               TEXT,
  gl_account                TEXT,
  reference_document        TEXT,
  cost_center               TEXT,
  profit_center             TEXT,
  transaction_currency      TEXT,
  amount                    REAL,
  posting_date              TEXT,
  document_date             TEXT,
  accounting_document_type  TEXT,
  raw_json                  TEXT
)

products (
  id            TEXT PRIMARY KEY,  -- product number e.g. 'S8907367001003'
  product_type  TEXT,
  product_old_id TEXT,             -- legacy product code
  product_group TEXT,
  base_unit     TEXT,
  division      TEXT,
  gross_weight  REAL,
  weight_unit   TEXT,
  raw_json      TEXT
)

KEY RELATIONSHIPS:
- sales_orders.sold_to_party           = customers.id          (sales order → customer)
- sales_order_items.sales_order        = sales_orders.id       (item → order)
- sales_order_items.material           = products.id           (item → product)
- billing_document_items.billing_document = invoices.id        (item → invoice)
- billing_document_items.material      = products.id           (item → product)
- billing_document_items.reference_delivery = deliveries.id    (item → delivery, the real FK)
- invoices.accounting_document         = payments.id           (invoice → payment)
- invoices.sold_to_party               = customers.id          (invoice → customer)

BUSINESS FLOW: Customer → Sales Order → Delivery → Invoice (Billing Doc) → Payment (Journal Entry)
`;

// If none of these appear, we assume the user isn't asking about O2C data.
const DOMAIN_KEYWORDS = [
  'invoice', 'billing', 'payment', 'delivery', 'customer', 'order',
  'journal', 'accounting', 'document', 'fiscal', 'amount', 'currency',
  'company', 'o2c', 'sap', 'cancelled', 'flow', 'trace', 'broken',
  'unpaid', 'billed', 'shipped', 'goods', 'movement', 'entry',
  'soldto', 'sold to', 'plant', 'picking', 'status', 'net amount',
  'product', 'material', 'sales', 'receivable', 'outstanding', 'open',
  'balance', 'revenue', 'transaction', 'ar ', 'bill', 'ship', 'item',
];

export function looksOnTopic(message: string): boolean {
  const lower = message.toLowerCase();
  return DOMAIN_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Single place that talks to Groq: POST JSON, read assistant text from choices[0]. */
async function callLLM(prompt: string, maxTokens = 512): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const response = await fetch(GROQ_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       MODEL,
      max_tokens:  maxTokens,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq API ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned empty response');
  return content.trim();
}

// System-style instructions prepended to every "generate SQL" request.
const SQL_PROMPT_PREFIX = `
${DB_SCHEMA}

INSTRUCTIONS:
You are an expert SQLite query generator for a SAP Order-to-Cash database.
Respond ONLY with a JSON object — no explanation, no markdown, no code fences.

If the question is about the O2C dataset:
  {"sql": "SELECT ..."}

If the question is NOT about the dataset (general knowledge, coding, writing, etc.):
  {"error": "OUT_OF_DOMAIN"}

RULES:
- SELECT only. Never INSERT/UPDATE/DELETE/DROP.
- Use table aliases. LIMIT 50 unless user asks for more.
- Use LEFT JOIN to reveal broken flows (NULL = missing link).
- For invoice traces use invoices.accounting_document to join payments.
- For customer queries join on invoices.sold_to_party = customers.id or sales_orders.sold_to_party = customers.id.
- To link invoices to deliveries join via billing_document_items.billing_document = invoices.id and billing_document_items.reference_delivery = deliveries.id.
- To link invoices to products join via billing_document_items.billing_document = invoices.id and billing_document_items.material = products.id.
- raw_json columns are blobs — do not SELECT * with them unless needed, use specific columns.

EXAMPLE QUERIES:

"Which billing documents have the highest amounts?"
{"sql": "SELECT id, billing_document_type, total_net_amount, transaction_currency, creation_date FROM invoices WHERE is_cancelled = 0 ORDER BY total_net_amount DESC LIMIT 10"}

"Which products are associated with the most billing documents?"
{"sql": "SELECT p.id, p.product_old_id, p.product_group, COUNT(DISTINCT bdi.billing_document) as invoice_count FROM products p JOIN billing_document_items bdi ON bdi.material = p.id GROUP BY p.id ORDER BY invoice_count DESC LIMIT 20"}

"Trace the full flow for sales order 740506"
{"sql": "SELECT so.id as sales_order, so.sold_to_party as customer, d.id as delivery, d.goods_movement_status, i.id as invoice, i.total_net_amount, i.is_cancelled, p.id as payment, p.amount, p.posting_date FROM sales_orders so LEFT JOIN billing_document_items bdi ON bdi.reference_delivery IN (SELECT id FROM deliveries) LEFT JOIN invoices i ON i.id = bdi.billing_document AND i.sold_to_party = so.sold_to_party LEFT JOIN deliveries d ON d.id = bdi.reference_delivery LEFT JOIN payments p ON p.id = i.accounting_document WHERE so.id = '740506' LIMIT 50"}

"Find invoices with no payment"
{"sql": "SELECT i.id, i.total_net_amount, i.transaction_currency, i.creation_date, i.sold_to_party FROM invoices i LEFT JOIN payments p ON p.id = i.accounting_document WHERE p.id IS NULL AND i.is_cancelled = 0 LIMIT 50"}

"Sales orders that were delivered but not billed"
{"sql": "SELECT so.id as sales_order, so.sold_to_party, so.total_net_amount, so.overall_delivery_status FROM sales_orders so WHERE so.overall_delivery_status = 'C' AND so.id NOT IN (SELECT DISTINCT so2.id FROM sales_orders so2 JOIN billing_document_items bdi ON bdi.reference_delivery IN (SELECT d.id FROM deliveries d) JOIN invoices i ON i.id = bdi.billing_document AND i.sold_to_party = so2.sold_to_party) LIMIT 50"}

"What is the capital of France?"
{"error": "OUT_OF_DOMAIN"}
`;

export type SQLResult =
  | { sql: string }
  | { error: 'OUT_OF_DOMAIN' | 'PARSE_ERROR' | 'UNSAFE_QUERY' | 'LLM_ERROR'; message?: string };

/**
 * Cheap gate → LLM → JSON parse → validate SELECT only.
 * index.ts branches on the `error` variant to return friendly HTTP responses.
 */
export async function naturalLanguageToSQL(question: string): Promise<SQLResult> {
  if (!looksOnTopic(question)) return { error: 'OUT_OF_DOMAIN' };

  const prompt = `${SQL_PROMPT_PREFIX}\n\nUser question: "${question}"\n\nRespond with JSON only:`;

  let raw: string;
  try {
    raw = await callLLM(prompt, 512);
  } catch (err) {
    return { error: 'LLM_ERROR', message: (err as Error).message };
  }

  // Models sometimes wrap JSON in markdown fences; strip those before JSON.parse.
  const cleaned = raw.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as { sql?: string; error?: string };

    if (parsed.error === 'OUT_OF_DOMAIN') return { error: 'OUT_OF_DOMAIN' };
    if (typeof parsed.sql !== 'string' || !parsed.sql.trim()) return { error: 'PARSE_ERROR' };
    if (!parsed.sql.trim().toUpperCase().startsWith('SELECT'))  return { error: 'UNSAFE_QUERY' };

    return { sql: parsed.sql };
  } catch {
    return { error: 'PARSE_ERROR' };
  }
}

/** Second LLM pass: same data the user would see in a table, summarized in prose. */
export async function synthesizeAnswer(
  question: string,
  results: Record<string, unknown>[]
): Promise<string> {
  if (!results || results.length === 0) {
    return 'No matching records found in the dataset. The data may not contain what you are looking for.';
  }

  const prompt = `
You are a business analyst assistant for a SAP Order-to-Cash (O2C) system.

The user asked: "${question}"

The database returned ${results.length} row(s):
${JSON.stringify(results.slice(0, 20), null, 2)}
${results.length > 20 ? `\n...(${results.length - 20} more rows omitted)` : ''}

Answer the user's question clearly and concisely in plain English.
- Reference specific IDs, amounts, and dates from the data.
- If rows contain NULL values, flag them as broken or incomplete flows.
- Keep the answer under 120 words.
- Do NOT invent information not in the results.
- Do NOT explain what SQL was run.
`;

  try {
    return await callLLM(prompt, 300);
  } catch {
    return `Found ${results.length} record(s). First result: ${JSON.stringify(results[0])}`;
  }
}