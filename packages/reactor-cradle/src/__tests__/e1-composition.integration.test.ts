import { deepEqual, equal } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import type {
  InMemoryMemoStoreV0,
  PolicyArtifactMemoNamespaceV0,
} from "@openprose/reactor/memo";
import type {
  ConsumedReceiptPinV0,
  ContentHashV0,
  ReceiptFreshnessV0,
  ReceiptTokensV0,
  ReceiptV0,
  ReceiptV0Input,
} from "@openprose/reactor/receipt";
type ReactorCompositionModuleV0 = typeof import("@openprose/reactor/composition");
type ReactorMemoModuleV0 = typeof import("@openprose/reactor/memo");
type ReactorReceiptModuleV0 = typeof import("@openprose/reactor/receipt");
type ReactorCompositionApiV0 = Pick<
  ReactorCompositionModuleV0,
  | "computeDownstreamComposedMemoKeyV0"
  | "dependencyReceiptPinFromVerifiedReceiptV0"
  | "planCompositionPropagationV0"
>;
type ReactorMemoApiV0 = Pick<
  ReactorMemoModuleV0,
  "InMemoryMemoStoreV0" | "createMemoizedVerdictEntryV0"
>;
type ReactorReceiptApiV0 = Pick<
  ReactorReceiptModuleV0,
  "createReceiptV0" | "readTokenTruthV0"
>;
type ResponsibilityNodeIdV0 = "A" | "B" | "C";
type DownstreamNodeIdV0 = "B" | "C";

interface GraphRunNodeV0 {
  readonly outcome: "judged" | "memo-hit" | "unchanged-upstream";
  readonly memo_key: ContentHashV0;
  readonly receipt: ReceiptV0;
}

interface GraphRunResultV0 {
  readonly a: GraphRunNodeV0;
  readonly b: GraphRunNodeV0;
  readonly c: GraphRunNodeV0;
  readonly a_dependency_pin: ConsumedReceiptPinV0;
}

const CONTRACT_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentHashV0;
const CONTRACT_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as ContentHashV0;
const CONTRACT_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as ContentHashV0;
const EVIDENCE_A =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as ContentHashV0;
const EVIDENCE_B =
  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as ContentHashV0;
const EVIDENCE_C =
  "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as ContentHashV0;
const MEMO_NAMESPACE: PolicyArtifactMemoNamespaceV0 = {
  policy_artifact_namespace: "cradle.e1.composition",
  policy_artifact_revision: "policy-v0",
};
const compositionApi = requirePublicReactorSubpath<ReactorCompositionApiV0>(
  "composition",
);
const memoApi = requirePublicReactorSubpath<ReactorMemoApiV0>("memo");
const receiptApi = requirePublicReactorSubpath<ReactorReceiptApiV0>("receipt");

