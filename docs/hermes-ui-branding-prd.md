# Hermes UI and Branding PRD

## 1. Product Summary

Hermes is an enterprise-grade personal AI operations assistant. It connects to
the user's work tools, remembers durable context, routes tasks to specialist
agents, and performs approved actions.

Tagline:

```text
The messenger between your tools.
```

Primary product promise:

```text
One assistant that understands your work context across Gmail, Slack, GitHub,
Linear, Sentry, Calendar, memory, and saved sessions.
```

Hermes should feel like a serious operational command system, not a generic AI
chatbot.

## 2. Target User

Initial user:

- Solo founder
- Engineer/operator
- Works across many tools daily
- Needs recall, summaries, and controlled actions
- Wants speed and trust more than playful personality

Future user:

- Team member inside a workspace
- Connects personal work apps
- Shares selected context with an organization later through BetterAuth orgs

## 3. Brand Personality

Hermes should feel:

- precise
- quiet
- technical
- trusted
- fast
- executive
- observant
- tool-native

Hermes should not feel:

- cute
- consumer-chatbot-like
- overly friendly
- purple-gradient AI SaaS
- marketing-heavy
- cartoonish
- cluttered

## 4. Visual Direction

Concept:

```text
Enterprise command terminal meets ancient messenger mythology.
```

The UI should feel like a high-end operations console for an AI chief of staff.
It should preserve the current Hermes terminal-console style but make it more
enterprise-ready.

Core visual motif:

- dark warm ink background
- copper/amber signal color
- thin borders
- dense but readable layouts
- monospaced typography
- subtle grain/scanline texture
- agent activity shown as small status chips
- tool connections shown as precise operational modules

Avoid:

- large rounded chatbot bubbles
- floating gradient blobs
- purple/blue AI gradients
- marketing hero cards
- oversized illustrations
- random glassmorphism
- excessive shadows

## 5. Color System

Use the existing Hermes palette as the foundation.

### Dark Mode Primary

```text
Background: deep warm ink
CSS token: --background: oklch(0.128 0.004 60)

Foreground: warm off-white
CSS token: --foreground: oklch(0.92 0.006 80)

Card surface: raised dark ink
CSS token: --card: oklch(0.165 0.005 60)

Muted surface: warm charcoal
CSS token: --muted: oklch(0.2 0.004 60)

Border: subtle translucent white
CSS token: --border: oklch(1 0 0 / 7%)

Hermes accent: copper/amber
CSS token: --hermes: oklch(0.78 0.15 58)

Hermes foreground: dark copper ink
CSS token: --hermes-foreground: oklch(0.12 0.02 60)

Destructive: restrained red
CSS token: --destructive: oklch(0.68 0.19 22)
```

### Light Mode Secondary

Light mode should exist for enterprise readability, but dark mode is the primary
brand expression.

```text
Background: white
Foreground: near-black
Hermes accent: warm copper
Borders: light neutral gray
```

### Accent Usage Rules

Copper is a signal color, not a background wash.

Use copper for:

- active agent state
- brand mark
- primary action border
- approval focus
- selected session
- active integration
- streaming caret

Do not use copper for:

- large page backgrounds
- full message bubbles
- decorative gradients
- huge hero panels

## 6. Typography

Primary typography:

```text
IBM Plex Mono
```

Current product behavior:

- The UI is intentionally mono-heavy.
- `font-sans` maps to Plex Mono.
- `font-mono` can use Geist Mono or a tighter code mono for code/tool output.

Recommended hierarchy:

```text
Page titles: IBM Plex Mono, 20-28px, medium weight
Section labels: IBM Plex Mono, 10-11px, uppercase, wide tracking
Body text: IBM Plex Mono, 13-14px, regular
Tool output: Geist Mono or IBM Plex Mono, 11-12px
Status chips: 10-11px uppercase
```

Type should feel like infrastructure software, not a blog or marketing page.

