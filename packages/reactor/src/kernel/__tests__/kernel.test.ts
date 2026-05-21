import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import { verifyReceiptV0 } from "../../receipt";
import {
  KERNEL_BACKSTOPS,
  KERNEL_DAY_MS,
  KERNEL_HOUR_MS,
  KERNEL_MAY_NEVER,
  compareRollback,
  createKernelSafetyReceipt,
  detectReceiptCycles,
  evaluateBackstopDivergencePredicate,
  evaluateBackstops,
  evaluatePredicate,
  judgedActivations,
  resolvePersistentIndeterminate,
  type KernelPredicateExpression,
  type KernelSafetyReceiptInput,
  type ValidatedKernelPolicyArtifactToken,
  validateKernelPolicyArtifact,
} from "../index";

const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const HASH_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;

test("predicate evaluator trips, clears, and stays indeterminate on missing facts", () => {
  equal(
    evaluatePredicate(
      { kind: "greater-than-or-equal", fact: "open_incidents", value: 2 },
      { open_incidents: 3 },
    ).outcome,
    "tripped",
  );
  equal(
    evaluatePredicate(
      { kind: "greater-than-or-equal", fact: "open_incidents", value: 2 },
      { open_incidents: 1 },
    ).outcome,
    "not-tripped",
  );
  deepEqual(
    evaluatePredicate(
      { kind: "greater-than-or-equal", fact: "open_incidents", value: 2 },
      {},
    ),
    { outcome: "indeterminate", reason: "missing fact open_incidents" },
  );
  equal(
    evaluatePredicate(
      {
        kind: "and",
        predicates: [
          { kind: "equals", fact: "service", value: "api" },
          { kind: "less-than", fact: "confidence", value: 0.8 },
        ],
      },
      { service: "api", confidence: 0.5 },
    ).outcome,
    "tripped",
  );
});

test("backstops enforce fixed constants and fail-closed absent seeds", () => {
  const outcomes = evaluateBackstops({
    token: makeValidatedPolicyArtifactToken({ no_anchor: false }),
    as_of: "2026-05-18T12:00:00Z",
    last_policy_revalidated_at: "2026-04-17T12:00:00Z",
    last_recompile_at: "2026-05-18T11:30:00Z",
    recompile_requested: true,
    observed_calibration_divergence_multiplier: 2,
    policy_warmup_judged_activations: judgedActivations(0),
  }).outcomes;

  deepEqual(
    outcomes.map((outcome) => [outcome.backstop, outcome.action]),
    [
      ["max_policy_age", "force-policy-revalidation"],
      ["min_recompile_interval", "delay-recompile-for-min-interval"],
      ["max_calibration_divergence", "force-policy-recompile"],
      ["max_calibration_evidence_age", "enter-degraded-calibration"],
      ["warmup_length", "no-last-known-good"],
    ],
  );
});

test("no-anchor mode substitutes 7 day policy age and forced deep cadence", () => {
  const outcomes = evaluateBackstops({
    token: makeValidatedPolicyArtifactToken({ no_anchor: true }),
    as_of: "2026-05-18T12:00:00Z",
    last_policy_revalidated_at: "2026-05-10T12:00:00Z",
    last_recompile_at: "2026-05-17T12:00:00Z",
    recompile_requested: false,
    max_calibration_evidence_age_ms: KERNEL_DAY_MS,
    warmup_length: judgedActivations(1),
    policy_warmup_judged_activations: judgedActivations(1),
    last_unforced_deep_at: "2026-05-10T12:00:00Z",
  }).outcomes;

  deepEqual(
    outcomes.map((outcome) => [outcome.backstop, outcome.action]),
    [
      ["max_policy_age_no_anchor", "force-policy-revalidation"],
      ["max_unforced_deep_interval", "force-deep-revalidation"],
    ],
  );
  equal(KERNEL_BACKSTOPS.maxPolicyAgeNoAnchorMs, 7 * KERNEL_DAY_MS);
  equal(KERNEL_BACKSTOPS.maxUnforcedDeepIntervalMs, 7 * KERNEL_DAY_MS);
});

