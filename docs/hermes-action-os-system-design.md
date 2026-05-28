# Hermes Action OS - System Design And Product Architecture

**Version:** v1.0  
**Updated:** 2026-05-17  
**Purpose:** Explain the end-state Hermes product, system design, technical architecture, HLD, LLD, and core product flows.

Hermes is an AI Action OS for company operators. It connects to approved tools, observes work activity, detects what needs attention, prepares actions, asks for approval, executes approved actions, audits outcomes, and builds source-backed operational memory.

This document describes the intended end product, not the current repo state.

---

## 1. Product Mental Model

Hermes is not primarily a chatbot.

The product is an operating layer that turns company activity into:

- daily briefings
- action cards
- approvals
- meeting prep
- follow-up drafts
- risk cards
- decision records
- commitment tracking
- operational memory

The core loop:

```text
Connect tools
-> Observe activity
-> Store source objects
-> Normalize context
-> Detect signals
-> Create action items
-> Draft next step
-> Request approval
-> Execute approved action
-> Audit outcome
-> Store memory
-> Improve future decisions
```

The product rule:

```text
No source, no action card.
No approval, no external execution.
No hidden sync failure.
```

---

## 2. Product Surfaces

### Command Center

The landing page for the day.

Shows:

- latest morning briefing
- top priority action
- pending approvals
- meetings needing prep
- unanswered important emails
- Slack threads requiring attention
- GitHub/Linear blockers
- integration freshness
- visible failures

The dashboard must be action-oriented, not just informational.

### Morning Briefing

Automatically generated daily operating view.

Sections:

- today's calendar
- meetings needing prep
- pending approvals
- important unanswered emails
- Slack blockers and mentions
- GitHub/Linear movement
- overdue follow-ups
- new risks
- recommended next actions
- source coverage and freshness

### Action Inbox

The core product surface.

Each card represents a concrete piece of work Hermes has prepared:

- send email
- draft email
- send Slack message
- create calendar event
- prepare meeting brief
- request decision
- escalate issue
- remind owner
- review blocker

Each action card includes:

- reason
- source evidence
- impact level
- risk level
- draft payload
- approval controls
- execution status
- audit timeline
- feedback controls

### Meeting Prep

For each upcoming meeting, Hermes prepares:

- meeting context
- attendee summary
- related emails
- related Slack threads
- related GitHub/Linear objects
- relevant memories
- suggested agenda
- risks or open decisions
- prepared follow-up actions

### Trust Center

Trust is a product surface, not just logs.

Shows:

- connected tools
- scopes and permissions
- selected Slack channels
- last sync times
- sync failures
- extracted memories
- approval history
- executed actions
- audit log
- data retention controls
- disconnect/revoke controls

### Ask Hermes

Chat remains as a command/debug interface.

It can:

- ask questions
- create action cards
- request custom briefings
- explain why an action was suggested
- correct memory
- search operational memory
- run deeper investigations

Chat output should create or reference product objects instead of ending as only prose.

---

## 3. High-Level Architecture

```text
                         +-------------------------+
                         |       Next.js Web       |
                         | Dashboard / Actions /   |
                         | Briefings / Trust / Ask |
                         +-----------+-------------+
                                     |
                                     | HTTPS / SSE / WebSocket
                                     v
                         +-------------------------+
                         |   Agent Runtime API     |
                         | Express / LangGraph /   |
                         | API routes / Realtime   |
                         +-----------+-------------+
                                     |
             +-----------------------+-----------------------+
             |                       |                       |
             v                       v                       v
   +-------------------+   +-------------------+   +-------------------+
   | BullMQ Workers    |   | Connector Services|   | LLM/Agent Layer   |
   | sync/signals/etc. |   | Gmail/Slack/etc.  |   | Claude/OpenAI     |
   +---------+---------+   +---------+---------+   +---------+---------+
             |                       |                       |
             v                       v                       v
   +---------------------------------------------------------------+
   |                 PostgreSQL + pgvector                         |
   | source objects, actions, approvals, executions, audit, memory |
   +---------------------------------------------------------------+
             |
             v
   +-------------------+
   | Redis / BullMQ    |
   | queues, pub/sub,  |
   | hot session cache |
   +-------------------+
```