## 7. Layout Principles

The app should prioritize actual workflows over landing-page marketing.

Primary app shell:

```text
Left rail: saved sessions, navigation, connection status
Center: chat/workspace stream
Right rail optional: memory, active tools, run details, approvals
Bottom: composer
```

Density:

- medium-high density
- no nested cards
- repeated items can be cards with small radius
- page sections should be bands or panels, not floating marketing blocks

Border radius:

```text
Small radius only: 2-6px
Avoid pill-heavy UI.
```

## 8. Core Product Features

### 8.1 Chat Workspace

The main screen is the usable assistant, not a landing page.

Requirements:

- saved sessions list
- message stream
- tool call panels
- agent routing notes
- approval cards
- streaming state
- error/retry state
- stop generation
- new chat

Chat should show Hermes working across specialists:

- Herald: router/planner
- Iris: Gmail/Slack/Calendar communication
- Talos: GitHub/Linear engineering/project work
- Argus: Sentry/ops

### 8.2 Saved Sessions

Chat history should behave like ChatGPT/Claude:

- left rail of recent sessions
- new chat button
- click session to reload
- session title from first user message
- timestamp and message count
- future: search sessions
- future: rename/delete/archive

### 8.3 Memory Layer UI

Memory should be visible and controllable.

Views:

- "What Hermes remembers"
- profile memory
- preferences
- decisions
- project facts
- writing style
- deleted/superseded memories

Actions:

- edit memory
- delete/forget memory
- mark stale
- show source conversation
- show why a memory was used

Visual treatment:

- memories are structured rows, not chat bubbles
- show category, confidence, source, updated date
- superseded facts should be visually muted

### 8.4 App Connections UI

This should exist visually now, even if the current prototype uses env tokens.

Initial tools:

- Gmail
- Google Calendar or Outlook Calendar
- Slack
- GitHub
- Linear
- Sentry

Each integration card should show:

- logo/icon
- connection state: connected, not connected, needs auth, error
- data access summary
- last sync or last checked time
- actions: connect, reconnect, disconnect, test
- scopes requested

Important product note:

Current prototype uses environment variables and personal tokens. The designer
should still design the future OAuth UI, but implementation should wait until
BetterAuth is added.

### 8.5 Tool Approval UI

Hermes can take actions, but write actions require approval.

Approval card should show:

- tool name
- action type
- payload preview
- editable body where relevant
- approve/send
- save as draft for Gmail
- reject
- status after decision

Examples:

- Send Gmail email
- Save Gmail draft
- Post Slack message
- Create Linear issue
- Update Linear issue status

### 8.6 Integration Status / System Health

For the prototype, add a utility page or panel:

- Gmail configured
- Slack configured
- GitHub configured
- Linear configured
- Sentry configured
- Redis connected
- Postgres connected
- Memory extraction active
- MCP server status

This helps development and builds user trust.

### 8.7 Agent Activity UI

Hermes should make agent routing legible without overwhelming the user.

Display:

- Herald routing reason
- specialist chips
- tool call started
- tool result completed
- approval waiting
- memory used indicator

Do not expose raw logs by default.

## 9. Navigation

Recommended initial navigation:

```text
Chat
Sessions
Memory
Connections
Approvals
System
Settings
```

For v1, navigation can be a compact left rail.

## 10. Key Screens To Design

Design these first:

1. Main chat workspace with saved session rail.
2. Empty chat state with examples.
3. Active multi-agent run with routing, tool calls, and answer.
4. Approval card for Gmail send/save draft.
5. Memory management page.
6. App connections page.
7. Integration detail page.
8. System health/status page.
9. Settings page.
10. Mobile version of chat + sessions.

## 11. Information Architecture

