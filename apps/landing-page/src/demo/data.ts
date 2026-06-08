import type {
  DemoAction,
  DemoAskPrompt,
  DemoDraft,
  DemoIntegration,
  DemoMemory,
  DemoMeeting,
} from "./types";

export const demoCompany = {
  name: "Atlas Grove",
  tagline: "Consumer operations company preparing a multi-channel product launch.",
  operatingWindow: "Today, 8:40 AM",
};

export const demoIntegrations: DemoIntegration[] = [
  { name: "Slack", category: "Messages", status: "Watching", signals: 42 },
  { name: "Gmail", category: "Email", status: "Watching", signals: 18 },
  { name: "Outlook", category: "Email + calendar", status: "Ready", signals: 11 },
  { name: "Google Calendar", category: "Calendar", status: "Synced", signals: 7 },
  { name: "GitHub", category: "Engineering", status: "Watching", signals: 13 },
  { name: "Jira", category: "Product", status: "Watching", signals: 16 },
  { name: "Linear", category: "Product", status: "Ready", signals: 9 },
  { name: "Asana", category: "Operations", status: "Watching", signals: 21 },
  { name: "QuickBooks", category: "Finance", status: "Synced", signals: 6 },
  { name: "Stripe", category: "Revenue", status: "Watching", signals: 8 },
  { name: "HubSpot", category: "Sales", status: "Watching", signals: 24 },
  { name: "Salesforce", category: "Sales", status: "Ready", signals: 15 },
  { name: "Notion", category: "Knowledge", status: "Synced", signals: 12 },
  { name: "Google Drive", category: "Docs", status: "Synced", signals: 17 },
  { name: "Zendesk", category: "Support", status: "Watching", signals: 19 },
  { name: "Intercom", category: "Customer", status: "Ready", signals: 10 },
  { name: "Shopify", category: "Commerce", status: "Watching", signals: 5 },
];

export const demoActions: DemoAction[] = [
  {
    id: "investor-prep",
    title: "Approve investor follow-up pack",
    description:
      "Hermes found three open investor questions and prepared a concise update with launch, revenue, and support context.",
    source: "Gmail + Notion + Stripe",
    department: "Founder",
    priority: "Critical",
    owner: "Maya Chen",
    cta: "Approve pack",
    doneLabel: "Investor pack approved",
    evidence: ["Gmail thread with Northstar Ventures", "Stripe MRR export", "Notion launch memo"],
  },
  {
    id: "acme-renewal",
    title: "Send Acme renewal reply",
    description:
      "The account owner has not answered Acme's procurement question. Hermes drafted a reply with billing and support notes.",
    source: "HubSpot + Gmail + Zendesk",
    department: "Sales",
    priority: "High",
    owner: "Elena Park",
    cta: "Send reply",
    doneLabel: "Renewal reply queued",
    evidence: ["HubSpot deal note", "Gmail procurement thread", "Zendesk ticket CS-1842"],
  },
  {
    id: "finance-approval",
    title: "Approve launch vendor invoice",
    description:
      "QuickBooks shows a pending design vendor invoice that blocks the launch creative handoff.",
    source: "QuickBooks + Asana",
    department: "Finance",
    priority: "Medium",
    owner: "Ravi Iyer",
    cta: "Approve invoice",
    doneLabel: "Invoice approved",
    evidence: ["QuickBooks bill #AG-117", "Asana launch checklist"],
  },
  {
    id: "support-risk",
    title: "Escalate subscription bug to product",
    description:
      "Zendesk and Intercom both show customers reporting checkout confusion after the latest pricing update.",
    source: "Zendesk + Intercom + Jira",
    department: "Support",
    priority: "High",
    owner: "Jordan Lee",
    cta: "Create Jira task",
    doneLabel: "Jira task created",
    evidence: ["Zendesk tags: billing, checkout", "Intercom conversation cluster", "Jira pricing epic"],
  },
  {
    id: "hiring-followup",
    title: "Send candidate follow-up",
    description:
      "The HR interview loop is complete, but the offer follow-up has not been sent to the operations lead candidate.",
    source: "Outlook + Google Drive + Slack",
    department: "HR",
    priority: "Medium",
    owner: "Priya Nair",
    cta: "Send draft",
    doneLabel: "Candidate draft sent",
    evidence: ["Outlook interview calendar", "Drive scorecard folder", "Slack hiring channel"],
  },
];

