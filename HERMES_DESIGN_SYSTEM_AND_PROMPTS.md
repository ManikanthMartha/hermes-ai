# Hermes Design System and Generation Prompts

**Version:** v0.1 design direction  
**Date:** 2026-05-10  
**Product direction:** Hermes as Action OS, not chatbot  
**Recommendation:** keep the existing visual direction, tighten typography, strengthen action hierarchy, and make trust/freshness visible everywhere.

---

## 1. Design verdict

The current Hermes design direction is good. Do not throw it away.

It already communicates:

- calm trust,
- operational clarity,
- executive usability,
- warm differentiation from generic AI SaaS,
- product-system seriousness,
- approachable non-technical UX.

The design should evolve from **AI Chief of Staff dashboard** to **Action OS command surface**.

The current design board uses a warm copper/amber identity, soft off-white surfaces, status components, approval cards, connected tool cards, and dashboard previews. That is directionally correct. Keep the copper identity. Avoid purple/violet gradients and generic AI-glow aesthetics.

---

## 2. Chosen aesthetic direction

### Primary aesthetic

**Industrial/Utilitarian + Luxury/Refined**

Hermes should feel like:

```text
Swiss control room + executive operating system + warm messenger brand.
```

Not:

```text
AI toy, chatbot, crypto dashboard, generic SaaS landing page, purple gradient wrapper.
```

### Decoration level

**Intentional**

Use subtle texture, fine borders, operational diagrams, source trails, and tiny motion. Do not use heavy gradients or mascot-heavy illustrations.

### Layout approach

**Hybrid**

- Product app: strict grid-disciplined layout.
- Marketing site: editorial, high-whitespace, asymmetric sections, proof-driven storytelling.

### Color approach

**Restrained/balanced**

Use one brand accent plus semantic colors. Color must mean something.

### Motion approach

**Minimal-functional / intentional**

Motion should show cause and effect:

- signal becomes action,
- approval becomes execution,
- sync changes freshness,
- a briefing item expands to sources.

No decorative bouncing, no AI sparkle overload.

---

## 3. Brand concept

### Brand promise

> Hermes turns scattered company activity into clear next actions.

### Brand personality

- calm,
- precise,
- trustworthy,
- quietly intelligent,
- action-oriented,
- non-technical,
- serious enough for executives,
- warm enough for SMB teams.

### Avoid copy patterns

Do not use:

- “Built for X”
- “Designed for Y”
- “10x your workflow”
- “AI-powered productivity”
- “Supercharge your team”
- “Your second brain” unless deeply explained
- generic “chat with your company”

Use:

- “Your company, already organized.”
- “Every morning, the work is already sorted.”
- “From scattered signals to approved action.”
- “Know what changed. Approve what’s next.”
- “The operating layer between your tools.”

---

## 4. Color system

Keep the current warm identity and refine it.

### Core palette

| Token | Use | Hex |
|---|---|---|
| `brand.copper` | Primary action, logo, active states | `#D57006` |
| `brand.amber` | Highlights, attention, small accents | `#F59E0B` |
| `success.sage` | Completed, healthy, connected | `#16A34A` |
| `info.sky` | Informational states | `#0EA5E9` |
| `danger.coral` | Destructive/error | `#EF4444` |
| `neutral.950` | Primary text, deep navy-black | `#0B1220` |
| `neutral.900` | Strong text/sidebar | `#0F172A` |
| `neutral.700` | Secondary text | `#334155` |
| `neutral.500` | Muted text | `#64748B` |
| `neutral.300` | Borders | `#CBD5E1` |
| `neutral.200` | Dividers/subtle fills | `#E2E8F0` |
| `neutral.100` | Soft panels | `#F1F5F9` |
| `surface.white` | Main cards | `#FFFFFF` |
| `surface.page` | Page background | `#FAF7F2` |
| `surface.stone` | Warm secondary surfaces | `#F8F1E6` |

### Color behavior