test("E1 composes A/B/C through receipt pins and stops downstream on memo hits", () => {
  const memoStore = new memoApi.InMemoryMemoStoreV0();
  const judge = createLocalJudgeCounter();
  const modelGateway = createThrowingModelGateway();

  const firstRun = runGraphOnce({
    asOf: "2026-05-18T12:00:00Z",
    nextForecastRecheck: "2026-05-19T12:00:00Z",
    memoStore,
    judge,
    modelGateway,
  });

  deepEqual(readJudgeCalls(judge), { A: 1, B: 1, C: 1 });
  equal(modelGateway.calls(), 0);
  equal(firstRun.a.outcome, "judged");
  equal(firstRun.b.outcome, "judged");
  equal(firstRun.c.outcome, "judged");

  const expectedBMemoKey = compositionApi.computeDownstreamComposedMemoKeyV0({
    contract_revision: CONTRACT_B,
    evidence_receipts: [EVIDENCE_B],
    dependency_receipts: [firstRun.a_dependency_pin],
  });
  const expectedCMemoKey = compositionApi.computeDownstreamComposedMemoKeyV0({
    contract_revision: CONTRACT_C,
    evidence_receipts: [EVIDENCE_C],
    dependency_receipts: [firstRun.a_dependency_pin],
  });

  equal(firstRun.b.memo_key, expectedBMemoKey);
  equal(firstRun.c.memo_key, expectedCMemoKey);
  equal(firstRun.b.receipt.core.memo_key, expectedBMemoKey);
  equal(firstRun.c.receipt.core.memo_key, expectedCMemoKey);
  deepEqual(firstRun.b.receipt.composition.consumed_receipts, [
    firstRun.a_dependency_pin,
  ]);
  deepEqual(firstRun.c.receipt.composition.consumed_receipts, [
    firstRun.a_dependency_pin,
  ]);
  equal(
    firstRun.a_dependency_pin.upstream_content_hash,
    firstRun.a.receipt.content_hash,
  );

  const followUpRun = runGraphOnce({
    asOf: "2026-05-18T13:00:00Z",
    nextForecastRecheck: "2026-05-19T13:00:00Z",
    memoStore,
    judge,
    modelGateway,
    latestAReceipt: firstRun.a.receipt,
  });

  deepEqual(readJudgeCalls(judge), { A: 1, B: 1, C: 1 });
  equal(modelGateway.calls(), 0);
  equal(followUpRun.a.outcome, "unchanged-upstream");
  equal(followUpRun.b.outcome, "memo-hit");
  equal(followUpRun.c.outcome, "memo-hit");
  equal(followUpRun.b.memo_key, expectedBMemoKey);
  equal(followUpRun.c.memo_key, expectedCMemoKey);
  equal(followUpRun.b.receipt.cost.tokens.fresh, 0);
  equal(followUpRun.c.receipt.cost.tokens.fresh, 0);
  equal(
    followUpRun.b.receipt.cost.tokens.reused,
    firstRun.b.receipt.cost.tokens.fresh + firstRun.b.receipt.cost.tokens.reused,
  );
  equal(
    followUpRun.c.receipt.cost.tokens.reused,
    firstRun.c.receipt.cost.tokens.fresh + firstRun.c.receipt.cost.tokens.reused,
  );
  deepEqual(receiptApi.readTokenTruthV0(followUpRun.b.receipt), {
    responsibility_id: "responsibility.B",
    run_id: "memo-hit-2026-05-18T13:00:00Z",
    provider: "memo",
    model: "memoized-verdict",
    role: "judge",
    tags: ["memo-hit", "e1-composition", "local-judge"],
    as_of: "2026-05-18T13:00:00Z",
    fresh: 0,
    reused:
      firstRun.b.receipt.cost.tokens.fresh +
      firstRun.b.receipt.cost.tokens.reused,
    surprise_cause: "real-input",
  });
  deepEqual(receiptApi.readTokenTruthV0(followUpRun.c.receipt), {
    responsibility_id: "responsibility.C",
    run_id: "memo-hit-2026-05-18T13:00:00Z",
    provider: "memo",
    model: "memoized-verdict",
    role: "judge",
    tags: ["memo-hit", "e1-composition", "local-judge"],
    as_of: "2026-05-18T13:00:00Z",
    fresh: 0,
    reused:
      firstRun.c.receipt.cost.tokens.fresh +
      firstRun.c.receipt.cost.tokens.reused,
    surprise_cause: "real-input",
  });
});

function runGraphOnce(input: {
  readonly asOf: string;
  readonly nextForecastRecheck: string;
  readonly memoStore: InMemoryMemoStoreV0;
  readonly judge: LocalJudgeCounterV0;
  readonly modelGateway: ThrowingModelGatewayV0;
  readonly latestAReceipt?: ReceiptV0;
}): GraphRunResultV0 {
  const a =
    input.latestAReceipt === undefined
      ? judgeNode(input.judge, {
          id: "A",
          contractRevision: CONTRACT_A,
          memoKey: computeRootMemoKey(CONTRACT_A, [EVIDENCE_A]),
          evidenceInputIds: [EVIDENCE_A],
          consumedReceipts: [],
          tokens: { fresh: 29, reused: 0 },
          asOf: input.asOf,
          nextForecastRecheck: input.nextForecastRecheck,
        })
      : {
          outcome: "unchanged-upstream" as const,
          memo_key: input.latestAReceipt.core.memo_key as ContentHashV0,
          receipt: input.latestAReceipt,
        };
  const aDependencyPin = compositionApi.dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: a.receipt,
    acceptable_signer_set: ["none"],
  });

  return {
    a,
    b: reconcileDownstream(input, {
      id: "B",
      contractRevision: CONTRACT_B,
      evidenceInputIds: [EVIDENCE_B],
      dependencyReceipts: [aDependencyPin],
      tokens: { fresh: 41, reused: 0 },
    }),
    c: reconcileDownstream(input, {
      id: "C",
      contractRevision: CONTRACT_C,
      evidenceInputIds: [EVIDENCE_C],
      dependencyReceipts: [aDependencyPin],
      tokens: { fresh: 43, reused: 0 },
    }),
    a_dependency_pin: aDependencyPin,
  };
}

