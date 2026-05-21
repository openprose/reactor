import { createHash } from "node:crypto";
import { join } from "node:path";
import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import type {
  ContentHashV0,
  ReceiptEventCauseV0,
  ReceiptRoleV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";
import type {
  ReactorAgentRequestV0,
  ReactorAgentResponseV0,
} from "@openprose/reactor/sdk";

import {
  POLICY_AUTHOR_AGENT_CASSETTE_SCHEMA_V0,
  POLICY_AUTHOR_AGENT_CASSETTE_VERSION_V0,
  type AuthorPolicyArtifactV0,
  type PolicyAuthorAgentHandlerV0,
  type PolicyLiveObservableV0,
  createRecordingPolicyAuthorAgentSdkV0,
  createReplayPolicyAuthorAgentSdkV0,
  observePolicyAuthorP1CassetteV0,
  runRecordedPolicyAuthorP1ProofV0,
} from "../index";

const RESPONSIBILITY_ID = "incident-channel-current-briefing";
const CONTRACT_SOURCE = [
  "kind: responsibility",
  "Goal: The incident channel has a current, accurate briefing.",
  "Criteria: impact, timeline, owner, next action, and customer-facing status are current.",
].join("\n");
const CONTRACT_REVISION = hashText(CONTRACT_SOURCE);
const AS_OF = "2026-05-18T12:00:00.000Z";
const LIVE_OBSERVABLES: readonly PolicyLiveObservableV0[] = [
  {
    id: "source.incident_channel.material_update_count_1h",
    source: "connector",
    description: "count of material incident channel updates in the last hour",
  },
  {
    id: "kernel.deep_shallow_contradiction_count_7d",
    source: "kernel-backstop",
    description: "B2 deep revalidation contradiction count",
  },
  {
    id: "cost.fresh_tokens_per_maintained_day",
    source: "cost-ledger",
    description: "fresh policy maintenance tokens per day",
  },
];

test("policy-author agent double records and replays exact two-step P1 exchanges", () => {
  const receipts = makeReceiptHistory();
  const authoredArtifact = makeAuthoredPolicyArtifact([
    receipts[1]?.content_hash ?? fail("expected second receipt"),
  ]);
  const handler = makeScriptedPolicyAuthorHandler(authoredArtifact, [
    receipts[1]?.content_hash ?? fail("expected second receipt"),
  ]);
  const recording = createRecordingPolicyAuthorAgentSdkV0(handler);

  const historyResponse = recording.adapter.launch(makeHistoryQueryRequest(receipts));
  const artifactResponse = recording.adapter.launch(
    makeArtifactAuthoringRequest(receipts),
  );

  const cassette = recording.cassette;
  equal(cassette.schema, POLICY_AUTHOR_AGENT_CASSETTE_SCHEMA_V0);
  equal(cassette.v, POLICY_AUTHOR_AGENT_CASSETTE_VERSION_V0);
  equal(cassette.exchanges.length, 2);
  equal(recording.launch_count, 2);

  const observation = observePolicyAuthorP1CassetteV0(cassette);
  equal(observation.history_query_index, 0);
  equal(observation.artifact_authoring_index, 1);
  equal(observation.summary_only_history_query, true);

  const replay = createReplayPolicyAuthorAgentSdkV0(cassette);
  deepEqual(replay.adapter.launch(makeHistoryQueryRequest(receipts)), historyResponse);
  deepEqual(
    replay.adapter.launch(makeArtifactAuthoringRequest(receipts)),
    artifactResponse,
  );
  equal(replay.launch_count, 2);
  equal(replay.remaining, 0);
  replay.assertConsumed();

  throws(
    () => replay.adapter.launch(makeHistoryQueryRequest(receipts)),
    /policy author replay exhausted at exchange 2; cassette has 2 exchanges/,
  );
});

test("policy-author replay fails closed on one-shot artifact authoring", () => {
  const receipts = makeReceiptHistory();
  const authoredArtifact = makeAuthoredPolicyArtifact([
    receipts[1]?.content_hash ?? fail("expected second receipt"),
  ]);
  const recording = createRecordingPolicyAuthorAgentSdkV0(() => ({
    payload: {
      schema: "openprose.reactor.policy-author.artifact-response",
      v: 0,
      artifact: authoredArtifact,
    },
  }));

  recording.adapter.launch(makeArtifactAuthoringRequest(receipts));

  throws(
    () => observePolicyAuthorP1CassetteV0(recording.cassette),
    /must include at least history-query and artifact-authoring exchanges|never requested receipt history/,
  );
});

test("Worker A authorPolicyArtifactV0 records then replays without live agent calls", async () => {
  const authorPolicyArtifactV0 = loadWorkerAAuthorPolicyArtifactV0();
  const receipts = makeReceiptHistory();
  const selectedReceiptHashes = [
    receipts[1]?.content_hash ?? fail("expected second receipt"),
  ];
  const authoredArtifact = makeAuthoredPolicyArtifact(selectedReceiptHashes);
  let scriptedHandlerCalls = 0;
  const handler: PolicyAuthorAgentHandlerV0 = (request, context) => {
    scriptedHandlerCalls += 1;
    return makeScriptedPolicyAuthorHandler(authoredArtifact, selectedReceiptHashes)(
      request,
      context,
    );
  };

  const proof = await runRecordedPolicyAuthorP1ProofV0({
    authorPolicyArtifactV0,
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_REVISION,
    contract_summary: CONTRACT_SOURCE,
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    receipt_history: receipts,
    as_of: AS_OF,
    handler,
  });

  equal(proof.observation.history_query_index, 0);
  equal(proof.observation.artifact_authoring_index, 1);
  equal(proof.replay_launch_count, proof.cassette.exchanges.length);
  equal(scriptedHandlerCalls, proof.cassette.exchanges.length);
  equal(proof.recorded_snapshot_hash, proof.replayed_snapshot_hash);
  deepEqual(proof.recorded_snapshot, proof.replayed_snapshot);
  equal(proof.registry.validation_state, "validated");
  equal(proof.registry.artifact_bytes_canonical, true);
  ok(proof.registry.policy_artifact_content_hash.startsWith("sha256:"));
});

function loadWorkerAAuthorPolicyArtifactV0(): AuthorPolicyArtifactV0 {
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
          "Worker A policy API is required for this P1 integration proof",
          `package load: ${errorMessage(packageError)}`,
          `dist load: ${errorMessage(distError)}`,
        ].join("; "),
      );
    }
  }

  if (!isRecord(policyModule)) {
    throw new Error("Worker A policy module must export an object");
  }

  const authorPolicyArtifactV0 = policyModule["authorPolicyArtifactV0"];
  if (typeof authorPolicyArtifactV0 !== "function") {
    throw new Error(
      "Worker A policy module must export authorPolicyArtifactV0",
    );
  }

  return authorPolicyArtifactV0 as AuthorPolicyArtifactV0;
}

