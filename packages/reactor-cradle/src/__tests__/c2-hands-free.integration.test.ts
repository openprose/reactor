import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepEqual, equal, match, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import type { ContentHashV0, ReceiptV0 } from "@openprose/reactor/receipt";
import type {
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
} from "@openprose/reactor/sdk";
import { VirtualClock } from "../doubles/clock";
import {
  FileSystemReactorStorage,
  InMemoryReactorStorage,
} from "../doubles/storage";
import {
  type ModelGatewayCassetteV0,
  createReplayModelGatewayV0,
} from "../replay/model-gateway";

interface PublicC2ApiV0 {
  readonly createSyntheticWorldConnectorV0: (input: {
    readonly initial_as_of: string;
    readonly profile: { readonly kind: "static" };
    readonly sources: readonly {
      readonly source_id: string;
      readonly payload: unknown;
    }[];
  }) => unknown;
  readonly parseScenarioV0: (
    text: string,
    options: { readonly sourceName: string },
  ) => unknown;
  readonly runScenarioV0: (input: {
    readonly scenario: unknown;
    readonly clock: VirtualClock;
    readonly world: ScenarioWorldAdapterLikeV0;
    readonly modelGateway: ScenarioModelGatewayLikeV0;
    readonly storage?: ScenarioRunnerStorageLikeV0;
  }) => ScenarioRunReceiptLikeV0;
}

interface PublicC3ParityApiV0 {
  readonly assertReplayByteIdenticalV0: (
    expected: ReplayComparableScenarioOutputInputLikeV0,
    actual: ReplayComparableScenarioOutputInputLikeV0,
  ) => C3CheckResultLikeV0;
  readonly assertReplayParityMatrixV0: (input: {
    readonly baseline: ReplayComparableScenarioOutputInputLikeV0;
    readonly runAdapter: (
      row: C3ParityAdapterRowLikeV0,
    ) => ReplayComparableScenarioOutputInputLikeV0;
  }) => C3ParityMatrixResultLikeV0;
}

interface PublicC3AssertionApiV0 {
  readonly assertStaticSurpriseZeroV0: (
    run: ScenarioRunReceiptLikeV0,
  ) => C3AssertionResultLikeV0;
  readonly assertSurpriseAttributionCompleteV0: (
    run: ScenarioRunReceiptLikeV0,
  ) => C3AssertionResultLikeV0;
  readonly assertFlatSpendUnderStaticV0: (
    run: ScenarioRunReceiptLikeV0,
  ) => C3AssertionResultLikeV0;
  readonly assertNoFixedIntervalWorkV0: (
    run: ScenarioRunReceiptLikeV0,
  ) => C3AssertionResultLikeV0;
}

interface ScenarioModelGatewayLikeV0 {
  readonly invoke: (
    request: ReactorModelGatewayRequestV0,
  ) => ReactorModelGatewayResponseV0;
}

interface ScenarioRunnerStorageLikeV0 {
  readonly listReceipts: () => readonly ReceiptV0[];
}

interface ScenarioRunReceiptLikeV0 {
  readonly scenario_id: string;
  readonly schema: string;
  readonly v: number;
  readonly world_profile: "static";
  readonly cassette_path: string;
  readonly initial_instant: string;
  readonly final_instant: string;
  readonly trace: readonly ScenarioTraceEntryLikeV0[];
  readonly receipt_log: {
    readonly entries: readonly unknown[];
    readonly content_hashes: readonly string[];
  };
  readonly expected_relationships: readonly unknown[];
}

interface ScenarioTraceEntryLikeV0 {
  readonly world_advance?: ScenarioWorldResultLikeV0;
  readonly world_event?: ScenarioWorldResultLikeV0;
  readonly world_reads: readonly {
    readonly surprise?: ScenarioWorldSurpriseLikeV0;
  }[];
  readonly model_response?: ReactorModelGatewayResponseV0;
}

interface ScenarioWorldAdapterLikeV0 {
  readonly read: (request: {
    readonly source_id: string;
    readonly as_of: string;
  }) => {
    readonly payload: unknown;
    readonly surprise?: ScenarioWorldSurpriseLikeV0;
  };
  readonly applyEvent: (event: {
    readonly event: string;
    readonly source_id?: string;
    readonly as_of: string;
  }) => ScenarioWorldResultLikeV0;
  readonly advanceTo: (input: {
    readonly as_of: string;
  }) => ScenarioWorldResultLikeV0;
}

