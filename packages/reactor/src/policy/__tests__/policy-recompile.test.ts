import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { type KernelPredicateExpression } from "../../kernel";
import {
  createReceiptV0,
  type ReceiptEventCauseV0,
  type ReceiptV0,
} from "../../receipt";
import type {
  ReactorAgentRequestV0,
  ReactorAgentResponseV0,
} from "../../sdk";
import * as rootSurface from "../../index";
import {
  POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA,
  POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
  POLICY_RECOMPILE_DECISION_SCHEMA,
  executePolicyRecompileV0,
  planPolicyRecompileV0,
  type AuthoredPolicyArtifactV0,
  type AuthorPolicyArtifactV0Input,
  type PolicyAuthorRequestPayloadV0,
  type PolicyLiveObservableV0,
} from "../index";

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HISTORY_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const EVIDENCE_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const OTHER_CONTRACT_HASH =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const RESPONSIBILITY_ID = "incident-channel-current-briefing";
const AS_OF = "2026-05-18T12:00:00Z";

test("policy recompile plans and executes only when drift trips after the min interval", () => {
  const receipts = makeDriftReceipts();
  const decision = planPolicyRecompileV0({
    artifact: makePolicy(),
    receipts,
    as_of: AS_OF,
    last_policy_revalidated_at: "2026-05-18T00:00:00Z",
    last_recompile_at: "2026-05-18T10:00:00Z",
    last_unforced_deep_at: "2026-05-18T00:00:00Z",
  });

  equal(decision.schema, POLICY_RECOMPILE_DECISION_SCHEMA);
  equal(decision.outcome, "recompile-requested");
  deepEqual(decision.requested_by, ["policy-drift"]);
  equal(decision.drift.outcome, "tripped");
  deepEqual(
    decision.evidence_receipt_hashes,
    receipts
      .filter((receipt) => receipt.core.contract_revision === CONTRACT_HASH)
      .map((receipt) => receipt.content_hash),
  );
  ok(
    !decision.backstops.outcomes.some(
      (outcome) => outcome.action === "delay-recompile-for-min-interval",
    ),
  );

  const launches: ReactorAgentRequestV0[] = [];
  const execution = executePolicyRecompileV0({
    decision,
    author_input: makeAuthorInput(receipts, launches),
  });

  equal(execution.outcome, "recompile-authored");
  equal(launches.length, 2);
  if (execution.outcome === "recompile-authored") {
    equal(execution.registry.policy_artifact_revision, "policy.p3.recompiled.1");
  }
});

test("policy recompile delay preserves drift evidence and never calls the author", () => {
  const receipts = makeDriftReceipts();
  const decision = planPolicyRecompileV0({
    artifact: makePolicy(),
    receipts,
    as_of: AS_OF,
    last_policy_revalidated_at: "2026-05-18T00:00:00Z",
    last_recompile_at: "2026-05-18T11:30:00Z",
    last_unforced_deep_at: "2026-05-18T00:00:00Z",
  });

  equal(decision.outcome, "recompile-delayed");
  equal(decision.delayed_by, "min_recompile_interval");
  equal(decision.retry_after_ms, 30 * 60 * 1000);
  deepEqual(decision.requested_by, ["policy-drift"]);
  deepEqual(decision.evidence_receipt_hashes, decision.drift.evidence_receipt_hashes);
  ok(
    decision.backstops.outcomes.some(
      (outcome) =>
        outcome.backstop === "min_recompile_interval" &&
        outcome.action === "delay-recompile-for-min-interval",
    ),
  );

  const launches: ReactorAgentRequestV0[] = [];
  const execution = executePolicyRecompileV0({
    decision,
    author_input: makeAuthorInput(receipts, launches),
  });

  equal(execution.outcome, "not-executed");
  equal(launches.length, 0);
});

test("policy recompile no-op drift does not call the author", () => {
  const receipts = makeDriftReceipts();
  const decision = planPolicyRecompileV0({
    artifact: makePolicy({
      falsification_predicate: {
        kind: "greater-than-or-equal",
        fact: "cost.fresh_tokens_per_maintained_day",
        value: 9999,
      },
    }),
    receipts,
    as_of: AS_OF,
    last_policy_revalidated_at: "2026-05-18T00:00:00Z",
    last_recompile_at: "2026-05-18T10:00:00Z",
    last_unforced_deep_at: "2026-05-18T00:00:00Z",
  });

  equal(decision.outcome, "no-recompile-needed");
  deepEqual(decision.requested_by, []);
  equal(decision.drift.outcome, "not-tripped");

  const launches: ReactorAgentRequestV0[] = [];
  const execution = executePolicyRecompileV0({
    decision,
    author_input: makeAuthorInput(receipts, launches),
  });

  equal(execution.outcome, "not-executed");
  equal(launches.length, 0);
});

