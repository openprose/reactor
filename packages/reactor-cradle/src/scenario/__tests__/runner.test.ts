import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import type { ReceiptV0 } from "@openprose/reactor/receipt";
import type {
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
  ReactorRegistrySnapshotV0,
} from "@openprose/reactor/sdk";

import { VirtualClock } from "../../doubles/clock";
import { InMemoryReactorStorage } from "../../doubles/storage";
import {
  createRecordingModelGatewayV0,
  createReplayModelGatewayV0,
} from "../../replay/model-gateway";
import { parseScenarioV0 } from "../parser";
import { runScenarioV0 } from "../runner";
import type {
  ScenarioRunReceiptV0,
  ScenarioRunnerReactorV0,
  ScenarioWorldAdapterV0,
  ScenarioWorldAdvanceInputV0,
  ScenarioWorldAdvanceResultV0,
  ScenarioWorldEventInputV0,
  ScenarioWorldEventResultV0,
  ScenarioWorldReadResponseV0,
  ScenarioWorldSurpriseV0,
} from "../types";

const FIXTURE_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "src",
  "scenario",
  "__tests__",
  "fixtures",
  "static-flat-spend.scenario",
);

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const POLICY_ARTIFACT_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const RECEIPT_HASH =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const REACTOR_RECEIPT_HASH =
  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;

test("runScenarioV0 drives a parsed static scenario through replay doubles", () => {
  const scenario = parseScenarioV0(readFileSync(FIXTURE_PATH, "utf8"), {
    sourceName: FIXTURE_PATH,
  });
  const receipt = makeReceipt();
  let recordingHandlerCalls = 0;
  const recording = createRecordingModelGatewayV0((request) => {
    recordingHandlerCalls += 1;
    return deterministicModelResponse(request);
  });

  const recorded = runScenarioV0({
    scenario,
    clock: new VirtualClock(scenario.initial_instant),
    world: new StaticScenarioWorld(),
    modelGateway: recording.adapter,
    storage: new InMemoryReactorStorage(makeRegistry(), [receipt]),
  });

  equal(recordingHandlerCalls, 1);
  equal(recording.cassette.exchanges.length, 1);

  const replayWorld = new StaticScenarioWorld();
  const replayed = runScenarioV0({
    scenario,
    clock: new VirtualClock(scenario.initial_instant),
    world: replayWorld,
    modelGateway: createReplayModelGatewayV0(recording.cassette),
    storage: new InMemoryReactorStorage(makeRegistry(), [receipt]),
  });

  equal(replayed.scenario_id, "incident-briefing-flat-spend");
  equal(replayed.world_profile, "static");
  equal(replayed.initial_instant, "2026-05-18T12:00:00.000Z");
  equal(replayed.final_instant, "2026-05-19T12:00:00.000Z");
  deepEqual(
    replayed.trace.map((entry) => entry.as_of),
    [
      "2026-05-18T12:00:00.000Z",
      "2026-05-18T12:15:00.000Z",
      "2026-05-18T12:15:00.000Z",
      "2026-05-18T18:00:00.000Z",
      "2026-05-19T12:00:00.000Z",
      "2026-05-19T12:00:00.000Z",
    ],
  );

  const recordedModel = onlyModelTrace(recorded);
  const replayedModel = onlyModelTrace(replayed);
  deepEqual(replayedModel.model_request, recordedModel.model_request);
  deepEqual(replayedModel.model_response, recordedModel.model_response);
  equal(replayedModel.model_request.kind, "judge");
  equal(replayedModel.model_response.payload.text, "response:review-static-world");
  equal(observationsFromRequest(replayedModel.model_request).length, 2);

  const surprises = collectSurprises(replayed);
  ok(surprises.length > 0, "static world should report surprise observations");
  deepEqual(
    surprises.map((surprise) => surprise.count),
    Array.from({ length: surprises.length }, () => 0),
  );
  deepEqual(replayWorld.eventLog, [
    "advance:2026-05-18T12:00:00.000Z",
    "event:bootstrap:incident-channel:2026-05-18T12:00:00.000Z",
    "read:incident-channel:2026-05-18T12:00:00.000Z",
    "advance:2026-05-18T12:15:00.000Z",
    "advance:2026-05-18T12:15:00.000Z",
    "read:incident-channel:2026-05-18T12:15:00.000Z",
    "advance:2026-05-18T18:00:00.000Z",
    "advance:2026-05-19T12:00:00.000Z",
    "advance:2026-05-19T12:00:00.000Z",
    "read:status-page:2026-05-19T12:00:00.000Z",
  ]);

  deepEqual(replayed.receipt_log.entries, [receipt]);
  deepEqual(replayed.receipt_log.content_hashes, [receipt.content_hash]);
  deepEqual(
    replayed.expected_relationships.map(
      (relationship) => relationship.relationship,
    ),
    [
      "static-surprise-zero",
      "hands-free-replay",
      "tokens-flat-after-bootstrap",
      "every-token-has-surprise-cause",
    ],
  );
});

