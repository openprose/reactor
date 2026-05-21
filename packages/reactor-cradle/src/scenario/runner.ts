import type {
  ContentHashV0,
  ReceiptRecheckKindV0,
} from "@openprose/reactor/receipt";
import type {
  ReactorIngestResultV0,
  ReactorModelGatewayAdapterV0,
  ReactorModelGatewayRequestV0,
} from "@openprose/reactor/sdk";

import {
  REACTOR_SCENARIO_SCHEMA_V0,
  REACTOR_SCENARIO_VERSION_V0,
  type ReactorScenarioV0,
  type ScenarioClockAdapterV0,
  type ScenarioModelStepV0,
  type ScenarioReceiptLogV0,
  type ScenarioRunReceiptV0,
  type ScenarioRunTraceEntryV0,
  type ScenarioRunnerReactorV0,
  type ScenarioRunnerStorageV0,
  type ScenarioTickStepV0,
  type ScenarioScriptStepV0,
  type ScenarioWorldAdapterV0,
  type ScenarioWorldObservationV0,
  type ScenarioWorldReadResponseV0,
} from "./types";
import {
  canonicalScenarioInstant,
  parseScenarioDurationMs,
  parseScenarioInstantMs,
} from "./time";

export interface RunScenarioInputV0 {
  readonly scenario: ReactorScenarioV0;
  readonly clock: ScenarioClockAdapterV0;
  readonly world: ScenarioWorldAdapterV0;
  readonly modelGateway: ReactorModelGatewayAdapterV0;
  readonly storage?: ScenarioRunnerStorageV0;
  readonly reactor?: ScenarioRunnerReactorV0;
}

interface ScenarioRunStateV0 {
  readonly initialEpochMs: number;
  currentEpochMs: number;
  readonly observations: ScenarioWorldObservationV0[];
  readonly trace: ScenarioRunTraceEntryV0[];
  lastReactorIngest?: ReactorIngestResultV0;
}

interface ScenarioRunnerEvidenceInputV0 {
  readonly source_id: string;
  readonly content_hash?: ContentHashV0;
  readonly payload?: unknown;
}

const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function runScenarioV0(
  input: RunScenarioInputV0,
): ScenarioRunReceiptV0 {
  const initialInstant = canonicalScenarioInstant(
    input.scenario.initial_instant,
    "scenario.initial_instant",
  );
  const initialEpochMs = parseScenarioInstantMs(
    initialInstant,
    "scenario.initial_instant",
  );
  initializeClock(input.clock, initialInstant);

  const state: ScenarioRunStateV0 = {
    initialEpochMs,
    currentEpochMs: initialEpochMs,
    observations: [],
    trace: [],
  };

  for (const [index, step] of input.scenario.script.entries()) {
    applyStepTime(input.clock, state, step);
    state.trace.push(runStep(input, state, step, index));
  }

  const finalInstant = input.clock.now();

  return {
    scenario_id: input.scenario.id,
    schema: REACTOR_SCENARIO_SCHEMA_V0,
    v: REACTOR_SCENARIO_VERSION_V0,
    world_profile: input.scenario.world.profile,
    cassette_path: input.scenario.cassette.path,
    initial_instant: initialInstant,
    final_instant: finalInstant,
    trace: Object.freeze([...state.trace]),
    receipt_log: readReceiptLog(input),
    expected_relationships: input.scenario.expect.relationships,
  };
}

