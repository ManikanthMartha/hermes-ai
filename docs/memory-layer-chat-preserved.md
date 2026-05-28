# Preserved Chat Notes: Hermes Memory Layer

This file preserves assistant final-answer content from the current Codex thread.
It intentionally excludes raw file-reading/tool output and intermediate terminal
logs. It includes the visible final answers about repo understanding, memory-layer
architecture, context packing, production-agent memory patterns, and the phased
implementation plan.

## 1. Repo Understanding Summary

I have read the repo shape, `PLAN.md`, `hermes-claude.txt`, and the backend docs.

What we are building: Hermes AI, a multi-agent operations assistant that connects
to real tools through MCP, routes work through LangGraph specialists, keeps memory
over time, and can take user-approved actions instead of only answering questions.

Current architecture:

- `apps/web`: Next.js chat UI and proxy routes.
- `apps/agent-runtime`: Express runtime that owns LangGraph, LLM calls, streaming,
  and HIL resume.
- `packages/mcp-servers/*`: standalone MCP servers for Slack, GitHub, Linear,
  Sentry, Gmail, etc.
- `packages/shared`: env loading, LLM model registry, DB/Redis/config utilities.
- `packages/memory`: early/session/semantic/fact memory layer work.

Phase state: the repo is currently around Phase 3 plus a Gmail prototype.

- Phase 1 single-agent flow is documented in `docs/backend-walkthrough.md`.
- Phase 3 multi-agent orchestration is documented in
  `docs/phase-3-walkthrough.md`.
- Runtime graph is in `graph.ts`: `Herald -> Iris/Talos/Argus -> Herald`.
- Herald routing is LLM-based in `planner.ts`, not keyword rules.
- HIL approval wrapping is in `approval.ts`.
- Streaming bridge is in `chat-bridge.ts`.

Claude transcript context: `hermes-claude.txt` records the prior Claude session.
The key latest thread was:

- Phase 3 docs were completed.
- Code reviewers found small real issues in resume/approval/planner.
- Work then pivoted to Gmail MCP.
- Gmail MCP was implemented for personal Gmail prototyping.
- The last blocker was OAuth setup for `srimanikanth04@gmail.com`; the script now
  prints the auth URL manually on Windows to avoid URL truncation.

Gmail implementation that landed:

- Package: `packages/mcp-servers/gmail`
- Tools: list messages, get message, get thread, get sent examples, send/save
  draft.
- Iris now handles Slack + Gmail in `comms.ts`.
- `gmail__send_message` is HIL-gated and supports `send` or `draft`.
- Approval UI supports "save draft" in `approval-card.tsx`.

One note: `git status` was blocked by Git dubious ownership on `F:/hermes-ai`, so
dirty/untracked state was not inspected. The next useful work would be either
finishing Gmail OAuth smoke testing or applying the four Phase 3 reviewer fixes
from the Claude transcript.

## 2. Memory Layer Analysis: What To Build vs Outsource

I read `MEMORY_LAYER_RESOURCES.md`, Phase 2 in `PLAN.md`, and the current memory
package. The repo already has placeholders in `packages/memory`, and Prisma
already has `Memory`, `Conversation`, `Message`, `Document`, and `DocumentChunk`
models. So the project is set up for this, but the real memory layer is not
implemented yet.

Short verdict:

Do not build "embed every chat message and RAG it" as the main memory system. It
is useful as a fallback search over old conversations, but it should not be
Hermes's primary memory.

For Hermes, the right memory design is layered:

1. Session memory: current thread, recent messages, HIL state.
2. Conversation archive: full transcripts for audit/search.
3. Extracted fact memory: user preferences, decisions, relationships, writing
   style, stable facts.
4. User profile/core memory: tiny always-in-context summary.
5. Operational source memory: calendar events, emails, tasks, PRs, issues, etc.
   synced or fetched from tools.
6. Document RAG: uploaded docs, PDFs, notes, codebase docs.
7. Knowledge graph: optional later, only when relationship/temporal queries
   become important.

The important correction: meetings should usually not be "remembered" as vague
chat memory. If the user asks, "What meetings do I have today?", Hermes should
call Gmail/Outlook Calendar as the source of truth. Memory should remember things
like "user prefers morning meetings," "Rahul is usually the design reviewer," or
"Veltrex weekly sync happens Mondays unless calendar says otherwise."