test("policy artifact validation co-ships no-anchor B2 and live-observable B3", () => {
  const accepted = validateKernelPolicyArtifact({
    no_anchor: true,
    falsification_predicate: {
      kind: "equals",
      fact: "material_status",
      value: "stale",
    },
    backstop_divergence_predicate: {
      kind: "greater-than-or-equal",
      fact: "observed_divergence_multiplier",
      value: 2,
    },
    live_observables: ["material_status", "observed_divergence_multiplier"],
  });

  equal(accepted.ok, true);
  if (!accepted.ok) {
    throw new Error("expected policy artifact validation to succeed");
  }
  deepEqual(accepted.live_observable_refs, [
    "material_status",
    "observed_divergence_multiplier",
  ]);
  deepEqual(accepted.token.live_observable_refs, accepted.live_observable_refs);
  equal(accepted.token.no_anchor, true);

  const missingDivergence = validateKernelPolicyArtifact({
    no_anchor: true,
    falsification_predicate: {
      kind: "equals",
      fact: "material_status",
      value: "stale",
    },
    live_observables: ["material_status"],
  });

  equal(missingDivergence.ok, false);
  ok(
    !missingDivergence.ok &&
      missingDivergence.errors.includes(
        "no-anchor policy requires a B2 backstop_divergence_predicate",
      ),
  );

  const noLiveFalsifier = validateKernelPolicyArtifact({
    no_anchor: true,
    falsification_predicate: {
      kind: "equals",
      fact: "static_policy_note",
      value: "unchanged",
    },
    backstop_divergence_predicate: {
      kind: "greater-than-or-equal",
      fact: "observed_divergence_multiplier",
      value: 2,
    },
    live_observables: ["observed_divergence_multiplier"],
  });

  equal(noLiveFalsifier.ok, false);
  ok(
    !noLiveFalsifier.ok &&
      noLiveFalsifier.errors.includes(
        "falsification predicate must reference at least one live observable",
      ),
  );
});

test("backstop divergence predicate forces recompile with a safety receipt", () => {
  const token = makeValidatedPolicyArtifactToken();
  const tripped = evaluateBackstopDivergencePredicate({
    token,
    facts: { observed_divergence_multiplier: 2.5 },
    receipt_input: makeKernelSafetyReceiptInput(),
  });

  equal(tripped.outcome, "force-policy-recompile");
  if (tripped.outcome !== "force-policy-recompile") {
    throw new Error("expected backstop divergence to force policy recompile");
  }
  deepEqual(verifyReceiptV0(tripped.receipt), {
    ok: true,
    content_hash: tripped.receipt.content_hash,
  });
  equal(tripped.receipt.verdict.blocked?.reason, "backstop-divergence");
  equal(tripped.receipt.verdict.blocked?.fix_target, "policy-artifact");
  equal(tripped.receipt.cost.surprise_cause, "escalation");

  const notTripped = evaluateBackstopDivergencePredicate({
    token,
    facts: { observed_divergence_multiplier: 1.2 },
    receipt_input: makeKernelSafetyReceiptInput(),
  });

  equal(notTripped.outcome, "not-tripped");
});

test("raw divergence predicates cannot reach the public evaluators", () => {
  assertCompileShapeOnly();

  const malformedTokenResult = evaluateBackstopDivergencePredicate({
    token: {
      live_observable_refs: ["observed_divergence_multiplier"],
      backstop_divergence_predicate: divergencePredicate(),
    } as unknown as ValidatedKernelPolicyArtifactToken,
    facts: { observed_divergence_multiplier: 2.5 },
    receipt_input: makeKernelSafetyReceiptInput(),
  });

  equal(malformedTokenResult.outcome, "indeterminate");
  equal(
    malformedTokenResult.predicate.reason,
    "validated policy artifact token is missing or malformed",
  );
});

