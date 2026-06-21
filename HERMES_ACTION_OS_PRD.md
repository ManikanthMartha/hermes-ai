# Hermes Action OS — Product Requirements Document

**Version:** v0.1 prototype PRD  
**Date:** 2026-05-10  
**Product direction:** Action OS first, Company Brain second, chat as supporting interface  
**Primary customer:** SMB and mid-market company leaders: founder/CEO, COO, CFO, CTO, CRO, chief of staff, department heads  
**Prototype horizon:** first pilot/investor prototype

---

## 1. Executive summary

Hermes is being repositioned from a multi-agent AI chatbot into an **Action OS for companies**.

The product should not primarily wait for users to ask questions. Hermes should connect to permissioned company tools, monitor activity, detect what needs attention, create action items, prepare drafts, request approval, execute approved actions, and maintain a living operational memory of the company.

**One-line product definition:**

> Hermes is an AI Action OS that turns company activity into daily briefings, action items, approvals, follow-ups, and operational memory.

**Internal operating loop:**

```text
Connect tools
→ Observe events
→ Normalize context
→ Detect signals
→ Create action items
→ Prioritize
→ Draft next step
→ Request approval
→ Execute
→ Track result
→ Store memory
→ Improve future decisions
```

**What changes from old Hermes:**

```text
Old Hermes:
User asks → agent routes → tools are called → answer is generated.

New Hermes:
Company events happen → Hermes detects signal → Hermes prepares action → user approves → Hermes executes → outcome is tracked.
```

Chat remains part of the product, but it becomes a **manual command interface** rather than the main product.

---

## 2. Strategic product principles

### 2.1 Proactive by default

A leader should open Hermes in the morning and already see what matters:

- meetings today,
- missing follow-ups,
- approvals waiting,
- project blockers,
- customer issues,
- new risks,
- relevant GitHub/Linear movement,
- Slack/email threads requiring attention.

Users should not have to ask, “What needs my attention today?” Hermes should already know enough to surface the first useful draft.

### 2.2 Action-first, not answer-first

Every important insight should become one of:

- an action item,
- a decision request,
- a meeting prep card,
- a follow-up draft,
- a risk card,
- an approval card,
- a report/briefing item.

A weak Hermes response:

```text
The Acme payment issue appears important.
```

A strong Hermes response:

```text
Action prepared: Send customer update to Acme.
Reason: Payment issue affects 3 customers; engineering marked fix ready; customer meeting is tomorrow.
Sources: Zendesk ticket, Slack thread, Calendar event.
Status: Needs approval.
```

### 2.3 Permissioned company brain, not “entire company data”

Do not position Hermes as “we have your entire company data.” That is scary, inaccurate, and risky.

Preferred positioning:

> Hermes connects to approved tools with scoped permissions and builds a permission-aware operational memory.

### 2.4 Zero silent failures

If Hermes fails to sync Gmail, misses a Slack webhook, cannot access a Linear project, or cannot execute a Slack DM, the failure must be visible in:

- the relevant action card,
- the Trust Center,
- integration health,
- audit logs,
- internal observability.

A confident answer from stale data is a critical product defect.

### 2.5 Safe execution through approvals

Hermes can draft and prepare aggressively, but it must execute conservatively.

| Autonomy level | Behavior | Prototype support |
|---|---|---|
| Level 0: Observe | Monitor and summarize only | Yes |
| Level 1: Suggest | Recommend action item | Yes |
| Level 2: Draft | Prepare email, Slack message, task, meeting invite | Yes |
| Level 3: Approve-to-execute | Execute only after human approval | Yes |
| Level 4: Low-risk autopilot | Auto-create internal reminders/tasks | Later |
| Level 5: Restricted | External or sensitive action always needs approval | Yes |

---

## 3. Target users and use cases

### 3.1 Primary target users

