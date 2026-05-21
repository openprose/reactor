import { deepEqual, equal, ok } from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import {
  PLAN_INCOMPLETE_D2_BACKSTOP_FACT,
  PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID,
  PLAN_INCOMPLETE_D2_SCENARIO_SCHEMA_V0,
  PLAN_INCOMPLETE_D2_SCENARIO_VERSION_V0,
  POLICY_ROLLBACK_D2_SCENARIO_SCHEMA_V0,
  POLICY_ROLLBACK_D2_SCENARIO_VERSION_V0,
  type PlanPolicyRollbackV0,
  assertRecordedPlanIncompleteD2ScenarioV0,
  assertRecordedPolicyRollbackD2ScenarioV0,
  createRecordedPolicyRollbackPlannerDoubleV0,
  makeRecordedPlanIncompleteD2ScenarioV0,
  makeRecordedPolicyRollbackD2ScenarioV0,
  runRecordedPlanIncompleteD2ProofV0,
  runRecordedPolicyRollbackD2ProofV0,
} from "../index";
import type { PlanPolicyRecompileV0 } from "../../recompile";

test("recorded D2 rollback scenario is event-volume normalized", () => {
  const scenario = makeRecordedPolicyRollbackD2ScenarioV0();

  assertRecordedPolicyRollbackD2ScenarioV0(scenario);
  equal(scenario.schema, POLICY_ROLLBACK_D2_SCENARIO_SCHEMA_V0);
  equal(scenario.v, POLICY_ROLLBACK_D2_SCENARIO_VERSION_V0);
  equal(scenario.fresh_policy.judged_activations_before_trip, 3);
  equal(scenario.last_known_good_policy.judged_activations_before_trip, 9);
  ok(
    Date.parse(scenario.fresh_policy.first_trip_at) -
      Date.parse(scenario.fresh_policy.activated_at) >
      Date.parse(scenario.last_known_good_policy.first_trip_at) -
        Date.parse(scenario.last_known_good_policy.activated_at),
  );
});

test("Cradle D2 rollback proof rolls back to last-known-good without gateways", async () => {
  const scenario = makeRecordedPolicyRollbackD2ScenarioV0();
  const proof = await runRecordedPolicyRollbackD2ProofV0({
    scenario,
    planPolicyRollbackV0: createRecordedPolicyRollbackPlannerDoubleV0(),
  });

  equal(proof.decision.outcome, "rollback");
  equal(
    proof.decision.target_policy_revision,
    scenario.last_known_good_policy.policy_revision,
  );
  equal(
    proof.decision.fresh_policy_judged_activations_before_trip,
    scenario.fresh_policy.judged_activations_before_trip,
  );
  equal(
    proof.decision.last_known_good_judged_activations_before_trip,
    scenario.last_known_good_policy.judged_activations_before_trip,
  );
  equal(proof.gateway_invocations.agent_launch_count, 0);
  equal(proof.gateway_invocations.model_gateway_invocation_count, 0);
});

test("Worker A planPolicyRollbackV0 integrates with the recorded D2 rollback proof", async () => {
  const planPolicyRollbackV0 = loadWorkerAPlanPolicyRollbackV0();
  const proof = await runRecordedPolicyRollbackD2ProofV0({ planPolicyRollbackV0 });

  equal(proof.decision.outcome, "rollback");
  equal(
    proof.decision.target_policy_revision,
    proof.scenario.last_known_good_policy.policy_revision,
  );
  equal(proof.gateway_invocations.agent_launch_count, 0);
  equal(proof.gateway_invocations.model_gateway_invocation_count, 0);
});

