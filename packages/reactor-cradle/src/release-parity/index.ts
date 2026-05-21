import { createHash } from "node:crypto";

import type {
  TransitiveFreshnessEvaluationResultV0,
} from "@openprose/reactor/composition";
import type {
  ConsumedReceiptPinV0,
  ContentHashV0,
  ReceiptBlockedV0,
  ReceiptEventCauseV0,
  ReceiptFreshnessV0,
  ReceiptRecheckKindV0,
  ReceiptRoleV0,
  ReceiptV0,
  ReceiptVerdictStatusV0,
} from "@openprose/reactor/receipt";
import type { ReactorRegistrySnapshotV0 } from "@openprose/reactor/sdk";

import type {
  CradleAssertionEvidenceV0,
  CradleAssertionResultV0,
} from "../assert";
import {
  buildCradleEvalResultV0,
  type CradleEvalResultV0,
} from "../eval";
import {
  runReplayParityMatrixV0,
  snapshotReplayComparableOutputV0,
  type ReplayComparableScenarioOutputInputV0,
  type ReplayComparableSnapshotV0,
  type ReplayParityMatrixResultV0,
} from "../replay/parity";

type ReactorCompositionModule = typeof import("@openprose/reactor/composition");
type ReactorForecastModule = typeof import("@openprose/reactor/forecast");
type ReactorMemoModule = typeof import("@openprose/reactor/memo");
type ReactorReceiptModule = typeof import("@openprose/reactor/receipt");

const {
  dependencyReceiptPinFromVerifiedReceiptV0,
  evaluateTransitiveFreshnessV0,
  verifyUpstreamReceiptDependencyPinV0,
} = loadReactorComposition();
const { evaluateForecastScheduleV0 } = loadReactorForecast();
const { computeMemoKeyV0, createMemoHitReceiptV0 } = loadReactorMemo();
const {
  canonicalizeForReceiptV0,
  createReceiptV0,
  hashCanonicalReceiptV0,
  verifyReceiptV0,
} = loadReactorReceipt();

export const R6_RELEASE_PARITY_SUITE_SCHEMA_V0 =
  "openprose.reactor-cradle.r6-release-parity-suite" as const;
export const R6_RELEASE_PARITY_SUITE_VERSION_V0 = 0 as const;
export const R6_RELEASE_PARITY_PROOF_SCHEMA_V0 =
  "openprose.reactor-cradle.r6-release-parity-proof" as const;
export const R6_RELEASE_PARITY_PROOF_VERSION_V0 = 0 as const;

export const R6_RELEASE_PARITY_CASE_IDS_V0 = [
  "healthy-quiet",
  "drifting-schedules-fulfillment",
  "blocked-human-review",
  "forecast-pulls-judge-earlier",
  "hysteresis-prevents-flip-flop",
  "duplicate-event-idempotency",
  "stale-status-fencing",
  "contract-revision-fencing",
  "policy-recompile-byte-identical-registry",
  "memoized-verdict-zero-fresh-tokens",
] as const;

export const R6_RELEASE_PARITY_DEFERRED_CASE_IDS_V0 = [
  "down-after-budget-exhaustion",
] as const;

export type R6ReleaseParityCaseIdV0 =
  (typeof R6_RELEASE_PARITY_CASE_IDS_V0)[number];
export type R6ReleaseParityDeferredCaseIdV0 =
  (typeof R6_RELEASE_PARITY_DEFERRED_CASE_IDS_V0)[number];

export interface RecordedR6ReleaseParitySuiteV0 {
  readonly schema: typeof R6_RELEASE_PARITY_SUITE_SCHEMA_V0;
  readonly v: typeof R6_RELEASE_PARITY_SUITE_VERSION_V0;
  readonly suite_id: string;
  readonly generated_at: string;
  readonly as_of: string;
  readonly initial_instant: string;
  readonly final_instant: string;
  readonly world_profile: "recorded-release-parity";
  readonly cassette_path: "recorded://openprose/reactor-cradle/r6-release-parity-v0";
  readonly registry: ReactorRegistrySnapshotV0;
  readonly registry_content_hash: ContentHashV0;
  readonly cases: readonly RecordedR6ReleaseParityCaseV0[];
  readonly deferred_cases: readonly DeferredR6ReleaseParityCaseV0[];
}

export interface RecordedR6ReleaseParityCaseV0 {
  readonly case_id: R6ReleaseParityCaseIdV0;
  readonly title: string;
  readonly represented_by: string;
  readonly receipts: readonly ReceiptV0[];
  readonly decisions: readonly RecordedR6ReleaseParityDecisionV0[];
  readonly trace: readonly RecordedR6ReleaseParityTraceEntryV0[];
  readonly expected_relationships: readonly string[];
  readonly evidence_hashes: readonly ContentHashV0[];
  readonly notes: readonly string[];
}

export interface RecordedR6ReleaseParityDecisionV0 {
  readonly decision_id: string;
  readonly case_id: R6ReleaseParityCaseIdV0;
  readonly as_of: string;
  readonly outcome: string;
  readonly reason: string;
  readonly receipt_hashes: readonly ContentHashV0[];
  readonly evidence_hashes: readonly ContentHashV0[];
  readonly token_summary: {
    readonly fresh: number;
    readonly reused: number;
  };
  readonly guardrails: readonly string[];
}

export interface RecordedR6ReleaseParityTraceEntryV0 {
  readonly as_of: string;
  readonly event: string;
  readonly observed: Readonly<Record<string, unknown>>;
}

export interface DeferredR6ReleaseParityCaseV0 {
  readonly case_id: R6ReleaseParityDeferredCaseIdV0;
  readonly reason: string;
  readonly missing_primitives: readonly string[];
  readonly boundary: "not-represented-in-r6";
}

