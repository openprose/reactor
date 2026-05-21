import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  evaluateFlatSpendUnderStaticV0,
  evaluateSurpriseAttributionCompleteV0,
  isAllowedSurpriseCauseV0,
  isTokenBearingReceiptV0,
  validateReceiptSurpriseCauseV0,
  validateReceiptSurpriseAttributionV0,
} from "../index";
import {
  type ReceiptEventCauseV0,
  type ReceiptRecheckKindV0,
  type ReceiptV0,
  type ReceiptV0Input,
  createReceiptV0,
} from "../../receipt";

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

test("token-bearing detection distinguishes fresh, reused, and zero-token receipts", () => {
  const fresh = makeReceipt({ tokens: { fresh: 3, reused: 0 } });
  const reused = makeReceipt({ tokens: { fresh: 0, reused: 7 } });
  const zero = makeReceipt({ tokens: { fresh: 0, reused: 0 } });

  equal(isTokenBearingReceiptV0(fresh), true);
  equal(isTokenBearingReceiptV0(reused), true);
  equal(isTokenBearingReceiptV0(zero), false);
});

test("allowed surprise cause validation is pinned to receipt v0 causes", () => {
  equal(isAllowedSurpriseCauseV0("real-input"), true);
  equal(isAllowedSurpriseCauseV0("forecast-recheck"), true);
  equal(isAllowedSurpriseCauseV0("escalation"), true);
  equal(isAllowedSurpriseCauseV0("plan-age"), false);
  equal(isAllowedSurpriseCauseV0("cache-hit"), false);
});

test("token-bearing receipts pass only with exactly one allowed surprise cause", () => {
  const realInput = makeReceipt({
    eventCause: "real-input",
    tokens: { fresh: 11, reused: 0 },
  });
  const forecastRecheck = makeReceipt({
    eventCause: "forecast-recheck",
    recheckKind: "evidence-age",
    tokens: { fresh: 0, reused: 11 },
  });
  const escalation = makeReceipt({
    eventCause: "escalation",
    tokens: { fresh: 2, reused: 0 },
  });

  const receiptCheck = validateReceiptSurpriseAttributionV0(realInput);
  const aliasCheck = validateReceiptSurpriseCauseV0(realInput);
  const relationship = evaluateSurpriseAttributionCompleteV0([
    realInput,
    forecastRecheck,
    escalation,
  ]);

  equal(receiptCheck.ok, true);
  equal(aliasCheck.ok, true);
  equal(receiptCheck.observation?.surprise_cause, "real-input");
  equal(receiptCheck.observation?.token_bearing, true);
  equal(relationship.ok, true);
  equal(relationship.checked.token_bearing_receipts, 3);
  deepEqual(relationship.issues, []);
});

test("missing, invalid, and plural surprise causes fail closed", () => {
  const missingCause = omitSurpriseCause(
    makeReceipt({ tokens: { fresh: 5, reused: 0 } }),
  );
  const invalidCause = withCostPatch(
    makeReceipt({ eventCause: "forecast-recheck", recheckKind: "plan-age" }),
    { surprise_cause: "plan-age" },
  );
  const pluralCause = withCostPatch(
    makeReceipt({ tokens: { fresh: 5, reused: 0 } }),
    { surprise_causes: ["real-input", "escalation"] },
  );

  const relationship = evaluateSurpriseAttributionCompleteV0([
    missingCause,
    invalidCause,
    pluralCause,
  ]);

  equal(relationship.ok, false);
  ok(
    relationship.issues.some(
      (issue) => issue.code === "surprise-cause-missing",
    ),
  );
  ok(
    relationship.issues.some(
      (issue) => issue.code === "surprise-cause-invalid",
    ),
  );
  ok(
    relationship.issues.some(
      (issue) => issue.code === "surprise-cause-multiple",
    ),
  );
});

test("surprise cause mismatch with core event cause fails closed", () => {
  const mismatched = withCostPatch(
    makeReceipt({ eventCause: "real-input", tokens: { fresh: 4, reused: 0 } }),
    { surprise_cause: "escalation" },
  );

  const check = validateReceiptSurpriseAttributionV0(mismatched);

  equal(check.ok, false);
  ok(
    check.issues.some((issue) => issue.code === "surprise-cause-mismatch"),
  );
});

