"use client";

import * as React from "react";
import type { ExecutionNode } from "@glassbox/core";
import { useThoughtTree } from "../thought-tree/ThoughtTreeContext.js";

export type ExecutionNodeUIProps = {
  node: ExecutionNode;
  isActive: boolean;
};

export function ExecutionNodeUI({ node, isActive }: ExecutionNodeUIProps) {
  const { updateExecutionGate } = useThoughtTree();
  const [isModifying, setIsModifying] = React.useState(false);
  
  // Initialize payload string
  const [payloadStr, setPayloadStr] = React.useState(() => {
    try {
      return JSON.stringify(node.action.payload, null, 2);
    } catch {
      return String(node.action.payload);
    }
  });

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const syncTextareaHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(() => {
    if (isModifying) {
      syncTextareaHeight();
    }
  }, [isModifying, payloadStr, syncTextareaHeight]);

  const handleStatusChange = (
    status: "allowed_once" | "always_allowed" | "rejected",
    reason?: string
  ) => {
    updateExecutionGate({
      executionNodeId: node.id,
      status,
      decidedBy: "user",
      reason,
    });
  };

  const isPending = node.gate.status === "pending";
  const containerBaseClasses = "w-full max-w-sm rounded-[1.25rem] border p-4 shadow-gb-node transition-colors";
  
  const stateClasses = !isActive
    ? "border-white/10 bg-white/[0.02]"
    : isPending
    ? "border-orange-400/50 bg-orange-950/20"
    : node.gate.status === "rejected"
    ? "border-red-400/30 bg-red-950/20"
    : "border-emerald-400/30 bg-emerald-950/20";

  return (
    <div className={`${containerBaseClasses} ${stateClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
            {node.action.kind}
          </p>
          <h3 className={`mt-1 text-sm font-semibold tracking-tight ${isActive ? "text-white/95" : "text-white/60"}`}>
            {node.action.summary}
          </h3>
        </div>
        <div
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isPending
              ? "border-orange-500/30 bg-orange-500/10 text-orange-200"
              : node.gate.status === "rejected"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          } ${!isActive ? "opacity-50" : ""}`}
        >
          {node.gate.status.replace("_", " ")}
        </div>
      </div>

      <div className="mt-4">
        {isModifying && isPending && isActive ? (
          <div>
            <label
              htmlFor={`payload-editor-${node.id}`}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55"
            >
              Modify Payload
            </label>
            <textarea
              id={`payload-editor-${node.id}`}
              ref={textareaRef}
              value={payloadStr}
              onChange={(e) => setPayloadStr(e.target.value)}
              className="mt-2 w-full resize-none overflow-hidden rounded-[0.85rem] border border-white/12 bg-[#0c111c] px-3 py-2 text-xs font-mono leading-relaxed text-white/90 placeholder:text-white/35 focus:border-[#e0bc78]/60 focus:outline-none focus:ring-2 focus:ring-white/10"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="rounded-[0.85rem] border border-white/10 bg-black/20 p-3">
            <pre className={`text-[11px] font-mono leading-relaxed ${isActive ? "text-white/70" : "text-white/40"} overflow-x-auto`}>
              {payloadStr}
            </pre>
          </div>
        )}
      </div>

      {isPending && isActive && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          {isModifying ? (
            <>
              <button
                onClick={() => setIsModifying(false)}
                className="rounded-[0.75rem] border border-white/15 px-3 py-2 text-xs font-medium text-white/80 transition hover:border-white/35 hover:text-white"
              >
                Cancel Edit
              </button>
              <button
                onClick={() => handleStatusChange("allowed_once", "Modified payload manually")}
                className="rounded-[0.75rem] border border-[#e0bc78]/70 bg-[#e0bc78] px-3 py-2 text-xs font-semibold text-[#1a1407] transition hover:bg-[#ecc685] active:scale-[0.98]"
              >
                Execute Modified
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsModifying(true)}
                className="rounded-[0.75rem] border border-white/15 px-3 py-2 text-xs font-medium text-white/80 transition hover:border-white/35 hover:text-white"
              >
                Modify
              </button>
              <button
                onClick={() => handleStatusChange("rejected")}
                className="rounded-[0.75rem] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
              >
                Reject
              </button>
              <button
                onClick={() => handleStatusChange("allowed_once")}
                className="col-span-2 rounded-[0.75rem] border border-emerald-500/50 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
              >
                Allow Once
              </button>
              {/* Note: "Always Allow" can be added here as an icon or dropdown, omitting for simplicity of MVP or adding as a small link below */}
              <button
                onClick={() => handleStatusChange("always_allowed")}
                className="col-span-2 mt-1 text-[10px] font-medium text-white/40 transition hover:text-white/70"
              >
                Always allow this action
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