- Brand copper is used for primary actions and selected nav.
- Amber is used sparingly for highlights, not as a giant gradient.
- Red/coral only for destructive or failed states.
- Green only for completed/healthy/connected states.
- Neutral backgrounds dominate.

### Dark mode

Do not prioritize dark mode for prototype. If added later, make it a serious operations console, not neon cyberpunk.

---

## 5. Typography system

The existing board likely uses familiar SaaS typography. Keep the feel, but avoid overused primary fonts.

### Recommended stack

| Purpose | Font |
|---|---|
| Display / hero | **General Sans** or **Cabinet Grotesk** |
| Body / product UI | **Instrument Sans** |
| Data / tables / numeric UI | **Geist** with tabular nums or **IBM Plex Mono** |
| Code / logs | **JetBrains Mono** |

### Do not use as primary

- Inter,
- Roboto,
- Arial,
- Helvetica,
- Open Sans,
- Lato,
- Montserrat,
- Poppins,
- Space Grotesk.

### Type scale

| Token | Size / line | Use |
|---|---|---|
| Display | 56/60 | Marketing hero |
| H1 | 36/44 | Page titles |
| H2 | 28/36 | Major sections |
| H3 | 20/28 | Card groups |
| Body | 15/24 | Main product text |
| Small | 13/20 | Metadata, helper text |
| Caption | 12/16 | Labels, timestamps |
| Data | 13/20 | Tables, logs, statuses |

---

## 6. Component principles

### 6.1 Action cards are the main component

Every action card should show:

- what Hermes wants to do,
- why it matters,
- source evidence,
- risk/impact,
- draft payload,
- approval controls,
- execution status.

P0 compact structure:

```text
[Impact chip] [Action title]
Reason in one sentence.
Sources: Gmail, Calendar, Slack
Draft preview
Approve / Edit / Reject / Snooze
```

P1 full structure:

```text
Why Hermes thinks this matters
- Evidence
- Impact
- Confidence
- Possible downside
- Missing context
- Similar past actions
```

### 6.2 Trust must be visible

Show sync state and source coverage directly in the surfaces where it matters.

Examples:

```text
Briefing generated from Gmail, Calendar, Slack.
GitHub stale since 07:42.
```

```text
This action used 3 sources.
View source trail.
```

### 6.3 Non-technical language

Avoid terms like:

- embeddings,
- RAG,
- LangGraph,
- vector search,
- MCP,
- agent orchestration,
- temporal graph.

Use:

- connected tools,
- memory,
- sources,
- actions,
- approvals,
- history,
- status,
- freshness.

### 6.4 Progressive disclosure

Default screen should be simple.

Detailed evidence and debug data should be available through:

- source drawer,
- Trust Center,
- audit log,
- action replay.

---

## 7. Product IA / navigation

Recommended app navigation:

```text
Home
Briefings
Action Inbox
Meetings
Ask Hermes
Company Brain
Connections
Trust Center
Reports
Settings
```

### Home

- Morning briefing.
- Top priority.
- Pending approvals.
- Today’s meetings.
- Systems health.
- Recent activity.

### Briefings

- Daily briefing.
- End-of-day summary.
- Weekly pulse.
- Past briefings.

### Action Inbox

- Needs approval.
- Needs decision.
- Needs follow-up.
- Drafts ready.
- Snoozed.
- Completed.

### Meetings

- Today.
- Upcoming.
- Needs prep.
- Follow-ups.

### Company Brain

- Memories.
- Decisions.
- Commitments.
- People.
- Projects.
- Source timeline.

### Trust Center

- Connected tools.
- Permissions.
- Sync health.
- Extracted memories.
- Executed actions.
- Audit log.

---

## 8. Website direction

The website should sell Action OS, not AI chat.

### Hero concept

**Headline options:**

```text
Your company’s next actions, ready before you ask.
```

```text
The Action OS between your tools.
```

```text
Every morning, Hermes turns company activity into action.
```

### Hero visual

Use a product interface visual, not stock people.

