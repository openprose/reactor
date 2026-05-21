import {
  type ContentHashV0,
  type ReceiptEventCauseV0,
  type ReceiptRoleV0,
  type ReceiptV0,
  createNullSignerReceiptSignatureV0,
  createReceiptV0,
} from "../receipt";

export const KERNEL_DAY_MS = 24 * 60 * 60 * 1000;
export const KERNEL_HOUR_MS = 60 * 60 * 1000;

export const KERNEL_BACKSTOPS = {
  maxPolicyAgeMs: 30 * KERNEL_DAY_MS,
  maxPolicyAgeNoAnchorMs: 7 * KERNEL_DAY_MS,
  minRecompileIntervalMs: KERNEL_HOUR_MS,
  maxCalibrationDivergenceMultiplier: 2,
  maxUnforcedDeepIntervalMs: 7 * KERNEL_DAY_MS,
} as const;

const VALIDATED_KERNEL_POLICY_ARTIFACT_TOKEN_BRAND: unique symbol = Symbol(
  "ValidatedKernelPolicyArtifactToken",
);
const JUDGED_ACTIVATIONS_BRAND: unique symbol = Symbol("JudgedActivations");
const CONTENT_HASH_V0_PATTERN = /^sha256:[a-f0-9]{64}$/;

export const KERNEL_MAY_NEVER = [
  "author judgment, policy, cadence, thresholds, or freshness functions",
  "call a model, agent SDK, or policy author to decide whether a backstop fired",
  "interpret *.prose.md or add new source syntax",
  "lengthen, disable, or silently reinterpret a fixed backstop",
  "quiesce on missing, stale, conflicting, or malformed safety-critical inputs",
  "let indeterminate persist silently past a backstop interval",
  "mutate the world or perform fulfillment side effects",
  "discover new evidence dependencies during shallow judging",
  "patch a memo key in place after deep roaming finds a new dependency",
  "treat a null signer as a cryptographic signature",
  "use wall-clock duration for rollback comparisons",
  "make cost.provider_norm part of a kernel decision",
  "emit fail-safe, indeterminate, or blocked outcomes as droppable annotations",
  "hide uncertainty by emitting confident up when calibration is degraded",
] as const;

export type KernelFactValue = string | number | boolean | null;
export type KernelFacts = Readonly<Record<string, KernelFactValue>>;
export type PredicateOutcome = "not-tripped" | "tripped" | "indeterminate";
export type IntervalBasis = "elapsed-time";
export type JudgedActivations = number & {
  readonly [JUDGED_ACTIVATIONS_BRAND]: true;
};

export type KernelPredicateExpression =
  | {
      readonly kind: "equals";
      readonly fact: string;
      readonly value: KernelFactValue;
    }
  | {
      readonly kind: "not-equals";
      readonly fact: string;
      readonly value: KernelFactValue;
    }
  | {
      readonly kind: "greater-than-or-equal";
      readonly fact: string;
      readonly value: number;
    }
  | {
      readonly kind: "less-than";
      readonly fact: string;
      readonly value: number;
    }
  | {
      readonly kind: "and";
      readonly predicates: readonly KernelPredicateExpression[];
    }
  | {
      readonly kind: "or";
      readonly predicates: readonly KernelPredicateExpression[];
    }
  | {
      readonly kind: "not";
      readonly predicate: KernelPredicateExpression;
    };

export interface PredicateEvaluation {
  readonly outcome: PredicateOutcome;
  readonly reason?: string;
}

export type KernelBackstopName =
  | "max_policy_age"
  | "max_policy_age_no_anchor"
  | "min_recompile_interval"
  | "max_calibration_divergence"
  | "max_calibration_evidence_age"
  | "warmup_length"
  | "max_unforced_deep_interval";

export type KernelBackstopAction =
  | "force-policy-revalidation"
  | "force-policy-recompile"
  | "delay-recompile-for-min-interval"
  | "enter-degraded-calibration"
  | "no-last-known-good"
  | "force-deep-revalidation";

export interface KernelBackstopOutcome {
  readonly backstop: KernelBackstopName;
  readonly action: KernelBackstopAction;
  readonly reason: string;
}