| User | Main problem | Hermes value |
|---|---|---|
| Founder/CEO | Too many signals across tools; missed decisions/follow-ups | Morning briefing, action inbox, top risks, company timeline |
| COO | Operational coordination and ownership gaps | Commitments, blockers, meeting follow-up, action tracking |
| CTO/engineering lead | GitHub/Linear issues, release approvals, incidents | GitHub/Linear summaries, blocker detection, release action cards |
| CRO/sales lead | Missed customer follow-ups, stale pipeline, renewal risk | Follow-up detection, customer action cards, meeting prep |
| CFO/founder finance | Reports, investor updates, approvals | Briefings, approval queue, source-backed summaries |
| Chief of staff | Manual coordination and tracking | Decision ledger, action tracking, weekly pulse |

### 3.2 Universal cross-domain jobs-to-be-done

Hermes is horizontal, so the MVP should focus on universal operating primitives rather than domain-specific expertise:

- “Prepare me for today.”
- “Tell me what changed since yesterday.”
- “Show what needs approval.”
- “Find unanswered important emails.”
- “Detect commitments and owners.”
- “Prepare meeting context.”
- “Draft the next email/Slack message.”
- “Track whether the action happened.”
- “Remember what we decided and why.”

---

## 4. MVP scope

### 4.1 Confirmed first-phase priority list

| Priority | Feature | Status |
|---|---|---|
| P0 | Gmail connection | Required |
| P0 | Calendar connection | Required |
| P0 | Slack connection | Required |
| P0 | Morning briefing | Required |
| P0 | Action Inbox | Required |
| P0 | Meeting prep | Required |
| P0 | Draft email | Required |
| P0 | Draft Slack DM/message | Required |
| P0 | Approval before execution | Required |
| P0 | Audit log | Required |
| P0 | Integration health | Required |
| P0 | Trust Center | Required |
| P0.5 | GitHub read integration | Strongly recommended for prototype |
| P0.5 | Linear read integration | Strongly recommended for prototype |
| P1 | Basic memory | Required foundation, but keep narrow |
| P1 | GitHub/Linear write actions | Later unless needed for a pilot demo |
| P1 | Full “why Hermes thinks this matters” panel | TODO; include a simple reason/source version in P0 |

### 4.2 P0 user journey

```text
1. User creates org.
2. User connects Gmail, Calendar, Slack.
3. Optional: connects GitHub and Linear.
4. Hermes performs initial sync.
5. Hermes generates first briefing.
6. User sees Action Inbox.
7. User opens an action card.
8. Hermes shows source-backed reason and prepared draft.
9. User edits/approves/rejects.
10. Hermes executes approved action.
11. Hermes logs result in Audit Log and Trust Center.
```

### 4.3 Prototype success criteria

The prototype succeeds if a pilot/investor can understand the product in 5 minutes:

- The dashboard is not chat-first.
- The morning briefing is useful without asking.
- The Action Inbox feels like the main product.
- Every action has a clear reason and source.
- External actions require approval.
- Integration health and failures are visible.
- Company Brain is tangible through memories, decisions, commitments, and source-backed context.

---

## 5. Product modules

## 5.1 Home / Command Center

**Purpose:** Executive landing surface for the day.

**Primary sections:**

- Daily briefing summary
- Top priority action
- Pending approvals
- Today’s meetings
- Critical risks
- Connected systems health
- Recent activity
- This week at a glance

**Feature assessment:**

| Item | Assessment |
|---|---|
| User value | Very high |
| Engineering difficulty | Medium |
| Prototype priority | P0 |
| Risk | Generic dashboard with too many cards |
| Standard | Must be action-oriented, not just informative |

**Required UI behavior:**

Every insight should either have a next action or explain why no action is possible.

```text
Weak: 2 customer issues detected.
Strong: 2 customer issues detected. Hermes prepared 1 customer update and 1 Slack escalation.
```

---

## 5.2 Morning Briefing

**Purpose:** Hermes should prepare the company leader before the day starts.

**P0 briefing sections:**

