# Memory Layer — Curated Learning Resources

> **Purpose:** A hand-curated reading list for deeply understanding AI agent memory systems. Only resources from research labs, reputable engineering blogs, or senior engineers with track records. No Medium slop. No tutorial farms.
>
> **Use this when:** You return to Phase 2 (Memory Layer) in the main plan, or when you want to level up your context engineering skills.
>
> **All URLs verified April 2026.**

---

## Suggested Study Order (The Curriculum)

### Week 1 — Foundations (3-4 hours)
Before reading any memory-specific content, absorb the fundamentals:

1. **Lilian Weng — "LLM Powered Autonomous Agents"** ← most-cited agent reference
2. **Andrej Karpathy — "Intro to Large Language Models"** (video) — context window intuition
3. **Anthropic — "Effective Context Engineering for AI Agents"** — how Claude Code thinks about context
4. **Chip Huyen — "Agents"** — practical guide from the AI Engineering book

### Week 2 — Core Papers (4-6 hours)
The 4 papers that defined memory architecture for agents:

1. **ReAct** (Yao et al., 2022) — foundational loop of reason → act → observe
2. **MemGPT** (Packer et al., 2023) — OS-inspired virtual context → **read this one fully**
3. **Generative Agents** (Park et al., 2023) — Smallville, reflection, memory consolidation
4. **Reflexion** (Shinn et al., 2023) — episodic memory for self-improvement

### Week 3 — Production & Evaluation (3-4 hours)
How production systems actually do it:

1. **Anthropic "Context Engineering"** (re-read, it clicks differently after the papers)
2. **Databricks "Memory Scaling for AI Agents"**
3. **Redis "AI Agent Memory: Types, Architecture & Implementation"**
4. **LangChain "Memory for Agents"** (Harrison Chase)
5. **LongMemEval paper + leaderboard** — the benchmark every startup measures against

### Week 4 — Deep Dives & Advanced Patterns (4-6 hours)
If you want to go deeper:

1. **Mem0 paper + benchmarks**
2. **A-Mem** (Zettelkasten-inspired dynamic memory)
3. **Character.AI engineering blog** on KV cache at world-largest scale
4. **TiMem or MAGMA** (pick one — latest 2026 memory architectures)

### Week 5+ — Hands-On Implementation (8-12 hours)
Pick ONE DeepLearning.AI course and complete it while building Phase 2 of Hermes:

1. **"LLMs as Operating Systems: Agent Memory"** (Letta founders teach) ← best pick
2. **"Long-Term Agentic Memory with LangGraph"** (framework-specific)
3. **"Agent Memory: Building Memory-Aware Agents"** (vendor-neutral)

---

## The Canon: Must-Read Resources

### Papers (ranked by importance for a Hermes builder)