interface ScenarioWorldResultLikeV0 {
  readonly payload: unknown;
  readonly surprise?: ScenarioWorldSurpriseLikeV0;
}

interface ScenarioWorldSurpriseLikeV0 {
  readonly profile: "static" | "periodic-surprise" | "adversarial-silent";
  readonly count: number;
  readonly causes: readonly string[];
}

interface SyntheticWorldLikeV0 {
  readonly read: (request: {
    readonly source_id: string;
    readonly as_of: string;
  }) => { readonly payload: unknown };
  readonly advance: (input: SyntheticWorldAdvanceLikeV0) => {
    readonly surprise: SyntheticWorldSurpriseReportLikeV0;
  };
}

type SyntheticWorldAdvanceLikeV0 =
  | {
      readonly kind: "time";
      readonly as_of: string;
    }
  | {
      readonly kind: "source-event";
      readonly as_of: string;
      readonly source_id: string;
      readonly event_id: string;
    };

interface SyntheticWorldSurpriseReportLikeV0 {
  readonly profile: "static" | "periodic-surprise" | "adversarial-silent";
  readonly surprise_count: number;
  readonly surprise_events: readonly unknown[];
}

type C2ApiLoadResultV0 =
  | { readonly ok: true; readonly api: PublicC2ApiV0 }
  | { readonly ok: false; readonly reason: string };

type C3ParityApiLoadResultV0 =
  | { readonly ok: true; readonly api: PublicC3ParityApiV0 }
  | { readonly ok: false; readonly reason: string };

type C3AssertionApiLoadResultV0 =
  | { readonly ok: true; readonly api: PublicC3AssertionApiV0 }
  | { readonly ok: false; readonly reason: string };

type ReplayComparableScenarioOutputInputLikeV0 = ScenarioRunReceiptLikeV0;
type C2ParityStorageAdapterLikeV0 = "memory" | "fs" | "pg";

interface C3CheckResultLikeV0 {
  readonly ok: boolean;
  readonly relationship: string;
}

interface C3AssertionResultLikeV0 {
  readonly family: string;
  readonly status: string;
  readonly summary: string;
  readonly evidence: readonly unknown[];
}

interface C3ParityAdapterRowLikeV0 {
  readonly name: string;
  readonly storage_adapter: string;
  readonly status: string;
}

interface C3ParityMatrixResultLikeV0 {
  readonly ok: boolean;
  readonly relationship: "cross-adapter-parity";
  readonly ready_rows_run: number;
  readonly future_rows: number;
  readonly rows: readonly C3ParityRowResultLikeV0[];
}

interface C3ParityRowResultLikeV0 {
  readonly adapter_name: string;
  readonly storage_adapter: string;
  readonly status: string;
}

const FIXTURE_DIR = join(process.cwd(), "src", "__tests__", "fixtures");
const SCENARIO_FIXTURE = join(FIXTURE_DIR, "c2-static-zero.scenario");
const CASSETTE_FIXTURE = join(
  FIXTURE_DIR,
  "c2-static-zero.model-cassette.json",
);
const C2_CONTRACT_HASH =
  "sha256:1111111111111111111111111111111111111111111111111111111111111111" as ContentHashV0;
const C2_EVIDENCE_HASH =
  "sha256:2222222222222222222222222222222222222222222222222222222222222222" as ContentHashV0;
const C2_BOOTSTRAP_RECEIPT_HASH =
  "sha256:3333333333333333333333333333333333333333333333333333333333333333" as ContentHashV0;
const C2_POLICY_ARTIFACT_HASH =
  "sha256:4444444444444444444444444444444444444444444444444444444444444444" as ContentHashV0;
const C2_BOOTSTRAP_AS_OF = "2026-05-18T12:00:00.000Z";
const REQUIRED_PUBLIC_EXPORTS = [
  "createSyntheticWorldConnectorV0",
  "parseScenarioV0",
  "runScenarioV0",
] as const;
const REQUIRED_PUBLIC_C3_PARITY_EXPORTS = [
  "assertReplayByteIdenticalV0",
  "assertReplayParityMatrixV0",
] as const;
const REQUIRED_PUBLIC_C3_ASSERTION_EXPORTS = [
  "assertStaticSurpriseZeroV0",
  "assertSurpriseAttributionCompleteV0",
  "assertFlatSpendUnderStaticV0",
  "assertNoFixedIntervalWorkV0",
] as const;

const loadedC2Api = loadPublicC2Api();
const loadedC3ParityApi = loadPublicC3ParityApi();
const loadedC3AssertionApi = loadPublicC3AssertionApi();

