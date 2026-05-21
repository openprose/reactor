import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepEqual, equal, match, notEqual, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import type { ContentHashV0, ReceiptV0 } from "@openprose/reactor/receipt";
import type {
  ReactorModelGatewayResponseV0,
  ReactorRegistrySnapshotV0,
  ReactorStorageAdapterV0,
} from "@openprose/reactor/sdk";

import { VirtualClock } from "../../doubles/clock";
import {
  FileSystemReactorStorage,
  InMemoryReactorStorage,
} from "../../doubles/storage";
import {
  type ModelGatewayCassetteV0,
  createReplayModelGatewayV0,
} from "../model-gateway";
import {
  assertReplayByteIdenticalV0,
  assertReplayParityMatrixV0,
  compareReplayByteIdenticalV0,
  runReplayParityMatrixV0,
  snapshotReplayComparableOutputV0,
  type ReplayComparableScenarioOutputInputV0,
  type ReplayParityStorageAdapterV0,
} from "../parity";
import { parseScenarioV0 } from "../../scenario/parser";
import { runScenarioV0 } from "../../scenario/runner";
import type {
  ScenarioRunReceiptV0,
  ScenarioWorldAdapterV0,
  ScenarioWorldAdvanceInputV0,
  ScenarioWorldAdvanceResultV0,
  ScenarioWorldEventInputV0,
  ScenarioWorldEventResultV0,
  ScenarioWorldReadResponseV0,
  ScenarioWorldSurpriseV0,
} from "../../scenario/types";
import {
  createSyntheticWorldConnectorV0,
  type SyntheticWorldAdvanceRecordV0,
  type SyntheticWorldConnectorV0,
  type SyntheticWorldReadPayloadV0,
  type SyntheticWorldSurpriseReportV0,
} from "../../world";

const FIXTURE_DIR = join(process.cwd(), "src", "__tests__", "fixtures");
const SCENARIO_FIXTURE = join(FIXTURE_DIR, "c2-static-zero.scenario");
const CASSETTE_FIXTURE = join(
  FIXTURE_DIR,
  "c2-static-zero.model-cassette.json",
);
const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const POLICY_ARTIFACT_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const PARITY_RECEIPT_HASH =
  "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as const;

type ParityScenarioOutputV0 = ScenarioRunReceiptV0 & {
  readonly registry: ReactorRegistrySnapshotV0;
};

test("replay-byte-identical compares the same C2 scenario/cassette output bytes", () => {
  const first = runC2StaticScenario();
  const second = runC2StaticScenario();

  const firstSnapshot = snapshotReplayComparableOutputV0(first);
  const secondSnapshot = snapshotReplayComparableOutputV0(second);
  const check = assertReplayByteIdenticalV0(first, second);

  equal(first.scenario_id, "incident-briefing-static-zero");
  equal(first.cassette_path, "./c2-static-zero.model-cassette.json");
  equal(firstSnapshot.bytes, secondSnapshot.bytes);
  equal(firstSnapshot.content_hash, secondSnapshot.content_hash);
  equal(check.ok, true);
  equal(check.expected_hash, check.actual_hash);
  equal(check.byte_length, firstSnapshot.byte_length);
});

test("replay-byte-identical fails closed when comparable output bytes change", () => {
  const baseline = runC2StaticScenario();
  const changed = withChangedModelOutput(runC2StaticScenario());
  const check = compareReplayByteIdenticalV0(baseline, changed);

  equal(check.ok, false);
  notEqual(check.expected_hash, check.actual_hash);
  equal(check.evidence_path, "$");
  match(check.reason, /bytes differ/);
  throws(
    () => assertReplayByteIdenticalV0(baseline, changed),
    /replay-byte-identical failed/,
  );
});