### What Existing Libraries Can Do

LangGraph memory/checkpointing:

LangGraph already supports short-term thread memory and long-term namespace
memory. Their docs split memory into thread-scoped short-term memory and
cross-session long-term memory, which maps well to Hermes's graph architecture.
It is the best native fit because Hermes already uses LangGraph. But it is
low-level: you still build extraction, ranking, categories, context packing, and
product policy yourself.

Mem0:

Mem0 is the strongest "drop-in memory engine" candidate. It gives managed or
self-hosted memory, extraction, search, metadata/categories, async flows,
rerankers, and optional graph memory. Mem0 OSS supports Node/TypeScript,
configurable LLM/vector stores, and graph memory with Neo4j/Memgraph/etc.

But Mem0 is not a full solution for Hermes. It will not replace:

- LangGraph checkpoints / HIL resume state.
- Calendar/email/GitHub/Linear/Sentry as live sources of truth.
- Your context-packing contract.
- Your app's permissions model.
- Your domain-specific memory categories and conflict rules.

Best use: put Mem0 behind an interface as an optional backend for extracted
long-term memory, not as the whole memory layer.

Zep / Graphiti:

Zep is strongest if you want temporal knowledge graphs and relationship-aware
memory. Its graph stores entities, edges, facts, episodes, and valid/invalid time
ranges. That is directly relevant for questions like "Who was working with Rahul
before Priya took over?" or "What changed about this project over time?"

Zep is more compelling than Mem0 when temporal relationship reasoning is core to
the product. For Hermes v1, I would not make it the default dependency. It adds
power, but also product and infra coupling before we have evidence we need graph
traversal.

Letta:

Letta is conceptually excellent: core memory blocks, archival memory, recall
memory, and agent-managed memory tools. Their "memory blocks" idea is exactly
what Hermes should borrow for user profile/core memory.

But Letta is more of an agent runtime/memory architecture. Since Hermes already
uses LangGraph specialists, I would not replace the runtime with Letta. Borrow
the pattern, not the framework.

### Recommended Hermes Design

Build our own thin memory layer first, with provider hooks for Mem0/Zep later.

The core tables should evolve beyond the current `Memory` model. We need scope
and lifecycle fields:

```ts
Memory {
  id
  orgId
  userId
  agentKey?
  content
  category // preference, decision, relationship, writing_style, project_fact, etc.
  sourceType // chat, gmail, calendar, slack, github, linear, manual
  sourceId?
  confidence
  validFrom?
  validUntil?
  supersedesMemoryId?
  metadata
  embedding
  createdAt
  updatedAt
}
```

Then add separate structured tables for tool-backed operational data:

```ts
ExternalEvent {
  provider // google_calendar, outlook_calendar
  externalId
  userId
  title
  startsAt
  endsAt
  attendees
  status
  lastSyncedAt
}
```

That distinction matters. "User prefers 10am meetings" is memory. "Meeting with
Alex tomorrow at 3pm" is calendar state.

### Context Engineering Shape

For every user turn, build a context pack like this:

1. System prompt and specialist prompt.
2. Small user profile block:
   - name
   - timezone
   - communication style
   - preferences
   - common aliases
3. Recent session messages from checkpointer/Redis/Postgres.
4. Retrieved extracted memories by query relevance.
5. Tool-derived state only when needed:
   - calendar for meetings
   - Gmail for email context
   - GitHub/Linear/Sentry for operational facts
6. Optional document chunks if the query is doc-related.
7. Tool results from current turn.

This is the context engineering layer. It should be explicit and logged: what
was included, why, token count, score, and what was excluded.

### Knowledge Graph Decision

Do not build a graph now. Add graph only when we see repeated failures in:

- "Who is connected to this project?"
- "What changed over time?"
- "Which person/client/project relationships matter here?"
- "What was true before X changed?"

When that happens, the pragmatic path is either:

- Mem0 graph memory if we want faster integration.
- Zep/Graphiti if temporal graph reasoning becomes central.
- Postgres edge tables if we want a lightweight custom graph.

### Recommendation

For Hermes Phase 2, build:

1. Native LangGraph/Postgres checkpointing for durable session/HIL state.
2. Conversation/message persistence.
3. LLM-based fact extraction into Postgres + pgvector.
4. User profile/core memory block.
5. Context packer with budgets and logs.
6. Calendar/Gmail/Slack/GitHub memories as tool-backed source state, not generic
   RAG.
7. Add a `MemoryProvider` interface so later we can swap/compare:
   - `HermesPostgresMemoryProvider`
   - `Mem0MemoryProvider`
   - `ZepMemoryProvider`

So: build the skeleton ourselves because Hermes needs control over context
packing, source-of-truth tools, and permissions. Use Mem0/Zep as benchmarked
optional backends, not as the foundation.

## 3. How Big AI Assistant Companies Handle Memory

Yes. Big AI assistant systems mostly follow the same core logic, though every
company names it differently.

They do not simply keep the whole chat in context forever. They use layered
memory, scoped retrieval, summarization, tool calls, and policy controls.

Examples:

- ChatGPT separates saved memories from chat history reference. Saved memories
  are durable user facts/preferences; chat history is more fluid and can change
  over time. Users can delete or disable both.
- LangGraph/LangChain split memory into short-term thread memory and long-term
  memory, and further classify long-term memory as semantic, episodic, and
  procedural.
- Claude Code uses specialized subagents with separate context windows to reduce
  context pollution and keep each task focused.
- Deep Agents/LangGraph describe user-scoped, agent-scoped, and
  organization-scoped memory, plus background consolidation.

So yes, Hermes should use the same broad architecture.

### The Right Mental Model

Hermes should not have "one memory." It needs multiple memory types:

| Memory Type | Purpose | Example |
|---|---|---|
| Thread/session memory | Current conversation continuity | Last 20 messages, current approval state |
| Conversation archive | Full chat history for audit/search | "What did we discuss last week?" |
| User profile memory | Durable user facts | Name, timezone, writing style, preferences |
| Extracted fact memory | Decisions/preferences/relationships | "We switched from Postgres to MySQL" |
| Tool/source memory | Live truth from apps | Calendar events, emails, PRs, issues |
| Document memory | RAG over docs/files | Uploaded PDFs, company docs |
| Procedural memory | How the agent should work | "When drafting email, first sample sent emails" |
| Org/team memory | Shared team facts | Team conventions, project ownership |

This avoids one giant memory bucket, which is where most bad agent systems fail.

### How To Avoid Context Rot

Context rot happens when you stuff too much irrelevant information into the
prompt. The fix is not "bigger context." The fix is selective context.

Hermes should use a context packer:

1. Always include system prompt.
2. Always include current user query.
3. Include recent session messages.
4. Include compact session summary.
5. Retrieve only relevant memories.
6. Retrieve tool data only when needed.
7. Exclude stale/low-confidence/conflicting facts.
8. Log exactly what was included.

For example, if the user asks:

> "Do I have meetings today?"

Do not retrieve random memories about meetings. Call Calendar MCP. Calendar is
source of truth.

If the user asks:

> "Do I prefer morning meetings?"

Use memory, because that is a preference.

### How To Avoid Fact Duplication

Do not insert every extracted fact blindly.

Use a memory write pipeline:

```text
new conversation
  -> extract candidate facts
  -> classify category
  -> embed fact
  -> search similar existing memories
  -> if duplicate: update existing memory
  -> if conflict: supersede old memory
  -> if new: insert memory
```

Each memory should have fields like:

```ts
{
  userId,
  orgId,
  content,
  category,
  sourceType,
  sourceId,
  confidence,
  validFrom,
  validUntil,
  supersedesMemoryId,
  embedding,
  createdAt,
  updatedAt
}
```

This lets us say:

- "User prefers morning meetings" exists once.
- If said again, update `updatedAt` or confidence.
- Do not store five duplicate versions.

### How To Avoid Temporal Confusion

Every durable fact needs time metadata.

Bad memory:

```text
We use Postgres.
```

Good memory:

```text
Project database choice was Postgres.
validFrom: 2026-01-10
validUntil: 2026-06-03
status: superseded
```

New memory:

```text
Project database choice is now MySQL.
validFrom: 2026-06-03
supersedes: old_postgres_memory_id
status: active
```

Then when retrieving, prefer:

1. Active facts.
2. Recent facts.
3. Higher-confidence facts.
4. Facts from authoritative sources.