1. Today’s calendar.
2. Meetings needing prep.
3. Pending approvals.
4. Important unanswered emails.
5. Slack threads needing attention.
6. GitHub/Linear blockers.
7. Overdue follow-ups.
8. New risks.
9. Recommended next actions.
10. Data freshness/coverage.

**Example briefing:**

```text
Good morning, Alex.

Today needs your attention:
1. 3 meetings need preparation.
2. 4 actions need approval.
3. 2 important Gmail threads are unanswered.
4. 1 Linear release blocker affects today’s deployment.
5. 1 GitHub PR is ready but not merged.

Highest-impact action:
Approve the customer update for Acme.
Reason: Payment issue affects 3 customers and a meeting is scheduled tomorrow.
```

**Feature assessment:**

| Item | Assessment |
|---|---|
| User value | Extremely high |
| Engineering difficulty | Medium-Hard |
| Prototype priority | P0 |
| Real-time requirement | Near-real-time, plus visible freshness |
| Failure risk | Stale briefing from failed sync |

**Required failure visibility:**

Every briefing must show data coverage:

```text
Sources used:
Gmail synced 07:54
Calendar synced 07:55
Slack synced 07:56
GitHub synced 07:48
Linear failed at 07:52; retrying
```

---

## 5.3 Action Inbox

**Purpose:** Main work surface. This is the core product.

**Action types:**

- Send email
- Draft email
- Send Slack DM/message
- Create calendar event
- Prepare meeting brief
- Create Linear task
- Comment on GitHub PR
- Remind owner
- Request decision
- Escalate issue
- Review document/report
- Snooze/delegate existing action

**Action card fields:**

```text
action_id
org_id
owner_user_id
action_type
title
summary
reason
impact_level
risk_level
confidence_score  // TODO in full P1 form
source_artifacts
draft_payload
approval_required
approval_status
execution_status
due_at
created_from_signal_id
idempotency_key
created_at
updated_at
```

**P0 card layout:**

```text
[High impact] Send follow-up email to Acme CFO
Reason: Renewal meeting happened 5 days ago and no follow-up was sent.
Sources: Calendar event, Gmail thread.
Draft: [editable email]
Actions: Approve / Edit / Reject / Snooze / Delegate
```

**P1 TODO: “Why Hermes thinks this matters” deep panel**

The full panel should include:

- source evidence,
- business impact,
- confidence,
- possible downside,
- what Hermes might be missing,
- similar past actions,
- execution risk.

**Feature assessment:**

| Item | Assessment |
|---|---|
| User value | Extremely high |
| Engineering difficulty | Medium-Hard |
| Prototype priority | P0 |
| Risk | Duplicate/spammy actions |
| Required mitigation | Deduplication, idempotency keys, usefulness feedback |

---

## 5.4 Meeting Prep

**Purpose:** Prepare the user before each meeting and produce follow-up actions after.

**P0 input sources:**

- Calendar attendees/title/description.
- Related Gmail threads.
- Related Slack mentions/channels.
- Related Linear issues/GitHub PRs when matched.
- User/company memory.

**P0 output:**

```text
Meeting: Product release review
Time: 11:00 AM
Attendees: Alex, Priya, Engineering team

Context:
- Release v2.6.3 is waiting for approval.
- GitHub PR #1289 passed checks.
- Linear issue LINR-4821 is still open.

Suggested agenda:
1. Confirm blocker status.
2. Decide whether to ship today.
3. Assign customer communication owner.

Prepared actions:
- Draft Slack update to #eng.
- Create Linear follow-up for release owner.
```

**Feature assessment:**

| Item | Assessment |
|---|---|
| User value | Very high |
| Engineering difficulty | Medium |
| Prototype priority | P0 |
| Risk | Wrong entity matching |
| Required mitigation | Attendee/domain matching, source previews, confidence labels |

---

## 5.5 Gmail Connection

**P0 capabilities:**

