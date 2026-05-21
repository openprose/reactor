import { deepEqual, equal, match, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  NO_MEMO_BASELINE_CASSETTE_PATH_V0,
  NO_MEMO_BASELINE_SCENARIO_ID_V0,
  NO_MEMO_BASELINE_SUMMARY_SCHEMA_V0,
  NO_MEMO_BASELINE_VARIANT_V0,
  runNoMemoW7StaticBaselineV0,
} from "../no-memo";

test("no-memo W7 static baseline turns evidence-age memo hits into fresh work", () => {
  const summary = runNoMemoW7StaticBaselineV0();
  const evidenceAgeTurns = summary.turns.filter(
    (turn) => turn.recheck_kind === "evidence-age",
  );

  equal(summary.schema, NO_MEMO_BASELINE_SUMMARY_SCHEMA_V0);
  equal(summary.variant, NO_MEMO_BASELINE_VARIANT_V0);
  equal(summary.scenario.id, NO_MEMO_BASELINE_SCENARIO_ID_V0);
  equal(summary.scenario.profile, "static");
  equal(summary.scenario.cassette_path, NO_MEMO_BASELINE_CASSETTE_PATH_V0);
  equal(summary.summary_type, "runtime-derived-static-no-memo-replay");
  equal(summary.assumptions.runtime_behavior_changed, false);
  equal(
    summary.assumptions.memo_hit_handling,
    "token-bearing-receipts-charge-total-as-fresh",
  );
  equal(
    summary.assumptions.replay_mode,
    "same-runtime-receipt-log-with-memo-disabled-equivalent",
  );
  equal(summary.receipt_count, 4);
  equal(summary.turn_count, 4);
  equal(summary.scenario.scenario_script_turn_count, 5);
  equal(summary.memo_hit_equivalent_count, 2);
  equal(summary.model_invocation_count, 4);
  deepEqual(summary.tokens, { fresh: 92, reused: 0, total: 92 });
  deepEqual(summary.ratio, {
    fresh: 92,
    reused: 0,
    label: "92:0",
    reused_is_zero: true,
  });
  equal(evidenceAgeTurns.length, 2);
  ok(
    summary.notes.some((note) => note.includes("same incident-briefing-static-zero")),
  );

  deepEqual(
    summary.turns.map((turn) => ({
      runtime_equivalent: turn.runtime_equivalent,
      no_memo_outcome: turn.no_memo_outcome,
      model_invocation_count: turn.model_invocation_count,
      source_provider: turn.source_provider,
      source_tokens: turn.source_tokens,
      tokens: turn.tokens,
    })),
    [
      {
        runtime_equivalent: "model-invocation-equivalent",
        no_memo_outcome: "fresh-judge",
        model_invocation_count: 1,
        source_provider: "cradle",
        source_tokens: { fresh: 41, reused: 0, total: 41 },
        tokens: { fresh: 41, reused: 0, total: 41 },
      },
      {
        runtime_equivalent: "memo-hit-equivalent",
        no_memo_outcome: "fresh-judge",
        model_invocation_count: 1,
        source_provider: "memo",
        source_tokens: { fresh: 0, reused: 41, total: 41 },
        tokens: { fresh: 41, reused: 0, total: 41 },
      },
      {
        runtime_equivalent: "model-invocation-equivalent",
        no_memo_outcome: "fresh-judge",
        model_invocation_count: 1,
        source_provider: "cradle",
        source_tokens: { fresh: 5, reused: 0, total: 5 },
        tokens: { fresh: 5, reused: 0, total: 5 },
      },
      {
        runtime_equivalent: "memo-hit-equivalent",
        no_memo_outcome: "fresh-judge",
        model_invocation_count: 1,
        source_provider: "memo",
        source_tokens: { fresh: 0, reused: 5, total: 5 },
        tokens: { fresh: 5, reused: 0, total: 5 },
      },
    ],
  );

  for (const turn of evidenceAgeTurns) {
    match(turn.note, /treated as a memo miss/);
  }
});

test("no-memo W7 static baseline summary is deterministic", () => {
  const first = runNoMemoW7StaticBaselineV0();
  const second = runNoMemoW7StaticBaselineV0();

  deepEqual(second, first);
  match(first.content_hash, /^sha256:[a-f0-9]{64}$/);
});