function runStep(
  input: RunScenarioInputV0,
  state: ScenarioRunStateV0,
  step: ScenarioScriptStepV0,
  index: number,
): ScenarioRunTraceEntryV0 {
  const asOf = input.clock.now();
  const worldAdvance = input.world.advanceTo?.({
    scenario_id: input.scenario.id,
    profile: input.scenario.world.profile,
    as_of: asOf,
  });
  const worldReads: ScenarioWorldObservationV0[] = [];

  switch (step.kind) {
    case "tick": {
      const reactorIngests = runForecastRecheckTurns(input, state, step, asOf);

      return {
        index,
        step,
        as_of: asOf,
        ...(worldAdvance === undefined ? {} : { world_advance: worldAdvance }),
        ...reactorTraceFields(reactorIngests),
        world_reads: worldReads,
      };
    }
    case "ingest": {
      const worldEvent = input.world.applyEvent?.({
        scenario_id: input.scenario.id,
        profile: input.scenario.world.profile,
        event: step.event,
        ...(step.source_id === undefined ? {} : { source_id: step.source_id }),
        as_of: asOf,
        fields: step.fields,
      });

      if (step.source_id !== undefined) {
        worldReads.push(readWorld(input.world, step.source_id, asOf));
        state.observations.push(...worldReads);
      }
      const reactorIngest = input.reactor?.ingest(
        createRealInputTurn(input, step, asOf, worldReads),
      );
      if (reactorIngest !== undefined) {
        state.lastReactorIngest = reactorIngest;
      }

      return {
        index,
        step,
        as_of: asOf,
        ...(worldAdvance === undefined ? {} : { world_advance: worldAdvance }),
        ...(worldEvent === undefined ? {} : { world_event: worldEvent }),
        ...(reactorIngest === undefined
          ? {}
          : {
              reactor_ingest: reactorIngest,
              reactor_ingests: Object.freeze([reactorIngest]),
            }),
        world_reads: Object.freeze([...worldReads]),
      };
    }
    case "read":
      worldReads.push(readWorld(input.world, step.source_id, asOf));
      state.observations.push(...worldReads);

      return {
        index,
        step,
        as_of: asOf,
        ...(worldAdvance === undefined ? {} : { world_advance: worldAdvance }),
        world_reads: Object.freeze([...worldReads]),
      };
    case "model": {
      const modelRequest = createModelRequest(input.scenario, step, asOf, state);
      const modelResponse = input.modelGateway.invoke(modelRequest);

      return {
        index,
        step,
        as_of: asOf,
        ...(worldAdvance === undefined ? {} : { world_advance: worldAdvance }),
        world_reads: worldReads,
        model_request: modelRequest,
        model_response: modelResponse,
      };
    }
  }
}

function createRealInputTurn(
  input: RunScenarioInputV0,
  step: Extract<ScenarioScriptStepV0, { readonly kind: "ingest" }>,
  asOf: string,
  worldReads: readonly ScenarioWorldObservationV0[],
): unknown {
  const evidence = worldReads.map((observation) =>
    evidenceFromObservation(observation),
  );

  return {
    kind: "real-input" as const,
    scenario_id: input.scenario.id,
    event: step.event,
    as_of: asOf,
    fields: step.fields,
    ...(step.source_id === undefined ? {} : { source_id: step.source_id }),
    ...(evidence.length === 0 ? {} : { evidence: Object.freeze(evidence) }),
  };
}

function runForecastRecheckTurns(
  input: RunScenarioInputV0,
  state: ScenarioRunStateV0,
  step: ScenarioTickStepV0,
  asOf: string,
): readonly ReactorIngestResultV0[] {
  if (input.reactor === undefined) {
    return [];
  }

  const recheckKinds = forecastRecheckKindsForTick(state, step, asOf);
  if (recheckKinds.length === 0) {
    return [];
  }

  const results = recheckKinds.map((recheckKind) =>
    input.reactor?.ingest(
      createForecastRecheckTurn(input, state, asOf, recheckKind),
    ),
  );
  const presentResults = results.filter(
    (result): result is ReactorIngestResultV0 => result !== undefined,
  );
  const last = presentResults.at(-1);
  if (last !== undefined) {
    state.lastReactorIngest = last;
  }

  return Object.freeze(presentResults);
}

function createForecastRecheckTurn(
  input: RunScenarioInputV0,
  state: ScenarioRunStateV0,
  asOf: string,
  recheckKind: ReceiptRecheckKindV0,
): unknown {
  const evidence = latestEvidenceFromObservations(input, state.observations);

  return {
    kind: "forecast-recheck" as const,
    recheck_kind: recheckKind,
    scenario_id: input.scenario.id,
    as_of: asOf,
    ...(evidence.length === 0 ? {} : { evidence }),
  };
}

