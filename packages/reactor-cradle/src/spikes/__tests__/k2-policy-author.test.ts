import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  K2_KNOWN_RESPONSIBILITY_ID,
  evaluateK2PolicyAuthorFixtureV0,
} from "../k2-policy-author";

const FIXTURE_DIR = join(process.cwd(), "src", "spikes", "fixtures");

test("recorded K2 policy author passes shape validation and B3 on live facts", () => {
  const result = evaluateK2PolicyAuthorFixtureV0(
    readFixture("k2-good-policy.fixture.json"),
  );

  equal(result.ok, true);
  equal(result.status, "pass");
  equal(result.responsibility_id, K2_KNOWN_RESPONSIBILITY_ID);
  deepEqual(result.live_observable_refs, [
    "cost.fresh_tokens_per_maintained_day",
    "kernel.deep_shallow_contradiction_count_7d",
    "receipt.escalation_precision_7d",
    "source.incident_channel.material_update_count_1h",
  ]);

  const validation = result.kernel_validation;
  ok(validation !== undefined);
  equal(validation.ok, true);
  if (validation.ok) {
    deepEqual(validation.live_observable_refs, result.live_observable_refs);
  }

  ok(
    result.evidence.some(
      (entry) =>
        entry.path === "authored_policy.cadence" &&
        entry.message === "cadence shape is replayable",
    ),
  );
  ok(
    result.evidence.some(
      (entry) =>
        entry.path === "authored_policy.hysteresis" &&
        entry.message === "hysteresis band is sane",
    ),
  );
  ok(
    result.evidence.some(
      (entry) =>
        entry.path === "authored_policy.thresholds" &&
        entry.message === "threshold shape is sane",
    ),
  );
  ok(
    result.evidence.some(
      (entry) =>
        entry.path === "authored_policy" &&
        entry.message === "kernel B3 validation passed",
    ),
  );
});

test("recorded K2 policy author fails closed on off-live observable facts", () => {
  const result = evaluateK2PolicyAuthorFixtureV0(
    readFixture("k2-off-live-observable.fixture.json"),
  );

  equal(result.ok, false);
  equal(result.status, "fail");
  equal(result.kernel_validation, undefined);
  ok(
    result.failures.some(
      (entry) =>
        entry.path === "authored_policy.falsification_predicate" &&
        entry.message === "predicate references non-live observable facts",
    ),
  );
});

test("recorded K2 policy author fails closed on malformed policy shape", () => {
  const result = evaluateK2PolicyAuthorFixtureV0(
    readFixture("k2-malformed-policy.fixture.json"),
  );

  equal(result.ok, false);
  equal(result.status, "fail");
  equal(result.kernel_validation, undefined);
  ok(
    result.failures.some(
      (entry) =>
        entry.path === "authored_policy.cadence.shallow_recheck_ms" &&
        entry.message === "field must be a positive safe integer",
    ),
  );
  ok(
    result.failures.some(
      (entry) =>
        entry.path === "authored_policy.falsification_predicate.value" &&
        entry.message === "numeric predicate threshold is malformed",
    ),
  );
  ok(
    result.failures.some(
      (entry) =>
        entry.path === "authored_policy.hysteresis" &&
        entry.message === "exit threshold must be below enter threshold to avoid flip-flop",
    ),
  );
});

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8")) as unknown;
}