export const demoMeetings: DemoMeeting[] = [
  {
    id: "board-sync",
    title: "Board sync: launch readiness",
    time: "10:30 AM",
    people: ["Maya Chen", "Ravi Iyer", "Northstar Ventures"],
    context:
      "The board wants a launch confidence update. Hermes found fresh signals across finance, support, sales, and product.",
    agenda: [
      "Confirm whether launch date still holds.",
      "Explain support ticket spike and mitigation.",
      "Show revenue impact from Acme and Parker renewals.",
      "Decide which launch risks need executive owner approval.",
    ],
    risks: [
      "Vendor invoice is still pending approval.",
      "Checkout confusion appears in 11 customer conversations.",
      "Investor deck still uses last week's revenue number.",
    ],
    sources: ["Google Calendar", "Slack", "Stripe", "Zendesk", "Notion"],
  },
  {
    id: "sales-handoff",
    title: "Sales handoff: Acme renewal",
    time: "1:00 PM",
    people: ["Elena Park", "Acme Procurement", "Jordan Lee"],
    context:
      "Acme asked for renewal terms and a support SLA summary. Hermes prepared the thread, ticket history, and proposed reply.",
    agenda: [
      "Confirm renewal owner and next response.",
      "Review open support tickets before procurement call.",
      "Approve pricing and SLA language.",
    ],
    risks: ["Procurement deadline is tomorrow.", "Two support tickets remain unresolved."],
    sources: ["HubSpot", "Gmail", "Zendesk", "Salesforce"],
  },
  {
    id: "marketing-launch",
    title: "Marketing launch room",
    time: "3:30 PM",
    people: ["Ava Brooks", "Maya Chen", "Launch Team"],
    context:
      "The launch room needs final sign-off on copy, customer proof, and paid channel timing.",
    agenda: [
      "Approve launch email copy.",
      "Confirm Shopify landing update.",
      "Review paid channel spend guardrail.",
      "Assign owner for customer quote approvals.",
    ],
    risks: ["Two customer quotes are not approved.", "Paid spend approval is waiting on finance."],
    sources: ["Asana", "Google Drive", "Shopify", "Slack"],
  },
];

export const demoDrafts: DemoDraft[] = [
  {
    id: "northstar-email",
    channel: "Gmail",
    recipient: "Dana at Northstar Ventures",
    subject: "Atlas Grove launch readiness update",
    body:
      "Sharing the clean version before today's board sync: launch remains on track, with three watch items now owner-assigned.",
    source: "Notion launch memo + Stripe export + Slack owner updates",
  },
  {
    id: "acme-email",
    channel: "Outlook",
    recipient: "Acme Procurement",
    subject: "Renewal terms and support SLA summary",
    body:
      "Thanks for the procurement note. We can confirm the renewal terms and have attached the current support SLA summary.",
    source: "HubSpot deal + Zendesk customer history",
  },
  {
    id: "launch-slack",
    channel: "Slack",
    recipient: "#launch-room",
    subject: "Daily launch owner check",
    body:
      "Hermes found four launch items without final approval: finance invoice, customer quotes, checkout support note, and paid spend cap.",
    source: "Asana + QuickBooks + Zendesk + Google Drive",
  },
];

