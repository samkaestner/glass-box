"use client";

import * as React from "react";
import {
  GlassBoxProvider,
  createLocalStorageGlassBoxPersistence
} from "@glassbox/react";
import { LLMOrchestrator } from "./LLMOrchestrator";

export function RailDemo() {
  const persistence = React.useMemo(
    () => createLocalStorageGlassBoxPersistence("glassbox:playground"),
    []
  );

  return (
    <GlassBoxProvider
      runId="playground-demo"
      title="GlassBox playground"
      persistence={persistence}
    >
      <LLMOrchestrator />
    </GlassBoxProvider>
  );
}