test("divergence predicates fail safe when they reference facts outside live observables", () => {
  const validation = validateKernelPolicyArtifact({
    no_anchor: true,
    falsification_predicate: {
      kind: "equals",
      fact: "material_status",
      value: "stale",
    },
    backstop_divergence_predicate: {
      kind: "and",
      predicates: [
        divergencePredicate(),
        { kind: "equals", fact: "shadow_fact", value: true },
      ],
    },
    live_observables: ["material_status", "observed_divergence_multiplier"],
  });

  equal(validation.ok, true);
  if (!validation.ok) {
    throw new Error("expected policy artifact validation to succeed");
  }

  const result = evaluateBackstopDivergencePredicate({
    token: validation.token,
    facts: { observed_divergence_multiplier: 2.5, shadow_fact: true },
    receipt_input: makeKernelSafetyReceiptInput(),
  });

  equal(result.outcome, "indeterminate");
  equal(
    result.predicate.reason,
    "backstop_divergence_predicate references non-live observable shadow_fact",
  );
});

test("persistent indeterminate past the backstop interval emits needs-judgment", () => {
  const pending = resolvePersistentIndeterminate({
    interval_basis: "elapsed-time",
    first_indeterminate_at: "2026-05-18T12:00:00Z",
    as_of: "2026-05-18T12:30:00Z",
    backstop_interval_ms: KERNEL_HOUR_MS,
    receipt_input: makeKernelSafetyReceiptInput(),
  });

  deepEqual(pending, {
    outcome: "pending",
    remaining_ms: 30 * 60 * 1000,
  });

  const needsJudgment = resolvePersistentIndeterminate({
    interval_basis: "elapsed-time",
    first_indeterminate_at: "2026-05-18T12:00:00Z",
    as_of: "2026-05-18T13:00:00Z",
    backstop_interval_ms: KERNEL_HOUR_MS,
    receipt_input: makeKernelSafetyReceiptInput(),
  });

  equal(needsJudgment.outcome, "needs-judgment");
  if (needsJudgment.outcome !== "needs-judgment") {
    throw new Error("expected persistent indeterminate to emit a safety receipt");
  }
  deepEqual(verifyReceiptV0(needsJudgment.receipt), {
    ok: true,
    content_hash: needsJudgment.receipt.content_hash,
  });
  equal(needsJudgment.receipt.verdict.blocked?.reason, "persistent-indeterminate");
  equal(needsJudgment.receipt.verdict.blocked?.interrupt_cause, "needs-judgment");
});

test("persistent indeterminate interval basis is typed and guarded", () => {
  throws(
    () =>
      resolvePersistentIndeterminate({
        interval_basis: "ambient-wall-clock" as "elapsed-time",
        first_indeterminate_at: "2026-05-18T12:00:00Z",
        as_of: "2026-05-18T13:00:00Z",
        backstop_interval_ms: KERNEL_HOUR_MS,
        receipt_input: makeKernelSafetyReceiptInput(),
      }),
    /interval_basis must be elapsed-time/,
  );
});

test("calibration evidence age seed gates stale evidence without ambient time", () => {
  const outcomes = evaluateBackstops({
    token: makeValidatedPolicyArtifactToken({ no_anchor: false }),
    as_of: "2026-05-18T12:00:00Z",
    last_policy_revalidated_at: "2026-05-18T00:00:00Z",
    last_recompile_at: "2026-05-17T12:00:00Z",
    recompile_requested: false,
    calibration_evidence_as_of: "2026-05-16T12:00:00Z",
    max_calibration_evidence_age_ms: KERNEL_DAY_MS,
    warmup_length: judgedActivations(1),
    policy_warmup_judged_activations: judgedActivations(1),
  }).outcomes;

  deepEqual(
    outcomes.map((outcome) => [outcome.backstop, outcome.action]),
    [["max_calibration_evidence_age", "enter-degraded-calibration"]],
  );
});