test("runScenarioV0 rejects out-of-order absolute script times", () => {
  const scenario = parseScenarioV0(
    [
      "scenario: backward-time",
      "world: static",
      "initial: 2026-05-18T12:00:00Z",
      "cassette: ./cassettes/backward.replay.json",
      "sources:",
      "  - id=source-a",
      "script:",
      "  - at=15m tick",
      "  - at=0m tick",
    ].join("\n"),
  );

  const recording = createRecordingModelGatewayV0(deterministicModelResponse);

  ok(
    throwsError(() =>
      runScenarioV0({
        scenario,
        clock: new VirtualClock(scenario.initial_instant),
        world: new StaticScenarioWorld(),
        modelGateway: recording.adapter,
      }),
    ),
  );
});

test("runScenarioV0 normalizes scripted ingests for a supplied reactor and reads reactor receipts", () => {
  const scenario = parseScenarioV0(readFileSync(FIXTURE_PATH, "utf8"), {
    sourceName: FIXTURE_PATH,
  });
  const storageReceipt = makeReceipt();
  const reactorReceipt = makeReceipt(REACTOR_RECEIPT_HASH);
  const reactorEvents: unknown[] = [];
  const reactor: ScenarioRunnerReactorV0 = {
    ingest(event) {
      reactorEvents.push(event);
      return {
        accepted: true,
        responsibility_id: "responsibility.incident-briefing",
        as_of: readStringField(event, "as_of"),
        receipt_hash: reactorReceipt.content_hash,
        outcome: "fresh-judge-receipt",
      };
    },
    receipts: () => [reactorReceipt],
  };

  const run = runScenarioV0({
    scenario,
    clock: new VirtualClock(scenario.initial_instant),
    world: new StaticScenarioWorld(),
    modelGateway: createRecordingModelGatewayV0(deterministicModelResponse)
      .adapter,
    storage: new InMemoryReactorStorage(makeRegistry(), [storageReceipt]),
    reactor,
  });

  equal(reactorEvents.length, 1);
  const turn = asRecord(reactorEvents[0], "reactor turn");
  equal(turn["kind"], "real-input");
  equal(turn["event"], "bootstrap");
  equal(turn["source_id"], "incident-channel");
  equal(turn["scenario_id"], scenario.id);

  const evidence = readEvidence(turn);
  equal(evidence.length, 1);
  equal(evidence[0]?.["source_id"], "incident-channel");
  asRecord(evidence[0]?.["payload"], "evidence payload");

  deepEqual(run.receipt_log.entries, [reactorReceipt]);
  deepEqual(run.receipt_log.content_hashes, [reactorReceipt.content_hash]);
});

