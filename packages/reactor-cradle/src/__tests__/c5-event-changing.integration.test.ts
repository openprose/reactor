import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deepEqual, equal, notEqual, ok } from "node:assert/strict";
import { test } from "node:test";

import type { CompiledEvidencePlan } from "@openprose/reactor/evidence-plan";
import type {
  ContentHashV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";
import type {
  ReactorAdaptersV0,
  ReactorCreateInputV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
  ReactorRegistrySnapshotV0,
  ReactorSdkV0,
} from "@openprose/reactor/sdk";

import { createC5EventChangingCostThesisScenarioV0 } from "../baselines/cost-thesis";
import { VirtualClock } from "../doubles/clock";
import { parseScenarioV0 } from "../scenario/parser";
import { runScenarioV0 } from "../scenario/runner";
import { adaptSyntheticWorldForScenarioV0 } from "../scenario/synthetic-world-adapter";
import type { ScenarioRunReceiptV0 } from "../scenario/types";
import {
  type SyntheticWorldReadPayloadV0,
  createSyntheticWorldConnectorV0,
} from "../world";

interface PublicC5RuntimeApiV0 {
  readonly createReactor: (input: ReactorCreateInputV0) => ReactorSdkV0;
  readonly verifyReceiptV0: (receipt: ReceiptV0) => {
    readonly ok: boolean;
    readonly content_hash?: ContentHashV0;
  };
}

const FIXTURE_DIR = join(__dirname, "..", "..", "src", "__tests__", "fixtures");
const SCENARIO_FIXTURE = join(FIXTURE_DIR, "c5-periodic-surprise.scenario");
const INITIAL_AS_OF = "2026-05-18T12:00:00.000Z";
const RESPONSIBILITY_ID = "incident-briefing-periodic-surprise";
const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentHashV0;
const INCIDENT_EVIDENCE_HASH =
  "sha256:1111111111111111111111111111111111111111111111111111111111111111" as ContentHashV0;
const POLICY_ARTIFACT_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as ContentHashV0;
const POLICY_NAMESPACE = "policy.c5.periodic-surprise";
const POLICY_REVISION = "1";
const LOCAL_JUDGE_FRESH_TOKENS = 37;
const c5RuntimeApi = loadC5RuntimeApi();

test("C5 periodic-surprise scenario produces event-changing receipts without network", () => {
  let networkCalls = 0;
  const restoreFetch = interceptFetch(() => {
    networkCalls += 1;
  });

  try {
    withAmbientTimePoisoned(() => {
      const execution = runPeriodicSurpriseScenario(c5RuntimeApi);
      const run = execution.run;
      const receipts = execution.reactor.receipts();

      equal(run.scenario_id, RESPONSIBILITY_ID);
      equal(run.world_profile, "periodic-surprise");
      equal(run.final_instant, "2026-05-18T12:45:00.000Z");
      deepEqual(run.receipt_log.entries, receipts);
      ok(receipts.every((receipt) => hasCanonicalReceiptHash(receipt)));

      deepEqual(
        run.trace.flatMap((entry) =>
          (entry.reactor_ingests ?? []).map((result) => result.outcome),
        ),
        [
          "fresh-judge-receipt",
          "memo-hit-receipt",
          "fresh-judge-receipt",
          "memo-hit-receipt",
        ],
      );
      equal(execution.modelRequests.length, 2);

      const materialChange = materialChangeTrace(run);
      const changePayload = asSyntheticReadPayload(
        materialChange.world_reads[0]?.payload,
      );
      equal(changePayload.material_version, 1);
      deepEqual(changePayload.state, {
        open_incident_count: 1,
        status: "red",
      });
      notEqual(changePayload.payload_hash, INCIDENT_EVIDENCE_HASH);
      const changedEvidenceHash = changePayload.payload_hash;
      ok(changedEvidenceHash !== undefined);
      deepEqual(readDetailedSurprise(materialChange.world_event?.payload), {
        profile: "periodic-surprise",
        as_of: "2026-05-18T12:30:00.000Z",
        event_index: 4,
        surprise_count: 1,
        material_change: true,
        surprise_events: [
          {
            kind: "material-change",
            source_id: "incident-feed",
            as_of: "2026-05-18T12:30:00.000Z",
            event_id: "incident-opened",
            profile: "periodic-surprise",
          },
        ],
      });

      const tokenRows = receipts.map((receipt) => ({
        as_of: receipt.core.as_of,
        outcome: receipt.cost.provider === "memo" ? "memo" : "fresh",
        cause: receipt.cost.surprise_cause,
        recheck_kind: receipt.core.recheck_kind ?? null,
        evidence_input_ids: receipt.core.evidence_input_ids,
        fresh: receipt.cost.tokens.fresh,
        reused: receipt.cost.tokens.reused,
      }));
      deepEqual(tokenRows, [
        {
          as_of: "2026-05-18T12:00:00.000Z",
          outcome: "fresh",
          cause: "real-input",
          recheck_kind: null,
          evidence_input_ids: [INCIDENT_EVIDENCE_HASH],
          fresh: LOCAL_JUDGE_FRESH_TOKENS,
          reused: 0,
        },
        {
          as_of: "2026-05-18T12:15:00.000Z",
          outcome: "memo",
          cause: "forecast-recheck",
          recheck_kind: "evidence-age",
          evidence_input_ids: [INCIDENT_EVIDENCE_HASH],
          fresh: 0,
          reused: LOCAL_JUDGE_FRESH_TOKENS,
        },
        {
          as_of: "2026-05-18T12:30:00.000Z",
          outcome: "fresh",
          cause: "real-input",
          recheck_kind: null,
          evidence_input_ids: [changedEvidenceHash],
          fresh: LOCAL_JUDGE_FRESH_TOKENS,
          reused: 0,
        },
        {
          as_of: "2026-05-18T12:45:00.000Z",
          outcome: "memo",
          cause: "forecast-recheck",
          recheck_kind: "evidence-age",
          evidence_input_ids: [changedEvidenceHash],
          fresh: 0,
          reused: LOCAL_JUDGE_FRESH_TOKENS,
        },
      ]);
      equal(sumTokens(receipts, "fresh"), 74);
      equal(sumTokens(receipts, "reused"), 74);

      const costThesisEvent =
        createC5EventChangingCostThesisScenarioV0({ reactor_run: run });
      const [reactorRow, noMemoRow, naiveLoopRow] = costThesisEvent.rows;
      equal(costThesisEvent.status, "measured");
      equal(costThesisEvent.scenario_id, RESPONSIBILITY_ID);
      equal(costThesisEvent.profile, "periodic-surprise");
      equal(reactorRow?.provenance, "runtime-produced");
      deepEqual(reactorRow?.tokens, { fresh: 74, reused: 74, total: 148 });
      equal(reactorRow?.ratio.label, "74:74");
      equal(reactorRow?.model_invocation_count, 2);
      equal(noMemoRow?.provenance, "simulated");
      deepEqual(noMemoRow?.tokens, { fresh: 148, reused: 0, total: 148 });
      equal(noMemoRow?.ratio.label, "148:0");
      equal(noMemoRow?.model_invocation_count, 4);
      equal(naiveLoopRow?.provenance, "control");
      deepEqual(naiveLoopRow?.tokens, { fresh: 148, reused: 0, total: 148 });
      equal(naiveLoopRow?.ratio.label, "148:0");
      equal(naiveLoopRow?.model_invocation_count, 4);
      equal(networkCalls, 0);
    });
  } finally {
    restoreFetch();
  }
});

function runPeriodicSurpriseScenario(runtime: PublicC5RuntimeApiV0): {
  readonly run: ScenarioRunReceiptV0;
  readonly reactor: ReactorSdkV0;
  readonly modelRequests: readonly ReactorModelGatewayRequestV0[];
} {
  const scenario = parseScenarioV0(readFileSync(SCENARIO_FIXTURE, "utf8"), {
    sourceName: SCENARIO_FIXTURE,
  });
  const everyEvents = scenario.world.every_events;
  equal(everyEvents, 2);
  if (everyEvents === undefined) {
    throw new Error("C5 periodic-surprise scenario must declare every_events");
  }
  const clock = new VirtualClock(INITIAL_AS_OF);
  const modelRequests: ReactorModelGatewayRequestV0[] = [];
  const modelGateway = createC5ModelGateway(modelRequests);
  const world = createSyntheticWorldConnectorV0({
    initial_as_of: INITIAL_AS_OF,
    profile: {
      kind: "periodic-surprise",
      every_events: everyEvents,
    },
    sources: [
      {
        source_id: "incident-feed",
        payload_hash: INCIDENT_EVIDENCE_HASH,
        payload: {
          open_incident_count: 0,
          status: "green",
        },
      },
    ],
  });
  const reactor = runtime.createReactor({
    responsibility_id: RESPONSIBILITY_ID,
    adapters: createC5Adapters({ clock, modelGateway }),
  });
  const run = runScenarioV0({
    scenario,
    clock,
    world: adaptSyntheticWorldForScenarioV0(world),
    modelGateway,
    reactor,
  });

  return { run, reactor, modelRequests };
}

function createC5Adapters(input: {
  readonly clock: VirtualClock;
  readonly modelGateway: ReactorAdaptersV0["modelGateway"];
}): ReactorAdaptersV0 {
  const receipts: ReceiptV0[] = [];
  let registry = createC5Registry();

  return {
    clock: input.clock,
    storage: {
      appendReceipt(receipt): void {
        receipts.push(receipt);
      },
      listReceipts(): readonly ReceiptV0[] {
        return [...receipts];
      },
      readRegistry(): ReactorRegistrySnapshotV0 {
        return registry;
      },
      writeRegistry(nextRegistry): void {
        registry = nextRegistry;
      },
    },
    modelGateway: input.modelGateway,
    agentSdk: {
      launch: (request) => ({ payload: request.payload }),
    },
    sandbox: {
      run: () => ({ exit_code: 0, stdout: "", stderr: "" }),
    },
    connectors: {
      read: (request) => ({ payload: request }),
    },
    eventSink: {
      emit: () => {},
    },
  };
}

function createC5Registry(): ReactorRegistrySnapshotV0 {
  return {
    contract_revision: CONTRACT_HASH,
    policy_artifact_id: "policy.incident-briefing-periodic-surprise",
    policy_artifact_identity: "policy.incident-briefing-periodic-surprise@1",
    policy_artifact_namespace: POLICY_NAMESPACE,
    policy_artifact_revision: POLICY_REVISION,
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_content_hash: POLICY_ARTIFACT_HASH,
    compiled_evidence_plan: createC5CompiledEvidencePlan(),
    forecast_schedule: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      memo_key: "c5-periodic-surprise-forecast-seed",
      evidence_input_ids: [INCIDENT_EVIDENCE_HASH],
      next_evidence_recheck: "2026-05-18T12:15:00.000Z",
      next_plan_recheck: "2026-05-18T18:00:00.000Z",
    },
  };
}

