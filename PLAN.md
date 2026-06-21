# Hermes Action OS - Canonical Product And Implementation Plan

**Version:** v1.1 rapid prototype plan  
**Updated:** 2026-05-17  
**Product direction:** Action OS first, Company Brain second, chat as supporting interface  
**External positioning:** AI Chief of Staff for follow-ups, meeting prep, approvals, and operational memory  
**Internal architecture name:** Hermes Action OS  
**Prototype target:** 1-3 founder/operator users that use Gmail, Google Calendar, Slack, GitHub, and Linear  

This file is the single source of truth for what Hermes is building and how it should be built. Older chat-first plans are superseded.

---

## 1. Product Thesis

Hermes is being repositioned from a multi-agent chatbot into a proactive Action OS.

The product should not primarily wait for users to ask questions. Hermes should connect to approved tools, observe activity, detect what needs attention, create action items, prepare drafts, request approval, execute approved actions, track outcomes, and maintain a source-backed operational memory.

```text
Old Hermes:
User asks -> agent routes -> tools are called -> answer is generated.

New Hermes:
Company events happen -> Hermes detects signal -> prepares action -> user approves -> Hermes executes -> outcome is audited and remembered.
```

Core operating loop:

```text
Connect tools
-> Observe events
-> Store source objects
-> Normalize context
-> Detect signals
-> Create action items
-> Prioritize
-> Draft next step
-> Request approval
-> Execute
-> Track result
-> Store memory
-> Improve future decisions
```

Product rule:

```text
No source, no action card.
No approval, no external execution.
No hidden sync failure.
```

---

## 2. Current Repo Status

The existing codebase is a useful foundation, but it is not yet the Action OS.

Implemented now:

- Monorepo with `apps/web`, `apps/agent-runtime`, `packages/shared`, `packages/memory`, and MCP servers.
- Next.js chat UI at the root page.
- Express agent runtime with `/api/chat`, `/api/chat/resume`, `/api/conversations`, and `/api/health`.
- LangGraph supervisor/specialist flow:
  - Herald planner
  - Iris for Gmail/Slack
  - Talos for GitHub/Linear
  - Argus for Sentry
- Human approval gate for selected write tools inside the chat flow.
- Saved chat sessions through `ConversationStore`.
- Memory package with:
  - Redis hot cache for recent conversation messages
  - Postgres conversation/message persistence
  - `FactMemory`
  - pgvector semantic retrieval with keyword fallback
  - memory extraction from chat
  - context packer
- Action OS Phase A foundation:
  - workspace shim
  - Action OS tables
  - source objects and sync runs
  - integration accounts, credentials, and scopes
  - audit logs
  - failure events
  - job runs
  - action API routes
  - trust API routes
  - shared schemas, constants, and helpers
- MCP tools exist for Gmail, Slack, GitHub, Linear, and Sentry.
- Calendar MCP server exists but is a stub.
- Type checks currently pass for:
  - `@hermes/memory`
  - `@hermes/agent-runtime`
  - `@hermes/web`

Not implemented yet:

- Real OAuth connection UI.
- Lightweight connector watches.
- Background worker system. Deferred until Scaling It Up.
- Signals.
- Action Board UI.
- DB-backed approvals/executions.
- Morning briefing.
- Meeting prep.
- Trust Center UI.
- Source-backed operational memory hardening.
- Temporal graph.
- Calendar integration.

Current database stage:

- Phase A Action OS schema is applied through Prisma migrations.
- pgvector is installed.
- HNSW vector indexes are not present yet.
- Default local workspace exists for prototype use.

---

## 3. Product Scope

### P0 Rapid Prototype Products

These are not optional for the prototype.

| Product | Requirement |
|---|---|
| Gmail connection | OAuth, sync, source storage, draft/send after approval |
| Google Calendar connection | OAuth, sync, meeting prep, create event after approval |
| Slack connection | OAuth, selected channel sync, draft/post after approval |
| Morning Briefing | Generated from source objects, signals, actions, meetings, and freshness |
| Action Board | Main product surface for source-backed actions and approvals |
| Meeting Prep | Prepare each meeting from calendar, Gmail, Slack, memory, GitHub/Linear where relevant |
| Draft Email | Editable draft, approval required before send |
| Draft Slack Message | Editable draft, approval required before post |
| Approval Engine | DB-backed approve/edit/reject/snooze/delegate state machine |
| Execution Engine | Provider writes only after approval |
| Audit Log | Complete trace of syncs, signals, actions, approvals, executions, failures, memory |
| Integration Health | Visible freshness, scopes, failures, retries |
| Trust Center | User-facing trust, permissions, health, memory, executions, audit |

Prototype constraint:

```text
Max users: 1-3.
Primary goal: demo the product loop, not scale the infrastructure.
Connector strategy: lightweight sync/watch paths that detect new provider activity and create source-backed Action Board cards.
Queue strategy: no BullMQ in the rapid prototype unless a specific connector becomes unreliable without it.
```

### P0.5 Prototype Enhancers

These should be included for strong founder/CTO demos, but P0 should not block on write support.

| Product | Requirement |
|---|---|
| GitHub read integration | Repos, PRs, issues, commits, release/blocker signals |
| Linear read integration | Projects, issues, blocked/stale/due signals |

### P1 And Later

- GitHub/Linear write actions.
- Full "why Hermes thinks this matters" panel.
- Role modes for CEO/COO/CTO/CFO/CRO.
- Weekly executive pulse.
- Decision ledger UI.
- Commitment tracker UI.
- Company timeline.
- Pilot ROI dashboard.
- Workflow templates.
- Zep/Mem0 sidecar experiments.
- Dedicated graph DB.
- Deep research agent.
- Self-improving agents.

---

## 4. Technical Architecture

### Deployment Split

```text
Vercel
  Next.js web app
  Thin API proxy routes only
  No agent logic
  No background workers

Railway
  agent-runtime API service
  lightweight prototype connector watchers
  manual sync endpoints
  LangGraph workflows
  connector services
  SSE/WebSocket updates
  MCP clients where still useful

Neon/Postgres
  source of truth
  pgvector
  action objects
  memory objects
  audit/replay/debug state

Upstash/Redis
  lightweight locks/cursors if needed
  realtime pub/sub
  session hot cache
```

