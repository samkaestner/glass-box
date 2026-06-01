# Glassbox

> A UX framework for AI transparency — spatial reasoning UI primitives and a typed DAG state core for building trustworthy AI interfaces.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Why Glassbox

Most AI interfaces treat reasoning as a black box — a spinner, then an answer. Glassbox is built on a different premise: that transparency is a UX responsibility, not just a technical one.

When an AI makes a decision, users deserve to see what it was based on. When it's about to take an action, they deserve the chance to intervene. When sources conflict, they deserve to arbitrate. Glassbox gives you the UI primitives to make all of that possible — grounded in a typed, immutable DAG state model that treats AI reasoning as a tree, not a flat chat log.

This is a framework for developers building AI products and design teams establishing trust UX patterns.

## Components

| Component | What it does |
|---|---|
| **Spatial Rail** | A persistent right-rail that renders AI reasoning as a scrollable, branching timeline of typed nodes |
| **Confidence Provenance** | Hover a decision node to highlight exactly which citations contributed to it |
| **Execution Gate** | Blocks agentic actions until the user explicitly allows, modifies, or rejects them |
| **Conflict Resolution** | Surfaces contradictory sources as a Y-junction the user arbitrates before generation continues |

## Install

```bash
npm install @glassbox/core @glassbox/react
```

## Quick Start

```tsx
import { ThoughtTreeProvider, useThoughtTree, SpatialRail } from '@glassbox/react';

function App() {
  return (
    <ThoughtTreeProvider>
      <div className="flex">
        <main>{/* your app */}</main>
        <SpatialRail />
      </div>
    </ThoughtTreeProvider>
  );
}
```

Then add nodes as your AI generates reasoning:

```ts
const { addNode } = useThoughtTree();

// When AI retrieves a source
addNode({ type: 'citation', source: { kind: 'url', uri: 'https://...', title: 'Source Title' } });

// When AI makes a decision
addNode({ type: 'decision', claim: 'Based on sources, X is true', confidence: 0.87, provenance: [citationId] });
```

See the [Quickstart guide](apps/docs/src/app/quickstart) for the full walkthrough.

## Packages

- [`@glassbox/core`](packages/core) — Pure TypeScript DAG state machine. Zero dependencies. Use without React if you want to build your own UI.
- [`@glassbox/react`](packages/react) — React ≥19 UI components built on `@glassbox/core`, styled with Tailwind and animated with Framer Motion.
- [`@glassbox/theme`](packages/theme) — Shared design tokens and Tailwind preset for theming.

## For Design Teams

Glassbox is as much a pattern library as it is a component library. The four components represent a design framework for AI trust UX — patterns you can adapt, extend, or implement in your own design system.

Start with the [design rationale](apps/docs/src/app/why) to understand the thinking behind the patterns. The [node model](apps/docs/src/app/node-model) documents the visual language. Each component reference includes design notes on customization.

## Monorepo Structure

```
glassbox/
├── packages/
│   ├── core/        # @glassbox/core — DAG state machine
│   ├── react/       # @glassbox/react — React UI components
│   └── theme/       # @glassbox/theme — design tokens
└── apps/
    ├── docs/        # Documentation site
    └── playground/  # Local development playground
```

## Development

```bash
git clone https://github.com/samkaestner/glass-box
cd glass-box
pnpm install
pnpm dev
```

## License

MIT © Sam Kaestner
