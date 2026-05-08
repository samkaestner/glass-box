"use client";

import type { ThoughtTreeState } from "@glassbox/core";
import { SpatialRail, ThoughtTreeProvider } from "@glassbox/react";

const seedState: ThoughtTreeState = {
  nodesById: {
    "node-citation-1": {
      id: "node-citation-1",
      type: "citation",
      createdAt: "2026-04-28T00:00:00.000Z",
      branchId: "branch-main",
      parents: [],
      source: {
        kind: "url",
        uri: "https://example.com/report",
        title: "Reference Report",
        domain: "example.com"
      },
      excerpt: "Key citation grounding the downstream inference."
    },
    "node-citation-2": {
      id: "node-citation-2",
      type: "citation",
      createdAt: "2026-04-28T00:00:10.000Z",
      branchId: "branch-main",
      parents: [],
      source: {
        kind: "url",
        uri: "https://openai.com/research",
        title: "OpenAI Research",
        domain: "openai.com"
      }
    },
    "node-citation-3": {
      id: "node-citation-3",
      type: "citation",
      createdAt: "2026-04-28T00:00:20.000Z",
      branchId: "branch-main",
      parents: [],
      source: {
        kind: "url",
        uri: "https://www.anthropic.com/research",
        title: "Anthropic Research",
        domain: "anthropic.com"
      }
    },
    "node-citation-4": {
      id: "node-citation-4",
      type: "citation",
      createdAt: "2026-04-28T00:00:30.000Z",
      branchId: "branch-main",
      parents: [],
      source: {
        kind: "url",
        uri: "https://arxiv.org/",
        title: "arXiv",
        domain: "arxiv.org"
      }
    },
    "node-decision-1": {
      id: "node-decision-1",
      type: "decision",
      createdAt: "2026-04-28T00:01:00.000Z",
      branchId: "branch-main",
      parents: ["node-citation-1"],
      claim: "decision 1a",
      confidence: 0.82,
      provenance: ["node-citation-1"],
      rationale:
        "The reference report establishes the baseline lift assumption with a tight confidence interval, so we anchored the framing on its findings.",
      alternatives: [
        {
          id: "alt-1",
          label: "Reframe around the cost ceiling",
          description: "Treat budget as the binding constraint and rebuild the framing from the cost side."
        },
        {
          id: "alt-2",
          label: "Defer until a second source agrees",
          description: "Hold the framing until at least one independent citation confirms the lift band."
        }
      ]
    },
    "node-decision-2a": {
      id: "node-decision-2a",
      type: "decision",
      createdAt: "2026-04-28T00:02:00.000Z",
      branchId: "branch-main",
      parents: ["node-decision-1"],
      claim: "decision 2a",
      confidence: 0.62,
      provenance: ["node-citation-1", "node-citation-2", "node-citation-3", "node-citation-4"],
      rationale:
        "Across four citations the lift estimates converge near +12%, with the OpenAI and Anthropic reports diverging on cost. We picked option A because its cost profile fits the constraint set in decision 1a.",
      alternatives: [
        {
          id: "alt-1",
          label: "Optimize for cost over lift",
          description: "Re-rank the candidates assuming the budget cap drops by 30%."
        },
        {
          id: "alt-2",
          label: "Require a second confirming source",
          description: "Withhold the decision until at least one citation outside example.com agrees."
        }
      ]
    },
    "node-decision-3a": {
      id: "node-decision-3a",
      type: "decision",
      createdAt: "2026-04-28T00:03:00.000Z",
      branchId: "branch-main",
      parents: ["node-decision-2a"],
      claim: "decision 3a",
      confidence: 0.71,
      provenance: ["node-citation-1", "node-decision-2a"],
      rationale:
        "Given decision 2a's option A, the next step that maximizes expected lift while keeping rollout reversible is to ship the A/B variant behind a cohort flag.",
      alternatives: [
        {
          id: "alt-1",
          label: "Ship to 100% immediately",
          description: "Skip the cohort gate and accept the higher rollback risk for faster signal."
        },
        {
          id: "alt-2",
          label: "Run a shadow test first",
          description: "Mirror traffic to the new path without exposing it to users until variance is bounded."
        }
      ]
    },
    "node-execution-1": {
      id: "node-execution-1",
      type: "execution",
      createdAt: "2026-04-28T00:04:00.000Z",
      branchId: "branch-main",
      parents: ["node-decision-3a"],
      action: {
        kind: "mutate",
        summary: "Apply cohort flag configuration",
        payload: {
          flagName: "ab_lift_experiment",
          cohortPercentage: 10,
          fallbackVariant: "control"
        },
        explanation: "By rolling out the feature flag to 10% of users, we cap the blast radius in case of unexpected errors, while still gathering enough signal to measure the conversion lift against the control variant."
      },
      gate: {
        status: "pending"
      }
    },
    "node-conflict-1": {
      id: "node-conflict-1",
      type: "conflict",
      createdAt: "2026-04-28T00:05:00.000Z",
      branchId: "branch-main",
      parents: ["node-execution-1"],
      contenders: ["node-citation-2", "node-citation-3"],
      description: "Wait, the projected API limits contradict the budget constraints. We must resolve the data conflict before proceeding further."
    },
    "node-decision-2b": {
      id: "node-decision-2b",
      type: "decision",
      createdAt: "2026-04-28T00:02:10.000Z",
      branchId: "branch-b",
      parents: ["node-decision-1"],
      claim: "decision 2b",
      confidence: 0.55,
      provenance: ["node-citation-4"],
      rationale: "Reframing around the cost ceiling constraint as requested. The arXiv paper suggests an alternative algorithmic approach that drastically reduces compute overhead.",
      alternatives: [
        { id: "alt-1", label: "Proceed with cheap algorithm", description: "Accept a 5% drop in accuracy." },
        { id: "alt-2", label: "Request budget extension", description: "Fallback to the high-lift algorithm." }
      ]
    },
    "node-decision-3b": {
      id: "node-decision-3b",
      type: "decision",
      createdAt: "2026-04-28T00:03:10.000Z",
      branchId: "branch-b",
      parents: ["node-decision-2b"],
      claim: "decision 3b",
      confidence: 0.70,
      provenance: ["node-decision-2b"],
      rationale: "Opting for the cheap algorithm. We need to deploy the new model to a staging environment to verify latency."
    },
    "node-decision-3c": {
      id: "node-decision-3c",
      type: "decision",
      createdAt: "2026-04-28T00:03:30.000Z",
      branchId: "branch-c",
      parents: ["node-decision-2b"],
      claim: "decision 3c",
      confidence: 0.88,
      provenance: ["node-decision-2b"],
      rationale: "Instead of proceeding with the cheap algorithm, we are requesting a budget extension. I have drafted an email to the finance team."
    }
  },
  edges: [
    { from: "node-citation-1", to: "node-decision-1" },
    { from: "node-decision-1", to: "node-decision-2a" },
    { from: "node-decision-2a", to: "node-decision-3a" },
    { from: "node-decision-3a", to: "node-execution-1" },
    { from: "node-execution-1", to: "node-conflict-1" },
    { from: "node-decision-1", to: "node-decision-2b" },
    { from: "node-decision-2b", to: "node-decision-3b" },
    { from: "node-decision-2b", to: "node-decision-3c" }
  ],
  branchesById: {
    "branch-main": {
      id: "branch-main",
      name: "Main",
      createdAt: "2026-04-28T00:00:00.000Z",
      timeline: ["node-citation-1", "node-decision-1", "node-decision-2a", "node-decision-3a", "node-execution-1", "node-conflict-1"]
    },
    "branch-b": {
      id: "branch-b",
      name: "Cost Ceiling Fork",
      createdAt: "2026-04-28T00:02:10.000Z",
      forkedFromNodeId: "node-decision-1",
      parentBranchId: "branch-main",
      timeline: ["node-citation-1", "node-decision-1", "node-decision-2b", "node-decision-3b"]
    },
    "branch-c": {
      id: "branch-c",
      name: "Budget Extension",
      createdAt: "2026-04-28T00:03:30.000Z",
      forkedFromNodeId: "node-decision-2b",
      parentBranchId: "branch-b",
      timeline: ["node-citation-1", "node-decision-1", "node-decision-2b", "node-decision-3c"]
    }
  },
  rootBranchId: "branch-main",
  activeBranchId: "branch-c",
  revision: 1,
  updatedAt: "2026-04-28T00:02:00.000Z"
};

export function RailDemo() {
  return (
    <ThoughtTreeProvider initialState={seedState}>
      <div className="flex justify-end">
        <SpatialRail aria-label="Spatial rail" />
      </div>
    </ThoughtTreeProvider>
  );
}