export const demoMemories: DemoMemory[] = [
  {
    id: "launch-decision",
    title: "Launch date remains locked unless checkout risk worsens",
    summary:
      "The leadership team kept the launch window, but agreed that checkout confusion must stay owner-assigned and visible before the investor update.",
    category: "Decision",
    status: "confirmed",
    confidence: 94,
    owner: "Maya Chen",
    lastSeen: "Today, 8:32 AM",
    validFrom: "June 8",
    sources: ["Slack #launch-room", "Notion launch memo", "Google Calendar board sync"],
    relatedActions: ["Approve investor follow-up pack", "Escalate subscription bug to product"],
    relatedMeetings: ["Board sync: launch readiness", "Marketing launch room"],
    timeline: [
      "Notion launch memo marked the date as still active.",
      "Slack owner check narrowed the open risks to checkout, customer proof, and vendor payment.",
      "Board sync agenda asks for a launch confidence update today.",
    ],
  },
  {
    id: "acme-commitment",
    title: "Acme procurement reply must go out before tomorrow",
    summary:
      "Acme is waiting on renewal terms and a support SLA summary. Hermes treats this as a customer-risk commitment, not a generic email follow-up.",
    category: "Commitment",
    status: "confirmed",
    confidence: 91,
    owner: "Elena Park",
    lastSeen: "Today, 8:18 AM",
    validFrom: "June 8",
    validUntil: "June 9",
    sources: ["HubSpot deal note", "Gmail procurement thread", "Zendesk ticket CS-1842"],
    relatedActions: ["Send Acme renewal reply"],
    relatedMeetings: ["Sales handoff: Acme renewal"],
    timeline: [
      "HubSpot note flagged procurement as the renewal blocker.",
      "Gmail thread includes the open terms question.",
      "Zendesk history adds two unresolved tickets to mention in the reply.",
    ],
  },
  {
    id: "pricing-risk",
    title: "Checkout confusion is a launch risk across support channels",
    summary:
      "Zendesk and Intercom both show customers getting confused after the pricing update. Hermes links it to the pricing epic and keeps it in meeting prep.",
    category: "Risk",
    status: "candidate",
    confidence: 83,
    owner: "Jordan Lee",
    lastSeen: "Today, 7:55 AM",
    validFrom: "June 8",
    sources: ["Zendesk billing tags", "Intercom conversation cluster", "Jira pricing epic"],
    relatedActions: ["Escalate subscription bug to product"],
    relatedMeetings: ["Board sync: launch readiness"],
    timeline: [
      "Zendesk shows repeated billing and checkout tags.",
      "Intercom confirms the issue appears outside support tickets.",
      "Jira pricing epic has no linked blocker yet.",
    ],
  },
  {
    id: "invoice-blocker",
    title: "Launch creative handoff depends on vendor invoice approval",
    summary:
      "QuickBooks shows the design vendor invoice as pending. Asana says the creative handoff cannot close until finance approves it.",
    category: "Workflow",
    status: "confirmed",
    confidence: 88,
    owner: "Ravi Iyer",
    lastSeen: "Today, 8:06 AM",
    validFrom: "June 8",
    sources: ["QuickBooks bill #AG-117", "Asana launch checklist", "Slack finance thread"],
    relatedActions: ["Approve launch vendor invoice"],
    relatedMeetings: ["Marketing launch room"],
    timeline: [
      "QuickBooks marked the invoice pending.",
      "Asana launch checklist links the invoice to creative delivery.",
      "Slack finance thread asks for approval before the launch room.",
    ],
  },
  {
    id: "owner-conflict",
    title: "Pricing page owner changed from Ava to Maya",
    summary:
      "Older launch notes say Ava owns pricing page sign-off, but the latest Slack update assigns Maya. Hermes keeps the conflict visible instead of silently overwriting it.",
    category: "People",
    status: "conflicted",
    confidence: 76,
    owner: "Maya Chen",
    lastSeen: "Today, 8:21 AM",
    validFrom: "June 8",
    sources: ["Old Notion launch checklist", "Latest Slack owner update"],
    relatedActions: ["Approve investor follow-up pack", "Escalate subscription bug to product"],
    relatedMeetings: ["Board sync: launch readiness"],
    timeline: [
      "Notion checklist from last week names Ava as pricing page owner.",
      "Slack owner check from today names Maya as the updated owner.",
      "Hermes marks the memory conflicted until the owner is confirmed.",
    ],
  },
  {
    id: "investor-pack-style",
    title: "Investor updates should be concise and source-backed",
    summary:
      "The founder prefers short investor updates with explicit evidence and named owners for open risks.",
    category: "Workflow",
    status: "confirmed",
    confidence: 89,
    owner: "Maya Chen",
    lastSeen: "Yesterday, 5:10 PM",
    validFrom: "June 7",
    sources: ["Gmail investor thread", "Notion board memo", "Previous approved draft"],
    relatedActions: ["Approve investor follow-up pack"],
    relatedMeetings: ["Board sync: launch readiness"],
    timeline: [
      "Previous approved draft used a short risk-owner format.",
      "Northstar thread asks for launch confidence, not a full status report.",
      "Hermes applies the pattern to today's investor pack.",
    ],
  },
];

