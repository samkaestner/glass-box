# Glass Box

GlassBox is an open source SDK for adding end-user AI supervision to production apps.
Instrument an AI workflow once, then render provenance, decisions, conflicts,
approval gates, branches, and audit history anywhere in your product.

GlassBox exposes safe, user-facing supervision summaries. It is not a raw
chain-of-thought viewer.

## Monorepo layout

- `apps/docs`: Next.js documentation site
- `apps/playground`: Next.js local testing environment
- `packages/core`: Pure TypeScript DAG state logic
- `packages/react`: React provider, hooks, and supervision components (Tailwind + Framer Motion)
- `packages/theme`: Shared design tokens (colors, spacing) + Tailwind preset

## Core concepts

- `GlassBoxEvent`: versioned, append-only events that can rebuild a run.
- `GlassBoxProvider`: React runtime for event-backed state, persistence, and privacy hooks.
- `SpatialRail`: flagship branch/provenance surface.
- `ApprovalGate`: callback-driven action approval primitive.
- `ConflictResolver`: user arbitration primitive for contradictory evidence.

## Getting started

```bash
npm install
npm run dev
```