function reconcileDownstream(
  input: {
    readonly asOf: string;
    readonly nextForecastRecheck: string;
    readonly memoStore: InMemoryMemoStoreV0;
    readonly judge: LocalJudgeCounterV0;
  },
  node: {
    readonly id: DownstreamNodeIdV0;
    readonly contractRevision: ContentHashV0;
    readonly evidenceInputIds: readonly ContentHashV0[];
    readonly dependencyReceipts: readonly ConsumedReceiptPinV0[];
    readonly tokens: ReceiptTokensV0;
  },
): GraphRunNodeV0 {
  const plan = compositionApi.planCompositionPropagationV0({
    contract_revision: node.contractRevision,
    evidence_receipts: node.evidenceInputIds,
    dependency_receipts: node.dependencyReceipts,
    memo_namespace: MEMO_NAMESPACE,
    memo_store: input.memoStore,
    as_of: input.asOf,
    next_forecast_recheck: input.nextForecastRecheck,
  });

  if (plan.outcome === "stop-memo-hit") {
    return {
      outcome: "memo-hit",
      memo_key: plan.memo_key,
      receipt: plan.memo_hit_receipt,
    };
  }

  const judged = judgeNode(input.judge, {
    id: node.id,
    contractRevision: node.contractRevision,
    memoKey: plan.memo_key,
    evidenceInputIds: node.evidenceInputIds,
    consumedReceipts: plan.dependency_receipts,
    tokens: node.tokens,
    asOf: input.asOf,
    nextForecastRecheck: input.nextForecastRecheck,
  });
  input.memoStore.store(
    MEMO_NAMESPACE,
    memoApi.createMemoizedVerdictEntryV0(plan.memo_key, judged.receipt),
  );

  return judged;
}

function judgeNode(
  judge: LocalJudgeCounterV0,
  input: {
    readonly id: ResponsibilityNodeIdV0;
    readonly contractRevision: ContentHashV0;
    readonly memoKey: ContentHashV0;
    readonly evidenceInputIds: readonly ContentHashV0[];
    readonly consumedReceipts: readonly ConsumedReceiptPinV0[];
    readonly tokens: ReceiptTokensV0;
    readonly asOf: string;
    readonly nextForecastRecheck: string;
  },
): GraphRunNodeV0 {
  const receipt = judge.judge(input);

  return {
    outcome: "judged",
    memo_key: input.memoKey,
    receipt,
  };
}

function computeRootMemoKey(
  contractRevision: ContentHashV0,
  evidenceInputIds: readonly ContentHashV0[],
): ContentHashV0 {
  return compositionApi.computeDownstreamComposedMemoKeyV0({
    contract_revision: contractRevision,
    evidence_receipts: evidenceInputIds,
    dependency_receipts: [],
  });
}

interface LocalJudgeCounterV0 {
  readonly judge: (input: {
    readonly id: ResponsibilityNodeIdV0;
    readonly contractRevision: ContentHashV0;
    readonly memoKey: ContentHashV0;
    readonly evidenceInputIds: readonly ContentHashV0[];
    readonly consumedReceipts: readonly ConsumedReceiptPinV0[];
    readonly tokens: ReceiptTokensV0;
    readonly asOf: string;
    readonly nextForecastRecheck: string;
  }) => ReceiptV0;
  readonly callsFor: (id: ResponsibilityNodeIdV0) => number;
}

interface ThrowingModelGatewayV0 {
  readonly invoke: () => never;
  readonly calls: () => number;
}

function createLocalJudgeCounter(): LocalJudgeCounterV0 {
  const calls = new Map<ResponsibilityNodeIdV0, number>([
    ["A", 0],
    ["B", 0],
    ["C", 0],
  ]);

  return {
    judge(input): ReceiptV0 {
      calls.set(input.id, (calls.get(input.id) ?? 0) + 1);
      return makeJudgeReceipt(input);
    },
    callsFor(id): number {
      return calls.get(id) ?? 0;
    },
  };
}

function createThrowingModelGateway(): ThrowingModelGatewayV0 {
  let calls = 0;

  return {
    invoke(): never {
      calls += 1;
      throw new Error("live model/API gateway must not be used in E1");
    },
    calls(): number {
      return calls;
    },
  };
}