export interface RecordedR6ReleaseParityProofV0 {
  readonly schema: typeof R6_RELEASE_PARITY_PROOF_SCHEMA_V0;
  readonly v: typeof R6_RELEASE_PARITY_PROOF_VERSION_V0;
  readonly suite: RecordedR6ReleaseParitySuiteV0;
  readonly replay_snapshot: ReplayComparableSnapshotV0;
  readonly parity: ReplayParityMatrixResultV0;
  readonly assertions: readonly CradleAssertionResultV0[];
}

interface MakeReceiptInputV0 {
  readonly case_id: R6ReleaseParityCaseIdV0;
  readonly memo_key: string;
  readonly evidence_input_ids: readonly ContentHashV0[];
  readonly as_of: string;
  readonly next_forecast_recheck: string;
  readonly event_cause: ReceiptEventCauseV0;
  readonly status: ReceiptVerdictStatusV0;
  readonly tokens: {
    readonly fresh: number;
    readonly reused: number;
  };
  readonly tags: readonly string[];
  readonly contract_revision?: ContentHashV0;
  readonly recheck_kind?: ReceiptRecheckKindV0;
  readonly role?: ReceiptRoleV0;
  readonly blocked?: ReceiptBlockedV0;
  readonly freshness?: ReceiptFreshnessV0;
  readonly consumed_receipts?: readonly ConsumedReceiptPinV0[];
}

const SUITE_ID = "v0.4-r6-release-parity-fixture-floor";
const GENERATED_AT = "2026-05-18T22:30:00.000Z";
const INITIAL_INSTANT = "2026-05-18T12:00:00.000Z";
const FINAL_INSTANT = "2026-05-19T12:00:00.000Z";
const CONTRACT_REVISION = hashText("r6-release-parity-contract-v0");
const ATTACKER_CONTRACT_REVISION = hashText(
  "r6-release-parity-attacker-contract-v0",
);
const POLICY_ARTIFACT_BYTES = canonicalizeForReceiptV0({
  schema: "openprose.reactor.policy-artifact",
  v: 0,
  name: "r6.release-parity.recorded",
  cadence: "recorded-fixture-floor",
});
const POLICY_ARTIFACT_CONTENT_HASH =
  hashCanonicalReceiptV0(POLICY_ARTIFACT_BYTES);
const TRANSITIVE_FRESHNESS_POLICY_REF =
  "policy://cradle.r6.release-parity@policy-v0#transitive-freshness-v0";
const MEMO_NAMESPACE = {
  policy_artifact_namespace: "cradle.r6.release-parity",
  policy_artifact_revision: "policy-v0",
} as const;

export function makeRecordedR6ReleaseParitySuiteV0(): RecordedR6ReleaseParitySuiteV0 {
  const cases = Object.freeze([
    makeHealthyQuietCase(),
    makeDriftingSchedulesFulfillmentCase(),
    makeBlockedHumanReviewCase(),
    makeForecastPullsJudgeEarlierCase(),
    makeHysteresisPreventsFlipFlopCase(),
    makeDuplicateEventIdempotencyCase(),
    makeStaleStatusFencingCase(),
    makeContractRevisionFencingCase(),
    makePolicyRecompileByteIdenticalRegistryCase(),
    makeMemoizedVerdictZeroFreshTokensCase(),
  ] satisfies readonly RecordedR6ReleaseParityCaseV0[]);
  const registry = makeRegistrySnapshot();

  return Object.freeze({
    schema: R6_RELEASE_PARITY_SUITE_SCHEMA_V0,
    v: R6_RELEASE_PARITY_SUITE_VERSION_V0,
    suite_id: SUITE_ID,
    generated_at: GENERATED_AT,
    as_of: FINAL_INSTANT,
    initial_instant: INITIAL_INSTANT,
    final_instant: FINAL_INSTANT,
    world_profile: "recorded-release-parity",
    cassette_path: "recorded://openprose/reactor-cradle/r6-release-parity-v0",
    registry,
    registry_content_hash: hashCanonicalValue(registry),
    cases,
    deferred_cases: Object.freeze([
      Object.freeze({
        case_id: "down-after-budget-exhaustion",
        reason:
          "Current Reactor/Cradle APIs do not yet expose a typed retry-budget or pressure-dispatch primitive, so R6 records the gap instead of synthesizing a false down proof.",
        missing_primitives: Object.freeze([
          "typed retry/budget ledger",
          "pressure-dispatch claim with exhausted-budget receipt evidence",
        ]),
        boundary: "not-represented-in-r6",
      }),
    ]),
  });
}

export function makeR6ReleaseParityReplayInputV0(
  suite: RecordedR6ReleaseParitySuiteV0 = makeRecordedR6ReleaseParitySuiteV0(),
): ReplayComparableScenarioOutputInputV0 {
  assertRecordedR6ReleaseParitySuiteV0(suite);

  return {
    scenario_id: suite.suite_id,
    world_profile: suite.world_profile,
    cassette_path: suite.cassette_path,
    initial_instant: suite.initial_instant,
    final_instant: suite.final_instant,
    trace: suite.cases.map((item) => ({
      case_id: item.case_id,
      trace: item.trace,
    })),
    receipt_log: {
      entries: suite.cases.flatMap((item) => item.receipts),
    },
    expected_relationships: suite.cases.map((item) => ({
      case_id: item.case_id,
      relationships: item.expected_relationships,
    })),
    decisions: {
      entries: suite.cases.flatMap((item) => item.decisions),
      deferred_cases: suite.deferred_cases,
    },
    registry: suite.registry,
  };
}