export const demoAskPrompts: DemoAskPrompt[] = [
  {
    id: "investor-meeting",
    question: "What should I prepare for today's investor meeting?",
    answer:
      "Prepare the launch readiness narrative, the updated revenue number, and the owner map for the three remaining risks. Hermes found the strongest evidence in the Notion launch memo, Stripe export, support ticket trend, and Slack owner updates.",
    sources: ["Notion", "Stripe", "Zendesk", "Slack"],
    suggestedActions: ["Approve investor pack", "Assign checkout risk owner", "Refresh revenue slide"],
  },
  {
    id: "customer-risks",
    question: "Which customer risks need attention this week?",
    answer:
      "Acme renewal and checkout confusion are the two highest customer risks. Acme needs a procurement reply before tomorrow. Checkout confusion appears in both Zendesk and Intercom, so Hermes recommends escalating it into the pricing epic.",
    sources: ["HubSpot", "Gmail", "Zendesk", "Intercom", "Jira"],
    suggestedActions: ["Send Acme reply", "Create Jira task", "Notify support lead"],
  },
  {
    id: "finance-approvals",
    question: "What finance approvals are waiting on me?",
    answer:
      "One launch vendor invoice and one paid channel guardrail are waiting for approval. The vendor invoice blocks creative handoff; the paid channel cap blocks the final launch room decision.",
    sources: ["QuickBooks", "Asana", "Slack"],
    suggestedActions: ["Approve invoice", "Ask finance for spend cap", "Update launch room"],
  },
  {
    id: "launch-decisions",
    question: "What did the team decide about the launch?",
    answer:
      "The team kept the launch date, narrowed the risk list to checkout, customer proof, and vendor payment, and agreed that every external message needs owner approval before sending. Hermes saved this as confirmed company memory with Slack, Notion, Asana, and Calendar evidence.",
    sources: ["Company Memory", "Slack", "Notion", "Asana", "Google Calendar"],
    suggestedActions: ["Open launch decision memory", "Prepare launch room agenda", "Send owner check"],
  },
  {
    id: "hiring-slip",
    question: "Which hiring follow-ups are slipping?",
    answer:
      "The operations lead candidate is the only slipping hiring item. The interview loop is complete, but the follow-up draft has not been sent and the scorecard folder has not been linked in Slack.",
    sources: ["Outlook", "Google Drive", "Slack"],
    suggestedActions: ["Send candidate follow-up", "Share scorecard folder", "Mark hiring loop complete"],
  },
  {
    id: "reply-acme",
    question: "What should I reply to the Acme renewal thread?",
    answer:
      "Reply with the confirmed renewal terms, attach the support SLA summary, and acknowledge the two open tickets with named owners. Hermes prepared a draft using HubSpot, Gmail, and Zendesk context.",
    sources: ["HubSpot", "Gmail", "Zendesk"],
    suggestedActions: ["Send prepared reply", "Attach SLA summary", "Assign ticket owners"],
  },
  {
    id: "company-memory",
    question: "What changed in company memory today?",
    answer:
      "Hermes confirmed the launch decision, promoted the Acme procurement reply into a customer-risk commitment, marked checkout confusion as a candidate launch risk, and found a conflict in pricing page ownership between old Notion notes and the latest Slack owner update.",
    sources: ["Company Memory", "Slack", "Notion", "HubSpot", "Zendesk", "Intercom"],
    suggestedActions: ["Resolve pricing owner conflict", "Approve investor pack", "Send Acme reply"],
  },
  {
    id: "commitments-at-risk",
    question: "Which commitments are risky before investor meetings?",
    answer:
      "Three commitments need attention before investor conversations: Acme procurement needs a reply before tomorrow, the launch vendor invoice blocks creative handoff, and checkout confusion needs a product owner. Hermes ties each one to a prepared action and source trail.",
    sources: ["Company Memory", "QuickBooks", "Asana", "HubSpot", "Zendesk", "Jira"],
    suggestedActions: ["Approve invoice", "Send Acme reply", "Create Jira task"],
  },
];