function forecastRecheckKindsForTick(
  state: ScenarioRunStateV0,
  step: ScenarioTickStepV0,
  asOf: string,
): readonly ReceiptRecheckKindV0[] {
  const explicit = explicitTickRecheckKind(step);
  if (explicit !== undefined) {
    return [explicit];
  }

  const prior = state.lastReactorIngest;
  if (
    prior === undefined ||
    prior.next_due_at === undefined ||
    prior.due_rechecks === undefined ||
    prior.due_rechecks.length === 0 ||
    !isAtOrAfter(asOf, prior.next_due_at)
  ) {
    return [];
  }

  return uniqueRecheckKinds(prior.due_rechecks);
}

function explicitTickRecheckKind(
  step: ScenarioTickStepV0,
): ReceiptRecheckKindV0 | undefined {
  if (step.recheck_kind !== undefined) {
    return step.recheck_kind;
  }

  return (
    readRecheckKindField(step.fields, "recheck_kind") ??
    readRecheckKindField(step.fields, "forecast_recheck")
  );
}

function readRecheckKindField(
  fields: Readonly<Record<string, unknown>>,
  fieldName: string,
): ReceiptRecheckKindV0 | undefined {
  const value = fields[fieldName];
  if (value === undefined) {
    return undefined;
  }
  if (value === "evidence-age" || value === "plan-age") {
    return value;
  }

  throw new Error(`${fieldName} must be evidence-age or plan-age`);
}

function uniqueRecheckKinds(
  values: readonly ReceiptRecheckKindV0[],
): readonly ReceiptRecheckKindV0[] {
  const result: ReceiptRecheckKindV0[] = [];

  for (const value of values) {
    if (!result.includes(value)) {
      result.push(value);
    }
  }

  return Object.freeze(result);
}

function isAtOrAfter(asOf: string, dueAt: string): boolean {
  const asOfMs = Date.parse(asOf);
  const dueAtMs = Date.parse(dueAt);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(dueAtMs)) {
    return false;
  }

  return asOfMs >= dueAtMs;
}

function reactorTraceFields(
  results: readonly ReactorIngestResultV0[],
): {
  readonly reactor_ingest?: ReactorIngestResultV0;
  readonly reactor_ingests?: readonly ReactorIngestResultV0[];
} {
  const last = results.at(-1);
  if (last === undefined) {
    return {};
  }

  return {
    reactor_ingest: last,
    reactor_ingests: Object.freeze([...results]),
  };
}

function latestEvidenceFromObservations(
  input: RunScenarioInputV0,
  observations: readonly ScenarioWorldObservationV0[],
): readonly ScenarioRunnerEvidenceInputV0[] {
  const latestBySource = new Map<string, ScenarioWorldObservationV0>();
  for (const observation of observations) {
    latestBySource.set(observation.source_id, observation);
  }

  const ordered: ScenarioWorldObservationV0[] = [];
  for (const source of input.scenario.sources) {
    const observation = latestBySource.get(source.id);
    if (observation !== undefined) {
      ordered.push(observation);
      latestBySource.delete(source.id);
    }
  }
  ordered.push(
    ...Array.from(latestBySource.values()).sort((left, right) =>
      left.source_id.localeCompare(right.source_id),
    ),
  );

  return Object.freeze(
    ordered.map((observation) => evidenceFromObservation(observation)),
  );
}

function evidenceFromObservation(
  observation: ScenarioWorldObservationV0,
): ScenarioRunnerEvidenceInputV0 {
  const contentHash = readContentHashFromPayload(observation.payload);
  if (contentHash !== undefined) {
    return {
      source_id: observation.source_id,
      content_hash: contentHash,
    };
  }

  return {
    source_id: observation.source_id,
    payload: observation.payload,
  };
}

function readContentHashFromPayload(payload: unknown): ContentHashV0 | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const payloadHash = payload["payload_hash"] ?? payload["content_hash"];
  return isContentHash(payloadHash) ? payloadHash : undefined;
}