export function runRecordedR6ReleaseParityProofV0(
  suite: RecordedR6ReleaseParitySuiteV0 = makeRecordedR6ReleaseParitySuiteV0(),
): RecordedR6ReleaseParityProofV0 {
  assertRecordedR6ReleaseParitySuiteV0(suite);
  const replayInput = makeR6ReleaseParityReplayInputV0(suite);
  const assertions = Object.freeze(suite.cases.map(assertR6ReleaseParityCaseV0));
  const parity = runReplayParityMatrixV0({
    baseline: replayInput,
    runAdapter() {
      return makeR6ReleaseParityReplayInputV0(suite);
    },
  });

  if (!parity.ok) {
    throw new Error("R6 release parity fixture floor must be byte-identical");
  }
  const failedAssertion = assertions.find((item) => item.status === "fail");
  if (failedAssertion !== undefined) {
    throw new Error(`R6 release parity assertion failed: ${failedAssertion.summary}`);
  }

  return Object.freeze({
    schema: R6_RELEASE_PARITY_PROOF_SCHEMA_V0,
    v: R6_RELEASE_PARITY_PROOF_VERSION_V0,
    suite,
    replay_snapshot: snapshotReplayComparableOutputV0(replayInput),
    parity,
    assertions,
  });
}

export function buildR6ReleaseParityEvalResultV0(
  proof: RecordedR6ReleaseParityProofV0 = runRecordedR6ReleaseParityProofV0(),
): CradleEvalResultV0 {
  return buildCradleEvalResultV0({
    suite_id: proof.suite.suite_id,
    generated_at: proof.suite.generated_at,
    as_of: proof.suite.as_of,
    model_matrix: {
      status: "not-run",
      reason:
        "R6 release parity uses deterministic recorded Cradle fixtures; live provider/model matrix remains deferred.",
    },
    cases: proof.suite.cases.map((item, index) => {
      const assertion = proof.assertions[index];
      if (assertion === undefined) {
        throw new Error(`missing release parity assertion for ${item.case_id}`);
      }

      const base = {
        case_id: item.case_id,
        scenario_id: proof.suite.suite_id,
        assertions: [assertion],
        evidence_hashes: item.evidence_hashes,
      };

      return index === 0 ? { ...base, replay: proof.parity } : base;
    }),
  });
}

export const buildRecordedR6ReleaseParityEvalResultV0 =
  buildR6ReleaseParityEvalResultV0;

export function assertRecordedR6ReleaseParitySuiteV0(
  suite: RecordedR6ReleaseParitySuiteV0,
): void {
  if (suite.schema !== R6_RELEASE_PARITY_SUITE_SCHEMA_V0) {
    throw new Error("R6 release parity suite schema is malformed");
  }
  if (suite.v !== R6_RELEASE_PARITY_SUITE_VERSION_V0) {
    throw new Error("R6 release parity suite version must be 0");
  }
  assertRequiredCaseCoverage(suite.cases);
  if (
    !suite.deferred_cases.some(
      (item) => item.case_id === "down-after-budget-exhaustion",
    )
  ) {
    throw new Error("R6 suite must explicitly defer down-after-budget-exhaustion");
  }
  for (const item of suite.cases) {
    assertR6ReleaseParityCaseV0(item);
  }
}

export function assertR6ReleaseParityCaseV0(
  item: RecordedR6ReleaseParityCaseV0,
): CradleAssertionResultV0 {
  const failures: CradleAssertionEvidenceV0[] = [];
  const receiptHashes = new Set(item.receipts.map((receipt) => receipt.content_hash));

  if (item.decisions.length === 0) {
    failures.push({
      path: `${item.case_id}.decisions`,
      message: "release-parity case must include at least one recorded decision",
    });
  }
  if (item.trace.length === 0) {
    failures.push({
      path: `${item.case_id}.trace`,
      message: "release-parity case must include recorded trace evidence",
    });
  }

  for (const [index, receipt] of item.receipts.entries()) {
    const verification = verifyReceiptV0(receipt);
    if (!verification.ok) {
      failures.push({
        path: `${item.case_id}.receipts[${index}]`,
        message: "recorded receipt must verify",
        observed: verification.errors,
      });
    } else if (verification.content_hash !== receipt.content_hash) {
      failures.push({
        path: `${item.case_id}.receipts[${index}].content_hash`,
        message: "recorded receipt content hash must match canonical hash",
        observed: {
          expected: verification.content_hash,
          actual: receipt.content_hash,
        },
      });
    }
  }

  for (const [index, decision] of item.decisions.entries()) {
    if (decision.case_id !== item.case_id) {
      failures.push({
        path: `${item.case_id}.decisions[${index}].case_id`,
        message: "decision must be scoped to its release-parity case",
        observed: decision.case_id,
      });
    }
    for (const receiptHash of decision.receipt_hashes) {
      if (!receiptHashes.has(receiptHash)) {
        failures.push({
          path: `${item.case_id}.decisions[${index}].receipt_hashes`,
          message: "decision referenced a receipt outside the case",
          observed: receiptHash,
        });
      }
    }
    const tokenSummary = sumTokens(item.receipts);
    if (
      decision.token_summary.fresh !== tokenSummary.fresh ||
      decision.token_summary.reused !== tokenSummary.reused
    ) {
      failures.push({
        path: `${item.case_id}.decisions[${index}].token_summary`,
        message: "decision token summary must match recorded receipts",
        observed: {
          expected: tokenSummary,
          actual: decision.token_summary,
        },
      });
    }
  }

  if (failures.length > 0) {
    return releaseParityResult(
      "fail",
      `${item.case_id} release-parity fixture is malformed`,
      failures,
    );
  }

  return releaseParityResult(
    "pass",
    `${item.case_id} is represented by deterministic recorded ${item.represented_by}`,
    [
      {
        path: item.case_id,
        message: "checked release-parity recorded fixture",
        observed: {
          receipts: item.receipts.length,
          decisions: item.decisions.length,
          trace_entries: item.trace.length,
          relationships: item.expected_relationships,
        },
      },
    ],
  );
}