### Prototype Connector Watches

Do **not** build BullMQ for the rapid prototype.

For 1-3 users, the fastest useful implementation is:

- Manual "sync now" endpoints for each connector.
- A lightweight in-process watcher in `agent-runtime` for prototype/dev.
- Optional Railway/Vercel cron hitting sync endpoints if an always-on interval is undesirable.
- Redis locks/cursors only to prevent duplicate polling when needed.
- `sync_runs`, `source_objects`, `signals`, `action_items`, `audit_logs`, and `integration_accounts` remain the product truth.

Rules:

- The watcher can be simple polling: Gmail recent threads, Calendar upcoming events, Slack selected channels, GitHub/Linear selected resources.
- Every connector pass must record `sync_runs`.
- Every user-relevant failure must be visible through Trust Center, integration health, action card, briefing coverage, or audit log.
- Every generated action must cite at least one `source_object`.
- Idempotency keys must prevent duplicate actions when the same source object is seen repeatedly.
- Avoid Inngest for the prototype because previous runtime conflicts made it a poor fit for the current deployment path.

### Post-Prototype Background Jobs

After the demo loop works, introduce BullMQ + Redis for durability and scale:

- `sync`
- `normalize`
- `signals`
- `actions`
- `briefings`
- `executions`
- `memory`

At that point:

- Add worker service deployment.
- Record queue attempts in `job_runs`.
- Add retry/backoff defaults.
- Add dead-letter/failure handling.
- Move connector watches out of the API process.

### Workspace And Auth Model

Use a workspace shim now.

```text
P0:
user_id + workspace_id
one default workspace per user

Later:
BetterAuth org plugin maps workspace/org cleanly
```

Do not keep building around `local-user` as a permanent assumption. Every new Action OS table must be workspace-scoped.

### Data Spine

```text
integration_accounts
-> sync_runs/raw_events
-> source_objects
-> normalized objects
-> signals
-> action_items/action_drafts
-> approvals
-> executions
-> audit_logs
-> memories/graph_edges
```

---

## 5. Data Model Plan

Add these table groups before building more agent behavior.

### Workspace And Identity

- `workspaces`
- `workspace_members`
- `users` or compatibility mapping to BetterAuth user IDs

### Integrations

- `integration_accounts`
- `integration_credentials`
- `integration_scopes`

Credential requirements:

- encrypted at rest
- scoped OAuth permissions
- refresh token lifecycle
- disconnect/revoke cleanup
- provider health state

Required env addition:

```text
CREDENTIAL_ENCRYPTION_KEY=
```

### Ingestion

- `sync_runs`
- `source_objects`
- `raw_events`
- `webhook_deliveries`
- `normalization_runs`

`source_objects` is mandatory. Hermes must store source data before interpretation so bad recommendations can be replayed and debugged.

### Normalized Operational Objects

- `people`
- `external_contacts`
- `tool_identities`
- `projects`
- `meetings`
- `message_threads`
- `company_objects`

P0 entity matching can be simple:

- email address
- domain
- Slack user email
- GitHub verified email when available
- explicit user correction

### Action OS Objects

- `signals`
- `action_items`
- `action_drafts`
- `approvals`
- `executions`
- `briefing_runs`
- `briefing_items`
- `meeting_briefs`
- `audit_logs`

### Memory And Graph

- upgrade `memories`
- `memory_sources`
- `graph_nodes`
- `graph_edges`
- `memory_conflicts`
- `memory_corrections`

Every memory should support:

- `workspace_id`
- `user_id`
- `memory_type`
- `content`
- `confidence`
- `status`
- `valid_from`
- `valid_until`
- `last_confirmed_at`
- `created_by`
- `access_scope`
- source references through `memory_sources`

### Observability

- `job_runs`
- `llm_traces`
- `model_usage`
- `failure_events`
- `user_feedback`

---

## 6. API And UI Plan

### App Routes

```text
/dashboard
/actions
/briefings
/meetings
/trust
/connections
/memory
/ask
```

Root route should land on the dashboard, not chat.

### Agent Runtime APIs

Add these APIs in the Railway agent runtime and proxy them from Next.js.

```text
GET  /api/actions
POST /api/actions
GET  /api/actions/:id
POST /api/actions/:id/approve
POST /api/actions/:id/reject
POST /api/actions/:id/snooze
POST /api/actions/:id/delegate

GET  /api/briefings/latest
POST /api/briefings/generate

GET  /api/meetings
GET  /api/meetings/:id
POST /api/meetings/:id/prepare

GET  /api/trust/integrations
GET  /api/trust/audit
GET  /api/trust/failures
GET  /api/trust/memories

GET  /api/connections
POST /api/connections/:provider/start
GET  /api/connections/:provider/callback
POST /api/connections/:provider/disconnect

POST /api/sync/:provider
GET  /api/jobs/:id

POST /api/memory/:id/confirm
POST /api/memory/:id/reject
POST /api/memory/:id/correct
```

### Action Card Requirements

Every action card must include:

- title
- action type
- impact level
- risk level
- reason
- source evidence
- source freshness
- draft payload if applicable
- approval controls
- execution status
- audit timeline
- feedback controls: useful, wrong, duplicate, stale, unsafe

---

## 7. Memory Architecture

The Company Brain is not a vector database. It is source-backed operational memory.

### Layers

| Layer | Storage | Purpose |
|---|---|---|
| Working/session memory | Redis + Postgres conversations | Ask Hermes continuity |
| Raw source memory | Postgres `source_objects` | Emails, Slack messages, calendar events, PRs, issues |
| Operational objects | Postgres | Actions, approvals, executions, meetings, decisions |
| Semantic retrieval | pgvector | Relevant source/memory search |
| Temporal graph | Postgres `graph_edges` | Relationships over time |
| User preferences | Postgres memories | Briefing preferences, tone, approval rules |

### Extraction Policy

Do not extract memory from everything.

Extract only:

- explicit decisions
- commitments
- ownership statements
- durable preferences
- recurring workflows
- project/customer context
- action outcomes

States:

```text
candidate
confirmed
rejected
expired
conflicted
superseded
deleted
```

Rules:

- Explicit user memory commands can create confirmed memories.
- Inferred memories start as candidates.
- Memories inherit strictest source permissions.
- Contradictions create `memory_conflicts`.
- Stale memories must not be used confidently.
- Context builder must include source links and freshness.

### Graph Foundation

Start with Postgres tables, not a separate graph DB.

Nodes:

```text
person, team, external_contact, tool_account, project, meeting,
email_thread, slack_thread, github_pr, github_issue, linear_issue,
action_item, decision, commitment, risk, approval, execution
```

Edges:

```text
owns, attended, mentioned, blocked_by, related_to, created_from,
approved_by, executed_by, assigned_to, committed_to, decided_in,
supersedes, contradicts
```

Graph DB is later only if Postgres edge queries become a bottleneck.

---

## 8. Implementation Phases

### Phase A - Product Spine And Schema

Goal: add Action OS primitives before building more agent behavior.

Status: complete; code, database migration, and runtime smoke tests passed.

Tasks:

- [x] Add workspace shim.
- [x] Add Action OS tables.
- [x] Add source object and sync run tables.
- [x] Add audit, failure, job run, and integration health tables.
- [x] Upgrade memory tables for workspace/source/temporal behavior.
- [x] Add shared Zod schemas and constants.
- [x] Add `audit()` helper.
- [x] Add `recordFailure()` helper.
- [x] Add idempotency key helper.
- [x] Add integration health service.

Acceptance:

- [x] Existing chat still works.
- [x] Manual action can be created through API.
- [x] Trust integration endpoint returns default states.
- [x] Audit test event can be written.
- [x] Type checks pass.

### Phase B - Deferred BullMQ Worker Foundation

Goal: deferred until after the rapid prototype proves the Action Board loop.

Tasks:

- Do not build this before the Action Board and connector watches are demoable.
- Keep `job_runs` available for later worker tracking.
- Use lightweight connector watches and manual sync endpoints in the prototype.
- Revisit BullMQ after Gmail, Calendar, Slack, Action Board, and Morning Briefing are working.

Acceptance:

- Prototype is not blocked by worker infrastructure.
- The future worker migration path is documented.
- Existing `job_runs` schema remains compatible with future BullMQ adoption.

### Phase C - Action Board Skeleton

Goal: make the core product surface real before connectors are complete.

Tasks:

- Build `/actions`.
- Add action list, filters, and action detail panel.
- Add action card with source, reason, draft, approval controls, status, feedback.
- Add backend CRUD for manual/prototype actions.
- Add audit timeline for each action.

Acceptance:

- Create manual action through API.
- View it in Action Board.
- Approve/reject/snooze it.
- See state transitions in audit log.

### Phase D - Trust Center Shell

Goal: make failure visibility a first-class product surface.

Tasks:

- Build `/trust`.
- Show connected tools, scopes, health state, last sync, failures, memories, executions, approvals, audit.
- Replace/fix missing web `/api/health` proxy.
- Add dashboard warnings for stale/failed integrations.

Acceptance:

- Trust Center shows not-connected states before OAuth.
- Simulated failure appears in Trust Center and audit.

### Phase E - Real OAuth Connections

Goal: users connect Gmail, Calendar, and Slack from the app.

Tasks:

- Implement Google OAuth for Gmail and Calendar.
- Implement Slack OAuth.
- Store encrypted credentials.
- Store scopes.
- Add disconnect/revoke.
- Add channel selection for Slack.
- Add connection pages and callbacks.

Acceptance:

- User connects Gmail/Calendar/Slack from UI.
- Integration accounts show correct scopes and health.
- Disconnect marks integration inactive and prevents sync.

### Phase F - Prototype Connector Watches And Source Objects

Goal: make Hermes notice provider activity and turn it into source objects without BullMQ.

Tasks:

- Add `POST /api/connectors/:provider/sync-now`.
- Add lightweight watcher loop or cron-triggered endpoint for prototype use.
- Gmail watches recent threads.
- Calendar watches today plus upcoming 7 days.
- Slack watches selected channels and threads.
- GitHub/Linear watches selected read resources if enabled.
- Store all provider data as `source_objects`.
- Normalize basic fields.
- Record `sync_runs`.
- Record partial/failure states.
- Use idempotency keys to avoid duplicate source objects.

Acceptance:

- Gmail threads exist in `source_objects`.
- Calendar events create `meetings`.
- Slack messages/threads exist in `source_objects`.
- A new connector item can become a source-backed Action Board card.
- Failed/partial sync is visible.

### Phase G - Signal Detection And Dedupe

Goal: turn source objects into useful candidate work.

P0 detectors:

- unanswered important email
- follow-up due
- meeting prep needed
- Slack blocker
- Slack commitment candidate
- approval needed

P0.5 detectors:

- GitHub PR ready/stale
- Linear issue blocked/stale/due

Detection strategy:

```text
rules first -> cheap classifier only when ambiguous -> signal -> dedupe -> action candidate
```

Acceptance:

- Same source object processed twice does not create duplicate action.
- Duplicate suppression is audited.
- Low-confidence commitment remains candidate memory/signal.

### Phase H - Action Generation

Goal: convert signals into source-backed action cards.

Tasks:

- Rank signals by urgency, impact, deadline, meeting proximity, external relevance, confidence, risk.
- Generate action items with deterministic idempotency keys.
- Generate draft payloads for Gmail, Slack, and Calendar.
- Require source evidence for every action.
- Add user feedback capture.

Acceptance:

- Unanswered important email creates a follow-up action.
- Meeting prep signal creates a meeting prep action.
- Slack blocker creates escalation/follow-up action.

### Phase I - Approval And Execution Engine

Goal: execute safely only after user approval.

Tasks:

- DB-backed approval state machine.
- Editable final payload.
- Execution worker.
- Gmail draft/send execution.
- Slack post/DM execution.
- Calendar create/update execution.
- Retry policy.
- Audit every transition and provider response.