Best hero visual:

```text
A large Hermes dashboard showing:
- Morning briefing
- Pending approvals
- Source trail
- Action card moving from Draft → Approved → Sent
- Tool freshness row
```

### Page sections

1. Hero: clear action OS positioning.
2. The problem: work scattered across tools.
3. The Hermes loop: Observe → Decide → Act → Report.
4. Daily briefing.
5. Action Inbox.
6. Company Brain.
7. Trust Center.
8. Integrations.
9. Pilot CTA.

### No generic 3-column feature grid

If using feature sections, make them story-driven and product-led.

---

## 9. Illustration and imagery style

Use:

- product screenshots,
- interface close-ups,
- simple system diagrams,
- abstract tool-to-action flows,
- source trails,
- cards transforming into actions,
- soft technical line drawings.

Avoid:

- generic SaaS people smiling at laptops,
- purple glow or AI orb,
- humanoid robots,
- busy gradients,
- 3D cartoon characters,
- empty “AI magic” sparkles.

Illustration concept:

```text
Signals flowing from Gmail, Slack, Calendar, GitHub, Linear into a Hermes action card.
The action card has an approval stamp and a source trail.
```

---

## 10. Motion rules

Motion should clarify system behavior.

Examples:

- New source event arrives → small pulse in activity feed.
- Signal becomes action → card slides into Action Inbox.
- User approves → status changes from pending to executing to completed.
- Integration stale → health indicator changes and explains why.
- Briefing expands → source trail appears.

Avoid decorative animation that does not communicate state.

---

# 11. Prompt 1 — Design system generation prompt

Use this prompt to generate or refine the Hermes design system.

```text
You are a senior product designer with strong opinions about typography, color, and visual systems. You don't present menus — you listen, think, research, and propose. You're opinionated but not dogmatic. You explain your reasoning and welcome pushback.

Your posture: Design consultant, not form wizard. Propose a complete coherent design system for Hermes, an Action OS for companies. Hermes connects to Gmail, Calendar, Slack, GitHub, and Linear; monitors company activity; creates action items; prepares daily briefings; requests approvals; executes approved actions; and maintains a permissioned Company Brain.

Design direction:
- Aesthetic: Industrial/Utilitarian + Luxury/Refined.
- Decoration level: intentional, not expressive.
- Layout: grid-disciplined for product UI, hybrid/editorial for marketing.
- Color: restrained/balanced, one warm brand accent plus semantic states.
- Motion: minimal-functional and intentional.

Existing brand direction to preserve:
- Warm copper/amber Hermes identity.
- Off-white page backgrounds.
- Calm executive dashboard feel.
- Source-backed trust and action approvals.
- Soft cards, fine borders, high readability.

Do not create generic AI slop. Never use:
- purple/violet gradients as default accent,
- 3-column feature grid with icons in colored circles,
- centered everything with uniform spacing,
- bubbly uniform border-radius everywhere,
- gradient primary buttons,
- stock-photo-style hero sections,
- system-ui or -apple-system as the primary display/body font,
- “Built for X” / “Designed for Y” marketing patterns.

Font rules:
- Recommend General Sans or Cabinet Grotesk for display.
- Recommend Instrument Sans for body/product UI.
- Recommend Geist or IBM Plex Mono for data/tables.
- Recommend JetBrains Mono for code/logs.
- Never recommend Papyrus, Comic Sans, Lobster, Impact, Jokerman, Bleeding Cowboys, Permanent Marker, Bradley Hand, Brush Script, Hobo, Trajan, Raleway, Clash Display, Courier New for body.
- Never use Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, Poppins, or Space Grotesk as the primary font unless explicitly requested.

Create a complete design system with:
1. Brand principles.
2. Color palette with tokens and usage rules.
3. Typography scale.
4. Spacing scale.
5. Radius, border, elevation, and shadow rules.
6. Iconography style.
7. Status chip system.
8. Action card component.
9. Approval card component.
10. Briefing card component.
11. Trust Center component system.
12. Table and audit-log design.
13. Empty states.
14. Loading and failure states.
15. Accessibility rules.
16. Motion principles.
17. Anti-patterns.

Make the design usable for non-technical executives. The product must feel like a calm operating system, not an AI chatbot.
```