export interface KernelBackstopInput {
  readonly token: ValidatedKernelPolicyArtifactToken;
  readonly as_of: string;
  readonly last_policy_revalidated_at: string;
  readonly last_recompile_at: string;
  readonly recompile_requested: boolean;
  readonly observed_calibration_divergence_multiplier?: number;
  readonly calibration_evidence_as_of?: string;
  readonly max_calibration_evidence_age_ms?: number;
  readonly warmup_length?: JudgedActivations;
  readonly policy_warmup_judged_activations: JudgedActivations;
  readonly last_unforced_deep_at?: string;
}

export interface KernelBackstopEvaluation {
  readonly outcomes: readonly KernelBackstopOutcome[];
}

export interface RollbackComparisonInput {
  readonly fresh_policy_revision: string;
  readonly fresh_policy_judged_activations_before_trip: JudgedActivations;
  readonly last_known_good_revision?: string;
  readonly last_known_good_judged_activations_before_trip?: JudgedActivations;
}

export type RollbackOutcome = "rollback" | "keep-current" | "no-last-known-good";

export interface RollbackComparison {
  readonly outcome: RollbackOutcome;
  readonly reason: string;
  readonly target_policy_revision?: string;
}

export interface ConsumedReceiptEdge {
  readonly from: ContentHashV0;
  readonly to: ContentHashV0;
}

export interface CycleDetectionResult {
  readonly cycle_checked: true;
  readonly has_cycle: boolean;
  readonly cycle: readonly ContentHashV0[];
}

export interface KernelSafetyReceiptInput {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly memo_key: string;
  readonly evidence_input_ids: readonly ContentHashV0[];
  readonly as_of: string;
  readonly reason: string;
  readonly fix_target: string;
  readonly interrupt_cause: "needs-judgment" | "needs-input" | "contract-declared";
  readonly role?: ReceiptRoleV0;
  readonly event_cause?: ReceiptEventCauseV0;
  readonly next_forecast_recheck?: string;
  readonly cycle_checked?: boolean;
}

export interface KernelPolicyArtifactValidationInput {
  readonly no_anchor: boolean;
  readonly falsification_predicate: KernelPredicateExpression;
  readonly backstop_divergence_predicate?: KernelPredicateExpression;
  readonly live_observables: readonly string[];
}

export interface ValidatedKernelPolicyArtifactToken {
  readonly [VALIDATED_KERNEL_POLICY_ARTIFACT_TOKEN_BRAND]: true;
  readonly no_anchor: boolean;
  readonly live_observable_refs: readonly string[];
  readonly backstop_divergence_predicate?: KernelPredicateExpression;
}

export type KernelPolicyArtifactValidation =
  | {
      readonly ok: true;
      readonly live_observable_refs: readonly string[];
      readonly token: ValidatedKernelPolicyArtifactToken;
    }
  | {
      readonly ok: false;
      readonly errors: readonly string[];
      readonly live_observable_refs: readonly string[];
    };

export interface BackstopDivergenceEvaluationInput {
  readonly token: ValidatedKernelPolicyArtifactToken;
  readonly facts: KernelFacts;
  readonly receipt_input: Omit<
    KernelSafetyReceiptInput,
    "reason" | "fix_target" | "interrupt_cause"
  >;
}

export type BackstopDivergenceEvaluation =
  | {
      readonly outcome: "not-tripped";
      readonly predicate: PredicateEvaluation;
    }
  | {
      readonly outcome: "indeterminate";
      readonly predicate: PredicateEvaluation;
    }
  | {
      readonly outcome: "force-policy-recompile";
      readonly predicate: PredicateEvaluation;
      readonly receipt: ReceiptV0;
    };

export interface PersistentIndeterminateInput {
  readonly interval_basis: IntervalBasis;
  readonly first_indeterminate_at: string;
  readonly as_of: string;
  readonly backstop_interval_ms: number;
  readonly receipt_input: Omit<
    KernelSafetyReceiptInput,
    "as_of" | "reason" | "fix_target" | "interrupt_cause"
  >;
}