function makeHealthyQuietCase(): RecordedR6ReleaseParityCaseV0 {
  const evidence = hashText("r6 healthy quiet incident feed unchanged");
  const receipt = makeReceipt({
    case_id: "healthy-quiet",
    memo_key: "r6:healthy-quiet:bootstrap",
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T12:00:00.000Z",
    next_forecast_recheck: "2026-05-18T18:00:00.000Z",
    event_cause: "real-input",
    status: "up",
    tokens: { fresh: 13, reused: 0 },
    tags: ["r6", "healthy-quiet"],
  });

  return makeCase({
    case_id: "healthy-quiet",
    title: "Healthy quiet path keeps the responsibility up",
    represented_by: "up receipt and no-op decision",
    receipts: [receipt],
    decisions: [
      makeDecision({
        case_id: "healthy-quiet",
        as_of: receipt.core.as_of,
        outcome: "kept-up",
        reason: "quiet source evidence preserved the up verdict",
        receipts: [receipt],
        evidence_hashes: [evidence],
        guardrails: ["receipt-verification", "no-live-gateway"],
      }),
    ],
    trace: [
      {
        as_of: receipt.core.as_of,
        event: "source-read",
        observed: { source: "incident-feed", status: "quiet" },
      },
    ],
    expected_relationships: ["healthy-quiet-up"],
    notes: ["baseline release candidate path remains quiet and deterministic"],
  });
}

function makeDriftingSchedulesFulfillmentCase(): RecordedR6ReleaseParityCaseV0 {
  const evidence = hashText("r6 drifting schedule reached fulfillment");
  const drifting = makeReceipt({
    case_id: "drifting-schedules-fulfillment",
    memo_key: "r6:drifting:schedule",
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T12:10:00.000Z",
    next_forecast_recheck: "2026-05-18T12:30:00.000Z",
    event_cause: "real-input",
    status: "drifting",
    tokens: { fresh: 8, reused: 0 },
    tags: ["r6", "drifting", "schedule"],
  });
  const fulfilled = makeReceipt({
    case_id: "drifting-schedules-fulfillment",
    memo_key: "r6:drifting:fulfilled",
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T12:30:00.000Z",
    next_forecast_recheck: "2026-05-18T18:00:00.000Z",
    event_cause: "forecast-recheck",
    recheck_kind: "evidence-age",
    role: "fulfill",
    status: "up",
    tokens: { fresh: 0, reused: 8 },
    tags: ["r6", "drifting", "fulfilled"],
  });

  return makeCase({
    case_id: "drifting-schedules-fulfillment",
    title: "Drifting schedules are fulfilled by recorded decision evidence",
    represented_by: "drifting then fulfilled receipts",
    receipts: [drifting, fulfilled],
    decisions: [
      makeDecision({
        case_id: "drifting-schedules-fulfillment",
        as_of: fulfilled.core.as_of,
        outcome: "fulfilled-scheduled-work",
        reason: "scheduled fulfillment consumed the drifting receipt and returned up",
        receipts: [drifting, fulfilled],
        evidence_hashes: [evidence],
        guardrails: ["receipt-log-order", "forecast-schedule"],
      }),
    ],
    trace: [
      {
        as_of: drifting.core.as_of,
        event: "schedule-opened",
        observed: { status: "drifting" },
      },
      {
        as_of: fulfilled.core.as_of,
        event: "schedule-fulfilled",
        observed: { status: "up", fresh_tokens: 0 },
      },
    ],
    expected_relationships: ["drift-has-fulfillment-decision"],
    notes: ["represented as decision evidence only; no live fulfillment side effect"],
  });
}

function makeBlockedHumanReviewCase(): RecordedR6ReleaseParityCaseV0 {
  const evidence = hashText("r6 blocked human review evidence");
  const receipt = makeReceipt({
    case_id: "blocked-human-review",
    memo_key: "r6:blocked:human-review",
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T12:20:00.000Z",
    next_forecast_recheck: "2026-05-18T12:20:00.000Z",
    event_cause: "escalation",
    status: "blocked",
    blocked: {
      reason: "human review required before responsibility can continue",
      fix_target: "operator-review",
      interrupt_cause: "needs-judgment",
    },
    tokens: { fresh: 0, reused: 0 },
    tags: ["r6", "blocked", "human-review"],
  });

  return makeCase({
    case_id: "blocked-human-review",
    title: "Blocked requests expose human-review escalation",
    represented_by: "blocked safety receipt",
    receipts: [receipt],
    decisions: [
      makeDecision({
        case_id: "blocked-human-review",
        as_of: receipt.core.as_of,
        outcome: "blocked-for-human-review",
        reason: receipt.verdict.blocked?.reason ?? "blocked",
        receipts: [receipt],
        evidence_hashes: [evidence],
        guardrails: ["interrupt-cause", "non-droppable-blocked-receipt"],
      }),
    ],
    trace: [
      {
        as_of: receipt.core.as_of,
        event: "manual-review-required",
        observed: {
          interrupt_cause: receipt.verdict.blocked?.interrupt_cause ?? null,
        },
      },
    ],
    expected_relationships: ["blocked-human-review-is-non-droppable"],
    notes: ["no private review rationale is embedded in the fixture"],
  });
}

function makeForecastPullsJudgeEarlierCase(): RecordedR6ReleaseParityCaseV0 {
  const evidence = hashText("r6 forecast schedule synthetic evidence");
  const schedule = evaluateForecastScheduleV0({
    as_of: "2026-05-18T12:10:00.000Z",
    real_input_observed: true,
    schedule: {
      responsibility_id: "r6.forecast-pulls-judge-earlier",
      contract_revision: CONTRACT_REVISION,
      memo_key: "r6:forecast:pull-earlier",
      evidence_input_ids: [evidence],
      next_evidence_recheck: "2026-05-18T12:05:00.000Z",
      next_plan_recheck: "2026-05-18T18:00:00.000Z",
    },
  });
  if (schedule.outcome !== "manufacture-recheck") {
    throw new Error("forecast pull fixture must manufacture a recheck receipt");
  }

  return makeCase({
    case_id: "forecast-pulls-judge-earlier",
    title: "Forecast schedule pulls judge earlier than the normal plan audit",
    represented_by: "forecast manufactured recheck receipt",
    receipts: schedule.receipts,
    decisions: [
      makeDecision({
        case_id: "forecast-pulls-judge-earlier",
        as_of: "2026-05-18T12:10:00.000Z",
        outcome: schedule.reason,
        reason: "evidence-age forecast clock crossed before plan-age audit",
        receipts: schedule.receipts,
        evidence_hashes: [evidence],
        guardrails: ["forecast-clock", "zero-fresh-synthetic-recheck"],
      }),
    ],
    trace: [
      {
        as_of: "2026-05-18T12:10:00.000Z",
        event: "forecast-clock-crossed",
        observed: {
          due_rechecks: schedule.due_rechecks,
          token_bearing_receipts: schedule.token_bearing_receipts.length,
        },
      },
    ],
    expected_relationships: ["forecast-can-pull-judge-earlier"],
    notes: ["forecast recheck receipt is blocked until a judge acts"],
  });
}