Safety:

- External emails require approval.
- Slack messages require approval.
- Calendar events require approval.
- GitHub/Linear writes are not P0 unless explicitly added for a pilot.

Acceptance:

- Approve email draft -> Gmail sends or saves draft -> action completed -> audit visible.
- Reject Slack draft -> no provider call -> audit visible.
- Provider failure -> action failed -> retry available.

### Phase J - Morning Briefing

Goal: generate the daily operating view without chat.

Sections:

- today's calendar
- meetings needing prep
- pending approvals
- important unanswered emails
- Slack threads needing attention
- GitHub/Linear blockers
- overdue follow-ups
- new risks
- recommended next actions
- data freshness and coverage

Acceptance:

- Manual "generate briefing now" works.
- Scheduled briefing job works.
- Briefing excludes or labels stale sources.
- Dashboard renders latest briefing.

### Phase K - Meeting Prep

Goal: prepare the user before every meaningful meeting.

Tasks:

- Build meeting list from Calendar.
- Match attendees to people/external contacts.
- Retrieve related Gmail/Slack/source objects.
- Retrieve related GitHub/Linear objects where available.
- Retrieve source-backed memories.
- Generate context, agenda, risks, and suggested follow-up actions.

Acceptance:

- Upcoming meeting has a prepare button.
- Meeting brief cites sources.
- Meeting prep can create follow-up action cards.

### Phase L - Deferred Company Brain MVP

Goal: move to **Scaling It Up** after the rapid prototype proves connector-driven actions.

Tasks:

- Keep existing basic memory working during the rapid prototype.
- Do not block connector/action/briefing work on advanced memory.
- Move operational memory, conflicts, graph edges, and source-backed memory UI to `## 14. Scaling It Up`.

Acceptance:

- Not required for rapid prototype acceptance.
- Detailed Company Brain hardening plan lives in `## 14. Scaling It Up`.

### Phase M - Ask Hermes Migration

Goal: keep chat as a command/debug interface.

Tasks:

- Move chat to `/ask`.
- Preserve existing saved sessions.
- Chat can create action items.
- Chat can query briefings/actions/memory.
- Chat can explain why an action was suggested.
- Chat can correct memory.
- Chat responses should reference objects, not just prose.

Acceptance:

- "What should I focus on today?" opens or references Action Board items.
- "Why did Hermes suggest this?" shows source/action reasoning.

### Phase N - GitHub And Linear Read Integrations

Goal: make founder/CTO demos operationally strong.

Tasks:

- Connect GitHub.
- Select repos.
- Sync PRs, issues, commits.
- Connect Linear.
- Sync teams, projects, issues.
- Detect blockers/stale/due items.
- Add GitHub/Linear to briefing and meeting prep.

Acceptance:

- Engineering/project signals appear in briefings.
- Meeting prep can cite related PRs/issues.

### Phase O - Prototype Polish And Pilot Readiness

Goal: make the product demoable and dogfoodable.

Tasks:

- Seeded demo workspace.
- Real dogfood workspace.
- Dashboard polish.
- Empty/loading/error states.
- Security/trust explanation.
- Pilot onboarding checklist.
- Investor/pilot demo script.
- Basic eval harness.

Demo script:

```text
1. Connect Gmail, Calendar, Slack.
2. Show Trust Center permissions and freshness.
3. Generate morning briefing.
4. Open Action Board.
5. Approve/edit/reject Gmail draft.
6. Approve/edit/reject Slack draft.
7. Prepare a meeting.
8. Show basic memory/context, then explain Company Brain hardening as the scaling path.
9. Show Audit Log proving what happened.
10. Show GitHub/Linear read signals if available.
```

---

## 9. Testing And Evals

### Unit Tests

- action state transitions
- approval state transitions
- execution state transitions
- idempotency key generation
- integration health calculation
- sync state mapping
- source object normalization
- memory ACL inheritance
- memory conflict/supersession
- credential encryption/decryption
- signal detector rules

### Integration Tests

- Gmail OAuth -> sync -> source object.
- Calendar OAuth -> sync -> meeting.
- Slack OAuth -> channel selection -> source object.
- Source object -> signal -> action item.
- Approval -> execution -> audit log.
- Execution failure -> visible action failure.
- Sync failure -> Trust Center warning.
- Duplicate signal -> duplicate suppressed audit event.

### E2E Scenarios

- Connect Gmail/Calendar/Slack.
- Generate morning briefing.
- Approve/edit/reject Gmail draft.
- Approve/edit/reject Slack draft.
- Prepare a meeting.
- View Trust Center freshness and failures.
- View audit log for an executed action.
- Confirm/reject/correct candidate memory after Company Brain hardening.

### Evals

Create 50 prototype evals:

- 10 morning briefing quality evals
- 10 meeting prep evals
- 10 action suggestion evals
- 10 memory extraction evals
- 10 tool execution safety evals

Metrics:

- action relevance
- source faithfulness
- duplicate rate
- missing critical item rate
- false positive rate
- draft acceptance rate
- draft edit distance
- sync freshness
- execution failure rate
- approval safety

---

## 10. Non-Goals For Prototype

Do not build these before the prototype is stable:

- fully autonomous external sending
- full no-code workflow builder
- agent marketplace
- full graph DB migration
- team morale scoring from Slack
- complex board reporting
- custom MCP builder
- self-improving agents
- multi-modal RAG
- enterprise SSO
- broad integration marketplace

---

## 11. Definition Of Done

The prototype is done when:

- Gmail, Calendar, and Slack connect through UI and sync.
- GitHub and Linear read integrations work or have a clear demo-ready path.
- Dashboard is not chat-first.
- Morning briefing generates automatically and manually.
- Action Board contains real source-backed generated actions.
- User can approve/edit/reject an email draft.
- User can approve/edit/reject a Slack draft.
- User can create/approve a Calendar event through Hermes.
- Meeting prep works for upcoming events.
- Trust Center shows connected tools, permissions, freshness, memories, executed actions, and failures.
- Audit log records every action and failure.
- Basic memory remains intact and can store explicit user facts.
- No stale or failed sync is hidden.
- Demo can be completed with realistic seeded data and at least one real connected personal workspace.
- The platform can show how a connector event becomes a source object, then a signal, then an Action Board card.
- BullMQ/background worker hardening is not required for the rapid prototype.
- Company Brain tightening is not required for the rapid prototype.

