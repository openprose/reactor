import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  createForecastRecheckReceiptV0,
  evaluateForecastScheduleV0,
  tokenBearingReceipts,
} from "../index";
import { verifyReceiptV0 } from "../../receipt";

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

test("virtual-clock schedule sleeps before forecast clocks without token-bearing receipts", () => {
  const result = evaluateForecastScheduleV0({
    as_of: "2026-05-18T12:30:00Z",
    real_input_observed: false,
    schedule: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: CONTRACT_HASH,
      memo_key: "memo-static",
      evidence_input_ids: [EVIDENCE_HASH],
      next_evidence_recheck: "2026-05-18T13:00:00Z",
      next_plan_recheck: "2026-05-18T18:00:00Z",
    },
  });

  deepEqual(result, {
    outcome: "sleep",
    next_due_at: "2026-05-18T13:00:00Z",
    token_bearing_receipts: [],
    due_rechecks: [],
  });
});

test("adversarial-silent world still manufactures an evidence-age recheck", () => {
  const result = evaluateForecastScheduleV0({
    as_of: "2026-05-18T13:00:00Z",
    real_input_observed: false,
    schedule: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: CONTRACT_HASH,
      memo_key: "memo-static",
      evidence_input_ids: [EVIDENCE_HASH],
      next_evidence_recheck: "2026-05-18T13:00:00Z",
      next_plan_recheck: "2026-05-18T18:00:00Z",
    },
  });

  equal(result.outcome, "manufacture-recheck");
  equal(result.reason, "adversarial-silent");
  deepEqual(result.due_rechecks, ["evidence-age"]);
  equal(result.token_bearing_receipts.length, 0);
  equal(result.receipts[0]?.core.event_cause, "forecast-recheck");
  equal(result.receipts[0]?.core.recheck_kind, "evidence-age");
  equal(result.receipts[0]?.cost.surprise_cause, "forecast-recheck");
  equal(result.receipts[0] === undefined ? false : verifyReceiptV0(result.receipts[0]).ok, true);
});

test("plan-age audit is represented as forecast-recheck synthetic evidence", () => {
  const result = evaluateForecastScheduleV0({
    as_of: "2026-05-18T18:00:00Z",
    real_input_observed: true,
    schedule: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: CONTRACT_HASH,
      memo_key: "memo-static",
      evidence_input_ids: [EVIDENCE_HASH],
      next_evidence_recheck: "2026-05-19T13:00:00Z",
      next_plan_recheck: "2026-05-18T18:00:00Z",
    },
  });

  equal(result.outcome, "manufacture-recheck");
  equal(result.reason, "forecast-clock-crossed");
  deepEqual(result.due_rechecks, ["plan-age"]);
  equal(result.receipts[0]?.core.recheck_kind, "plan-age");
  equal(result.receipts[0]?.cost.tokens.fresh, 0);
  equal(result.receipts[0]?.cost.tokens.reused, 0);
});

test("token-bearing receipt filter catches only receipts with token work", () => {
  const synthetic = createForecastRecheckReceiptV0({
    responsibility_id: "responsibility.incident-briefing",
    contract_revision: CONTRACT_HASH,
    memo_key: "memo-static",
    evidence_input_ids: [EVIDENCE_HASH],
    as_of: "2026-05-18T18:00:00Z",
    recheck_kind: "plan-age",
  });

  deepEqual(tokenBearingReceipts([synthetic]), []);
});