### How To Avoid Conflict Blindness

For the example:

> Jan: "Use Postgres"
> Jun: "Actually we are switching to MySQL"

The memory extractor should detect this as a conflict/update, not as a second
unrelated fact.

The rule should be:

```text
If a new fact concerns the same subject + attribute as an old fact,
and the value differs,
mark the old fact superseded.
```

Structured form:

```ts
{
  subject: "Hageman project",
  predicate: "database",
  value: "MySQL",
  previousValue: "Postgres"
}
```

This is where a lightweight knowledge-graph shape helps, even if we do not use
Neo4j yet. We can store structured triples in Postgres.

### How To Avoid Privacy Problems In Multi-User Orgs

This is critical. Memory must be scoped.

Every memory should have access boundaries:

```ts
scope: "user" | "org" | "team" | "agent"
userId?: string
orgId?: string
teamId?: string
visibility: "private" | "shared" | "admin"
sourceAcl?: object
```

Retrieval must always filter before vector search or during vector search:

```sql
WHERE org_id = current_org
AND (
  visibility = 'shared'
  OR user_id = current_user
  OR team_id IN current_user_teams
)
```

Never do global vector search and filter after. That can leak data through
rankings, logs, or model context.

Also separate memory categories:

- Private user preferences: user-scoped.
- Team conventions: team/org-scoped.
- Emails: private unless explicitly shared.
- Calendar: private unless attendees/shared calendar permits.
- Slack channel facts: scoped according to channel membership.

### How To Keep Memory Updated

Use two write paths.

Hot path memory: immediate, for explicit user commands.

Example:

> "Remember that I prefer short direct emails."

Save immediately. The user expects it to work next turn.

Background consolidation: async, after conversations.

Example:

> Long chat about project decisions.

After the turn, an extraction job reviews the conversation, extracts durable
facts, merges duplicates, resolves conflicts, and updates summaries.

This mirrors the pattern described in LangChain/Deep Agents docs: hot-path writes
are immediate but add latency; background consolidation improves quality without
slowing the user-facing response.

### For Hermes, Best Design

I would implement this order:

1. Session/checkpoint memory
   - Durable LangGraph checkpointing.
   - Recent messages.
   - HIL approval resume state.
2. Conversation archive
   - Store every user/assistant/tool message.
   - Not all included in prompt.
   - Used for audit and fallback search.
3. User profile memory
   - Tiny always-loaded block:

```text
User: Manikanth
Timezone: Asia/Calcutta
Email style: concise, direct, informal
Prefers: morning meetings
```

4. Extracted fact memory
   - Preferences, decisions, relationships, writing style, project facts.
   - Dedup + conflict resolution.
   - pgvector for retrieval.
5. Tool-backed live state
   - Calendar events from Calendar MCP.
   - Emails from Gmail MCP.
   - PRs from GitHub MCP.
   - Issues from Linear MCP.
   - Errors from Sentry MCP.
6. Context packer
   - One module that decides what goes into the LLM call.
   - Logs token counts, memory IDs, relevance scores, and excluded items.
7. Optional graph later
   - Start with Postgres structured facts/triples.
   - Add Zep/Graphiti or Mem0 graph only when multi-hop temporal queries become
     common.

The main rule:

Memory should remember durable meaning.

Tools should fetch live truth.

Context packing should decide what the model sees.

That separation solves most of the problems: context rot, duplication, temporal
confusion, privacy leaks, and stale facts.

## 4. Memory Layer Implementation Plan

### Phase 2.0: Memory Foundations

Create the contracts before adding intelligence.

Build:

- `@hermes/memory` provider interfaces:
  - `SessionMemory`
  - `ConversationStore`
  - `FactMemory`
  - `ProfileMemory`
  - `ContextPacker`
- Add memory scopes:
  - `user`
  - `org`
  - `team`
  - `agent`
- Add metadata fields for privacy and time:
  - `userId`
  - `orgId`
  - `teamId`
  - `sourceType`
  - `sourceId`
  - `confidence`
  - `validFrom`
  - `validUntil`
  - `supersedesMemoryId`

Goal: no memory logic hidden inside agents. Agents ask the memory package for
context.

### Phase 2.1: Durable Session + Conversation Memory