test("runScenarioV0 can bridge explicit forecast ticks to supplied reactor turns", () => {
  const scenario = parseScenarioV0(
    [
      "scenario: forecast-tick-bridge",
      "world: static",
      "initial: 2026-05-18T12:00:00Z",
      "cassette: ./cassettes/forecast-tick.replay.json",
      "sources:",
      "  - id=incident-channel",
      "script:",
      "  - at=0m ingest=bootstrap source=incident-channel",
      "  - at=15m tick recheck_kind=evidence-age",
    ].join("\n"),
  );
  const reactorEvents: unknown[] = [];
  const reactor: ScenarioRunnerReactorV0 = {
    ingest(event) {
      reactorEvents.push(event);
      const turn = asRecord(event, "reactor turn");
      return {
        accepted: true,
        responsibility_id: "responsibility.incident-briefing",
        as_of: readStringField(turn, "as_of"),
        outcome:
          turn["kind"] === "forecast-recheck"
            ? "forecast-recheck-receipt"
            : "fresh-judge-receipt",
      };
    },
    receipts: () => [],
  };

  runScenarioV0({
    scenario,
    clock: new VirtualClock(scenario.initial_instant),
    world: new StaticScenarioWorld(),
    modelGateway: createRecordingModelGatewayV0(deterministicModelResponse)
      .adapter,
    reactor,
  });

  equal(reactorEvents.length, 2);
  const forecastTurn = asRecord(reactorEvents[1], "forecast turn");
  equal(forecastTurn["kind"], "forecast-recheck");
  equal(forecastTurn["recheck_kind"], "evidence-age");
  equal(forecastTurn["scenario_id"], scenario.id);

  const evidence = readEvidence(forecastTurn);
  equal(evidence.length, 1);
  equal(evidence[0]?.["source_id"], "incident-channel");
});

class StaticScenarioWorld implements ScenarioWorldAdapterV0 {
  readonly eventLog: string[] = [];

  read(request: {
    readonly source_id: string;
    readonly as_of: string;
  }): ScenarioWorldReadResponseV0 {
    this.eventLog.push(`read:${request.source_id}:${request.as_of}`);

    return {
      payload: {
        source_id: request.source_id,
        as_of: request.as_of,
        state: "unchanged",
      },
      surprise: staticSurprise(),
    };
  }

  applyEvent(input: ScenarioWorldEventInputV0): ScenarioWorldEventResultV0 {
    this.eventLog.push(
      `event:${input.event}:${input.source_id ?? "none"}:${input.as_of}`,
    );

    return {
      payload: {
        event: input.event,
        source_id: input.source_id ?? null,
      },
      surprise: staticSurprise(),
    };
  }

  advanceTo(input: ScenarioWorldAdvanceInputV0): ScenarioWorldAdvanceResultV0 {
    this.eventLog.push(`advance:${input.as_of}`);

    return {
      payload: {
        as_of: input.as_of,
      },
      surprise: staticSurprise(),
    };
  }
}

function deterministicModelResponse(
  request: ReactorModelGatewayRequestV0,
): ReactorModelGatewayResponseV0 {
  const prompt = promptFromRequest(request);

  return {
    payload: {
      text: `response:${prompt}`,
      request_kind: request.kind,
      tokens: {
        fresh: 0,
        reused: 37,
      },
    },
  };
}

function staticSurprise(): ScenarioWorldSurpriseV0 {
  return {
    profile: "static",
    count: 0,
    causes: [],
  };
}

function onlyModelTrace(
  run: ScenarioRunReceiptV0,
): ScenarioRunReceiptV0["trace"][number] & {
  readonly model_request: ReactorModelGatewayRequestV0;
  readonly model_response: ReactorModelGatewayResponseV0 & {
    readonly payload: {
      readonly text: string;
    };
  };
} {
  const modelTraces = run.trace.filter(
    (entry) => entry.model_request !== undefined,
  );
  equal(modelTraces.length, 1);

  const trace = modelTraces[0];
  if (trace?.model_request === undefined || trace.model_response === undefined) {
    throw new Error("expected model trace");
  }

  return trace as ReturnType<typeof onlyModelTrace>;
}