export type PersistentIndeterminateResolution =
  | {
      readonly outcome: "pending";
      readonly remaining_ms: number;
    }
  | {
      readonly outcome: "needs-judgment";
      readonly receipt: ReceiptV0;
    };

export function judgedActivations(
  value: number,
  name = "judged_activations",
): JudgedActivations {
  assertJudgedActivationCount(value, name);

  return value as JudgedActivations;
}

export function evaluatePredicate(
  expression: unknown,
  facts: KernelFacts,
): PredicateEvaluation {
  if (!isRecord(expression)) {
    return { outcome: "indeterminate", reason: "predicate is malformed" };
  }

  const kind = expression["kind"];

  switch (kind) {
    case "equals":
      return evaluateFactComparison(expression, facts, (left, right) => left === right);
    case "not-equals":
      return evaluateFactComparison(expression, facts, (left, right) => left !== right);
    case "greater-than-or-equal":
      return evaluateNumericComparison(expression, facts, (left, right) => left >= right);
    case "less-than":
      return evaluateNumericComparison(expression, facts, (left, right) => left < right);
    case "and":
      return evaluateAnd(expression["predicates"], facts);
    case "or":
      return evaluateOr(expression["predicates"], facts);
    case "not":
      return invertPredicate(evaluatePredicate(expression["predicate"], facts));
    default:
      return { outcome: "indeterminate", reason: "predicate kind is malformed" };
  }
}

export function evaluateBackstops(
  input: KernelBackstopInput,
): KernelBackstopEvaluation {
  if (!isValidatedKernelPolicyArtifactToken(input.token)) {
    throw new Error("validated policy artifact token is required for backstop evaluation");
  }
  assertJudgedActivationCount(
    input.policy_warmup_judged_activations,
    "policy_warmup_judged_activations",
  );
  if (input.warmup_length !== undefined) {
    assertJudgedActivationCount(input.warmup_length, "warmup_length");
  }

  const asOfMs = parseInstantMs(input.as_of, "as_of");
  const outcomes: KernelBackstopOutcome[] = [];
  const policyAgeMs =
    asOfMs - parseInstantMs(input.last_policy_revalidated_at, "last_policy_revalidated_at");
  const noAnchor = input.token.no_anchor;

  if (noAnchor) {
    if (policyAgeMs >= KERNEL_BACKSTOPS.maxPolicyAgeNoAnchorMs) {
      outcomes.push({
        backstop: "max_policy_age_no_anchor",
        action: "force-policy-revalidation",
        reason: "no-anchor policy age crossed the 7 day substitution ceiling",
      });
    }
  } else if (policyAgeMs >= KERNEL_BACKSTOPS.maxPolicyAgeMs) {
    outcomes.push({
      backstop: "max_policy_age",
      action: "force-policy-revalidation",
      reason: "policy age crossed the 30 day ceiling",
    });
  }

  const sinceRecompileMs =
    asOfMs - parseInstantMs(input.last_recompile_at, "last_recompile_at");
  if (
    input.recompile_requested &&
    sinceRecompileMs < KERNEL_BACKSTOPS.minRecompileIntervalMs
  ) {
    outcomes.push({
      backstop: "min_recompile_interval",
      action: "delay-recompile-for-min-interval",
      reason: "anti-thrash floor delays recompile but not safety escalation",
    });
  }

  if (
    input.observed_calibration_divergence_multiplier !== undefined &&
    input.observed_calibration_divergence_multiplier >=
      KERNEL_BACKSTOPS.maxCalibrationDivergenceMultiplier
  ) {
    outcomes.push({
      backstop: "max_calibration_divergence",
      action: "force-policy-recompile",
      reason: "observed calibration divergence crossed the 2x ceiling",
    });
  }

  if (!noAnchor) {
    if (input.max_calibration_evidence_age_ms === undefined) {
      outcomes.push({
        backstop: "max_calibration_evidence_age",
        action: "enter-degraded-calibration",
        reason: "missing calibration evidence age seed fails closed as stale",
      });
    } else if (input.calibration_evidence_as_of === undefined) {
      outcomes.push({
        backstop: "max_calibration_evidence_age",
        action: "enter-degraded-calibration",
        reason: "missing calibration evidence fails closed as stale",
      });
    } else {
      const evidenceAgeMs =
        asOfMs -
        parseInstantMs(input.calibration_evidence_as_of, "calibration_evidence_as_of");
      if (evidenceAgeMs >= input.max_calibration_evidence_age_ms) {
        outcomes.push({
          backstop: "max_calibration_evidence_age",
          action: "enter-degraded-calibration",
          reason: "calibration evidence is stale",
        });
      }
    }
  }

  if (input.warmup_length === undefined) {
    outcomes.push({
      backstop: "warmup_length",
      action: "no-last-known-good",
      reason: "missing warmup seed means no policy attains last-known-good",
    });
  } else if (input.policy_warmup_judged_activations < input.warmup_length) {
    outcomes.push({
      backstop: "warmup_length",
      action: "no-last-known-good",
      reason: "policy has not completed warmup without tripping",
    });
  }

  if (noAnchor) {
    if (input.last_unforced_deep_at === undefined) {
      outcomes.push({
        backstop: "max_unforced_deep_interval",
        action: "force-deep-revalidation",
        reason: "no-anchor B2 requires a deep revalidation baseline",
      });
    } else {
      const unforcedDeepAgeMs =
        asOfMs - parseInstantMs(input.last_unforced_deep_at, "last_unforced_deep_at");
      if (unforcedDeepAgeMs >= KERNEL_BACKSTOPS.maxUnforcedDeepIntervalMs) {
        outcomes.push({
          backstop: "max_unforced_deep_interval",
          action: "force-deep-revalidation",
          reason: "no-anchor B2 crossed the 7 day forced deep interval",
        });
      }
    }
  }

  return { outcomes };
}

