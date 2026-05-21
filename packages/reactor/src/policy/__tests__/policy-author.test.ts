import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { createForecastRecheckReceiptV0 } from "../../forecast";
import {
  canonicalizeForReceiptV0,
  hashCanonicalReceiptV0,
  type ReceiptV0,
} from "../../receipt";
import type {
  ReactorAgentRequestV0,
  ReactorAgentResponseV0,
} from "../../sdk";
import * as rootSurface from "../../index";
import {
  POLICY_ARTIFACT_SCHEMA,
  POLICY_ARTIFACT_VALIDATOR_ID,
  POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA,
  POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
  authorPolicyArtifactV0,
  validatePolicyArtifactV0,
  type AuthoredPolicyArtifactV0,
  type PolicyAuthorRequestPayloadV0,
  type PolicyLiveObservableV0,
} from "../index";

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_HASH_A =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const EVIDENCE_HASH_B =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const RESPONSIBILITY_ID = "incident-channel-current-briefing";

test("policy author launches in two steps and returns canonical registry bytes", () => {
  const receipts = makeReceipts();
  const launches: ReactorAgentRequestV0[] = [];
  const selectedHash = receipts[1]?.content_hash;
  if (selectedHash === undefined) {
    throw new Error("fixture receipts missing selected hash");
  }
  const authoredTransitiveFreshness = {
    kind: "minimum-remaining-freshness-ms",
    minimum_remaining_ms: 6 * 60 * 60 * 1000,
  } satisfies AuthoredPolicyArtifactV0["transitive_freshness_function"];

  const registry = authorPolicyArtifactV0({
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_HASH,
    contract_summary: "The incident channel has a current, accurate briefing.",
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    receipt_history: receipts,
    policy_artifact_namespace: "policy.incident-channel-current-briefing",
    agentSdk: {
      launch: (request) => {
        launches.push(request);
        const payload = request.payload as PolicyAuthorRequestPayloadV0;

        if (payload.step === "history-query") {
          equal(Object.hasOwn(payload, "selected_receipts"), false);
          deepEqual(
            payload.receipt_history_summary.map((summary) => summary.content_hash),
            receipts.map((receipt) => receipt.content_hash),
          );

          return {
            payload: {
              schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
              v: 0,
              selected_receipt_hashes: [selectedHash],
              rationale: "latest receipt is enough to author the policy",
            },
          };
        }

        equal(payload.step, "author-artifact");
        deepEqual(
          payload.selected_receipts.map((receipt) => receipt.content_hash),
          [selectedHash],
        );
        equal(payload.history_query.selected_receipt_hashes[0], selectedHash);

        return {
          payload: {
            schema: POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA,
            v: 0,
            artifact: makeAuthoredPolicy({
              transitive_freshness_function: authoredTransitiveFreshness,
            }),
          },
        };
      },
    },
  });

  equal(launches.length, 2);
  equal(registry.contract_revision, CONTRACT_HASH);
  equal(registry.policy_artifact_id, "registry.incident-channel-current-briefing.v0");
  equal(
    registry.policy_artifact_namespace,
    "policy.incident-channel-current-briefing",
  );
  equal(registry.policy_artifact_revision, "policy.p1.test.1");
  deepEqual(registry.policy_artifact_validation_state, {
    status: "validated",
    validator_id: POLICY_ARTIFACT_VALIDATOR_ID,
  });
  deepEqual(Object.keys(registry).sort(), [
    "contract_revision",
    "policy_artifact_bytes",
    "policy_artifact_content_hash",
    "policy_artifact_id",
    "policy_artifact_identity",
    "policy_artifact_namespace",
    "policy_artifact_revision",
    "policy_artifact_validation_state",
    "transitive_freshness_function",
    "validation_state",
  ]);
  deepEqual(
    registry.transitive_freshness_function,
    authoredTransitiveFreshness,
  );

  const bytes = registry.policy_artifact_bytes;
  ok(bytes);
  equal(registry.policy_artifact_content_hash, hashCanonicalReceiptV0(bytes));

  const artifact = JSON.parse(bytes) as AuthoredPolicyArtifactV0;
  equal(artifact.schema, POLICY_ARTIFACT_SCHEMA);
  equal(artifact.responsibility_id, RESPONSIBILITY_ID);
  deepEqual(artifact.transitive_freshness_function, authoredTransitiveFreshness);
  deepEqual(artifact.provenance.explored_receipt_hashes, [selectedHash]);
  equal(artifact.provenance.contract_revision, CONTRACT_HASH);

  const validation = validatePolicyArtifactV0(artifact);
  equal(validation.ok, true);
  if (!validation.ok) {
    throw new Error("expected authored policy artifact validation to pass");
  }
  deepEqual(validation.kernel_validation.live_observable_refs, [
    "cost.fresh_tokens_per_maintained_day",
    "kernel.deep_shallow_contradiction_count_7d",
    "receipt.escalation_precision_7d",
    "source.incident_channel.material_update_count_1h",
  ]);
});