function createModelRequest(
  scenario: ReactorScenarioV0,
  step: ScenarioModelStepV0,
  asOf: string,
  state: ScenarioRunStateV0,
): ReactorModelGatewayRequestV0 {
  return {
    kind: step.request_kind,
    payload: {
      scenario_id: scenario.id,
      world_profile: scenario.world.profile,
      as_of: asOf,
      prompt: step.prompt,
      source_ids: scenario.sources.map((source) => source.id),
      observations: state.observations.map((observation) => ({
        source_id: observation.source_id,
        as_of: observation.as_of,
        payload: observation.payload,
        surprise_count: observation.surprise?.count ?? null,
        surprise_causes: observation.surprise?.causes ?? [],
      })),
      fields: step.fields,
    },
  };
}

function readWorld(
  world: ScenarioWorldAdapterV0,
  sourceId: string,
  asOf: string,
): ScenarioWorldObservationV0 {
  const response = normalizeWorldReadResponse(
    world.read({
      source_id: sourceId,
      as_of: asOf,
    }),
  );

  return {
    source_id: sourceId,
    as_of: asOf,
    payload: response.payload,
    ...(response.surprise === undefined ? {} : { surprise: response.surprise }),
  };
}

function normalizeWorldReadResponse(
  response: ScenarioWorldReadResponseV0,
): ScenarioWorldReadResponseV0 {
  if (!isRecord(response)) {
    throw new Error("world.read must return an object");
  }
  if (!Object.hasOwn(response, "payload")) {
    throw new Error("world.read must return a payload field");
  }

  return response;
}

function applyStepTime(
  clock: ScenarioClockAdapterV0,
  state: ScenarioRunStateV0,
  step: ScenarioScriptStepV0,
): void {
  if ("at" in step.time) {
    const offsetMs = parseScenarioDurationMs(step.time.at, "script at");
    const nextEpochMs = state.initialEpochMs + offsetMs;
    if (nextEpochMs < state.currentEpochMs) {
      throw new Error(`scenario step cannot move time backward to ${step.time.at}`);
    }
    moveClockTo(clock, nextEpochMs);
    state.currentEpochMs = nextEpochMs;
    return;
  }

  const elapsedMs = parseScenarioDurationMs(step.time.after, "script after");
  advanceClock(clock, elapsedMs);
  state.currentEpochMs += elapsedMs;
}

function initializeClock(
  clock: ScenarioClockAdapterV0,
  initialInstant: string,
): void {
  if (clock.set !== undefined) {
    clock.set(initialInstant);
    return;
  }

  const now = canonicalScenarioInstant(clock.now(), "clock.now");
  if (now !== initialInstant) {
    throw new Error(
      `scenario clock must start at ${initialInstant}; received ${now}`,
    );
  }
}

function moveClockTo(clock: ScenarioClockAdapterV0, epochMs: number): void {
  const target = new Date(epochMs).toISOString();

  if (clock.set !== undefined) {
    clock.set(target);
    return;
  }

  const currentEpochMs = parseScenarioInstantMs(clock.now(), "clock.now");
  const catchUpMs = epochMs - currentEpochMs;
  if (catchUpMs < 0) {
    throw new Error("scenario clock cannot move backward without set()");
  }
  advanceClock(clock, catchUpMs);
}

function advanceClock(clock: ScenarioClockAdapterV0, elapsedMs: number): void {
  if (clock.advanceMs === undefined) {
    if (elapsedMs === 0) {
      return;
    }
    throw new Error("scenario clock requires advanceMs() for relative time");
  }

  clock.advanceMs(elapsedMs);
}

function readReceiptLog(input: RunScenarioInputV0): ScenarioReceiptLogV0 {
  const entries =
    input.reactor?.receipts() ?? input.storage?.listReceipts() ?? [];

  return {
    entries: Object.freeze([...entries]),
    content_hashes: Object.freeze(entries.map((receipt) => receipt.content_hash)),
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContentHash(value: unknown): value is ContentHashV0 {
  return typeof value === "string" && CONTENT_HASH_PATTERN.test(value);
}