| Paper | Why It Matters | Link |
|-------|---------------|------|
| **MemGPT** (Packer et al., Oct 2023) | The foundational OS-inspired memory model. Introduces in-context vs archival memory tiers. Every modern agent memory system descends from this. | [arxiv.org/abs/2310.08560](https://arxiv.org/abs/2310.08560) |
| **ReAct** (Yao et al., Oct 2022) | Foundational agent loop. Memory management depends on understanding this pattern first. | [arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629) |
| **Generative Agents** (Park et al., Apr 2023) | Introduced reflection and temporal memory consolidation. Famous "Smallville" simulation. | [arxiv.org/abs/2304.03442](https://arxiv.org/abs/2304.03442) |
| **LongMemEval** (Wu et al., Oct 2024, ICLR 2025) | *The* benchmark for agent memory. 5 dimensions: extraction, multi-session, temporal, knowledge updates, abstention. Shows 30% accuracy drop across sessions. | [arxiv.org/abs/2410.10813](https://arxiv.org/abs/2410.10813) |
| **Reflexion** (Shinn et al., Mar 2023) | Episodic memory for self-improvement via verbal RL. | [arxiv.org/abs/2303.11366](https://arxiv.org/abs/2303.11366) |
| **Mem0 Paper** (Chhikara et al., Apr 2025) | Production memory architecture. 26% improvement over SOTA, 91% p95 latency reduction, 90% token cost reduction. | [arxiv.org/abs/2504.19413](https://arxiv.org/abs/2504.19413) |
| **Self-RAG** (Asai et al., Oct 2023) | Adaptive retrieval — agents decide when to retrieve vs. generate from memory. | [arxiv.org/abs/2310.11511](https://arxiv.org/abs/2310.11511) |
| **A-Mem** (Xu et al., Feb 2025, NeurIPS 2025) | Zettelkasten-inspired dynamic memory. 20%+ improvement over baselines. Shows agents autonomously organizing knowledge. | [arxiv.org/abs/2502.12110](https://arxiv.org/abs/2502.12110) |
| **MemBench** (Tan et al., Jun 2025, ACL 2025) | Multi-level memory evaluation with 4 metrics: accuracy, recall, capacity, temporal efficiency. | [arxiv.org/abs/2506.21605](https://arxiv.org/abs/2506.21605) |
| **HELMET** (Princeton, Oct 2024) | Comprehensive long-context evaluation beyond synthetic recall. Tests RAG, summarization, ICL, citations. | [arxiv.org/abs/2410.02694](https://arxiv.org/abs/2410.02694) |

### 2026 Cutting-Edge (Optional, for Advanced Readers)

| Paper | What's New |
|-------|-----------|
| **TiMem** (Jan 2026) | 5-layer temporal memory tree with instruction-guided consolidation. 75% on LoCoMo, 52% context reduction. [arxiv.org/html/2601.02845v1](https://arxiv.org/html/2601.02845v1) |
| **MAGMA** (Jan 2026) | Multi-graph architecture — orthogonal semantic/temporal/causal/entity graphs. [arxiv.org/html/2601.03236v1](https://arxiv.org/html/2601.03236v1) |
| **GAM** (Apr 2026) | Decouples episodic buffering from semantic consolidation. [arxiv.org/abs/2604.12285](https://arxiv.org/abs/2604.12285) |
| **MIRA** (Feb 2026, ICLR 2026) | Memory graphs + RL for sample-efficient agents. [arxiv.org/abs/2602.17930](https://arxiv.org/abs/2602.17930) |

---

## Engineering Blog Posts (Production-Grade)

### From Labs With Production Agent Systems

| Post | Publisher | Why Read It |
|------|-----------|-------------|
| **Effective Context Engineering for AI Agents** (Sep 29, 2025) | Anthropic | How Claude Code handles context rot, tool minimization, just-in-time retrieval, compaction, structured note-taking. The definitive production playbook. |
| **Memory Scaling for AI Agents** (Apr 10, 2026) | Databricks | Enterprise-scale memory architecture. Episodic vs semantic. Shows accuracy scaling from near-zero to 70% with memory growth. |
| **AI Agent Memory: Types, Architecture & Implementation** (Feb 2026) | Redis | Short-term + long-term memory patterns. Vector search, hybrid search, semantic caching. |
| **How to Build AI Agents with Redis Memory Management** (Feb 2026) | Redis | Unified infrastructure. In-memory for short-term, vector for long-term. Efficiency tradeoffs. |
| **LangGraph & Redis: Build Smarter AI Agents** (Jun 2025) | Redis | LangGraph checkpoint-redis integration — the pattern you'll use in Hermes. |
| **Character.AI Technical Deep Dive** (2026) | Character.AI | The world's largest conversational memory system. KV cache reduction, 95% cache hit rate, sticky sessions. |
| **pgvector: 30x Faster Index Build** | Neon | Production vector indexing for memory systems. |

### From LangChain (the ecosystem you're using)

| Post | Focus |
|------|-------|
| **Memory for Agents** (Oct 19, 2024) — Harrison Chase | Official LangChain taxonomy: episodic, semantic, procedural. When to update memory (hot path vs background). [langchain.com/blog/memory-for-agents](https://www.langchain.com/blog/memory-for-agents) |
| **LangMem SDK Launch** (May 13, 2025) | Framework-level long-term memory SDK. [blog.langchain.com/langmem-sdk-launch](https://blog.langchain.com/langmem-sdk-launch/) |
| **Your Harness, Your Memory** (2026) | "Memory isn't a plugin — it's the harness." Philosophy shift. [blog.langchain.com/your-harness-your-memory](https://blog.langchain.com/your-harness-your-memory/) |
| **Launching Long-Term Memory Support in LangGraph** | Thread-scoped vs namespace-based memory. Reference implementation. |

### From Senior Engineers (Individual Voices Worth Following)

| Source | Who | What They Cover |
|--------|-----|-----------------|
| **lilianweng.github.io** | Lilian Weng (OpenAI) | "LLM Powered Autonomous Agents" is *the* reference post. Updated regularly. |
| **huyenchip.com** | Chip Huyen | Author of "Designing Machine Learning Systems" and "AI Engineering". "Agents" (Jan 2025) is 8K words of gold. |
| **eugeneyan.com** | Eugene Yan (Anthropic) | "Patterns for Building LLM-based Systems" — 7 patterns including RAG, caching, evals. |
| **hamel.dev** | Hamel Husain | Best writing on LLM evals. "LLM Evals: Everything You Need to Know" (Jan 2026) covers multi-step agent eval including memory. |
| **simonwillison.net/tags/context-engineering** | Simon Willison | Prolific writer on context engineering, memory patterns, and emerging techniques. |

---

## Official Platform Docs (for when you need implementation specifics)

| Platform | What to Read |
|----------|-------------|
| **Letta (formerly MemGPT)** | [docs.letta.com/concepts/memgpt](https://docs.letta.com/concepts/memgpt/) — The reference implementation of the MemGPT paper. In-context blocks, archival memory, self-managed memory via tool calls. |
| **Mem0** | [docs.mem0.ai](https://docs.mem0.ai/platform/overview) + [mem0.ai/research](https://mem0.ai/research) — Production memory platform. Token-efficient algorithms. Benchmark page is worth studying. |
| **LangGraph Memory** | [docs.langchain.com/oss/python/langgraph/memory](https://docs.langchain.com/oss/python/langgraph/memory) — Framework-level memory. Thread-scoped (short-term) vs namespace-based (long-term). |

---

## Courses (Worth the Time)

### DeepLearning.AI Short Courses (3-4 hours each)

All three are hands-on and taught by credible instructors.

1. **LLMs as Operating Systems: Agent Memory** — taught by Letta founders (Charles Packer, Sarah Wooders, authors of MemGPT)
   - [deeplearning.ai/short-courses/llms-as-operating-systems-agent-memory](https://www.deeplearning.ai/short-courses/llms-as-operating-systems-agent-memory/)
   - **Best pick** — direct from the research team

2. **Long-Term Agentic Memory with LangGraph** — framework-specific, useful if you're building on LangGraph (you are)
   - [deeplearning.ai/short-courses/long-term-agentic-memory-with-langgraph](https://www.deeplearning.ai/short-courses/long-term-agentic-memory-with-langgraph/)

3. **Agent Memory: Building Memory-Aware Agents** — vendor-neutral, taught by Richmond Alake + Oracle
   - [deeplearning.ai/short-courses/agent-memory-building-memory-aware-agents](https://www.deeplearning.ai/short-courses/agent-memory-building-memory-aware-agents/)

### University Courses (Full Depth)

**Berkeley CS294/194-196: Large Language Model Agents** (Fall 2024)
- Taught by Prof. Dawn Song
- Public lectures on YouTube: [playlist](https://www.youtube.com/playlist?list=PLS01nW3RtgopsNLeM936V4TNSsvvVglLc)
- Portal: [rdi.berkeley.edu/llm-agents/f24](https://rdi.berkeley.edu/llm-agents/f24)
- Covers memory architecture across 12 topics. Free.

### Foundational Video

**Andrej Karpathy — "Intro to Large Language Models"** (1 hour)
- [youtube.com/watch?v=zjkBMFhNj_g](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- Required background for context window intuition.

---

## Benchmarks to Measure Your Memory Layer Against

| Benchmark | What It Tests | Where |
|-----------|--------------|-------|
| **LongMemEval** | 500 questions, 5 memory dimensions. The gold standard. | [xiaowu0162.github.io/long-mem-eval](https://xiaowu0162.github.io/long-mem-eval/) · [GitHub](https://github.com/xiaowu0162/LongMemEval) |
| **MemBench** | Multi-level (factual + reflective). 4 metrics. | [GitHub](https://github.com/import-myself/Membench) |
| **HELMET** | Long-context evaluation beyond synthetic recall. Tests RAG, summarization, citations. | [GitHub](https://github.com/princeton-nlp/HELMET) · [Stanford HELM](https://crfm.stanford.edu/helm/long-context/latest/) |
| **Mem0's LoCoMo + BEAM benchmarks** | Production-grade memory benchmarking with cost/latency metrics. | [mem0.ai/research](https://mem0.ai/research) |

---

## Adjacent Topics Worth Reading

### Context Engineering (the 2025-2026 term that replaced "prompt engineering")
- Anthropic's "Effective Context Engineering" (already listed above)
- Simon Willison's tag: [simonwillison.net/tags/context-engineering](https://simonwillison.net/tags/context-engineering/)

### RAG vs Long-Context Debate
- **Long Context RAG: New Architectures and Tradeoffs** — LlamaIndex
  - [llamaindex.ai/blog/towards-long-context-rag](https://www.llamaindex.ai/blog/towards-long-context-rag)
- Shows why naive RAG is dead but its descendants thrive.

### Infrastructure
- Neon pgvector deep dives (vector indexing for memory backends)
- Redis + LangGraph integration patterns (checkpointing, persistence)

---

## What to SKIP

In your own reading, skip these (they waste time):

- ❌ Generic "What is an AI agent?" blog posts from unknown authors
- ❌ Medium articles with no author credentials
- ❌ "Top 10 memory frameworks" listicles
- ❌ Tutorial farms (freeCodeCamp, geeksforgeeks) on memory — they oversimplify
- ❌ LinkedIn thought-leadership posts on memory
- ❌ Anything older than 2023 except the foundational papers listed above

---

## How to Use This While Building Hermes

**When you're about to build Phase 2 of the plan:**

1. Do Week 1 (Foundations) — ~4 hrs
2. Do Week 2 (Core Papers), specifically MemGPT deeply — ~6 hrs
3. Start building, using the plan's Phase 2 spec
4. While building, read Week 3 (Production & Evaluation) in parallel — ~4 hrs
5. Take the **"LLMs as Operating Systems: Agent Memory"** course alongside — ~4 hrs
6. After shipping Phase 2, run your memory layer against **LongMemEval** — gives you a real resume metric

**Total investment:** ~20-30 hours of study + course time. Output: you understand production memory systems at a level that separates AI Engineers from "prompt engineers."

---

## Reading Tracker

Copy this checklist to track your progress:

```
FOUNDATIONS (Week 1)
[ ] Lilian Weng — LLM Powered Autonomous Agents
[ ] Karpathy — Intro to LLMs (video)
[ ] Anthropic — Effective Context Engineering
[ ] Chip Huyen — Agents

CORE PAPERS (Week 2)
[ ] ReAct paper
[ ] MemGPT paper (deep read, take notes)
[ ] Generative Agents paper
[ ] Reflexion paper

PRODUCTION (Week 3)
[ ] Databricks — Memory Scaling
[ ] Redis — AI Agent Memory
[ ] LangChain — Memory for Agents
[ ] LongMemEval paper + leaderboard

ADVANCED (Week 4, optional)
[ ] Mem0 paper + benchmarks
[ ] A-Mem paper
[ ] Character.AI engineering blog
[ ] Pick ONE: TiMem / MAGMA / GAM

HANDS-ON (Week 5+)
[ ] DeepLearning.AI: LLMs as OS course
[ ] Build Phase 2 of Hermes
[ ] Run LongMemEval against your implementation
```

---

## One Final Note

Memory is *the* differentiating capability of AI agents in 2026. Teams that ship memory as a feature win; teams that treat it as a plumbing concern lose. The market analysis puts agent memory at $6.27B (2026) projected to $28.45B by 2030 at 35% CAGR.

Take this layer seriously. The reading above is what senior AI engineers at YC-backed startups are actually consuming. Not Medium articles.

*Last updated: April 2026. All URLs verified.*