Deployment split:

- Vercel: frontend only.
- Railway: API service and worker service.
- Postgres/Neon: source of truth.
- Redis/Upstash: BullMQ, realtime, hot cache.
- LLM providers: Claude for reasoning, OpenAI for embeddings.

---

## 4. Core Backend Services

### Connection Service

Owns provider connection lifecycle.

Responsibilities:

- OAuth start/callback
- scope capture
- encrypted credential storage
- token refresh
- disconnect/revoke
- provider health state

Providers:

- Gmail
- Google Calendar
- Slack
- GitHub
- Linear

### Credential Vault

Stores encrypted provider credentials.

Rules:

- credentials are encrypted at rest
- access is workspace-scoped
- refresh failures update integration health
- raw credentials are never sent to the frontend

### Sync Orchestrator

Schedules and starts sync jobs.

Responsibilities:

- trigger sync by provider
- create `sync_runs`
- enqueue provider-specific jobs
- track objects scanned/created/updated/skipped
- record partial and failed syncs

### Source Object Store

Stores raw provider data before interpretation.

This is critical because Hermes must be able to explain and replay why an action was created.

Examples:

- Gmail thread
- Gmail message
- Calendar event
- Slack message
- Slack thread
- GitHub PR
- GitHub issue
- Linear issue

### Normalization Service

Converts provider-specific data into Hermes-native objects.

Examples:

- Gmail thread -> `EmailThread`
- Slack thread -> `SlackThread`
- Calendar event -> `Meeting`
- GitHub PR -> `GitHubPR`
- Linear issue -> `LinearIssue`

### Entity Resolution Service

Links identities and objects across tools.

Examples:

- Gmail sender -> Calendar attendee -> Slack user
- Acme email domain -> Acme account -> Acme meeting
- Linear issue -> GitHub PR -> Slack thread

P0 matching can be simple:

- email address
- domain
- Slack profile email
- GitHub verified email
- explicit user correction

### Signal Detection Service

Turns normalized activity into candidate signals.

P0 signal types:

- unanswered important email
- meeting prep needed
- follow-up due
- decision needed
- approval needed
- Slack blocker
- Slack commitment candidate

P0.5 signal types:

- GitHub PR ready for review
- stale GitHub PR
- Linear issue blocked
- stale/due Linear issue
- release blocker

Detection strategy:

```text
rules first
-> cheap classifier only when ambiguous
-> LLM extraction only when useful
-> signal
-> dedupe
```

### Action Generator

Turns signals into action items.

Responsibilities:

- rank candidate signals
- dedupe by idempotency key
- generate action title/reason
- attach source evidence
- determine risk/impact
- produce draft payload
- create approval request when required

### Draft Generator

Prepares editable payloads.

Examples:

- email body
- Slack message
- calendar event invite
- Linear issue draft
- GitHub comment draft

Rules:

- cite source objects internally
- preserve recipient/channel identity
- never fabricate missing recipients
- show uncertainty on ambiguous targets

### Approval Engine

Owns human decision flow.

External writes require approval.

Supported decisions:

- approve
- edit and approve
- reject
- snooze
- delegate
- expire

### Execution Engine

Runs approved writes.

Examples:

- Gmail draft/send
- Slack post/DM
- Calendar create/update
- GitHub comment/create issue
- Linear create/update

Rules:

- execution only runs after approval
- every execution creates audit logs
- provider failures update action state
- retries are explicit and visible

### Briefing Engine

Generates Morning Briefing from:

