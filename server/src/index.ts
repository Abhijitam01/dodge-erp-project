import dotenv from 'dotenv';
import path from 'path';
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

const GRAPH_PATH = path.resolve(__dirname, '../../../data/graph.json');


app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));

app.use(express.json({ limit: '1mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});


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

  const tableMap: Record<string, string> = {
    invoice:  'invoices',
    payment:  'payments',
    customer: 'customers',
    delivery: 'deliveries',
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

  let answer: string;
  try {
    answer = await synthesizeAnswer(trimmed, rows);
  } catch {
    answer = `Found ${rows.length} record(s).`;
  }

  return res.json({
    answer,
    sql:         sqlResult.sql,
    results:     rows,
    resultCount: rows.length,
  });
});


app.get('/api/schema', (_req: Request, res: Response) => {
  try {
    const tables = ['customers', 'deliveries', 'invoices', 'payments'];
    const counts: Record<string, number | string> = {};
    for (const t of tables) {
      try {
        const row = queryOne<{ n: number }>(`SELECT COUNT(*) as n FROM ${t}`);
        counts[t] = row?.n ?? 0;
      } catch {
        counts[t] = 'not found — run npm run ingest';
      }
    }
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});


app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

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