export function validateKernelPolicyArtifact(
  input: KernelPolicyArtifactValidationInput,
): KernelPolicyArtifactValidation {
  const liveObservableSet = new Set(input.live_observables);
  const predicateFacts = extractPredicateFacts(input.falsification_predicate);
  const falsificationLiveObservableRefs = liveRefs(predicateFacts, liveObservableSet);
  const divergenceFacts =
    input.backstop_divergence_predicate === undefined
      ? []
      : extractPredicateFacts(input.backstop_divergence_predicate);
  const divergenceLiveObservableRefs = liveRefs(divergenceFacts, liveObservableSet);
  const liveObservableRefs = liveRefs(
    [...predicateFacts, ...divergenceFacts],
    liveObservableSet,
  );
  const errors: string[] = [];

  if (falsificationLiveObservableRefs.length === 0) {
    errors.push("falsification predicate must reference at least one live observable");
  }
  if (input.no_anchor && input.backstop_divergence_predicate === undefined) {
    errors.push("no-anchor policy requires a B2 backstop_divergence_predicate");
  }
  if (
    input.no_anchor &&
    input.backstop_divergence_predicate !== undefined &&
    divergenceLiveObservableRefs.length === 0
  ) {
    errors.push(
      "no-anchor backstop_divergence_predicate must reference at least one live observable",
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors, live_observable_refs: liveObservableRefs };
  }

  const token = createValidatedKernelPolicyArtifactToken({
    no_anchor: input.no_anchor,
    live_observable_refs: liveObservableRefs,
    ...(input.backstop_divergence_predicate === undefined
      ? {}
      : { backstop_divergence_predicate: input.backstop_divergence_predicate }),
  });

  return { ok: true, live_observable_refs: token.live_observable_refs, token };
}