function makeScriptedPolicyAuthorHandler(
  authoredArtifact: Readonly<Record<string, unknown>>,
  selectedReceiptHashes: readonly ContentHashV0[],
): PolicyAuthorAgentHandlerV0 {
  return (
    request: ReactorAgentRequestV0,
    context,
  ): ReactorAgentResponseV0 => {
    equal(request.kind, "policy-author");

    if (context.exchange_index === 0) {
      return {
        payload: {
          schema: "openprose.reactor.policy-author.history-query",
          v: 0,
          selected_receipt_hashes: selectedReceiptHashes,
          rationale:
            "recent plan-age recheck is the only receipt needed for P1 policy calibration",
        },
      };
    }

    if (context.exchange_index === 1) {
      return {
        payload: {
          schema: "openprose.reactor.policy-author.artifact-response",
          v: 0,
          artifact: authoredArtifact,
        },
      };
    }

    throw new Error(`unexpected policy-author launch ${context.exchange_index}`);
  };
}

function makeHistoryQueryRequest(
  receipts: readonly ReceiptV0[],
): ReactorAgentRequestV0 {
  return {
    kind: "policy-author",
    payload: {
      step: "history-query",
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_REVISION,
      receipt_summary: receipts.map((receipt) => ({
        content_hash: receipt.content_hash,
        as_of: receipt.core.as_of,
        event_cause: receipt.core.event_cause,
        role: receipt.core.role,
        status: receipt.verdict.status,
        tags: receipt.cost.tags,
      })),
    },
  };
}

function makeArtifactAuthoringRequest(
  receipts: readonly ReceiptV0[],
): ReactorAgentRequestV0 {
  const selected = receipts[1];
  if (selected === undefined) {
    throw new Error("expected selected receipt");
  }

  return {
    kind: "policy-author",
    payload: {
      step: "artifact-authoring",
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_REVISION,
      selected_receipts: [selected],
    },
  };
}

function makeReceiptHistory(): readonly ReceiptV0[] {
  return [
    makeReceipt({
      memo_key: "memo:bootstrap",
      as_of: "2026-05-18T10:00:00.000Z",
      next_forecast_recheck: "2026-05-18T11:00:00.000Z",
      role: "judge",
      event_cause: "real-input",
      evidence_input_ids: [hashText("incident-channel-bootstrap")],
      status: "up",
      fresh: 231,
      reused: 0,
    }),
    makeReceipt({
      memo_key: "memo:plan-age-recheck",
      as_of: "2026-05-18T11:00:00.000Z",
      next_forecast_recheck: "2026-05-18T17:00:00.000Z",
      role: "judge",
      event_cause: "forecast-recheck",
      evidence_input_ids: [hashText("incident-channel-plan-age")],
      status: "up",
      fresh: 0,
      reused: 231,
    }),
  ];
}