function createC5CompiledEvidencePlan(): CompiledEvidencePlan {
  return {
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_HASH,
    policy_artifact_namespace: POLICY_NAMESPACE,
    policy_artifact_revision: POLICY_REVISION,
    plan_revision: "c5-periodic-surprise-plan-1",
    as_of: INITIAL_AS_OF,
    evidence_order: "declared",
    sources: [
      {
        id: "incident-feed",
        kind: "adapter",
        required: true,
      },
    ],
  };
}

function createC5ModelGateway(
  modelRequests: ReactorModelGatewayRequestV0[],
): ReactorAdaptersV0["modelGateway"] {
  return {
    invoke(request): ReactorModelGatewayResponseV0 {
      modelRequests.push(request);
      if (!isRuntimeJudgeRequest(request)) {
        throw new Error("C5 event-changing scenario only permits runtime judge requests");
      }

      return {
        payload: {
          status: "up",
          confidence: {
            value: 0.97,
            derivation_method: "cradle-c5-deterministic-local",
            calibration_grade: "none",
            label_source: "cradle-c5-periodic-surprise",
          },
          cost_tags: {
            tags: ["c5-periodic-surprise", "local-deterministic"],
          },
        },
        usage: {
          provider: "cradle-local",
          model: "c5-periodic-surprise-deterministic",
          tokens: {
            fresh: LOCAL_JUDGE_FRESH_TOKENS,
            reused: 0,
          },
        },
      };
    },
  };
}

