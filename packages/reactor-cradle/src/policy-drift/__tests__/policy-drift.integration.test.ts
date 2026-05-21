import { deepEqual, equal, ok } from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import type {
  ContentHashV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";
import type { AuthoredPolicyArtifactV0 } from "@openprose/reactor/policy";

import {
  POLICY_DRIFT_P2_BACKSTOP_FACT,
  POLICY_DRIFT_P2_COST_FACT,
  POLICY_DRIFT_P2_OFF_LOG_FACT,
  POLICY_DRIFT_P2_SCENARIO_SCHEMA_V0,
  POLICY_DRIFT_P2_SCENARIO_VERSION_V0,
  type EvaluatePolicyDriftV0,
  type PolicyDriftEvaluatorInputV0,
  assertRecordedPolicyDriftP2ScenarioV0,
  makeRecordedPolicyDriftP2ScenarioV0,
  runRecordedPolicyDriftP2ProofV0,
} from "../index";

test("recorded P2 policy-drift scenario carries valid artifacts and receipts", () => {
  const scenario = makeRecordedPolicyDriftP2ScenarioV0();

  assertRecordedPolicyDriftP2ScenarioV0(scenario);
  equal(scenario.schema, POLICY_DRIFT_P2_SCENARIO_SCHEMA_V0);
  equal(scenario.v, POLICY_DRIFT_P2_SCENARIO_VERSION_V0);
  equal(scenario.receipt_history.length, 3);
  ok(scenario.cost_drift_artifact_content_hash.startsWith("sha256:"));
  ok(scenario.off_log_artifact_content_hash.startsWith("sha256:"));

  equal(
    scenario.cost_drift_artifact.falsification_predicate.kind,
    "greater-than-or-equal",
  );
  equal(
    scenario.off_log_artifact.falsification_predicate.kind,
    "greater-than-or-equal",
  );
  if (
    scenario.cost_drift_artifact.falsification_predicate.kind !==
      "greater-than-or-equal" ||
    scenario.off_log_artifact.falsification_predicate.kind !==
      "greater-than-or-equal"
  ) {
    throw new Error("expected simple numeric drift predicates");
  }

  equal(
    scenario.cost_drift_artifact.falsification_predicate.fact,
    POLICY_DRIFT_P2_COST_FACT,
  );
  equal(
    scenario.off_log_artifact.falsification_predicate.fact,
    POLICY_DRIFT_P2_OFF_LOG_FACT,
  );
  equal(
    scenario.cost_drift_artifact.backstop_divergence_predicate?.kind,
    "greater-than-or-equal",
  );
  if (
    scenario.cost_drift_artifact.backstop_divergence_predicate?.kind !==
    "greater-than-or-equal"
  ) {
    throw new Error("expected simple backstop predicate");
  }
  equal(
    scenario.cost_drift_artifact.backstop_divergence_predicate.fact,
    POLICY_DRIFT_P2_BACKSTOP_FACT,
  );
});

test("Cradle P2 proof asserts trip, indeterminate off-log fact, and zero gateways", () => {
  const scenario = makeRecordedPolicyDriftP2ScenarioV0();
  const proof = runRecordedPolicyDriftP2ProofV0({
    scenario,
    evaluatePolicyDriftV0: makeRecordedEvaluatorDouble(),
  });

  equal(proof.cost_drift.outcome, "tripped");
  equal(proof.cost_drift.predicate.outcome, "tripped");
  equal(proof.cost_drift.facts[POLICY_DRIFT_P2_COST_FACT], 1725);
  deepEqual(
    proof.cost_drift.evidence_receipt_hashes,
    scenario.receipt_history.map((receipt) => receipt.content_hash),
  );

  equal(proof.off_log.outcome, "indeterminate");
  equal(proof.off_log.predicate.outcome, "indeterminate");
  deepEqual(proof.off_log.missing_fact_ids, [POLICY_DRIFT_P2_OFF_LOG_FACT]);
  equal(proof.gateway_invocations.agent_launch_count, 0);
  equal(proof.gateway_invocations.model_gateway_invocation_count, 0);
});

test("Worker A evaluatePolicyDriftV0 trips from recorded cost facts and fails safe off-log", () => {
  const evaluatePolicyDriftV0 = loadWorkerAEvaluatePolicyDriftV0();
  const proof = runRecordedPolicyDriftP2ProofV0({ evaluatePolicyDriftV0 });

  equal(proof.cost_drift.outcome, "tripped");
  equal(proof.cost_drift.predicate.outcome, "tripped");
  ok(
    typeof proof.cost_drift.facts[POLICY_DRIFT_P2_COST_FACT] === "number" &&
      proof.cost_drift.facts[POLICY_DRIFT_P2_COST_FACT] >= 500,
  );
  ok(proof.cost_drift.evidence_receipt_hashes.length > 0);

  equal(proof.off_log.outcome, "indeterminate");
  equal(proof.off_log.predicate.outcome, "indeterminate");
  ok(
    new Set([
      ...proof.off_log.missing_fact_ids,
      ...proof.off_log.unsupported_fact_ids,
    ]).has(POLICY_DRIFT_P2_OFF_LOG_FACT),
  );
  equal(proof.gateway_invocations.agent_launch_count, 0);
  equal(proof.gateway_invocations.model_gateway_invocation_count, 0);
});

function makeRecordedEvaluatorDouble(): EvaluatePolicyDriftV0 {
  return (input: PolicyDriftEvaluatorInputV0): unknown => {
    if (isCostDriftArtifact(input.artifact)) {
      return {
        outcome: "tripped",
        facts: {
          [POLICY_DRIFT_P2_COST_FACT]: 1725,
          [POLICY_DRIFT_P2_BACKSTOP_FACT]: 0,
          "receipt.escalation_precision_7d": 0.5,
        },
        evidence_receipt_hashes: input.receipts.map(
          (receipt) => receipt.content_hash,
        ),
        predicate_evaluation: {
          outcome: "tripped",
        },
      };
    }

    return {
      outcome: "indeterminate",
      facts: {
        [POLICY_DRIFT_P2_COST_FACT]: 1725,
        [POLICY_DRIFT_P2_BACKSTOP_FACT]: 0,
      },
      evidence_receipt_hashes: firstReceiptHash(input.receipts),
      predicate_evaluation: {
        outcome: "indeterminate",
        reason: "off-log live observable is not derivable from receipt history",
      },
      missing_fact_ids: [POLICY_DRIFT_P2_OFF_LOG_FACT],
      unsupported_fact_ids: [],
    };
  };
}

function loadWorkerAEvaluatePolicyDriftV0(): EvaluatePolicyDriftV0 {
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
          "Worker A policy API is required for this P2 integration proof",
          `package load: ${errorMessage(packageError)}`,
          `dist load: ${errorMessage(distError)}`,
        ].join("; "),
      );
    }
  }

  if (!isRecord(policyModule)) {
    throw new Error("Worker A policy module must export an object");
  }

  const evaluatePolicyDriftV0 = policyModule["evaluatePolicyDriftV0"];
  if (typeof evaluatePolicyDriftV0 !== "function") {
    throw new Error(
      "Worker A policy module must export evaluatePolicyDriftV0",
    );
  }

  return evaluatePolicyDriftV0 as EvaluatePolicyDriftV0;
}

function isCostDriftArtifact(artifact: AuthoredPolicyArtifactV0): boolean {
  return (
    artifact.falsification_predicate.kind === "greater-than-or-equal" &&
    artifact.falsification_predicate.fact === POLICY_DRIFT_P2_COST_FACT
  );
}

function firstReceiptHash(receipts: readonly ReceiptV0[]): readonly ContentHashV0[] {
  const receipt = receipts[0];
  if (receipt === undefined) {
    throw new Error("expected at least one receipt");
  }

  return [receipt.content_hash];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "module load failed";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
