export interface MeetingBrief {
  id: string;
  workspaceId: string;
  meetingId: string;
  status: string;
  summary: string | null;
  agenda: unknown;
  openQuestions: unknown;
  risks: unknown;
  followUps: unknown;
  sourceIds: string[];
  slackQueries: unknown;
  content: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  workspaceId: string;
  calendarSourceObjectId: string | null;
  providerEventId: string;
  title: string;
  description: string | null;
  organizerEmail: string | null;
  attendeeEmails: string[];
  location: string | null;
  meetingUrl: string | null;
  htmlLink: string | null;
  startAt: string;
  endAt: string | null;
  status: string;
  prepStatus: string;
  lastPreparedAt: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  latestBrief: MeetingBrief | null;
}