test("parity matrix runs deterministic in-memory and filesystem ready rows", () => {
  const baseline = runC2StaticScenario();
  const invokedRows: string[] = [];
  const result = runReplayParityMatrixV0({
    baseline,
    runAdapter(row) {
      invokedRows.push(row.name);
      return runC2StaticScenario(row.storage_adapter);
    },
  });

  equal(result.ok, true);
  equal(result.ready_rows_run, 2);
  equal(result.future_rows, 1);
  deepEqual(invokedRows, ["deterministic-in-memory", "filesystem"]);
  deepEqual(
    result.rows.map((row) => `${row.adapter_name}:${row.status}`),
    [
      "deterministic-in-memory:passed",
      "filesystem:passed",
      "postgres:future",
    ],
  );
});

test("parity matrix fails closed when the ready filesystem output changes", () => {
  const baseline = runC2StaticScenario();
  const result = runReplayParityMatrixV0({
    baseline,
    runAdapter(row) {
      const output = runC2StaticScenario(row.storage_adapter);
      return row.storage_adapter === "fs"
        ? withChangedRegistryOutput(output)
        : output;
    },
  });

  equal(result.ok, false);
  const memoryRow = result.rows[0];
  const filesystemRow = result.rows[1];
  ok(memoryRow !== undefined);
  equal(memoryRow.adapter_name, "deterministic-in-memory");
  equal(memoryRow.status, "passed");
  ok(filesystemRow !== undefined);
  equal(filesystemRow.adapter_name, "filesystem");
  if (filesystemRow.status !== "failed") {
    throw new Error("filesystem row should fail when its output changes");
  }
  match(filesystemRow.reason, /bytes differ/);
  equal(filesystemRow.check?.ok, false);
  throws(
    () =>
      assertReplayParityMatrixV0({
        baseline,
        runAdapter(row) {
          const output = runC2StaticScenario(row.storage_adapter);
          return row.storage_adapter === "fs"
            ? withChangedRegistryOutput(output)
            : output;
        },
      }),
    /cross-adapter-parity failed/,
  );
});

function runC2StaticScenario(
  storageAdapter: ReplayParityStorageAdapterV0 = "memory",
): ParityScenarioOutputV0 {
  const scenario = parseScenarioV0(readFileSync(SCENARIO_FIXTURE, "utf8"), {
    sourceName: SCENARIO_FIXTURE,
  });
  const storageContext = createParityStorage(storageAdapter);

  try {
    return {
      ...runScenarioV0({
        scenario,
        clock: new VirtualClock(scenario.initial_instant),
        world: adaptSyntheticWorldForScenario(
          createSyntheticWorldConnectorV0({
            initial_as_of: scenario.initial_instant,
            profile: { kind: "static" },
            sources: scenario.sources.map((source) => ({
              source_id: source.id,
              payload: {
                source_id: source.id,
                status: "quiet",
              },
              ...(typeof source.fields["payload_hash"] === "string"
                ? { payload_hash: source.fields["payload_hash"] }
                : {}),
            })),
          }),
        ),
        modelGateway: createReplayModelGatewayV0(readModelCassetteFixture()),
        storage: storageContext.storage,
      }),
      registry: storageContext.storage.readRegistry(),
    };
  } finally {
    storageContext.cleanup();
  }
}

function readModelCassetteFixture(): ModelGatewayCassetteV0 {
  return JSON.parse(
    readFileSync(CASSETTE_FIXTURE, "utf8"),
  ) as ModelGatewayCassetteV0;
}

function adaptSyntheticWorldForScenario(
  world: SyntheticWorldConnectorV0,
): ScenarioWorldAdapterV0 {
  return {
    read(request): ScenarioWorldReadResponseV0 {
      const response = world.read(request);
      const surprise = readSurpriseFromPayload(response.payload);

      return {
        payload: response.payload,
        ...(surprise === undefined ? {} : { surprise }),
      };
    },
    applyEvent(input: ScenarioWorldEventInputV0): ScenarioWorldEventResultV0 {
      if (input.source_id === undefined) {
        return {
          payload: {
            event: input.event,
          },
          surprise: zeroScenarioSurprise(input.profile),
        };
      }

      const record = world.advance({
        kind: "source-event",
        as_of: input.as_of,
        source_id: input.source_id,
        event_id: input.event,
      });

      return advanceRecordToScenarioResult(record);
    },
    advanceTo(input: ScenarioWorldAdvanceInputV0): ScenarioWorldAdvanceResultV0 {
      return advanceRecordToScenarioResult(
        world.advance({
          kind: "time",
          as_of: input.as_of,
        }),
      );
    },
  };
}

