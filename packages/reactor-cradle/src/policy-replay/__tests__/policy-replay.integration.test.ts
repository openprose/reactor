import { equal, ok, rejects, throws } from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import type { ContentHashV0 } from "@openprose/reactor/receipt";
import type { ReactorRegistrySnapshotV0 } from "@openprose/reactor/sdk";

import {
  POLICY_REPLAY_P5_SCENARIO_SCHEMA_V0,
  POLICY_REPLAY_P5_SCENARIO_VERSION_V0,
  assertRecordedPolicyReplayP5ScenarioV0,
  createRecordedArtifactPolicyRecompileReplayV0,
  makeRecordedPolicyReplayP5ScenarioV0,
  readRecordedPolicyArtifactFromRegistryV0,
  runRecordedPolicyReplayP5ProofV0,
} from "../index";
import {
  createRecordedPolicyRecompilePlannerDoubleV0,
  type PlanPolicyRecompileV0,
} from "../../recompile";

test("recorded P5 scenario uses registry artifact bytes and content hash as authority", () => {
  const scenario = makeRecordedPolicyReplayP5ScenarioV0();
  const authority = readRecordedPolicyArtifactFromRegistryV0(
    scenario.recorded_registry_snapshot,
  );

  assertRecordedPolicyReplayP5ScenarioV0(scenario);
  equal(scenario.schema, POLICY_REPLAY_P5_SCENARIO_SCHEMA_V0);
  equal(scenario.v, POLICY_REPLAY_P5_SCENARIO_VERSION_V0);
  equal(scenario.source_policy_loop, "p3-recorded-recompile");
  equal(authority.source, "recorded-registry-snapshot-bytes");
  equal(authority.bytes, scenario.recorded_policy_artifact_bytes);
  equal(authority.content_hash, scenario.recorded_policy_artifact_content_hash);
  equal(authority.revision, scenario.recorded_registry_snapshot.policy_artifact_revision);
  equal(authority.artifact.policy_revision, authority.revision);
  ok(authority.byte_length > 0);
  ok(authority.content_hash.startsWith("sha256:"));
});

test("P5 proof replays from recorded artifact bytes with gateways withheld", async () => {
  const scenario = makeRecordedPolicyReplayP5ScenarioV0();
  const proof = await runRecordedPolicyReplayP5ProofV0({
    scenario,
    replayRecordedPolicyV0: createRecordedArtifactPolicyRecompileReplayV0(
      createRecordedPolicyRecompilePlannerDoubleV0(),
    ),
  });

  equal(proof.replay_authority.source, "recorded-registry-snapshot-bytes");
  equal(
    proof.replay_authority.content_hash,
    scenario.recorded_policy_artifact_content_hash,
  );
  equal(proof.replay_authority.artifact_bytes_canonical, true);
  equal(proof.replay_authority.content_hash_verified, true);
  equal(proof.replay_decision.outcome, "recompile-delayed");
  equal(proof.replay_decision.drift_outcome, "tripped");
  equal(proof.gateway_invocations.agent_launch_count, 0);
  equal(proof.gateway_invocations.model_gateway_invocation_count, 0);
  equal(proof.policy_author_invocation_count, 0);
});

test("Worker A planPolicyRecompileV0 replays P5 artifact without re-authoring", async () => {
  const proof = await runRecordedPolicyReplayP5ProofV0({
    replayRecordedPolicyV0: createRecordedArtifactPolicyRecompileReplayV0(
      loadWorkerAPlanPolicyRecompileV0(),
    ),
  });

  equal(proof.replay_decision.outcome, "recompile-delayed");
  equal(proof.replay_decision.drift_outcome, "tripped");
  equal(proof.gateway_invocations.agent_launch_count, 0);
  equal(proof.gateway_invocations.model_gateway_invocation_count, 0);
  equal(proof.policy_author_invocation_count, 0);
});

test("P5 replay fails closed when recorded artifact bytes or hash are stale or missing", () => {
  const scenario = makeRecordedPolicyReplayP5ScenarioV0();
  const staleHash = `sha256:${"0".repeat(64)}` as ContentHashV0;
  const staleHashScenario = {
    ...scenario,
    recorded_registry_snapshot: {
      ...scenario.recorded_registry_snapshot,
      policy_artifact_content_hash: staleHash,
    },
    recorded_policy_artifact_content_hash: staleHash,
  };
  const missingBytesScenario = {
    ...scenario,
    recorded_registry_snapshot: withoutPolicyArtifactBytes(
      scenario.recorded_registry_snapshot,
    ),
    recorded_policy_artifact_bytes: "",
  };
  const staleNamespaceScenario = {
    ...scenario,
    recorded_registry_snapshot: withoutPolicyArtifactAliases({
      ...scenario.recorded_registry_snapshot,
      policy_artifact_namespace: "registry.different",
    }),
  };

  throws(
    () => assertRecordedPolicyReplayP5ScenarioV0(staleHashScenario),
    /recorded artifact content hash is stale/,
  );
  throws(
    () => assertRecordedPolicyReplayP5ScenarioV0(missingBytesScenario),
    /must carry recorded policy artifact bytes/,
  );
  throws(
    () => assertRecordedPolicyReplayP5ScenarioV0(staleNamespaceScenario),
    /registry namespace does not match recorded artifact bytes/,
  );
});

test("P5 proof fails if replay tries to re-author or touch inference gateways", async () => {
  const scenario = makeRecordedPolicyReplayP5ScenarioV0();

  await rejects(
    () =>
      runRecordedPolicyReplayP5ProofV0({
        scenario,
        replayRecordedPolicyV0(input) {
          return input.authorPolicyArtifactV0(input.author_input);
        },
      }),
    /must not re-author policy artifacts/,
  );
  await rejects(
    () =>
      runRecordedPolicyReplayP5ProofV0({
        scenario,
        replayRecordedPolicyV0(input) {
          return input.modelGateway.invoke({
            kind: "policy-compile",
            payload: { reason: "negative P5 replay test" },
          });
        },
      }),
    /must not call model gateway/,
  );
  await rejects(
    () =>
      runRecordedPolicyReplayP5ProofV0({
        scenario,
        replayRecordedPolicyV0(input) {
          return input.agentSdk.launch({
            kind: "policy-author",
            payload: { reason: "negative P5 replay test" },
          });
        },
      }),
    /must not launch agent SDK/,
  );
});

function withoutPolicyArtifactBytes(
  snapshot: ReactorRegistrySnapshotV0,
): ReactorRegistrySnapshotV0 {
  const mutable = { ...snapshot } as Record<string, unknown>;
  delete mutable["policy_artifact_bytes"];

  return mutable as unknown as ReactorRegistrySnapshotV0;
}

function withoutPolicyArtifactAliases(
  snapshot: ReactorRegistrySnapshotV0,
): ReactorRegistrySnapshotV0 {
  const mutable = { ...snapshot } as Record<string, unknown>;
  delete mutable["policy_artifact_id"];
  delete mutable["policy_artifact_identity"];

  return mutable as unknown as ReactorRegistrySnapshotV0;
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
          "Worker A policy API is required for this P5 integration proof",
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
