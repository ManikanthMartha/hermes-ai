"use client";

/* eslint-disable @next/next/no-img-element */

import { layout as layoutText, prepare } from "@chenglou/pretext";
import {
  ArrowRightIcon,
  FileCheck2Icon,
  MessageSquareTextIcon,
  NetworkIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, FormEvent } from "react";
import { createElement, useEffect, useState } from "react";
import { connectorStack } from "@/lib/brand-icons";

const navItems = ["Platform", "Actions", "Meetings", "Memory"];

const memoryRecords = [
  {
    label: "Decision",
    value: "Acme pilot scope narrowed to support, billing, and deployment signals.",
  },
  {
    label: "Preference",
    value: "Leadership updates should be concise, source-linked, and action-led.",
  },
  {
    label: "Relationship",
    value: "Alex owns launch readiness; Maya owns finance and procurement context.",
  },
];

const sourceSignals = [
  { tool: "Slack", text: "Alex asked if Acme launch is still on track.", state: "new" },
  { tool: "Projects", text: "Backend dependency moved to Friday.", state: "risk" },
  { tool: "Calendar", text: "Board sync starts in 2h 15m.", state: "prep" },
  { tool: "Mail", text: "Customer update needs owner approval.", state: "draft" },
];

const workflowSteps = [
  {
    label: "Detect",
    title: "Finds what changed",
    text: "Pulls fresh signals from messages, calendars, work systems, repos, and finance tools.",
  },
  {
    label: "Resolve",
    title: "Links owners and context",
    text: "Connects people, projects, due dates, decisions, and source evidence into one current view.",
  },
  {
    label: "Prepare",
    title: "Turns context into next steps",
    text: "Drafts replies, meeting briefs, blockers, and follow-ups for review.",
  },
  {
    label: "Approve",
    title: "Keeps external actions gated",
    text: "Nothing leaves Hermes without the human approval path your team expects.",
  },
];

const workflowSources = connectorStack.slice(0, 6);

const workflowOutputs = [
  "Ready draft",
  "Meeting brief",
  "Memory update",
];

const FONT_STACK =
  'Manrope, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function LandingPage() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="landing-root">
      <SiteChrome />
      <HeroSection reduceMotion={Boolean(reduceMotion)} />
      <SignalSection />
      <ActionSection />
      <MeetingSection />
      <MemorySection />
      <LeadSection />
      <Footer />
    </main>
  );
}

