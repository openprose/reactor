import { createHash } from "node:crypto";

import type {
  ContentHashV0,
  ReceiptEventCauseV0,
  ReceiptRecheckKindV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";

import type { ScenarioRunReceiptV0 } from "../../scenario/types";

export const NO_MEMO_BASELINE_SUMMARY_SCHEMA_V0 =
  "openprose.reactor-cradle.baseline.no-memo-summary" as const;
export const NO_MEMO_BASELINE_SUMMARY_VERSION_V0 = 0 as const;
export const NO_MEMO_BASELINE_VARIANT_V0 = "reactor-no-memo" as const;
export const NO_MEMO_BASELINE_SCENARIO_ID_V0 =
  "incident-briefing-static-zero" as const;
export const NO_MEMO_BASELINE_WORLD_PROFILE_V0 = "static" as const;
export const NO_MEMO_BASELINE_CASSETTE_PATH_V0 =
  "./c2-static-zero.model-cassette.json" as const;
export const NO_MEMO_BASELINE_SOURCE_FIXTURE_V0 =
  "src/__tests__/fixtures/c2-static-zero.scenario" as const;
export const NO_MEMO_BASELINE_GENERATED_AT_V0 =
  "2026-05-20T00:00:00.000Z" as const;

export type NoMemoBaselineSummaryTypeV0 =
  "runtime-derived-static-no-memo-replay";
export type NoMemoBaselineRuntimeEquivalentV0 =
  | "model-invocation-equivalent"
  | "memo-hit-equivalent";
export type NoMemoBaselineOutcomeV0 = "fresh-judge";

export interface NoMemoBaselineTokensV0 {
  readonly fresh: number;
  readonly reused: number;
  readonly total: number;
}

export interface NoMemoBaselineRatioV0 {
  readonly fresh: number;
  readonly reused: number;
  readonly label: string;
  readonly reused_is_zero: boolean;
}

export interface NoMemoBaselineScenarioV0 {
  readonly id: typeof NO_MEMO_BASELINE_SCENARIO_ID_V0;
  readonly profile: typeof NO_MEMO_BASELINE_WORLD_PROFILE_V0;
  readonly initial_instant: string;
  readonly final_instant: string;
  readonly source_fixture: string;
  readonly cassette_path: typeof NO_MEMO_BASELINE_CASSETTE_PATH_V0;
  readonly scenario_script_turn_count: number;
}

export interface NoMemoBaselineTurnV0 {
  readonly index: number;
  readonly as_of: string;
  readonly event_cause: ReceiptEventCauseV0;
  readonly recheck_kind?: ReceiptRecheckKindV0;
  readonly runtime_equivalent: NoMemoBaselineRuntimeEquivalentV0;
  readonly no_memo_outcome: NoMemoBaselineOutcomeV0;
  readonly model_invocation_count: number;
  readonly tokens: NoMemoBaselineTokensV0;
  readonly source_tokens: NoMemoBaselineTokensV0;
  readonly source_provider: string;
  readonly source_model: string;
  readonly source_receipt_hash?: ContentHashV0;
  readonly deterministic_profile: string;
  readonly note: string;
}

export interface NoMemoBaselineAssumptionsV0 {
  readonly replay_mode:
    "same-runtime-receipt-log-with-memo-disabled-equivalent";
  readonly memo_hit_handling:
    "token-bearing-receipts-charge-total-as-fresh";
  readonly runtime_behavior_changed: false;
  readonly excluded_invocations: readonly string[];
}

export interface NoMemoBaselineSummaryV0 {
  readonly schema: typeof NO_MEMO_BASELINE_SUMMARY_SCHEMA_V0;
  readonly v: typeof NO_MEMO_BASELINE_SUMMARY_VERSION_V0;
  readonly summary_type: NoMemoBaselineSummaryTypeV0;
  readonly generated_at: typeof NO_MEMO_BASELINE_GENERATED_AT_V0;
  readonly variant: typeof NO_MEMO_BASELINE_VARIANT_V0;
  readonly scenario: NoMemoBaselineScenarioV0;
  readonly receipt_count: number;
  readonly turn_count: number;
  readonly memo_hit_equivalent_count: number;
  readonly model_invocation_count: number;
  readonly tokens: NoMemoBaselineTokensV0;
  readonly ratio: NoMemoBaselineRatioV0;
  readonly assumptions: NoMemoBaselineAssumptionsV0;
  readonly turns: readonly NoMemoBaselineTurnV0[];
  readonly notes: readonly string[];
  readonly content_hash: ContentHashV0;
}

export interface RunNoMemoW7StaticBaselineInputV0 {
  readonly reactor_run?: ScenarioRunReceiptV0;
  readonly source_fixture?: string;
}

export interface CreateNoMemoStaticBaselineFromReactorRunInputV0 {
  readonly reactor_run: ScenarioRunReceiptV0;
  readonly source_fixture?: string;
}

type NoMemoBaselineSummaryPayloadV0 = Omit<
  NoMemoBaselineSummaryV0,
  "content_hash"
>;

interface NoMemoBaselineObservedReceiptProfileV0 {
  readonly as_of: string;
  readonly event_cause: ReceiptEventCauseV0;
  readonly recheck_kind?: ReceiptRecheckKindV0;
  readonly source_provider: string;
  readonly source_model: string;
  readonly source_tokens: NoMemoBaselineTokensV0;
}

interface CreateNoMemoStaticSummaryInputV0 {
  readonly initial_instant: string;
  readonly final_instant: string;
  readonly source_fixture: string;
  readonly scenario_script_turn_count: number;
  readonly turns: readonly NoMemoBaselineTurnV0[];
}

const OBSERVED_W7_STATIC_RECEIPT_PROFILES: readonly NoMemoBaselineObservedReceiptProfileV0[] =
  Object.freeze([
    {
      as_of: "2026-05-18T12:00:00.000Z",
      event_cause: "real-input",
      source_provider: "cradle",
      source_model: "deterministic-bootstrap",
      source_tokens: tokensFromFreshReused(41, 0),
    },
    {
      as_of: "2026-05-18T12:15:00.000Z",
      event_cause: "forecast-recheck",
      recheck_kind: "evidence-age",
      source_provider: "memo",
      source_model: "memo",
      source_tokens: tokensFromFreshReused(0, 41),
    },
    {
      as_of: "2026-05-18T18:00:00.000Z",
      event_cause: "forecast-recheck",
      recheck_kind: "plan-age",
      source_provider: "cradle",
      source_model: "deterministic-plan-audit",
      source_tokens: tokensFromFreshReused(5, 0),
    },
    {
      as_of: "2026-05-19T12:00:00.000Z",
      event_cause: "forecast-recheck",
      recheck_kind: "evidence-age",
      source_provider: "memo",
      source_model: "memo",
      source_tokens: tokensFromFreshReused(0, 5),
    },
  ]);

const BASELINE_NOTES = Object.freeze([
  "Derived from the Reactor static-world receipt schedule for the same incident-briefing-static-zero scenario and cassette.",
  "The ablation leaves the Reactor forecast/status schedule intact, but disables memo credit by charging every token-bearing receipt total as fresh judge work.",
  "Memo-hit receipts are treated as memo misses: reused tokens become fresh tokens and model_invocation_count increments for that turn.",
]);

export function createNoMemoStaticBaselineFromReactorRunV0(
  input: CreateNoMemoStaticBaselineFromReactorRunInputV0,
): NoMemoBaselineSummaryV0 {
  const run = input.reactor_run;
  assertExpectedStaticRun(run);

  return createNoMemoStaticSummary({
    initial_instant: run.initial_instant,
    final_instant: run.final_instant,
    source_fixture:
      input.source_fixture ?? NO_MEMO_BASELINE_SOURCE_FIXTURE_V0,
    scenario_script_turn_count: run.trace.length,
    turns: run.receipt_log.entries.map((receipt, index) =>
      createNoMemoTurnFromReceipt(receipt, index),
    ),
  });
}

export function runNoMemoW7StaticBaselineV0(
  input: RunNoMemoW7StaticBaselineInputV0 = {},
): NoMemoBaselineSummaryV0 {
  if (input.reactor_run !== undefined) {
    return createNoMemoStaticBaselineFromReactorRunV0({
      reactor_run: input.reactor_run,
      ...(input.source_fixture === undefined
        ? {}
        : { source_fixture: input.source_fixture }),
    });
  }

  return createNoMemoStaticSummary({
    initial_instant: "2026-05-18T12:00:00.000Z",
    final_instant: "2026-05-19T12:00:00.000Z",
    source_fixture:
      input.source_fixture ?? NO_MEMO_BASELINE_SOURCE_FIXTURE_V0,
    scenario_script_turn_count: 5,
    turns: OBSERVED_W7_STATIC_RECEIPT_PROFILES.map((profile, index) =>
      createNoMemoTurnFromObservedProfile(profile, index),
    ),
  });
}

function createNoMemoStaticSummary(
  input: CreateNoMemoStaticSummaryInputV0,
): NoMemoBaselineSummaryV0 {
  const tokens = sumTurnTokens(input.turns);
  const payload: NoMemoBaselineSummaryPayloadV0 = {
    schema: NO_MEMO_BASELINE_SUMMARY_SCHEMA_V0,
    v: NO_MEMO_BASELINE_SUMMARY_VERSION_V0,
    summary_type: "runtime-derived-static-no-memo-replay",
    generated_at: NO_MEMO_BASELINE_GENERATED_AT_V0,
    variant: NO_MEMO_BASELINE_VARIANT_V0,
    scenario: {
      id: NO_MEMO_BASELINE_SCENARIO_ID_V0,
      profile: NO_MEMO_BASELINE_WORLD_PROFILE_V0,
      initial_instant: input.initial_instant,
      final_instant: input.final_instant,
      source_fixture: input.source_fixture,
      cassette_path: NO_MEMO_BASELINE_CASSETTE_PATH_V0,
      scenario_script_turn_count: input.scenario_script_turn_count,
    },
    receipt_count: input.turns.length,
    turn_count: input.turns.length,
    memo_hit_equivalent_count: input.turns.filter(
      (turn) => turn.runtime_equivalent === "memo-hit-equivalent",
    ).length,
    model_invocation_count: sumModelInvocations(input.turns),
    tokens,
    ratio: tokenRatio(tokens),
    assumptions: {
      replay_mode: "same-runtime-receipt-log-with-memo-disabled-equivalent",
      memo_hit_handling: "token-bearing-receipts-charge-total-as-fresh",
      runtime_behavior_changed: false,
      excluded_invocations: [
        "scenario setup cassette model step at t=0 is not a Reactor receipt and is excluded from the baseline ratio",
      ],
    },
    turns: Object.freeze([...input.turns]),
    notes: BASELINE_NOTES,
  };

  return Object.freeze({
    ...payload,
    content_hash: contentHash(payload),
  });
}

function createNoMemoTurnFromReceipt(
  receipt: ReceiptV0,
  index: number,
): NoMemoBaselineTurnV0 {
  const sourceTokens = tokensFromFreshReused(
    receipt.cost.tokens.fresh,
    receipt.cost.tokens.reused,
  );

  return createNoMemoTurn({
    index,
    as_of: receipt.core.as_of,
    event_cause: receipt.core.event_cause,
    ...(receipt.core.recheck_kind === undefined
      ? {}
      : { recheck_kind: receipt.core.recheck_kind }),
    source_provider: receipt.cost.provider,
    source_model: receipt.cost.model,
    source_tokens: sourceTokens,
    source_receipt_hash: receipt.content_hash,
  });
}

function createNoMemoTurnFromObservedProfile(
  profile: NoMemoBaselineObservedReceiptProfileV0,
  index: number,
): NoMemoBaselineTurnV0 {
  return createNoMemoTurn({
    index,
    as_of: profile.as_of,
    event_cause: profile.event_cause,
    ...(profile.recheck_kind === undefined
      ? {}
      : { recheck_kind: profile.recheck_kind }),
    source_provider: profile.source_provider,
    source_model: profile.source_model,
    source_tokens: profile.source_tokens,
  });
}

function createNoMemoTurn(input: {
  readonly index: number;
  readonly as_of: string;
  readonly event_cause: ReceiptEventCauseV0;
  readonly recheck_kind?: ReceiptRecheckKindV0;
  readonly source_provider: string;
  readonly source_model: string;
  readonly source_tokens: NoMemoBaselineTokensV0;
  readonly source_receipt_hash?: ContentHashV0;
}): NoMemoBaselineTurnV0 {
  const tokens = tokensFromFreshReused(input.source_tokens.total, 0);
  const runtimeEquivalent: NoMemoBaselineRuntimeEquivalentV0 =
    input.source_provider === "memo"
      ? "memo-hit-equivalent"
      : "model-invocation-equivalent";

  return Object.freeze({
    index: input.index,
    as_of: input.as_of,
    event_cause: input.event_cause,
    ...(input.recheck_kind === undefined
      ? {}
      : { recheck_kind: input.recheck_kind }),
    runtime_equivalent: runtimeEquivalent,
    no_memo_outcome: "fresh-judge",
    model_invocation_count: tokens.total === 0 ? 0 : 1,
    tokens,
    source_tokens: input.source_tokens,
    source_provider: input.source_provider,
    source_model: input.source_model,
    ...(input.source_receipt_hash === undefined
      ? {}
      : { source_receipt_hash: input.source_receipt_hash }),
    deterministic_profile: input.source_model,
    note: noMemoTurnNote(runtimeEquivalent, input.source_tokens),
  });
}

function noMemoTurnNote(
  runtimeEquivalent: NoMemoBaselineRuntimeEquivalentV0,
  sourceTokens: NoMemoBaselineTokensV0,
): string {
  if (runtimeEquivalent === "memo-hit-equivalent") {
    return `Runtime memo-hit receipt is treated as a memo miss; ${sourceTokens.reused} reused token(s) become fresh judge work.`;
  }

  return "Runtime model invocation remains fresh judge work in the no-memo baseline.";
}

function assertExpectedStaticRun(run: ScenarioRunReceiptV0): void {
  if (run.scenario_id !== NO_MEMO_BASELINE_SCENARIO_ID_V0) {
    throw new Error(
      `no-memo static baseline requires scenario_id=${NO_MEMO_BASELINE_SCENARIO_ID_V0}; received ${run.scenario_id}`,
    );
  }
  if (run.world_profile !== NO_MEMO_BASELINE_WORLD_PROFILE_V0) {
    throw new Error(
      `no-memo static baseline requires world_profile=${NO_MEMO_BASELINE_WORLD_PROFILE_V0}; received ${run.world_profile}`,
    );
  }
  if (run.cassette_path !== NO_MEMO_BASELINE_CASSETTE_PATH_V0) {
    throw new Error(
      `no-memo static baseline requires cassette_path=${NO_MEMO_BASELINE_CASSETTE_PATH_V0}; received ${run.cassette_path}`,
    );
  }
}

function sumTurnTokens(
  turns: readonly NoMemoBaselineTurnV0[],
): NoMemoBaselineTokensV0 {
  const fresh = turns.reduce((sum, turn) => sum + turn.tokens.fresh, 0);
  const reused = turns.reduce((sum, turn) => sum + turn.tokens.reused, 0);

  return tokensFromFreshReused(fresh, reused);
}

function sumModelInvocations(turns: readonly NoMemoBaselineTurnV0[]): number {
  return turns.reduce((sum, turn) => sum + turn.model_invocation_count, 0);
}

function tokensFromFreshReused(
  fresh: number,
  reused: number,
): NoMemoBaselineTokensV0 {
  assertTokenCount(fresh, "fresh");
  assertTokenCount(reused, "reused");

  return Object.freeze({
    fresh,
    reused,
    total: fresh + reused,
  });
}

function assertTokenCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`no-memo baseline token count ${label} must be a non-negative integer`);
  }
}

function tokenRatio(tokens: NoMemoBaselineTokensV0): NoMemoBaselineRatioV0 {
  return Object.freeze({
    fresh: tokens.fresh,
    reused: tokens.reused,
    label: `${tokens.fresh}:${tokens.reused}`,
    reused_is_zero: tokens.reused === 0,
  });
}

function contentHash(payload: NoMemoBaselineSummaryPayloadV0): ContentHashV0 {
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  return `sha256:${digest}` as ContentHashV0;
}
