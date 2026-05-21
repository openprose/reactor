import { createHash } from "node:crypto";
import {
  deepEqual,
  equal,
  match,
  notEqual,
  rejects,
} from "node:assert/strict";
import { test } from "node:test";

import type {
  ContentHashV0,
  ReceiptEventCauseV0,
  ReceiptRoleV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";
import type { PolicyLiveObservableV0 } from "@openprose/reactor/policy";

import {
  PROVIDER_PARITY_POLICY_AUTHOR_LAUNCH_REPRESENTATION_V0,
  assertProviderPolicyArtifactParityV0,
  runProviderPolicyArtifactParityV0,
  type ProviderParityRecordedProviderV0,
} from "../index";

const RESPONSIBILITY_ID = "incident-channel-current-briefing";
const CONTRACT_SOURCE = [
  "kind: responsibility",
  "Goal: The incident channel has a current, accurate briefing.",
  "Criteria: impact, timeline, owner, next action, and customer-facing status are current.",
].join("\n");
const CONTRACT_REVISION = hashText(CONTRACT_SOURCE);
const POLICY_ARTIFACT_VERSION = 0 as const;
const POLICY_AUTHOR_HISTORY_QUERY_SCHEMA =
  "openprose.reactor.policy-author.history-query" as const;
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

test("matching recorded model-gateway providers pass policy artifact byte parity", async () => {
  const receipts = makeReceiptHistory();
  const selectedReceiptHash = readReceipt(receipts, 1).content_hash;
  const artifact = makeAuthoredPolicyArtifact();

  const report = await assertProviderPolicyArtifactParityV0({
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_REVISION,
    contract_summary: CONTRACT_SOURCE,
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    receipt_history: receipts,
    providers: [
      makeRecordedProvider("openrouter-recorded", "openrouter/policy-recorded", {
        artifact,
        selectedReceiptHash,
      }),
      makeRecordedProvider("anthropic-recorded", "claude-policy-recorded", {
        artifact,
        selectedReceiptHash,
      }),
    ],
  });

  deepEqual(report.provider_names, [
    "openrouter-recorded",
    "anthropic-recorded",
  ]);
  equal(report.validation_state, "validated");
  equal(report.byte_identical, true);
  equal(report.artifact_hashes[0], report.artifact_hashes[1]);
  equal(report.artifact_bytes[0], report.artifact_bytes[1]);
  equal(report.providers[0]?.validation_state, "validated");
  equal(report.providers[1]?.validation_state, "validated");
  equal(report.providers[0]?.model_gateway_call_count, 2);
  equal(report.providers[1]?.model_gateway_call_count, 2);
  equal(
    report.providers[0]?.policy_author_launch_representation,
    PROVIDER_PARITY_POLICY_AUTHOR_LAUNCH_REPRESENTATION_V0,
  );
  equal(report.providers[0]?.model_gateway_usage[0]?.provider, "openrouter-recorded");
  equal(report.providers[1]?.model_gateway_usage[0]?.provider, "anthropic-recorded");
  match(readArtifactBytes(report, 0), /"transitive_freshness_function"/);
});

test("changed provider policy artifact fails closed", async () => {
  const receipts = makeReceiptHistory();
  const selectedReceiptHash = readReceipt(receipts, 1).content_hash;
  const baselineArtifact = makeAuthoredPolicyArtifact();
  const changedArtifact = makeAuthoredPolicyArtifact({
    policy_revision: "policy-rev-provider-drift",
    shallow_recheck_ms: 20 * 60 * 1000,
  });
  const input = {
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_REVISION,
    contract_summary: CONTRACT_SOURCE,
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    receipt_history: receipts,
    providers: [
      makeRecordedProvider("openrouter-recorded", "openrouter/policy-recorded", {
        artifact: baselineArtifact,
        selectedReceiptHash,
      }),
      makeRecordedProvider("anthropic-recorded", "claude-policy-recorded", {
        artifact: changedArtifact,
        selectedReceiptHash,
      }),
    ],
  } as const;

  const report = await runProviderPolicyArtifactParityV0(input);

  equal(report.validation_state, "validated");
  equal(report.byte_identical, false);
  notEqual(report.artifact_hashes[0], report.artifact_hashes[1]);
  await rejects(
    () => assertProviderPolicyArtifactParityV0(input),
    /gateway-provider-parity failed: policy artifact bytes differ/,
  );
});

function makeRecordedProvider(
  name: string,
  model: string,
  input: {
    readonly artifact: Readonly<Record<string, unknown>>;
    readonly selectedReceiptHash: ContentHashV0;
  },
): ProviderParityRecordedProviderV0 {
  return {
    name,
    model,
    history_query: {
      schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
      v: POLICY_ARTIFACT_VERSION,
      selected_receipt_hashes: [input.selectedReceiptHash],
      rationale:
        "recent plan-age recheck is the only receipt needed for provider parity",
    },
    artifact: input.artifact,
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
      null_reason: "cradle provider parity proof",
    },
    verdict: {
      status: input.status,
      confidence: {
        value: 0.82,
        derivation_method: "recorded-provider-parity-double",
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
      model: "recorded-provider-parity-double",
      role: input.role,
      tags: ["provider-parity", input.memo_key],
      responsibility_id: RESPONSIBILITY_ID,
      run_id: "provider-parity-recorded",
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
  overrides: {
    readonly policy_revision?: string;
    readonly shallow_recheck_ms?: number;
  } = {},
): Readonly<Record<string, unknown>> {
  return {
    schema: "openprose.reactor.policy-artifact",
    v: 0,
    responsibility_id: RESPONSIBILITY_ID,
    registry_id: "incident-briefing-policy-registry",
    policy_revision:
      overrides.policy_revision ?? "policy-rev-2026-05-18T12:00:00.000Z",
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    cadence: {
      shallow_recheck_ms: overrides.shallow_recheck_ms ?? 15 * 60 * 1000,
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

function readReceipt(receipts: readonly ReceiptV0[], index: number): ReceiptV0 {
  const receipt = receipts[index];
  if (receipt === undefined) {
    throw new Error(`expected receipt ${index}`);
  }

  return receipt;
}

function readArtifactBytes(
  report: Awaited<ReturnType<typeof runProviderPolicyArtifactParityV0>>,
  index: number,
): string {
  const bytes = report.artifact_bytes[index];
  if (bytes === undefined) {
    throw new Error(`expected artifact bytes ${index}`);
  }

  return bytes;
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