test("judged activation helper brands rollback and warmup event counts", () => {
  const pendingWarmup = evaluateBackstops({
    token: makeValidatedPolicyArtifactToken({ no_anchor: false }),
    as_of: "2026-05-18T12:00:00Z",
    last_policy_revalidated_at: "2026-05-18T00:00:00Z",
    last_recompile_at: "2026-05-17T12:00:00Z",
    recompile_requested: false,
    calibration_evidence_as_of: "2026-05-18T12:00:00Z",
    max_calibration_evidence_age_ms: KERNEL_DAY_MS,
    warmup_length: judgedActivations(3),
    policy_warmup_judged_activations: judgedActivations(2),
  }).outcomes;

  deepEqual(
    pendingWarmup.map((outcome) => [outcome.backstop, outcome.action]),
    [["warmup_length", "no-last-known-good"]],
  );

  const completedWarmup = evaluateBackstops({
    token: makeValidatedPolicyArtifactToken({ no_anchor: false }),
    as_of: "2026-05-18T12:00:00Z",
    last_policy_revalidated_at: "2026-05-18T00:00:00Z",
    last_recompile_at: "2026-05-17T12:00:00Z",
    recompile_requested: false,
    calibration_evidence_as_of: "2026-05-18T12:00:00Z",
    max_calibration_evidence_age_ms: KERNEL_DAY_MS,
    warmup_length: judgedActivations(3),
    policy_warmup_judged_activations: judgedActivations(3),
  }).outcomes;

  ok(!completedWarmup.some((outcome) => outcome.backstop === "warmup_length"));
  throws(() => judgedActivations(-1), /judged_activations must be a non-negative/);
  throws(() => judgedActivations(1.5), /judged_activations must be a non-negative/);
});

test("rollback compares judged activation counts, not wall-clock duration", () => {
  deepEqual(
    compareRollback({
      fresh_policy_revision: "policy-v2",
      fresh_policy_judged_activations_before_trip: judgedActivations(3),
      last_known_good_revision: "policy-v1",
      last_known_good_judged_activations_before_trip: judgedActivations(9),
    }),
    {
      outcome: "rollback",
      reason: "fresh policy tripped in fewer judged activations than last-known-good",
      target_policy_revision: "policy-v1",
    },
  );
  equal(
    compareRollback({
      fresh_policy_revision: "policy-v2",
      fresh_policy_judged_activations_before_trip: judgedActivations(9),
      last_known_good_revision: "policy-v1",
      last_known_good_judged_activations_before_trip: judgedActivations(3),
    }).outcome,
    "keep-current",
  );
  equal(
    compareRollback({
      fresh_policy_revision: "policy-v2",
      fresh_policy_judged_activations_before_trip: judgedActivations(1),
    }).outcome,
    "no-last-known-good",
  );
});

test("cycle detection is deterministic over content-addressed receipt edges", () => {
  deepEqual(detectReceiptCycles([{ from: HASH_A, to: HASH_B }]), {
    cycle_checked: true,
    has_cycle: false,
    cycle: [],
  });
  deepEqual(
    detectReceiptCycles([
      { from: HASH_A, to: HASH_B },
      { from: HASH_B, to: HASH_C },
      { from: HASH_C, to: HASH_A },
    ]),
    {
      cycle_checked: true,
      has_cycle: true,
      cycle: [HASH_A, HASH_B, HASH_C, HASH_A],
    },
  );
});