export function evaluateBackstopDivergencePredicate(
  input: BackstopDivergenceEvaluationInput,
): BackstopDivergenceEvaluation {
  if (!isValidatedKernelPolicyArtifactToken(input.token)) {
    return {
      outcome: "indeterminate",
      predicate: {
        outcome: "indeterminate",
        reason: "validated policy artifact token is missing or malformed",
      },
    };
  }

  const predicateExpression = input.token.backstop_divergence_predicate;
  if (predicateExpression === undefined) {
    return {
      outcome: "indeterminate",
      predicate: {
        outcome: "indeterminate",
        reason: "validated policy artifact token has no backstop_divergence_predicate",
      },
    };
  }

  const outsideLiveRefsFact = firstFactOutsideLiveRefs(
    predicateExpression,
    input.token.live_observable_refs,
  );
  if (outsideLiveRefsFact !== undefined) {
    return {
      outcome: "indeterminate",
      predicate: {
        outcome: "indeterminate",
        reason: `backstop_divergence_predicate references non-live observable ${outsideLiveRefsFact}`,
      },
    };
  }

  const predicate = evaluatePredicate(predicateExpression, input.facts);

  if (predicate.outcome === "not-tripped") {
    return { outcome: "not-tripped", predicate };
  }
  if (predicate.outcome === "indeterminate") {
    return { outcome: "indeterminate", predicate };
  }

  return {
    outcome: "force-policy-recompile",
    predicate,
    receipt: createKernelSafetyReceipt({
      ...input.receipt_input,
      reason: "backstop-divergence",
      fix_target: "policy-artifact",
      interrupt_cause: "needs-judgment",
      event_cause: "escalation",
    }),
  };
}

export function resolvePersistentIndeterminate(
  input: PersistentIndeterminateInput,
): PersistentIndeterminateResolution {
  assertIntervalBasis(input.interval_basis, "interval_basis");
  const elapsedMs =
    parseInstantMs(input.as_of, "as_of") -
    parseInstantMs(input.first_indeterminate_at, "first_indeterminate_at");

  if (elapsedMs < input.backstop_interval_ms) {
    return {
      outcome: "pending",
      remaining_ms: input.backstop_interval_ms - elapsedMs,
    };
  }

  return {
    outcome: "needs-judgment",
    receipt: createKernelSafetyReceipt({
      ...input.receipt_input,
      as_of: input.as_of,
      reason: "persistent-indeterminate",
      fix_target: "contract-author",
      interrupt_cause: "needs-judgment",
      event_cause: "escalation",
    }),
  };
}

export function compareRollback(
  input: RollbackComparisonInput,
): RollbackComparison {
  assertJudgedActivationCount(
    input.fresh_policy_judged_activations_before_trip,
    "fresh_policy_judged_activations_before_trip",
  );
  if (input.last_known_good_judged_activations_before_trip !== undefined) {
    assertJudgedActivationCount(
      input.last_known_good_judged_activations_before_trip,
      "last_known_good_judged_activations_before_trip",
    );
  }

  if (
    input.last_known_good_revision === undefined ||
    input.last_known_good_judged_activations_before_trip === undefined
  ) {
    return {
      outcome: "no-last-known-good",
      reason: "rollback target absent; kernel must enter the safest available path",
    };
  }

  if (
    input.fresh_policy_judged_activations_before_trip <
    input.last_known_good_judged_activations_before_trip
  ) {
    return {
      outcome: "rollback",
      reason: "fresh policy tripped in fewer judged activations than last-known-good",
      target_policy_revision: input.last_known_good_revision,
    };
  }

  return {
    outcome: "keep-current",
    reason: "fresh policy did not prove worse by judged activation count",
    target_policy_revision: input.fresh_policy_revision,
  };
}

export function detectReceiptCycles(
  edges: readonly ConsumedReceiptEdge[],
): CycleDetectionResult {
  const graph = createCanonicalReceiptGraph(edges);

  const visiting = new Set<ContentHashV0>();
  const visited = new Set<ContentHashV0>();
  const path: ContentHashV0[] = [];

  for (const node of graph.keys()) {
    const cycle = visitCycleNode(node, graph, visiting, visited, path);
    if (cycle.length > 0) {
      return { cycle_checked: true, has_cycle: true, cycle };
    }
  }

  return { cycle_checked: true, has_cycle: false, cycle: [] };
}