- calendar events
- meeting prep status
- pending actions
- pending approvals
- unanswered emails
- Slack signals
- GitHub/Linear signals
- memories
- integration health

Each briefing includes source coverage.

### Meeting Prep Engine

Generates meeting briefs from:

- Calendar event details
- attendees
- related Gmail threads
- related Slack threads
- related GitHub/Linear objects
- relevant memory
- prior action outcomes

Output:

- context
- suggested agenda
- open decisions
- risks
- suggested follow-up actions

### Memory Service

Stores and retrieves operational memory.

Memory types:

- decision
- commitment
- ownership
- preference
- recurring workflow
- project context
- customer context
- action outcome

Rules:

- inferred memories start as candidates
- explicit memories can be confirmed immediately
- every memory is temporal
- every memory is source-backed when possible
- contradictions create memory conflicts
- stale memory is labeled or excluded

### Audit Service

Records what Hermes saw, decided, suggested, executed, or failed to do.

Audit events include:

- integration connected/disconnected
- sync started/completed/failed
- source object stored
- signal detected
- action item created
- draft generated
- approval requested
- approval accepted/rejected/edited
- execution attempted/completed/failed
- memory created/edited/deleted
- permission denied
- LLM/tool/provider failure

### Integration Health Service

Computes visible health state per provider.

States:

```text
not_connected
healthy
syncing
partial
stale
rate_limited
permission_error
oauth_expired
failed
```

---

## 5. Data Architecture

### Primary Table Groups

```text
Identity:
  workspaces
  workspace_members
  users

Integrations:
  integration_accounts
  integration_credentials
  integration_scopes

Ingestion:
  sync_runs
  source_objects
  raw_events
  webhook_deliveries
  normalization_runs

Operational Objects:
  people
  external_contacts
  tool_identities
  projects
  meetings
  message_threads
  company_objects

Action OS:
  signals
  action_items
  action_drafts
  approvals
  executions
  briefing_runs
  briefing_items
  meeting_briefs
  audit_logs

Memory:
  memories
  memory_sources
  graph_nodes
  graph_edges
  memory_conflicts
  memory_corrections

Observability:
  job_runs
  llm_traces
  model_usage
  failure_events
  user_feedback
```

### Core Data Spine

```text
integration_account
-> sync_run
-> source_object
-> normalized object
-> signal
-> action_item
-> action_draft
-> approval
-> execution
-> audit_log
-> memory / graph_edge
```

### Source Object Contract

Every source object should carry:

- workspace ID
- provider
- provider object ID
- object type
- raw payload
- normalized payload
- ACL / source permissions
- occurred timestamp
- fetched timestamp
- hash for dedupe
- optional embedding

### Memory Contract

Every memory should carry:

- workspace ID
- user ID when user-specific
- memory type
- content
- source references
- source permissions
- confidence
- status
- valid from
- valid until
- last confirmed at
- created by
- access scope

---

## 6. State Machines

### Integration State

```text
not_connected
-> connecting
-> connected
-> syncing
-> healthy
```

Failure states:

```text
oauth_expired
permission_error
rate_limited
partial
stale
failed
disconnected
```

### Sync Run State

```text
queued
-> running
-> completed
```

Alternate states:

```text
completed_partial
failed
retrying
blocked_auth
blocked_permission
rate_limited
cancelled
```

### Signal State

```text
candidate
-> action_created
```

Alternate states:

```text
dismissed
stale
duplicate_suppressed
needs_review
```

### Action State

```text
detected
-> drafted
-> pending_approval
-> approved
-> executing
-> completed
```

Alternate states:

```text
rejected
edited
snoozed
delegated
failed_execution
cancelled_by_user
expired
stale
duplicate_suppressed
```

### Approval State

```text
pending
-> approved
```

Alternate states:

```text
edited
rejected
expired
cancelled
```

### Execution State

```text
queued
-> executing
-> completed
```

Alternate states:

```text
failed
retrying
cancelled
blocked_permission
```

