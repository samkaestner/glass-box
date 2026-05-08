// @vitest-environment jsdom

import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createGlassBoxRun, type GlassBoxSerializedRun } from "@glassbox/core";
import { useThoughtTree } from "../thought-tree/ThoughtTreeContext.js";
import { ApprovalGate } from "../supervision/ApprovalGate.js";
import { ConflictResolver } from "../supervision/ConflictResolver.js";
import { GlassBoxProvider, useGlassBox } from "./GlassBoxContext.js";
import { createInMemoryGlassBoxPersistence } from "./persistence.js";

function GlassBoxProbe() {
  const glassbox = useGlassBox();
  const thoughtTree = useThoughtTree();

  return (
    <div>
      <div data-testid="run-id">{glassbox.runId}</div>
      <div data-testid="event-count">{glassbox.events.length}</div>
      <div data-testid="timeline-size">{thoughtTree.getBranchTimeline().length}</div>
      <button
        type="button"
        onClick={() => {
          const source = glassbox.recordSource({
            source: {
              kind: "url",
              uri: "https://example.com/source",
              domain: "example.com"
            }
          });
          glassbox.recordDecision({
            claim: "Visible supervision decision",
            confidence: 0.87,
            provenance: [source.nodeId!]
          });
        }}
      >
        record decision
      </button>
    </div>
  );
}

function makeActionRun() {
  const run = createGlassBoxRun({ runId: "run-action" });
  const action = run.requestActionApproval({
    action: {
      kind: "tool.send",
      payload: { id: "message-1" },
      summary: "Send customer message",
      explanation: "The assistant wants to send a customer-visible reply."
    }
  });
  return { events: run.events, actionId: action.nodeId! };
}

function makeConflictRun() {
  const run = createGlassBoxRun({ runId: "run-conflict" });
  const first = run.recordSource({
    source: {
      kind: "file",
      uri: "file:///a.md",
      title: "a.md"
    },
    excerpt: "Use option A."
  });
  const second = run.recordSource({
    source: {
      kind: "file",
      uri: "file:///b.md",
      title: "b.md"
    },
    excerpt: "Use option B."
  });
  const conflict = run.recordConflict({
    contenders: [first.nodeId!, second.nodeId!],
    description: "The sources disagree."
  });
  return { events: run.events, conflictId: conflict.nodeId! };
}

describe("GlassBoxProvider", () => {
  it("exposes event-backed run APIs and persists snapshots", () => {
    const persistence = createInMemoryGlassBoxPersistence();

    render(
      <GlassBoxProvider runId="run-ui" persistence={persistence}>
        <GlassBoxProbe />
      </GlassBoxProvider>
    );

    expect(screen.getByTestId("run-id").textContent).toBe("run-ui");
    expect(screen.getByTestId("event-count").textContent).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "record decision" }));

    expect(screen.getByTestId("timeline-size").textContent).toBe("2");
    expect(screen.getByTestId("event-count").textContent).toBe("3");
    const saved = persistence.load("run-ui") as GlassBoxSerializedRun | null;
    expect(saved?.events).toHaveLength(3);
  });

  it("lets ApprovalGate call host callbacks before resolving the action event", async () => {
    const { events, actionId } = makeActionRun();
    const onApprove = vi.fn();

    render(
      <GlassBoxProvider initialEvents={events}>
        <ApprovalGate nodeId={actionId} onApprove={onApprove} />
      </GlassBoxProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Allow once" }));

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("allowed once")).toBeTruthy();
  });

  it("lets ConflictResolver call host callbacks before recording resolution", async () => {
    const { events, conflictId } = makeConflictRun();
    const onResolve = vi.fn();

    render(
      <GlassBoxProvider initialEvents={events}>
        <ConflictResolver nodeId={conflictId} onResolve={onResolve} />
      </GlassBoxProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /a.md/ }));

    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Resolved")).toBeTruthy();
  });
});