---

## 12. Future Backlog

After prototype:

- BetterAuth org plugin integration.
- BullMQ worker service and durable background infrastructure.
- Postgres RLS for multi-tenant hardening.
- GitHub/Linear write actions.
- Full "why Hermes thinks this matters" panel.
- Role-based briefing modes.
- Weekly executive pulse.
- Decision ledger.
- Commitment tracker.
- Company timeline.
- Pilot ROI dashboard.
- Semantic caching.
- Braintrust tracing.
- Zep/Mem0 sidecar spike.
- Company Brain memory hardening.
- Dedicated graph DB if Postgres graph edges become limiting.
- Deep research agent.
- Low-risk autopilot for internal reminders.

---

## 13. Execution-Ready Implementation Breakdown

This section is the step-by-step build order for the **rapid prototype**. It is intentionally **product-loop-first**, not infrastructure-first.

The goal is to make Hermes demoable for the team, investors, and brand/commercial storytelling:

```text
minimal base
-> Action Board
-> app shell + Trust/Connections shell
-> lightweight connector watches
-> Calendar/Gmail/Slack vertical slices
-> generated source-backed actions
-> approval/edit/execute loop
-> Morning Briefing
-> Meeting Prep
-> seeded demo/commercial workspace
-> GitHub/Linear read context
-> realtime polish/evals
-> post-prototype BullMQ/infrastructure
-> Company Brain hardening
```

Do not create infrastructure only because a later feature might need it. For the rapid prototype, prioritize visible product behavior over scale machinery.

Prototype-specific rules:

- Assume max 1-3 users.
- Use manual sync and lightweight polling/watchers before BullMQ.
- Store every provider item as a `source_object`.
- Every generated action must cite source evidence.
- Dedupe source objects, signals, and actions aggressively.
- Keep failures visible in Trust Center.
- Defer Company Brain tightening until connector-driven actions are working.
- Keep chat as `/ask`, not the main product surface.

Global implementation rules:

- Every new Action OS table must include `workspace_id`.
- Use a default workspace shim until BetterAuth orgs are ready.
- Postgres is the source of truth.
- Redis is for session hot cache, lightweight locks, and later realtime state.
- Every provider object must be stored as a `source_object` before signals/actions are generated.
- Every action must have source evidence.
- Every external write must go through `approval -> execution`.
- Every sync, action, approval, execution, failure, and memory mutation must write an audit event.
- Existing chat must keep working until it is intentionally moved to `/ask`.
- Delay feature-specific schema until that feature is being implemented.
- Delay graph, advanced memory conflict tables, semantic cache, model usage, and deep observability until the slice that uses them.

### Phase 0 - Baseline Lock

Goal: establish a clean implementation baseline before schema work.

Status: acceptance complete; optional future env values are deferred to the OAuth, connector watch, and worker hardening phases.

Build:

- [x] Treat `PLAN.md` as the canonical roadmap.
- [x] Keep `HERMES_ACTION_OS_PRD.md` as product background only.
- [x] Confirm package type checks for web, agent-runtime, memory, and shared.
- [x] Confirm current database connection and pgvector availability.
- [x] Confirm Redis connection.
- [x] Confirm current chat route still works before migration begins.
- [ ] Add missing `.env.example` values for the new architecture:
  - [x] `CREDENTIAL_ENCRYPTION_KEY`
  - [ ] OAuth callback base URL
  - [ ] Connector watch interval settings
  - [ ] BullMQ/worker settings later, after rapid prototype

Acceptance:

- [x] Existing app still starts.
- [x] Existing Ask/chat flow is not broken.
- [x] Type checks pass for web, agent-runtime, memory, and shared.

### Phase 1 - Minimal Product Foundation

Goal: create only the base schema and helpers required by the first product slices.

Status: complete; code, migration, and record-creation smoke tests passed.

Build:

- [x] Add workspace shim:
  - [x] `workspaces`
  - [x] `workspace_members`
  - [x] user compatibility fields for current local/default user
- [x] Add minimal action tables:
  - [x] `signals`
  - [x] `action_items`
  - [x] `action_drafts`
  - [x] `approvals`
  - [x] `executions`
  - [x] `audit_logs`
- [x] Add minimal integration tables:
  - [x] `integration_accounts`
  - [x] `integration_credentials`
  - [x] `integration_scopes`
- [x] Add minimal job/failure tables:
  - [x] `job_runs`
  - [x] `failure_events`
- [x] Add shared constants for:
  - [x] providers
  - [x] integration health states
  - [x] action states
  - [x] approval states
  - [x] execution states
  - [x] audit event types
- [x] Add workspace resolution helper.
- [x] Add scoped query helper pattern.
- [x] Add credential encryption/decryption helper.
- [x] Add `audit()` helper.
- [x] Add `recordFailure()` helper.
- [x] Add idempotency key helper.

Acceptance:

- [x] Migration applies cleanly.
- [x] Existing memory/conversation data remains readable.
- [x] A default workspace can be created or resolved for the local user.
- [x] Manual action, approval, execution, audit, and job records can be created.
- [x] Prisma client generation succeeds.
- [x] Type checks pass.

Defer:

- source objects until the first sync slice
- meetings until Calendar slice
- message threads until Gmail/Slack slices
- briefing tables until Morning Briefing slice
- memory source/graph/conflict tables until Company Brain slice
- model usage/cache tables until eval/observability slices

### Phase 2 - Action Board Vertical Slice

Goal: build the core product loop without live connectors first, so the demo has a visible product surface.

Build:

- Add runtime routes:
  - `GET /api/actions`
  - `POST /api/actions`
  - `GET /api/actions/:id`
  - `POST /api/actions/:id/approve`
  - `POST /api/actions/:id/reject`
  - `POST /api/actions/:id/snooze`
  - `POST /api/actions/:id/delegate` as a prototype state transition