test("recorded D2 plan-incomplete scenario omits a real dependency until deep roam", () => {
  const scenario = makeRecordedPlanIncompleteD2ScenarioV0();

  assertRecordedPlanIncompleteD2ScenarioV0(scenario);
  equal(scenario.schema, PLAN_INCOMPLETE_D2_SCENARIO_SCHEMA_V0);
  equal(scenario.v, PLAN_INCOMPLETE_D2_SCENARIO_VERSION_V0);
  deepEqual(
    scenario.incomplete_plan.sources.map((source) => source.id),
    ["incident-feed", "plan-age-clock"],
  );
  equal(scenario.deep_roam_discovery.source_id, PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID);
  equal(
    scenario.deep_roam_discovery.receipt_hash,
    scenario.missing_dependency_receipt.content_hash,
  );
  equal(
    scenario.policy_artifact.falsification_predicate.kind,
    "greater-than-or-equal",
  );
  if (scenario.policy_artifact.falsification_predicate.kind !== "greater-than-or-equal") {
    throw new Error("expected simple plan-incomplete predicate");
  }
  equal(
    scenario.policy_artifact.falsification_predicate.fact,
    PLAN_INCOMPLETE_D2_BACKSTOP_FACT,
  );
});

test("plan-incomplete proof routes deep-roam discovery to the existing P3 recompile planner", async () => {
  const planPolicyRecompileV0 = loadWorkerAPlanPolicyRecompileV0();
  const proof = await runRecordedPlanIncompleteD2ProofV0({ planPolicyRecompileV0 });

  equal(proof.shallow.outcome, "ready");
  ok(
    proof.shallow.consulted_source_ids.every(
      (sourceId) => sourceId !== PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID,
    ),
  );
  equal(proof.deep_roam.outcome, "force-recompile");
  deepEqual(proof.deep_roam.discovered_source_ids, [
    PLAN_INCOMPLETE_D2_MISSING_SOURCE_ID,
  ]);
  deepEqual(proof.deep_roam.discovered_receipt_hashes, [
    proof.scenario.missing_dependency_receipt.content_hash,
  ]);
  equal(proof.recompile_request.outcome, "recompile-requested");
  equal(proof.recompile_request.drift_outcome, "tripped");
  ok(
    proof.recompile_request.evidence_receipt_hashes.includes(
      proof.scenario.plan_incomplete_receipt.content_hash,
    ),
  );
  equal(proof.gateway_invocations.agent_launch_count, 0);
  equal(proof.gateway_invocations.model_gateway_invocation_count, 0);
});

function loadWorkerAPlanPolicyRollbackV0(): PlanPolicyRollbackV0 {
  const policyModule = loadWorkerAPolicyModule();
  const planPolicyRollbackV0 = policyModule["planPolicyRollbackV0"];

  if (typeof planPolicyRollbackV0 !== "function") {
    throw new Error("Worker A policy module must export planPolicyRollbackV0");
  }

  return planPolicyRollbackV0 as PlanPolicyRollbackV0;
}

function loadWorkerAPlanPolicyRecompileV0(): PlanPolicyRecompileV0 {
  const policyModule = loadWorkerAPolicyModule();
  const planPolicyRecompileV0 = policyModule["planPolicyRecompileV0"];

  if (typeof planPolicyRecompileV0 !== "function") {
    throw new Error("Worker A policy module must export planPolicyRecompileV0");
  }

  return planPolicyRecompileV0 as PlanPolicyRecompileV0;
}

function loadWorkerAPolicyModule(): Readonly<Record<string, unknown>> {
  let policyModule: unknown;

  try {
    policyModule = require("@openprose/reactor/policy") as unknown;
  } catch (packageError) {
    try {
      policyModule = require(join(
        process.cwd(),
        "../reactor/dist/policy",
      )) as unknown;
    } catch (distError) {
      throw new Error(
        [
          "Worker A policy API is required for this D2 integration proof",
          `package load: ${errorMessage(packageError)}`,
          `dist load: ${errorMessage(distError)}`,
        ].join("; "),
      );
    }
  }

  if (!isRecord(policyModule)) {
    throw new Error("Worker A policy module must export an object");
  }

  return policyModule;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "module load failed";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