- OAuth connection.
- Read recent threads.
- Search by sender/domain/date.
- Detect unanswered important threads.
- Detect follow-up opportunities.
- Draft email.
- Send email only after explicit approval.
- Show Gmail freshness in Trust Center.

**Minimum scopes:**

Start with least privilege. Prefer read + draft/send only when the user opts into sending.

**Failure modes:**

| Failure | User-visible state |
|---|---|
| OAuth expired | “Gmail disconnected. Reconnect required.” |
| Partial sync | “Only 312/420 threads synced. Some results may be incomplete.” |
| Send failed | Action status: failed; show reason and retry button |
| Missing scope | “Hermes can draft but cannot send until send permission is granted.” |

---

## 5.6 Google Calendar Connection

**P0 capabilities:**

- OAuth connection.
- List today/upcoming events.
- Identify meetings needing prep.
- Find free slots.
- Draft/suggest meeting invites.
- Create event only after approval.
- Show calendar conflicts.

**Feature assessment:**

| Item | Assessment |
|---|---|
| User value | Very high |
| Engineering difficulty | Medium |
| Prototype priority | P0 |
| Risk | Time zones and attendee availability |
| Required mitigation | Explicit timezone display and invite preview |

---

## 5.7 Slack Connection

**P0 capabilities:**

- OAuth connection.
- Read selected public channels and approved private channels.
- Search messages/threads.
- Detect mentions, commitments, blockers, unanswered requests.
- Draft Slack message/DM.
- Post only after approval.
- Show selected channels and scopes in Trust Center.

**Important policy:**

Do not automatically ingest all private channels. Channel selection must be visible and editable.

**Failure modes:**

| Failure | User-visible state |
|---|---|
| Bot lacks channel access | “Slack channel not accessible. Invite Hermes or skip this source.” |
| Rate limit | “Slack rate limit reached. Next sync in X minutes.” |
| Message draft recipient ambiguous | Require user confirmation |

---

## 5.8 GitHub Connection

**P0.5 capabilities:**

- Connect GitHub.
- Read repos/PRs/issues/commits.
- Detect PRs waiting for review.
- Summarize recent repo activity.
- Surface release blockers.
- Link GitHub changes to meeting prep and daily briefing.

**P1 write actions:**

- Comment on PR after approval.
- Create issue after approval.

**Why include early:**

For CTO/founder demos, GitHub makes Hermes feel operational instead of generic.

---

## 5.9 Linear Connection

**P0.5 capabilities:**

- Connect Linear.
- Read projects/issues/cycles.
- Detect blocked/stale issues.
- Surface release blockers.
- Include Linear status in meeting prep and daily brief.

**P1 write actions:**

- Create Linear issue after approval.
- Update status after approval.

---

## 5.10 Trust Center

**User confirmed:** Include in v1.

**Purpose:** Make trust and failures visible.

**P0 sections:**

1. Connected tools.
2. Last sync time.
3. Granted permissions/scopes.
4. Sync health and failed jobs.
5. Extracted memories.
6. Executed actions.
7. Approval history.
8. Data retention controls.
9. Disconnect and revoke access.
10. Audit log export.

**Example Trust Center card:**

```text
Gmail
Status: Connected
Last successful sync: 08:02 AM
Scope: Read email, create drafts
Send permission: Disabled
Objects synced today: 482 threads
Failures: 0
```

**Feature assessment:**

| Item | Assessment |
|---|---|
| User value | High for trust, high for pilots |
| Engineering difficulty | Medium |
| Prototype priority | P0 |
| Risk | Hidden backend-only trust |
| Standard | Trust must be part of the UI, not just logs |

---

## 5.11 Audit Log

**Purpose:** Complete trace of what Hermes saw, created, recommended, executed, or failed to do.

**Events to log:**

- integration connected/disconnected,
- sync started/completed/failed,
- briefing generated,
- action item created,
- draft generated,
- approval requested,
- approval accepted/rejected/edited,
- execution attempted/completed/failed,
- memory created/edited/deleted,
- permission denied,
- LLM/provider/tool failure.

