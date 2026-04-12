# Hermes AI — Multi-Agent AI Operations Platform
### *The messenger between your tools. usehermes.ai*

## Context

**Problem:** You're a solo founder-engineer running multiple products. Your data lives across 10+ tools (GitHub, Gmail, Slack, Supabase, PostgreSQL, analytics, calendars). You context-switch constantly, miss signals, and lose hours on operational overhead that an AI system should handle.

**Goal:** Build a general-purpose SaaS AI agent platform that connects to any app via MCP, orchestrates specialist agents via LangGraph.js, maintains persistent memory across sessions, and actually takes actions (not just answers questions). Designed to work for any team — engineering, design, marketing, leadership — without role-based complexity upfront.

**Learning Goal:** Master every layer of production AI engineering — agents, multi-agent orchestration, RAG, memory systems, context management, evaluation, observability, streaming, event processing — in one project. TypeScript primary, Python for evaluation.

**Resume Goal:** A project that proves you can build production AI infrastructure, not just call APIs.

---

## Tech Stack (Verified April 2026)

| Layer | Technology | Why This, Not That |
|-------|-----------|-------------------|
| Agent Orchestration | **LangGraph.js** | Feature parity with Python, 42K weekly npm downloads, precise state machine control over agent flow |
| AI SDK | **Vercel AI SDK v6** | 20M+ monthly downloads, streaming-first, tool-loop agents, edge-ready |
| LLM Provider | **Anthropic Claude (primary)**, OpenAI (fallback) | Multi-provider from day 1 for resilience |
| Integrations | **MCP (Model Context Protocol)** TypeScript SDK | Anthropic's standard, first-class TS support, future-proof |
| Frontend | **Next.js 15 (App Router)** | You know it, streaming RSC for agent responses |
| Database | **PostgreSQL + pgvector** (via Supabase or Neon) | One DB for structured data + vector search. pgvector handles <10M vectors at 20ms queries |
| Session Memory | **Redis** (Upstash serverless) | Sub-ms reads, TTL-based expiry, pub/sub for real-time |
| Async Jobs | **Inngest** | You already know it, managed retries, event chaining, no queue infra to manage |
| Observability | **Braintrust** (free: 1M spans/month) | Eval-first, traces, CI/CD integration |
| Eval Suite | **Python + RAGAS + custom harness** | Gets Python on your resume, RAGAS is the standard |
| Deployment | **Docker Compose (local)** → **Railway (staging)** → **Fly.io (prod)** | No K8s complexity. Railway auto-detects Dockerfiles. Fly.io for multi-region when needed |
| Streaming/Events | **Redis Streams** (not Kafka) | Sub-ms latency, you already have Redis, Kafka is overkill until 1B events/day |

### What We're NOT Using (and Why)
- **Mastra**: Opinionated, good framework, but LangGraph gives more control over agent state and you learn more building the orchestration yourself
- **Pinecone/Weaviate/Qdrant**: pgvector is enough for <10M vectors. One less service to manage
- **Kafka**: Overkill for your scale. Redis Streams covers event-driven patterns
- **CrewAI**: Python-only, no TypeScript support
- **Mem0/Zep**: You'll build your own memory layer — that's the whole point of learning

---

## Architecture Overview

```
                         ┌──────────────────────┐
                         │   Next.js Frontend    │
                         │  (Dashboard + Chat)   │
                         └──────────┬───────────┘
                                    │ Vercel AI SDK (streaming)
                         ┌──────────▼───────────┐
                         │   Agent Runtime API   │
                         │  (Node.js + Express)  │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │     LangGraph.js Orchestrator  │
                    │    (Planner → Router → Agents) │
                    └──┬──────┬──────┬──────┬──────┬┘
                       │      │      │      │      │
                  ┌────▼─┐ ┌─▼───┐ ┌▼────┐ ┌▼────┐ ┌▼──────┐
                  │Comms │ │Code │ │Data │ │ Ops │ │Product│
                  │Agent │ │Agent│ │Agent│ │Agent│ │Agent  │
                  └──┬───┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬────┘
                     │        │       │       │       │
                  ┌──▼───┐ ┌──▼──┐ ┌─▼───┐ ┌─▼────┐ ┌▼──────┐
                  │Slack │ │Git  │ │PG   │ │Sentry│ │PostHog│
                  │Gmail │ │Hub  │ │Supa-│ │Logs  │ │Linear │
                  │Cal   │ │Lin- │ │base │ │MCP   │ │MCP    │
                  │MCP   │ │ear  │ │MCP  │ └──────┘ └───────┘
                  └──────┘ │MCP  │ └─────┘
                           └─────┘
                       │        │        │        │       │
                   ┌───▼────────▼────────▼────────▼───────▼┐
                   │            Memory Layer                │
                   │  Redis (session) │ PG (facts)          │
                   │  pgvector (semantic search)            │
                   └───────────────────────────────────────┘
                       │
                   ┌───▼───────────────────────────────────┐
                   │       Observability & Eval             │
                   │  Braintrust traces │ Python eval       │
                   └───────────────────────────────────────┘
```

### MCP Integrations Map (8 total)

| MCP Server | Agent | Read Tools | Write Tools |
|------------|-------|------------|-------------|
| **PostgreSQL** | Data Agent | `query_table`, `list_tables`, `describe_schema` | — (read-only) |
| **GitHub** | Code Agent | `list_prs`, `get_pr_diff`, `list_issues`, `get_commits` | `create_issue`, `comment_on_pr` |
| **Slack** | Comms Agent | `search_messages`, `list_channels`, `get_thread` | `post_message`, `reply_to_thread` |
| **Gmail** | Comms Agent | `search_emails`, `read_email`, `list_labels` | `draft_email`, `send_email` |
| **Calendar** | Comms Agent | `list_events`, `find_free_slots` | `create_event` |
| **Linear** | Code/Product Agent | `list_issues`, `get_issue`, `search_issues`, `list_projects` | `create_issue`, `update_status` |
| **Sentry** | Ops Agent | `list_issues`, `get_issue_events`, `get_error_stacktrace` | `resolve_issue`, `assign_issue` |
| **PostHog** | Product Agent | `query_events`, `get_insights`, `get_funnel`, `list_feature_flags` | `create_annotation` |

---

## Phase 0: Foundation & Learning (Week 1)

**Goal:** Set up the monorepo, understand core concepts before writing agent code. Do NOT skip this — it prevents "vibe coded but don't understand it" syndrome.

---

### Phase 0.1: Prerequisites & Local Environment (Day 1, ~2 hours)

**What:** Make sure your machine has everything installed before touching any code.

