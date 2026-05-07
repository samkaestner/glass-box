"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BranchId, CitationNode, ForkSteering, ThoughtNode } from "@glassbox/core";
import { useThoughtTree } from "../thought-tree/ThoughtTreeContext.js";
import { DecisionModal, type DecisionModalStage } from "./DecisionModal.js";
import { ExecutionNodeUI } from "./ExecutionNodeUI.js";
import { ConflictNodeUI } from "./ConflictNodeUI.js";

export type SpatialRailProps = {
  "aria-label"?: string;
  className?: string;
};

type ForkConnector = {
  id: string;
  d: string;
  isActive: boolean;
};

function areOffsetsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

function areConnectorsEqual(a: ReadonlyArray<ForkConnector>, b: ReadonlyArray<ForkConnector>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id || a[i].d !== b[i].d || a[i].isActive !== b[i].isActive) {
      return false;
    }
  }
  return true;
}

function getDecisionConfidenceTone(confidence: number): {
  label: string;
  activeClasses: string;
  inactiveClasses: string;
} {
  if (confidence >= 0.85) {
    return {
      label: "very high",
      activeClasses: "border-emerald-300/90 bg-emerald-500/20 text-emerald-100",
      inactiveClasses: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100/55"
    };
  }
  if (confidence >= 0.7) {
    return {
      label: "high",
      activeClasses: "border-lime-300/90 bg-lime-500/18 text-lime-100",
      inactiveClasses: "border-lime-300/35 bg-lime-500/10 text-lime-100/55"
    };
  }
  if (confidence >= 0.5) {
    return {
      label: "medium",
      activeClasses: "border-amber-300/90 bg-amber-500/18 text-amber-100",
      inactiveClasses: "border-amber-300/35 bg-amber-500/10 text-amber-100/55"
    };
  }
  if (confidence >= 0.3) {
    return {
      label: "low",
      activeClasses: "border-orange-300/90 bg-orange-500/18 text-orange-100",
      inactiveClasses: "border-orange-300/35 bg-orange-500/10 text-orange-100/55"
    };
  }
  return {
    label: "very low",
    activeClasses: "border-red-300/90 bg-red-500/18 text-red-100",
    inactiveClasses: "border-red-300/35 bg-red-500/10 text-red-100/55"
  };
}

