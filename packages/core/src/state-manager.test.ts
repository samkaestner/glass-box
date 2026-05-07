import { describe, expect, it } from "vitest";
import type { ThoughtTreeState } from "./thought-tree.js";
import {
  addNodeToThoughtTree,
  createDeterministicIdFactory,
  createThoughtTreeStateManager,
  forkThoughtTreeAtNode,
  switchThoughtTreeBranch,
  updateExecutionGate,
  validateThoughtTreeState
} from "./state-manager.js";

function makeBaseState(): ThoughtTreeState {
  return {
    nodesById: {
      "node-citation-1": {
        id: "node-citation-1",
        type: "citation",
        createdAt: "2026-01-01T00:00:00.000Z",
        branchId: "branch-main",
        parents: [],
        source: {
          kind: "url",
          uri: "https://example.com/a",
          domain: "example.com"
        }
      },
      "node-decision-1": {
        id: "node-decision-1",
        type: "decision",
        createdAt: "2026-01-01T00:01:00.000Z",
        branchId: "branch-main",
        parents: ["node-citation-1"],
        claim: "Initial synthesis",
        confidence: 0.74,
        provenance: ["node-citation-1"]
      },
      "node-exec-1": {
        id: "node-exec-1",
        type: "execution",
        createdAt: "2026-01-01T00:02:00.000Z",
        branchId: "branch-main",
        parents: ["node-decision-1"],
        action: {
          kind: "api_call",
          payload: { endpoint: "/sync" },
          summary: "Sync data"
        },
        gate: {
          status: "pending"
        }
      }
    },
    edges: [
      { from: "node-citation-1", to: "node-decision-1" },
      { from: "node-decision-1", to: "node-exec-1" }
    ],
    branchesById: {
      "branch-main": {
        id: "branch-main",
        createdAt: "2026-01-01T00:00:00.000Z",
        timeline: ["node-citation-1", "node-decision-1", "node-exec-1"]
      }
    },
    rootBranchId: "branch-main",
    activeBranchId: "branch-main",
    revision: 3,
    updatedAt: "2026-01-01T00:02:00.000Z"
  };
}

