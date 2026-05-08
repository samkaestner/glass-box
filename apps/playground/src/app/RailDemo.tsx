"use client";

import { createEmptyThoughtTreeState } from "@glassbox/core";
import { ThoughtTreeProvider } from "@glassbox/react";
import { LLMOrchestrator } from "./LLMOrchestrator";

export function RailDemo() {
  // Use the core helper to spin up an empty DAG with a default "branch-main"
  const emptyState = createEmptyThoughtTreeState();

  return (
    <ThoughtTreeProvider initialState={emptyState}>
      <LLMOrchestrator />
    </ThoughtTreeProvider>
  );
}