test("static C2 fixture uses a local replay cassette", () => {
  const scenarioText = readScenarioFixture();
  const cassette = readModelCassetteFixture();
  const exchange = exchangeAt(cassette, 0);
  const replay = createReplayModelGatewayV0(cassette);

  match(scenarioText, /^scenario: incident-briefing-static-zero$/m);
  match(scenarioText, /^world: static$/m);
  match(scenarioText, /^cassette: \.\/c2-static-zero\.model-cassette\.json$/m);
  match(scenarioText, /network_calls=0/);
  match(scenarioText, /live_model_calls=0/);

  const response = replay.invoke(exchange.request);
  deepEqual(response, exchange.response);
  equal(tokenCount(response, "fresh"), 0);
  ok(tokenCount(response, "reused") > 0);
  throws(() => replay.invoke(exchange.request), /model gateway replay exhausted/);
});

test(
  "public C2 exports run the static scenario hands-free",
  { skip: loadedC2Api.ok ? false : loadedC2Api.reason },
  () => {
    if (!loadedC2Api.ok) {
      return;
    }

    let networkCalls = 0;
    const restoreFetch = interceptFetch(() => {
      networkCalls += 1;
    });

    try {
      const { run: trace, modelGateway } = runStaticC2ScenarioHandsFree();

      assertScenarioRunReceipt(trace);
      equal(trace.scenario_id, "incident-briefing-static-zero");
      equal(trace.world_profile, "static");
      assertStaticSurpriseStaysZero(trace);
      assertDeterministicModelResponse(trace);
      throws(
        () => modelGateway.invoke(exchangeAt(readModelCassetteFixture(), 0).request),
        /model gateway replay exhausted/,
      );
      equal(networkCalls, 0);
    } finally {
      restoreFetch();
    }
  },
);

test(
  "public C3 parity exports replay the static C2 scenario hands-free",
  { skip: c3ParityIntegrationSkipReason() },
  () => {
    if (!loadedC2Api.ok || !loadedC3ParityApi.ok) {
      return;
    }

    let networkCalls = 0;
    const restoreFetch = interceptFetch(() => {
      networkCalls += 1;
    });

    try {
      const baseline = runStaticC2ScenarioHandsFree().run;
      const replayed = runStaticC2ScenarioHandsFree().run;
      const replayCheck = loadedC3ParityApi.api.assertReplayByteIdenticalV0(
        baseline,
        replayed,
      );
      const invokedRows: string[] = [];
      const parity = loadedC3ParityApi.api.assertReplayParityMatrixV0({
        baseline,
        runAdapter(row) {
          invokedRows.push(row.name);
          return runStaticC2ScenarioHandsFree(row.storage_adapter).run;
        },
      });

      assertC3CheckPassed(replayCheck, "replay-byte-identical");
      assertC3ParityPassed(parity);
      deepEqual(invokedRows, ["deterministic-in-memory", "filesystem"]);
      equal(networkCalls, 0);
    } finally {
      restoreFetch();
    }
  },
);

test(
  "public C3 assertion exports check the static C2 scenario relationships",
  { skip: c3AssertionIntegrationSkipReason() },
  () => {
    if (!loadedC2Api.ok || !loadedC3AssertionApi.ok) {
      return;
    }

    let networkCalls = 0;
    const restoreFetch = interceptFetch(() => {
      networkCalls += 1;
    });

    try {
      const run = runStaticC2ScenarioHandsFree().run;
      const checks = [
        loadedC3AssertionApi.api.assertStaticSurpriseZeroV0(run),
        loadedC3AssertionApi.api.assertSurpriseAttributionCompleteV0(run),
        loadedC3AssertionApi.api.assertFlatSpendUnderStaticV0(run),
        loadedC3AssertionApi.api.assertNoFixedIntervalWorkV0(run),
      ];

      assertC3AssertionPassed(checks[0], "static-surprise-zero");
      assertC3AssertionPassed(checks[1], "surprise-attribution-complete");
      assertC3AssertionPassed(checks[2], "flat-spend-under-static");
      assertC3AssertionPassed(checks[3], "no-fixed-interval-work");
      equal(networkCalls, 0);
    } finally {
      restoreFetch();
    }
  },
);

function readScenarioFixture(): string {
  return readFileSync(SCENARIO_FIXTURE, "utf8");
}

function readModelCassetteFixture(): ModelGatewayCassetteV0 {
  return JSON.parse(readFileSync(CASSETTE_FIXTURE, "utf8")) as ModelGatewayCassetteV0;
}