export function createKernelSafetyReceipt(
  input: KernelSafetyReceiptInput,
): ReceiptV0 {
  if (input.evidence_input_ids.length === 0) {
    throw new Error("kernel safety receipts require at least one evidence_input_id");
  }

  const role = input.role ?? "judge";
  const eventCause = input.event_cause ?? "escalation";

  return createReceiptV0({
    core: {
      responsibility_id: input.responsibility_id,
      contract_revision: input.contract_revision,
      event_cause: eventCause,
      memo_key: input.memo_key,
      evidence_input_ids: input.evidence_input_ids,
      as_of: input.as_of,
      role,
    },
    sig: createNullSignerReceiptSignatureV0(),
    verdict: {
      status: "blocked",
      confidence: {
        value: 0,
        derivation_method: "kernel-fail-safe",
        calibration_grade: "none",
        label_source: "deterministic-kernel",
      },
      blocked: {
        reason: input.reason,
        fix_target: input.fix_target,
        interrupt_cause: input.interrupt_cause,
      },
    },
    freshness: {
      as_of: input.as_of,
      next_forecast_recheck: input.next_forecast_recheck ?? input.as_of,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: input.cycle_checked ?? false,
    },
    cost: {
      provider: "kernel",
      model: "deterministic",
      role,
      tags: ["kernel", "fail-safe"],
      responsibility_id: input.responsibility_id,
      run_id: `kernel-${input.as_of}`,
      as_of: input.as_of,
      tokens: { fresh: 0, reused: 0 },
      surprise_cause: eventCause,
    },
  });
}

interface ValidatedKernelPolicyArtifactTokenInput {
  readonly no_anchor: boolean;
  readonly live_observable_refs: readonly string[];
  readonly backstop_divergence_predicate?: KernelPredicateExpression;
}

function createValidatedKernelPolicyArtifactToken(
  input: ValidatedKernelPolicyArtifactTokenInput,
): ValidatedKernelPolicyArtifactToken {
  const token: ValidatedKernelPolicyArtifactToken = {
    [VALIDATED_KERNEL_POLICY_ARTIFACT_TOKEN_BRAND]: true,
    no_anchor: input.no_anchor,
    live_observable_refs: Object.freeze([...input.live_observable_refs]),
    ...(input.backstop_divergence_predicate === undefined
      ? {}
      : {
          backstop_divergence_predicate: cloneAndFreezePredicate(
            input.backstop_divergence_predicate,
          ),
        }),
  };

  return Object.freeze(token);
}

function isValidatedKernelPolicyArtifactToken(
  value: unknown,
): value is ValidatedKernelPolicyArtifactToken {
  if (!isRecord(value)) {
    return false;
  }

  const brand = (value as {
    readonly [VALIDATED_KERNEL_POLICY_ARTIFACT_TOKEN_BRAND]?: unknown;
  })[VALIDATED_KERNEL_POLICY_ARTIFACT_TOKEN_BRAND];
  const liveObservableRefs = value["live_observable_refs"];

  return (
    brand === true &&
    typeof value["no_anchor"] === "boolean" &&
    Array.isArray(liveObservableRefs) &&
    liveObservableRefs.every((ref) => typeof ref === "string" && ref.length > 0)
  );
}

function cloneAndFreezePredicate(
  expression: KernelPredicateExpression,
): KernelPredicateExpression {
  switch (expression.kind) {
    case "equals":
    case "not-equals":
    case "greater-than-or-equal":
    case "less-than":
      return Object.freeze({ ...expression });
    case "and":
    case "or":
      return Object.freeze({
        kind: expression.kind,
        predicates: Object.freeze(
          expression.predicates.map((predicate) => cloneAndFreezePredicate(predicate)),
        ),
      });
    case "not":
      return Object.freeze({
        kind: "not",
        predicate: cloneAndFreezePredicate(expression.predicate),
      });
  }
}

function firstFactOutsideLiveRefs(
  expression: KernelPredicateExpression,
  liveObservableRefs: readonly string[],
): string | undefined {
  const liveObservableSet = new Set(liveObservableRefs);

  return extractPredicateFacts(expression).find((fact) => !liveObservableSet.has(fact));
}