describe("state-manager", () => {
  it("adds node immutably with deterministic ids", () => {
    const base = makeBaseState();
    const idFactory = createDeterministicIdFactory({ nodeCounter: 200 });
    const next = addNodeToThoughtTree(
      base,
      {
        type: "citation",
        source: {
          kind: "url",
          uri: "https://example.com/b",
          domain: "example.com"
        }
      },
      {
        idFactory,
        now: () => "2026-01-01T00:03:00.000Z"
      }
    );

    expect(next).not.toBe(base);
    expect(Object.keys(base.nodesById)).toHaveLength(3);
    expect(Object.keys(next.nodesById)).toHaveLength(4);
    expect(next.branchesById["branch-main"].timeline.at(-1)).toBe(
      "node-201-citation-branch-main"
    );
  });

  it("forks at node and switches active branch", () => {
    const base = makeBaseState();
    const idFactory = createDeterministicIdFactory({ branchCounter: 10 });
    const next = forkThoughtTreeAtNode(
      base,
      {
        nodeId: "node-decision-1"
      },
      {
        idFactory,
        now: () => "2026-01-01T00:03:00.000Z"
      }
    );

    expect(next.activeBranchId).toBe("branch-11-from-node-decision-1-branch-main");
    expect(next.branchesById[next.activeBranchId].timeline).toEqual([
      "node-citation-1",
      "node-decision-1"
    ]);
  });

  it("updates execution gate immutably", () => {
    const base = makeBaseState();
    const next = updateExecutionGate(
      base,
      {
        executionNodeId: "node-exec-1",
        status: "allowed_once",
        decidedBy: "user",
        reason: "Approved for this run"
      },
      {
        now: () => "2026-01-01T00:04:00.000Z"
      }
    );

    const updated = next.nodesById["node-exec-1"];
    expect(updated.type).toBe("execution");
    if (updated.type === "execution") {
      expect(updated.gate.status).toBe("allowed_once");
      expect(updated.gate.decidedBy).toBe("user");
    }
    expect(base.nodesById["node-exec-1"]).not.toBe(updated);
  });

  it("validates and rejects cycles", () => {
    const invalid = makeBaseState();
    const cycled = {
      ...invalid,
      nodesById: {
        ...invalid.nodesById,
        "node-citation-1": {
          ...invalid.nodesById["node-citation-1"],
          parents: ["node-decision-1"]
        }
      }
    };

    expect(() => validateThoughtTreeState(cycled)).toThrow(/Cycle detected/);
  });

  it("manager mutates internal state through API", () => {
    const manager = createThoughtTreeStateManager(makeBaseState(), {
      now: () => "2026-01-01T00:05:00.000Z"
    });
    const beforeRevision = manager.state.revision;
    manager.switchBranch("branch-main");
    expect(manager.state.revision).toBe(beforeRevision + 1);
  });

  it("manager keeps deterministic id progression across multiple adds", () => {
    const manager = createThoughtTreeStateManager(makeBaseState(), {
      now: () => "2026-01-01T00:06:00.000Z"
    });
    const first = manager.addNode({
      type: "citation",
      source: {
        kind: "url",
        uri: "https://example.com/new-1"
      }
    });
    const second = manager.addNode({
      type: "citation",
      source: {
        kind: "url",
        uri: "https://example.com/new-2"
      }
    });

    const firstId = first.branchesById[first.activeBranchId].timeline.at(-1);
    const secondId = second.branchesById[second.activeBranchId].timeline.at(-1);
    expect(firstId).toBe("node-4-citation-branch-main");
    expect(secondId).toBe("node-5-citation-branch-main");
  });

  it("prevents switching to unknown branch", () => {
    const base = makeBaseState();
    expect(() => switchThoughtTreeBranch(base, "branch-missing")).toThrow(/does not exist/);
  });

  it("round-trips decision rationale and alternatives through addNode", () => {
    const base = makeBaseState();
    const next = addNodeToThoughtTree(
      base,
      {
        type: "decision",
        parentIds: ["node-decision-1"],
        claim: "Refined synthesis",
        confidence: 0.62,
        provenance: ["node-citation-1"],
        rationale: "Prior decision lacked confirming context; this node folds in the latest citation.",
        alternatives: [
          { id: "alt-1", label: "Optimize for cost", description: "Re-rank candidates assuming a lower budget." },
          { id: "alt-2", label: "Defer until validated" }
        ]
      },
      {
        idFactory: createDeterministicIdFactory({ nodeCounter: 50 }),
        now: () => "2026-01-01T00:07:00.000Z"
      }
    );

    const newId = next.branchesById["branch-main"].timeline.at(-1)!;
    const node = next.nodesById[newId];
    expect(node.type).toBe("decision");
    if (node.type === "decision") {
      expect(node.rationale).toBe(
        "Prior decision lacked confirming context; this node folds in the latest citation."
      );
      expect(node.alternatives).toEqual([
        { id: "alt-1", label: "Optimize for cost", description: "Re-rank candidates assuming a lower budget." },
        { id: "alt-2", label: "Defer until validated" }
      ]);
    }
  });

  it("persists fork steering on the new branch", () => {
    const base = makeBaseState();
    const next = forkThoughtTreeAtNode(
      base,
      {
        nodeId: "node-decision-1",
        steering: { prompt: "Re-evaluate with stricter cost constraints." }
      },
      {
        idFactory: createDeterministicIdFactory({ branchCounter: 20 }),
        now: () => "2026-01-01T00:08:00.000Z"
      }
    );

    const newBranch = next.branchesById[next.activeBranchId];
    expect(newBranch.steering).toEqual({ prompt: "Re-evaluate with stricter cost constraints." });
  });

  it("stores selectedAlternativeId verbatim without validation", () => {
    const base = makeBaseState();
    const next = forkThoughtTreeAtNode(
      base,
      {
        nodeId: "node-decision-1",
        steering: { selectedAlternativeId: "alt-arbitrary" }
      },
      {
        idFactory: createDeterministicIdFactory({ branchCounter: 30 }),
        now: () => "2026-01-01T00:09:00.000Z"
      }
    );

    const newBranch = next.branchesById[next.activeBranchId];
    expect(newBranch.steering).toEqual({ selectedAlternativeId: "alt-arbitrary" });
  });
});