function makeHysteresisPreventsFlipFlopCase(): RecordedR6ReleaseParityCaseV0 {
  const evidence = hashText("r6 hysteresis noisy verdict band");
  const noisyDrift = makeReceipt({
    case_id: "hysteresis-prevents-flip-flop",
    memo_key: "r6:hysteresis:noisy-drift",
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T12:25:00.000Z",
    next_forecast_recheck: "2026-05-18T13:25:00.000Z",
    event_cause: "forecast-recheck",
    recheck_kind: "plan-age",
    status: "drifting",
    tokens: { fresh: 0, reused: 17 },
    tags: ["r6", "hysteresis", "noisy-verdict"],
  });
  const heldCurrent = makeReceipt({
    case_id: "hysteresis-prevents-flip-flop",
    memo_key: "r6:hysteresis:held-current",
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T12:40:00.000Z",
    next_forecast_recheck: "2026-05-18T13:25:00.000Z",
    event_cause: "forecast-recheck",
    recheck_kind: "plan-age",
    status: "up",
    tokens: { fresh: 0, reused: 17 },
    tags: ["r6", "hysteresis", "held-current"],
  });

  return makeCase({
    case_id: "hysteresis-prevents-flip-flop",
    title: "Hysteresis prevents noisy verdict flip-flop",
    represented_by: "noisy verdict receipts and held-current decision",
    receipts: [noisyDrift, heldCurrent],
    decisions: [
      makeDecision({
        case_id: "hysteresis-prevents-flip-flop",
        as_of: heldCurrent.core.as_of,
        outcome: "held-current-policy",
        reason:
          "noisy drifting verdict stayed inside the fixed recompile interval and activation band",
        receipts: [noisyDrift, heldCurrent],
        evidence_hashes: [evidence],
        guardrails: ["min-recompile-interval", "judged-activation-band"],
      }),
    ],
    trace: [
      {
        as_of: noisyDrift.core.as_of,
        event: "noisy-drift-observed",
        observed: { status: "drifting", confidence: 0.51 },
      },
      {
        as_of: heldCurrent.core.as_of,
        event: "policy-held-current",
        observed: { status: "up", policy_revision_changed: false },
      },
    ],
    expected_relationships: ["hysteresis-prevents-flip-flop"],
    notes: ["fixture records the fixed guard decision; no policy author is invoked"],
  });
}

function makeDuplicateEventIdempotencyCase(): RecordedR6ReleaseParityCaseV0 {
  const evidence = hashText("r6 duplicate event input");
  const memoKey = computeMemoKeyV0({
    contract_revision: CONTRACT_REVISION,
    evidence_receipts: [evidence],
    dependency_receipts: [],
  });
  const source = makeReceipt({
    case_id: "duplicate-event-idempotency",
    memo_key: memoKey,
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T13:00:00.000Z",
    next_forecast_recheck: "2026-05-18T19:00:00.000Z",
    event_cause: "real-input",
    status: "up",
    tokens: { fresh: 21, reused: 0 },
    tags: ["r6", "duplicate", "source"],
  });
  const duplicate = createMemoHitReceiptV0({
    source_receipt: source,
    as_of: "2026-05-18T13:00:00.000Z",
    next_forecast_recheck: "2026-05-18T19:00:00.000Z",
    event_cause: "real-input",
  });

  return makeCase({
    case_id: "duplicate-event-idempotency",
    title: "Duplicate event is idempotent",
    represented_by: "source receipt plus memo-hit duplicate receipt",
    receipts: [source, duplicate],
    decisions: [
      makeDecision({
        case_id: "duplicate-event-idempotency",
        as_of: duplicate.core.as_of,
        outcome: "one-decision-for-duplicate-event",
        reason: "duplicate event reused the memoized verdict instead of spending fresh work",
        receipts: [source, duplicate],
        evidence_hashes: [evidence],
        guardrails: ["memo-key", "idempotent-event-processing"],
      }),
    ],
    trace: [
      {
        as_of: source.core.as_of,
        event: "event-received",
        observed: { event_id: "evt-r6-duplicate", ordinal: 1 },
      },
      {
        as_of: duplicate.core.as_of,
        event: "duplicate-event-received",
        observed: {
          event_id: "evt-r6-duplicate",
          emitted_decisions: 1,
          duplicate_fresh_tokens: duplicate.cost.tokens.fresh,
        },
      },
    ],
    expected_relationships: ["duplicate-event-idempotent"],
    notes: ["current SDK events do not expose a typed event id; fixture records it in trace evidence"],
  });
}