function liveRefs(
  facts: readonly string[],
  liveObservableSet: ReadonlySet<string>,
): readonly string[] {
  return [...new Set(facts)]
    .filter((fact) => liveObservableSet.has(fact))
    .sort((left, right) => left.localeCompare(right));
}

function assertIntervalBasis(value: IntervalBasis, name: string): void {
  if (value !== "elapsed-time") {
    throw new Error(`${name} must be elapsed-time for v0.1`);
  }
}

function assertJudgedActivationCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
}

function evaluateFactComparison(
  expression: Readonly<Record<string, unknown>>,
  facts: KernelFacts,
  compare: (left: KernelFactValue, right: KernelFactValue) => boolean,
): PredicateEvaluation {
  const factName = expression["fact"];
  if (typeof factName !== "string" || factName.length === 0) {
    return { outcome: "indeterminate", reason: "predicate fact is malformed" };
  }

  const expected = expression["value"];
  if (!isFactValue(expected)) {
    return { outcome: "indeterminate", reason: "predicate value is malformed" };
  }

  if (!Object.prototype.hasOwnProperty.call(facts, factName)) {
    return { outcome: "indeterminate", reason: `missing fact ${factName}` };
  }

  return compare(facts[factName] ?? null, expected)
    ? { outcome: "tripped" }
    : { outcome: "not-tripped" };
}

function evaluateNumericComparison(
  expression: Readonly<Record<string, unknown>>,
  facts: KernelFacts,
  compare: (left: number, right: number) => boolean,
): PredicateEvaluation {
  const factName = expression["fact"];
  const expected = expression["value"];
  if (typeof factName !== "string" || factName.length === 0) {
    return { outcome: "indeterminate", reason: "predicate fact is malformed" };
  }
  if (typeof expected !== "number" || !Number.isFinite(expected)) {
    return { outcome: "indeterminate", reason: "predicate threshold is malformed" };
  }
  if (!Object.prototype.hasOwnProperty.call(facts, factName)) {
    return { outcome: "indeterminate", reason: `missing fact ${factName}` };
  }

  const actual = facts[factName];
  if (typeof actual !== "number" || !Number.isFinite(actual)) {
    return { outcome: "indeterminate", reason: `fact ${factName} is not numeric` };
  }

  return compare(actual, expected)
    ? { outcome: "tripped" }
    : { outcome: "not-tripped" };
}

function evaluateAnd(
  predicates: unknown,
  facts: KernelFacts,
): PredicateEvaluation {
  if (!Array.isArray(predicates) || predicates.length === 0) {
    return { outcome: "indeterminate", reason: "and predicate is malformed" };
  }

  let indeterminateReason: string | undefined;
  for (const predicate of predicates) {
    const result = evaluatePredicate(predicate, facts);
    if (result.outcome === "not-tripped") {
      return { outcome: "not-tripped" };
    }
    if (result.outcome === "indeterminate") {
      indeterminateReason = result.reason ?? "and predicate is indeterminate";
    }
  }

  return indeterminateReason === undefined
    ? { outcome: "tripped" }
    : { outcome: "indeterminate", reason: indeterminateReason };
}

function evaluateOr(
  predicates: unknown,
  facts: KernelFacts,
): PredicateEvaluation {
  if (!Array.isArray(predicates) || predicates.length === 0) {
    return { outcome: "indeterminate", reason: "or predicate is malformed" };
  }

  let indeterminateReason: string | undefined;
  for (const predicate of predicates) {
    const result = evaluatePredicate(predicate, facts);
    if (result.outcome === "tripped") {
      return { outcome: "tripped" };
    }
    if (result.outcome === "indeterminate") {
      indeterminateReason = result.reason ?? "or predicate is indeterminate";
    }
  }

  return indeterminateReason === undefined
    ? { outcome: "not-tripped" }
    : { outcome: "indeterminate", reason: indeterminateReason };
}

function invertPredicate(result: PredicateEvaluation): PredicateEvaluation {
  if (result.outcome === "indeterminate") {
    return result;
  }

  return result.outcome === "tripped"
    ? { outcome: "not-tripped" }
    : { outcome: "tripped" };
}

