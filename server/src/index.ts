/**
 * Main HTTP server ("backend API").
 *
 * Big picture:
 * 1. Express listens on a port and answers URLs like /api/health.
 * 2. Some routes read files (graph.json) or SQLite (via db.ts).
 * 3. /api/chat turns the user's English into SQL (llm.ts), runs it safely, then
 *    asks the LLM again to summarize rows in plain English.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM modules don't define __dirname automatically; we rebuild it from this file's URL.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load variables from ../../.env (repo root) into process.env — e.g. GROQ_API_KEY, PORT.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';

import { query, queryOne } from './db.ts';
import { naturalLanguageToSQL, synthesizeAnswer } from './llm.ts';
import type {
  ChatRequest, ChatResponse, NodeResponse, HealthResponse, Graph,
} from './types.ts';

const app  = express();
const PORT = Number(process.env.PORT) || 3001;

// Precomputed graph for the UI (nodes/edges). Built by the ingest script, not by this file.
const GRAPH_PATH = path.resolve(__dirname, '../../data/graph.json');

// --- Middleware: runs on (almost) every request before your route handler ---

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));

// Parse JSON request bodies (e.g. POST /api/chat { "message": "..." }).
app.use(express.json({ limit: '1mb' }));

// Simple request logger; `next()` hands off to the next middleware or route.
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// --- Routes: each app.get / app.post matches a URL + HTTP method ---

/** Is the server up? Is the graph file present? Is the AI key configured? */
app.get('/api/health', (_req: Request, res: Response<HealthResponse>) => {
  const graphExists = fs.existsSync(GRAPH_PATH);
  let nodeCount: number | undefined;
  let edgeCount: number | undefined;

  if (graphExists) {
    try {
      const g = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf-8')) as Graph;
      nodeCount = g.nodes.length;
      edgeCount = g.edges.length;
    } catch { /* ignore */ }
  }

  res.json({
    status:     'ok',
    timestamp:  new Date().toISOString(),
    graphReady: graphExists,
    groqKeySet: !!process.env.GROQ_API_KEY,
    nodeCount,
    edgeCount,
  });
});

/** Full graph or a filtered subset (?types=invoice,customer) for visualization. */
app.get('/api/graph', (req: Request, res: Response) => {
  if (!fs.existsSync(GRAPH_PATH)) {
    return res.status(503).json({ error: 'Graph not ready. Run: npm run ingest' });
  }

  try {
    const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf-8')) as Graph;

    const { types } = req.query;
    if (typeof types === 'string' && types.trim()) {
      const allowed = new Set(types.split(',').map((t) => t.trim()));
      const filteredNodes = graph.nodes.filter((n) => allowed.has(n.type));
      const filteredIds   = new Set(filteredNodes.map((n) => n.id));
      const filteredEdges = graph.edges.filter(
        (e) => filteredIds.has(e.source) && filteredIds.has(e.target)
      );
      return res.json({ nodes: filteredNodes, edges: filteredEdges });
    }

    return res.json(graph);
  } catch (err) {
    console.error('graph.json read error:', err);
    return res.status(500).json({ error: 'Failed to load graph' });
  }
});

/**
 * One business object from SQLite by URL id, e.g. /api/nodes/invoice-90504248
 * Format: "<nodeType>-<databasePrimaryKey>" → pick table → SELECT * → merge raw_json.
 */
app.get('/api/nodes/:id', (req: Request, res: Response<NodeResponse | { error: string }>) => {
  const raw = req.params.id;
  const id = typeof raw === 'string' ? raw : raw?.[0];
  if (!id) {
    return res.status(400).json({ error: 'Missing node id' });
  }
  const separatorIdx = id.indexOf('-');
  if (separatorIdx === -1) {
    return res.status(400).json({ error: 'Invalid node id format. Expected: type-entityId' });
  }

  const nodeType = id.slice(0, separatorIdx);
  const entityId = id.slice(separatorIdx + 1);

  // Maps the graph's node "type" string to an actual SQLite table name.
  const tableMap: Record<string, string> = {
    invoice:     'invoices',
    payment:     'payments',
    customer:    'customers',
    delivery:    'deliveries',
    sales_order: 'sales_orders',
    product:     'products',
  };

  const table = tableMap[nodeType];
  if (!table) {
    return res.status(400).json({ error: `Unknown node type: ${nodeType}` });
  }

  try {
    const row = queryOne(`SELECT * FROM ${table} WHERE id = ?`, [entityId]);
    if (!row) return res.status(404).json({ error: 'Node not found' });

    let enriched = { ...row } as Record<string, unknown>;
    if (typeof enriched.raw_json === 'string') {
      try {
        const parsed = JSON.parse(enriched.raw_json);
        enriched = { ...enriched, ...parsed };
      } catch { /* keep original */ }
      delete enriched.raw_json;
    }

    return res.json({ id, type: nodeType, data: enriched });
  } catch (err) {
    console.error('Node fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch node' });
  }
});

/**
 * Inspect SQL result rows and return graph node IDs in "<type>-<id>" format.
 * Covers the four main entity types using their known SQLite primary-key columns.
 */