test("policy artifact validation rejects malformed transitive freshness functions", () => {
  const artifact = {
    schema: POLICY_ARTIFACT_SCHEMA,
    v: 0,
    ...makeAuthoredPolicy(),
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    transitive_freshness_function: {
      kind: "minimum-remaining-freshness-ms",
      minimum_remaining_ms: -1,
    },
    provenance: {
      contract_revision: CONTRACT_HASH,
      receipt_history_summary_hash: EVIDENCE_HASH_A,
      explored_receipt_hashes: [EVIDENCE_HASH_A],
      history_query: {
        schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
        v: 0,
        selected_receipt_hashes: [EVIDENCE_HASH_A],
      },
    },
  };

  const validation = validatePolicyArtifactV0(artifact);

  equal(validation.ok, false);
  if (validation.ok) {
    throw new Error("expected malformed transitive freshness function to fail");
  }
  ok(
    validation.errors.some((error) =>
      error.includes("minimum_remaining_ms must be a non-negative safe integer"),
    ),
  );
});

test("policy author permits contract-only prior with empty receipt history", () => {
  const launches: ReactorAgentRequestV0[] = [];
  const emptyHistorySummaryHash = hashCanonicalReceiptV0(
    canonicalizeForReceiptV0([]),
  );

  const registry = authorPolicyArtifactV0({
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_HASH,
    contract_summary: "The incident channel has a current, accurate briefing.",
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    receipt_history: [],
    agentSdk: {
      launch: (request): ReactorAgentResponseV0 => {
        launches.push(request);
        const payload = request.payload as PolicyAuthorRequestPayloadV0;

        if (payload.step === "history-query") {
          deepEqual(payload.receipt_history_summary, []);
          return {
            payload: {
              schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
              v: 0,
              selected_receipt_hashes: [],
              rationale: "no receipt history exists; authoring a contract-only prior",
            },
          };
        }

        equal(payload.step, "author-artifact");
        equal(payload.receipt_history_summary_hash, emptyHistorySummaryHash);
        deepEqual(payload.history_query.selected_receipt_hashes, []);
        deepEqual(payload.selected_receipts, []);

        return {
          payload: {
            schema: POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA,
            v: 0,
            artifact: makeAuthoredPolicy(),
          },
        };
      },
    },
  });

  equal(launches.length, 2);
  const bytes = registry.policy_artifact_bytes;
  ok(bytes);

  const artifact = JSON.parse(bytes) as AuthoredPolicyArtifactV0;
  deepEqual(artifact.provenance.explored_receipt_hashes, []);
  equal(
    artifact.provenance.receipt_history_summary_hash,
    emptyHistorySummaryHash,
  );
  deepEqual(artifact.provenance.history_query.selected_receipt_hashes, []);
});

test("policy author fails closed on one-shot artifact authorship", () => {
  const launches: ReactorAgentRequestV0[] = [];

  throws(
    () =>
      authorPolicyArtifactV0({
        responsibility_id: RESPONSIBILITY_ID,
        contract_revision: CONTRACT_HASH,
        contract_summary: "The incident channel has a current, accurate briefing.",
        no_anchor: true,
        live_observables: LIVE_OBSERVABLES,
        receipt_history: makeReceipts(),
        agentSdk: {
          launch: (request): ReactorAgentResponseV0 => {
            launches.push(request);
            return { payload: makeAuthoredPolicy() };
          },
        },
      }),
    /must query receipt history before authoring/,
  );
  equal(launches.length, 1);
});

test("policy author fails closed when no receipt history is selected", () => {
  throws(
    () =>
      authorPolicyArtifactV0({
        responsibility_id: RESPONSIBILITY_ID,
        contract_revision: CONTRACT_HASH,
        contract_summary: "The incident channel has a current, accurate briefing.",
        no_anchor: true,
        live_observables: LIVE_OBSERVABLES,
        receipt_history: makeReceipts(),
        agentSdk: {
          launch: (request): ReactorAgentResponseV0 => {
            const payload = request.payload as PolicyAuthorRequestPayloadV0;

            if (payload.step === "history-query") {
              return {
                payload: {
                  schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
                  v: 0,
                  selected_receipt_hashes: [],
                },
              };
            }

            return {
              payload: {
                schema: POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA,
                v: 0,
                artifact: makeAuthoredPolicy(),
              },
            };
          },
        },
      }),
    /must select at least one receipt/,
  );
});

test("policy artifact authoring reuses kernel validation for no-anchor B2", () => {
  const { backstop_divergence_predicate: _removed, ...policy } = makeAuthoredPolicy();

  throws(
    () =>
      authorPolicyArtifactV0({
        responsibility_id: RESPONSIBILITY_ID,
        contract_revision: CONTRACT_HASH,
        contract_summary: "The incident channel has a current, accurate briefing.",
        no_anchor: true,
        live_observables: LIVE_OBSERVABLES,
        receipt_history: makeReceipts(),
        agentSdk: twoStepAgent(policy),
      }),
    /no-anchor policy requires a B2 backstop_divergence_predicate/,
  );
});