export function SpatialRail(props: SpatialRailProps) {
  const { className, ...rest } = props;
  const { state, getActiveBranch, getBranchTimeline, switchBranch, forkAtNode } = useThoughtTree();
  const activeBranch = getActiveBranch();
  const branches = React.useMemo(
    () =>
      Object.values(state.branchesById).sort((a, b) => {
        if (a.createdAt === b.createdAt) {
          return a.id.localeCompare(b.id);
        }
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [state.branchesById]
  );

  const [pendingBranchId, setPendingBranchId] = React.useState<string | null>(null);
  const [isSwitchingBranch, setIsSwitchingBranch] = React.useState(false);
  const [skipSwitchConfirmation, setSkipSwitchConfirmation] = React.useState(false);
  const [doNotAskAgainChecked, setDoNotAskAgainChecked] = React.useState(false);
  const [isForkingNodeId, setIsForkingNodeId] = React.useState<string | null>(null);
  const [hoveredDecisionNodeId, setHoveredDecisionNodeId] = React.useState<string | null>(null);
  const [expandedCitationNodes, setExpandedCitationNodes] = React.useState<Record<string, boolean>>({});
  const [forkConnectors, setForkConnectors] = React.useState<ReadonlyArray<ForkConnector>>([]);
  const [forkConnectorViewport, setForkConnectorViewport] = React.useState({ width: 0, height: 0 });
  const [branchStartOffsets, setBranchStartOffsets] = React.useState<Record<string, number>>({});
  const [modalDecisionId, setModalDecisionId] = React.useState<string | null>(null);
  const [modalStage, setModalStage] = React.useState<DecisionModalStage>("details");
  const [modalSourceBranchId, setModalSourceBranchId] = React.useState<BranchId | null>(null);

  const railTracksRef = React.useRef<HTMLDivElement | null>(null);
  const nodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const branchLaneRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const pendingBranch = pendingBranchId ? state.branchesById[pendingBranchId] : undefined;
  const hoveredDecision = hoveredDecisionNodeId ? state.nodesById[hoveredDecisionNodeId] : undefined;
  const modalDecision = modalDecisionId ? state.nodesById[modalDecisionId] : undefined;
  const modalDecisionCitations = React.useMemo<ReadonlyArray<CitationNode>>(() => {
    if (!modalDecision || modalDecision.type !== "decision") {
      return [];
    }
    return modalDecision.provenance
      .map((citationId) => state.nodesById[citationId])
      .filter((candidate): candidate is CitationNode => Boolean(candidate) && candidate.type === "citation");
  }, [modalDecision, state.nodesById]);
  const highlightedCitationIds = React.useMemo(() => {
    if (!hoveredDecision || hoveredDecision.type !== "decision") {
      return new Set<string>();
    }
    return new Set(hoveredDecision.provenance);
  }, [hoveredDecision]);
  const activeBranchLineage = React.useMemo(() => {
    const lineage = new Set<BranchId>();
    let cursor: BranchId | undefined = activeBranch.id;
    while (cursor) {
      lineage.add(cursor);
      cursor = state.branchesById[cursor]?.parentBranchId;
    }
    return lineage;
  }, [activeBranch.id, state.branchesById]);

  const getNodeRefKey = React.useCallback((branchId: BranchId, nodeId: string) => {
    return `${branchId}:${nodeId}`;
  }, []);

  const getAnyRenderedNodeElement = React.useCallback((nodeId: string) => {
    const suffix = `:${nodeId}`;
    for (const [key, element] of Object.entries(nodeRefs.current)) {
      if (key.endsWith(suffix) && element) {
        return element;
      }
    }
    return null;
  }, []);

  const setNodeRef = React.useCallback((branchId: BranchId, nodeId: string, element: HTMLDivElement | null) => {
    nodeRefs.current[getNodeRefKey(branchId, nodeId)] = element;
  }, [getNodeRefKey]);

  const setBranchLaneRef = React.useCallback((branchId: BranchId, element: HTMLDivElement | null) => {
    branchLaneRefs.current[branchId] = element;
  }, []);

  const performBranchSwitch = React.useCallback(async (branchId: string) => {
    setIsSwitchingBranch(true);
    await Promise.resolve();
    switchBranch(branchId);
    setIsSwitchingBranch(false);
  }, [switchBranch]);

  const requestBranchSwitch = React.useCallback(
    (branchId: string) => {
      if (branchId === activeBranch.id || isSwitchingBranch) {
        return;
      }
      if (skipSwitchConfirmation) {
        void performBranchSwitch(branchId);
        return;
      }
      setDoNotAskAgainChecked(false);
      setPendingBranchId(branchId);
    },
    [activeBranch.id, isSwitchingBranch, performBranchSwitch, skipSwitchConfirmation]
  );

  const cancelBranchSwitch = React.useCallback(() => {
    if (isSwitchingBranch) {
      return;
    }
    setPendingBranchId(null);
    setDoNotAskAgainChecked(false);
  }, [isSwitchingBranch]);

  const confirmBranchSwitch = React.useCallback(async () => {
    if (!pendingBranchId) {
      return;
    }

    if (doNotAskAgainChecked) {
      setSkipSwitchConfirmation(true);
    }
    await performBranchSwitch(pendingBranchId);
    setPendingBranchId(null);
    setDoNotAskAgainChecked(false);
  }, [doNotAskAgainChecked, pendingBranchId, performBranchSwitch]);

  const openDecisionModal = React.useCallback(
    (branchId: BranchId, nodeId: string, stage: DecisionModalStage) => {
      setModalSourceBranchId(branchId);
      setModalDecisionId(nodeId);
      setModalStage(stage);
    },
    []
  );

  const closeDecisionModal = React.useCallback(() => {
    if (isForkingNodeId) {
      return;
    }
    setModalDecisionId(null);
    setModalSourceBranchId(null);
    setModalStage("details");
  }, [isForkingNodeId]);

  const handleConfirmFork = React.useCallback(
    async (steering: ForkSteering) => {
      if (!modalDecisionId || !modalSourceBranchId) {
        return;
      }
      const targetNodeId = modalDecisionId;
      const targetBranchId = modalSourceBranchId;
      setIsForkingNodeId(targetNodeId);
      await Promise.resolve();
      const hasSteering =
        Boolean(steering.prompt && steering.prompt.length > 0) ||
        Boolean(steering.selectedAlternativeId);
      forkAtNode({
        fromBranchId: targetBranchId,
        nodeId: targetNodeId,
        name: `Fork from ${targetNodeId}`,
        steering: hasSteering ? steering : undefined
      });
      setIsForkingNodeId(null);
      setModalDecisionId(null);
      setModalSourceBranchId(null);
      setModalStage("details");
    },
    [forkAtNode, modalDecisionId, modalSourceBranchId]
  );

  const renderNode = React.useCallback(
    (
      node: ThoughtNode,
      tone: "active" | "inactive",
      opts: {
        branchId: BranchId;
        isBranchActive: boolean;
      }
    ) => {
      const isInactive = tone === "inactive";
      const isHighlightedCitation =
        node.type === "citation" && highlightedCitationIds.has(node.id);

      if (node.type === "citation") {
        return (
          <div
            className={[
              "px-2 py-1 text-xs font-medium tracking-[0.08em] transition-colors",
              isHighlightedCitation
                ? "text-[#e0bc78]"
                : isInactive
                  ? "text-white/28"
                  : "text-white/46"
            ]
              .filter(Boolean)
              .join(" ")}
          >
            citation
          </div>
        );
      }

      if (node.type === "decision") {
        const confidence = Math.max(0, Math.min(1, node.confidence));
        const confidencePct = Math.round(confidence * 100);
        const decisionTone = getDecisionConfidenceTone(confidence);
        const canFork = opts.isBranchActive && !isInactive;
        const isForkingThisNode = isForkingNodeId === node.id;
        const decisionCitations = node.provenance
          .map((citationId) => state.nodesById[citationId])
          .filter(
            (candidate): candidate is Extract<ThoughtNode, { type: "citation" }> =>
              Boolean(candidate) && candidate.type === "citation"
          );
        const isExpanded = Boolean(expandedCitationNodes[node.id]);
        const hasOverflow = decisionCitations.length > 3;
        const visibleCitations = hasOverflow && !isExpanded ? decisionCitations.slice(0, 2) : decisionCitations;
        const hiddenCount = hasOverflow ? decisionCitations.length - 2 : 0;
        const isHoveredDecision = hoveredDecisionNodeId === node.id;

        return (
          <div
            className="group relative"
            onMouseEnter={() => setHoveredDecisionNodeId(node.id)}
            onMouseLeave={() => setHoveredDecisionNodeId((current) => (current === node.id ? null : current))}
          >
            <div className="group/decision relative inline-flex">
              {canFork ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDecisionModal(opts.branchId, node.id, "details");
                  }}
                  aria-label={`Open decision details for ${node.claim} (${confidencePct}% confidence)`}
                  aria-haspopup="dialog"
                  className={[
                    "inline-flex max-w-[160px] items-center truncate whitespace-nowrap rounded-full border px-5 py-2 text-sm font-semibold shadow-gb-node",
                    "transition-colors focus:outline-none focus:ring-2 focus:ring-[#e0bc78]/45",
                    "cursor-pointer hover:brightness-110 active:scale-[0.98]",
                    isHoveredDecision ? "ring-2 ring-[#e0bc78]/40" : "",
                    decisionTone.activeClasses
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {node.claim}
                </button>
              ) : (
                <div
                  aria-label={`${node.id} decision with ${confidencePct}% confidence`}
                  className={[
                    "inline-flex max-w-[160px] items-center truncate whitespace-nowrap rounded-full border px-5 py-2 text-sm font-semibold shadow-gb-node",
                    "transition-colors",
                    isHoveredDecision ? "ring-2 ring-[#e0bc78]/40" : "",
                    isInactive ? decisionTone.inactiveClasses : decisionTone.activeClasses
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {node.claim}
                </div>
              )}

              <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md border border-white/15 bg-[#0e1420] px-2 py-1 text-xs font-medium text-white/85 opacity-0 shadow-gb-node transition group-hover/decision:opacity-100">
                {confidencePct}% confidence
              </div>
            </div>

            <div className="mt-1.5 flex flex-col items-center gap-0.5">
              {visibleCitations.map((citation) => (
                <a
                  key={citation.id}
                  href={citation.source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className={[
                    "inline-flex max-w-[140px] items-center truncate text-[11px] font-medium underline-offset-2",
                    highlightedCitationIds.size > 0
                      ? highlightedCitationIds.has(citation.id)
                        ? "text-[#e0bc78] underline"
                        : "text-white/32"
                      : isInactive
                        ? "text-white/40"
                        : "text-white/72 hover:text-white hover:underline"
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={citation.source.title ?? citation.source.uri}
                >
                  {citation.source.domain ?? citation.source.title ?? "source"}
                </a>
              ))}

              {hasOverflow && !isExpanded ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setExpandedCitationNodes((prev) => ({ ...prev, [node.id]: true }));
                  }}
                  className={[
                    "inline-flex items-center text-[11px] font-semibold underline-offset-2",
                    isInactive
                      ? "text-white/40"
                      : "text-white/75 hover:text-white hover:underline"
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  +{hiddenCount}
                </button>
              ) : null}
            </div>

            {canFork ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openDecisionModal(opts.branchId, node.id, "steer");
                }}
                disabled={isForkingThisNode}
                aria-label={`Fork conversation from ${node.claim}`}
                aria-haspopup="dialog"
                className="absolute -right-3 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#161d2b] text-white/80 opacity-0 transition group-hover:opacity-100 hover:border-white/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="6" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="18" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M8.4 7.2v3.5c0 2.1 1.7 3.8 3.8 3.8h3.2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        );
      }

      if (node.type === "execution") {
        return <ExecutionNodeUI node={node} isActive={opts.isBranchActive} />;
      }

      if (node.type === "conflict") {
        return <ConflictNodeUI node={node} isActive={opts.isBranchActive} />;
      }

      return (
        <div
          className={[
            "rounded-full border px-5 py-2 text-sm font-medium shadow-gb-node",
            isInactive
              ? "border-white/30 bg-white/5 text-white/45"
              : "border-white/90 bg-[#141a28] text-white/95"
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {(node as ThoughtNode).type}
        </div>
      );
    },
    [
      expandedCitationNodes,
      highlightedCitationIds,
      hoveredDecisionNodeId,
      isForkingNodeId,
      openDecisionModal,
      state.nodesById
    ]
  );

  const recomputeForkConnectors = React.useCallback(() => {
    const railTracksElement = railTracksRef.current;
    if (!railTracksElement) {
      return;
    }

    const containerRect = railTracksElement.getBoundingClientRect();
    const nextConnectors: ForkConnector[] = [];
    const nextBranchStartOffsets: Record<string, number> = {};

    for (const branch of branches) {
      if (!branch.parentBranchId || !branch.forkedFromNodeId) {
        continue;
      }

      const branchTimeline = getBranchTimeline(branch.id);
      const forkIndex = branchTimeline.findIndex((node) => node.id === branch.forkedFromNodeId);
      const divergentNodes = forkIndex >= 0 ? branchTimeline.slice(forkIndex + 1) : branchTimeline;
      const targetNode = divergentNodes[0] ?? branchTimeline[Math.max(0, forkIndex)];
      if (!targetNode) {
        continue;
      }

      const sourceElement =
        nodeRefs.current[getNodeRefKey(branch.parentBranchId, branch.forkedFromNodeId)] ??
        getAnyRenderedNodeElement(branch.forkedFromNodeId);
      const targetElement = nodeRefs.current[getNodeRefKey(branch.id, targetNode.id)];
      if (!sourceElement || !targetElement) {
        continue;
      }

      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      // Start near the lower-right tangent of the fork node.
      const x1 = sourceRect.right - containerRect.left - 2;
      const y1 = sourceRect.top + sourceRect.height * 0.72 - containerRect.top;
      const x2 = targetRect.left - containerRect.left;
      const y2 = targetRect.top + targetRect.height * 0.35 - containerRect.top;

      const curveTravel = Math.max(34, (x2 - x1) * 0.38);
      const c1x = x1 + curveTravel;
      const c1y = y1 + 6;
      const c2x = x2 - 28;
      const c2y = y2 - 6;
      const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

      nextConnectors.push({
        id: `${branch.parentBranchId}->${branch.id}`,
        d,
        isActive: activeBranchLineage.has(branch.id)
      });

      const laneElement = branchLaneRefs.current[branch.id];
      if (laneElement) {
        const laneRect = laneElement.getBoundingClientRect();
        const sourceCenterY = sourceRect.top + sourceRect.height * 0.5;
        const offset = Math.max(0, Math.min(280, sourceCenterY - laneRect.top + 16));
        nextBranchStartOffsets[branch.id] = offset;
      }
    }

    const nextViewport = {
      width: Math.max(1, railTracksElement.clientWidth),
      height: Math.max(1, railTracksElement.scrollHeight)
    };

    setForkConnectorViewport((prev) =>
      prev.width === nextViewport.width && prev.height === nextViewport.height ? prev : nextViewport
    );
    setForkConnectors((prev) => (areConnectorsEqual(prev, nextConnectors) ? prev : nextConnectors));
    setBranchStartOffsets((prev) =>
      areOffsetsEqual(prev, nextBranchStartOffsets) ? prev : nextBranchStartOffsets
    );
  }, [activeBranchLineage, branches, getAnyRenderedNodeElement, getBranchTimeline, getNodeRefKey]);

  React.useLayoutEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      recomputeForkConnectors();
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [recomputeForkConnectors, state.activeBranchId, state.revision]);

  React.useLayoutEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      recomputeForkConnectors();
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [branchStartOffsets, recomputeForkConnectors]);

  React.useEffect(() => {
    const onResize = () => recomputeForkConnectors();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recomputeForkConnectors]);

  return (
    <motion.aside
      layout
      {...rest}
      className={[
        "relative sticky top-0 min-h-[100dvh] w-full max-w-5xl overflow-y-auto",
        "bg-[#0f1117] border border-white/10 shadow-gb-rail",
        "rounded-[1.5rem]",
        "p-5 md:p-6",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-5 border-b border-white/10 pb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
          Spatial Rail
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-emerald-300/55 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
            Active
          </span>
          <p className="text-sm font-medium text-white/90">{activeBranch.name ?? activeBranch.id}</p>
        </div>
      </div>

      <div className="mb-5 border-b border-white/10 pb-4">
        <p className="text-sm leading-relaxed text-white/60">
          Hover a decision badge to view confidence and reveal the fork control. Inactive branches are
          dimmed and stay in fixed lanes; click an inactive lane to switch context.
        </p>
        {skipSwitchConfirmation ? (
          <button
            type="button"
            onClick={() => setSkipSwitchConfirmation(false)}
            className="mt-2 inline-flex items-center rounded-full border border-white/20 px-2.5 py-1 text-left text-[11px] font-medium text-white/75 transition hover:border-white/40 hover:text-white active:scale-[0.98]"
          >
            Confirmation prompts are off. Click to re-enable.
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto pb-2">
        <div ref={railTracksRef} className="relative">
          <svg
            className="pointer-events-none absolute inset-0 z-0"
            width={forkConnectorViewport.width}
            height={forkConnectorViewport.height}
            viewBox={`0 0 ${forkConnectorViewport.width} ${forkConnectorViewport.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id="fork-active-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {forkConnectors.map((connector) =>
              connector.isActive ? (
                <g key={connector.id}>
                  <path
                    d={connector.d}
                    fill="none"
                    stroke="rgba(217, 178, 102, 0.45)"
                    strokeWidth={5}
                    strokeLinecap="round"
                    filter="url(#fork-active-glow)"
                  />
                  <path
                    d={connector.d}
                    fill="none"
                    stroke="rgba(224, 188, 120, 0.92)"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </g>
              ) : (
                <path
                  key={connector.id}
                  d={connector.d}
                  fill="none"
                  stroke="rgba(148, 154, 166, 0.58)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )
            )}
          </svg>

          <div className="relative z-10 flex items-start gap-4 md:gap-5">
          {branches.map((branch) => {
            const isActive = branch.id === activeBranch.id;
            const branchTimeline = getBranchTimeline(branch.id);
            const forkIndex = branch.forkedFromNodeId
              ? branchTimeline.findIndex((node) => node.id === branch.forkedFromNodeId)
              : -1;
            const visibleNodes = forkIndex < 0 ? branchTimeline : branchTimeline.slice(forkIndex + 1);

            const canSwitchToBranch = !isActive;

            return (
              <div
                key={branch.id}
                onClick={() => {
                  if (canSwitchToBranch) {
                    requestBranchSwitch(branch.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (!canSwitchToBranch) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    requestBranchSwitch(branch.id);
                  }
                }}
                role={canSwitchToBranch ? "button" : undefined}
                tabIndex={canSwitchToBranch ? 0 : undefined}
                className="w-[188px] text-left"
                aria-label={canSwitchToBranch ? `Switch to branch ${branch.id}` : undefined}
              >
                <div
                  ref={(element) => setBranchLaneRef(branch.id, element)}
                  className={[
                    "p-2 transition",
                    isActive
                      ? ""
                      : "opacity-65 hover:opacity-90",
                    isSwitchingBranch ? "cursor-not-allowed opacity-60" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <p
                    className={[
                      "text-[11px] uppercase tracking-[0.16em]",
                      isActive ? "text-white/82" : "text-white/42"
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {branch.name ?? branch.id}
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">{isActive ? "active lane" : "inactive lane"}</p>

                  <div className="mt-2 space-y-0">
                    <AnimatePresence mode="popLayout">
                      {visibleNodes.length > 0 ? (
                        <div style={{ paddingTop: `${branchStartOffsets[branch.id] ?? 0}px` }}>
                          {visibleNodes.map((node, index) => (
                            <motion.div
                              layout
                              key={node.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="flex flex-col items-center"
                            >
                              <div ref={(element) => setNodeRef(branch.id, node.id, element)} className="inline-flex">
                                {renderNode(node, isActive ? "active" : "inactive", {
                                  branchId: branch.id,
                                  isBranchActive: isActive
                                })}
                              </div>
                              {index < visibleNodes.length - 1 ? (
                                <div
                                  className={isActive ? "h-8 w-px bg-[#d9b266]/80" : "h-8 w-px bg-white/25"}
                                  aria-hidden="true"
                                />
                              ) : null}
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="flex flex-col items-center"
                          style={{ paddingTop: `${branchStartOffsets[branch.id] ?? 0}px` }}
                        >
                          {branch.forkedFromNodeId ? (
                            <div
                              ref={(element) => setNodeRef(branch.id, branch.forkedFromNodeId!, element)}
                              className="inline-flex max-w-[168px] items-center gap-2 rounded-full border border-white/20 bg-white/[0.02] px-3 py-1 text-[11px] font-medium text-white/55"
                            >
                              <span className="shrink-0 uppercase tracking-[0.16em] text-white/40">fork</span>
                              <span className="min-w-0 truncate">
                                {(() => {
                                  const forkNode = state.nodesById[branch.forkedFromNodeId!];
                                  if (!forkNode) {
                                    return "origin";
                                  }
                                  if (forkNode.type === "decision") {
                                    return forkNode.claim;
                                  }
                                  if (forkNode.type === "citation") {
                                    return forkNode.source.domain ?? forkNode.source.title ?? "citation";
                                  }
                                  return forkNode.type;
                                })()}
                              </span>
                            </div>
                          ) : null}
                          <div className="px-2 py-1 text-xs text-white/30">No divergent nodes yet</div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pendingBranch && (
          <motion.div
            key="branch-switch-dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-[1rem] border border-white/15 bg-[#121722] p-4 shadow-gb-rail"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm branch switch"
            >
              <h2 className="text-sm font-semibold tracking-tight text-white">Switch branch?</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Switch from <span className="text-white">{activeBranch.id}</span> to{" "}
                <span className="text-white">{pendingBranch.id}</span>. This may briefly pause while
                the active context updates.
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={doNotAskAgainChecked}
                  onChange={(event) => setDoNotAskAgainChecked(event.currentTarget.checked)}
                  className="h-4 w-4 rounded border-gb-rail-border bg-transparent"
                />
                Don't ask again for this session
              </label>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={cancelBranchSwitch}
                  disabled={isSwitchingBranch}
                  className="rounded-[0.75rem] border border-white/20 px-3 py-2 text-sm text-white/85 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBranchSwitch}
                  disabled={isSwitchingBranch}
                  className="rounded-[0.75rem] border border-emerald-300/50 bg-emerald-500 px-3 py-2 text-sm font-semibold text-[#08110a] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
                >
                  {isSwitchingBranch ? "Switching..." : "Confirm switch"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {modalDecision && modalDecision.type === "decision" ? (
        <DecisionModal
          open={Boolean(modalDecisionId)}
          decision={modalDecision}
          citations={modalDecisionCitations}
          initialStage={modalStage}
          isForking={isForkingNodeId === modalDecisionId}
          onClose={closeDecisionModal}
          onConfirmFork={handleConfirmFork}
        />
      ) : null}
    </motion.aside>
  );
}

