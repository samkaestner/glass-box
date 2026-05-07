import * as React from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-white/90 selection:bg-[#e0bc78]/30 selection:text-white">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24">
        <header className="mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Glass Box UI Framework
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/60">
            A UX-first React component library for visualizing probabilistic AI systems,
            handling uncertainty, and orchestrating trust.
          </p>
        </header>

        <main className="space-y-16">
          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Quickstart</h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Wrap your application in the <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">ThoughtTreeProvider</code> and render the <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">SpatialRail</code> to visualize the AI's internal processing.
            </p>
            <div className="mt-6 overflow-hidden rounded-[1rem] border border-white/15 bg-[#121722] p-6 shadow-xl">
              <pre className="overflow-x-auto text-sm leading-relaxed text-white/80">
                <code>{`import { SpatialRail, ThoughtTreeProvider } from "@glassbox/react";
import { createEmptyThoughtTreeState } from "@glassbox/core";

const initialState = createEmptyThoughtTreeState();

export function App() {
  return (
    <ThoughtTreeProvider initialState={initialState}>
      <div className="flex min-h-screen">
        <main className="flex-1 p-8">
          {/* Main chat UI goes here */}
        </main>
        
        {/* Right rail for the spatial canvas */}
        <aside className="w-96 shrink-0 border-l border-white/10 bg-[#0a0d14]">
          <SpatialRail />
        </aside>
      </div>
    </ThoughtTreeProvider>
  );
}`}</code>
              </pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight text-white">API Reference</h2>
            
            <div className="mt-8 space-y-10">
              <div>
                <h3 className="text-lg font-medium text-[#e0bc78]">useThoughtTree()</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  The primary hook for interacting with the ThoughtTree context. Returns the current DAG state and mutation methods.
                </p>
                <ul className="mt-4 space-y-3 text-sm text-white/80">
                  <li className="flex items-start gap-3">
                    <code className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/90">state</code>
                    <span>The complete <code className="font-mono text-xs text-white/60">ThoughtTreeState</code> object containing all nodes, edges, and branches.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <code className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/90">addNode(input)</code>
                    <span>Appends a new Citation, Decision, Execution, or Conflict node to the active branch.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <code className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/90">forkAtNode(input)</code>
                    <span>Branches the reasoning chain from a specific node, capturing optional steering prompts.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <code className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/90">resolveConflict(input)</code>
                    <span>Arbitrates a Synthesis Clash by designating one source as authoritative.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <code className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/90">updateExecutionGate(input)</code>
                    <span>Transitions the state of an Execution Node (e.g., pending → allowed_once).</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-[#e0bc78]">&lt;SpatialRail /&gt;</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  The main visualization component. It automatically reads from the <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">ThoughtTreeProvider</code> and renders the active lineage alongside dimmed inactive branches.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white/70">
                  Accepts standard HTML attributes like <code className="font-mono text-xs">className</code> for styling overrides.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
