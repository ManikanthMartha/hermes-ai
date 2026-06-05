type BrandIcon = {
  name: string;
  src: string;
  tint: string;
  short: string;
};

const iconUrl = (slug: string) => `https://thesvg.org/icons/${slug}/default.svg`;

export const brandIcons = {
  slack: {
    name: "Slack",
    src: iconUrl("slack"),
    tint: "#611F69",
    short: "Slack",
  },
  outlook: {
    name: "Outlook",
    src: iconUrl("microsoft-outlook"),
    tint: "#0078D4",
    short: "Outlook",
  },
  calendar: {
    name: "Calendar",
    src: iconUrl("google-calendar"),
    tint: "#4285F4",
    short: "Calendar",
  },
  gmail: {
    name: "Gmail",
    src: iconUrl("gmail"),
    tint: "#EA4335",
    short: "Gmail",
  },
  linear: {
    name: "Linear",
    src: iconUrl("linear"),
    tint: "#5E6AD2",
    short: "Linear",
  },
  github: {
    name: "GitHub",
    src: iconUrl("github"),
    tint: "#181717",
    short: "GitHub",
  },
  sentry: {
    name: "Sentry",
    src: iconUrl("sentry"),
    tint: "#362D59",
    short: "Sentry",
  },
  quickbooks: {
    name: "QuickBooks",
    src: iconUrl("quickbooks"),
    tint: "#2CA01C",
    short: "Books",
  },
} satisfies Record<string, BrandIcon>;

export const connectorStack = [
  brandIcons.slack,
  brandIcons.outlook,
  brandIcons.calendar,
  brandIcons.gmail,
  brandIcons.linear,
  brandIcons.github,
  brandIcons.sentry,
  brandIcons.quickbooks,
];