```text
App
  Chat
    Saved sessions
    Current thread
    Composer
    Tool calls
    Approvals

  Memory
    Profile
    Preferences
    Decisions
    Project facts
    Writing style
    Superseded

  Connections
    Gmail
    Calendar
    Slack
    GitHub
    Linear
    Sentry

  System
    MCP status
    Redis
    Postgres
    Memory extraction
    LLM provider

  Settings
    Profile
    Model behavior
    Data controls
```

## 12. Interaction Principles

1. Make state visible.
   - The user should know when Hermes is routing, reading tools, waiting for
     approval, or using memory.

2. Keep actions controlled.
   - Any external write must show an approval card.

3. Separate memory from live truth.
   - Preferences live in memory.
   - Calendar/email/Slack/GitHub live in tools.

4. Do not over-chat.
   - The UI should support concise answers and visible tool work.

5. Make connected apps trustworthy.
   - Show scopes, status, and last checked time.

## 13. Image Generation Prompt

Use this prompt with an OpenAI image-generation/design agent.

```text
Create a complete enterprise web app UI and branding concept for "Hermes",
an AI operations assistant for founders and technical teams.

Brand:
Hermes is "the messenger between your tools." It connects Gmail, Calendar,
Slack, GitHub, Linear, Sentry, memory, and saved chat sessions. It routes work
to specialist agents, remembers durable user context, and performs approved
actions.

Visual style:
Enterprise command terminal meets ancient messenger mythology. Dark warm ink
interface, copper/amber signal color, precise thin borders, monospaced
typography, subtle grain texture, dense operational layouts, quiet executive
software. Serious, technical, trusted, fast. Not playful.

Color palette:
- Deep warm ink background, almost black with slight warmth
- Warm off-white foreground
- Copper/amber accent used sparingly for active states and brand
- Charcoal cards
- Low-contrast neutral borders
- Restrained red for destructive states
Avoid purple/blue AI gradients, glassy blobs, rounded chatbot bubbles, cartoon
mascots, and generic SaaS hero art.

Typography:
Use a mono-forward system inspired by IBM Plex Mono and Geist Mono. Small
uppercase section labels, compact operational text, readable 13-14px body,
precise status chips.

Required screens:
1. Main chat workspace with left saved-session rail, central message stream,
   bottom composer, agent routing chips, tool-call panels, and memory indicators.
2. App connections page showing Gmail, Calendar, Slack, GitHub, Linear, and
   Sentry integration cards with connected/error/not-connected states, scopes,
   last checked time, connect/reconnect/test actions.
3. Memory management page showing profile memory, preferences, decisions,
   project facts, writing style, active/superseded memories, confidence, source,
   and edit/forget controls.
4. Approval flow card for sending an email: editable body, recipient, subject,
   send now, save draft, reject.
5. System health page showing MCP servers, Redis, Postgres, LLM provider,
   memory extraction, and tool status.
6. Branding board: logo wordmark, copper accent, icon system, typography,
   color swatches, button states, cards, chips, tables.

Layout:
Desktop-first SaaS application, 1440px wide. Left navigation rail, dense but
organized panels, no oversized marketing hero. Use small-radius cards, thin
borders, monospace labels, subtle scanline or grain texture. Keep UI readable
and production-realistic.

Logo direction:
Wordmark "Hermes" in precise mono typography. Optional minimal symbol inspired
by a message route, wing, or relay signal, but abstract and enterprise-ready.
No literal cartoon gods or mascots.

Output:
Generate high-fidelity web design images, not wireframes. Include multiple
screens and a brand board. The result should look like a polished enterprise AI
agent product ready for implementation in Next.js.
```

## 14. Negative Prompt

```text
Do not create a generic AI chatbot UI. Do not use purple gradients, blue neon
glows, floating orbs, cartoon mascots, oversized rounded chat bubbles, stock
illustrations, glassmorphism-heavy panels, landing-page hero layouts, or
consumer social app styling. Avoid playful or cute visuals. Avoid cluttered
dashboards full of fake charts. The product should feel like serious enterprise
operations software.
```

