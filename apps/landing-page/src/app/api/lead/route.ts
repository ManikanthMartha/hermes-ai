import { NextResponse } from "next/server";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  company: z.string().trim().min(2).max(160),
  role: z.string().trim().min(2).max(140),
  companySize: z.string().trim().min(1).max(80),
  interest: z.string().trim().min(1).max(120),
  message: z.string().trim().max(1200).optional().default(""),
  website: z.string().trim().max(200).optional().default(""),
});

export async function POST(req: Request) {
  const webhookUrl = process.env.LANDING_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Lead form is temporarily unavailable." },
      { status: 503 },
    );
  }

  let parsed: z.infer<typeof leadSchema>;
  try {
    parsed = leadSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Please check the form details and try again." },
      { status: 400 },
    );
  }

  if (parsed.website) {
    return NextResponse.json({ ok: true, accepted: false });
  }

  const launchLabel = process.env.NEXT_PUBLIC_LAUNCH_LABEL ?? "Website";
  const lines = [
    `*${escapeSlack(parsed.name)}* entered the Hermes interactive demo`,
    `Company: ${escapeSlack(parsed.company)}`,
    `Role: ${escapeSlack(parsed.role)}`,
    `Email: ${escapeSlack(parsed.email)}`,
    `Company size: ${escapeSlack(parsed.companySize)}`,
    `Interest: ${escapeSlack(parsed.interest)}`,
    parsed.message ? `Notes: ${escapeSlack(parsed.message)}` : null,
    `Source: ${escapeSlack(launchLabel)} landing page`,
  ].filter(Boolean);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: `${parsed.company} entered the Hermes interactive demo`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: lines.join("\n"),
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Could not submit the request right now." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, accepted: true });
}

function escapeSlack(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