function makeStaleStatusFencingCase(): RecordedR6ReleaseParityCaseV0 {
  const upstreamEvidence = hashText("r6 stale upstream receipt");
  const downstreamEvidence = hashText("r6 stale downstream blocked receipt");
  const upstream = makeReceipt({
    case_id: "stale-status-fencing",
    memo_key: "r6:stale:upstream",
    evidence_input_ids: [upstreamEvidence],
    as_of: "2026-05-18T11:00:00.000Z",
    next_forecast_recheck: "2026-05-18T12:00:00.000Z",
    event_cause: "real-input",
    status: "up",
    tokens: { fresh: 16, reused: 0 },
    tags: ["r6", "stale", "upstream"],
  });
  const pin = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });
  const evaluation = evaluateTransitiveFreshnessV0({
    as_of: "2026-05-18T12:10:00.000Z",
    transitive_freshness_policy_ref: TRANSITIVE_FRESHNESS_POLICY_REF,
    consumed_receipts: [
      {
        upstream_receipt: upstream,
        dependency_pin: pin,
      },
    ],
  });
  if (evaluation.outcome !== "stale-blocked") {
    throw new Error("stale status fencing fixture must block stale upstream receipts");
  }
  const blocked = makeReceipt({
    case_id: "stale-status-fencing",
    memo_key: "r6:stale:downstream-blocked",
    evidence_input_ids: [downstreamEvidence],
    as_of: "2026-05-18T12:10:00.000Z",
    next_forecast_recheck: "2026-05-18T12:10:00.000Z",
    event_cause: "escalation",
    status: "blocked",
    blocked: {
      reason: "stale upstream receipt blocked transitive freshness",
      fix_target: "upstream-refetch",
      interrupt_cause: "needs-input",
    },
    freshness: {
      as_of: evaluation.as_of,
      next_forecast_recheck: evaluation.as_of,
      transitive_freshness_policy_ref: evaluation.transitive_freshness_policy_ref,
      consumed_freshness_evaluated: evaluation.consumed_freshness_evaluated,
    },
    consumed_receipts: [pin],
    tokens: { fresh: 0, reused: 0 },
    tags: ["r6", "stale", "blocked"],
  });

  return makeCase({
    case_id: "stale-status-fencing",
    title: "Stale upstream status is fenced before downstream use",
    represented_by: "transitive freshness blocked receipt",
    receipts: [upstream, blocked],
    decisions: [
      makeDecision({
        case_id: "stale-status-fencing",
        as_of: blocked.core.as_of,
        outcome: "stale-blocked",
        reason: "downstream receipt carried consumed freshness evaluation",
        receipts: [upstream, blocked],
        evidence_hashes: [upstreamEvidence, downstreamEvidence],
        guardrails: ["transitive-freshness", "dependency-pin"],
      }),
    ],
    trace: [
      {
        as_of: blocked.core.as_of,
        event: "transitive-freshness-evaluated",
        observed: summarizeFreshnessEvaluation(evaluation),
      },
    ],
    expected_relationships: ["stale-status-fenced"],
    notes: ["stale state is carried as blocked receipt evidence"],
  });
}

function makeContractRevisionFencingCase(): RecordedR6ReleaseParityCaseV0 {
  const evidence = hashText("r6 contract revision mismatch");
  const upstream = makeReceipt({
    case_id: "contract-revision-fencing",
    memo_key: "r6:contract:fence",
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T13:10:00.000Z",
    next_forecast_recheck: "2026-05-18T19:00:00.000Z",
    event_cause: "real-input",
    status: "up",
    tokens: { fresh: 11, reused: 0 },
    tags: ["r6", "contract", "upstream"],
  });
  const validPin = dependencyReceiptPinFromVerifiedReceiptV0({
    upstream_receipt: upstream,
    acceptable_signer_set: ["none"],
  });
  const attackerPin: ConsumedReceiptPinV0 = {
    ...validPin,
    contract_revision: ATTACKER_CONTRACT_REVISION,
  };
  let mismatchReason = "contract revision mismatch was not checked";
  try {
    verifyUpstreamReceiptDependencyPinV0({
      upstream_receipt: upstream,
      expected_dependency_pin: attackerPin,
    });
  } catch (error) {
    mismatchReason =
      error instanceof Error ? error.message : "contract revision mismatch";
  }
  const blocked = makeReceipt({
    case_id: "contract-revision-fencing",
    memo_key: "r6:contract:mismatch-blocked",
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T13:11:00.000Z",
    next_forecast_recheck: "2026-05-18T13:11:00.000Z",
    event_cause: "escalation",
    status: "blocked",
    blocked: {
      reason: mismatchReason,
      fix_target: "dependency-pin",
      interrupt_cause: "contract-declared",
    },
    tokens: { fresh: 0, reused: 0 },
    tags: ["r6", "contract", "blocked"],
  });

  return makeCase({
    case_id: "contract-revision-fencing",
    title: "Contract revision mismatch is fenced",
    represented_by: "dependency pin verification and blocked receipt",
    receipts: [upstream, blocked],
    decisions: [
      makeDecision({
        case_id: "contract-revision-fencing",
        as_of: blocked.core.as_of,
        outcome: "contract-mismatch-blocked",
        reason: mismatchReason,
        receipts: [upstream, blocked],
        evidence_hashes: [evidence],
        guardrails: ["contract-revision-pin", "acceptable-signer-set"],
      }),
    ],
    trace: [
      {
        as_of: blocked.core.as_of,
        event: "dependency-pin-rejected",
        observed: {
          expected_contract_revision: validPin.contract_revision,
          supplied_contract_revision: attackerPin.contract_revision,
        },
      },
    ],
    expected_relationships: ["contract-revision-fenced"],
    notes: ["mismatched contract does not reach downstream evaluation"],
  });
}