### Memory State

```text
candidate
-> confirmed
```

Alternate states:

```text
rejected
expired
conflicted
superseded
deleted
```

---

## 7. Background Job Architecture

Hermes uses BullMQ + Redis for background work.

Postgres remains the source of truth for product state.

Queues:

```text
sync
normalize
signals
actions
briefings
executions
memory
```

Worker services:

- API service handles HTTP, auth, realtime, and user requests.
- Worker service handles BullMQ jobs.

Job rules:

- every job attempt writes `job_runs`
- every severe failure writes `failure_events`
- user-facing failures show in Trust Center
- retries use bounded backoff
- idempotency keys prevent duplicate actions

Example pipeline:

```text
sync:gmail
-> normalize:gmail-thread
-> detect-signals:email-thread
-> generate-actions:follow-up
-> generate-draft:gmail
-> notify-ui
```

---

## 8. Product Flows

### Flow A - User Connects Gmail

```text
User clicks Connect Gmail
-> Web calls /api/connections/gmail/start
-> Runtime creates OAuth URL
-> User grants scopes
-> Google redirects to callback
-> Runtime stores encrypted refresh token
-> integration_account becomes connected
-> audit log records connection
-> sync:gmail job is queued
-> Trust Center shows Gmail syncing
```

### Flow B - Sync To Source Objects

```text
sync job starts
-> create sync_run
-> fetch provider objects
-> upsert source_objects
-> normalize important fields
-> update sync_run counters
-> update integration health
-> enqueue signal detection
-> audit sync result
```

### Flow C - Source Object To Action Card

```text
source_object stored
-> detector runs
-> signal created
-> idempotency check
-> action item created
-> draft payload generated
-> action enters pending_approval
-> dashboard/action inbox updates
```

### Flow D - Approval To Execution

```text
User opens action card
-> reviews source evidence and draft
-> edits draft if needed
-> clicks approve
-> approval record updated
-> execution job queued
-> provider write runs
-> execution completed/failed
-> action status updated
-> audit log written
-> memory extraction may run on outcome
```

### Flow E - Morning Briefing

```text
scheduled briefing job starts
-> collect today's calendar
-> collect pending approvals/actions
-> collect unanswered email signals
-> collect Slack blocker signals
-> collect GitHub/Linear movement
-> collect relevant memories
-> attach source freshness
-> generate briefing items
-> store briefing_run
-> dashboard updates
```

### Flow F - Meeting Prep

```text
calendar event found
-> meeting_prep_needed signal created
-> meeting prep engine resolves attendees
-> related Gmail/Slack/GitHub/Linear objects retrieved
-> relevant memories retrieved
-> meeting brief generated
-> suggested agenda created
-> follow-up action cards prepared
```

### Flow G - Memory Creation

```text
source object / action outcome / chat correction occurs
-> memory extractor checks for durable facts
-> candidate memory created with sources
-> conflict check runs
-> user confirms/rejects/corrects when needed
-> memory becomes confirmed
-> graph nodes/edges update
```

### Flow H - Ask Hermes

```text
User asks in chat
-> runtime builds context
-> retrieves relevant actions, memories, source objects
-> agent answers or creates product objects
-> if action is needed, create action card
-> if write is needed, use approval engine
```

---

## 9. LLM And Context Architecture

### Model Usage

Use fast models for:

- routing
- classification
- simple extraction
- cheap signal qualification

Use standard models for:

- action reasoning
- draft generation
- meeting prep
- briefing generation

Use deep models only for:

- complex cross-source investigations
- high-risk synthesis
- future deep research workflows

Use embeddings for:

- memory search
- source object semantic retrieval
- duplicate detection support

### Context Builder

The context builder assembles only what a task needs.

Priority order:

1. system instruction / task contract
2. current action or briefing objective
3. source evidence
4. integration freshness warnings
5. relevant confirmed memories
6. recent Ask Hermes session context if needed
7. tool outputs from current workflow