Store what happened, but do not retrieve everything into context.

Build:

- Postgres persistence for:
  - conversations
  - messages
  - tool calls
  - approval events
- Replace in-memory `MemorySaver` with durable checkpointing later, or wrap it
  first.
- Keep recent session window:
  - last 10-20 messages
  - compact summary of older turns
- Store full transcript for audit/search.

Used for:

- "What were we just discussing?"
- HIL resume reliability.
- Debugging agent behavior.

Avoid:

- stuffing entire conversation history into every prompt.

### Phase 2.2: User Profile / Core Memory

Create a small always-included profile block.

Examples:

```text
User timezone: Asia/Calcutta
User prefers concise, direct answers.
User writes emails in a short informal style.
User prefers morning meetings.
```

Build:

- `UserProfileMemory`
- profile categories:
  - identity
  - timezone
  - communication_style
  - preferences
  - aliases
  - recurring_work_context
- explicit update path for:
  - "remember that..."
  - "forget that..."
  - "update my preference..."

Used for:

- personalization
- email drafting
- scheduling preferences
- response style

This is the highest ROI memory layer.

### Phase 2.3: Extracted Fact Memory

This is the main long-term memory layer.

Pipeline:

```text
conversation turn
  -> async extraction job
  -> candidate facts
  -> classify category
  -> embed fact
  -> search similar existing memories
  -> dedupe / update / supersede / insert
```

Categories:

- `preference`
- `decision`
- `fact`
- `relationship`
- `writing_style`
- `project_context`
- `recurring_event`
- `instruction`

Each memory should track:

- content
- subject
- predicate
- value
- category
- source message/conversation
- confidence
- active/superseded status
- timestamps

This solves:

- duplicate facts
- stale facts
- conflict blindness
- temporal confusion

### Phase 2.4: Conflict + Temporal Resolution

Add rules before memory grows messy.

Implement:

- duplicate threshold, e.g. cosine similarity `> 0.92`
- conflict detection:
  - same subject + predicate
  - different value
- old memory gets:
  - `validUntil`
  - `supersededBy`
  - status `superseded`
- new memory becomes active.

Example:

```text
Old: Hageman project uses Postgres.
New: Hageman project uses MySQL.
Action: mark Postgres memory superseded, insert MySQL as active.
```

Also add retrieval rules:

- prefer active memories
- prefer recent memories
- prefer higher confidence
- show conflicting memories only when relevant

### Phase 2.5: Semantic Retrieval + Context Packer

Build the real context engineering layer.

Input:

```ts
{
  userId,
  orgId,
  threadId,
  query,
  specialist,
  tokenBudget
}
```

Output:

```ts
{
  packedContext,
  includedMemoryIds,
  excludedMemoryIds,
  tokenUsage,
  retrievalScores
}
```

Packing priority:

1. system/specialist prompt
2. current query
3. core user profile
4. recent session messages
5. session summary
6. retrieved active memories
7. relevant tool state
8. document chunks, only if needed
9. current-turn tool results

Budget example:

```text
system: 2K
profile: 500
session recent: 6K
session summary: 1K
retrieved memories: 4K
documents: optional 20K
tool results: remaining
```

This is how we avoid context rot.

### Phase 2.6: Tool-Backed Operational Memory

Do not treat live app data as generic memory.

Calendar, Gmail, Slack, GitHub, Linear, Sentry should remain source-of-truth
tools.

Build lightweight sync/cache only where useful:

- calendar event cache
- sent email style examples
- recent Slack thread references
- project/repo/team aliases

Rules:

- "What meetings do I have today?" -> Calendar MCP.
- "Do I prefer morning meetings?" -> memory.
- "Draft this in my style" -> Gmail sent examples + writing style memory.
- "What did Rahul say?" -> Slack search, then maybe store extracted durable fact.

This prevents stale operational facts.

### Phase 2.7: Privacy + Multi-User Boundaries

Add this before SaaS mode, not after.

Every memory query must filter by:

- `orgId`
- `userId`
- `teamId`
- visibility
- source ACL

Scopes:

```ts
"user_private"
"team_shared"
"org_shared"
"agent_private"
```

Rules:

- private email memories are user-scoped.
- Slack channel memories follow channel membership.
- org decisions can be org-scoped.
- personal preferences are never shared unless explicitly promoted.