**Required fields:**

```text
audit_id
org_id
actor_type       // user, system, agent
actor_id
event_type
object_type
object_id
source_ids
before_state
after_state
failure_reason
created_at
```

---

## 5.12 Integration Health

**Purpose:** Prevent silent failure.

**P0 visible states:**

```text
healthy
syncing
partial
stale
rate_limited
permission_error
oauth_expired
failed
not_connected
```

Every integration needs:

- last successful sync,
- last attempted sync,
- number of objects scanned,
- number skipped,
- failure reason,
- retry status,
- granted scopes,
- data freshness warning.

---

## 5.13 Ask Hermes Chat

**Purpose:** Manual command interface.

Chat should support:

- ask questions,
- request a custom briefing,
- create action cards,
- correct memory,
- ask “why did Hermes suggest this?”,
- debug “what did Hermes use to decide this?”,
- run deeper investigations.

**Design rule:** Chat output should create or reference objects.

```text
User: What needs my attention?
Hermes: You have 5 items. I created 3 action cards, 1 meeting prep card, and 1 memory conflict for review.
```

---

## 6. Core architecture: 10-layer system

## Layer 1 — Auth, organization, and permissions

- Users, organizations, memberships, roles.
- OAuth scopes and permission boundaries.
- Row-level security and org isolation.
- User-specific access controls.

**Non-negotiable:** every table and memory object must be `org_id` scoped. Every source object must carry permission metadata.

---

## Layer 2 — Connector and credential layer

Connectors:

- Gmail
- Google Calendar
- Slack
- GitHub
- Linear

Future:

- Drive
- Notion
- HubSpot/Salesforce
- Sentry
- PostHog
- Zendesk
- QuickBooks/Stripe

Credential requirements:

- encrypted at rest,
- scoped OAuth permissions,
- refresh token lifecycle,
- disconnect cleanup,
- per-org credentials,
- credential health checks.

---

## Layer 3 — Sync and real-time event ingestion

**Goal:** near-real-time, not fake real-time.

Sources should use webhooks/events where possible and polling where necessary.

```text
Webhook/Event → Validate → Store raw event → Normalize → Detect signals → Update UI
Polling sync → Store source object → Normalize → Detect signals → Update UI
```

**Reality check:** not every connector will be truly real-time in v1. Real-time must be defined as an SLA:

| Source | P0 approach | Freshness target |
|---|---|---|
| Calendar | polling + incremental sync | 1-5 min |
| Gmail | polling initially; Pub/Sub later | 5-15 min initially |
| Slack | events/webhooks where possible | seconds-minutes |
| GitHub | webhooks/polling | seconds-5 min |
| Linear | webhooks/polling | seconds-5 min |

Every UI surface must show freshness.

---

## Layer 4 — Raw event and source object store

Store source data before interpretation.

**Tables:**

```text
source_objects
raw_events
sync_runs
webhook_deliveries
```

**Why:** If Hermes makes a bad recommendation, you need to replay the source path and debug it.

---

## Layer 5 — Normalization and entity resolution

Convert raw tool-specific objects into Hermes-native objects:

```text
EmailThread
SlackThread
CalendarEvent
GitHubPR
GitHubIssue
LinearIssue
Person
ExternalContact
Project
Document
```

Entity resolution examples:

- Gmail contact ↔ Calendar attendee ↔ Slack user ↔ GitHub user.
- Acme in Gmail ↔ Acme.com domain ↔ Acme meeting.
- Linear issue ↔ GitHub PR ↔ Slack thread.

P0 entity matching can be simple:

- email address,
- domain,
- Slack user email,
- GitHub verified email when available,
- explicit user correction.

---

## Layer 6 — Signal detection

Signals are Hermes’ interpretation of company activity.

P0 signal types:

- unanswered important email,
- meeting prep needed,
- follow-up due,
- decision needed,
- approval needed,
- Slack blocker,
- GitHub PR ready/stale,
- Linear issue blocked/stale,
- commitment candidate,
- risk candidate.

Detection methods:

```text
Rules first → cheap classifiers → LLM extraction only when useful
```

Do not send every raw message to a large model. Use prefilters.

---

## Layer 7 — Company Brain / operational memory

The Company Brain is not a vector database. It is a permission-aware operational memory of:

- people,
- teams,
- tools,
- projects,
- meetings,
- action items,
- decisions,
- commitments,
- risks,
- approvals,
- execution history,
- extracted facts,
- source-backed relationships.

See section 7 for the detailed memory architecture.

---

## Layer 8 — Action generation and prioritization

Convert signals into action items.

```text
Signal → candidate action → dedupe → rank → draft payload → Action Inbox
```

Prioritization factors:

- urgency,
- business impact,
- external/customer relevance,
- deadline,
- owner seniority,
- meeting proximity,
- recurring issue,
- confidence,
- risk level,
- user preferences.

---

## Layer 9 — Approval and execution engine

Write actions must pass through the approval engine.

Action state machine:

```text
detected
→ drafted
→ pending_approval
→ approved
→ executing
→ completed
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

Execution tools:

- Gmail draft/send,
- Slack DM/post,
- Calendar create/update,
- GitHub comment/create issue,
- Linear create/update.

---

## Layer 10 — Observability, Trust Center, evaluation, and UI surfaces

This layer makes the system safe and sellable.

Includes:

- Trust Center,
- audit logs,
- integration health,
- LLM traces,
- prompt/model version logs,
- action execution logs,
- evals,
- cost tracking,
- dashboard freshness indicators,
- replay/debug tooling.

---

## 7. Memory architecture

## 7.1 Recommendation

Build Hermes’ source-of-truth memory yourself, then optionally use Zep or Mem0 as a context retrieval sidecar.

Do **not** make Zep or Mem0 the primary operational memory. Hermes needs source-backed action history, approvals, permissions, audit logs, entity resolution, and execution state. A memory framework can help with context assembly, but it should not own the business-critical objects.

**Recommended P0 memory stack:**

```text
PostgreSQL: source-of-truth operational objects
pgvector: semantic retrieval
Redis: session/working memory and realtime queues
Optional Zep/Mem0 adapter: context sidecar experiments only
```

**Future option:** use a graph DB or temporal graph framework when relationship queries become a bottleneck.

---

## 7.2 The Company Brain should be temporal and source-backed

Every memory should have:

```text
id
org_id
memory_type
content
source_ids
source_permissions
confidence
valid_from
valid_until
created_at
updated_at
last_confirmed_at
created_by
access_scope
```

Why temporal memory matters:

```text
Sarah owns hiring.
```

may be true in April and false in June.

So Hermes should store:

```text
Sarah owns hiring
valid_from: 2026-04-01
valid_until: 2026-05-18
confidence: 0.82
source: Slack thread + meeting note
```

---

## 7.3 Memory layers

| Layer | Storage | Purpose | P0? |
|---|---|---|---|
| Working/session memory | Redis | Current conversation and temporary state | Yes |
| Raw source memory | PostgreSQL | Emails, messages, calendar events, PRs, issues | Yes |
| Operational objects | PostgreSQL | Actions, decisions, commitments, risks, approvals | Yes |
| Semantic memory | pgvector | Search relevant source objects/memories | Yes |
| Temporal graph | Postgres edge table initially | Relationships over time | P0 foundation |
| User preferences | PostgreSQL | Briefing preferences, approval rules, tone | P1 |
| Zep/Mem0 sidecar | External/optional | Context assembly experiment | Optional |
| Dedicated graph DB | Neo4j/FalkorDB/etc. | Complex graph queries | Later |

---

## 7.4 Temporal graph model

Start with Postgres tables, not a separate graph DB.

**Nodes:**

```text
person
team
external_contact
company_account
tool_account
project
meeting
email_thread
slack_thread
github_pr
github_issue
linear_issue
document
action_item
decision
commitment
risk
approval
execution
```

**Edges:**

```text
owns
attended
mentioned
blocked_by
related_to
created_from
approved_by
executed_by
assigned_to
committed_to
decided_in
supersedes
contradicts
```

**Edge schema:**

```sql
CREATE TABLE graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  from_type TEXT NOT NULL,
  from_id UUID NOT NULL,
  edge_type TEXT NOT NULL,
  to_type TEXT NOT NULL,
  to_id UUID NOT NULL,
  confidence NUMERIC DEFAULT 0.5,
  source_ids UUID[] NOT NULL DEFAULT '{}',
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