**Tasks:**
- [ ] **Install Node.js 20 LTS** (if not already) — `node -v` should show v20.x
- [ ] **Install pnpm** — `npm install -g pnpm` (we use pnpm, not npm/yarn — faster installs, strict dependency resolution, monorepo-native with workspaces)
- [ ] **Install Docker Desktop** — `docker --version` and `docker compose version` should both work
- [ ] **Install Python 3.12** — `python --version` should show 3.12.x (for eval suite later, but set it up now so it's not a blocker)
- [ ] **Install Git** (if not already) — `git --version`
- [ ] **Create accounts** (free tiers only):
  - [Anthropic Console](https://console.anthropic.com/) — get an API key (Claude)
  - [OpenAI Platform](https://platform.openai.com/) — get an API key (for embeddings: `text-embedding-3-small`)
  - [Neon](https://neon.tech/) — free PostgreSQL with pgvector (or Supabase if you prefer)
  - [Upstash](https://upstash.com/) — free serverless Redis
  - [Inngest](https://www.inngest.com/) — free event key
  - [Braintrust](https://www.braintrust.dev/) — free observability
  - [Vercel](https://vercel.com/) — free hosting for Next.js (you likely have this already)
- [ ] **Get API tokens for integrations** (you'll need these in Phase 3, but grab them now):
  - GitHub Personal Access Token (fine-grained, read-only to start)
  - Slack Bot Token (create a Slack app at api.slack.com → Bot Token Scopes: `channels:history`, `channels:read`, `chat:write`, `search:read`)
  - Linear API Key (Settings → API → Personal API keys)
  - Sentry Auth Token (Settings → Auth Tokens → create with `event:read`, `issue:read`, `project:read`)
  - PostHog API Key (Project Settings → API key — you need the personal API key, not the project one)

**Deliverable:**
- Run `node -v && pnpm -v && docker compose version && python --version && git --version` — all return version numbers
- `.env.local` file (NOT committed) with all API keys filled in

**Why not skip this:** Nothing is worse than getting deep into Phase 2 and realizing your Docker isn't configured or you forgot to sign up for Neon. Get the boring stuff out of the way now.

---

### Phase 0.2: Initialize Monorepo (Day 1-2, ~3 hours)

**What:** Set up the Turborepo monorepo with all packages, TypeScript configs, and shared tooling.

**Tasks:**

- [ ] **Create the repo and init Turborepo**
  ```bash
  mkdir hermes-ai && cd hermes-ai
  pnpm init
  pnpm add -Dw turbo typescript @types/node
  ```

- [ ] **Create the full folder structure**
  ```
  hermes-ai/
  ├── apps/
  │   ├── web/                          # Next.js 15 frontend
  │   │   ├── src/
  │   │   │   ├── app/                  # App Router pages
  │   │   │   │   ├── layout.tsx
  │   │   │   │   ├── page.tsx          # Landing / chat page
  │   │   │   │   ├── chat/
  │   │   │   │   │   └── page.tsx      # Main chat interface
  │   │   │   │   └── dashboard/
  │   │   │   │       └── page.tsx      # Cost, events, memory dashboard
  │   │   │   ├── components/
  │   │   │   │   ├── chat/
  │   │   │   │   │   ├── message-list.tsx
  │   │   │   │   │   ├── message-input.tsx
  │   │   │   │   │   └── tool-call-display.tsx
  │   │   │   │   └── ui/              # Shared UI components
  │   │   │   └── lib/
  │   │   │       └── api.ts           # API client for agent-runtime
  │   │   ├── next.config.ts
  │   │   ├── tailwind.config.ts
  │   │   ├── tsconfig.json
  │   │   └── package.json
  │   │
  │   └── agent-runtime/                # Node.js agent server
  │       ├── src/
  │       │   ├── index.ts              # Express app entry point
  │       │   ├── routes/
  │       │   │   ├── chat.ts           # POST /api/chat — main agent endpoint
  │       │   │   └── health.ts         # GET /api/health — status check
  │       │   ├── agents/               # LangGraph agent definitions
  │       │   │   ├── herald.ts          # Supervisor/planner (Hermes as herald of the gods)
  │       │   │   ├── atlas.ts          # Data agent (Titan who held up the world of data)
  │       │   │   ├── hephaestus.ts     # Code agent (god of craftsmanship)
  │       │   │   ├── iris.ts           # Comms agent (goddess of messages & rainbows)
  │       │   │   ├── argus.ts          # Ops agent (the 100-eyed watchman)
  │       │   │   └── metis.ts          # Product agent (titaness of wisdom & analysis)
  │       │   ├── mcp/
  │       │   │   └── client.ts         # MCP client — connects to MCP servers
  │       │   └── middleware/
  │       │       ├── auth.ts           # Simple bearer token auth
  │       │       └── rate-limit.ts     # Express rate limiting
  │       ├── tsconfig.json
  │       └── package.json
  │
  ├── packages/
  │   ├── mcp-servers/                  # All MCP server implementations
  │   │   ├── postgres/
  │   │   │   ├── src/index.ts          # PostgreSQL MCP server
  │   │   │   ├── src/tools.ts          # Tool definitions (query, list, describe)
  │   │   │   └── package.json
  │   │   ├── github/
  │   │   │   ├── src/index.ts
  │   │   │   ├── src/tools.ts
  │   │   │   └── package.json
  │   │   ├── slack/
  │   │   │   ├── src/index.ts
  │   │   │   ├── src/tools.ts
  │   │   │   └── package.json
  │   │   ├── gmail/
  │   │   │   ├── src/index.ts
  │   │   │   ├── src/tools.ts
  │   │   │   └── package.json
  │   │   ├── calendar/
  │   │   │   ├── src/index.ts
  │   │   │   ├── src/tools.ts
  │   │   │   └── package.json
  │   │   ├── linear/
  │   │   │   ├── src/index.ts
  │   │   │   ├── src/tools.ts
  │   │   │   └── package.json
  │   │   ├── sentry/
  │   │   │   ├── src/index.ts
  │   │   │   ├── src/tools.ts
  │   │   │   └── package.json
  │   │   └── posthog/
  │   │       ├── src/index.ts
  │   │       ├── src/tools.ts
  │   │       └── package.json
  │   │
  │   ├── memory/                       # Memory layer
  │   │   ├── src/
  │   │   │   ├── index.ts              # Exports all memory interfaces
  │   │   │   ├── session.ts            # Redis session memory
  │   │   │   ├── facts.ts             # PostgreSQL fact extraction + storage
  │   │   │   ├── semantic.ts          # pgvector semantic search
  │   │   │   └── context-packer.ts    # Priority-based context packing
  │   │   ├── tsconfig.json
  │   │   └── package.json
  │   │
  │   └── shared/                       # Shared types & utils
  │       ├── src/
  │       │   ├── types.ts              # Shared TypeScript types
  │       │   ├── config.ts             # Environment config loader
  │       │   └── logger.ts             # Pino logger setup
  │       ├── tsconfig.json
  │       └── package.json
  │
  ├── eval/                             # Python eval suite
  │   ├── datasets/
  │   │   ├── single-tool.yaml          # Test queries for single-tool use
  │   │   ├── multi-agent.yaml          # Test queries for multi-agent
  │   │   ├── memory-recall.yaml        # Test queries for memory
  │   │   └── rag-retrieval.yaml        # Test queries for RAG
  │   ├── src/
  │   │   ├── runner.py                 # Eval harness — calls Agent Runtime API
  │   │   ├── judge.py                  # LLM-as-judge scoring
  │   │   ├── metrics.py                # Accuracy, latency, cost calculations
  │   │   └── report.py                 # Generate eval report
  │   ├── requirements.txt              # ragas, anthropic, httpx, pyyaml
  │   ├── pyproject.toml
  │   └── run.py                        # Entry point: python eval/run.py
  │
  ├── docker/
  │   ├── postgres/
  │   │   └── init.sql                  # CREATE EXTENSION vector; + seed tables
  │   └── redis/
  │       └── redis.conf                # Custom Redis config (optional)
  │
  ├── .github/
  │   └── workflows/
  │       ├── ci.yml                    # Type check + lint on every PR
  │       └── eval.yml                  # Run eval suite, post results to PR
  │
  ├── docker-compose.yml                # Local dev: PG + Redis + agent-runtime + web
  ├── docker-compose.prod.yml           # Production overrides (optional)
  ├── turbo.json                        # Turborepo pipeline config
  ├── pnpm-workspace.yaml               # Monorepo workspace definition
  ├── tsconfig.base.json                # Shared TypeScript config
  ├── .env.example                      # Template with all required env vars
  ├── .env.local                        # Your actual secrets (gitignored)
  ├── .gitignore
  └── README.md
  ```

- [ ] **Create `pnpm-workspace.yaml`**
  ```yaml
  packages:
    - "apps/*"
    - "packages/*"
    - "packages/mcp-servers/*"
  ```

- [ ] **Create `turbo.json`**
  ```json
  {
    "$schema": "https://turbo.build/schema.json",
    "tasks": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": ["dist/**", ".next/**"]
      },
      "dev": {
        "cache": false,
        "persistent": true
      },
      "lint": {},
      "type-check": {}
    }
  }
  ```

- [ ] **Create `tsconfig.base.json`** (shared across all packages)
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noUncheckedIndexedAccess": true
    }
  }
  ```

- [ ] **Create `.env.example`** (every env var the project needs)
  ```bash
  # LLM Providers
  ANTHROPIC_API_KEY=sk-ant-...
  OPENAI_API_KEY=sk-...

  # Infrastructure
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hermes
  REDIS_URL=redis://localhost:6379

  # Integrations (MCP servers)
  GITHUB_TOKEN=ghp_...
  SLACK_BOT_TOKEN=xoxb-...
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  LINEAR_API_KEY=lin_api_...
  SENTRY_AUTH_TOKEN=sntrys_...
  SENTRY_ORG=your-org
  SENTRY_PROJECT=your-project
  POSTHOG_API_KEY=phx_...
  POSTHOG_PROJECT_ID=12345

  # Services
  INNGEST_EVENT_KEY=
  INNGEST_SIGNING_KEY=
  BRAINTRUST_API_KEY=

  # App
  AGENT_RUNTIME_URL=http://localhost:4000
  NEXT_PUBLIC_AGENT_RUNTIME_URL=http://localhost:4000
  API_SECRET_KEY=nexus-dev-secret-change-in-prod
  ```

- [ ] **Create `.gitignore`**
  ```
  node_modules/
  dist/
  .next/
  .env.local
  .env.production
  .turbo/
  __pycache__/
  *.pyc
  .venv/
  ```

**Deliverable:**
- `pnpm install` runs without errors at root
- `pnpm turbo build` completes (even if packages are mostly empty)
- All folder structure exists — you can `ls` into any package and see `src/` and `package.json`
- `.env.example` has every variable documented

**Learning Resources:**
| Topic | Resource | Format |
|-------|----------|--------|
| **Turborepo monorepos** | [Turborepo Docs — Getting Started](https://turbo.build/repo/docs) | Docs |
| **pnpm workspaces** | [pnpm Workspaces](https://pnpm.io/workspaces) | Docs |
| **TypeScript project references** | [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html) | Docs |

---

### Phase 0.3: Docker Compose & Database Setup (Day 2, ~2 hours)

**What:** Get PostgreSQL (with pgvector), Redis, and the dev containers running locally. Every developer on the team (future-you) should be able to `docker compose up` and have a working environment in 60 seconds.

**Tasks:**

- [ ] **Create `docker-compose.yml`**
  ```yaml
  services:
    postgres:
      image: pgvector/pgvector:pg16
      ports:
        - "5432:5432"
      environment:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: hermes
      volumes:
        - postgres_data:/var/lib/postgresql/data
        - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U postgres"]
        interval: 5s
        timeout: 5s
        retries: 5

    redis:
      image: redis:7-alpine
      ports:
        - "6379:6379"
      volumes:
        - redis_data:/data
      healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 5s
        timeout: 5s
        retries: 5

  volumes:
    postgres_data:
    redis_data:
  ```

  **Note:** We're NOT containerizing the Next.js app or agent-runtime for local dev. You'll run those directly with `pnpm dev` for hot-reload speed. Docker is only for infrastructure services (PG, Redis). This avoids the #1 pain point of Docker dev setups: slow rebuilds.

- [ ] **Create `docker/postgres/init.sql`**
  ```sql
  -- Enable pgvector extension
  CREATE EXTENSION IF NOT EXISTS vector;

  -- Enable full-text search (built-in, just noting it here)
  -- tsvector is available by default in PostgreSQL

  -- Memories table (Phase 2, but schema ready now)
  CREATE TABLE IF NOT EXISTS memories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      source VARCHAR(50),           -- 'conversation', 'extraction', 'document'
      category VARCHAR(50),         -- 'preference', 'decision', 'fact', 'relationship'
      metadata JSONB DEFAULT '{}',
      embedding vector(1536),       -- text-embedding-3-small dimension
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Documents table (Phase 4, but schema ready now)
  CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT,
      source_url TEXT,
      content_type VARCHAR(20),     -- 'pdf', 'markdown', 'html', 'text'
      chunk_count INTEGER DEFAULT 0,
      ingested_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS document_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      metadata JSONB DEFAULT '{}',
      embedding vector(1536),
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Conversations table
  CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,    -- 'user', 'assistant', 'system', 'tool'
      content TEXT NOT NULL,
      tool_calls JSONB,             -- store tool call details
      metadata JSONB DEFAULT '{}',  -- tokens used, cost, latency, model
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Events table (Phase 7, but schema ready now)
  CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source VARCHAR(50) NOT NULL,  -- 'github', 'slack', 'sentry', 'posthog'
      event_type VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL,
      processed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories
      USING hnsw (embedding vector_cosine_ops);
  CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks
      USING hnsw (embedding vector_cosine_ops);
  CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_events_source ON events(source, event_type);
  CREATE INDEX IF NOT EXISTS idx_events_unprocessed ON events(processed) WHERE NOT processed;
  ```

- [ ] **Verify everything works**
  ```bash
  docker compose up -d
  # Wait for health checks
  docker compose ps          # Both should show "healthy"

  # Test PostgreSQL + pgvector
  docker compose exec postgres psql -U postgres -d hermes -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
  # Should return: vector

  # Test Redis
  docker compose exec redis redis-cli ping
  # Should return: PONG

  # Test tables exist
  docker compose exec postgres psql -U postgres -d hermes -c "\dt"
  # Should show: memories, documents, document_chunks, conversations, messages, events
  ```

**Deliverable:**
- `docker compose up -d` → both services healthy within 10 seconds
- pgvector extension confirmed enabled
- All 6 tables created with correct indexes
- `docker compose down && docker compose up -d` → data persists (volumes working)

**Learning Resources:**
| Topic | Resource | Format |
|-------|----------|--------|
| **pgvector setup** | [pgvector GitHub — Installation](https://github.com/pgvector/pgvector#installation) | Docs |
| **Docker Compose** | [Docker Compose Overview](https://docs.docker.com/compose/) | Docs |
| **HNSW indexing** | [pgvector Indexing Guide](https://github.com/pgvector/pgvector#indexing) | Docs |

---

### Phase 0.4: Initialize Core Packages (Day 2-3, ~3 hours)

**What:** Scaffold the actual TypeScript packages with their dependencies. After this, every package compiles and exports its types correctly.

**Tasks:**

- [ ] **`packages/shared`** — Shared types, config, logger
  ```bash
  cd packages/shared
  pnpm init
  pnpm add pino dotenv zod
  pnpm add -D typescript @types/node
  ```
  - Create `src/config.ts`: Zod schema for all env vars, validated at startup. App crashes immediately with a clear error if any env var is missing — no "undefined" surprises at runtime.
  - Create `src/logger.ts`: Pino logger with structured JSON output.
  - Create `src/types.ts`: Core types — `AgentMessage`, `ToolCall`, `MemoryEntry`, `MCPTool`, etc.

- [ ] **`packages/memory`** — Memory layer (stubbed for now, built in Phase 2)
  ```bash
  cd packages/memory
  pnpm init
  pnpm add ioredis pg pgvector
  pnpm add -D typescript @types/node @types/pg
  ```
  - Create `src/index.ts`: Export placeholder `SessionMemory`, `FactMemory`, `SemanticMemory` classes
  - These will be empty shells — just the interface, no implementation yet
  - This lets agent-runtime import from `@hermes/memory` from day 1

- [ ] **`apps/web`** — Next.js frontend
  ```bash
  cd apps/web
  pnpm create next-app . --typescript --tailwind --app --src-dir --import-alias "@/*"
  pnpm add ai @ai-sdk/anthropic
  ```
  - Replace default page with a simple chat UI placeholder
  - Verify `pnpm dev` shows the page at `localhost:3000`

- [ ] **`apps/agent-runtime`** — Express server
  ```bash
  cd apps/agent-runtime
  pnpm init
  pnpm add express ai @ai-sdk/anthropic @langchain/langgraph @langchain/core
  pnpm add -D typescript @types/node @types/express tsx
  ```
  - Create `src/index.ts`: Express app with `/api/health` endpoint returning `{ status: "ok", services: { postgres: "connected", redis: "connected" } }`
  - Actually ping PG and Redis in the health check — don't lie about connectivity
  - Add `"dev": "tsx watch src/index.ts"` to package.json scripts
  - Verify `pnpm dev` starts server at `localhost:4000` and health check returns green

- [ ] **Scaffold one MCP server as a template** (`packages/mcp-servers/postgres`)
  ```bash
  cd packages/mcp-servers/postgres
  pnpm init
  pnpm add @modelcontextprotocol/sdk pg zod
  pnpm add -D typescript @types/node @types/pg tsx
  ```
  - Create `src/index.ts`: MCP server skeleton using `@modelcontextprotocol/sdk` with one placeholder tool
  - This becomes the template for all 8 MCP servers

- [ ] **Wire up workspace dependencies**
  - `apps/agent-runtime` → depends on `@hermes/shared`, `@hermes/memory`
  - `apps/web` → depends on `@hermes/shared`
  - Each MCP server → depends on `@hermes/shared`
  - In each `package.json`:
    ```json
    "dependencies": {
      "@hermes/shared": "workspace:*"
    }
    ```

- [ ] **Add root scripts to `package.json`**
  ```json
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:reset": "docker compose down -v && docker compose up -d"
  }
  ```

**Deliverable:**
- `pnpm dev` from root starts both Next.js (`:3000`) and agent-runtime (`:4000`) simultaneously
- `curl http://localhost:4000/api/health` returns `{"status":"ok","services":{"postgres":"connected","redis":"connected"}}`
- Next.js app at `localhost:3000` shows a placeholder chat UI
- `pnpm turbo build` compiles all packages without TypeScript errors
- All `@hermes/*` workspace imports resolve correctly

**Learning Resources:**
| Topic | Resource | Format |
|-------|----------|--------|
| **Vercel AI SDK setup** | [AI SDK: Getting Started](https://ai-sdk.dev/docs/getting-started) | Docs |
| **MCP SDK TypeScript** | [MCP TypeScript SDK](https://modelcontextprotocol.io/docs/getting-started/building-servers) | Docs |
| **Express + TypeScript** | [Express with TypeScript (tsx)](https://tsx.is/) | Docs |
| **Zod validation** | [Zod Docs](https://zod.dev/) | Docs |

---

### Phase 0.5: Git, CI, and Developer Tooling (Day 3, ~1 hour)

**What:** Initialize git, set up basic CI, and configure linting. Do this early so every commit from Phase 1 onward is tracked and checked.

**Tasks:**

- [ ] **Initialize git repo**
  ```bash
  git init
  git add .
  git commit -m "chore: initialize hermes-ai monorepo"
  ```

- [ ] **Create GitHub repo and push**
  ```bash
  gh repo create hermes-ai --private --source=. --push
  ```

- [ ] **Create `.github/workflows/ci.yml`**
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    check:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: pnpm
        - run: pnpm install --frozen-lockfile
        - run: pnpm turbo type-check
        - run: pnpm turbo lint
  ```

- [ ] **Add ESLint + Prettier (minimal config)**
  - Don't over-configure. Use defaults. The goal is catching real errors, not arguing about semicolons.

**Deliverable:**
- Git repo initialized with clean first commit
- Push to GitHub → CI runs → green check
- Every future commit is tracked from this point forward

---

### Phase 0.6: Study Core Concepts (Day 3-5, ~10 hours)

**What:** Read and watch before building. This is the "don't skip leg day" of the project. You'll vibe-code faster AND better if you understand what LangGraph, MCP, and vector search actually do under the hood.

**Study Plan:**

#### Day 3: Agents & Orchestration (~4 hours)
- [ ] **Watch:** [AI Agents in LangGraph — DeepLearning.AI](https://learn.deeplearning.ai/courses/ai-agents-in-langgraph/) (~2 hrs)
  - Concepts to absorb: agent loops, tool calling, state machines, conditional edges
  - After watching: you should be able to draw a LangGraph state machine on paper
- [ ] **Read:** [LangGraph.js Concepts](https://langchain-ai.github.io/langgraphjs/concepts/) (~1 hr)
  - Focus on: StateGraph, nodes, edges, Command, checkpointing
- [ ] **Read:** [Vercel AI SDK — AI SDK Core](https://ai-sdk.dev/docs/ai-sdk-core/overview) (~1 hr)
  - Focus on: `generateText`, `streamText`, `tool` definitions, provider setup

#### Day 4: MCP Protocol (~3 hours)
- [ ] **Read:** [MCP Official Introduction](https://modelcontextprotocol.io/docs/getting-started/intro) (~30 min)
  - Understand: servers, clients, tools, resources, transports
- [ ] **Work through:** [Microsoft MCP for Beginners — Modules 1-5](https://github.com/microsoft/mcp-for-beginners) (~2 hrs)
  - Build the example MCP server from the tutorial
  - Understand: how tools are defined with Zod schemas, how transport works
- [ ] **Read:** [Anthropic MCP Course](https://anthropic.skilljar.com/introduction-to-model-context-protocol) (~30 min)

#### Day 5: Memory, Embeddings, Vector Search (~3 hours)
- [ ] **Read:** [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) (~45 min)
  - Understand: what an embedding is, how cosine similarity works, what HNSW is
- [ ] **Read:** [Redis: LLM Context Windows Explained](https://redis.io/blog/llm-context-windows/) (~30 min)
  - Understand: why context management matters, token limits, sliding windows
- [ ] **Read:** [Redis: AI Agent Memory Stateful Systems](https://redis.io/blog/ai-agent-memory-stateful-systems/) (~30 min)
  - Understand: session vs. long-term memory patterns
- [ ] **Read:** [Analytics Vidhya: Memory Systems in AI Agents](https://www.analyticsvidhya.com/blog/2026/04/memory-systems-in-ai-agents/) (~45 min)
  - Understand: hierarchical memory, memory extraction, multi-scope memory
- [ ] **Skim:** [Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) (~30 min)
  - Understand: summarization strategies, priority-based context packing

**Deliverable (Self-Test):**
After studying, you should be able to answer these without looking anything up:
1. What's the difference between a LangGraph node and an edge?
2. What does an MCP server expose, and what does the client do?
3. What's the difference between stdio and Streamable HTTP transport in MCP?
4. What is a vector embedding and why is cosine similarity used for search?
5. What's HNSW and why is it faster than brute-force vector search?
6. Why can't you just put everything in the LLM's context window?
7. What's the difference between session memory and semantic memory?

If you can't answer any of these, re-read that section. Don't move to Phase 1 until you can.

---

### Phase 0 Complete Checklist

Before starting Phase 1, verify ALL of these:

| # | Check | Command / Action |
|---|-------|-----------------|
| 1 | Node.js 20+ installed | `node -v` |
| 2 | pnpm installed | `pnpm -v` |
| 3 | Docker running | `docker compose version` |
| 4 | Python 3.12 installed | `python --version` |
| 5 | All API keys collected | Check `.env.local` has no empty values |
| 6 | Monorepo structure exists | `ls apps/ packages/` |
| 7 | Docker services healthy | `docker compose up -d && docker compose ps` |
| 8 | pgvector enabled | `SELECT extname FROM pg_extension WHERE extname = 'vector';` |
| 9 | All DB tables created | `\dt` in psql shows 6 tables |
| 10 | Next.js runs | `localhost:3000` shows page |
| 11 | Agent runtime runs | `curl localhost:4000/api/health` returns ok |
| 12 | Workspace imports work | `pnpm turbo build` passes |
| 13 | Git initialized + pushed | `git log` shows first commit |
| 14 | CI passes | Green check on GitHub |
| 15 | Core concepts studied | Can answer all 7 self-test questions |

---

## Phase 1: Single Agent + First MCP Server (Week 2-3)

**Goal:** Get one agent working end-to-end — user asks a question, agent uses a tool (MCP server) to fetch data, returns a streamed answer. This is the vertical slice that proves the architecture works.

### Tasks

- [ ] **1.1** Build a PostgreSQL MCP server
  - Implements MCP TypeScript SDK (`@modelcontextprotocol/sdk`)
  - Exposes tools: `query_table`, `list_tables`, `describe_schema`
  - Transport: Streamable HTTP (not stdio — we need network access)
  - Security: read-only queries only, parameterized to prevent SQL injection

- [ ] **1.2** Build a single LangGraph.js agent ("Data Agent")
  - State machine: `receive_query → plan_tools → call_tools → synthesize_response`
  - Tool binding: connects to the PostgreSQL MCP server
  - Uses Vercel AI SDK for LLM calls (Claude as provider)
  - Streaming responses back to the caller

- [ ] **1.3** Build the Agent Runtime API
  - Express server with `/api/chat` endpoint
  - Accepts user message, invokes LangGraph agent, streams response
  - Vercel AI SDK `streamText` for SSE streaming to frontend

- [ ] **1.4** Build minimal chat UI
  - Next.js App Router page with `useChat` hook (Vercel AI SDK)
  - Message list, input box, streaming response display
  - No auth, no fancy UI — just functional

### System Design Concepts to Understand

**Agent State Machine (LangGraph):**
```
                    ┌─────────┐
          ┌────────►│  Route  │────────┐
          │         └─────────┘        │
          │              │             │
     needs_tool     direct_answer   ambiguous
          │              │             │
     ┌────▼────┐   ┌────▼────┐  ┌────▼─────┐
     │Call Tool│   │Respond  │  │Clarify   │
     └────┬────┘   └─────────┘  └──────────┘
          │
     ┌────▼─────┐
     │Synthesize│
     └──────────┘
```

This is the core pattern. Every agent you build later follows this shape. The power of LangGraph is that each node is a function, edges are conditional, and the state is a typed object that flows through the graph.

**MCP Architecture:**
```
  Agent ←──(tool call)──→ MCP Client ←──(HTTP/SSE)──→ MCP Server ←──→ Data Source
```
MCP decouples agents from data sources. Your agent doesn't know it's talking to PostgreSQL — it just calls a tool. Tomorrow you can swap PostgreSQL for MySQL by swapping the MCP server. The agent code doesn't change.

### Deliverable
- Chat UI where you type "What tables exist in my database?" and the agent queries PostgreSQL via MCP and streams back the answer
- Agent can answer multi-step questions like "How many rows are in the users table and what are the column types?"
- MCP server runs as a separate process, agent connects to it over HTTP

### Learning Resources

| Topic | Resource | Format |
|-------|----------|--------|
| **Building MCP servers** | [MCP TypeScript SDK Docs](https://modelcontextprotocol.io/docs/getting-started/building-servers) | Docs |
| **LangGraph.js quickstart** | [LangGraph.js Getting Started](https://langchain-ai.github.io/langgraphjs/) | Docs |
| **Vercel AI SDK useChat** | [AI SDK: useChat](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot) | Docs |
| **Streaming patterns** | [Vercel AI SDK Streaming](https://ai-sdk.dev/docs/ai-sdk-core/streaming) | Docs |
| **Anthropic tool use** | [Anthropic Tool Use Docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview) | Docs |

---

## Phase 2: Memory Layer — The Hard Part (Week 4-5)

**Goal:** Build a 3-tier memory system. This is what separates your project from every other "I built a chatbot" repo. The agent should remember things across conversations.

### Tasks

- [ ] **2.1** Session Memory (Redis)
  - Store current conversation messages in Redis with TTL (1 hour)
  - Key pattern: `session:{sessionId}:messages`
  - Sliding window: keep last N messages + summarize older ones
  - Implementation: custom `MemoryStore` class, no external library

- [ ] **2.2** Fact Memory (PostgreSQL)
  - Schema: `memories` table with `id, content, source, category, created_at, updated_at, embedding`
  - After each conversation, extract factual statements (use LLM to extract)
  - Deduplicate against existing facts (semantic similarity check via pgvector)
  - Categories: `preference`, `decision`, `fact`, `relationship`

- [ ] **2.3** Semantic Memory (pgvector)
  - Embed all memories, documents, and conversation summaries
  - Retrieval: given a new query, find the top-K most relevant memories
  - Use cosine similarity with HNSW index for fast approximate search
  - Embedding model: `text-embedding-3-small` (OpenAI) or `voyage-3-lite`

- [ ] **2.4** Context Packing Algorithm
  - This is the key innovation. Given a user query, you have 128K tokens of context. What goes in?
  - Priority system:
    ```
    Priority 1: System prompt (always included)
    Priority 2: Current session messages (last N, sliding window)
    Priority 3: Retrieved semantic memories (top-K by relevance to query)
    Priority 4: Retrieved facts (filtered by category + recency)
    Priority 5: Tool results from current turn
    ```
  - Token counting: use `tiktoken` (or `js-tiktoken`) to count before packing
  - Budget allocation: system prompt (2K) + session (8K) + memories (4K) + tool results (remaining)

- [ ] **2.5** Memory extraction pipeline
  - After each conversation turn, run async extraction via Inngest
  - LLM extracts: facts learned, preferences detected, decisions made
  - Store extracted items in PostgreSQL with embeddings
  - Dedup: if cosine similarity > 0.92 with existing memory, update instead of insert

### System Design Concepts to Understand

**3-Tier Memory Architecture:**
```
┌─────────────────────────────────────────────────┐
│                  QUERY                          │
│         "What did we decide about auth?"        │
└──────────────────┬──────────────────────────────┘
                   │
     ┌─────────────▼──────────────┐
     │    Context Packing Engine   │
     │                             │
     │  1. Check Redis session     │──→ Recent messages (fast, <1ms)
     │  2. Query pgvector          │──→ Semantic memories (20ms)
     │  3. Query PG facts          │──→ Extracted decisions (5ms)
     │  4. Rank & pack into budget │──→ Final context (token-counted)
     └─────────────┬──────────────┘
                   │
     ┌─────────────▼──────────────┐
     │        LLM Call             │
     │  (with packed context)      │
     └────────────────────────────┘
```

**Why This Matters for Interviews:**
Context packing is an unsolved problem at scale. Every company building AI agents wrestles with it. Showing you've thought about priority-based context selection, token budgeting, and retrieval quality is a massive signal. Most people just dump everything into the context window and hope.

### Deliverable
- Agent remembers your name, preferences, and past decisions across sessions
- Ask "What have we discussed before?" and get accurate recall
- Context packing respects token budgets — you can log what was included/excluded
- Memory extraction runs async after each conversation (visible in Inngest dashboard)

### Learning Resources

| Topic | Resource | Format |
|-------|----------|--------|
| **Memory architecture** | [Analytics Vidhya: Memory Systems in AI Agents (Apr 2026)](https://www.analyticsvidhya.com/blog/2026/04/memory-systems-in-ai-agents/) | Article |
| **Memory at scale** | [Databricks: Memory Scaling for AI Agents](https://www.databricks.com/blog/memory-scaling-ai-agents) | Article |
| **Context management** | [Context Window Management Strategies (Maxim)](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) | Guide |
| **Context windows deep-dive** | [JetBrains: Efficient Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) | Research |
| **pgvector HNSW indexing** | [pgvector GitHub — Indexing section](https://github.com/pgvector/pgvector#indexing) | Docs |
| **Redis patterns for AI** | [Redis: AI Agent Memory Stateful Systems](https://redis.io/blog/ai-agent-memory-stateful-systems/) | Article |
| **Selective memory research** | [Mem0 Research](https://mem0.ai/research) | Research |

---

## Phase 3: Multi-Agent Orchestration (Week 6-7)

**Goal:** Expand from one agent to multiple specialist agents coordinated by a planner. This is where LangGraph's state machine model shines.

### Tasks

- [ ] **3.1** Build the Planner Agent (Supervisor pattern)
  - Receives user query + context from memory layer
  - Decides which specialist agent(s) to invoke
  - Routes using a classifier (LLM-based routing, not hardcoded if/else)
  - Handles multi-step queries: "Check my GitHub PRs and draft a Slack summary"

- [ ] **3.2** Build specialist agents
  - **Comms Agent**: Email, Slack, Calendar tools (via MCP)
  - **Code Agent**: GitHub PRs, issues, Linear issues (via MCP)
  - **Data Agent**: Database queries, analytics (existing from Phase 1)
  - **Ops Agent**: Sentry errors, logs, deployment status (via MCP)
  - **Product Agent**: PostHog analytics, Linear project tracking (via MCP)
  - Each agent is a LangGraph subgraph with its own state and tools

- [ ] **3.3** Build MCP servers for new integrations (8 total)

  **Batch 1 — Communication (build first, most immediately useful):**
  - **Slack MCP**: `search_messages`, `list_channels`, `get_thread`, `post_message`, `reply_to_thread`
    - Auth: Bot Token (xoxb-). Slack Web API via `@slack/web-api`.
    - Write actions (post/reply) require human-in-the-loop confirmation.
  - **Gmail MCP**: `search_emails`, `read_email`, `list_labels`, `draft_email`, `send_email`
    - Auth: OAuth 2.0 via Google APIs. Store refresh token.
    - Write actions (draft/send) require human-in-the-loop confirmation.
  - **Calendar MCP**: `list_events`, `find_free_slots`, `create_event`
    - Auth: Same Google OAuth as Gmail (shared credential).

  **Batch 2 — Engineering (build second, pairs with Code Agent):**
  - **GitHub MCP**: `list_prs`, `get_pr_diff`, `list_issues`, `get_commits`, `create_issue`, `comment_on_pr`
    - Auth: Personal Access Token (fine-grained). GitHub REST API v3.
  - **Linear MCP**: `list_issues`, `get_issue`, `search_issues`, `list_projects`, `create_issue`, `update_status`
    - Auth: Personal API Key. Linear GraphQL API.
    - Note: Linear's API is GraphQL-only. Use a lightweight client, not a full GQL codegen setup.

  **Batch 3 — Operations & Product (build third):**
  - **Sentry MCP**: `list_issues`, `get_issue_events`, `get_error_stacktrace`, `resolve_issue`, `assign_issue`
    - Auth: Auth Token. Sentry REST API.
    - Key value: "What errors are happening in production right now?" — the agent can surface unresolved Sentry issues proactively.
  - **PostHog MCP**: `query_events`, `get_insights`, `get_funnel`, `list_feature_flags`, `create_annotation`
    - Auth: Personal API Key. PostHog REST API.
    - Key value: "Which feature is most used?" / "What's our retention this week?" — product analytics on demand.

- [ ] **3.4** Agent handoff protocol
  - Planner creates a task plan: `[{agent: "code", action: "get_prs"}, {agent: "comms", action: "draft_summary"}]`
  - Sequential execution with state passing between agents
  - Parallel execution when agents are independent (LangGraph `Send` API)
  - Error handling: if one agent fails, planner decides to retry, skip, or ask user

- [ ] **3.5** Human-in-the-loop for write actions
  - ANY action that modifies external state (send email, post to Slack, create event) requires user confirmation
  - Agent proposes the action → UI shows confirmation dialog → user approves/rejects → agent executes or abandons
  - This is a guardrail, not a feature. Non-negotiable for production.

### System Design Concepts to Understand

**Supervisor Multi-Agent Pattern (LangGraph):**
```
                    ┌──────────┐
          ┌────────►│ Planner  │◄────────────┐
          │         │(Supervisor)│            │
          │         └─────┬────┘             │
          │               │                  │
          │    ┌──────────▼──────────┐       │
          │    │  Route to Agent(s)  │       │
          │    └──┬─────┬──────┬────┘       │
          │       │     │      │             │
          │   ┌───▼─┐ ┌▼────┐ ┌▼─────┐      │
          │   │Comms│ │Code │ │Data  │      │
          │   │Agent│ │Agent│ │Agent │      │
          │   └──┬──┘ └──┬──┘ └──┬───┘      │
          │      │       │       │           │
          │      └───────▼───────┘           │
          │         Combine results          │
          │              │                   │
          │    ┌─────────▼─────────┐         │
          │    │ Need more agents? │─── yes ──┘
          │    └─────────┬─────────┘
          │              │ no
          │    ┌─────────▼─────────┐
          └────│   Final Response  │
               └───────────────────┘
```

**Key LangGraph Concepts:**
- **State**: A typed object that flows through the graph. Each node reads/writes to it.
- **Nodes**: Functions that take state and return updated state.
- **Edges**: Conditional routing between nodes.
- **Command**: Combines state update + control flow (e.g., "update state AND go to node X").
- **Checkpointing**: LangGraph can save/restore agent state mid-execution. Critical for human-in-the-loop (pause agent → wait for user → resume).

### Deliverable
- Ask "Summarize my open PRs and draft a Slack message about them" → Planner routes to Code Agent (fetches PRs) then Comms Agent (drafts message) → shows confirmation before posting
- Ask "What Sentry errors happened today and are any related to my latest PR?" → Planner routes to Ops Agent (Sentry) then Code Agent (GitHub) → correlates errors with commits
- Ask "What's our most-used feature this week and are there any open Linear issues about it?" → Product Agent queries PostHog + Linear
- Agent handles ambiguous queries: "What's happening?" → Planner decides which agents to consult based on context
- Each agent runs independently with its own MCP tools
- Human confirmation UI for ALL write actions (post to Slack, create Linear issue, resolve Sentry issue, etc.)
- All 8 MCP servers running and connectable

### Learning Resources

| Topic | Resource | Format |
|-------|----------|--------|
| **Multi-agent patterns** | [LangGraph Multi-Agent Architectures](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/) | Docs |
| **Supervisor pattern** | [LangGraph Supervisor Tutorial](https://langchain-ai.github.io/langgraphjs/tutorials/multi_agent/agent_supervisor/) | Tutorial |
| **Human-in-the-loop** | [LangGraph Human-in-the-Loop](https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/) | Docs |
| **MCP Anthropic course** | [Anthropic MCP Course](https://anthropic.skilljar.com/introduction-to-model-context-protocol) | Course |
| **Agent handoffs** | [LangGraph Command & Handoff](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#command) | Docs |
| **Slack Web API** | [Slack API Docs](https://api.slack.com/web) | Docs |
| **Linear GraphQL API** | [Linear API Docs](https://developers.linear.app/docs/graphql/working-with-the-graphql-api) | Docs |
| **Sentry API** | [Sentry REST API Docs](https://docs.sentry.io/api/) | Docs |
| **PostHog API** | [PostHog API Docs](https://posthog.com/docs/api) | Docs |

---

## Phase 4: RAG Pipeline + Document Ingestion (Week 8-9)

**Goal:** Build a proper RAG system that ingests documents (PDFs, markdown, web pages) and makes them searchable by agents. This goes beyond memory — it's a knowledge base.

### Tasks

- [ ] **4.1** Document ingestion pipeline
  - Upload endpoint: accepts PDF, MD, TXT, HTML, URL
  - Processing via Inngest async jobs:
    1. Extract text (PDF: `pdf-parse`, HTML: `cheerio`, MD: direct)
    2. Chunk text (recursive character splitter, 512 tokens per chunk, 50 token overlap)
    3. Generate embeddings (`text-embedding-3-small`)
    4. Store chunks + embeddings in PostgreSQL with pgvector
  - Metadata: `source_url`, `document_title`, `chunk_index`, `ingested_at`

- [ ] **4.2** Retrieval with hybrid search
  - **Semantic search**: pgvector cosine similarity on embeddings
  - **Keyword search**: PostgreSQL full-text search (`tsvector`)
  - **Hybrid**: Reciprocal Rank Fusion (RRF) to combine both result sets
  - Return top-K chunks with relevance scores

- [ ] **4.3** RAG-specific agent
  - **Knowledge Agent**: specialized for answering questions from ingested documents
  - Retrieval → Re-ranking → Context injection → Generation
  - Citation: agent includes source references in responses (`[Source: document.pdf, page 3]`)

- [ ] **4.4** Chunking strategy experiments
  - Build 3 chunking strategies: fixed-size, recursive, semantic (split on topic boundaries)
  - Measure retrieval quality across all 3 using eval suite (Phase 5)
  - Pick the winner based on data, not vibes

### System Design Concepts to Understand

**Hybrid Retrieval with RRF:**
```
Query: "How does authentication work?"
          │
    ┌─────▼──────┐       ┌──────▼───────┐
    │  Semantic   │       │   Keyword    │
    │  (pgvector) │       │  (tsvector)  │
    │             │       │              │
    │ Result:     │       │ Result:      │
    │ 1. chunk_A  │       │ 1. chunk_C   │
    │ 2. chunk_B  │       │ 2. chunk_A   │
    │ 3. chunk_C  │       │ 3. chunk_D   │
    └──────┬──────┘       └──────┬───────┘
           │                     │
    ┌──────▼─────────────────────▼───────┐
    │     Reciprocal Rank Fusion (RRF)   │
    │                                     │
    │  RRF(chunk) = sum(1 / (k + rank))  │
    │  chunk_A: 1/61 + 1/62 = 0.0326    │ ← top result (appears in both)
    │  chunk_C: 1/63 + 1/61 = 0.0322    │
    │  chunk_B: 1/62 + 0     = 0.0161   │
    └──────────────────┬─────────────────┘
                       │
              Reranked results → LLM
```

**Why Hybrid Matters:**
Semantic search alone misses exact keyword matches ("Error code 403"). Keyword search alone misses semantic similarity ("authentication issue" ≈ "login problem"). Hybrid with RRF gets you 1-9% better recall — which compounds in production.

### Deliverable
- Upload a PDF → it gets chunked, embedded, and stored
- Ask "What does this document say about X?" → agent retrieves relevant chunks and answers with citations
- Hybrid search demonstrably outperforms semantic-only (measure it)
- Inngest dashboard shows document processing pipeline

### Learning Resources

| Topic | Resource | Format |
|-------|----------|--------|
| **Production RAG** | [Redis: RAG at Scale (Jan 2026)](https://redis.io/blog/rag-at-scale/) | Article |
| **RAG best practices** | [Morphik: OSS RAG Frameworks Guide](https://www.morphik.ai/blog/guide-to-oss-rag-frameworks-for-developers) | Guide |
| **Chunking strategies** | [LangChain Text Splitters](https://js.langchain.com/docs/concepts/text_splitters) | Docs |
| **Hybrid search** | [pgvector + full-text search patterns](https://github.com/pgvector/pgvector#hybrid-search) | Docs |
| **Embedding models comparison** | [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) | Benchmark |

---

## Phase 5: Evaluation Suite — Python (Week 10)

**Goal:** Build an automated evaluation system that measures whether your agents actually work correctly. This is the project's secret weapon. It gets Python on your resume AND demonstrates production AI maturity.

### Tasks

- [ ] **5.1** Create the eval dataset
  - Write 200+ test questions across all agent capabilities
  - Categories: `single-tool`, `multi-tool`, `multi-agent`, `memory-recall`, `rag-retrieval`, `ambiguous`
  - Each question has: `query`, `expected_tools_called`, `expected_answer_contains`, `category`, `difficulty`
  - Store as JSON/YAML in `eval/datasets/`

- [ ] **5.2** Build the eval harness (Python)
  - Calls your Agent Runtime API with each test query
  - Captures: response text, tools called, latency, token usage, cost
  - Scores each response using LLM-as-judge (Claude evaluates Claude — meta but standard)
  - Metrics: `accuracy`, `tool_selection_accuracy`, `retrieval_precision@5`, `latency_p50/p95`, `cost_per_query`

- [ ] **5.3** RAG-specific evaluation
  - Use RAGAS framework for: `faithfulness`, `answer_relevancy`, `context_precision`, `context_recall`
  - Build a golden dataset: 50 document questions with known correct answers and source chunks
  - Run after every chunking/retrieval change to measure regression

- [ ] **5.4** CI integration
  - GitHub Action: on every PR, run eval suite, post results as PR comment
  - Block merge if accuracy drops below threshold (e.g., 85%)
  - Track metrics over time in a simple dashboard (even a CSV + chart is fine)

### Deliverable
- Run `python eval/run.py` and get a report:
  ```
  ╔══════════════════════════════════════════╗
  ║         Hermes Eval Report              ║
  ╠══════════════════════════════════════════╣
  ║ Overall Accuracy:        91.2%           ║
  ║ Tool Selection:          94.5%           ║
  ║ Memory Recall:           87.3%           ║
  ║ RAG Faithfulness:        93.1%           ║
  ║ RAG Context Precision:   89.7%           ║
  ║ Avg Latency (p50):       1.2s            ║
  ║ Avg Cost per Query:      $0.03           ║
  ╚══════════════════════════════════════════╝
  ```
- GitHub Action runs eval on every PR
- You can explain what each metric means in an interview

### Learning Resources

| Topic | Resource | Format |
|-------|----------|--------|
| **LLM-as-Judge** | [Confident AI: LLM-as-Judge Complete Guide](https://www.confident-ai.com/blog/why-llm-as-a-judge-is-the-best-llm-evaluation-method) | Guide |
| **RAGAS framework** | [RAGAS Docs](https://docs.ragas.io/) | Docs |
| **Eval patterns** | [Eugene Yan: LLM Evaluators](https://eugeneyan.com/writing/llm-evaluators/) | Article |
| **Braintrust eval** | [Braintrust Docs](https://www.braintrust.dev/docs) | Docs |
| **LLM-as-Judge (Langfuse)** | [Langfuse Evaluation Methods](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge) | Docs |

---

## Phase 6: Observability & Cost Optimization (Week 11)

**Goal:** Add production-grade observability and cost management. This is what companies actually need and what most "AI projects" skip entirely.

### Tasks

- [ ] **6.1** Braintrust integration
  - Trace every agent run: input, output, tool calls, latency, tokens, cost
  - Tag traces by agent type, query category, session
  - Set up alerts for: latency spikes, error rate increases, cost anomalies

- [ ] **6.2** Semantic caching
  - Before calling LLM: embed the query, check Redis for semantically similar past queries (cosine > 0.95)
  - If cache hit: return cached response (saves 100% of LLM cost for that query)
  - Expected savings: 30-60% cost reduction on repeat/similar queries
  - Cache invalidation: TTL-based (24h default) + manual flush per data source

- [ ] **6.3** Model routing
  - Not all queries need Claude Opus/Sonnet. Simple queries → Haiku. Complex → Sonnet. Critical → Opus.
  - Build a lightweight classifier (can be rule-based initially, LLM-based later):
    - Single-tool, factual → Haiku ($0.001/query)
    - Multi-step reasoning → Sonnet ($0.01/query)
    - Complex analysis, write actions → Opus ($0.05/query)
  - Log routing decisions in Braintrust to validate

- [ ] **6.4** Cost dashboard
  - Track cost per: query, agent, user, day
  - Next.js page showing: daily spend, queries served, cache hit rate, model distribution
  - Alert if daily spend exceeds threshold

### Deliverable
- Braintrust dashboard with full traces for every agent run
- Semantic cache reduces cost by measurable percentage (log before/after)
- Model router demonstrably saves money without hurting quality (eval suite proves it)
- Cost dashboard in the Next.js app

### Learning Resources

| Topic | Resource | Format |
|-------|----------|--------|
| **Braintrust setup** | [Braintrust Docs](https://www.braintrust.dev/docs) | Docs |
| **Semantic caching** | [Redis: RAG at Scale — Caching Section](https://redis.io/blog/rag-at-scale/) | Article |
| **Model routing patterns** | [Martian Router Docs](https://docs.withmartian.com/) | Docs |
| **Cost optimization** | [Helicone LLM Cost Tracking](https://www.helicone.ai/) | Product/Docs |

---

## Phase 7: Event Streaming & Real-Time (Week 12)

**Goal:** Add real-time event processing. Agents don't just answer questions — they proactively surface insights from event streams.

### Tasks

- [ ] **7.1** Redis Streams for event ingestion
  - Each MCP server can publish events to Redis Streams
  - Event types:
    - `github.pr_opened`, `github.pr_merged`, `github.issue_created`
    - `slack.message_received`, `slack.mention`
    - `linear.issue_created`, `linear.status_changed`, `linear.cycle_completed`
    - `sentry.error_new`, `sentry.error_regression`, `sentry.spike_detected`
    - `posthog.insight_alert`, `posthog.funnel_drop`
    - `email.received`, `calendar.event_reminder`
  - Consumer group per agent type — each agent processes its relevant events

- [ ] **7.2** Proactive agent triggers
  - Ops Agent subscribes to `sentry.*` events → surfaces new errors immediately
  - Code Agent subscribes to `github.*` and `linear.*` events → summarizes PRs, tracks issue status
  - Product Agent subscribes to `posthog.*` events → alerts on metric anomalies
  - Comms Agent subscribes to `slack.*` and `email.*` events → flags important messages
  - When event matches a trigger rule → agent runs automatically → notifies user
  - Example: Sentry regression detected → Ops Agent fetches stacktrace → correlates with recent GitHub commits → surfaces "This error started after PR #42 was merged"

- [ ] **7.3** Real-time dashboard updates
  - WebSocket connection from Next.js to Agent Runtime
  - Events and agent notifications appear in real-time on dashboard
  - No polling — pure push via Redis pub/sub → WebSocket bridge

- [ ] **7.4** Event replay for debugging
  - Store all events in PostgreSQL (append-only event log)
  - Admin endpoint: replay events from a time range through agents
  - Critical for debugging: "Why didn't the agent catch this yesterday?"

### Deliverable
- Push a commit to GitHub → within seconds, Code Agent summarizes it and shows a notification in the dashboard
- Agent proactively alerts: "Your deployment failed 5 minutes ago. Here's the error from logs."
- Event stream visible in real-time on dashboard
- Can replay historical events through agents

### Learning Resources

| Topic | Resource | Format |
|-------|----------|--------|
| **Redis Streams** | [Redis Streams Docs](https://redis.io/docs/latest/develop/data-types/streams/) | Docs |
| **Event-driven architecture** | [Confluent Kafka Intro (concepts apply to any stream)](https://developer.confluent.io/courses/apache-kafka/get-started-hands-on/) | Course |
| **WebSocket patterns** | [Socket.io Docs](https://socket.io/docs/v4/) | Docs |
| **Event sourcing** | [Martin Fowler: Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) | Article |

---

## Phase 8: Deployment & Production Hardening (Week 13-14)

**Goal:** Deploy to production with no infra conflicts. Everything works locally in Docker Compose and deploys to cloud with minimal config changes.

### Tasks

- [ ] **8.1** Dockerize everything
  ```dockerfile
  # agent-runtime/Dockerfile
  FROM node:20-alpine
  # Multi-stage build: install → build → runtime
  
  # eval/Dockerfile  
  FROM python:3.12-slim
  # Python eval suite as separate container
  ```

- [ ] **8.2** Production infrastructure
  - **PostgreSQL + pgvector**: Neon (free tier: 512MB, scales to paid) or Supabase (free tier: 500MB)
  - **Redis**: Upstash (free tier: 10K commands/day, scales to paid) — serverless, no server to manage
  - **Agent Runtime**: Railway (free trial, then $5/mo) or Fly.io ($0 for small apps)
  - **Next.js Frontend**: Vercel (free tier)
  - **Inngest**: Managed cloud (free tier: 25K events/mo)

- [ ] **8.3** Environment configuration
  ```
  # .env.production
  DATABASE_URL=postgresql://...@neon.tech/hermes
  REDIS_URL=rediss://...@upstash.io:6379
  ANTHROPIC_API_KEY=sk-ant-...
  OPENAI_API_KEY=sk-...
  INNGEST_EVENT_KEY=...
  BRAINTRUST_API_KEY=...
  ```
  - All secrets via environment variables, never in code
  - Separate `.env.development` and `.env.production`

- [ ] **8.4** Deployment pipeline
  ```
  git push → GitHub Actions →
    1. Run TypeScript type checks
    2. Run Python eval suite
    3. If eval passes threshold → deploy agent-runtime to Railway
    4. Deploy web to Vercel (auto via git integration)
  ```

- [ ] **8.5** Production checklist
  - [ ] Rate limiting on `/api/chat` (express-rate-limit, 60 req/min per IP)
  - [ ] Input validation: max message length, sanitization
  - [ ] Error handling: graceful degradation when LLM provider is down
  - [ ] Health check endpoint: `/api/health` returns status of PG, Redis, LLM
  - [ ] Logging: structured JSON logs (pino)
  - [ ] CORS: lock down to your frontend domain
  - [ ] API key auth for the agent runtime (simple bearer token for now)

### Deployment Architecture (No Conflicts)
```
┌─────────────────┐     ┌──────────────────┐
│  Vercel          │────►│  Railway / Fly   │
│  (Next.js web)   │     │  (Agent Runtime) │
│  Free tier       │     │  $5-10/mo        │
└─────────────────┘     └────────┬─────────┘
                                 │
                    ┌────────────▼────────────┐
                    │                          │
              ┌─────▼──────┐          ┌───────▼──────┐
              │  Neon       │          │  Upstash     │
              │  PostgreSQL │          │  Redis       │
              │  + pgvector │          │  Serverless  │
              │  Free tier  │          │  Free tier   │
              └────────────┘          └──────────────┘
                    │
              ┌─────▼──────┐
              │  Inngest    │
              │  Cloud      │
              │  Free tier  │
              └────────────┘
```

**Why this has no infra conflicts:**
- Every service is managed/serverless — no Docker in production, no server provisioning
- Each service has a free tier for starting out
- Vercel frontend talks to Railway backend via HTTPS — simple, no VPC, no networking complexity
- Neon and Upstash have connection pooling built in — no PgBouncer to configure
- Total cost at launch: **$0-15/month**

### Deliverable
- App is live at a real URL
- Push to main → auto-deploys (frontend + backend)
- Eval suite runs in CI and blocks broken deploys
- Health check endpoint returns green
- You can demo it to anyone with a link

### Learning Resources

| Topic | Resource | Format |
|-------|----------|--------|
| **Docker multi-stage** | [Docker for TS Developers Building AI Agents](https://dev.to/raju_dandigam/docker-for-typescript-developers-building-ai-agents-in-2026-1k3l) | Article |
| **Railway deployment** | [Railway Docs](https://docs.railway.com/) | Docs |
| **Neon PostgreSQL** | [Neon Docs](https://neon.tech/docs) | Docs |
| **Upstash Redis** | [Upstash Docs](https://upstash.com/docs/redis/overall/getstarted) | Docs |
| **GitHub Actions CI** | [GitHub Actions Docs](https://docs.github.com/en/actions) | Docs |

---

## Phase 9: Polish & Ship (Week 15-16)

### Tasks

- [ ] **9.1** Dashboard UI polish
  - Clean chat interface with agent thinking indicators
  - Sidebar: connected integrations, recent conversations, memory stats
  - Settings: manage MCP connections, view cost dashboard, clear memory
  - Mobile-responsive (you know React Native — a mobile client is a future add)

- [ ] **9.2** Onboarding flow
  - First-time user: connect your first integration (guided MCP setup)
  - No auth system yet — single-user mode with API key
  - Wizard: "Connect GitHub → Connect Gmail → Ask your first question"

- [ ] **9.3** Documentation
  - README with architecture diagram, setup instructions, deployment guide
  - `ARCHITECTURE.md` explaining every design decision (why LangGraph, why pgvector, why 3-tier memory)
  - API docs for the Agent Runtime

- [ ] **9.4** Demo recording
  - Record a 3-minute demo showing: multi-agent query, memory recall, proactive alert, cost dashboard
  - This goes on your GitHub README and LinkedIn

### Deliverable
- Production-ready app with clean UI
- README that impresses a hiring manager in 30 seconds
- 3-minute demo video
- Architecture doc that shows you understand every layer

---

## Phase 10: SaaS Conversion (Week 21-25)

**Goal:** Transform the single-tenant tool into a multi-tenant SaaS that other agencies, dev teams, and startups can sign up for, connect their own tools, and pay monthly.

**Prerequisite:** Phases 0-9 are deployed and you've been dogfooding it for at least 2 weeks. You know what works, what breaks, and what users will actually need.

### System Design Concept: Multi-Tenancy Models

Before writing code, understand the three multi-tenancy architectures and why you're picking one:

```
Model A: Shared Everything (what you'll build)
┌─────────────────────────────────────────┐
│            One Database                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │Org A│ │Org B│ │Org C│ │Org D│      │
│  │data │ │data │ │data │ │data │      │
│  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘      │
│     └───────┴───────┴───────┘          │
│     All rows have org_id column         │
│     WHERE org_id = ? on every query     │
└─────────────────────────────────────────┘
Cost: $15-50/mo total. Scales to ~1000 orgs.
Complexity: Low. One deploy, one DB.
Risk: Bug in WHERE clause leaks data between orgs.
Mitigation: Row-Level Security (RLS) in PostgreSQL.

Model B: Shared App, Separate DBs
┌──────────┐ ┌──────────┐ ┌──────────┐
│  DB: Org A│ │ DB: Org B│ │ DB: Org C│
└─────┬────┘ └─────┬────┘ └─────┬────┘
      └────────────┼────────────┘
            One App Server
Cost: $15/mo per org. Scales to ~100 orgs.
Complexity: Medium. DB routing per request.

Model C: Fully Isolated (Enterprise)
┌─────────────────┐  ┌─────────────────┐
│ Full Stack: Org A│  │ Full Stack: Org B│
│ App + DB + Redis │  │ App + DB + Redis │
└─────────────────┘  └─────────────────┘
Cost: $50-100/mo per org. Unlimited scale.
Complexity: High. Kubernetes, per-tenant deploys.
```

**You're building Model A** — shared everything with `org_id` isolation + PostgreSQL RLS. It's the simplest, cheapest, and correct choice until you have 500+ paying customers. Don't over-engineer.

**Learning Resources for this concept:**
| Topic | Resource | Format |
|-------|----------|--------|
| **Multi-tenancy patterns** | [AWS SaaS Tenant Isolation](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-isolation.html) | Docs |
| **PostgreSQL RLS** | [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) | Docs |
| **SaaS architecture** | [Designing Multi-Tenant SaaS (Neon blog)](https://neon.tech/blog/multi-tenant-saas) | Article |

---

### Phase 10.1: Auth & Organization Model (Week 21, ~4 days)

**System Design Concept: Authentication Architecture**
```
User → Clerk/NextAuth → JWT with org_id claim
  │
  ▼
API Request → Middleware extracts org_id from JWT
  │
  ▼
Every DB query → WHERE org_id = $org_id (enforced by RLS)
Every Redis key → org:{org_id}:session:{id}:messages
Every MCP call → credentials loaded per-org from encrypted store
```

This is the **security boundary** of your entire SaaS. Get it wrong and Customer A sees Customer B's Slack messages. RLS is your safety net — even if application code has a bug, PostgreSQL itself blocks cross-org reads.

**Tasks:**

- [ ] **10.1.1** Integrate Clerk (or NextAuth + custom provider)
  - Sign up, login, email verification, password reset — all handled by Clerk
  - Why Clerk over NextAuth: managed infrastructure, org/team support built in, webhook events, one day to integrate vs. one week
  - Add Clerk middleware to Next.js + agent-runtime

- [ ] **10.1.2** Organization data model
  ```sql
  CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      plan VARCHAR(20) DEFAULT 'free',  -- 'free', 'pro', 'enterprise'
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE org_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,  -- Clerk user ID
      role VARCHAR(20) DEFAULT 'member',  -- 'owner', 'admin', 'member'
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(org_id, user_id)
  );

  -- Add org_id to ALL existing tables
  ALTER TABLE memories ADD COLUMN org_id UUID REFERENCES organizations(id);
  ALTER TABLE documents ADD COLUMN org_id UUID REFERENCES organizations(id);
  ALTER TABLE document_chunks ADD COLUMN org_id UUID REFERENCES organizations(id);
  ALTER TABLE conversations ADD COLUMN org_id UUID REFERENCES organizations(id);
  ALTER TABLE messages ADD COLUMN org_id UUID REFERENCES organizations(id);
  ALTER TABLE events ADD COLUMN org_id UUID REFERENCES organizations(id);
  ```

- [ ] **10.1.3** Enable PostgreSQL Row-Level Security
  ```sql
  -- Enable RLS on all tables
  ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
  -- ... for all tables

  -- Create policy: users can only see their org's data
  CREATE POLICY org_isolation ON memories
      USING (org_id = current_setting('app.current_org_id')::uuid);

  -- Set org_id on every request via middleware
  -- In your Express middleware:
  -- await db.query("SET app.current_org_id = $1", [orgId]);
  ```

- [ ] **10.1.4** Update Redis key patterns
  - Before: `session:{id}:messages`
  - After: `org:{orgId}:session:{id}:messages`
  - Update all Redis reads/writes in the memory package

**Deliverable:**
- Sign up flow works: create account → create org → land on dashboard
- Two different orgs cannot see each other's data (test this explicitly)
- Invite link: org owner can invite members via email
- RLS active on all tables — even raw SQL bypasses in code can't leak data

**Learning Resources:**
| Topic | Resource | Format |
|-------|----------|--------|
| **Clerk + Next.js** | [Clerk Docs](https://clerk.com/docs) | Docs |
| **PostgreSQL RLS** | [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security) | Docs |
| **SaaS auth patterns** | [Auth0 Multi-Tenant Architecture](https://auth0.com/docs/get-started/auth0-overview/create-tenants) | Docs |

---

### Phase 10.2: Per-Org Integration OAuth (Week 22, ~5 days)

**System Design Concept: Credential Management**
```
Current (single-tenant):
  .env → SLACK_BOT_TOKEN=xoxb-...  (one token for you)

SaaS (multi-tenant):
  User clicks "Connect Slack" → OAuth flow → token stored encrypted in DB
  Each MCP server call → load decrypted token for this org → make API call

┌──────┐    ┌──────────┐    ┌───────────────┐    ┌──────────┐
│ User │───►│ OAuth    │───►│ Token stored  │───►│ MCP uses │
│clicks│    │ redirect │    │ encrypted in  │    │ org token│
│Connect│   │ + consent│    │ credentials   │    │ per call │
└──────┘    └──────────┘    │ table (AES)   │    └──────────┘
                            └───────────────┘
```

The tricky part: each integration has a different OAuth flow. Some (Linear, PostHog) are API-key based. Some (Slack, Google, GitHub) are full OAuth 2.0 with refresh tokens.

**Tasks:**

- [ ] **10.2.1** Encrypted credentials store
  ```sql
  CREATE TABLE integration_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL,  -- 'slack', 'github', 'gmail', etc.
      credentials_encrypted BYTEA NOT NULL,  -- AES-256-GCM encrypted
      metadata JSONB DEFAULT '{}',  -- non-sensitive: workspace name, connected user, etc.
      connected_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(org_id, provider)
  );
  ```
  - Encrypt with AES-256-GCM using an encryption key from env vars
  - Never log or expose decrypted credentials

- [ ] **10.2.2** OAuth flows per integration
  | Integration | Auth Type | Flow |
  |------------|-----------|------|
  | **Slack** | OAuth 2.0 | `/connect/slack` → Slack OAuth consent → callback stores bot token |
  | **GitHub** | OAuth 2.0 | `/connect/github` → GitHub OAuth → stores access token |
  | **Gmail + Calendar** | Google OAuth 2.0 | `/connect/google` → Google consent (both scopes) → stores refresh token |
  | **Linear** | API Key | Settings page: paste API key → stored encrypted |
  | **Sentry** | Auth Token | Settings page: paste auth token → stored encrypted |
  | **PostHog** | API Key | Settings page: paste API key → stored encrypted |

- [ ] **10.2.3** Update MCP servers to load credentials per-request
  - Before: `const token = process.env.SLACK_BOT_TOKEN`
  - After: `const token = await getDecryptedCredential(orgId, 'slack')`
  - Each MCP server receives `orgId` in the tool call context
  - Credential is decrypted in memory, used for the API call, never persisted in plaintext

- [ ] **10.2.4** Integration management UI
  - Settings page showing: connected integrations (green), available integrations (grey)
  - "Connect" button per integration → triggers OAuth flow or shows API key input
  - "Disconnect" button → deletes encrypted credentials + clears related memories

**Deliverable:**
- User clicks "Connect Slack" → Slack OAuth flow → token stored encrypted → Slack MCP works for that org
- Two orgs connect different Slack workspaces → each sees only their own messages
- Disconnect flow removes credentials and related cached data

**Learning Resources:**
| Topic | Resource | Format |
|-------|----------|--------|
| **Slack OAuth** | [Slack OAuth V2 Guide](https://api.slack.com/authentication/oauth-v2) | Docs |
| **GitHub OAuth** | [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps) | Docs |
| **Google OAuth** | [Google OAuth 2.0 for Web](https://developers.google.com/identity/protocols/oauth2/web-server) | Docs |
| **Encryption in Node.js** | [Node.js crypto.createCipheriv](https://nodejs.org/api/crypto.html) | Docs |

---

### Phase 10.3: Billing with Stripe (Week 23, ~3 days)

**System Design Concept: Usage-Based Billing**
```
Free Tier:     50 queries/day, 2 integrations, no RAG
Pro ($29/mo):  500 queries/day, all integrations, RAG, priority models
Team ($79/mo): Unlimited queries, 10 seats, shared memory, API access
Enterprise:    Custom pricing, SSO, dedicated support
```

Billing architecture:
```
User sends query → Middleware checks:
  1. Is this org on a paid plan? If not, check daily quota
  2. Has org exceeded daily limit? If yes, return 429
  3. Process query → log usage in DB
  4. End of month: Stripe auto-charges based on plan
```

**Tasks:**

- [ ] **10.3.1** Stripe integration
  - Create Stripe products + prices for each tier
  - Checkout flow: user clicks "Upgrade" → Stripe Checkout → webhook confirms payment → update org plan
  - Customer portal: manage subscription, update payment method, view invoices
  - You already know Stripe from Cruvo — this is familiar territory

- [ ] **10.3.2** Usage tracking & quotas
  ```sql
  CREATE TABLE usage_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES organizations(id),
      query_count INTEGER DEFAULT 0,
      tokens_used INTEGER DEFAULT 0,
      llm_cost_cents INTEGER DEFAULT 0,
      date DATE DEFAULT CURRENT_DATE,
      UNIQUE(org_id, date)
  );
  ```
  - Increment on every agent query
  - Check before processing: `if (todayUsage >= planLimit) return 429`

- [ ] **10.3.3** Plan-gated features
  - Free: basic agents, 2 MCP integrations, no RAG, Haiku only
  - Pro: all agents, all integrations, RAG, Sonnet + Haiku
  - Team: everything + Opus access, API keys, shared workspaces
  - Feature check middleware: `requirePlan('pro')` before RAG endpoints

**Deliverable:**
- Free users hit a daily query limit and see an upgrade prompt
- Pro upgrade flow works: click → Stripe Checkout → paid → features unlocked
- Usage dashboard shows: queries today, tokens used, cost, plan limits
- Stripe webhook handles: subscription created, updated, cancelled, payment failed

**Learning Resources:**
| Topic | Resource | Format |
|-------|----------|--------|
| **Stripe Subscriptions** | [Stripe Billing Quickstart](https://docs.stripe.com/billing/quickstart) | Docs |
| **Stripe Webhooks** | [Stripe Webhook Events](https://docs.stripe.com/webhooks) | Docs |
| **Usage-based billing** | [Stripe Metered Billing](https://docs.stripe.com/billing/subscriptions/usage-based) | Docs |

---

### Phase 10.4: Onboarding, Landing Page & Launch (Week 24-25, ~5 days)

**Tasks:**

- [ ] **10.4.1** Public landing page
  - Hero: what Hermes AI does in one sentence
  - Demo video (from Phase 9)
  - Pricing table
  - "Get Started Free" CTA

- [ ] **10.4.2** Onboarding wizard
  ```
  Step 1: Create org (name + slug)
  Step 2: Connect your first integration (Slack recommended — most visual)
  Step 3: Ask your first question → agent responds → "magic moment"
  Step 4: Connect more integrations (optional)
  ```

- [ ] **10.4.3** Self-serve setup
  - New user should go from signup to first agent response in under 3 minutes
  - No manual setup, no "contact us to get started"

- [ ] **10.4.4** Production hardening for multi-tenant
  - [ ] Org-scoped rate limiting (not just IP-based)
  - [ ] Per-org LLM cost caps (prevent one org from burning $1000/day)
  - [ ] Audit log: who did what, when (for enterprise compliance later)
  - [ ] Error boundaries: one org's MCP failure doesn't crash other orgs

**Deliverable:**
- Public URL where anyone can sign up, connect Slack, and chat with the agent
- Free tier works without payment
- Upgrade flow works end-to-end
- Three test orgs running simultaneously with full data isolation

---

### Phase 10 Complete: SaaS Architecture

```
┌───────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                   │
│  Landing Page │ Auth (Clerk) │ Dashboard │ Settings    │
└───────────────────────┬───────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼───────────────────────────────┐
│              Railway (Agent Runtime)                    │
│  ┌─────────────────────────────────────┐              │
│  │  Middleware: Auth → Org → RLS       │              │
│  │  Rate Limit → Usage Track → Billing │              │
│  └────────────────┬────────────────────┘              │
│                   │                                    │
│  ┌────────────────▼────────────────────┐              │
│  │  LangGraph Orchestrator (per-org)   │              │
│  │  Loads org credentials → MCP calls  │              │
│  └─────────────────────────────────────┘              │
└───────────────────────┬───────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
  ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
  │  Neon PG   │ │  Upstash   │ │  Stripe    │
  │  + pgvector│ │  Redis     │ │  Billing   │
  │  + RLS     │ │  (org-key) │ │            │
  └────────────┘ └────────────┘ └────────────┘
```

**Monthly cost at 50 paying customers:**
- Neon Pro: ~$19/mo
- Upstash Pro: ~$10/mo
- Railway: ~$20/mo
- Vercel Pro: ~$20/mo
- Clerk Pro: ~$25/mo
- Stripe fees: 2.9% + $0.30 per transaction
- **Total infra: ~$95/mo**
- **Revenue at 50 Pro customers: $1,450/mo**

---

## Engineering Concepts Map: What You Learn at Each Phase

Every phase teaches both *AI-specific* and *general systems engineering* concepts. Here's the full map so you know what you're learning as you build:

| Phase | AI / ML Concepts | Systems / Infra Concepts |
|-------|-----------------|--------------------------|
| **0** | Embeddings, vector similarity, agent graphs, MCP protocol | Monorepos, Docker Compose, CI/CD, TypeScript project references, Zod validation |
| **1** | LLM tool calling, agent state machines, streaming responses, prompt engineering | Client-server architecture, SSE (Server-Sent Events), REST API design, Express middleware |
| **2** | Memory extraction via LLM, semantic similarity, context window management, token budgeting | Redis data structures (strings, lists, TTL), PostgreSQL indexing (HNSW), async job processing (Inngest), cache invalidation strategies |
| **3** | Multi-agent orchestration, supervisor pattern, agent routing, LLM-based classification, human-in-the-loop | API integration patterns (REST, GraphQL, OAuth, webhooks), service decoupling via MCP, error propagation in distributed calls, confirmation UX patterns |
| **4** | RAG pipeline, document chunking strategies, hybrid retrieval (semantic + keyword), Reciprocal Rank Fusion, embedding models | Full-text search (tsvector), async pipeline processing, file upload handling (S3 presigned URLs), batch processing |
| **5** | LLM-as-judge evaluation, RAGAS metrics (faithfulness, relevancy, precision, recall), golden datasets | Python tooling, CI gates (block deploys on quality regression), automated testing at the system level, GitHub Actions |
| **6** | Semantic caching, model routing (cost vs. quality tradeoff), LLM observability, prompt versioning | Distributed tracing, cost accounting, cache hit rate optimization, alerting thresholds |
| **7** | Proactive agents (event-triggered), agent autonomy levels, cross-agent correlation | Event streaming (Redis Streams / consumer groups), pub/sub patterns, WebSockets, event sourcing, replay & debugging |
| **8** | Production LLM failure modes, graceful degradation (fallback models), health checks for AI services | Docker multi-stage builds, managed infrastructure (Neon, Upstash, Railway), deploy pipelines, structured logging (Pino), rate limiting |
| **9** | AI UX patterns (thinking indicators, tool call transparency, confidence display) | Product polish, documentation as engineering, demo as communication |
| **10** | Per-tenant model routing, usage-based LLM cost allocation, org-scoped memory isolation | Multi-tenancy (shared DB + RLS), OAuth 2.0 flows, encrypted credential storage (AES-256-GCM), Stripe billing, onboarding funnels |

### Recommended Reading Per Engineering Discipline

**System Design (read throughout the project):**
| Resource | When to Read | Format |
|----------|-------------|--------|
| [Designing Data-Intensive Applications (Martin Kleppmann)](https://dataintensive.net/) | Phase 0-2. The bible. Covers: replication, partitioning, stream processing, batch processing. | Book |
| [System Design Primer (GitHub)](https://github.com/donnemartin/system-design-primer) | Phase 0. Quick reference for: load balancing, caching, databases, async. | GitHub |
| [Martin Fowler: Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) | Phase 7. Before building event streaming. | Article |
| [AWS Well-Architected SaaS Lens](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/saas-lens.html) | Phase 10. Before SaaS conversion. | Docs |

**AI Systems Engineering (read at the relevant phase):**
| Resource | When to Read | Format |
|----------|-------------|--------|
| [Chip Huyen: Designing ML Systems](https://www.oreilly.com/library/view/designing-machine-learning/9781098107956/) | Phase 0-1. Covers: data engineering, feature stores, model serving, monitoring. | Book |
| [Eugene Yan: Patterns for Building LLM Systems](https://eugeneyan.com/writing/llm-patterns/) | Phase 1-3. Practical patterns from production. | Article |
| [Anthropic: Building Effective Agents](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-for-agents) | Phase 1-3. Prompt engineering for agents. | Docs |
| [Hamel Husain: Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) | Phase 5. Why evals matter, how to build them. | Article |
| [Eugene Yan: LLM Evaluators](https://eugeneyan.com/writing/llm-evaluators/) | Phase 5. LLM-as-judge patterns. | Article |
| [Simon Willison: Prompt Injection](https://simonwillison.net/series/prompt-injection/) | Phase 3 + 10. Security for LLM apps. | Blog series |

**Infrastructure & DevOps (read as needed):**
| Resource | When to Read | Format |
|----------|-------------|--------|
| [Docker for TS Developers Building AI Agents](https://dev.to/raju_dandigam/docker-for-typescript-developers-building-ai-agents-in-2026-1k3l) | Phase 0, 8. | Article |
| [Railway Docs](https://docs.railway.com/) | Phase 8. | Docs |
| [Neon: Multi-Tenant SaaS](https://neon.tech/blog/multi-tenant-saas) | Phase 10. | Article |
| [Stripe Billing Quickstart](https://docs.stripe.com/billing/quickstart) | Phase 10. | Docs |

---

## Post-Deployment: Feature Backlog (Ranked by Resume Impact)

These are features you can add after the core is shipped. Each one teaches a new production AI skill and adds a bullet to your resume.

### Tier 1: High Resume Impact, Directly Hireable

| Feature | What It Demonstrates | Complexity |
|---------|---------------------|------------|
| **Multi-tenant isolation** | Production SaaS architecture — separate data per org | Medium |
| **Streaming tool calls** | Agent shows its reasoning as it works (thinking → tools → answer) | Medium |
| **Agent-to-agent delegation** | Hierarchical multi-agent where agents spawn sub-agents | High |
| **Guardrails / prompt injection defense** | Input/output validators, jailbreak detection, PII redaction | Medium |
| **Fine-tuned embedding model** | Train a custom embedding on your domain data — ML engineering signal | High |
| **A/B testing for prompts** | Compare prompt versions with statistical significance | Medium |

### Tier 2: Product Value, Good Learning

| Feature | What It Demonstrates | Complexity |
|---------|---------------------|------------|
| **Scheduled agents** (cron) | "Every Monday morning, summarize last week's activity" | Low |
| **Voice interface** (Whisper + TTS) | Multi-modal AI, real-time audio streaming | Medium |
| **Collaborative agents** | Multiple users in one workspace, shared memory | Medium |
| **Custom MCP server builder** | UI to create MCP servers without code (connect any API) | High |
| **Webhook ingestion** | Accept webhooks from any service, route to relevant agent | Low |
| **Knowledge graph** (Neo4j) | Entity-relationship memory beyond flat vectors | High |

### Tier 3: Advanced / Research-Grade

| Feature | What It Demonstrates | Complexity |
|---------|---------------------|------------|
| **Self-improving agents** | Agent analyzes its own eval failures and adjusts behavior | Very High |
| **Federated memory** | Memory shared across multiple Hermes AI instances | Very High |
| **Agent marketplace** | Users can publish/share custom agents | High |
| **Reinforcement learning from feedback** | Use thumbs up/down to improve agent responses over time | Very High |
| **Multi-modal RAG** | Ingest and search images, diagrams, charts alongside text | High |
| **Offline/edge agents** | Run smaller models locally when cloud is unavailable | High |

---

## Verification & Testing Strategy

### How to Test Each Phase

| Phase | Verification |
|-------|-------------|
| Phase 0 | `docker compose up` → all services healthy, Next.js loads |
| Phase 1 | Chat UI → ask "list my tables" → agent queries PG via MCP → correct answer streams back |
| Phase 2 | Have 3 conversations → close browser → reopen → ask "what did we discuss?" → accurate recall |
| Phase 3 | Ask "summarize my PRs and draft a Slack message" → Planner → Code Agent → Comms Agent → confirmation UI |
| Phase 4 | Upload PDF → ask question about its content → cited answer with correct source |
| Phase 5 | Run `python eval/run.py` → report shows >85% accuracy across all categories |
| Phase 6 | Check Braintrust dashboard → all traces visible. Check cost dashboard → semantic cache hit rate >30% |
| Phase 7 | Push a GitHub commit → notification appears in dashboard within 10 seconds |
| Phase 8 | Visit production URL → full functionality works. Push to main → auto-deploys. Health check green |
| Phase 9 | Share URL with a friend → they can connect GitHub and ask questions without your help |
| Phase 10 | Two different orgs sign up → connect different Slack workspaces → neither can see the other's data. Stripe checkout works. Free tier enforces limits. |

### Continuous Verification
- **Every PR**: GitHub Action runs eval suite, blocks merge below threshold
- **Every deploy**: Health check + smoke test (1 query per agent type)
- **Weekly**: Review Braintrust traces for quality degradation, review cost trends

---

## The Resume Bullet This Becomes

```
Hermes AI — AI Operations Platform
TypeScript, LangGraph.js, MCP, PostgreSQL/pgvector, Redis, Python

- Architected a multi-agent AI platform with 5 specialist agents 
  coordinated via LangGraph.js state machines, connecting 8 data 
  sources through custom MCP servers (GitHub, Slack, Linear, Sentry, 
  PostHog, Gmail, Calendar, PostgreSQL)

- Designed a 3-tier memory system (Redis session / PostgreSQL facts / 
  pgvector semantic) with a priority-based context packing algorithm, 
  achieving 91% recall accuracy on a 200-question eval benchmark

- Built a hybrid RAG pipeline (semantic + keyword search with 
  Reciprocal Rank Fusion) for document Q&A with citation, processing 
  PDFs, markdown, and web pages through async ingestion via Inngest

- Implemented semantic caching and model routing that reduced LLM 
  costs by 45% while maintaining answer quality above 85% threshold, 
  with full observability via Braintrust tracing

- Built automated eval suite (Python/RAGAS) running in CI — blocking 
  deploys below quality thresholds and tracking accuracy, latency, 
  and cost metrics over time

- Converted to multi-tenant SaaS with PostgreSQL RLS, per-org 
  encrypted credential storage, OAuth integration flows, and 
  Stripe usage-based billing — serving multiple paying orgs 
  on shared infrastructure at $95/mo infra cost
```