test("policy recompile turns indeterminate drift into needs-judgment without authoring", () => {
  const unsupportedFact = "source.incident_channel.material_update_count_1h";
  const receipts = makeDriftReceipts();
  const decision = planPolicyRecompileV0({
    artifact: makePolicy({
      live_observables: [
        ...LIVE_OBSERVABLES,
        {
          id: unsupportedFact,
          source: "connector",
          description: "Connector-side incident updates, not a receipt-log fact.",
        },
      ],
      falsification_predicate: {
        kind: "equals",
        fact: unsupportedFact,
        value: true,
      },
    }),
    receipts,
    as_of: AS_OF,
    last_policy_revalidated_at: "2026-05-18T00:00:00Z",
    last_recompile_at: "2026-05-18T10:00:00Z",
    last_unforced_deep_at: "2026-05-18T00:00:00Z",
  });

  equal(decision.outcome, "needs-judgment");
  equal(decision.drift.outcome, "indeterminate");
  deepEqual(decision.drift.missing_fact_ids, [unsupportedFact]);

  const launches: ReactorAgentRequestV0[] = [];
  const execution = executePolicyRecompileV0({
    decision,
    author_input: makeAuthorInput(receipts, launches),
  });

  equal(execution.outcome, "not-executed");
  equal(launches.length, 0);
});

test("policy recompile can be requested by a fixed backstop without drift", () => {
  const decision = planPolicyRecompileV0({
    artifact: makePolicy({
      falsification_predicate: {
        kind: "greater-than-or-equal",
        fact: "cost.fresh_tokens_per_maintained_day",
        value: 9999,
      },
    }),
    receipts: makeDriftReceipts(),
    as_of: AS_OF,
    last_policy_revalidated_at: "2026-05-01T12:00:00Z",
    last_recompile_at: "2026-05-18T10:00:00Z",
    last_unforced_deep_at: "2026-05-18T00:00:00Z",
  });

  equal(decision.outcome, "recompile-requested");
  deepEqual(decision.requested_by, ["backstop:max_policy_age_no_anchor"]);
  equal(decision.drift.outcome, "not-tripped");
  ok(
    decision.backstops.outcomes.some(
      (outcome) =>
        outcome.backstop === "max_policy_age_no_anchor" &&
        outcome.action === "force-policy-revalidation",
    ),
  );
});

test("policy recompile public surface is exported from the root", () => {
  equal(typeof rootSurface.planPolicyRecompileV0, "function");
  equal(typeof rootSurface.executePolicyRecompileV0, "function");
});

function makePolicy(
  overrides: {
    readonly live_observables?: readonly PolicyLiveObservableV0[];
    readonly falsification_predicate?: KernelPredicateExpression;
    readonly policy_revision?: string;
  } = {},
): AuthoredPolicyArtifactV0 {
  return {
    schema: "openprose.reactor.policy-artifact",
    v: 0,
    responsibility_id: RESPONSIBILITY_ID,
    registry_id: "registry.incident-channel-current-briefing.v0",
    policy_revision: overrides.policy_revision ?? "policy.p3.test.1",
    no_anchor: true,
    live_observables: overrides.live_observables ?? LIVE_OBSERVABLES,
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
    transitive_freshness_function: { kind: "kernel-default" },
    falsification_predicate:
      overrides.falsification_predicate ?? {
        kind: "greater-than-or-equal",
        fact: "cost.fresh_tokens_per_maintained_day",
        value: 300,
      },
    backstop_divergence_predicate: {
      kind: "greater-than-or-equal",
      fact: "kernel.deep_shallow_contradiction_count_7d",
      value: 1,
    },
    provenance: {
      contract_revision: CONTRACT_HASH,
      receipt_history_summary_hash: HISTORY_HASH,
      explored_receipt_hashes: [HISTORY_HASH],
      history_query: {
        schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
        v: 0,
        selected_receipt_hashes: [HISTORY_HASH],
      },
    },
  };
}