function makeReceipt(input: {
  readonly memo_key: string;
  readonly as_of: string;
  readonly next_forecast_recheck: string;
  readonly role: ReceiptRoleV0;
  readonly event_cause: ReceiptEventCauseV0;
  readonly evidence_input_ids: readonly ContentHashV0[];
  readonly status: "up" | "drifting" | "down" | "blocked";
  readonly fresh: number;
  readonly reused: number;
}): ReceiptV0 {
  const payload: Omit<ReceiptV0, "content_hash"> = {
    schema: "openprose.receipt",
    v: 0,
    hash_algorithm: "sha256",
    core: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_REVISION,
      event_cause: input.event_cause,
      ...(input.event_cause === "forecast-recheck"
        ? { recheck_kind: "plan-age" as const }
        : {}),
      memo_key: input.memo_key,
      evidence_input_ids: input.evidence_input_ids,
      as_of: input.as_of,
      role: input.role,
    },
    sig: {
      scheme: "none",
      null_reason: "cradle recorded P1 policy-author proof",
    },
    verdict: {
      status: input.status,
      confidence: {
        value: 0.82,
        derivation_method: "recorded-cradle-double",
        calibration_grade: "none",
        label_source: "none",
      },
    },
    freshness: {
      as_of: input.as_of,
      next_forecast_recheck: input.next_forecast_recheck,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "cradle",
      model: "recorded-policy-author-double",
      role: input.role,
      tags: ["policy-author-p1", input.memo_key],
      responsibility_id: RESPONSIBILITY_ID,
      run_id: "policy-author-p1-recorded",
      as_of: input.as_of,
      tokens: {
        fresh: input.fresh,
        reused: input.reused,
      },
      surprise_cause: input.event_cause,
    },
  };

  return {
    ...payload,
    content_hash: hashCanonical(renderCanonical(payload)),
  };
}

function makeAuthoredPolicyArtifact(
  exploredReceiptHashes: readonly ContentHashV0[],
): Readonly<Record<string, unknown>> {
  return {
    schema: "openprose.reactor.policy-artifact",
    v: 0,
    responsibility_id: RESPONSIBILITY_ID,
    registry_id: "incident-briefing-policy-registry",
    policy_revision: "policy-rev-2026-05-18T12:00:00.000Z",
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    cadence: {
      shallow_recheck_ms: 15 * 60 * 1000,
      plan_audit_ms: 6 * 60 * 60 * 1000,
      deep_revalidation_ms: 7 * 24 * 60 * 60 * 1000,
    },
    hysteresis: {
      min_recompile_interval_ms: 60 * 60 * 1000,
      enter_degraded_threshold: 0.34,
      exit_degraded_threshold: 0.18,
      warmup_judged_activations: 5,
    },
    thresholds: {
      max_calibration_divergence_multiplier: 1.6,
      escalation_precision_floor: 0.7,
      backstop_deep_contradiction_count: 1,
      stale_brief_minutes: 30,
      fresh_tokens_per_day_ceiling: 4000,
    },
    falsification_predicate: {
      kind: "greater-than-or-equal",
      fact: "cost.fresh_tokens_per_maintained_day",
      value: 4000,
    },
    backstop_divergence_predicate: {
      kind: "greater-than-or-equal",
      fact: "kernel.deep_shallow_contradiction_count_7d",
      value: 1,
    },
  };
}

function hashText(value: string): ContentHashV0 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hashCanonical(value: string): ContentHashV0 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function renderCanonical(value: unknown): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("Cannot canonicalize non-finite numbers");
      }
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => renderCanonical(item)).join(",")}]`;
      }
      if (!isRecord(value)) {
        throw new TypeError("Cannot canonicalize non-plain objects");
      }
      return `{${Object.keys(value)
        .sort()
        .map((key) => {
          const item = value[key];
          if (item === undefined) {
            throw new TypeError(`Cannot canonicalize undefined field ${key}`);
          }
          return `${JSON.stringify(key)}:${renderCanonical(item)}`;
        })
        .join(",")}}`;
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`Cannot canonicalize ${typeof value}`);
  }

  throw new TypeError("Cannot canonicalize unknown value");
}

function fail(message: string): never {
  throw new Error(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "module load failed";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
