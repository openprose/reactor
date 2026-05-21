import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import { evaluatePredicate, type KernelPredicateExpression } from "../../kernel";
import { createReceiptV0, type ReceiptEventCauseV0, type ReceiptV0 } from "../../receipt";
import * as rootSurface from "../../index";
import {
  POLICY_AUTHOR_HISTORY_QUERY_SCHEMA,
  POLICY_DRIFT_EVALUATION_SCHEMA,
  POLICY_DRIFT_FACTS_SCHEMA,
  derivePolicyDriftFactsV0,
  evaluatePolicyDriftV0,
  validatePolicyArtifactV0,
  type AuthoredPolicyArtifactV0,
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

test("policy drift derives receipt facts and trips on cost drift with kernel semantics", () => {
  const receipts = makeDriftReceipts();
  const derivation = derivePolicyDriftFactsV0({
    receipts,
    responsibility_id: RESPONSIBILITY_ID,
    contract_revision: CONTRACT_HASH,
    as_of: AS_OF,
  });

  equal(derivation.schema, POLICY_DRIFT_FACTS_SCHEMA);
  equal(derivation.facts["cost.fresh_tokens_per_maintained_day"], 400);
  equal(derivation.facts["receipt.escalation_precision_7d"], 2 / 3);
  equal(derivation.facts["kernel.deep_shallow_contradiction_count_7d"], 1);
  deepEqual(derivation.unsupported_fact_ids, []);

  const artifact = makePolicy({
    falsification_predicate: {
      kind: "and",
      predicates: [
        {
          kind: "greater-than-or-equal",
          fact: "cost.fresh_tokens_per_maintained_day",
          value: 300,
        },
        {
          kind: "less-than",
          fact: "receipt.escalation_precision_7d",
          value: 0.8,
        },
      ],
    },
  });
  const validation = validatePolicyArtifactV0(artifact);
  equal(validation.ok, true);
  if (!validation.ok) {
    throw new Error("expected valid drift policy artifact");
  }

  const result = evaluatePolicyDriftV0({ artifact, receipts, as_of: AS_OF });

  equal(result.schema, POLICY_DRIFT_EVALUATION_SCHEMA);
  equal(result.outcome, "tripped");
  deepEqual(
    result.predicate,
    evaluatePredicate(artifact.falsification_predicate, result.facts),
  );
  equal(result.policy_artifact_content_hash, validation.content_hash);
  deepEqual(result.missing_fact_ids, []);
  deepEqual(result.unsupported_fact_ids, []);
  deepEqual(
    result.evidence_receipt_hashes,
    receipts
      .filter((receipt) => receipt.core.contract_revision === CONTRACT_HASH)
      .map((receipt) => receipt.content_hash),
  );
});

test("policy drift is indeterminate for live facts that are not derivable from receipts", () => {
  const unsupportedFact = "source.incident_channel.material_update_count_1h";
  const result = evaluatePolicyDriftV0({
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
    receipts: makeDriftReceipts(),
    as_of: AS_OF,
  });

  equal(result.outcome, "indeterminate");
  equal(result.predicate.outcome, "indeterminate");
  deepEqual(result.missing_fact_ids, [unsupportedFact]);
  deepEqual(result.unsupported_fact_ids, [unsupportedFact]);
});

test("policy drift does not guess defaults for unsupported receipt-log facts", () => {
  const result = evaluatePolicyDriftV0(
    makePolicy({
      falsification_predicate: {
        kind: "greater-than-or-equal",
        fact: "cost.fresh_tokens_per_maintained_day",
        value: 1,
      },
    }),
    [makeReceipt({ asOf: AS_OF, fresh: 0 })],
    { as_of: AS_OF },
  );

  equal(result.outcome, "indeterminate");
  deepEqual(result.missing_fact_ids, ["cost.fresh_tokens_per_maintained_day"]);
  deepEqual(result.unsupported_fact_ids, ["cost.fresh_tokens_per_maintained_day"]);
  equal(
    Object.hasOwn(result.facts, "cost.fresh_tokens_per_maintained_day"),
    false,
  );
});

test("policy drift rejects malformed receipt evidence before deriving facts", () => {
  const [receipt] = makeDriftReceipts();
  if (receipt === undefined) {
    throw new Error("fixture did not produce a receipt");
  }
  const malformed = {
    ...receipt,
    cost: {
      ...receipt.cost,
      tokens: { fresh: -1, reused: 0 },
    },
  } as unknown as ReceiptV0;

  throws(
    () => derivePolicyDriftFactsV0([malformed]),
    /policy drift receipt log is malformed/,
  );
});

test("policy drift public surface is exported without agent/model adapters", () => {
  equal(typeof rootSurface.derivePolicyDriftFactsV0, "function");
  equal(typeof rootSurface.evaluatePolicyDriftV0, "function");

  const result = evaluatePolicyDriftV0(
    makePolicy({
      falsification_predicate: {
        kind: "greater-than-or-equal",
        fact: "kernel.deep_shallow_contradiction_count_7d",
        value: 1,
      },
    }),
    makeDriftReceipts(),
    { as_of: AS_OF },
  );

  equal(result.outcome, "tripped");
});

function makePolicy(
  overrides: {
    readonly live_observables?: readonly PolicyLiveObservableV0[];
    readonly falsification_predicate?: KernelPredicateExpression;
  } = {},
): AuthoredPolicyArtifactV0 {
  return {
    schema: "openprose.reactor.policy-artifact",
    v: 0,
    responsibility_id: RESPONSIBILITY_ID,
    registry_id: "registry.incident-channel-current-briefing.v0",
    policy_revision: "policy.p2.test.1",
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
      null_reason: "policy drift deterministic fixture",
    },
    verdict: {
      status,
      confidence: {
        value: status === "up" ? 0.91 : 0,
        derivation_method: "policy-drift-fixture",
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
      tags: options.tags ?? ["policy-drift-fixture"],
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
