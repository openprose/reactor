import { deepEqual, equal, ok } from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import {
  POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_SCHEMA_V0,
  POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_VERSION_V0,
  POLICY_RECOMPILE_D1_SCENARIO_SCHEMA_V0,
  POLICY_RECOMPILE_D1_SCENARIO_VERSION_V0,
  type ExecutePolicyRecompileV0,
  type PlanPolicyRecompileV0,
  assertRecordedPolicyRecompileD1ScenarioV0,
  createRecordedPolicyRecompileExecutorDoubleV0,
  createRecordedPolicyRecompilePlannerDoubleV0,
  makeRecordedPolicyRecompileD1ScenarioV0,
  runRecordedPolicyRecompileD1ProofV0,
} from "../index";

test("recorded D1 recompile scenario uses the same P2 predicate trip with two interval variants", () => {
  const scenario = makeRecordedPolicyRecompileD1ScenarioV0();

  assertRecordedPolicyRecompileD1ScenarioV0(scenario);
  equal(scenario.schema, POLICY_RECOMPILE_D1_SCENARIO_SCHEMA_V0);
  equal(scenario.v, POLICY_RECOMPILE_D1_SCENARIO_VERSION_V0);
  equal(scenario.receipt_history.length, scenario.drift_scenario.receipt_history.length);
  equal(
    scenario.policy_artifact.policy_revision,
    scenario.drift_scenario.cost_drift_artifact.policy_revision,
  );
  ok(scenario.policy_artifact_content_hash.startsWith("sha256:"));
  ok(
    scenario.recompiled_registry_snapshot.policy_artifact_content_hash?.startsWith(
      "sha256:",
    ),
  );
});

test("Cradle D1 proof requests once when allowed and delays without author/model calls", async () => {
  const scenario = makeRecordedPolicyRecompileD1ScenarioV0();
  const proof = await runRecordedPolicyRecompileD1ProofV0({
    scenario,
    planPolicyRecompileV0: createRecordedPolicyRecompilePlannerDoubleV0(),
    executePolicyRecompileV0: createRecordedPolicyRecompileExecutorDoubleV0(),
  });

  equal(proof.requested.outcome, "recompile-requested");
  equal(proof.delayed.outcome, "recompile-delayed");
  equal(proof.requested_execution.outcome, "recompiled");
  equal(proof.delayed_execution.outcome, "skipped");
  equal(proof.requested_policy_author_invocation_count, 1);
  equal(proof.delayed_policy_author_invocation_count, 0);
  equal(proof.requested_author_cassette.schema, POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_SCHEMA_V0);
  equal(proof.requested_author_cassette.v, POLICY_RECOMPILE_D1_AUTHOR_CASSETTE_VERSION_V0);
  equal(proof.requested_author_cassette.invocations.length, 1);
  deepEqual(proof.delayed_author_cassette.invocations, []);
  equal(proof.gateway_invocations.requested.agent_launch_count, 0);
  equal(proof.gateway_invocations.requested.model_gateway_invocation_count, 0);
  equal(proof.gateway_invocations.delayed.agent_launch_count, 0);
  equal(proof.gateway_invocations.delayed.model_gateway_invocation_count, 0);
});

test("Worker A P3 API plans requested vs delayed and executes only the requested path", async () => {
  const { planPolicyRecompileV0, executePolicyRecompileV0 } =
    loadWorkerAPolicyRecompileApiV0();
  const proof = await runRecordedPolicyRecompileD1ProofV0({
    planPolicyRecompileV0,
    executePolicyRecompileV0,
  });

  equal(proof.requested.outcome, "recompile-requested");
  equal(proof.requested_policy_author_invocation_count, 1);
  equal(proof.delayed.outcome, "recompile-delayed");
  equal(proof.delayed_policy_author_invocation_count, 0);
  equal(proof.gateway_invocations.requested.agent_launch_count, 0);
  equal(proof.gateway_invocations.delayed.agent_launch_count, 0);
});

function loadWorkerAPolicyRecompileApiV0(): {
  readonly planPolicyRecompileV0: PlanPolicyRecompileV0;
  readonly executePolicyRecompileV0: ExecutePolicyRecompileV0;
} {
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
          "Worker A policy API is required for this D1 integration proof",
          `package load: ${errorMessage(packageError)}`,
          `dist load: ${errorMessage(distError)}`,
        ].join("; "),
      );
    }
  }

  if (!isRecord(policyModule)) {
    throw new Error("Worker A policy module must export an object");
  }

  const planPolicyRecompileV0 = policyModule["planPolicyRecompileV0"];
  if (typeof planPolicyRecompileV0 !== "function") {
    throw new Error(
      "Worker A policy module must export planPolicyRecompileV0",
    );
  }

  const executePolicyRecompileV0 = policyModule["executePolicyRecompileV0"];
  if (typeof executePolicyRecompileV0 !== "function") {
    throw new Error(
      "Worker A policy module must export executePolicyRecompileV0",
    );
  }

  return {
    planPolicyRecompileV0: planPolicyRecompileV0 as PlanPolicyRecompileV0,
    executePolicyRecompileV0: executePolicyRecompileV0 as ExecutePolicyRecompileV0,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "module load failed";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