- Add matching Next.js proxy routes.
- Build `/actions`.
- Build action list and detail drawer/page.
- Build editable draft preview.
- Build approval controls.
- Build status timeline.
- Build source preview placeholder.
- Build "why this action exists" source/reason panel.
- Build feedback controls:
  - useful
  - wrong
  - duplicate
  - stale
  - unsafe
- Write audit events for every state transition.
- Preserve existing `/api/chat`, `/api/chat/resume`, and `/api/conversations`.

Acceptance:

- Manual action can be created.
- Manual action appears in `/actions`.
- Manual action can be edited, approved, rejected, snoozed, and delegated.
- Every transition appears in audit log.
- Existing chat endpoints still work.

### Phase 3 - Product App Shell And Trust Center Shell

Goal: make the product navigation and trust surfaces real before live integrations.

Build:

- Create app routes:
  - `/dashboard`
  - `/actions`
  - `/briefings`
  - `/meetings`
  - `/trust`
  - `/connections`
  - `/memory`
  - `/ask`
- Make root route land on dashboard.
- Move current chat UI to `/ask`.
- Build shared app shell/navigation.
- Build dashboard empty state.
- Build Connections shell.
- Build Trust Center shell.
- Build Memory shell.
- Add loading, empty, and failure states for each route.
- Add runtime routes:
  - `GET /api/trust/integrations`
  - `GET /api/trust/audit`
  - `GET /api/trust/failures`
  - `GET /api/jobs/:id`
- Show not-connected provider cards.
- Show job/failure/audit panels.
- Show scopes/freshness placeholders.

Acceptance:

- User lands on dashboard, not chat.
- Ask Hermes remains available at `/ask`.
- Manual action appears in `/actions`.
- Trust Center shows not-connected provider cards.
- Simulated failure appears in Trust Center.

### Phase 4 - Prototype Connector Watch Foundation

Goal: make connector data enter Hermes without building durable worker infrastructure yet.

Build:

- Add connector abstraction:
  - fetch changed provider objects
  - normalize to `source_objects`
  - update cursors/freshness
  - create `sync_runs`
  - record failure events
  - write audit events
- Add manual sync endpoints:
  - `POST /api/connectors/gmail/sync-now`
  - `POST /api/connectors/calendar/sync-now`
  - `POST /api/connectors/slack/sync-now`
  - `POST /api/connectors/github/sync-now`
  - `POST /api/connectors/linear/sync-now`
- Add lightweight watcher loop:
  - disabled by default in tests
  - interval controlled by env
  - optional Redis lock to avoid duplicate polling
  - max one watcher process for prototype
- Add connector freshness to Trust Center.
- Add source object list/debug endpoint for development.

Acceptance:

- Manual sync creates or updates source objects.
- Watcher detects new provider activity and writes source objects.
- Sync failures appear in Trust/Failure data.
- Repeated sync does not duplicate source objects.
- No BullMQ dependency is required for the prototype.

Defer:

- BullMQ worker service until post-prototype hardening.
- Dedicated normalize/signals queues until connector volume justifies them.
- Webhooks unless a provider slice specifically needs them.

### Phase 5 - Connections And Provider Configuration Foundation

Goal: let prototype users configure providers from the app, while still supporting env-token fallback for fast demos.

Build:

- Add connection routes:
  - `GET /api/connections`
  - `POST /api/connections/:provider/start`
  - `GET /api/connections/:provider/callback`
  - `POST /api/connections/:provider/disconnect`
- Add prototype credential fallback:
  - read existing env credentials if no UI credential exists
  - show them as "developer configured" in Trust/Connections
  - never expose secret values in the UI
- Implement encrypted credential storage.
- Implement integration account lifecycle.
- Implement integration health updates.
- Implement OAuth state validation.
- Implement reconnect/disconnect behavior.
- Build provider cards on `/connections`.
- Build provider cards on `/trust`.

Acceptance:

- Connection start/callback lifecycle works with a mocked provider.
- Credentials are encrypted in storage.
- Env-configured provider can be represented in Connections/Trust for prototype demos.
- Disconnect disables future sync.
- Trust Center reflects connected/not-connected/failed states.

### Phase 6 - Calendar Vertical Slice

Goal: build Calendar end to end because it powers meetings, prep, and briefings.

Build:

- Implement Google OAuth scopes for Calendar.
- Add Calendar sync support through the prototype connector watcher.
- Add meeting schema now:
  - `meetings`
  - `meeting_briefs` if needed for prep output
- Fetch today plus upcoming 7 days.
- Store Calendar events as source objects.
- Normalize title, description, attendees, start/end, timezone, meeting link.
- Create/update meetings.
- Detect meeting prep needed.
- Show meetings on dashboard and `/meetings`.
- Create meeting-prep action cards.
- Add source/freshness display for Calendar.

Acceptance:

- User connects Calendar.
- Calendar sync-now and watcher create source objects.
- Upcoming events appear in `/meetings`.
- Meeting prep needed action appears in Action Board.
- Calendar failure/staleness appears in Trust Center.

### Phase 7 - Meeting Prep Vertical Slice

Goal: complete meeting prep using Calendar data first, then prepare for related sources.

Build:

- Add meeting prep endpoint/job:
  - `POST /api/meetings/:id/prepare`
- Build meeting detail page/drawer.
- Resolve attendees to people/external contacts.
- Add minimal people/contact schema if needed:
  - `people`
  - `external_contacts`
- Generate meeting context from Calendar title/description/attendees.
- Generate suggested agenda.
- Generate follow-up action candidates.
- Store meeting brief.
- Show confidence/source coverage.

Acceptance:

- User clicks Prepare on an upcoming meeting.
- Meeting brief is generated and stored.
- Meeting brief cites Calendar source.
- Suggested follow-up action can be created.

### Phase 8 - Gmail Vertical Slice

Goal: build Gmail from sync to follow-up action to approved execution.

Build:

- Add Gmail OAuth scopes.
- Reuse Google connection where possible.
- Add Gmail sync through the prototype connector watcher.
- Add message-thread schema now:
  - `message_threads`
