import { DEFAULT_USER_ID } from "./types.js";
import { FactMemory } from "./facts.js";
import { ProfileMemory } from "./profile.js";

export interface MemoryCommandResult {
  handled: boolean;
  response?: string;
}

export async function handleMemoryCommand(
  text: string,
  userId: string = DEFAULT_USER_ID,
): Promise<MemoryCommandResult> {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const facts = new FactMemory(userId);
  const profile = new ProfileMemory(userId);

  const remember = matchAfter(
    trimmed,
    /^(no[,.]?\s+)?(please\s+)?remember\s+(in\s+(the\s+)?memory\s+)?(that\s+)?/i,
  );
  if (remember) {
    const row = await facts.upsert({
      content: remember,
      category: inferCategory(remember),
      sourceType: "manual",
      confidence: 1,
      metadata: { explicit: true },
    });
    return {
      handled: true,
      response: `Remembered: ${row.content}`,
    };
  }

  const forget = matchAfter(trimmed, /^(please\s+)?forget\s+(that\s+|about\s+)?/i);
  if (forget) {
    const deleted = await facts.forget(forget);
    return {
      handled: true,
      response: deleted.length
        ? `Forgot ${deleted.length} matching memory.`
        : "I could not find a matching memory to forget.",
    };
  }

  if (
    lower === "what do you remember about me?" ||
    lower === "what do you remember about me" ||
    lower === "what do you remember?"
  ) {
    const rows = await profile.list(30);
    return {
      handled: true,
      response: rows.length
        ? ["I remember:", ...rows.map((m) => `- ${m.content}`)].join("\n")
        : "I do not have any saved profile memories yet.",
    };
  }

  const topic = matchAfter(
    trimmed,
    /^what\s+do\s+you\s+remember\s+about\s+/i,
  )?.replace(/\?$/, "");
  if (topic) {
    const rows = await facts.search(topic, 8);
    return {
      handled: true,
      response: rows.length
        ? [`I found memories about ${topic}:`, ...rows.map((m) => `- ${m.content}`)].join(
            "\n",
          )
        : `I do not have saved memories about ${topic}.`,
    };
  }

  return { handled: false };
}

function matchAfter(text: string, prefix: RegExp): string | null {
  const value = text.replace(prefix, "").trim();
  return value === text.trim() || !value ? null : value;
}

function inferCategory(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("prefer") || lower.includes("like ")) return "preference" as const;
  if (lower.includes("style") || lower.includes("write")) return "writing_style" as const;
  if (lower.includes("always") || lower.includes("never")) return "instruction" as const;
  if (lower.includes("decided") || lower.includes("switching")) return "decision" as const;
  return "fact" as const;
}