test("policy artifact authoring rejects predicates outside live observables", () => {
  throws(
    () =>
      authorPolicyArtifactV0({
        responsibility_id: RESPONSIBILITY_ID,
        contract_revision: CONTRACT_HASH,
        contract_summary: "The incident channel has a current, accurate briefing.",
        no_anchor: true,
        live_observables: LIVE_OBSERVABLES,
        receipt_history: makeReceipts(),
        agentSdk: twoStepAgent({
          ...makeAuthoredPolicy(),
          falsification_predicate: {
            kind: "greater-than-or-equal",
            fact: "source.invented_not_replayable",
            value: 1,
          },
        }),
      }),
    /non-live observable facts/,
  );
});

test("policy public surface is exported from root and package subpath", () => {
  equal(typeof rootSurface.authorPolicyArtifactV0, "function");
  equal(typeof rootSurface.validatePolicyArtifactV0, "function");

  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "..", "package.json"), "utf8"),
  ) as {
    readonly exports?: Record<string, unknown>;
  };

  deepEqual(packageJson.exports?.["./policy"], {
    types: "./dist/policy/index.d.ts",
    default: "./dist/policy/index.js",
  });
});

function twoStepAgent(artifact: unknown): {
  readonly launch: (request: ReactorAgentRequestV0) => ReactorAgentResponseV0;
} {
  return {
    launch: (request) => {
      const payload = request.payload as PolicyAuthorRequestPayloadV0;

      if (payload.step === "history-query") {
        return {
          payload: {
            schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
            v: 0,
            selected_receipt_hashes: payload.receipt_history_summary
              .slice(0, 1)
              .map((summary) => summary.content_hash),
          },
        };
      }

      return {
        payload: {
          schema: POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA,
          v: 0,
          artifact,
        },
      };
    },
  };
}

function makeAuthoredPolicy(
  overrides: {
    readonly transitive_freshness_function?: AuthoredPolicyArtifactV0["transitive_freshness_function"];
  } = {},
): Omit<
  AuthoredPolicyArtifactV0,
  "schema" | "v" | "no_anchor" | "live_observables" | "provenance"
> {
  return {
    registry_id: "registry.incident-channel-current-briefing.v0",
    policy_revision: "policy.p1.test.1",
    responsibility_id: RESPONSIBILITY_ID,
    cadence: {
      shallow_recheck_ms: 900000,
      plan_audit_ms: 21600000,
      deep_revalidation_ms: 86400000,
    },
    hysteresis: {
      min_recompile_interval_ms: 3600000,
      enter_degraded_threshold: 0.22,
      exit_degraded_threshold: 0.11,
      warmup_judged_activations: 8,
    },
    thresholds: {
      max_calibration_divergence_multiplier: 1.6,
      escalation_precision_floor: 0.82,
      backstop_deep_contradiction_count: 1,
      stale_brief_minutes: 45,
      fresh_tokens_per_day_ceiling: 1200,
    },
    transitive_freshness_function:
      overrides.transitive_freshness_function ?? { kind: "kernel-default" },
    falsification_predicate: {
      kind: "or",
      predicates: [
        {
          kind: "greater-than-or-equal",
          fact: "source.incident_channel.material_update_count_1h",
          value: 3,
        },
        {
          kind: "less-than",
          fact: "receipt.escalation_precision_7d",
          value: 0.82,
        },
        {
          kind: "greater-than-or-equal",
          fact: "cost.fresh_tokens_per_maintained_day",
          value: 1200,
        },
      ],
    },
    backstop_divergence_predicate: {
      kind: "greater-than-or-equal",
      fact: "kernel.deep_shallow_contradiction_count_7d",
      value: 1,
    },
  };
}

function makeReceipts(): readonly ReceiptV0[] {
  return [
    createForecastRecheckReceiptV0({
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      memo_key: "memo-policy-author-a",
      evidence_input_ids: [EVIDENCE_HASH_A],
      as_of: "2026-05-18T12:00:00Z",
      recheck_kind: "plan-age",
    }),
    createForecastRecheckReceiptV0({
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: CONTRACT_HASH,
      memo_key: "memo-policy-author-b",
      evidence_input_ids: [EVIDENCE_HASH_B],
      as_of: "2026-05-18T13:00:00Z",
      recheck_kind: "evidence-age",
    }),
  ];
}

const LIVE_OBSERVABLES: readonly PolicyLiveObservableV0[] = [
  {
    id: "source.incident_channel.material_update_count_1h",
    source: "connector",
    description: "Incident-channel updates that changed briefing facts.",
  },
  {
    id: "receipt.escalation_precision_7d",
    source: "receipt-log",
    description: "Seven-day precision of escalations later confirmed as needed.",
  },
  {
    id: "cost.fresh_tokens_per_maintained_day",
    source: "cost-ledger",
    description: "Fresh policy and judge tokens per maintained briefing day.",
  },
  {
    id: "kernel.deep_shallow_contradiction_count_7d",
    source: "kernel-backstop",
    description: "Forced deep revalidations that contradicted shallow history.",
  },
];
