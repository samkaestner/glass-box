import * as React from "react";

export default function NodeModelPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24 space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          The Node Model
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          Understanding the core building blocks of the <code className="font-mono text-[#e0bc78]">ThoughtTreeState</code> DAG.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Overview</h2>
        <p className="text-base leading-relaxed text-white/70">
          The Glass Box framework relies on a directed acyclic graph (DAG) to represent the deterministic reasoning of an LLM. 
          The graph is composed of four primary node types. Each node type plays a distinct role in orchestrating trust and handling uncertainty.
        </p>
      </section>

      <div className="space-y-12">
        {/* Citation Node */}
        <section className="rounded-2xl border border-white/10 bg-[#121722] p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <h3 className="text-xl font-medium text-white">CitationNode</h3>
          </div>
          <p className="text-sm leading-relaxed text-white/70 mb-4">
            Represents a retrieved chunk of information or grounding context. These nodes are not rendered directly in the spatial rail timeline; instead, they are attached to <code className="font-mono text-xs text-white/90">DecisionNode</code>s via the <code className="font-mono text-xs text-white/90">provenance</code> array.
          </p>
          <div className="rounded-lg bg-black/40 p-4 border border-white/5 overflow-x-auto">
            <pre className="text-xs text-white/60">
              <code>{`type CitationNode = {
  id: string;
  type: "citation";
  source: {
    uri: string;
    domain?: string;
    title?: string;
  };
  excerpt?: string;
}`}</code>
            </pre>
          </div>
        </section>

        {/* Decision Node */}
        <section className="rounded-2xl border border-white/10 bg-[#121722] p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e0bc78]/20 text-[#e0bc78] ring-1 ring-[#e0bc78]/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
            <h3 className="text-xl font-medium text-white">DecisionNode</h3>
          </div>
          <p className="text-sm leading-relaxed text-white/70 mb-4">
            Represents a core reasoning step or logical deduction made by the AI. This is the most common node in the visual rail. It surfaces the AI's internal <code className="font-mono text-xs text-white/90">confidence</code> level, a detailed <code className="font-mono text-xs text-white/90">rationale</code>, and the specific citations used to form the decision. Users can "Fork" from a DecisionNode to steer the AI down an alternative path.
          </p>
          <div className="rounded-lg bg-black/40 p-4 border border-white/5 overflow-x-auto">
            <pre className="text-xs text-white/60">
              <code>{`type DecisionNode = {
  id: string;
  type: "decision";
  claim: string;
  rationale?: string;
  confidence: number; // 0.0 to 1.0
  provenance: string[]; // Array of CitationNode IDs
  alternatives?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
}`}</code>
            </pre>
          </div>
        </section>

        {/* Execution Node */}
        <section className="rounded-2xl border border-white/10 bg-[#121722] p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h3 className="text-xl font-medium text-white">ExecutionNode</h3>
          </div>
          <p className="text-sm leading-relaxed text-white/70 mb-4">
            Represents an external tool call, API request, or mutation. Because Glass Box is built for trust, Execution Nodes are implemented as human-in-the-loop "gates". The node pauses the reasoning chain until a human explicitly allows, rejects, or modifies the payload. The <code className="font-mono text-xs text-white/90">action.kind</code> (e.g. "MUTATE", "FETCH") determines the visual badge in the UI.
          </p>
          <div className="rounded-lg bg-black/40 p-4 border border-white/5 overflow-x-auto">
            <pre className="text-xs text-white/60">
              <code>{`type ExecutionNode = {
  id: string;
  type: "execution";
  action: {
    kind: string; // e.g. "MUTATE", "API_CALL", etc.
    summary: string;
    payload: unknown;
    explanation?: string;
  };
  gate: {
    status: "pending" | "allowed_once" | "always_allowed" | "rejected";
    decidedAt?: string;
    decidedBy?: "user" | "system";
    reason?: string;
  };
}`}</code>
            </pre>
          </div>
        </section>

        {/* Conflict Node */}
        <section className="rounded-2xl border border-white/10 bg-[#121722] p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 className="text-xl font-medium text-white">ConflictNode</h3>
          </div>
          <p className="text-sm leading-relaxed text-white/70 mb-4">
            When the AI retrieves multiple contradictory sources (Synthesis Clash), it emits a ConflictNode instead of hallucinating. The timeline halts, presenting the competing sources side-by-side, forcing the human to arbitrate before reasoning can continue.
          </p>
          <div className="rounded-lg bg-black/40 p-4 border border-white/5 overflow-x-auto">
            <pre className="text-xs text-white/60">
              <code>{`type ConflictNode = {
  id: string;
  type: "conflict";
  topic: string;
  contenders: Array<{
    id: string;
    citationId: string;
    claim: string;
    snippet: string;
  }>;
  resolvedWithContenderId?: string;
}`}</code>
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