This gives you temporal graph behavior without adding graph DB complexity too early.

---

## 7.5 Memory extraction policy

Do not blindly extract memory from everything.

P0 extraction targets:

- explicit decisions,
- commitments,
- ownership statements,
- preferences,
- recurring workflows,
- project/customer context,
- action outcomes.

P0 extraction states:

```text
candidate
confirmed
rejected
expired
conflicted
```

Example:

```text
Candidate memory:
“Priya owns the v2.6.3 deployment.”

Source:
Slack thread #eng, Linear project note.

User action:
Confirm / Edit / Reject
```

---

## 7.6 Memory failure modes

| Failure | Severity | Required mitigation |
|---|---|---|
| Private source summarized into public memory | Critical | Memory inherits strictest source ACL |
| Stale memory used confidently | Critical | Validity windows + freshness indicators |
| Contradictory ownership | High | Create memory conflict, ask user to resolve |
| Over-extraction creates noise | Medium | Candidate state + usefulness feedback |
| Vector search retrieves related but wrong memory | High | Hybrid retrieval + source validation + reranking |
| Memory framework outage | Medium | Do not depend on sidecar for source-of-truth |

---

## 7.7 Zep / Mem0 / custom build assessment

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| Custom Postgres + pgvector + Redis | Full control, permissions, audit, source-of-truth | More engineering | Use as P0 core |
| Zep | Temporal knowledge graph/context assembly can accelerate memory UX | Vendor dependency; must still handle Hermes-specific approvals and audit | Optional sidecar after P0 source-of-truth exists |
| Mem0 | Self-host option, memory layers, easier experimentation | Still not full operational memory/action system | Optional for experimentation |
| Dedicated graph DB | Powerful relationship queries | Adds infra and query complexity | Later, only if Postgres edge table is insufficient |

---

## 8. Real-time requirements

## 8.1 Definition

Hermes should feel real-time, but the product must be honest.

**Real-time means:**

- event appears quickly when provider supports events/webhooks,
- polling fallback when provider does not,
- UI shows freshness,
- stale data is clearly labeled,
- failures are visible.

## 8.2 P0 real-time architecture

```text
Provider event/webhook/poll
→ ingestion endpoint
→ raw_event table
→ Redis Stream / queue
→ normalizer worker
→ signal detector
→ action generator
→ WebSocket/SSE UI update
```

## 8.3 Real-time failure visibility

If a pipeline stage fails:

```text
Slack event received → normalization failed → action not generated
```

Hermes must show this internally and, if relevant, in Trust Center.

---

## 9. Feature assessment matrix