function loadPublicC2Api(): C2ApiLoadResultV0 {
  const publicSurface = require("../index") as Record<string, unknown>;
  const missing = REQUIRED_PUBLIC_EXPORTS.filter(
    (name) => typeof publicSurface[name] !== "function",
  );

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `waiting for C2 public exports: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true,
    api: publicSurface as unknown as PublicC2ApiV0,
  };
}

function loadPublicC3ParityApi(): C3ParityApiLoadResultV0 {
  const publicSurface = require("../index") as Record<string, unknown>;
  const missing = REQUIRED_PUBLIC_C3_PARITY_EXPORTS.filter(
    (name) => typeof publicSurface[name] !== "function",
  );

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `waiting for C3 parity public exports: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true,
    api: publicSurface as unknown as PublicC3ParityApiV0,
  };
}

function loadPublicC3AssertionApi(): C3AssertionApiLoadResultV0 {
  const publicSurface = require("../index") as Record<string, unknown>;
  const missing = REQUIRED_PUBLIC_C3_ASSERTION_EXPORTS.filter(
    (name) => typeof publicSurface[name] !== "function",
  );

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `waiting for C3 assertion public exports: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true,
    api: publicSurface as unknown as PublicC3AssertionApiV0,
  };
}

function c3ParityIntegrationSkipReason(): false | string {
  if (!loadedC2Api.ok) {
    return loadedC2Api.reason;
  }
  if (!loadedC3ParityApi.ok) {
    return loadedC3ParityApi.reason;
  }

  return false;
}

function c3AssertionIntegrationSkipReason(): false | string {
  if (!loadedC2Api.ok) {
    return loadedC2Api.reason;
  }
  if (!loadedC3AssertionApi.ok) {
    return loadedC3AssertionApi.reason;
  }

  return false;
}

function runStaticC2ScenarioHandsFree(
  storageAdapter: string = "memory",
): {
  readonly run: ScenarioRunReceiptLikeV0;
  readonly modelGateway: ScenarioModelGatewayLikeV0;
} {
  if (!loadedC2Api.ok) {
    throw new Error(loadedC2Api.reason);
  }

  const scenario = loadedC2Api.api.parseScenarioV0(readScenarioFixture(), {
    sourceName: SCENARIO_FIXTURE,
  });
  const world = loadedC2Api.api.createSyntheticWorldConnectorV0({
    initial_as_of: C2_BOOTSTRAP_AS_OF,
    profile: { kind: "static" },
    sources: [
      {
        source_id: "incident-feed",
        payload: { status: "quiet" },
      },
    ],
  });
  const modelGateway = createReplayModelGatewayV0(readModelCassetteFixture());
  const storageContext = createC2ScenarioStorage(
    asC2ParityStorageAdapter(storageAdapter),
  );
  let run: ScenarioRunReceiptLikeV0;
  try {
    run = loadedC2Api.api.runScenarioV0({
      scenario,
      clock: new VirtualClock(C2_BOOTSTRAP_AS_OF),
      world: adaptSyntheticWorldForScenario(world),
      modelGateway,
      storage: storageContext.storage,
    });
  } finally {
    storageContext.cleanup();
  }

  assertScenarioRunReceipt(run);

  return { run, modelGateway };
}

function createC2ScenarioStorage(adapter: C2ParityStorageAdapterLikeV0): {
  readonly storage: ScenarioRunnerStorageLikeV0;
  readonly cleanup: () => void;
} {
  const registry = createC2ScenarioRegistry();
  const receipts = [createStaticScenarioBootstrapReceipt()];

  switch (adapter) {
    case "memory":
      return {
        storage: new InMemoryReactorStorage(registry, receipts),
        cleanup() {},
      };
    case "fs": {
      const rootDir = mkdtempSync(join(tmpdir(), "reactor-cradle-c2-parity-"));
      return {
        storage: new FileSystemReactorStorage({
          rootDir,
          registry,
          initialReceipts: receipts,
        }),
        cleanup() {
          rmSync(rootDir, { recursive: true, force: true });
        },
      };
    }
    case "pg":
      throw new Error("postgres parity row is future");
  }
}

function asC2ParityStorageAdapter(value: string): C2ParityStorageAdapterLikeV0 {
  if (value === "memory" || value === "fs" || value === "pg") {
    return value;
  }

  throw new Error(`unsupported C2 parity storage adapter: ${value}`);
}

function createC2ScenarioRegistry() {
  return {
    contract_revision: C2_CONTRACT_HASH,
    policy_artifact_id: "policy.incident-briefing-static-zero",
    policy_artifact_identity: "policy.incident-briefing-static-zero",
    policy_artifact_namespace: "policy.static",
    policy_artifact_revision: "revision-1",
    policy_artifact_validation_state: "validated" as const,
    validation_state: "validated" as const,
    policy_artifact_content_hash: C2_POLICY_ARTIFACT_HASH,
  };
}

function createStaticScenarioBootstrapReceipt(): ReceiptV0 {
  return {
    schema: "openprose.receipt",
    v: 0,
    hash_algorithm: "sha256",
    content_hash: C2_BOOTSTRAP_RECEIPT_HASH,
    core: {
      responsibility_id: "incident-briefing-static-zero",
      contract_revision: C2_CONTRACT_HASH,
      event_cause: "real-input",
      memo_key: "cradle:c2:incident-briefing-static-zero:bootstrap",
      evidence_input_ids: [C2_EVIDENCE_HASH],
      as_of: C2_BOOTSTRAP_AS_OF,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "cradle deterministic integration fixture",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 1,
        derivation_method: "deterministic replay fixture",
        calibration_grade: "none",
        label_source: "cradle fixture",
      },
    },
    freshness: {
      as_of: C2_BOOTSTRAP_AS_OF,
      next_forecast_recheck: "2026-05-19T12:00:00.000Z",
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "cradle",
      model: "deterministic-replay",
      role: "judge",
      tags: ["cradle", "c2-static", "integration"],
      responsibility_id: "incident-briefing-static-zero",
      run_id: "incident-briefing-static-zero:c2",
      as_of: C2_BOOTSTRAP_AS_OF,
      tokens: {
        fresh: 0,
        reused: 64,
      },
      surprise_cause: "real-input",
    },
  };
}

function assertScenarioRunReceipt(
  value: unknown,
): asserts value is ScenarioRunReceiptLikeV0 {
  if (!isRecord(value)) {
    throw new Error("C2 runner receipt must be an object");
  }
  if (typeof value["scenario_id"] !== "string") {
    throw new Error("C2 runner receipt must include scenario_id");
  }
  if (value["world_profile"] !== "static") {
    throw new Error("C2 runner receipt must include static world_profile");
  }
  if (typeof value["cassette_path"] !== "string") {
    throw new Error("C2 runner receipt must include cassette_path");
  }
  if (typeof value["initial_instant"] !== "string") {
    throw new Error("C2 runner receipt must include initial_instant");
  }
  if (typeof value["final_instant"] !== "string") {
    throw new Error("C2 runner receipt must include final_instant");
  }
  if (!Array.isArray(value["trace"])) {
    throw new Error("C2 runner receipt must include trace array");
  }
  if (!isRecord(value["receipt_log"])) {
    throw new Error("C2 runner receipt must include receipt_log");
  }
  if (!Array.isArray(value["expected_relationships"])) {
    throw new Error("C2 runner receipt must include expected_relationships");
  }
}

function assertStaticSurpriseStaysZero(trace: ScenarioRunReceiptLikeV0): void {
  const reports = trace.trace.flatMap((entry) => [
    ...(entry.world_advance?.surprise === undefined
      ? []
      : [entry.world_advance.surprise]),
    ...(entry.world_event?.surprise === undefined
      ? []
      : [entry.world_event.surprise]),
    ...entry.world_reads.flatMap((read) =>
      read.surprise === undefined ? [] : [read.surprise],
    ),
  ]);

  ok(reports.length > 0);
  ok(reports.every((report) => report.profile === "static"));
  ok(reports.every((report) => report.count === 0));
  ok(reports.every((report) => report.causes.length === 0));
}

function assertDeterministicModelResponse(trace: ScenarioRunReceiptLikeV0): void {
  const responses = trace.trace.flatMap((entry) =>
    entry.model_response === undefined ? [] : [entry.model_response],
  );

  equal(responses.length, 1);
  deepEqual(responses[0], exchangeAt(readModelCassetteFixture(), 0).response);
  equal(tokenCount(responses[0] as ReactorModelGatewayResponseV0, "fresh"), 0);
}

function assertC3CheckPassed(
  check: C3CheckResultLikeV0 | undefined,
  relationship: string,
): void {
  ok(check !== undefined, `${relationship} check must be returned`);
  equal(check.ok, true);
  equal(check.relationship, relationship);
}

function assertC3AssertionPassed(
  result: C3AssertionResultLikeV0 | undefined,
  family: string,
): void {
  ok(result !== undefined, `${family} assertion result must be returned`);
  equal(result.status, "pass");
  equal(result.family, family);
}

function assertC3ParityPassed(result: C3ParityMatrixResultLikeV0): void {
  equal(result.ok, true);
  equal(result.relationship, "cross-adapter-parity");
  equal(result.ready_rows_run, 2);
  equal(result.future_rows, 1);
  deepEqual(
    result.rows.map((row) => `${row.adapter_name}:${row.status}`),
    [
      "deterministic-in-memory:passed",
      "filesystem:passed",
      "postgres:future",
    ],
  );
}

function adaptSyntheticWorldForScenario(
  world: unknown,
): ScenarioWorldAdapterLikeV0 {
  const syntheticWorld = assertSyntheticWorld(world);

  return {
    read(request) {
      const response = syntheticWorld.read(request);
      const surprise = readSurpriseFromPayload(response.payload);
      return {
        payload: response.payload,
        ...(surprise === undefined ? {} : { surprise }),
      };
    },
    applyEvent(event) {
      if (event.source_id === undefined) {
        return {
          payload: { event: event.event },
          surprise: zeroScenarioSurprise(),
        };
      }

      const record = syntheticWorld.advance({
        kind: "source-event",
        as_of: event.as_of,
        source_id: event.source_id,
        event_id: event.event,
      });

      return {
        payload: record,
        surprise: convertSyntheticSurprise(record.surprise),
      };
    },
    advanceTo(input) {
      const record = syntheticWorld.advance({
        kind: "time",
        as_of: input.as_of,
      });

      return {
        payload: record,
        surprise: convertSyntheticSurprise(record.surprise),
      };
    },
  };
}

function assertSyntheticWorld(world: unknown): SyntheticWorldLikeV0 {
  if (!isRecord(world)) {
    throw new Error("synthetic world must be an object");
  }
  if (typeof world["read"] !== "function") {
    throw new Error("synthetic world must include read()");
  }
  if (typeof world["advance"] !== "function") {
    throw new Error("synthetic world must include advance()");
  }

  return world as unknown as SyntheticWorldLikeV0;
}

function readSurpriseFromPayload(
  payload: unknown,
): ScenarioWorldSurpriseLikeV0 | undefined {
  if (!isRecord(payload) || !isRecord(payload["surprise"])) {
    return undefined;
  }

  return convertSyntheticSurprise(
    payload["surprise"] as unknown as SyntheticWorldSurpriseReportLikeV0,
  );
}

function convertSyntheticSurprise(
  report: SyntheticWorldSurpriseReportLikeV0,
): ScenarioWorldSurpriseLikeV0 {
  return {
    profile: report.profile,
    count: report.surprise_count,
    causes: report.surprise_events.map((event) =>
      isRecord(event) && typeof event["kind"] === "string"
        ? event["kind"]
        : "synthetic-surprise",
    ),
  };
}

function zeroScenarioSurprise(): ScenarioWorldSurpriseLikeV0 {
  return {
    profile: "static",
    count: 0,
    causes: [],
  };
}

function exchangeAt(
  cassette: ModelGatewayCassetteV0,
  index: number,
): {
  readonly request: ReactorModelGatewayRequestV0;
  readonly response: ReactorModelGatewayResponseV0;
} {
  const exchange = cassette.exchanges[index];
  if (exchange === undefined) {
    throw new Error(`expected cassette exchange ${index}`);
  }

  return exchange;
}

function tokenCount(
  response: ReactorModelGatewayResponseV0,
  key: "fresh" | "reused",
): number {
  const payload = response.payload;
  if (!isRecord(payload) || !isRecord(payload["tokens"])) {
    throw new Error("model gateway response payload must include tokens");
  }

  const count = payload["tokens"][key];
  if (typeof count !== "number") {
    throw new Error(`model gateway response tokens.${key} must be numeric`);
  }

  return count;
}

function interceptFetch(onCall: () => void): () => void {
  const globalWithFetch = globalThis as typeof globalThis & {
    fetch?: unknown;
  };
  const originalFetch = globalWithFetch.fetch;
  globalWithFetch.fetch = () => {
    onCall();
    throw new Error("network access is disabled in the C2 integration fixture");
  };

  return () => {
    if (originalFetch === undefined) {
      delete globalWithFetch.fetch;
    } else {
      globalWithFetch.fetch = originalFetch;
    }
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