function extractNodeIds(rows: Record<string, unknown>[]): string[] {
  if (!rows.length) return [];
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.sold_to_party != null) ids.add(`customer-${row.sold_to_party}`);
    if (row.accounting_document != null) ids.add(`invoice-${row.accounting_document}`);
    if (row.delivery_id != null) ids.add(`delivery-${row.delivery_id}`);
    // payments primary key is `id`; only tag it if other payment columns are present
    const colNames = Object.keys(row).join(' ');
    if (row.id != null && /amount|payment|fiscal/.test(colNames)) {
      ids.add(`payment-${row.id}`);
    }
    // customer rows selected directly (e.g. SELECT * FROM customers)
    if (row.id != null && colNames.includes('sold_to_party')) {
      ids.add(`customer-${row.id}`);
    }
  }
  return Array.from(ids);
}

/**
 * Natural-language Q&A: question → (LLM) SQL → (SQLite) rows → (LLM) short answer.
 * The database layer only allows SELECT; see db.ts.
 */
app.post('/api/chat', async (
  req: Request<object, ChatResponse, ChatRequest>,
  res: Response<ChatResponse>
) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ answer: 'message field is required', error: 'BAD_REQUEST' });
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ answer: 'message cannot be empty', error: 'BAD_REQUEST' });
  }
  if (trimmed.length > 500) {
    return res.status(400).json({ answer: 'message too long (max 500 chars)', error: 'BAD_REQUEST' });
  }

  // Step 1: ask Groq to output JSON { "sql": "..." } or { "error": "OUT_OF_DOMAIN" }.
  const sqlResult = await naturalLanguageToSQL(trimmed);

  if ('error' in sqlResult) {
    if (sqlResult.error === 'OUT_OF_DOMAIN') {
      return res.json({
        answer:  'This system only answers questions about the SAP Order-to-Cash dataset — invoices, payments, deliveries, and customers. Please ask a business data question.',
        guarded: true,
      });
    }
    if (sqlResult.error === 'LLM_ERROR') {
      return res.status(503).json({
        answer: 'AI service unavailable. Check your GROQ_API_KEY and try again.',
        error:  sqlResult.error,
      });
    }
    return res.json({
      answer: "I couldn't translate that into a database query. Try rephrasing — for example: \"Show invoices with no payment\" or \"Which customer has the most billing documents?\"",
      error:  sqlResult.error,
    });
  }

  // Step 2: run the generated SELECT against SQLite (throws if not SELECT).
  let rows: Record<string, unknown>[];
  try {
    rows = query(sqlResult.sql);
  } catch (err) {
    console.error('SQL execution error:', (err as Error).message, '\nSQL:', sqlResult.sql);
    return res.json({
      answer: 'The generated query could not run. Try rephrasing your question.',
      error:  'SQL_EXECUTION_ERROR',
      sql:    sqlResult.sql,
    });
  }

  // Step 3: second LLM call — explain the rows in normal language (no SQL in the prompt to user).
  let answer: string;
  let synthesisError: string | undefined;
  try {
    answer = await synthesizeAnswer(trimmed, rows);
  } catch (err) {
    answer = `Found ${rows.length} record(s).`;
    synthesisError = (err as Error).message;
  }

  return res.json({
    answer,
    sql:          sqlResult.sql,
    results:      rows,
    resultCount:  rows.length,
    nodeIds:      extractNodeIds(rows),
    synthesisError,
  });
});

/** Aggregate stats for the dashboard UI. */
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const tables = ['customers', 'deliveries', 'invoices', 'payments', 'sales_orders', 'products'] as const;
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const row = queryOne<{ n: number }>(`SELECT COUNT(*) as n FROM ${t}`);
      counts[t] = row?.n ?? 0;
    }
    const revenueRow = queryOne<{ total: number | null }>(`SELECT SUM(CAST(amount AS REAL)) as total FROM payments`);
    const totalRevenue = revenueRow?.total ?? 0;
    const topCustomers = query<{ id: string; name: string; invoice_count: number }>(
      `SELECT c.id, c.name, COUNT(i.id) as invoice_count
       FROM customers c
       LEFT JOIN invoices i ON i.sold_to_party = c.id
       GROUP BY c.id
       ORDER BY invoice_count DESC
       LIMIT 8`
    );
    res.json({ counts, totalRevenue, topCustomers });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Row counts per table — handy to see if ingest populated the DB. */
app.get('/api/schema', (_req: Request, res: Response) => {
  try {
    const tables = ['customers', 'deliveries', 'invoices', 'payments', 'sales_orders', 'products', 'sales_order_items', 'billing_document_items'];
    const counts: Record<string, number | string> = {};
    for (const t of tables) {
      try {
        const row = queryOne<{ n: number }>(`SELECT COUNT(*) as n FROM ${t}`);
        counts[t] = row?.n ?? 0;
      } catch {
        counts[t] = 'not found — run pnpm run ingest';
      }
    }
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// No matching route → 404.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Express error handler (4 args) — catches errors passed via next(err).
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   Graph:    ${fs.existsSync(GRAPH_PATH) ? '✓ ready' : '✗ missing — run npm run ingest'}`);
  console.log(`   Groq key: ${process.env.GROQ_API_KEY ? '✓ set' : '✗ missing — add to .env'}\n`);
});

export default app;