| Feature | User value | Difficulty | P0/P1 | Feasible? | Notes |
|---|---:|---:|---|---|---|
| Morning briefing | Very high | Medium-Hard | P0 | Yes | Core demo |
| Action Inbox | Very high | Medium-Hard | P0 | Yes | Core product |
| Gmail connect/read | Very high | Medium | P0 | Yes | OAuth complexity |
| Gmail draft/send approval | Very high | Medium-Hard | P0 | Yes | Must require approval |
| Calendar connect/read | High | Medium | P0 | Yes | Timezone handling |
| Calendar create event approval | High | Medium | P0 | Yes | Preview before create |
| Slack connect/read | High | Medium | P0 | Yes | Scopes/channels matter |
| Slack draft/send approval | High | Medium | P0 | Yes | Avoid wrong channel |
| Trust Center | High | Medium | P0 | Yes | Make trust visible |
| Audit log | High | Medium | P0 | Yes | Required |
| Integration health | High | Medium | P0 | Yes | Required |
| Meeting prep | High | Medium | P0 | Yes | Good demo |
| GitHub read | Medium-High | Medium | P0.5 | Yes | Useful for CTO/eng demos |
| Linear read | Medium-High | Medium | P0.5 | Yes | Useful for operations demos |
| Basic memory | High | Medium-Hard | P1 | Yes | Keep constrained |
| Temporal graph | High future value | Hard | P1 foundation | Yes | Use Postgres edge table first |
| Full graph DB | Future value | High | Later | Yes | Not P0 |
| Full autonomy | Risky | Very High | Later | No for P0 | Needs trust first |
| Team morale scoring | Risky | Medium | Avoid | Technically possible | Feels invasive and unreliable |
| Agent marketplace | Low P0 value | High | Later | Yes | Premature |
| Self-improving agents | Unclear | Very High | Avoid | Research-grade | Not needed |

---

## 10. Future TODOs

### 10.1 Product TODOs

- Full “Why Hermes thinks this matters” panel.
- User-configurable briefing preferences.
- Role modes: CEO, COO, CTO, CFO, CRO.
- Weekly executive pulse.
- Decision ledger UI.
- Commitment tracker UI.
- Company timeline.
- Action replay/debug screen.
- Low-risk autopilot for internal reminders.
- Pilot ROI dashboard.
- Workflow templates.

### 10.2 Engineering TODOs

- Add Drive/Notion ingestion.
- Add HubSpot/Salesforce for revenue signals.
- Add eval suite for action suggestions.
- Add prompt/model version tracking.
- Add PII/sensitive-data classifiers.
- Add dedicated graph DB only after relationship queries demand it.
- Add Zep/Mem0 comparison spike after P0 is stable.
- Add Gmail Pub/Sub if polling is too stale.
- Add Sentry/PostHog for CTO/product pilots.

### 10.3 AskUserQuestion expansion decisions

**AskUserQuestion:** Should Hermes ship role modes in prototype: CEO, COO, CTO, CFO, CRO?  
Reason: same backend, better first impression, but more design work.

**AskUserQuestion:** Should Hermes include Company Timeline in v1?  
Reason: makes Company Brain tangible; adds schema/UI complexity.

**AskUserQuestion:** Should Hermes include Pilot ROI Dashboard in v1?  
Reason: useful for sales conversion; requires measurement design.

**AskUserQuestion:** Should Hermes run a 7-day Shadow Mode for pilots before enabling execution?  
Reason: builds trust and collects accuracy metrics, but slows perceived activation.

---

## 11. Non-goals for prototype

Do not build these in the first phase:

- fully autonomous external sending,
- full no-code workflow builder,
- agent marketplace,
- full graph DB migration,
- team morale scoring from Slack,
- complex board reporting,
- custom MCP builder,
- self-improving agents,
- multi-modal RAG,
- enterprise SSO.

---

## 12. Definition of done for prototype

Hermes prototype is done when:

- Gmail, Calendar, Slack connect and sync.
- GitHub and Linear read integrations work or have a clear demo-ready path.
- Morning briefing generates automatically.
- Action Inbox contains real generated actions.
- User can approve/edit/reject an email draft.
- User can approve/edit/reject a Slack draft.
- Meeting prep works for upcoming events.
- Trust Center shows connected tools, permissions, freshness, memories, and executed actions.
- Audit log records every action and failure.
- Basic memory stores source-backed decisions/commitments/preferences.
- No stale/failed sync is hidden.
- Demo can be completed with realistic seeded data and at least one real connected workspace.