---

# 12. Prompt 2 — Front-facing website prompt

Use this prompt to generate the marketing website.

```text
You are a senior product designer and frontend designer. Design the front-facing website for Hermes, an Action OS for companies.

Hermes is not a chatbot. Hermes connects to company tools, monitors activity, creates daily briefings, generates action items, requests approval, executes approved work, and stores operational memory in a permissioned Company Brain.

Design posture:
- Act as a design consultant, not a menu generator.
- Propose a complete coherent website direction.
- Explain the reasoning behind typography, spacing, hierarchy, visuals, and interaction.
- Welcome pushback but do not offer a bland set of options.

Aesthetic direction:
- Industrial/Utilitarian + Luxury/Refined.
- Warm, executive, highly readable, quietly technical.
- Inspired by premium product storytelling and modern AI infrastructure companies, but do not copy any brand.
- Avoid the generic AI startup look.

Visual system:
- Use warm copper as the primary accent, off-white page background, deep navy text, semantic colors for status.
- Use General Sans or Cabinet Grotesk for hero/display.
- Use Instrument Sans for body.
- Use Geist or IBM Plex Mono for data captions and system labels.
- Use subtle grain, fine borders, source trails, and product interface close-ups.
- Do not use purple gradients, AI orbs, humanoid robots, generic laptop stock photos, or 3-column icon grids.

Website pages/sections:
1. Hero section with clear positioning: “Your company’s next actions, ready before you ask.”
2. Product visual: Hermes dashboard showing morning briefing, action inbox, approvals, source trails, and tool health.
3. Problem section: work scattered across Gmail, Slack, Calendar, GitHub, Linear.
4. System loop section: Observe → Decide → Act → Report.
5. Daily briefing section.
6. Action Inbox section.
7. Company Brain section.
8. Trust Center section.
9. Integrations section.
10. Pilot CTA section.

Copy principles:
- Avoid “AI-powered productivity” and “supercharge.”
- Avoid “Built for X” / “Designed for Y.”
- Use grounded copy: “Hermes found 4 follow-ups, prepared 2 drafts, and flagged 1 stale integration.”
- Explain the product through real work, not vague AI promises.

UX requirements:
- Non-technical executives should understand it in 10 seconds.
- The hero must show that Hermes acts before the user chats.
- The page must emphasize approval, trust, and source-backed actions.
- Every major section should show a product artifact: briefing, action card, trust log, source trail, or approval state.

Deliver:
- Website design direction.
- Section-by-section layout.
- Recommended copy.
- Component notes.
- Motion notes.
- Responsive behavior.
- What images/illustrations to use.
- What to avoid.
```

---

# 13. Prompt 3 — Product web app pages prompt

Use this prompt to generate the Hermes product UI pages.

