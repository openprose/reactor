import {
  type ContentHashV0,
  type ReceiptRecheckKindV0,
  type ReceiptV0,
  createNullSignerReceiptSignatureV0,
  createReceiptV0,
} from "../receipt";

export interface ForecastScheduleStateV0 {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly memo_key: string;
  readonly evidence_input_ids: readonly ContentHashV0[];
  readonly next_evidence_recheck: string;
  readonly next_plan_recheck: string;
}

export interface ForecastScheduleInputV0 {
  readonly as_of: string;
  readonly schedule: ForecastScheduleStateV0;
  readonly real_input_observed: boolean;
}

export type ForecastScheduleResultV0 =
  | {
      readonly outcome: "sleep";
      readonly next_due_at: string;
      readonly token_bearing_receipts: readonly ReceiptV0[];
      readonly due_rechecks: readonly ReceiptRecheckKindV0[];
    }
  | {
      readonly outcome: "manufacture-recheck";
      readonly next_due_at?: string;
      readonly receipts: readonly ReceiptV0[];
      readonly token_bearing_receipts: readonly ReceiptV0[];
      readonly due_rechecks: readonly ReceiptRecheckKindV0[];
      readonly reason: "forecast-clock-crossed" | "adversarial-silent";
    };

export function evaluateForecastScheduleV0(
  input: ForecastScheduleInputV0,
): ForecastScheduleResultV0 {
  const asOfMs = parseInstantMs(input.as_of, "as_of");
  const dueRechecks = dueRecheckKinds(input.schedule, asOfMs);

  if (dueRechecks.length === 0) {
    return {
      outcome: "sleep",
      next_due_at: earliestInstant([
        input.schedule.next_evidence_recheck,
        input.schedule.next_plan_recheck,
      ]),
      token_bearing_receipts: [],
      due_rechecks: [],
    };
  }

  const receipts = dueRechecks.map((recheckKind) =>
    createForecastRecheckReceiptV0({
      responsibility_id: input.schedule.responsibility_id,
      contract_revision: input.schedule.contract_revision,
      memo_key: input.schedule.memo_key,
      evidence_input_ids: input.schedule.evidence_input_ids,
      as_of: input.as_of,
      recheck_kind: recheckKind,
    }),
  );

  const nextDueAt = nextDueAfter(input.schedule, dueRechecks);

  return {
    outcome: "manufacture-recheck",
    ...(nextDueAt === undefined ? {} : { next_due_at: nextDueAt }),
    receipts,
    token_bearing_receipts: tokenBearingReceipts(receipts),
    due_rechecks: dueRechecks,
    reason: input.real_input_observed ? "forecast-clock-crossed" : "adversarial-silent",
  };
}

export interface ForecastRecheckReceiptInputV0 {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly memo_key: string;
  readonly evidence_input_ids: readonly ContentHashV0[];
  readonly as_of: string;
  readonly recheck_kind: ReceiptRecheckKindV0;
}

export function createForecastRecheckReceiptV0(
  input: ForecastRecheckReceiptInputV0,
): ReceiptV0 {
  return createReceiptV0({
    core: {
      responsibility_id: input.responsibility_id,
      contract_revision: input.contract_revision,
      event_cause: "forecast-recheck",
      recheck_kind: input.recheck_kind,
      memo_key: input.memo_key,
      evidence_input_ids: input.evidence_input_ids,
      as_of: input.as_of,
      role: "judge",
    },
    sig: createNullSignerReceiptSignatureV0(),
    verdict: {
      status: "blocked",
      confidence: {
        value: 0,
        derivation_method: "forecast-gated-synthetic-input",
        calibration_grade: "none",
        label_source: "forecast-clock",
      },
      blocked: {
        reason: `forecast-${input.recheck_kind}-recheck-required`,
        fix_target: "judge",
        interrupt_cause: "needs-judgment",
      },
    },
    freshness: {
      as_of: input.as_of,
      next_forecast_recheck: input.as_of,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "forecast",
      model: "deterministic-scheduler",
      role: "judge",
      tags: ["forecast-recheck", input.recheck_kind],
      responsibility_id: input.responsibility_id,
      run_id: `forecast-${input.recheck_kind}-${input.as_of}`,
      as_of: input.as_of,
      tokens: { fresh: 0, reused: 0 },
      surprise_cause: "forecast-recheck",
    },
  });
}

export function tokenBearingReceipts(
  receipts: readonly ReceiptV0[],
): readonly ReceiptV0[] {
  return receipts.filter(
    (receipt) => receipt.cost.tokens.fresh + receipt.cost.tokens.reused > 0,
  );
}

function dueRecheckKinds(
  schedule: ForecastScheduleStateV0,
  asOfMs: number,
): readonly ReceiptRecheckKindV0[] {
  const due: ReceiptRecheckKindV0[] = [];
  if (parseInstantMs(schedule.next_evidence_recheck, "next_evidence_recheck") <= asOfMs) {
    due.push("evidence-age");
  }
  if (parseInstantMs(schedule.next_plan_recheck, "next_plan_recheck") <= asOfMs) {
    due.push("plan-age");
  }

  return due;
}

function earliestInstant(values: readonly string[]): string {
  return [...values].sort((left, right) => parseInstantMs(left, left) - parseInstantMs(right, right))[0] ?? "";
}

function nextDueAfter(
  schedule: ForecastScheduleStateV0,
  dueRechecks: readonly ReceiptRecheckKindV0[],
): string | undefined {
  const candidates: string[] = [];
  if (!dueRechecks.includes("evidence-age")) {
    candidates.push(schedule.next_evidence_recheck);
  }
  if (!dueRechecks.includes("plan-age")) {
    candidates.push(schedule.next_plan_recheck);
  }

  return candidates.length === 0 ? undefined : earliestInstant(candidates);
}

function parseInstantMs(value: string, name: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a replayable instant`);
  }

  return parsed;
}