- Fetch recent threads/messages.
- Store Gmail threads/messages as source objects.
- Normalize sender, recipients, subject, snippet/body preview, timestamps, labels, thread ID.
- Detect:
  - unanswered important email
  - follow-up due
- Generate Gmail follow-up action.
- Generate editable email draft.
- Add approval flow for Gmail action.
- Implement Gmail execution:
  - save draft
  - send email
- Audit approval and execution.

Acceptance:

- User connects Gmail.
- Gmail sync-now and watcher create source objects.
- Unanswered/follow-up signal creates Action Board card.
- Email draft is editable.
- Approve sends or saves draft.
- Reject does not call Gmail.
- Failures are visible.

### Phase 9 - Slack Vertical Slice

Goal: build Slack from selected-channel sync to approved message execution.

Build:

- Implement Slack OAuth.
- List channels.
- Add channel selection.
- Store selected channels in integration config.
- Sync selected channels and relevant threads through the prototype connector watcher.
- Store Slack messages/threads as source objects.
- Normalize channel, author, text, timestamp, thread timestamp, permalink.
- Detect:
  - Slack blocker
  - Slack commitment candidate
  - unanswered mention/request
- Generate Slack action card.
- Generate editable Slack message draft.
- Add approval flow for Slack action.
- Implement Slack execution:
  - post to channel
  - DM
  - reply to thread
- Audit approval and execution.

Acceptance:

- User connects Slack.
- User selects monitored channels.
- Slack sync-now and watcher create source objects only for selected channels.
- Blocker/follow-up signal creates Action Board card.
- Slack draft is editable.
- Approve posts message.
- Reject does not call Slack.
- Rate limits and missing channel access are visible.

### Phase 10 - Source-Backed Signal And Dedupe Hardening

Goal: harden signal creation across Calendar, Gmail, and Slack.

Build:

- Consolidate signal detector interfaces.
- Add deterministic idempotency keys.
- Add duplicate suppression audit events.
- Add confidence scoring.
- Add source evidence validation.
- Add signal debug/internal view if useful.
- Ensure low-confidence commitments become candidates, not confirmed memory.
- Add tests for duplicate and false-positive cases.

Acceptance:

- Same source object does not create duplicate action.
- Duplicate suppression is audited.
- Every action references at least one source object.
- Low-confidence commitments are reviewable.

### Phase 11 - Morning Briefing Vertical Slice

Goal: create the daily operating view from Calendar, Gmail, Slack, actions, and health.

Build:

- Add briefing schema now:
  - `briefing_runs`
  - `briefing_items`
- Add manual generate endpoint:
  - `POST /api/briefings/generate`
- Add latest briefing endpoint:
  - `GET /api/briefings/latest`
- Build `/briefings`.
- Add briefing section to dashboard.
- Generate sections:
  - today's calendar
  - meetings needing prep
  - pending approvals
  - important unanswered emails
  - Slack blockers/mentions
  - overdue follow-ups
  - new risks
  - recommended next actions
  - integration freshness
- Add scheduled briefing job.
- For prototype, scheduled generation can be a lightweight timer or cron-triggered endpoint.
- Label stale/missing sources.

Acceptance:

- Briefing can be generated manually.
- Briefing can be generated on schedule or via prototype cron/timer.
- Dashboard shows latest briefing.
- Stale/failed integration is shown in briefing coverage.

### Phase 12 - Seeded Demo Workspace And Commercial Demo Mode

Goal: make the prototype demoable even before every live connector path is perfect.

Build:

- Add seed script for a realistic personal workspace.
- Seed:
  - connected provider states
  - source objects
  - signals
  - generated Action Board cards
  - approvals
  - executions
  - briefing
  - meeting briefs
  - basic memories
  - audit logs
- Add reset script for repeatable demos.
- Add "demo mode" UI affordance only if needed:
  - clear seeded-data label
  - reset demo workspace button for local/dev
  - realistic freshness/failure states
- Create a short demo script:
  - new Gmail item appears
  - Hermes creates source object
  - signal becomes Action Board card
  - user approves draft
  - audit/Trust Center show what happened

Acceptance:

- Fresh clone can seed a demo workspace.
- Demo script can run without real OAuth credentials.
- Seeded data looks realistic and source-backed.
- Demo can explain the product loop in under 3 minutes.

### Phase 13 - Ask Hermes Migration

Goal: make chat a command/debug interface for Action OS objects.

Build:

- Move chat to `/ask`.
- Preserve saved sessions.
- Update planner prompt to reference actions, briefings, source objects, memory, and approvals.
- Add chat capabilities:
  - create action item
  - search actions
  - search briefings
  - search memories
  - explain action reasoning
  - correct memory
- Keep provider writes approval-gated through the same approval engine.
- Chat responses should create/reference objects.

Acceptance:

- "What should I focus on today?" references briefing/actions.
- "Create a follow-up for this" creates an action card.
- "Why did Hermes suggest this?" shows source-backed reasoning.
- Chat no longer behaves as the main product surface.

### Phase 14 - GitHub Read Vertical Slice

Goal: add engineering context for founder/CTO demos.

Build:

- Connect GitHub.
- Let user select repos.
- Sync:
  - PRs
  - issues
  - commits
- Store as source objects.
- Detect:
  - PR ready for review
  - stale PR
  - release blocker
  - merged PR since last briefing
- Add GitHub signals to briefing, meeting prep, and Action Board.

Acceptance:

- Selected repos sync.
- GitHub source objects exist.
- PR/release signals appear in briefing and actions.
- Meeting prep can cite related PRs.

### Phase 15 - Linear Read Vertical Slice

Goal: add project/task context.

Build:

- Connect Linear.
- Sync:
  - teams
  - projects
  - issues
  - cycles if useful
- Store as source objects.
- Detect:
  - blocked issue
  - stale issue
  - due issue
  - issue related to meeting/project
- Add Linear signals to briefing, meeting prep, and Action Board.

Acceptance:

