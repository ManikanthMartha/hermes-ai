// Smoke-test the LLM provider layer end-to-end.
// Run: pnpm --filter @hermes/agent-runtime exec tsx scripts/smoke-test-llm.ts
//
// Verifies:
//   1. @hermes/shared/llm resolves as a subpath export
//   2. ANTHROPIC_API_KEY is loaded via load-env
//   3. Vercel AI SDK + Anthropic provider actually reach the API
//   4. Haiku responds with a prompt completion
import "@hermes/shared"; // loads monorepo .env via load-env.ts
import { generateText } from "ai";
import { models } from "@hermes/shared/llm";

const start = Date.now();
const { text, usage } = await generateText({
  model: models.fast,
  prompt: 'Say "Hermes LLM layer is working" and nothing else.',
});
const ms = Date.now() - start;

console.log("Response:", text.trim());
console.log("Model:   ", "claude-haiku-4-5");
console.log("Latency: ", `${ms}ms`);
console.log("Tokens:  ", usage);
