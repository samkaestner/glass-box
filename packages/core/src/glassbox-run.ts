import type {
  AddNodeInput,
  ForkAtNodeInput,
  ResolveConflictInput,
  ThoughtTreeIdFactory,
  ThoughtTreeState,
  UpdateExecutionGateInput,
  UseThoughtTreeAPI
} from "./thought-tree.js";
import type { BranchId, IsoDateTime, NodeId } from "./nodes.js";
import {
  createDeterministicIdFactory,
  createEmptyThoughtTreeState,
  createThoughtTreeStateManager,
  validateThoughtTreeState
} from "./state-manager.js";
import {
  createGlassBoxEvent,
  eventToAddNodeInput,
  eventToConflictResolutionInput,
  eventToForkInput,
  eventToResolveConflictInput,
  GLASSBOX_EVENT_SCHEMA_VERSION,
  type ActionRequestedPayload,
  type ActionResolvedPayload,
  type BranchForkedPayload,
  type BranchSwitchedPayload,
  type ConflictDetectedPayload,
  type ConflictResolvedPayload,
  type DecisionMadePayload,
  type GlassBoxEvent,
  type GlassBoxEventInput,
  type GlassBoxRunStatus,
  type JsonObject,
  type RunCompletedPayload,
  type RunFailedPayload,
  type RunStartedPayload,
  type SourceAddedPayload
} from "./events.js";

export type GlassBoxRunIdFactory = Readonly<{
  nextRunId: () => string;
  nextEventId: () => string;
}>;

export type GlassBoxRunOptions = Readonly<{
  idFactory?: ThoughtTreeIdFactory;
  runIdFactory?: GlassBoxRunIdFactory;
  now?: () => IsoDateTime;
}>;

export type CreateGlassBoxRunInput = Readonly<{
  runId?: string;
  title?: string;
  userId?: string;
  rootBranchId?: BranchId;
  metadata?: JsonObject;
  events?: ReadonlyArray<GlassBoxEvent>;
  state?: ThoughtTreeState;
  skipStartEvent?: boolean;
}>;

export type GlassBoxSerializedRun = Readonly<{
  schemaVersion: typeof GLASSBOX_EVENT_SCHEMA_VERSION;
  runId: string;
  status: GlassBoxRunStatus;
  state: ThoughtTreeState;
  events: ReadonlyArray<GlassBoxEvent>;
}>;

export type MaybePromise<T> = T | Promise<T>;

export type GlassBoxPersistenceAdapter = Readonly<{
  load: (runId?: string) => MaybePromise<GlassBoxSerializedRun | null>;
  save: (run: GlassBoxSerializedRun) => MaybePromise<void>;
  clear?: (runId?: string) => MaybePromise<void>;
}>;

export type GlassBoxMutationResult = Readonly<{
  event: GlassBoxEvent;
  state: ThoughtTreeState;
  nodeId?: NodeId;
  branchId?: BranchId;
}>;

export type GlassBoxRunAPI = UseThoughtTreeAPI &
  Readonly<{
    readonly runId: string;
    readonly events: ReadonlyArray<GlassBoxEvent>;
    readonly status: GlassBoxRunStatus;
    ingestEvent: (event: GlassBoxEvent) => GlassBoxMutationResult;
    recordSource: (input: SourceAddedPayload & Readonly<{ branchId?: BranchId }>) => GlassBoxMutationResult;
    recordDecision: (input: DecisionMadePayload & Readonly<{ branchId?: BranchId }>) => GlassBoxMutationResult;
    recordConflict: (input: ConflictDetectedPayload & Readonly<{ branchId?: BranchId }>) => GlassBoxMutationResult;
    resolveRecordedConflict: (
      input: ConflictResolvedPayload & Readonly<{ branchId?: BranchId }>
    ) => GlassBoxMutationResult;
    requestActionApproval: (
      input: ActionRequestedPayload & Readonly<{ branchId?: BranchId }>
    ) => GlassBoxMutationResult;
    resolveActionApproval: (
      input: ActionResolvedPayload & Readonly<{ branchId?: BranchId }>
    ) => GlassBoxMutationResult;
    forkFromDecision: (input: BranchForkedPayload) => GlassBoxMutationResult;
    completeRun: (input?: RunCompletedPayload) => GlassBoxMutationResult;
    failRun: (input: RunFailedPayload) => GlassBoxMutationResult;
    serialize: () => GlassBoxSerializedRun;
  }>;