function makeAuthorInput(
  receipts: readonly ReceiptV0[],
  launches: ReactorAgentRequestV0[],
): AuthorPolicyArtifactV0Input {
  return {
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_HASH,
    contract_summary: "The incident channel has a current, accurate briefing.",
    no_anchor: true,
    live_observables: LIVE_OBSERVABLES,
    receipt_history: receipts,
    agentSdk: {
      launch: (request): ReactorAgentResponseV0 => {
        launches.push(request);
        const payload = request.payload as PolicyAuthorRequestPayloadV0;

        if (payload.step === "history-query") {
          return {
            payload: {
              schema: POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
              v: 0,
              selected_receipt_hashes: [receipts[0]?.content_hash],
            },
          };
        }

        return {
          payload: {
            schema: POLICY_AUTHOR_ARTIFACT_RESPONSE_SCHEMA,
            v: 0,
            artifact: makeAuthoredPolicyResponse(),
          },
        };
      },
    },
  };
}

function makeAuthoredPolicyResponse(): Omit<
  AuthoredPolicyArtifactV0,
  "schema" | "v" | "no_anchor" | "live_observables" | "provenance"
> {
  const policy = makePolicy({ policy_revision: "policy.p3.recompiled.1" });
  const response: Omit<
    AuthoredPolicyArtifactV0,
    | "schema"
    | "v"
    | "no_anchor"
    | "live_observables"
    | "provenance"
    | "backstop_divergence_predicate"
  > = {
    responsibility_id: policy.responsibility_id,
    registry_id: policy.registry_id,
    policy_revision: policy.policy_revision,
    cadence: policy.cadence,
    hysteresis: policy.hysteresis,
    thresholds: policy.thresholds,
    transitive_freshness_function: policy.transitive_freshness_function,
    falsification_predicate: policy.falsification_predicate,
  };

  return policy.backstop_divergence_predicate === undefined
    ? response
    : {
        ...response,
        backstop_divergence_predicate: policy.backstop_divergence_predicate,
      };
}

function makeDriftReceipts(): readonly ReceiptV0[] {
  return [
    makeReceipt({ asOf: "2026-05-11T12:00:00Z", fresh: 700 }),
    makeReceipt({
      asOf: "2026-05-16T12:00:00Z",
      eventCause: "escalation",
      fresh: 700,
      tags: ["escalation", "escalation:confirmed"],
    }),
    makeReceipt({
      asOf: "2026-05-17T12:00:00Z",
      eventCause: "escalation",
      fresh: 700,
      tags: ["escalation", "escalation:confirmed"],
    }),
    makeReceipt({
      asOf: AS_OF,
      eventCause: "escalation",
      fresh: 700,
      status: "blocked",
      blockedReason: "backstop-divergence",
      tags: ["escalation", "escalation:refuted", "backstop-divergence"],
    }),
    makeReceipt({
      asOf: AS_OF,
      fresh: 999999,
      contractRevision: OTHER_CONTRACT_HASH,
      memoKey: "memo-other-contract",
    }),
  ];
}

function makeReceipt(options: {
  readonly asOf: string;
  readonly fresh: number;
  readonly eventCause?: ReceiptEventCauseV0;
  readonly status?: "up" | "blocked";
  readonly blockedReason?: string;
  readonly tags?: readonly string[];
  readonly contractRevision?: typeof CONTRACT_HASH | typeof OTHER_CONTRACT_HASH;
  readonly memoKey?: string;
}): ReceiptV0 {
  const eventCause = options.eventCause ?? "real-input";
  const status = options.status ?? "up";
  const role = "judge" as const;

  return createReceiptV0({
    core: {
      responsibility_id: RESPONSIBILITY_ID,
      contract_revision: options.contractRevision ?? CONTRACT_HASH,
      event_cause: eventCause,
      memo_key: options.memoKey ?? `memo-${options.asOf}`,
      evidence_input_ids: [EVIDENCE_HASH],
      as_of: options.asOf,
      role,
    },
    sig: {
      scheme: "none",
      null_reason: "policy recompile deterministic fixture",
    },
    verdict: {
      status,
      confidence: {
        value: status === "up" ? 0.91 : 0,
        derivation_method: "policy-recompile-fixture",
        calibration_grade: "authored",
        label_source: "fixture",
      },
      ...(status === "blocked"
        ? {
            blocked: {
              reason: options.blockedReason ?? "fixture-blocked",
              fix_target: "policy-artifact",
              interrupt_cause: "needs-judgment" as const,
            },
          }
        : {}),
    },
    freshness: {
      as_of: options.asOf,
      next_forecast_recheck: options.asOf,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "fixture",
      model: "fixture",
      role,
      tags: options.tags ?? ["policy-recompile-fixture"],
      responsibility_id: RESPONSIBILITY_ID,
      run_id: `run-${options.asOf}`,
      as_of: options.asOf,
      tokens: { fresh: options.fresh, reused: 0 },
      surprise_cause: eventCause,
    },
  });
}

const LIVE_OBSERVABLES: readonly PolicyLiveObservableV0[] = [
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