function advanceRecordToScenarioResult(
  record: SyntheticWorldAdvanceRecordV0,
): ScenarioWorldAdvanceResultV0 {
  return {
    payload: record,
    surprise: convertSyntheticSurprise(record.surprise),
  };
}

function readSurpriseFromPayload(
  payload: unknown,
): ScenarioWorldSurpriseV0 | undefined {
  if (!isRecord(payload) || !isRecord(payload["surprise"])) {
    return undefined;
  }

  return convertSyntheticSurprise(
    payload["surprise"] as unknown as SyntheticWorldReadPayloadV0["surprise"],
  );
}

function convertSyntheticSurprise(
  report: SyntheticWorldSurpriseReportV0,
): ScenarioWorldSurpriseV0 {
  return {
    profile: report.profile,
    count: report.surprise_count,
    causes: report.surprise_events.map((event) => event.kind),
  };
}

function zeroScenarioSurprise(
  profile: ScenarioWorldSurpriseV0["profile"],
): ScenarioWorldSurpriseV0 {
  return {
    profile,
    count: 0,
    causes: [],
  };
}

function withChangedModelOutput(
  run: ParityScenarioOutputV0,
): ParityScenarioOutputV0 {
  return {
    ...run,
    trace: run.trace.map((entry) => {
      if (entry.model_response === undefined) {
        return entry;
      }

      return {
        ...entry,
        model_response: {
          payload: {
            ...asRecord(entry.model_response.payload, "model response payload"),
            text: "changed-static-world-output",
          },
        } satisfies ReactorModelGatewayResponseV0,
      };
    }),
  };
}

function withChangedRegistryOutput(
  run: ParityScenarioOutputV0,
): ReplayComparableScenarioOutputInputV0 {
  return {
    ...run,
    registry: {
      ...run.registry,
      policy_artifact_revision: "revision-changed-for-filesystem-row",
    },
  };
}

function asRecord(
  value: unknown,
  label: string,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createParityStorage(
  adapter: ReplayParityStorageAdapterV0,
): {
  readonly storage: ReactorStorageAdapterV0;
  readonly cleanup: () => void;
} {
  const registry = makeParityRegistry();
  const receipts = [makeParityReceipt()];

  switch (adapter) {
    case "memory":
      return {
        storage: new InMemoryReactorStorage(registry, receipts),
        cleanup() {},
      };
    case "fs": {
      const rootDir = mkdtempSync(join(tmpdir(), "reactor-cradle-parity-"));
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

function makeParityRegistry(): ReactorRegistrySnapshotV0 {
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

function makeParityReceipt(): ReceiptV0 {
  return {
    schema: "openprose.receipt",
    v: 0,
    hash_algorithm: "sha256",
    content_hash: PARITY_RECEIPT_HASH,
    core: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: CONTRACT_HASH,
      event_cause: "real-input",
      memo_key: "parity-bootstrap",
      evidence_input_ids: [EVIDENCE_HASH],
      as_of: "2026-05-18T12:00:00.000Z",
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "cradle replay parity storage fixture",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 1,
        derivation_method: "cradle-fixture",
        calibration_grade: "none",
        label_source: "fixture",
      },
    },
    freshness: {
      as_of: "2026-05-18T12:00:00.000Z",
      next_forecast_recheck: "2026-05-18T12:00:00.000Z",
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "fixture",
      model: "deterministic",
      role: "judge",
      tags: ["cradle-parity-storage-test"],
      responsibility_id: "responsibility.incident-briefing",
      run_id: "run-parity-bootstrap",
      as_of: "2026-05-18T12:00:00.000Z",
      tokens: { fresh: 0, reused: 0 },
      surprise_cause: "real-input",
    },
  } satisfies ReceiptV0;
}