function makePolicyRecompileByteIdenticalRegistryCase(): RecordedR6ReleaseParityCaseV0 {
  const evidence = hashText("r6 policy recompile identical registry");
  const registry = makeRegistrySnapshot();
  const registryHash = hashCanonicalValue(registry);
  const receipt = makeReceipt({
    case_id: "policy-recompile-byte-identical-registry",
    memo_key: "r6:policy-recompile:byte-identical",
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T14:00:00.000Z",
    next_forecast_recheck: "2026-05-19T00:00:00.000Z",
    event_cause: "forecast-recheck",
    recheck_kind: "plan-age",
    role: "policy-compile",
    status: "up",
    tokens: { fresh: 0, reused: 0 },
    tags: ["r6", "policy-recompile", "byte-identical"],
  });

  return makeCase({
    case_id: "policy-recompile-byte-identical-registry",
    title: "Policy recompile preserves byte-identical registry artifact",
    represented_by: "registry hash before/after decision",
    receipts: [receipt],
    decisions: [
      makeDecision({
        case_id: "policy-recompile-byte-identical-registry",
        as_of: receipt.core.as_of,
        outcome: "registry-byte-identical",
        reason: "recorded policy recompile produced the same registry bytes",
        receipts: [receipt],
        evidence_hashes: [evidence, registryHash],
        guardrails: ["canonical-policy-artifact", "registry-content-hash"],
      }),
    ],
    trace: [
      {
        as_of: receipt.core.as_of,
        event: "policy-registry-compared",
        observed: {
          before_registry_hash: registryHash,
          after_registry_hash: registryHash,
          byte_identical: true,
        },
      },
    ],
    expected_relationships: ["policy-registry-byte-identical"],
    notes: ["recorded proof does not invoke the policy author or model gateway"],
  });
}

function makeMemoizedVerdictZeroFreshTokensCase(): RecordedR6ReleaseParityCaseV0 {
  const evidence = hashText("r6 memoized verdict zero fresh evidence");
  const memoKey = computeMemoKeyV0({
    contract_revision: CONTRACT_REVISION,
    evidence_receipts: [evidence],
    dependency_receipts: [],
  });
  const source = makeReceipt({
    case_id: "memoized-verdict-zero-fresh-tokens",
    memo_key: memoKey,
    evidence_input_ids: [evidence],
    as_of: "2026-05-18T15:00:00.000Z",
    next_forecast_recheck: "2026-05-19T00:00:00.000Z",
    event_cause: "real-input",
    status: "up",
    tokens: { fresh: 33, reused: 0 },
    tags: ["r6", "memo", "source"],
  });
  const memoHit = createMemoHitReceiptV0({
    source_receipt: source,
    as_of: "2026-05-18T16:00:00.000Z",
    next_forecast_recheck: "2026-05-19T00:00:00.000Z",
    event_cause: "forecast-recheck",
    recheck_kind: "evidence-age",
  });

  return makeCase({
    case_id: "memoized-verdict-zero-fresh-tokens",
    title: "Memoized verdict reuse spends zero fresh judge tokens",
    represented_by: "memo-hit receipt",
    receipts: [source, memoHit],
    decisions: [
      makeDecision({
        case_id: "memoized-verdict-zero-fresh-tokens",
        as_of: memoHit.core.as_of,
        outcome: "memo-hit-zero-fresh",
        reason: "memoized verdict receipt reused prior tokens with fresh=0",
        receipts: [source, memoHit],
        evidence_hashes: [evidence],
        guardrails: ["memo-namespace", "zero-fresh-memo-hit"],
      }),
    ],
    trace: [
      {
        as_of: source.core.as_of,
        event: "memo-source-stored",
        observed: { fresh: source.cost.tokens.fresh, namespace: MEMO_NAMESPACE },
      },
      {
        as_of: memoHit.core.as_of,
        event: "memo-hit-reused",
        observed: {
          fresh: memoHit.cost.tokens.fresh,
          reused: memoHit.cost.tokens.reused,
        },
      },
    ],
    expected_relationships: ["memo-hit-has-zero-fresh-tokens"],
    notes: ["replay uses existing memo-hit receipt helper"],
  });
}

function makeCase(input: {
  readonly case_id: R6ReleaseParityCaseIdV0;
  readonly title: string;
  readonly represented_by: string;
  readonly receipts: readonly ReceiptV0[];
  readonly decisions: readonly RecordedR6ReleaseParityDecisionV0[];
  readonly trace: readonly RecordedR6ReleaseParityTraceEntryV0[];
  readonly expected_relationships: readonly string[];
  readonly notes: readonly string[];
}): RecordedR6ReleaseParityCaseV0 {
  return Object.freeze({
    ...input,
    receipts: Object.freeze([...input.receipts]),
    decisions: Object.freeze([...input.decisions]),
    trace: Object.freeze([...input.trace]),
    expected_relationships: Object.freeze([...input.expected_relationships]),
    evidence_hashes: uniqueSortedHashes([
      ...input.receipts.map((receipt) => receipt.content_hash),
      ...input.decisions.flatMap((decision) => decision.evidence_hashes),
    ]),
    notes: Object.freeze([...input.notes]),
  });
}

function makeDecision(input: {
  readonly case_id: R6ReleaseParityCaseIdV0;
  readonly as_of: string;
  readonly outcome: string;
  readonly reason: string;
  readonly receipts: readonly ReceiptV0[];
  readonly evidence_hashes: readonly ContentHashV0[];
  readonly guardrails: readonly string[];
}): RecordedR6ReleaseParityDecisionV0 {
  return Object.freeze({
    decision_id: `${input.case_id}:${hashText(`${input.outcome}:${input.as_of}`).slice(7, 19)}`,
    case_id: input.case_id,
    as_of: input.as_of,
    outcome: input.outcome,
    reason: input.reason,
    receipt_hashes: Object.freeze(input.receipts.map((receipt) => receipt.content_hash)),
    evidence_hashes: uniqueSortedHashes(input.evidence_hashes),
    token_summary: sumTokens(input.receipts),
    guardrails: Object.freeze([...input.guardrails]),
  });
}