test("cycle detection returns stable cycles when receipt edge order changes", () => {
  const twoNodeCycle = [
    { from: HASH_B, to: HASH_A },
    { from: HASH_A, to: HASH_B },
  ];
  const twoNodeCycleReordered = [
    { from: HASH_A, to: HASH_B },
    { from: HASH_B, to: HASH_A },
  ];
  const threeNodeCycle = [
    { from: HASH_B, to: HASH_C },
    { from: HASH_C, to: HASH_A },
    { from: HASH_A, to: HASH_B },
  ];
  const threeNodeCycleReordered = [
    { from: HASH_C, to: HASH_A },
    { from: HASH_A, to: HASH_B },
    { from: HASH_B, to: HASH_C },
  ];

  deepEqual(
    detectReceiptCycles(twoNodeCycle),
    detectReceiptCycles(twoNodeCycleReordered),
  );
  deepEqual(detectReceiptCycles(twoNodeCycle), {
    cycle_checked: true,
    has_cycle: true,
    cycle: [HASH_A, HASH_B, HASH_A],
  });
  deepEqual(
    detectReceiptCycles(threeNodeCycle),
    detectReceiptCycles(threeNodeCycleReordered),
  );
  deepEqual(detectReceiptCycles(threeNodeCycle), {
    cycle_checked: true,
    has_cycle: true,
    cycle: [HASH_A, HASH_B, HASH_C, HASH_A],
  });
});

test("cycle detection fails closed on malformed receipt graph edges", () => {
  throws(
    () =>
      detectReceiptCycles([
        { from: "sha256:not-a-content-hash" as typeof HASH_A, to: HASH_A },
      ]),
    /receipt cycle edges\[0\]\.from must use sha256:<64 lowercase hex>/,
  );
});

test("fail-safe kernel outcomes are content-addressed receipt v0 entries", () => {
  const receipt = createKernelSafetyReceipt({
    responsibility_id: "responsibility.incident-briefing",
    contract_revision: HASH_A,
    memo_key: "memo-key-static-world",
    evidence_input_ids: [HASH_B],
    as_of: "2026-05-18T12:00:00Z",
    reason: "calibration-unattainable",
    fix_target: "contract-author",
    interrupt_cause: "needs-judgment",
  });

  deepEqual(verifyReceiptV0(receipt), {
    ok: true,
    content_hash: receipt.content_hash,
  });
  equal(receipt.verdict.status, "blocked");
  equal(receipt.verdict.blocked?.reason, "calibration-unattainable");
  equal(receipt.cost.tokens.fresh, 0);
  equal(receipt.cost.tokens.reused, 0);
});

test("kernel safety and escalation receipts reject empty evidence inputs", () => {
  throws(
    () => createKernelSafetyReceipt(makeKernelSafetyReceiptInput({ evidence_input_ids: [] })),
    /kernel safety receipts require at least one evidence_input_id/,
  );

  throws(
    () =>
      evaluateBackstopDivergencePredicate({
        token: makeValidatedPolicyArtifactToken(),
        facts: { observed_divergence_multiplier: 2.5 },
        receipt_input: makeKernelSafetyReceiptInput({ evidence_input_ids: [] }),
      }),
    /kernel safety receipts require at least one evidence_input_id/,
  );
});

test("backstop evaluation is gated by a validated artifact token", () => {
  assertCompileShapeOnly();

  throws(
    () =>
      evaluateBackstops({
        token: {
          no_anchor: true,
          live_observable_refs: ["material_status", "observed_divergence_multiplier"],
          backstop_divergence_predicate: divergencePredicate(),
        } as unknown as ValidatedKernelPolicyArtifactToken,
        as_of: "2026-05-18T12:00:00Z",
        last_policy_revalidated_at: "2026-05-10T12:00:00Z",
        last_recompile_at: "2026-05-17T12:00:00Z",
        recompile_requested: false,
        warmup_length: judgedActivations(1),
        policy_warmup_judged_activations: judgedActivations(1),
      }),
    /validated policy artifact token is required/,
  );
});

test("may-never list preserves W2 prohibitions as executable contract checks", () => {
  const mayNever = new Set<string>(KERNEL_MAY_NEVER);

  for (const expected of [
    "call a model, agent SDK, or policy author to decide whether a backstop fired",
    "interpret *.prose.md or add new source syntax",
    "discover new evidence dependencies during shallow judging",
    "use wall-clock duration for rollback comparisons",
    "emit fail-safe, indeterminate, or blocked outcomes as droppable annotations",
    "hide uncertainty by emitting confident up when calibration is degraded",
  ]) {
    ok(mayNever.has(expected));
  }
});