function readJudgeCalls(
  judge: LocalJudgeCounterV0,
): Record<ResponsibilityNodeIdV0, number> {
  return {
    A: judge.callsFor("A"),
    B: judge.callsFor("B"),
    C: judge.callsFor("C"),
  };
}

function makeJudgeReceipt(input: {
  readonly id: ResponsibilityNodeIdV0;
  readonly contractRevision: ContentHashV0;
  readonly memoKey: ContentHashV0;
  readonly evidenceInputIds: readonly ContentHashV0[];
  readonly consumedReceipts: readonly ConsumedReceiptPinV0[];
  readonly tokens: ReceiptTokensV0;
  readonly asOf: string;
  readonly nextForecastRecheck: string;
}): ReceiptV0 {
  const freshness = makeFixtureFreshness({
    asOf: input.asOf,
    nextForecastRecheck: input.nextForecastRecheck,
    consumedReceipts: input.consumedReceipts,
  });
  const receiptInput: ReceiptV0Input = {
    core: {
      responsibility_id: `responsibility.${input.id}`,
      contract_revision: input.contractRevision,
      event_cause: "real-input",
      memo_key: input.memoKey,
      evidence_input_ids: input.evidenceInputIds,
      as_of: input.asOf,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "E1 composition integration uses a local deterministic judge",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.93,
        derivation_method: "local deterministic judge",
        calibration_grade: "authored",
        label_source: "cradle e1 fixture",
      },
    },
    freshness,
    composition: {
      consumed_receipts: input.consumedReceipts,
      cycle_checked: true,
    },
    cost: {
      provider: "cradle",
      model: "deterministic-local-judge",
      role: "judge",
      tags: ["e1-composition", "local-judge"],
      responsibility_id: `responsibility.${input.id}`,
      run_id: `e1-composition-${input.id}-${input.asOf}`,
      as_of: input.asOf,
      tokens: input.tokens,
      surprise_cause: "real-input",
    },
  };

  return receiptApi.createReceiptV0(receiptInput);
}

function makeFixtureFreshness(input: {
  readonly asOf: string;
  readonly nextForecastRecheck: string;
  readonly consumedReceipts: readonly ConsumedReceiptPinV0[];
}): ReceiptFreshnessV0 {
  return {
    as_of: input.asOf,
    next_forecast_recheck: input.nextForecastRecheck,
    ...(input.consumedReceipts.length === 0
      ? {}
      : {
          transitive_freshness_policy_ref:
            "policy.e1-composition.transitive-freshness@v0",
          consumed_freshness_evaluated: input.consumedReceipts.map(
            (pin) => ({
              receipt_hash: pin.upstream_content_hash,
              next_forecast_recheck: input.nextForecastRecheck,
              staleness_outcome: "fresh" as const,
            }),
          ),
        }),
  };
}

function requirePublicReactorSubpath<T>(
  subpath: "composition" | "memo" | "receipt",
): T {
  const packageSubpath = `@openprose/reactor/${subpath}`;
  try {
    return require(packageSubpath) as T;
  } catch (packageError) {
    if (!isMissingReactorSubpath(packageError, packageSubpath)) {
      throw packageError;
    }

    const packageMessage =
      packageError instanceof Error ? packageError.message : String(packageError);
    const exportTarget = readReactorPackageExportTarget(subpath);

    try {
      return require(join(reactorPackageRoot(), exportTarget)) as T;
    } catch (exportTargetError) {
      const exportTargetMessage =
        exportTargetError instanceof Error
          ? exportTargetError.message
          : String(exportTargetError);
      throw new Error(
        `${packageSubpath} public import failed (${packageMessage}); declared export target ${exportTarget} failed (${exportTargetMessage})`,
      );
    }
  }
}

function readReactorPackageExportTarget(
  subpath: "composition" | "memo" | "receipt",
): string {
  const packageJson = JSON.parse(
    readFileSync(join(reactorPackageRoot(), "package.json"), "utf8"),
  ) as {
    readonly exports?: Record<
      string,
      {
        readonly default?: unknown;
      }
    >;
  };
  const exportEntry = packageJson.exports?.[`./${subpath}`];

  if (typeof exportEntry?.default !== "string") {
    throw new Error(`@openprose/reactor/${subpath} is missing from package exports`);
  }

  return exportEntry.default;
}

function reactorPackageRoot(): string {
  return join(process.cwd(), "..", "reactor");
}

function isMissingReactorSubpath(error: unknown, packageSubpath: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error["code"] === "MODULE_NOT_FOUND" &&
    error.message.includes(packageSubpath)
  );
}