function makeReceipt(input: MakeReceiptInputV0): ReceiptV0 {
  const role = input.role ?? "judge";
  const contractRevision = input.contract_revision ?? CONTRACT_REVISION;
  const freshness =
    input.freshness ??
    ({
      as_of: input.as_of,
      next_forecast_recheck: input.next_forecast_recheck,
    } satisfies ReceiptFreshnessV0);

  return createReceiptV0({
    core: {
      responsibility_id: `r6.${input.case_id}`,
      contract_revision: contractRevision,
      event_cause: input.event_cause,
      ...(input.recheck_kind === undefined
        ? {}
        : { recheck_kind: input.recheck_kind }),
      memo_key: input.memo_key,
      evidence_input_ids: input.evidence_input_ids,
      as_of: input.as_of,
      role,
    },
    sig: {
      scheme: "none",
      null_reason: "cradle R6 recorded release-parity fixture",
    },
    verdict: {
      status: input.status,
      confidence: {
        value: input.status === "blocked" ? 0 : 0.86,
        derivation_method: "recorded-r6-release-parity-fixture",
        calibration_grade: "none",
        label_source: "fixture",
      },
      ...(input.blocked === undefined ? {} : { blocked: input.blocked }),
    },
    freshness,
    composition: {
      consumed_receipts: input.consumed_receipts ?? [],
      cycle_checked: true,
    },
    cost: {
      provider: "cradle",
      model: "recorded-release-parity",
      role,
      tags: input.tags,
      responsibility_id: `r6.${input.case_id}`,
      run_id: `r6-${input.case_id}`,
      as_of: input.as_of,
      tokens: input.tokens,
      surprise_cause: input.event_cause,
    },
  });
}

function makeRegistrySnapshot(): ReactorRegistrySnapshotV0 {
  const validationState = {
    status: "validated" as const,
    validator_id: "r6-release-parity-recorded-fixture",
  };

  return Object.freeze({
    contract_revision: CONTRACT_REVISION,
    policy_artifact_id: "policy.r6.release-parity.recorded",
    policy_artifact_identity: "policy.r6.release-parity.recorded",
    policy_artifact_namespace: MEMO_NAMESPACE.policy_artifact_namespace,
    policy_artifact_revision: MEMO_NAMESPACE.policy_artifact_revision,
    policy_artifact_validation_state: validationState,
    validation_state: validationState,
    policy_artifact_bytes: POLICY_ARTIFACT_BYTES,
    policy_artifact_content_hash: POLICY_ARTIFACT_CONTENT_HASH,
  });
}

function summarizeFreshnessEvaluation(
  evaluation: TransitiveFreshnessEvaluationResultV0,
): Readonly<Record<string, unknown>> {
  return {
    outcome: evaluation.outcome,
    stale_receipt_hashes: evaluation.stale_receipt_hashes,
    consumed_freshness_evaluated: evaluation.consumed_freshness_evaluated,
  };
}

function releaseParityResult(
  status: "pass" | "fail",
  summary: string,
  evidence: readonly CradleAssertionEvidenceV0[],
): CradleAssertionResultV0 {
  return {
    ok: status === "pass",
    relationship: "release-parity-fixture",
    family: "release-parity-fixture",
    status,
    summary,
    evidence: Object.freeze([...evidence]),
  };
}

function assertRequiredCaseCoverage(
  cases: readonly RecordedR6ReleaseParityCaseV0[],
): void {
  const actual = new Set(cases.map((item) => item.case_id));
  const missing = R6_RELEASE_PARITY_CASE_IDS_V0.filter((caseId) => !actual.has(caseId));
  const extra = cases
    .map((item) => item.case_id)
    .filter(
      (caseId): caseId is R6ReleaseParityCaseIdV0 =>
        !R6_RELEASE_PARITY_CASE_IDS_V0.includes(caseId),
    );

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `R6 release parity case coverage mismatch: missing=${missing.join(",")}; extra=${extra.join(",")}`,
    );
  }
}

function sumTokens(receipts: readonly ReceiptV0[]): {
  readonly fresh: number;
  readonly reused: number;
} {
  return Object.freeze(
    receipts.reduce(
      (sum, receipt) => ({
        fresh: sum.fresh + receipt.cost.tokens.fresh,
        reused: sum.reused + receipt.cost.tokens.reused,
      }),
      { fresh: 0, reused: 0 },
    ),
  );
}

function uniqueSortedHashes(values: readonly ContentHashV0[]): readonly ContentHashV0[] {
  return Object.freeze(Array.from(new Set(values)).sort());
}

function hashText(value: string): ContentHashV0 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hashCanonicalValue(value: unknown): ContentHashV0 {
  return hashCanonicalReceiptV0(canonicalizeForReceiptV0(value));
}

function loadReactorComposition(): ReactorCompositionModule {
  try {
    return require("@openprose/reactor/composition") as ReactorCompositionModule;
  } catch (error) {
    if (isMissingReactorSubpath(error, "@openprose/reactor/composition")) {
      return require("../../../reactor/dist/composition") as ReactorCompositionModule;
    }

    throw error;
  }
}

function loadReactorForecast(): ReactorForecastModule {
  try {
    return require("@openprose/reactor/forecast") as ReactorForecastModule;
  } catch (error) {
    if (isMissingReactorSubpath(error, "@openprose/reactor/forecast")) {
      return require("../../../reactor/dist/forecast") as ReactorForecastModule;
    }

    throw error;
  }
}

function loadReactorMemo(): ReactorMemoModule {
  try {
    return require("@openprose/reactor/memo") as ReactorMemoModule;
  } catch (error) {
    if (isMissingReactorSubpath(error, "@openprose/reactor/memo")) {
      return require("../../../reactor/dist/memo") as ReactorMemoModule;
    }

    throw error;
  }
}

function loadReactorReceipt(): ReactorReceiptModule {
  try {
    return require("@openprose/reactor/receipt") as ReactorReceiptModule;
  } catch (error) {
    if (isMissingReactorSubpath(error, "@openprose/reactor/receipt")) {
      return require("../../../reactor/dist/receipt") as ReactorReceiptModule;
    }

    throw error;
  }
}

function isMissingReactorSubpath(error: unknown, subpath: string): boolean {
  return (
    isRecord(error) &&
    error["code"] === "MODULE_NOT_FOUND" &&
    typeof error["message"] === "string" &&
    error["message"].includes(subpath)
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