```text
You are a senior product designer and frontend designer. Design the Hermes product web app for the Action OS prototype.

Hermes is an action-first operating system for company leaders. It connects to Gmail, Calendar, Slack, GitHub, and Linear; monitors activity; generates morning briefings; creates action items; prepares drafts; requires approval for external actions; executes approved work; and keeps a permissioned Company Brain.

Design posture:
- Act like a design consultant with strong product judgment.
- Do not present a menu of unrelated styles.
- Propose a coherent product interface system and explain why it works.

Aesthetic direction:
- Industrial/Utilitarian + Luxury/Refined.
- Calm executive dashboard.
- Warm copper accent, off-white surface, deep navy text.
- Grid-disciplined layout.
- Action-first hierarchy.
- Trust and failure visibility are part of the UI.

Typography:
- Display/page titles: General Sans or Cabinet Grotesk.
- Body/product UI: Instrument Sans.
- Data/logs: Geist or IBM Plex Mono.
- Code/log traces: JetBrains Mono.
- Do not use Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, Poppins, or Space Grotesk as primary fonts.

Anti-slop rules:
- No purple/violet gradients.
- No centered-everything SaaS layout.
- No generic icon-in-circle 3-column grid.
- No gradient primary buttons.
- No stock photos.
- No bubbly rounded components everywhere.
- No vague AI magic visual language.

App pages to design:
1. Home / Command Center
   - morning briefing
   - top priority
   - pending approvals
   - today’s meetings
   - connected systems health
   - recent activity

2. Briefings
   - daily briefing
   - source coverage
   - stale source warnings
   - past briefings

3. Action Inbox
   - filters: needs approval, needs decision, follow-up, draft, completed, snoozed
   - action cards with impact/risk/source/status
   - approve/edit/reject/snooze/delegate controls
   - source drawer

4. Meetings
   - today/upcoming
   - meeting prep cards
   - attendees, context, related threads, suggested agenda, prepared actions

5. Ask Hermes
   - chat remains, but secondary
   - chat can create action items and answer questions with source-backed context

6. Company Brain
   - memories
   - decisions
   - commitments
   - people/projects
   - source timeline
   - memory correction/conflict states

7. Connections
   - connected tools
   - scopes
   - last sync
   - selected channels/repos/projects
   - disconnect/reconnect

8. Trust Center
   - granted permissions
   - sync health
   - extracted memories
   - executed actions
   - approval history
   - audit log
   - failure states

9. Reports
   - weekly pulse
   - actions completed
   - risks flagged
   - follow-ups recovered
   - system health

Required components:
- Action card
- Approval card
- Briefing card
- Meeting prep card
- Tool health card
- Source trail drawer
- Trust log table
- Memory object card
- Failure state component
- Empty state component
- Loading/syncing component

UX rules:
- Every action must show status.
- Every source-backed claim must expose sources.
- Every integration must show freshness.
- Every failure must be visible.
- External sends require approval.
- The user should rarely need to type into chat.

Deliver:
- Page-by-page layout description.
- Component hierarchy.
- Interaction states.
- Responsive behavior.
- Design tokens.
- Copy examples.
- Accessibility notes.
```

---

## 14. Product page examples

### Home / Command Center layout

```text
Top bar:
Good morning, Alex
Share briefing | New action | Profile

Left rail:
Home
Briefings
Action Inbox
Meetings
Ask Hermes
Company Brain
Connections
Trust Center
Reports
Settings

Main column:
Daily briefing
Today needs your attention
Ask Hermes compact command input
Recent activity

Right column:
Pending approvals
Systems health
This week
Recommended setup
```

### Action Inbox layout

```text
Header:
Action Inbox
Filters: All / Needs approval / Decisions / Follow-ups / Drafts / Snoozed / Completed

Action list:
[High impact] Send follow-up email to Acme CFO
Reason: Meeting happened 5 days ago and no follow-up was sent.
Sources: Gmail, Calendar
Status: Pending approval
Approve | Edit | Reject | Snooze

Right drawer:
Source trail
Draft payload
Audit timeline
Execution risk
```

### Trust Center layout

```text
Header:
Trust Center
“All systems healthy” or visible failure state

Sections:
Connected tools
Permissions and scopes
Sync health
Executed actions
Extracted memories
Audit log
Data controls
```

---

## 15. Design QA checklist

Before shipping UI:

- [ ] User can understand Hermes without chat.
- [ ] Action Inbox is visually primary.
- [ ] Approval states are obvious.
- [ ] Failed/stale integrations are visible.
- [ ] Every action has source evidence.
- [ ] Empty states tell the user what to do next.
- [ ] Copy is non-technical.
- [ ] Typography feels premium and readable.
- [ ] No purple gradient AI slop.
- [ ] Buttons are not all competing for attention.
- [ ] Semantic colors are consistent.
- [ ] Tables/logs are legible.
- [ ] Mobile view remains usable.