function isRuntimeJudgeRequest(request: ReactorModelGatewayRequestV0): boolean {
  return (
    request.kind === "judge" &&
    isRecord(request.payload) &&
    request.payload["schema"] === "openprose.reactor.judge.request"
  );
}

function materialChangeTrace(run: ScenarioRunReceiptV0): ScenarioRunReceiptV0["trace"][number] {
  const match = run.trace.find(
    (entry) => entry.step.kind === "ingest" && entry.step.event === "incident-opened",
  );
  if (match === undefined) {
    throw new Error("periodic surprise scenario did not run incident-opened step");
  }

  return match;
}

function asSyntheticReadPayload(
  value: unknown,
): SyntheticWorldReadPayloadV0 {
  const payload = asRecord(value, "synthetic world read payload");
  equal(payload["schema"], "openprose.reactor.synthetic-world");

  return payload as unknown as SyntheticWorldReadPayloadV0;
}

function readDetailedSurprise(payload: unknown): unknown {
  const record = asRecord(payload, "world event payload");

  return record["surprise"];
}

function hasCanonicalReceiptHash(receipt: ReceiptV0): boolean {
  const verification = c5RuntimeApi.verifyReceiptV0(receipt);

  return verification.ok && receipt.content_hash === verification.content_hash;
}