function extractPredicateFacts(expression: unknown): readonly string[] {
  const facts = new Set<string>();
  collectPredicateFacts(expression, facts);
  return [...facts].sort((left, right) => left.localeCompare(right));
}

function collectPredicateFacts(expression: unknown, facts: Set<string>): void {
  if (!isRecord(expression)) {
    return;
  }

  const kind = expression["kind"];
  switch (kind) {
    case "equals":
    case "not-equals":
    case "greater-than-or-equal":
    case "less-than": {
      const fact = expression["fact"];
      if (typeof fact === "string" && fact.length > 0) {
        facts.add(fact);
      }
      return;
    }
    case "and":
    case "or": {
      const predicates = expression["predicates"];
      if (Array.isArray(predicates)) {
        for (const predicate of predicates) {
          collectPredicateFacts(predicate, facts);
        }
      }
      return;
    }
    case "not":
      collectPredicateFacts(expression["predicate"], facts);
      return;
    default:
      return;
  }
}

function visitCycleNode(
  node: ContentHashV0,
  graph: ReadonlyMap<ContentHashV0, readonly ContentHashV0[]>,
  visiting: Set<ContentHashV0>,
  visited: Set<ContentHashV0>,
  path: ContentHashV0[],
): readonly ContentHashV0[] {
  if (visited.has(node)) {
    return [];
  }

  const existingIndex = path.indexOf(node);
  if (visiting.has(node) && existingIndex >= 0) {
    return [...path.slice(existingIndex), node];
  }

  visiting.add(node);
  path.push(node);

  for (const next of graph.get(node) ?? []) {
    const cycle = visitCycleNode(next, graph, visiting, visited, path);
    if (cycle.length > 0) {
      return cycle;
    }
  }

  path.pop();
  visiting.delete(node);
  visited.add(node);
  return [];
}

function createCanonicalReceiptGraph(
  edges: readonly ConsumedReceiptEdge[],
): ReadonlyMap<ContentHashV0, readonly ContentHashV0[]> {
  if (!Array.isArray(edges)) {
    throw new Error("receipt cycle edges must be an array");
  }

  const adjacency = new Map<ContentHashV0, Set<ContentHashV0>>();

  for (const [index, edge] of edges.entries()) {
    assertConsumedReceiptEdge(edge, index);
    receiptGraphTargets(adjacency, edge.from).add(edge.to);
    receiptGraphTargets(adjacency, edge.to);
  }

  const graph = new Map<ContentHashV0, readonly ContentHashV0[]>();
  for (const node of [...adjacency.keys()].sort(compareContentHashV0)) {
    const targets = adjacency.get(node) ?? new Set<ContentHashV0>();
    graph.set(node, [...targets].sort(compareContentHashV0));
  }

  return graph;
}

function receiptGraphTargets(
  adjacency: Map<ContentHashV0, Set<ContentHashV0>>,
  node: ContentHashV0,
): Set<ContentHashV0> {
  const existing = adjacency.get(node);
  if (existing !== undefined) {
    return existing;
  }

  const targets = new Set<ContentHashV0>();
  adjacency.set(node, targets);
  return targets;
}

function assertConsumedReceiptEdge(
  edge: unknown,
  index: number,
): asserts edge is ConsumedReceiptEdge {
  if (!isRecord(edge)) {
    throw new Error(`receipt cycle edges[${index}] must be an object`);
  }

  assertContentHashV0(edge["from"], `receipt cycle edges[${index}].from`);
  assertContentHashV0(edge["to"], `receipt cycle edges[${index}].to`);
}

function assertContentHashV0(
  value: unknown,
  name: string,
): asserts value is ContentHashV0 {
  if (typeof value !== "string" || !CONTENT_HASH_V0_PATTERN.test(value)) {
    throw new Error(`${name} must use sha256:<64 lowercase hex>`);
  }
}

function compareContentHashV0(
  left: ContentHashV0,
  right: ContentHashV0,
): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function isFactValue(value: unknown): value is KernelFactValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInstantMs(value: string, name: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a replayable instant`);
  }

  return parsed;
}