function makeValidatedPolicyArtifactToken(
  overrides: {
    readonly no_anchor?: boolean;
  } = {},
): ValidatedKernelPolicyArtifactToken {
  const noAnchor = overrides.no_anchor ?? true;
  const validation = validateKernelPolicyArtifact({
    no_anchor: noAnchor,
    falsification_predicate: {
      kind: "equals",
      fact: "material_status",
      value: "stale",
    },
    ...(noAnchor ? { backstop_divergence_predicate: divergencePredicate() } : {}),
    live_observables: ["material_status", "observed_divergence_multiplier"],
  });

  if (!validation.ok) {
    throw new Error(`expected valid policy artifact: ${validation.errors.join("; ")}`);
  }

  return validation.token;
}

function divergencePredicate(): KernelPredicateExpression {
  return {
    kind: "greater-than-or-equal",
    fact: "observed_divergence_multiplier",
    value: 2,
  };
}

function assertCompileShapeOnly(): void {
  if (false) {
    const rawDivergenceInput = {
      predicate: divergencePredicate(),
      facts: { observed_divergence_multiplier: 2.5 },
      receipt_input: makeKernelSafetyReceiptInput(),
    };
    // @ts-expect-error raw predicates must not reach the public divergence API.
    evaluateBackstopDivergencePredicate(rawDivergenceInput);

    evaluateBackstops({
      token: makeValidatedPolicyArtifactToken(),
      as_of: "2026-05-18T12:00:00Z",
      last_policy_revalidated_at: "2026-05-18T00:00:00Z",
      last_recompile_at: "2026-05-17T12:00:00Z",
      recompile_requested: false,
      warmup_length: judgedActivations(1),
      policy_warmup_judged_activations: judgedActivations(1),
      // @ts-expect-error raw divergence predicates cannot be smuggled into backstops.
      backstop_divergence_predicate: divergencePredicate(),
    });

    const unbrandedBackstopInput = {
      token: makeValidatedPolicyArtifactToken({ no_anchor: false }),
      as_of: "2026-05-18T12:00:00Z",
      last_policy_revalidated_at: "2026-05-18T00:00:00Z",
      last_recompile_at: "2026-05-17T12:00:00Z",
      recompile_requested: false,
      warmup_length: 1,
      policy_warmup_judged_activations: 1,
    };
    // @ts-expect-error warmup counts must be branded through judgedActivations.
    evaluateBackstops(unbrandedBackstopInput);

    const unbrandedRollbackInput = {
      fresh_policy_revision: "policy-v2",
      fresh_policy_judged_activations_before_trip: 3,
      last_known_good_revision: "policy-v1",
      last_known_good_judged_activations_before_trip: 9,
    };
    // @ts-expect-error rollback counts must be branded through judgedActivations.
    compareRollback(unbrandedRollbackInput);

    const unsupportedIntervalBasisInput = {
      interval_basis: "ambient-wall-clock",
      first_indeterminate_at: "2026-05-18T12:00:00Z",
      as_of: "2026-05-18T13:00:00Z",
      backstop_interval_ms: KERNEL_HOUR_MS,
      receipt_input: makeKernelSafetyReceiptInput(),
    };
    // @ts-expect-error bounded indeterminate intervals must use the typed basis.
    resolvePersistentIndeterminate(unsupportedIntervalBasisInput);
  }
}

function makeKernelSafetyReceiptInput(
  overrides: Partial<KernelSafetyReceiptInput> = {},
): KernelSafetyReceiptInput {
  return {
    responsibility_id: "responsibility.incident-briefing",
    contract_revision: HASH_A,
    memo_key: "memo-key-static-world",
    evidence_input_ids: [HASH_B],
    as_of: "2026-05-18T12:00:00Z",
    reason: "calibration-unattainable",
    fix_target: "contract-author",
    interrupt_cause: "needs-judgment",
    ...overrides,
  };
}