function sumTokens(receipts: readonly ReceiptV0[], key: "fresh" | "reused"): number {
  return receipts.reduce((sum, receipt) => sum + receipt.cost.tokens[key], 0);
}

function loadC5RuntimeApi(): PublicC5RuntimeApiV0 {
  const sdkSurface = requireReactorSubpathSurface("sdk");
  const receiptSurface = requireReactorSubpathSurface("receipt");
  if (typeof sdkSurface["createReactor"] !== "function") {
    throw new Error("C5 reactor SDK createReactor export is missing");
  }
  if (typeof receiptSurface["verifyReceiptV0"] !== "function") {
    throw new Error("C5 reactor receipt verifyReceiptV0 export is missing");
  }

  return {
    createReactor:
      sdkSurface["createReactor"] as PublicC5RuntimeApiV0["createReactor"],
    verifyReceiptV0:
      receiptSurface["verifyReceiptV0"] as PublicC5RuntimeApiV0["verifyReceiptV0"],
  };
}

function requireReactorSubpathSurface(subpath: "receipt" | "sdk"): Record<string, unknown> {
  try {
    return require(`@openprose/reactor/${subpath}`) as Record<string, unknown>;
  } catch (packageError) {
    const packageMessage =
      packageError instanceof Error ? packageError.message : String(packageError);
    const workspaceDistCandidates = [
      join(process.cwd(), "..", "reactor", "dist", subpath),
      join(process.cwd(), "packages", "reactor", "dist", subpath),
    ];
    const distMessages: string[] = [];

    for (const workspaceDist of workspaceDistCandidates) {
      try {
        return require(workspaceDist) as Record<string, unknown>;
      } catch (distError) {
        distMessages.push(
          distError instanceof Error ? distError.message : String(distError),
        );
      }
    }

    throw new Error(
      `@openprose/reactor/${subpath} import failed (${packageMessage}); workspace dist fallback failed (${distMessages.join(" | ")})`,
    );
  }
}

function interceptFetch(onCall: () => void): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
    onCall();
    throw new Error("network calls are not allowed in C5 event-changing scenario");
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function withAmbientTimePoisoned(fn: () => void): void {
  const originalDate = globalThis.Date;
  const poisonDate = function (
    this: Date,
    ...args: readonly unknown[]
  ): Date {
    if (new.target === undefined || args.length === 0) {
      throw new Error("ambient time must not be consulted");
    }

    return Reflect.construct(originalDate, args, new.target) as Date;
  } as unknown as DateConstructor;

  Object.setPrototypeOf(poisonDate, originalDate);
  (poisonDate as DateConstructor & { prototype: Date }).prototype =
    originalDate.prototype;
  poisonDate.parse = originalDate.parse;
  poisonDate.UTC = originalDate.UTC;
  poisonDate.now = () => {
    throw new Error("ambient time must not be consulted");
  };

  (globalThis as { Date: DateConstructor }).Date = poisonDate;
  try {
    fn();
  } finally {
    (globalThis as { Date: DateConstructor }).Date = originalDate;
  }
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