function SiteChrome() {
  return (
    <header className="site-header">
      <a href="#top" className="brand-lockup" aria-label="Hermes home">
        <span className="brand-mark">H</span>
        <span>
          Hermes
          <small>Action OS</small>
        </span>
      </a>
      <nav aria-label="Main navigation">
        {navItems.map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`}>
            {item}
          </a>
        ))}
      </nav>
      <a className="nav-cta" href="#book-demo">
        Book demo
      </a>
    </header>
  );
}

function HeroSection({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <section id="top" className="hero-shell">
      <div className="hero-grid">
        <div className="hero-copy">
          <motion.div
            className="launch-kicker"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            Action OS for AI-run work
          </motion.div>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <MeasuredText
              as="h1"
              className="hero-title"
              font="700 86px Manrope"
              lineHeight={78}
              text="Turn company noise into approved action."
            />
          </motion.div>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <MeasuredText
              as="p"
              className="hero-subcopy"
              font="500 20px Manrope"
              lineHeight={30}
              text="Hermes connects the systems your company already uses, understands what changed, prepares the next step, and keeps external actions under human approval."
            />
          </motion.div>
          <motion.div
            className="hero-actions"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <a href="#book-demo" className="primary-cta">
              Book a demo
              <ArrowRightIcon size={16} />
            </a>
            <a href="#platform" className="secondary-cta">
              See product
            </a>
          </motion.div>
        </div>
        <HeroVisual reduceMotion={reduceMotion} />
      </div>
      <ConnectorBand />
    </section>
  );
}

function HeroVisual({ reduceMotion }: { reduceMotion: boolean }) {
  const positions = [
    [-38, -155],
    [128, -112],
    [164, 12],
    [98, 136],
    [-18, 162],
    [-156, 86],
    [-168, -46],
    [-112, -126],
  ];

  return (
    <motion.div
      className="hero-visual"
      initial={reduceMotion ? false : { opacity: 0, x: 24 }}
      animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
      transition={{ duration: 0.85, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="signal-rail rail-a" />
      <div className="signal-rail rail-b" />
      <div className="signal-rail rail-c" />
      <div className="connector-map" aria-hidden="true">
        <div className="map-ring ring-one" />
        <div className="map-ring ring-two" />
        {connectorStack.map((icon, index) => {
          const [x, y] = positions[index] ?? [0, 0];
          return (
            <motion.div
              key={icon.name}
              className="orbit-node"
              initial={reduceMotion ? false : { opacity: 0, x, y, scale: 0.72 }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      x: [x, x * 0.9, x],
                      y: [y, y * 0.9, y],
                      scale: [1, 1.05, 1],
                    }
              }
              transition={{
                duration: 7,
                delay: 0.26 + index * 0.05,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
              style={{ "--node-tint": icon.tint } as CSSProperties}
            >
              <BrandGlyph src={icon.src} name={icon.name} />
            </motion.div>
          );
        })}
      </div>
      <div className="hero-command-card">
        <div className="hero-card-top">
          <span>Hermes command layer</span>
          <strong>Live workspace</strong>
        </div>
        <div className="hero-question">What changed that needs approval?</div>
        <div className="hero-card-body">
          <div className="hero-action-main">
            <span>Prepared action</span>
            <strong>Send Acme a revised rollout update</strong>
            <p>
              Built from the customer thread, delivery note, board agenda, and
              latest owner update.
            </p>
            <div className="source-chips-soft">
              <span>customer</span>
              <span>delivery</span>
              <span>calendar</span>
            </div>
          </div>
          <div className="hero-draft-preview">
            <span>Draft reply</span>
            <p>
              Alex, quick update: the rollout is still moving, but one
              dependency needs sign-off before we commit to Monday.
            </p>
            <button>Approve</button>
          </div>
        </div>
        <div className="hero-source-row">
          {connectorStack.slice(0, 6).map((icon) => (
            <div key={icon.name}>
              <BrandGlyph src={icon.src} name={icon.name} />
              <span>{icon.short}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ConnectorBand() {
  return (
    <section className="connector-band" aria-label="Example connected systems">
      <div className="band-copy">Connected systems</div>
      <div className="marquee-viewport">
        <div className="marquee-track">
          {[...connectorStack, ...connectorStack, ...connectorStack].map((icon, index) => (
            <div key={`${icon.name}-${index}`} className="connector-pill">
              <BrandGlyph src={icon.src} name={icon.name} />
              <span>{icon.short}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SignalSection() {
  return (
    <section id="platform" className="section signal-section">
      <div className="section-label">Platform</div>
      <div className="split-copy">
        <MeasuredText
          as="h2"
          font="700 62px Manrope"
          lineHeight={60}
          text="One operating view for what changed, who owns it, and what happens next."
        />
        <MeasuredText
          as="p"
          className="section-copy"
          font="500 20px Manrope"
          lineHeight={32}
          text="Hermes reads from connected systems just in time, then turns scattered updates into a clear operating picture. The goal is not another dashboard. The goal is prepared decisions."
        />
      </div>
      <OperatorDesk />
    </section>
  );
}

function OperatorDesk() {
  return (
    <motion.div
      className="workflow-theatre"
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-140px" }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="theatre-copy">
        <span>Live operating layer</span>
        <MeasuredText
          as="h3"
          font="700 42px Manrope"
          lineHeight={44}
          text="Hermes reads across systems, resolves the current state, then prepares the next move."
        />
        <p>
          The visual is the product logic: live source signals flow into a
          reasoning layer, then come out as approved work artifacts.
        </p>
      </div>
      <div className="beam-stage" aria-label="Source systems flowing into Hermes and prepared outputs">
        <svg className="beam-svg" viewBox="0 0 900 560" aria-hidden="true">
          <defs>
            <marker
              id="beamArrow"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="rgba(224, 161, 98, 0.82)" />
            </marker>
          </defs>
          <path className="beam-path delay-0" d="M140 92 C265 112 320 190 438 254" markerEnd="url(#beamArrow)" />
          <path className="beam-path delay-1" d="M135 210 C268 218 330 230 438 264" markerEnd="url(#beamArrow)" />
          <path className="beam-path delay-2" d="M145 330 C264 315 326 292 438 278" markerEnd="url(#beamArrow)" />
          <path className="beam-path delay-3" d="M140 448 C264 410 330 334 438 292" markerEnd="url(#beamArrow)" />
          <path className="beam-path delay-1" d="M542 258 C635 214 690 166 765 122" markerEnd="url(#beamArrow)" />
          <path className="beam-path delay-2" d="M550 278 C636 278 694 278 765 278" markerEnd="url(#beamArrow)" />
          <path className="beam-path delay-3" d="M542 298 C632 338 690 392 765 436" markerEnd="url(#beamArrow)" />
        </svg>

        <div className="source-cluster">
          {workflowSources.map((icon) => (
            <div key={icon.name} className="beam-node">
              <BrandGlyph src={icon.src} name={icon.name} />
              <span>{icon.short}</span>
            </div>
          ))}
        </div>

        <div className="hermes-core-node">
          <SparklesIcon size={24} />
          <strong>Hermes</strong>
          <span>resolve context</span>
        </div>

        <div className="output-cluster">
          {workflowOutputs.map((output) => (
            <div key={output} className="output-node">
              <span>Prepared</span>
              <strong>{output}</strong>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ActionWorkbench() {
  return (
    <motion.div
      className="action-sequence"
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="sequence-rail">
        <div className="rail-glow" />
        {workflowSteps.map((feature) => (
          <div key={feature.label} className="rail-step">
            <span>{feature.label}</span>
            <strong>{feature.title}</strong>
          </div>
        ))}
      </div>
      <div className="action-showcase">
        <div className="action-card-main">
          <span>Action card</span>
          <strong>Reply to Alex with the current rollout status.</strong>
          <p>
            Hermes already attached the customer question, delivery update,
            calendar pressure, and prior commitment.
          </p>
          <div className="action-card-footer">
            <button>Approve draft</button>
            <small>3 source groups attached</small>
          </div>
        </div>
        <div className="draft-sheet">
          <span>Draft</span>
          <p>
            Alex, quick update: the rollout is still moving. One integration
            dependency shifted, so I’m confirming sign-off before we commit to
            Monday.
          </p>
        </div>
        <div className="source-drawer">
          {sourceSignals.map((signal) => (
            <div key={signal.text} className={`source-drawer-row ${signal.state}`}>
              <small>{signal.tool}</small>
              <p>{signal.text}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ActionSection() {
  return (
    <section id="actions" className="section action-section">
      <div className="section-label">Action OS</div>
      <div className="section-heading-row">
        <MeasuredText
          as="h2"
          font="700 60px Manrope"
          lineHeight={58}
          text="From activity streams to source-backed action cards."
        />
        <MeasuredText
          as="p"
          className="section-copy"
          font="500 20px Manrope"
          lineHeight={32}
          text="Hermes detects what needs attention, drafts the next step, and shows the evidence before anything is approved."
        />
      </div>
      <ActionWorkbench />
    </section>
  );
}

function MeetingSection() {
  return (
    <section id="meetings" className="section meeting-section">
      <div className="meeting-copy">
        <div className="section-label">Meeting agent</div>
        <MeasuredText
          as="h2"
          font="700 60px Manrope"
          lineHeight={58}
          text="Every meeting arrives with context already attached."
        />
        <MeasuredText
          as="p"
          className="section-copy"
          font="500 20px Manrope"
          lineHeight={32}
          text="Hermes connects the calendar event with the relevant workstream, open questions, source notes, and follow-ups so the meeting starts at the decision point."
        />
      </div>
      <motion.div
        className="meeting-canvas"
        initial={{ opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-120px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg className="meeting-beams" viewBox="0 0 760 500" aria-hidden="true">
          <defs>
            <marker
              id="meetingBeamArrow"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="rgba(224, 161, 98, 0.82)" />
            </marker>
          </defs>
          <path className="beam-path delay-0" d="M128 118 C250 142 305 200 382 245" markerEnd="url(#meetingBeamArrow)" />
          <path className="beam-path delay-1" d="M128 250 C260 250 310 250 382 250" markerEnd="url(#meetingBeamArrow)" />
          <path className="beam-path delay-2" d="M128 382 C250 336 300 294 382 258" markerEnd="url(#meetingBeamArrow)" />
        </svg>
        <div className="meeting-inputs">
          <div className="meeting-input-card">
            <span>Calendar</span>
            <strong>Acme rollout review</strong>
            <p>Today, 2:30 PM</p>
          </div>
          <div className="meeting-input-card">
            <span>Workstream</span>
            <strong>Launch readiness</strong>
            <p>Open blocker and owner update attached.</p>
          </div>
          <div className="meeting-input-card">
            <span>Thread</span>
            <strong>Customer question</strong>
            <p>Alex asked for current rollout status.</p>
          </div>
        </div>
        <div className="meeting-center-node">
          <SparklesIcon size={22} />
          <strong>Prep agent</strong>
        </div>
        <div className="meeting-output-dossier">
          <span>Prepared before the meeting</span>
          <strong>Start with the decision, not the catch-up.</strong>
          <p>
            Confirm rollout owner, resolve support coverage, and approve the
            customer update draft.
          </p>
          <div className="dossier-grid">
            <div>
              <small>Agenda</small>
              <p>Owner update and deployment readiness.</p>
            </div>
            <div>
              <small>Question</small>
              <p>Who signs off on support coverage?</p>
            </div>
            <div>
              <small>Follow-up</small>
              <p>Send approved recap after the call.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function MemorySection() {
  return (
    <section id="memory" className="section memory-section">
      <div className="section-label">Company memory</div>
      <div className="memory-layout">
        <div>
          <MeasuredText
            as="h2"
            font="700 60px Manrope"
            lineHeight={58}
            text="Memory that behaves like operating context, not a scrapbook."
          />
          <MeasuredText
            as="p"
            className="section-copy"
            font="500 20px Manrope"
            lineHeight={32}
            text="Hermes keeps durable facts tied to people, projects, decisions, and sources. When context changes, future actions can use the current version instead of repeating stale assumptions."
          />
        </div>
        <div className="memory-illustration" aria-label="Connected sources become clean company memory">
          <div className="memory-source-column">
            {connectorStack.slice(0, 4).map((icon) => (
              <div key={icon.name} className="memory-source-node">
                <BrandGlyph src={icon.src} name={icon.name} />
                <span>{icon.short}</span>
              </div>
            ))}
          </div>
          <div className="memory-flow-core">
            <div className="flow-line one" />
            <div className="flow-line two" />
            <div className="flow-line three" />
            <div className="memory-core-node">
              <NetworkIcon size={18} />
              <strong>Hermes memory</strong>
              <span>dedupe / resolve / update</span>
            </div>
          </div>
          <div className="memory-output-stack">
            {memoryRecords.map((record, index) => (
              <motion.div
                key={record.value}
                className="memory-output-card"
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <span>{record.label}</span>
                <p>{record.value}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LeadSection() {
  return (
    <section id="book-demo" className="section lead-section">
      <div className="lead-copy">
        <div className="section-label">Early access</div>
        <MeasuredText
          as="h2"
          font="700 60px Manrope"
          lineHeight={58}
          text="Bring Hermes into your operating rhythm."
        />
        <MeasuredText
          as="p"
          className="section-copy"
          font="500 20px Manrope"
          lineHeight={32}
          text="Tell us how your company currently tracks action across tools. We will follow up with a focused walkthrough."
        />
        <div className="lead-proof">
          <div>
            <FileCheck2Icon size={16} />
            Action cards
          </div>
          <div>
            <MessageSquareTextIcon size={16} />
            Unified context
          </div>
          <div>
            <ShieldCheckIcon size={16} />
            Approval-led execution
          </div>
        </div>
      </div>
      <LeadForm />
    </section>
  );
}

function LeadForm() {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not submit request.");
      setState("success");
      setMessage("Request received. We will follow up shortly.");
      form.reset();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not submit the request right now.",
      );
    }
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <input
        className="honeypot"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="form-grid">
        <label>
          Name
          <input name="name" required placeholder="Your name" />
        </label>
        <label>
          Work email
          <input name="email" type="email" required placeholder="you@company.com" />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Company
          <input name="company" required placeholder="Company name" />
        </label>
        <label>
          Role
          <input name="role" required placeholder="Founder, COO, VP Ops..." />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Company size
          <select name="companySize" required defaultValue="">
            <option value="" disabled>
              Select size
            </option>
            <option>1-10</option>
            <option>11-50</option>
            <option>51-200</option>
            <option>201-1000</option>
            <option>1000+</option>
          </select>
        </label>
        <label>
          Interest
          <select name="interest" required defaultValue="">
            <option value="" disabled>
              Select focus
            </option>
            <option>Action OS</option>
            <option>Meeting prep</option>
            <option>Company memory</option>
            <option>Executive visibility</option>
            <option>Investment conversation</option>
          </select>
        </label>
      </div>
      <label>
        Notes
        <textarea
          name="message"
          rows={4}
          placeholder="What should Hermes prepare before your next decision?"
        />
      </label>
      <button className="submit-button" disabled={state === "submitting"}>
        {state === "submitting" ? "Sending request" : "Request walkthrough"}
        <ArrowRightIcon size={16} />
      </button>
      {message && <p className={`form-status ${state}`}>{message}</p>}
    </form>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="brand-lockup">
        <span className="brand-mark">H</span>
        <span>
          Hermes
          <small>Action OS</small>
        </span>
      </div>
      <p>Prepared action across the systems your company already uses.</p>
    </footer>
  );
}

function BrandGlyph({ src, name }: { src: string; name: string }) {
  return (
    <span className="brand-glyph" role="img" aria-label={name}>
      <img src={src} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

type MeasuredTextProps = {
  as: "h1" | "h2" | "h3" | "p" | "strong" | "span";
  text: string;
  font: string;
  lineHeight: number;
  className?: string;
};

/* eslint-disable react-hooks/immutability */
function MeasuredText({
  as,
  text,
  font,
  lineHeight,
  className,
}: MeasuredTextProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!node) return;
    const element = node;

    function update() {
      const width = element.clientWidth;
      if (width <= 0) return;

      const styles = window.getComputedStyle(element);
      const renderedFont = [
        styles.fontStyle,
        styles.fontVariant,
        styles.fontWeight,
        styles.fontSize,
        styles.fontFamily || FONT_STACK,
      ].join(" ");
      const renderedLineHeight =
        Number.parseFloat(styles.lineHeight) ||
        lineHeight ||
        Number.parseFloat(styles.fontSize) * 1.12;
      const letterSpacing = Number.parseFloat(styles.letterSpacing);
      const preparedText = prepare(text, renderedFont || `${font}, ${FONT_STACK}`, {
        letterSpacing: Number.isFinite(letterSpacing) ? letterSpacing : 0,
      });
      const result = layoutText(preparedText, width, renderedLineHeight);
      setHeight(Math.ceil(result.height));
      element.dataset.lines = String(result.lineCount);
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    void document.fonts.ready.then(update);
    return () => observer.disconnect();
  }, [font, lineHeight, node, text]);

  return createElement(
    as,
    {
      ref: setNode,
      className: ["measured-text", className].filter(Boolean).join(" "),
      style:
        height === null ? undefined : ({ minHeight: height } as CSSProperties),
    },
    text,
  );
}
/* eslint-enable react-hooks/immutability */