test("flat spend under static permits only post-bootstrap plan-age audit fresh spend", () => {
  const bootstrap = makeReceipt({
    eventCause: "real-input",
    tokens: { fresh: 41, reused: 0 },
  });
  const memoHit = makeReceipt({
    eventCause: "real-input",
    tokens: { fresh: 0, reused: 41 },
    asOf: "2026-05-18T13:00:00Z",
  });
  const planAgeAudit = makeReceipt({
    eventCause: "forecast-recheck",
    recheckKind: "plan-age",
    tokens: { fresh: 3, reused: 0 },
    asOf: "2026-05-18T18:00:00Z",
  });
  const evidenceAgeFresh = makeReceipt({
    eventCause: "forecast-recheck",
    recheckKind: "evidence-age",
    tokens: { fresh: 1, reused: 0 },
    asOf: "2026-05-18T19:00:00Z",
  });

  const passing = evaluateFlatSpendUnderStaticV0({
    world_profile: "static",
    bootstrap_receipt_count: 1,
    receipts: [bootstrap, memoHit, planAgeAudit],
  });
  const failing = evaluateFlatSpendUnderStaticV0({
    world_profile: "static",
    bootstrap_receipt_count: 1,
    receipts: [bootstrap, memoHit, planAgeAudit, evidenceAgeFresh],
  });

  equal(passing.ok, true);
  equal(passing.checked.post_bootstrap_token_bearing_receipts, 2);
  equal(passing.checked.plan_age_audit_floor_receipts, 1);
  equal(failing.ok, false);
  ok(
    failing.issues.some(
      (issue) => issue.code === "post-bootstrap-fresh-spend",
    ),
  );
});

test("flat spend under static fails closed without token-bearing evidence", () => {
  const zero = makeReceipt({ tokens: { fresh: 0, reused: 0 } });

  const result = evaluateFlatSpendUnderStaticV0({
    world_profile: "static",
    receipts: [zero],
  });

  equal(result.ok, false);
  ok(
    result.issues.some(
      (issue) => issue.code === "token-bearing-evidence-missing",
    ),
  );
});

interface MakeReceiptOptions {
  readonly eventCause?: ReceiptEventCauseV0;
  readonly recheckKind?: ReceiptRecheckKindV0;
  readonly tokens?: {
    readonly fresh: number;
    readonly reused: number;
  };
  readonly asOf?: string;
}

function makeReceipt(options: MakeReceiptOptions = {}): ReceiptV0 {
  const asOf = options.asOf ?? "2026-05-18T12:00:00Z";
  const eventCause = options.eventCause ?? "real-input";
  const input: ReceiptV0Input = {
    core: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: CONTRACT_HASH,
      event_cause: eventCause,
      ...(options.recheckKind === undefined
        ? {}
        : { recheck_kind: options.recheckKind }),
      memo_key: "memo-key-static-world",
      evidence_input_ids: [EVIDENCE_HASH],
      as_of: asOf,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "cost attribution fixture",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.91,
        derivation_method: "cradle-double-calibration",
        calibration_grade: "authored",
        label_source: "static-world-anchor",
      },
    },
    freshness: {
      as_of: asOf,
      next_forecast_recheck: "2026-05-19T12:00:00Z",
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "cradle-double",
      model: "deterministic-replay",
      role: "judge",
      tags: ["static-world"],
      responsibility_id: "responsibility.incident-briefing",
      run_id: `run-${asOf}`,
      as_of: asOf,
      tokens: options.tokens ?? { fresh: 11, reused: 0 },
      surprise_cause: eventCause,
    },
  };

  return createReceiptV0(input);
}

function omitSurpriseCause(receipt: ReceiptV0): unknown {
  const { surprise_cause: _surpriseCause, ...cost } = receipt.cost;

  return {
    ...receipt,
    cost,
  };
}

function withCostPatch(
  receipt: ReceiptV0,
  patch: Readonly<Record<string, unknown>>,
): unknown {
  return {
    ...receipt,
    cost: {
      ...receipt.cost,
      ...patch,
    },
  };
}
