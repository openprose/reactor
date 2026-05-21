import { equal, throws } from "node:assert/strict";
import { test } from "node:test";

import * as rootSurface from "../../index";
import {
  POLICY_ROLLBACK_DECISION_SCHEMA,
  planPolicyRollbackV0,
} from "../index";

test("policy rollback reverts when fresh policy trips sooner than last-known-good", () => {
  const decision = planPolicyRollbackV0({
    fresh_policy_revision: "policy.p4.fresh",
    fresh_policy_judged_activations_before_trip: 3,
    last_known_good_revision: "policy.p3.last-known-good",
    last_known_good_judged_activations_before_trip: 9,
  });

  equal(decision.schema, POLICY_ROLLBACK_DECISION_SCHEMA);
  equal(decision.v, 0);
  equal(decision.fresh_policy_revision, "policy.p4.fresh");
  equal(decision.last_known_good_revision, "policy.p3.last-known-good");
  equal(decision.fresh_policy_judged_activations_before_trip, 3);
  equal(decision.last_known_good_judged_activations_before_trip, 9);
  equal(decision.outcome, "rollback");
  equal(decision.target_policy_revision, "policy.p3.last-known-good");
  equal(
    decision.reason,
    "fresh policy tripped in fewer judged activations than last-known-good",
  );
});

test("policy rollback keeps current when fresh policy is not worse", () => {
  const decision = planPolicyRollbackV0({
    fresh_policy_revision: "policy.p4.fresh",
    fresh_policy_judged_activations_before_trip: 9,
    last_known_good_revision: "policy.p3.last-known-good",
    last_known_good_judged_activations_before_trip: 3,
  });

  equal(decision.outcome, "keep-current");
  equal(decision.target_policy_revision, "policy.p4.fresh");
  equal(
    decision.reason,
    "fresh policy did not prove worse by judged activation count",
  );
});

test("policy rollback records no-last-known-good when rollback target is absent", () => {
  const decision = planPolicyRollbackV0({
    fresh_policy_revision: "policy.p4.fresh",
    fresh_policy_judged_activations_before_trip: 1,
  });

  equal(decision.outcome, "no-last-known-good");
  equal(decision.last_known_good_revision, undefined);
  equal(decision.last_known_good_judged_activations_before_trip, undefined);
  equal(Object.hasOwn(decision, "target_policy_revision"), false);
  equal(
    decision.reason,
    "rollback target absent; kernel must enter the safest available path",
  );
});

test("policy rollback rejects invalid judged activation counts through the kernel brand", () => {
  throws(
    () =>
      planPolicyRollbackV0({
        fresh_policy_revision: "policy.p4.bad",
        fresh_policy_judged_activations_before_trip: -1,
        last_known_good_revision: "policy.p3.last-known-good",
        last_known_good_judged_activations_before_trip: 9,
      }),
    /fresh_policy_judged_activations_before_trip must be a non-negative/,
  );

  throws(
    () =>
      planPolicyRollbackV0({
        fresh_policy_revision: "policy.p4.bad",
        fresh_policy_judged_activations_before_trip: 3,
        last_known_good_revision: "policy.p3.last-known-good",
        last_known_good_judged_activations_before_trip: 1.5,
      }),
    /last_known_good_judged_activations_before_trip must be a non-negative/,
  );
});

test("policy rollback public surface is exported from the root", () => {
  equal(typeof rootSurface.planPolicyRollbackV0, "function");
});