function observationsFromRequest(
  request: ReactorModelGatewayRequestV0,
): readonly unknown[] {
  const payload = asRecord(request.payload, "model payload");
  const observations = payload["observations"];
  if (!Array.isArray(observations)) {
    throw new Error("model payload observations must be an array");
  }

  return observations;
}

function collectSurprises(
  run: ScenarioRunReceiptV0,
): readonly ScenarioWorldSurpriseV0[] {
  const surprises: ScenarioWorldSurpriseV0[] = [];

  for (const entry of run.trace) {
    if (entry.world_advance?.surprise !== undefined) {
      surprises.push(entry.world_advance.surprise);
    }
    if (entry.world_event?.surprise !== undefined) {
      surprises.push(entry.world_event.surprise);
    }
    for (const read of entry.world_reads) {
      if (read.surprise !== undefined) {
        surprises.push(read.surprise);
      }
    }
  }

  return surprises;
}

function promptFromRequest(request: ReactorModelGatewayRequestV0): string {
  const payload = asRecord(request.payload, "model payload");
  const prompt = payload["prompt"];
  if (typeof prompt !== "string") {
    throw new Error("model payload prompt must be a string");
  }

  return prompt;
}

function makeRegistry(): ReactorRegistrySnapshotV0 {
  return {
    contract_revision: CONTRACT_HASH,
    policy_artifact_id: "policy.incident-briefing",
    policy_artifact_identity: "policy.incident-briefing",
    policy_artifact_namespace: "policy.static",
    policy_artifact_revision: "revision-1",
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_content_hash: POLICY_ARTIFACT_HASH,
  };
}

function makeReceipt(
  contentHash: ReceiptV0["content_hash"] = RECEIPT_HASH,
): ReceiptV0 {
  return {
    schema: "openprose.receipt",
    v: 0,
    hash_algorithm: "sha256",
    content_hash: contentHash,
    core: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: CONTRACT_HASH,
      event_cause: "forecast-recheck",
      recheck_kind: "plan-age",
      memo_key: "memo-static-world",
      evidence_input_ids: [EVIDENCE_HASH],
      as_of: "2026-05-18T12:00:00Z",
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "cradle scenario runner fixture",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 1,
        derivation_method: "cradle-static-fixture",
        calibration_grade: "none",
        label_source: "fixture",
      },
    },
    freshness: {
      as_of: "2026-05-18T12:00:00Z",
      next_forecast_recheck: "2026-05-19T12:00:00Z",
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "fixture",
      model: "deterministic",
      role: "judge",
      tags: ["cradle-scenario"],
      responsibility_id: "responsibility.incident-briefing",
      run_id: "scenario-runner-test",
      as_of: "2026-05-18T12:00:00Z",
      tokens: {
        fresh: 0,
        reused: 37,
      },
      surprise_cause: "forecast-recheck",
    },
  } satisfies ReceiptV0;
}

function readStringField(value: unknown, key: string): string {
  const record = asRecord(value, "record");
  const field = record[key];
  if (typeof field !== "string") {
    throw new Error(`${key} must be a string`);
  }

  return field;
}

function readEvidence(
  turn: Readonly<Record<string, unknown>>,
): readonly Readonly<Record<string, unknown>>[] {
  const evidence = turn["evidence"];
  if (!Array.isArray(evidence)) {
    throw new Error("reactor turn must include evidence");
  }

  return evidence.map((item) => asRecord(item, "evidence item"));
}

function throwsError(fn: () => void): boolean {
  try {
    fn();
  } catch (error) {
    ok(error instanceof Error);
    equal(
      error.message,
      "scenario step cannot move time backward to 0m",
    );
    return true;
  }

  return false;
}

function asRecord(
  value: unknown,
  label: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Readonly<Record<string, unknown>>;
}