Rules:

- do not preload all memory
- do not include stale source data without warning
- do not use private source data outside its access scope
- prefer source snippets over summarized claims when explaining actions

---

## 10. Security And Trust Architecture

### Permission Principles

- Every object is workspace-scoped.
- Source objects carry permission metadata.
- Memories inherit strictest source ACL.
- Private Slack data must not become public workspace memory.
- User-specific preferences remain user-scoped.
- External writes always require explicit approval.

### Credential Security

- OAuth tokens are encrypted at rest.
- Credential access is backend-only.
- Disconnect revokes or disables future use.
- Missing scopes are visible.
- Expired credentials produce visible health states.

### No Silent Failure Policy

Failures must appear in at least one user-visible place:

- action card
- briefing source coverage
- Trust Center
- integration health
- audit log

Examples:

- Gmail token expired -> Trust Center and dashboard warning.
- Slack rate limited -> integration health and sync run.
- Execution failed -> action failed state and retry.
- Memory conflict -> memory conflict review.

---

## 11. Realtime And Freshness

Hermes should feel realtime, but must be honest about freshness.

Architecture:

```text
provider webhook or polling
-> raw event/source object
-> BullMQ job
-> normalizer
-> signal detector
-> action generator
-> SSE/WebSocket UI update
-> audit log
```

Freshness targets:

- Calendar: 1-5 minutes
- Gmail: 5-15 minutes initially
- Slack: seconds to minutes where events are available
- GitHub: seconds to 5 minutes
- Linear: seconds to 5 minutes

Every UI surface that depends on synced data should show freshness or stale warnings.

---

## 12. Observability And Evaluation

### Product Observability

Track:

- sync success/failure
- source object counts
- signal counts
- action creation rate
- duplicate suppression rate
- approval rate
- draft edit distance
- execution success/failure
- stale source usage
- memory correction rate
- LLM cost

### Auditability

Every important event should answer:

- what happened?
- who/what caused it?
- what object changed?
- what sources were used?
- what was the before state?
- what was the after state?
- did it fail?
- why did it fail?

### Evals

Core eval categories:

- morning briefing quality
- meeting prep quality
- action suggestion quality
- source faithfulness
- memory extraction quality
- tool execution safety

---

## 13. End-To-End Example

Scenario: missed customer follow-up.

```text
1. Gmail sync stores a renewal thread from Acme.
2. Calendar sync stores a meeting with Acme CFO from five days ago.
3. Signal detector sees no outgoing follow-up after the meeting.
4. Hermes creates followup_due signal.
5. Action generator creates:
   "Send follow-up email to Acme CFO"
6. Draft generator prepares email in user's tone.
7. Action Inbox shows:
   - reason
   - calendar source
   - Gmail thread source
   - draft email
   - approval controls
8. User edits and approves.
9. Execution engine sends Gmail message.
10. Audit log records approval and send result.
11. Memory service records:
    "Acme renewal follow-up sent on DATE."
12. Morning briefing no longer shows this as overdue.
```

This is the product working as intended: Hermes did not just answer a question; it detected work, prepared the next step, asked for approval, executed safely, and remembered the outcome.

---

## 14. Prototype Definition Of Done

The end-product prototype is complete when:

- Gmail, Calendar, and Slack connect through UI and sync.
- GitHub and Linear read integrations support technical-founder demos.
- Morning briefing generates automatically and manually.
- Action Inbox contains real source-backed generated actions.
- User can approve/edit/reject email drafts.
- User can approve/edit/reject Slack drafts.
- User can approve Calendar event creation.
- Meeting prep works for upcoming events.
- Trust Center shows permissions, freshness, failures, memories, approvals, and executions.
- Audit log records every important action and failure.
- Company Brain stores source-backed decisions, commitments, ownership, preferences, and action outcomes.
- No stale or failed sync is hidden.