Never do global vector search and filter later. Scope first, retrieve second.

### Phase 2.8: Memory Management UI / Commands

Users need control.

Support commands:

- "What do you remember about me?"
- "Forget that I prefer morning meetings."
- "Update my email style."
- "Why did you use that memory?"
- "Show memories used for this answer."

Build minimal UI:

- memory list
- category filter
- delete memory
- edit memory
- mark as wrong/stale

This is important for trust.

### Phase 2.9: Evaluation + Observability

Add tests before trusting memory.

Metrics:

- recall accuracy
- conflict handling
- duplicate rate
- privacy leakage tests
- token budget usage
- retrieval precision
- stale memory rate

Create eval cases:

```text
User says Postgres in January, MySQL in June.
Question: What DB do we use now?
Expected: MySQL, mention Postgres was superseded if relevant.
```

Log every context pack:

- query
- included memories
- excluded memories
- token counts
- retrieval scores
- final answer memory citations

### Phase 2.10: Optional External Memory Backend

Only after native layer works.

Add provider adapters:

- `HermesPostgresMemoryProvider`
- `Mem0MemoryProvider`
- `ZepMemoryProvider`

Use them for benchmarking:

- extraction quality
- retrieval quality
- latency
- cost
- graph/temporal reasoning

Do not make Mem0/Zep the foundation until Hermes's own memory contract is clear.

### Implementation Order

1. Prisma schema expansion.
2. Conversation/message persistence.
3. User profile memory.
4. Fact extraction prompt + async worker.
5. Embedding + pgvector search.
6. Dedup/update/supersede logic.
7. Context packer.
8. Wire packer into Herald/specialists.
9. Calendar/Gmail source-of-truth rules.
10. Memory commands/UI.
11. Eval suite.
12. Optional Mem0/Zep adapters.

This gives Hermes production-grade memory without prematurely building a full
knowledge graph.

## 5. Revised Individual-First Memory Plan

This is the current implementation direction for Hermes.

We will build Hermes first for a single individual user who connects personal
tools: Gmail, Calendar, Slack, GitHub, Linear, Sentry, Postgres, etc. We will not
build full organization/team memory now. Later, when BetterAuth with the org
plugin is added, we can extend the memory schema with `orgId`, `teamId`, shared
visibility, and workspace ACLs.

For now, every durable memory belongs to one user.

### Guiding Principle

Memory should remember durable meaning. Tools should fetch live truth.

Examples:

- "I prefer morning meetings" -> memory.
- "What meetings do I have today?" -> Calendar MCP.
- "My email style is concise and informal" -> memory.
- "Reply to this email" -> Gmail MCP for thread context + memory for writing
  style.
- "What PRs are open?" -> GitHub MCP.
- "Remember that Hageman switched to MySQL" -> memory.
- "What database does Hageman use now?" -> memory retrieval, preferring active
  facts.

This keeps memory useful without turning it into a stale clone of every connected
tool.

### Phase A: Schema Cleanup For Individual Memory

Update the current Prisma `Memory` model to support individual memory lifecycle.

Add fields like:

```ts
Memory {
  id
  userId              // temporary local/default user id until BetterAuth
  content
  category            // preference, decision, fact, relationship, writing_style, instruction
  subject             // optional structured target, e.g. "Hageman project"
  predicate           // optional structured property, e.g. "database"
  value               // optional structured value, e.g. "MySQL"
  sourceType          // chat, gmail, calendar, slack, github, linear, manual
  sourceId            // message id / conversation id / tool id when available
  confidence
  status              // active, superseded, deleted
  validFrom
  validUntil
  supersedesMemoryId
  metadata
  embedding
  createdAt
  updatedAt
}
```

For v1, use a single constant user id:

```ts
const DEFAULT_USER_ID = "local-user";
```

This avoids overbuilding auth while keeping the schema ready for BetterAuth
later.

### Phase B: Conversation Archive

Persist every chat turn and tool event.

Use this for:

- audit/debugging
- fallback search
- extraction source material
- "what did we discuss last week?"

Do not blindly stuff archived conversations into LLM context.

Implementation:

- On `/api/chat`, persist the latest user message.
- During stream bridging, persist assistant text deltas as a final assistant
  message.