const nowIso = (): IsoDateTime => new Date().toISOString();

export function createGlassBoxRunIdFactory(
  seed: Readonly<{ runCounter?: number; eventCounter?: number }> = {}
): GlassBoxRunIdFactory {
  let runCounter = seed.runCounter ?? 0;
  let eventCounter = seed.eventCounter ?? 0;

  return {
    nextRunId: () => {
      runCounter += 1;
      return `run-${runCounter}`;
    },
    nextEventId: () => {
      eventCounter += 1;
      return `event-${eventCounter}`;
    }
  };
}

function getLastTimelineNodeId(state: ThoughtTreeState, branchId: BranchId): NodeId | undefined {
  const timeline = state.branchesById[branchId]?.timeline;
  return timeline ? timeline[timeline.length - 1] : undefined;
}

function getReplayRootBranchId(events: ReadonlyArray<GlassBoxEvent>): BranchId {
  const started = events.find((event) => event.type === "run.started");
  return started?.payload.rootBranchId ?? "branch-main";
}

function getReplayRunId(events: ReadonlyArray<GlassBoxEvent>): string {
  return events[0]?.runId ?? "run-replay";
}

function getStatusAfterEvent(previous: GlassBoxRunStatus, event: GlassBoxEvent): GlassBoxRunStatus {
  if (event.type === "run.started") {
    return "running";
  }
  if (event.type === "run.completed") {
    return "completed";
  }
  if (event.type === "run.failed") {
    return "failed";
  }
  return previous;
}

function withPayloadNodeId<TEvent extends GlassBoxEvent>(
  event: TEvent,
  nodeId: NodeId | undefined
): TEvent {
  if (!nodeId) {
    return event;
  }
  return {
    ...event,
    payload: {
      ...event.payload,
      nodeId
    }
  } as TEvent;
}

function withPayloadBranchId<TEvent extends GlassBoxEvent>(
  event: TEvent,
  branchId: BranchId | undefined
): TEvent {
  if (!branchId) {
    return event;
  }
  return {
    ...event,
    payload: {
      ...event.payload,
      branchId
    }
  } as TEvent;
}

function eventInputFor(input: GlassBoxEventInput): GlassBoxEventInput {
  return input;
}

export function replayGlassBoxEvents(
  events: ReadonlyArray<GlassBoxEvent>,
  options: GlassBoxRunOptions = {}
): GlassBoxSerializedRun {
  const state = createEmptyThoughtTreeState(
    getReplayRootBranchId(events),
    events[0]?.timestamp ?? (options.now ? options.now() : nowIso())
  );
  let mutationTimestamp = state.updatedAt;
  const manager = createThoughtTreeStateManager(state, {
    idFactory: options.idFactory,
    now: () => mutationTimestamp
  });
  let status: GlassBoxRunStatus = "idle";

  for (const event of events) {
    mutationTimestamp = event.timestamp;
    applyEventToManager(manager, event);
    status = getStatusAfterEvent(status, event);
  }

  return {
    schemaVersion: GLASSBOX_EVENT_SCHEMA_VERSION,
    runId: getReplayRunId(events),
    status,
    state: manager.state,
    events
  };
}

function applyEventToManager(manager: UseThoughtTreeAPI, event: GlassBoxEvent): ThoughtTreeState {
  if (
    event.type === "source.added" ||
    event.type === "decision.made" ||
    event.type === "conflict.detected" ||
    event.type === "action.requested"
  ) {
    return manager.addNode(eventToAddNodeInput(event));
  }

  if (event.type === "conflict.resolved") {
    return manager.resolveConflict(eventToResolveConflictInput(event));
  }

  if (event.type === "action.resolved") {
    return manager.updateExecutionGate(eventToConflictResolutionInput(event));
  }

  if (event.type === "branch.forked") {
    return manager.forkAtNode(eventToForkInput(event));
  }

  if (event.type === "branch.switched") {
    return manager.switchBranch(event.payload.branchId);
  }

  validateThoughtTreeState(manager.state);
  return manager.state;
}

