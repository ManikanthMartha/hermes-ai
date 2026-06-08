export type DemoLead = {
  name: string;
  email: string;
  company: string;
  role: string;
  companySize: string;
  interest: string;
  message?: string;
};

export type DemoActionStatus = "idle" | "loading" | "done";

export type DemoAction = {
  id: string;
  title: string;
  description: string;
  source: string;
  department: string;
  priority: "Critical" | "High" | "Medium";
  owner: string;
  cta: string;
  doneLabel: string;
  evidence: string[];
};

export type DemoMeeting = {
  id: string;
  title: string;
  time: string;
  people: string[];
  context: string;
  agenda: string[];
  risks: string[];
  sources: string[];
};

export type DemoDraft = {
  id: string;
  channel: "Gmail" | "Outlook" | "Slack";
  recipient: string;
  subject: string;
  body: string;
  source: string;
};

export type DemoIntegration = {
  name: string;
  category: string;
  status: "Watching" | "Ready" | "Synced";
  signals: number;
};

export type DemoAskPrompt = {
  id: string;
  question: string;
  answer: string;
  sources: string[];
  suggestedActions: string[];
};

export type DemoMemoryStatus = "confirmed" | "candidate" | "conflicted" | "expired";

export type DemoMemory = {
  id: string;
  title: string;
  summary: string;
  category: "Decision" | "Commitment" | "Risk" | "Account" | "People" | "Workflow";
  status: DemoMemoryStatus;
  confidence: number;
  owner: string;
  lastSeen: string;
  validFrom: string;
  validUntil?: string;
  sources: string[];
  relatedActions: string[];
  relatedMeetings: string[];
  timeline: string[];
};