- Linear projects/issues sync.
- Blocked/stale/due signals appear.
- Meeting prep can cite related Linear issues.

### Phase 16 - Realtime UI Updates

Goal: make the product feel alive without hiding freshness.

Build:

- Add SSE or WebSocket channel from runtime to web.
- Publish updates for:
  - sync started/completed/failed
  - action created/updated
  - approval updated
  - execution completed/failed
  - briefing generated
  - meeting brief generated
- Keep polling fallback.
- Show freshness timestamps in UI.

Acceptance:

- New action appears without full page refresh.
- Failed sync appears without refresh.
- Realtime outage falls back to polling.

### Phase 17 - Prototype Freeze And Demo Rehearsal

Goal: freeze the rapid prototype into a reliable story for team review, investor demos, and brand/commercial capture.

Build:

- Lock the primary demo route:
  - dashboard
  - Action Board
  - connector freshness
  - generated action
  - approval/edit
  - execution/audit
  - briefing/meeting prep
- Create a short scripted demo path.
- Create a fallback seeded-data path if live providers fail.
- Add demo reset command.
- Fix visible UX rough edges.
- Verify all demo-critical states have loading/empty/error UI.

Acceptance:

- Demo works with live connector data.
- Demo also works with seeded fallback data.
- No demo-critical flow depends on hidden backend logs.
- A viewer can understand "connector event -> action card -> approval -> audited result" quickly.

### Phase 18 - Evaluation Harness

Goal: measure product quality before pilots.

Build eval sets:

- 10 morning briefing cases
- 10 meeting prep cases
- 10 action suggestion cases
- 10 memory extraction cases
- 10 execution safety cases

Track:

- action relevance
- source faithfulness
- duplicate rate
- false positive rate
- missed critical item rate
- draft edit distance
- approval safety
- execution failure rate

Acceptance:

- Eval runner produces a report.
- Failing examples are easy to inspect.
- Baseline scores are recorded before pilots.

### Phase 19 - Pilot Readiness Hardening

Goal: prepare for dogfood and first pilots.

Build:

- Review all failure states.
- Add user-facing copy for stale/partial/failed data.
- Add onboarding checklist.
- Add permissions/trust explanation.
- Add basic rate limit handling.
- Add cost/model usage tracking only if needed for pilot control.
- Add backup/retry plan for provider failures.
- Run full E2E test script.

Acceptance:

- Demo script works end to end.
- No P0 product depends on hidden backend logs.
- A pilot user can understand what Hermes used, what it did, what failed, and what needs approval.

---

## 14. Scaling It Up

This section contains the work intentionally deferred out of the rapid prototype. Build these after the prototype proves the product loop with 1-3 users.

### Durable Background Infrastructure

Goal: move from lightweight prototype watchers to reliable multi-user background processing.

Build:

- Add BullMQ dependency and shared queue factory.
- Add Railway worker service entrypoint.
- Add queues:
  - `sync`
  - `normalize`
  - `signals`
  - `actions`
  - `briefings`
  - `executions`
  - `memory`
- Move connector watches out of the API process.
- Record every queue attempt in `job_runs`.
- Add retry/backoff defaults.
- Add dead-letter/failure handling.
- Add manual job trigger endpoint for debugging.
- Add worker health records and dashboards.
- Make failed jobs visible in Trust Center.

Acceptance:

- API and worker processes run independently.
- Connector sync continues after API restarts.
- Failed jobs are visible and retryable.
- Queue state is operational only; Postgres remains product truth.

### Company Brain Hardening

Goal: turn basic memory into source-backed operational memory after real actions and source objects exist.

Build:

- Upgrade memory schema:
  - source/ACL fields
  - candidate/confirmed/rejected/expired/conflicted/superseded/deleted states
  - `memory_sources`
  - `memory_conflicts`
- Extract candidate memories from:
  - decisions
  - commitments
  - ownership
  - preferences
  - recurring workflows
  - project/customer context
  - action outcomes
- Link memories to source objects and audit logs.
- Add confirm/reject/correct UI.
- Add memory section in Trust Center.
- Add memory retrieval to context builder.
- Add temporal validity and conflict resolution.
- Add graph foundation only if product failures justify it:
  - `graph_nodes`
  - `graph_edges`

Acceptance:

- Source-backed memory can be created from action outcomes.
- Candidate memory can be confirmed/rejected/corrected.
- Contradictory memory creates a visible conflict.
- Memory retrieval respects workspace/user scope.
- Private source permissions are preserved.

### Multi-User And Org Hardening

Goal: safely support team workspaces after the personal prototype.

Build:

- Integrate BetterAuth org plugin.
- Map users/orgs to workspaces.
- Add workspace membership roles.
- Add Postgres RLS or equivalent scoped-query enforcement.
- Add provider account ownership and permission boundaries.
- Add audit views by workspace/user/provider.
- Add data export/delete paths.

Acceptance:

- One workspace cannot read another workspace's data.
- A user only sees source objects they are allowed to see.
- Org membership and provider credentials are managed through UI.

### Observability, Evals, And Cost Control

Goal: make the system measurable and debuggable before pilots.

Build:

- Braintrust or equivalent tracing.
- Model usage/cost tracking.
- Evaluation harness for:
  - briefing quality
  - meeting prep quality
  - action relevance
  - source faithfulness
  - duplicate rate
  - false-positive rate
  - execution safety
  - memory extraction quality
- Regression datasets from real demo failures.
- Admin/debug views for source object -> signal -> action lineage.

Acceptance:

- Quality regressions are visible.
- Expensive paths are measurable.
- Every generated action can be traced to source evidence and model/tool calls.

### Advanced Platform Backlog

Build only after the product loop and pilot reliability are strong:

- GitHub/Linear write actions.
- Provider webhooks for higher freshness where useful.
- Semantic caching.
- Zep/Mem0 sidecar spike.
- Dedicated graph DB if Postgres graph edges become limiting.
- Role-based briefing modes.
- Weekly executive pulse.
- Decision ledger.
- Commitment tracker.
- Company timeline.
- Pilot ROI dashboard.
- Low-risk autopilot for internal reminders.
- Self-improving agents.