export function createGlassBoxRun(
  input: CreateGlassBoxRunInput = {},
  options: GlassBoxRunOptions = {}
): GlassBoxRunAPI {
  if (!input.skipStartEvent && input.events && input.events.length > 0) {
    const replayed = replayGlassBoxEvents(input.events, options);
    return createGlassBoxRun(
      {
        runId: input.runId ?? replayed.runId,
        state: replayed.state,
        events: replayed.events,
        skipStartEvent: true
      },
      options
    );
  }

  const runIdFactory = options.runIdFactory ?? createGlassBoxRunIdFactory();
  const runId = input.runId ?? runIdFactory.nextRunId();
  const rootBranchId = input.rootBranchId ?? input.state?.rootBranchId ?? "branch-main";
  const initialTimestamp = input.state?.updatedAt ?? (options.now ? options.now() : nowIso());
  let mutationTimestamp = initialTimestamp;
  const manager = createThoughtTreeStateManager(
    input.state ?? createEmptyThoughtTreeState(rootBranchId, initialTimestamp),
    {
      idFactory:
        options.idFactory ??
        createDeterministicIdFactory({
          nodeCounter: Object.keys(input.state?.nodesById ?? {}).length,
          branchCounter: Object.keys(input.state?.branchesById ?? {}).length
        }),
      now: () => mutationTimestamp
    }
  );
  let events: ReadonlyArray<GlassBoxEvent> = input.events ?? [];
  let status: GlassBoxRunStatus = events.reduce(getStatusAfterEvent, "idle" as GlassBoxRunStatus);

  const createEvent = (eventInput: GlassBoxEventInput) =>
    createGlassBoxEvent(eventInput, {
      runId,
      now: options.now,
      nextEventId: runIdFactory.nextEventId
    });

  const appendEvent = (event: GlassBoxEvent, nodeId?: NodeId, branchId?: BranchId): GlassBoxMutationResult => {
    events = [...events, event];
    status = getStatusAfterEvent(status, event);
    return {
      event,
      state: manager.state,
      nodeId,
      branchId
    };
  };

  const ingestEvent = (event: GlassBoxEvent): GlassBoxMutationResult => {
    const beforeActiveBranchId = manager.state.activeBranchId;
    mutationTimestamp = event.timestamp;
    const nextState = applyEventToManager(manager, event);
    const afterActiveBranchId = nextState.activeBranchId;
    const nodeId =
      event.type === "source.added" ||
      event.type === "decision.made" ||
      event.type === "conflict.detected" ||
      event.type === "action.requested"
        ? getLastTimelineNodeId(nextState, event.branchId ?? beforeActiveBranchId)
        : undefined;
    const branchId = event.type === "branch.forked" ? afterActiveBranchId : event.branchId;
    return appendEvent(event, nodeId, branchId);
  };

  const recordAdditiveEvent = (
    eventInput: GlassBoxEventInput,
    branchId: BranchId
  ): GlassBoxMutationResult => {
    const provisionalEvent = createEvent(eventInput);
    mutationTimestamp = provisionalEvent.timestamp;
    const nextState = applyEventToManager(manager, provisionalEvent);
    const nodeId = getLastTimelineNodeId(nextState, branchId);
    const event = withPayloadNodeId(provisionalEvent, nodeId);
    return appendEvent(event, nodeId, branchId);
  };

  const api: GlassBoxRunAPI = {
    get runId() {
      return runId;
    },
    get state() {
      return manager.state;
    },
    get events() {
      return events;
    },
    get status() {
      return status;
    },
    addNode: (nodeInput: AddNodeInput) => {
      const branchId = nodeInput.branchId ?? manager.state.activeBranchId;
      if (nodeInput.type === "citation") {
        return recordAdditiveEvent(
          eventInputFor({
            type: "source.added",
            branchId,
            payload: {
              nodeId: nodeInput.id,
              parentIds: nodeInput.parentIds,
              source: nodeInput.source,
              excerpt: nodeInput.excerpt,
              contentHash: nodeInput.contentHash,
              tags: nodeInput.tags
            }
          }),
          branchId
        ).state;
      }
      if (nodeInput.type === "decision") {
        return recordAdditiveEvent(
          eventInputFor({
            type: "decision.made",
            branchId,
            payload: {
              nodeId: nodeInput.id,
              parentIds: nodeInput.parentIds,
              claim: nodeInput.claim,
              confidence: nodeInput.confidence,
              provenance: nodeInput.provenance,
              rationale: nodeInput.rationale,
              alternatives: nodeInput.alternatives
            }
          }),
          branchId
        ).state;
      }
      if (nodeInput.type === "conflict") {
        return recordAdditiveEvent(
          eventInputFor({
            type: "conflict.detected",
            branchId,
            payload: {
              nodeId: nodeInput.id,
              parentIds: nodeInput.parentIds,
              contenders: nodeInput.contenders,
              description: nodeInput.description
            }
          }),
          branchId
        ).state;
      }
      return recordAdditiveEvent(
        eventInputFor({
          type: "action.requested",
          branchId,
          payload: {
            nodeId: nodeInput.id,
            parentIds: nodeInput.parentIds,
            action: nodeInput.action as ActionRequestedPayload["action"],
            gate: nodeInput.gate
          }
        }),
        branchId
      ).state;
    },
    forkAtNode: (forkInput: ForkAtNodeInput) => {
      const branchId = forkInput.fromBranchId ?? manager.state.activeBranchId;
      const provisionalEvent = createEvent(
        eventInputFor({
          type: "branch.forked",
          branchId,
          payload: {
            nodeId: forkInput.nodeId,
            fromBranchId: forkInput.fromBranchId,
            branchId: forkInput.branchId,
            name: forkInput.name,
            steering: forkInput.steering
          }
        })
      );
      mutationTimestamp = provisionalEvent.timestamp;
      const nextState = applyEventToManager(manager, provisionalEvent);
      const event = withPayloadBranchId(provisionalEvent, nextState.activeBranchId);
      appendEvent(event, undefined, nextState.activeBranchId);
      return manager.state;
    },
    resolveConflict: (resolveInput: ResolveConflictInput) => {
      const branchId = manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({
          type: "conflict.resolved",
          branchId,
          payload: {
            conflictNodeId: resolveInput.conflictNodeId,
            chosenNodeId: resolveInput.chosenNodeId,
            note: resolveInput.note,
            resolvedAt: resolveInput.resolvedAt
          }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      appendEvent(event, undefined, branchId);
      return manager.state;
    },
    updateExecutionGate: (gateInput: UpdateExecutionGateInput) => {
      const branchId = manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({
          type: "action.resolved",
          branchId,
          payload: {
            executionNodeId: gateInput.executionNodeId,
            status: gateInput.status,
            decidedAt: gateInput.decidedAt,
            decidedBy: gateInput.decidedBy,
            reason: gateInput.reason
          }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      appendEvent(event, gateInput.executionNodeId, branchId);
      return manager.state;
    },
    switchBranch: (branchId: BranchId) => {
      const event = createEvent(
        eventInputFor({
          type: "branch.switched",
          branchId,
          payload: { branchId }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      appendEvent(event, undefined, branchId);
      return manager.state;
    },
    getNode: (nodeId: NodeId) => manager.getNode(nodeId),
    getActiveBranch: () => manager.getActiveBranch(),
    getBranchTimeline: (branchId?: BranchId) => manager.getBranchTimeline(branchId),
    ingestEvent,
    recordSource: (sourceInput) => {
      const branchId = sourceInput.branchId ?? manager.state.activeBranchId;
      return recordAdditiveEvent(
        eventInputFor({
          type: "source.added",
          branchId,
          payload: {
            nodeId: sourceInput.nodeId,
            parentIds: sourceInput.parentIds,
            source: sourceInput.source,
            excerpt: sourceInput.excerpt,
            contentHash: sourceInput.contentHash,
            tags: sourceInput.tags
          }
        }),
        branchId
      );
    },
    recordDecision: (decisionInput) => {
      const branchId = decisionInput.branchId ?? manager.state.activeBranchId;
      return recordAdditiveEvent(
        eventInputFor({
          type: "decision.made",
          branchId,
          payload: {
            nodeId: decisionInput.nodeId,
            parentIds: decisionInput.parentIds,
            claim: decisionInput.claim,
            confidence: decisionInput.confidence,
            provenance: decisionInput.provenance,
            rationale: decisionInput.rationale,
            alternatives: decisionInput.alternatives
          }
        }),
        branchId
      );
    },
    recordConflict: (conflictInput) => {
      const branchId = conflictInput.branchId ?? manager.state.activeBranchId;
      return recordAdditiveEvent(
        eventInputFor({
          type: "conflict.detected",
          branchId,
          payload: {
            nodeId: conflictInput.nodeId,
            parentIds: conflictInput.parentIds,
            contenders: conflictInput.contenders,
            description: conflictInput.description
          }
        }),
        branchId
      );
    },
    resolveRecordedConflict: (resolveInput) => {
      const branchId = resolveInput.branchId ?? manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({
          type: "conflict.resolved",
          branchId,
          payload: {
            conflictNodeId: resolveInput.conflictNodeId,
            chosenNodeId: resolveInput.chosenNodeId,
            note: resolveInput.note,
            resolvedAt: resolveInput.resolvedAt
          }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      return appendEvent(event, undefined, branchId);
    },
    requestActionApproval: (actionInput) => {
      const branchId = actionInput.branchId ?? manager.state.activeBranchId;
      return recordAdditiveEvent(
        eventInputFor({
          type: "action.requested",
          branchId,
          payload: {
            nodeId: actionInput.nodeId,
            parentIds: actionInput.parentIds,
            action: actionInput.action,
            gate: actionInput.gate
          }
        }),
        branchId
      );
    },
    resolveActionApproval: (actionInput) => {
      const branchId = actionInput.branchId ?? manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({
          type: "action.resolved",
          branchId,
          payload: {
            executionNodeId: actionInput.executionNodeId,
            status: actionInput.status,
            decidedAt: actionInput.decidedAt,
            decidedBy: actionInput.decidedBy,
            reason: actionInput.reason
          }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      return appendEvent(event, actionInput.executionNodeId, branchId);
    },
    forkFromDecision: (forkInput) => {
      const branchId = forkInput.fromBranchId ?? manager.state.activeBranchId;
      const provisionalEvent = createEvent(
        eventInputFor({
          type: "branch.forked",
          branchId,
          payload: {
            nodeId: forkInput.nodeId,
            fromBranchId: forkInput.fromBranchId,
            branchId: forkInput.branchId,
            name: forkInput.name,
            steering: forkInput.steering
          }
        })
      );
      mutationTimestamp = provisionalEvent.timestamp;
      const nextState = applyEventToManager(manager, provisionalEvent);
      const event = withPayloadBranchId(provisionalEvent, nextState.activeBranchId);
      return appendEvent(event, undefined, nextState.activeBranchId);
    },
    completeRun: (completeInput = {}) => {
      const branchId = manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({ type: "run.completed", branchId, payload: completeInput })
      );
      return appendEvent(event, undefined, branchId);
    },
    failRun: (failInput) => {
      const branchId = manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({ type: "run.failed", branchId, payload: failInput })
      );
      return appendEvent(event, undefined, branchId);
    },
    serialize: () => ({
      schemaVersion: GLASSBOX_EVENT_SCHEMA_VERSION,
      runId,
      status,
      state: manager.state,
      events
    })
  };

  if (!input.skipStartEvent && events.length === 0) {
    const startEvent = createEvent(
      eventInputFor({
        type: "run.started",
        branchId: rootBranchId,
        payload: {
          rootBranchId,
          title: input.title,
          userId: input.userId,
          metadata: input.metadata
        }
      })
    );
    events = [startEvent];
    status = "running";
  }

  return api;
}