- Persist tool calls and tool outputs, but truncate large outputs.
- Persist HIL approval requests and decisions.

Tables can reuse existing `Conversation` and `Message`, with small metadata
extensions if needed.

### Phase C: Session Memory And Summaries

Keep the current active conversation coherent without growing context forever.

Implement:

- last N recent messages, usually 10-20
- rolling summary for older messages
- summary updated when conversation exceeds a threshold
- summary stored on the conversation or separate session-summary record

Context rule:

```text
include recent messages verbatim
include older summary
do not include the full transcript unless user asks for it
```

This directly prevents context rot.

### Phase D: User Profile / Core Memory

Create a small always-included memory block for the user.

This is the most valuable layer for an individual assistant.

Store:

- name
- timezone
- preferred response style
- writing/email style
- scheduling preferences
- common aliases
- recurring work context
- important personal preferences

Example packed profile:

```text
User profile:
- Name: Manikanth
- Timezone: Asia/Calcutta
- Prefers concise, direct answers.
- Email style: short, informal, no unnecessary corporate phrasing.
- Scheduling: prefers morning meetings when possible.
```

Update paths:

- explicit: "remember that..."
- explicit: "forget that..."
- explicit: "update my email style..."
- inferred: background extraction proposes profile updates only when confidence
  is high.

For v1, explicit memory updates should be applied immediately. Inferred updates
can be saved as normal fact memories first.

### Phase E: Fact Extraction Pipeline

After each meaningful user turn, extract durable facts.

Do not extract:

- greetings
- temporary task state
- filler
- tool outputs that can be fetched live
- one-off calendar events unless the user says they are recurring/preferential

Extract:

- preferences
- decisions
- project facts
- relationships
- recurring patterns
- writing style observations
- durable instructions

Pipeline:

```text
conversation slice
  -> LLM extractor
  -> candidate memories
  -> validate shape
  -> embed candidate
  -> search similar active memories for same user
  -> dedupe / supersede / insert
```

Candidate shape:

```ts
{
  content: string
  category: "preference" | "decision" | "fact" | "relationship" | "writing_style" | "instruction"
  subject?: string
  predicate?: string
  value?: string
  confidence: number
  sourceType: "chat"
}
```

Run this async after the chat response. Do not block the main user response.

### Phase F: Deduplication And Conflict Handling

This is required before memory becomes useful.

Dedup rule:

```text
If candidate is semantically similar to an existing active memory above 0.92,
update the existing memory instead of inserting a duplicate.
```

Conflict rule:

```text
If candidate has the same subject + predicate as an active memory,
but a different value, mark the old memory superseded and insert the new one.
```

Example:

```text
Old active memory:
Hageman project uses Postgres.
subject: Hageman project
predicate: database
value: Postgres

New candidate:
Hageman project uses MySQL.
subject: Hageman project
predicate: database
value: MySQL

Action:
- old memory -> status=superseded, validUntil=now
- new memory -> status=active, validFrom=now, supersedesMemoryId=old.id
```

Retrieval should prefer:

1. active memories
2. higher relevance
3. newer facts
4. higher confidence

### Phase G: Semantic Search

Implement pgvector search over extracted memories.

Do not search all users. For now:

```sql
WHERE user_id = 'local-user'
AND status = 'active'
```

Later with BetterAuth:

```sql
WHERE user_id = auth.user.id
```

Search flow:

```text
query
  -> embedding
  -> pgvector top K
  -> filter by threshold
  -> rank by relevance + recency + confidence
  -> return compact memory snippets
```

Initial thresholds:

- retrieval threshold: around `0.70-0.78`, tune with evals
- dedup threshold: around `0.90-0.94`
- top K: 5-10

### Phase H: Context Packer

Build one explicit module that decides what enters the LLM context.

Input:

```ts
{
  userId: "local-user",
  threadId,
  query,
  specialist?: "planner" | "comms" | "code" | "ops",
  tokenBudget
}
```

Output:

```ts
{
  blocks: ContextBlock[]
  text: string
  includedMemoryIds: string[]
  tokenUsage: {
    profile: number
    session: number
    summary: number
    memories: number
    total: number
  }
}
```

Packing order:

1. system/specialist prompt
2. current user query
3. core profile memory
4. recent session messages
5. rolling session summary
6. retrieved active fact memories
7. relevant tool hints, not stale tool data
8. document chunks only when document RAG is enabled

Budget example:

```text
profile: 500 tokens
recent session: 4K-8K
summary: 1K
retrieved memories: 2K-4K
documents: optional, separate Phase 4
```

Every pack should be logged with:

- memory ids included
- scores
- token counts
- reason for inclusion

This makes memory debuggable.

### Phase I: Tool-Backed Personal State

For an individual Hermes assistant, connected tools are the source of operational
truth.

Rules:

- Calendar events stay in Calendar.
- Emails stay in Gmail.
- Slack messages stay in Slack.
- GitHub PRs stay in GitHub.
- Linear issues stay in Linear.
- Sentry errors stay in Sentry.

Memory stores durable conclusions and preferences, not every external object.

Examples:

- User asks "Do I have meetings today?"
  - Call Calendar MCP.
- User asks "Do I usually prefer morning meetings?"
  - Search memory.
- User asks "Write this email in my style."
  - Use profile writing style + `gmail__get_sent_examples`.
- User asks "Remember that for Hageman, Rahul owns frontend review."
  - Store as relationship/project fact.

Optional lightweight caches can be added later for speed, but the default should
be live tool calls.

### Phase J: Memory Commands

Add natural-language memory operations.

Commands:

- "remember that..."
- "forget that..."
- "what do you remember about me?"
- "what do you remember about Hageman?"
- "update my email style to..."
- "why did you say that?"
- "what memory did you use?"

Implementation:

- Herald routes memory-management requests to a memory specialist or direct
  memory handler.
- Explicit `remember` writes synchronously.
- Explicit `forget` marks memory as deleted, not hard-deleted initially.
- "what do you remember" searches/profile-dumps memory.

This gives the user control and makes the assistant trustworthy.

### Phase K: Wire Memory Into Hermes Agents

Start with Herald.

Before `runHerald`, pack:

- profile
- recent session context
- relevant memories

Then include this as a compact context message.

Next wire specialists:

- Iris gets communication preferences, writing style, relevant people aliases,
  and email style memories.
- Talos gets project/repo/Linear memory.
- Argus gets project/service aliases and ops-related decisions.

Do not give every specialist every memory. Specialist-specific context keeps
tool choice cleaner.

### Phase L: Evaluation

Create small deterministic memory evals before expanding.

Test cases:

1. User preference recall:
   - "I prefer morning meetings."
   - Later: "When should you schedule calls for me?"
   - Expected: morning preference.

2. Conflict update:
   - "Use Postgres for Hageman."
   - Later: "Actually Hageman is switching to MySQL."
   - Later: "What database does Hageman use?"
   - Expected: MySQL, Postgres superseded.

3. No stale calendar memory:
   - "I have a meeting tomorrow at 3."
   - Later: "What meetings do I have today?"
   - Expected: call calendar, not rely on stale chat.

4. Writing style:
   - User sends/drafts examples.
   - Later: "Draft an email like me."
   - Expected: concise/direct style.

5. Forget command:
   - Remember preference.
   - Forget preference.
   - Ask again.
   - Expected: no use of deleted memory.

### Phase M: Later BetterAuth / Org Upgrade

When BetterAuth org plugin lands, extend without redesigning.

Add:

- real `userId`
- optional `orgId`
- optional `teamId`
- memory visibility:
  - `private`
  - `shared`
  - `org`
- source ACLs for Slack/Gmail/Calendar

The individual-first design should already have `userId` everywhere, so the
upgrade path is straightforward.

### Recommended Build Order

1. Expand Prisma `Memory` model for individual lifecycle fields.
2. Implement `ConversationStore`.
3. Persist user/assistant/tool messages.
4. Implement `ProfileMemory`.
5. Implement explicit remember/forget/list memory commands.
6. Implement `FactMemory` insert/search with embeddings.
7. Add dedup and supersede logic.
8. Add async fact extraction after turns.
9. Build `ContextPacker`.
10. Wire packed context into Herald.
11. Wire specialist-specific context into Iris/Talos/Argus.
12. Add memory evals.
13. Add BetterAuth/org expansion later.

This keeps Hermes focused: a strong individual AI assistant first, with a clean
path to multi-user workspace memory later.
