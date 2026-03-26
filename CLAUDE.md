# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An AI-powered SAP Order-to-Cash (O2C) process explorer. It ingests SAP JSONL data into SQLite, builds a relationship graph, and exposes a natural-language chat interface backed by Groq (Llama 3.3-70b) that translates questions to SQL and synthesizes business-readable answers.

## Environment Setup

Create a `.env` file in the repo root:
```
GROQ_API_KEY=<your-groq-api-key>
PORT=3001                        # optional, defaults to 3001
CLIENT_ORIGIN=http://localhost:5173  # optional
```

## Commands

All commands use `pnpm`. The repo uses separate `package.json` files per workspace — there is no root-level `dev` or `start` script yet.

### Server
```bash
cd server
pnpm install
pnpm run ingest          # parse JSONL → SQLite (data/o2c.sqlite) + graph (data/graph.json)
node src/index.ts        # start API server (requires ts-node or nodemon)
```

The server runs `.ts` files directly via Node with `--experimental-strip-types` (Node 22+) or via `nodemon`. No build step is required; `tsconfig.json` has `"noEmit": true`.

### Client
```bash
cd client
pnpm install
pnpm dev      # Vite dev server at http://localhost:5173
pnpm build    # production build
pnpm lint     # ESLint
```

## Architecture

### Data Flow
```
data/sap-o2c-data/**/*.jsonl
        │
        ▼ ingest.ts (one-time ETL)
        │
        ├─► data/o2c.sqlite   (4 tables: customers, deliveries, invoices, payments)
        └─► data/graph.json   (nodes + edges for graph visualization)
```

### Server (`server/src/`)
- **`ingest.ts`** — standalone ETL script. Reads JSONL from `data/sap-o2c-data/`, creates the SQLite schema (drops and recreates tables), then builds `graph.json`. Delivery→Invoice edges are time-based (no FK exists in source data).
- **`db.ts`** — singleton `better-sqlite3` connection. Exposes `query()` and `queryOne()` — both enforce SELECT-only.
- **`llm.ts`** — all Groq API calls. Two exported functions:
  - `naturalLanguageToSQL(question)` — keyword-guards the question, then prompts Llama to return `{"sql":"..."}` or `{"error":"OUT_OF_DOMAIN"}`. Validates the response is SELECT-only before returning.
  - `synthesizeAnswer(question, rows)` — takes query results and produces a plain-English business answer.
- **`index.ts`** — Express 5 server. Routes: `GET /api/health`, `GET /api/graph` (with optional `?types=` filter), `GET /api/nodes/:id`, `POST /api/chat`, `GET /api/schema`.
- **`types.ts`** — all shared TypeScript interfaces (raw SAP types, graph types, API request/response types).

### Client (`client/src/`)
- React 19 + Vite. The client is currently a stub (`App.jsx` renders a placeholder). Intended to use **ReactFlow** (already installed) to visualize the graph and **axios** to call the server API.

### Key Relationships in SQLite
- `invoices.accounting_document = payments.id` (invoice → payment)
- `invoices.sold_to_party = customers.id` (invoice → customer)
- Deliveries have no FK to invoices — linked only by time-based ordering in `graph.json`

### Node ID Format
Graph node IDs follow `<type>-<entityId>` (e.g., `invoice-90504248`, `customer-320000083`). The `/api/nodes/:id` endpoint parses this format to determine which SQLite table to query.

### Domain Guard
`llm.ts` has a keyword list (`DOMAIN_KEYWORDS`) that short-circuits out-of-domain questions before hitting the Groq API. If a question passes the keyword check but Groq returns `OUT_OF_DOMAIN`, the chat endpoint returns a canned response with `guarded: true`.
