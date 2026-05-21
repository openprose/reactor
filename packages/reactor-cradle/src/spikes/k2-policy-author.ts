import type {
  KernelPolicyArtifactValidation,
  KernelPredicateExpression,
} from "@openprose/reactor/kernel";

type ReactorKernelModule = typeof import("@openprose/reactor/kernel");

const { KERNEL_BACKSTOPS, KERNEL_DAY_MS, validateKernelPolicyArtifact } =
  loadReactorKernel();

export const K2_POLICY_AUTHOR_FIXTURE_SCHEMA_V0 =
  "openprose.reactor-cradle.k2-policy-author-fixture" as const;
export const K2_POLICY_AUTHOR_FIXTURE_VERSION_V0 = 0 as const;
export const K2_KNOWN_RESPONSIBILITY_ID =
  "incident-channel-current-briefing" as const;

export type K2PolicyAuthorEvaluationStatusV0 = "pass" | "fail";

export interface K2PolicyAuthorEvaluationOptionsV0 {
  readonly expected_responsibility_id?: string;
}

export interface K2PolicyAuthorEvidenceV0 {
  readonly path: string;
  readonly message: string;
  readonly observed?: unknown;
}

export interface K2PolicyAuthorEvaluationV0 {
  readonly ok: boolean;
  readonly status: K2PolicyAuthorEvaluationStatusV0;
  readonly summary: string;
  readonly responsibility_id?: string;
  readonly live_observable_refs: readonly string[];
  readonly evidence: readonly K2PolicyAuthorEvidenceV0[];
  readonly failures: readonly K2PolicyAuthorEvidenceV0[];
  readonly kernel_validation?: KernelPolicyArtifactValidation;
}

const LIVE_OBSERVABLE_SOURCES = new Set([
  "connector",
  "receipt-log",
  "kernel-backstop",
  "cost-ledger",
  "human-label-stream",
]);

export function evaluateK2PolicyAuthorFixtureV0(
  fixture: unknown,
  options: K2PolicyAuthorEvaluationOptionsV0 = {},
): K2PolicyAuthorEvaluationV0 {
  const failures: K2PolicyAuthorEvidenceV0[] = [];
  const evidence: K2PolicyAuthorEvidenceV0[] = [];
  const expectedResponsibilityId =
    options.expected_responsibility_id ?? K2_KNOWN_RESPONSIBILITY_ID;

  if (!isRecord(fixture)) {
    push(failures, "$", "K2 policy-author fixture must be an object");
    return finish({ failures, evidence, liveObservableRefs: [] });
  }

  validateEnvelope(fixture, failures);

  const responsibility = fixture["responsibility"];
  const responsibilityId = readResponsibility(
    responsibility,
    expectedResponsibilityId,
    failures,
    evidence,
  );
  const noAnchor = isRecord(responsibility)
    ? readBoolean(responsibility["no_anchor"], "responsibility.no_anchor", failures)
    : undefined;
  const liveObservableIds = readLiveObservableIds(
    fixture["live_observables"],
    failures,
    evidence,
  );

  const authoredPolicy = fixture["authored_policy"];
  const policy = readAuthoredPolicy(
    authoredPolicy,
    responsibilityId,
    noAnchor,
    failures,
    evidence,
  );

  if (
    policy !== undefined &&
    noAnchor !== undefined &&
    liveObservableIds.length > 0
  ) {
    validatePredicateLiveFacts(
      policy.falsification_predicate,
      "authored_policy.falsification_predicate",
      liveObservableIds,
      failures,
      evidence,
    );

    if (policy.backstop_divergence_predicate !== undefined) {
      validatePredicateLiveFacts(
        policy.backstop_divergence_predicate,
        "authored_policy.backstop_divergence_predicate",
        liveObservableIds,
        failures,
        evidence,
      );
    }
  }

  let kernelValidation: KernelPolicyArtifactValidation | undefined;
  if (
    failures.length === 0 &&
    policy !== undefined &&
    noAnchor !== undefined
  ) {
    kernelValidation = validateKernelPolicyArtifact({
      no_anchor: noAnchor,
      falsification_predicate: policy.falsification_predicate,
      live_observables: liveObservableIds,
      ...(policy.backstop_divergence_predicate === undefined
        ? {}
        : {
            backstop_divergence_predicate:
              policy.backstop_divergence_predicate,
          }),
    });

    if (!kernelValidation.ok) {
      push(failures, "authored_policy", "kernel B3 validation rejected policy", {
        errors: kernelValidation.errors,
        live_observable_refs: kernelValidation.live_observable_refs,
      });
    } else {
      push(evidence, "authored_policy", "kernel B3 validation passed", {
        live_observable_refs: kernelValidation.live_observable_refs,
      });
    }
  }

  return finish({
    failures,
    evidence,
    liveObservableRefs: collectPolicyLiveObservableRefs(policy, liveObservableIds),
    responsibilityId,
    kernelValidation,
  });
}

interface ReadAuthoredPolicyV0 {
  readonly falsification_predicate: KernelPredicateExpression;
  readonly backstop_divergence_predicate?: KernelPredicateExpression;
}

function validateEnvelope(
  fixture: Readonly<Record<string, unknown>>,
  failures: K2PolicyAuthorEvidenceV0[],
): void {
  if (fixture["schema"] !== K2_POLICY_AUTHOR_FIXTURE_SCHEMA_V0) {
    push(failures, "schema", "fixture schema is not the K2 policy-author v0 schema", {
      expected: K2_POLICY_AUTHOR_FIXTURE_SCHEMA_V0,
      actual: fixture["schema"] ?? null,
    });
  }
  if (fixture["v"] !== K2_POLICY_AUTHOR_FIXTURE_VERSION_V0) {
    push(failures, "v", "fixture version is not K2 policy-author v0", {
      expected: K2_POLICY_AUTHOR_FIXTURE_VERSION_V0,
      actual: fixture["v"] ?? null,
    });
  }
}

function readResponsibility(
  value: unknown,
  expectedResponsibilityId: string,
  failures: K2PolicyAuthorEvidenceV0[],
  evidence: K2PolicyAuthorEvidenceV0[],
): string | undefined {
  if (!isRecord(value)) {
    push(failures, "responsibility", "fixture must name a known responsibility");
    return undefined;
  }

  const id = readNonEmptyString(value["id"], "responsibility.id", failures);
  readNonEmptyString(value["statement"], "responsibility.statement", failures);

  if (id !== undefined && id !== expectedResponsibilityId) {
    push(failures, "responsibility.id", "fixture targets an unknown responsibility", {
      expected: expectedResponsibilityId,
      actual: id,
    });
  }

  if (id !== undefined) {
    push(evidence, "responsibility.id", "recognized K2 known responsibility", {
      id,
    });
  }

  return id;
}

function readLiveObservableIds(
  value: unknown,
  failures: K2PolicyAuthorEvidenceV0[],
  evidence: K2PolicyAuthorEvidenceV0[],
): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    push(
      failures,
      "live_observables",
      "policy-author fixture must include at least one live observable",
    );
    return [];
  }

  const ids: string[] = [];
  const seen = new Set<string>();

  value.forEach((observable, index) => {
    const path = `live_observables[${index}]`;
    if (!isRecord(observable)) {
      push(failures, path, "live observable must be an object");
      return;
    }

    const id = readNonEmptyString(observable["id"], `${path}.id`, failures);
    const source = readNonEmptyString(
      observable["source"],
      `${path}.source`,
      failures,
    );
    readNonEmptyString(observable["description"], `${path}.description`, failures);

    if (source !== undefined && !LIVE_OBSERVABLE_SOURCES.has(source)) {
      push(failures, `${path}.source`, "live observable source is not replayable", {
        allowed: [...LIVE_OBSERVABLE_SOURCES].sort(),
        actual: source,
      });
    }

    if (id !== undefined) {
      if (seen.has(id)) {
        push(failures, `${path}.id`, "live observable ids must be unique", {
          id,
        });
      } else {
        seen.add(id);
        ids.push(id);
      }
    }
  });

  if (ids.length > 0) {
    push(evidence, "live_observables", "fixture declares replayable live facts", {
      ids: [...ids].sort(),
    });
  }

  return [...ids].sort();
}

function readAuthoredPolicy(
  value: unknown,
  responsibilityId: string | undefined,
  noAnchor: boolean | undefined,
  failures: K2PolicyAuthorEvidenceV0[],
  evidence: K2PolicyAuthorEvidenceV0[],
): ReadAuthoredPolicyV0 | undefined {
  if (!isRecord(value)) {
    push(failures, "authored_policy", "fixture must include authored policy output");
    return undefined;
  }

  readNonEmptyString(value["registry_id"], "authored_policy.registry_id", failures);
  readNonEmptyString(
    value["policy_revision"],
    "authored_policy.policy_revision",
    failures,
  );

  const policyResponsibilityId = readNonEmptyString(
    value["responsibility_id"],
    "authored_policy.responsibility_id",
    failures,
  );
  if (
    responsibilityId !== undefined &&
    policyResponsibilityId !== undefined &&
    policyResponsibilityId !== responsibilityId
  ) {
    push(
      failures,
      "authored_policy.responsibility_id",
      "authored policy targets a different responsibility than the fixture",
      {
        expected: responsibilityId,
        actual: policyResponsibilityId,
      },
    );
  }

  validateCadence(value["cadence"], noAnchor, failures, evidence);
  validateHysteresis(value["hysteresis"], failures, evidence);
  validateThresholds(value["thresholds"], failures, evidence);

  const falsificationPredicate = value["falsification_predicate"];
  const hasFalsificationPredicate = isKernelPredicateExpression(
    falsificationPredicate,
    "authored_policy.falsification_predicate",
    failures,
  );

  const divergencePredicate = value["backstop_divergence_predicate"];
  let backstopDivergencePredicate: KernelPredicateExpression | undefined;
  if (
    divergencePredicate !== undefined &&
    isKernelPredicateExpression(
      divergencePredicate,
      "authored_policy.backstop_divergence_predicate",
      failures,
    )
  ) {
    backstopDivergencePredicate = divergencePredicate;
  }

  if (noAnchor === true && divergencePredicate === undefined) {
    push(
      failures,
      "authored_policy.backstop_divergence_predicate",
      "no-anchor K2 policy must carry the B2 backstop divergence predicate",
    );
  }

  if (!hasFalsificationPredicate) {
    return undefined;
  }

  const policy: ReadAuthoredPolicyV0 = {
    falsification_predicate: falsificationPredicate,
    ...(backstopDivergencePredicate === undefined
      ? {}
      : { backstop_divergence_predicate: backstopDivergencePredicate }),
  };

  push(evidence, "authored_policy", "authored registry carries executable predicates", {
    falsification_facts: collectPredicateFacts(policy.falsification_predicate),
    backstop_divergence_facts:
      policy.backstop_divergence_predicate === undefined
        ? []
        : collectPredicateFacts(policy.backstop_divergence_predicate),
  });

  return policy;
}

function validateCadence(
  value: unknown,
  noAnchor: boolean | undefined,
  failures: K2PolicyAuthorEvidenceV0[],
  evidence: K2PolicyAuthorEvidenceV0[],
): void {
  if (!isRecord(value)) {
    push(failures, "authored_policy.cadence", "policy must carry cadence shape");
    return;
  }

  const shallow = readPositiveSafeInteger(
    value["shallow_recheck_ms"],
    "authored_policy.cadence.shallow_recheck_ms",
    failures,
  );
  const planAudit = readPositiveSafeInteger(
    value["plan_audit_ms"],
    "authored_policy.cadence.plan_audit_ms",
    failures,
  );
  const deep = readPositiveSafeInteger(
    value["deep_revalidation_ms"],
    "authored_policy.cadence.deep_revalidation_ms",
    failures,
  );

  if (shallow !== undefined && shallow < 5 * 60 * 1000) {
    push(
      failures,
      "authored_policy.cadence.shallow_recheck_ms",
      "shallow cadence is too tight for a recorded v0.1 policy",
      { minimum_ms: 5 * 60 * 1000, actual: shallow },
    );
  }
  if (
    shallow !== undefined &&
    planAudit !== undefined &&
    shallow > planAudit
  ) {
    push(
      failures,
      "authored_policy.cadence",
      "plan-audit cadence must not be more frequent than shallow recheck cadence",
      { shallow_recheck_ms: shallow, plan_audit_ms: planAudit },
    );
  }
  if (planAudit !== undefined && deep !== undefined && planAudit > deep) {
    push(
      failures,
      "authored_policy.cadence",
      "deep revalidation cadence must be at least as wide as plan-audit cadence",
      { plan_audit_ms: planAudit, deep_revalidation_ms: deep },
    );
  }
  if (
    noAnchor === true &&
    deep !== undefined &&
    deep > KERNEL_BACKSTOPS.maxUnforcedDeepIntervalMs
  ) {
    push(
      failures,
      "authored_policy.cadence.deep_revalidation_ms",
      "no-anchor deep cadence cannot exceed the fixed B2 deep interval",
      {
        maximum_ms: KERNEL_BACKSTOPS.maxUnforcedDeepIntervalMs,
        actual: deep,
      },
    );
  }

  if (shallow !== undefined && planAudit !== undefined && deep !== undefined) {
    push(evidence, "authored_policy.cadence", "cadence shape is replayable", {
      shallow_recheck_ms: shallow,
      plan_audit_ms: planAudit,
      deep_revalidation_ms: deep,
    });
  }
}

function validateHysteresis(
  value: unknown,
  failures: K2PolicyAuthorEvidenceV0[],
  evidence: K2PolicyAuthorEvidenceV0[],
): void {
  if (!isRecord(value)) {
    push(
      failures,
      "authored_policy.hysteresis",
      "policy must carry hysteresis shape",
    );
    return;
  }

  const minRecompile = readPositiveSafeInteger(
    value["min_recompile_interval_ms"],
    "authored_policy.hysteresis.min_recompile_interval_ms",
    failures,
  );
  const enter = readUnitInterval(
    value["enter_degraded_threshold"],
    "authored_policy.hysteresis.enter_degraded_threshold",
    failures,
  );
  const exit = readUnitInterval(
    value["exit_degraded_threshold"],
    "authored_policy.hysteresis.exit_degraded_threshold",
    failures,
  );
  const warmup = readPositiveSafeInteger(
    value["warmup_judged_activations"],
    "authored_policy.hysteresis.warmup_judged_activations",
    failures,
  );

  if (
    minRecompile !== undefined &&
    minRecompile < KERNEL_BACKSTOPS.minRecompileIntervalMs
  ) {
    push(
      failures,
      "authored_policy.hysteresis.min_recompile_interval_ms",
      "policy hysteresis may not shorten the fixed kernel recompile floor",
      {
        minimum_ms: KERNEL_BACKSTOPS.minRecompileIntervalMs,
        actual: minRecompile,
      },
    );
  }
  if (enter !== undefined && exit !== undefined && exit >= enter) {
    push(
      failures,
      "authored_policy.hysteresis",
      "exit threshold must be below enter threshold to avoid flip-flop",
      { enter_degraded_threshold: enter, exit_degraded_threshold: exit },
    );
  }

  if (
    minRecompile !== undefined &&
    enter !== undefined &&
    exit !== undefined &&
    warmup !== undefined
  ) {
    push(evidence, "authored_policy.hysteresis", "hysteresis band is sane", {
      min_recompile_interval_ms: minRecompile,
      enter_degraded_threshold: enter,
      exit_degraded_threshold: exit,
      warmup_judged_activations: warmup,
    });
  }
}

function validateThresholds(
  value: unknown,
  failures: K2PolicyAuthorEvidenceV0[],
  evidence: K2PolicyAuthorEvidenceV0[],
): void {
  if (!isRecord(value)) {
    push(
      failures,
      "authored_policy.thresholds",
      "policy must carry threshold shape",
    );
    return;
  }

  const divergence = readPositiveFiniteNumber(
    value["max_calibration_divergence_multiplier"],
    "authored_policy.thresholds.max_calibration_divergence_multiplier",
    failures,
  );
  const precision = readUnitInterval(
    value["escalation_precision_floor"],
    "authored_policy.thresholds.escalation_precision_floor",
    failures,
  );
  const contradictionCount = readPositiveSafeInteger(
    value["backstop_deep_contradiction_count"],
    "authored_policy.thresholds.backstop_deep_contradiction_count",
    failures,
  );
  const staleBriefMinutes = readPositiveSafeInteger(
    value["stale_brief_minutes"],
    "authored_policy.thresholds.stale_brief_minutes",
    failures,
  );
  const freshTokensCeiling = readPositiveFiniteNumber(
    value["fresh_tokens_per_day_ceiling"],
    "authored_policy.thresholds.fresh_tokens_per_day_ceiling",
    failures,
  );

  if (
    divergence !== undefined &&
    (divergence <= 1 ||
      divergence > KERNEL_BACKSTOPS.maxCalibrationDivergenceMultiplier)
  ) {
    push(
      failures,
      "authored_policy.thresholds.max_calibration_divergence_multiplier",
      "calibration divergence threshold must trip before the fixed kernel ceiling",
      {
        minimum_exclusive: 1,
        maximum: KERNEL_BACKSTOPS.maxCalibrationDivergenceMultiplier,
        actual: divergence,
      },
    );
  }
  if (
    staleBriefMinutes !== undefined &&
    staleBriefMinutes * 60 * 1000 > KERNEL_DAY_MS
  ) {
    push(
      failures,
      "authored_policy.thresholds.stale_brief_minutes",
      "incident-briefing freshness threshold must fit inside a day",
      { maximum_minutes: KERNEL_DAY_MS / 60 / 1000, actual: staleBriefMinutes },
    );
  }

  if (
    divergence !== undefined &&
    precision !== undefined &&
    contradictionCount !== undefined &&
    staleBriefMinutes !== undefined &&
    freshTokensCeiling !== undefined
  ) {
    push(evidence, "authored_policy.thresholds", "threshold shape is sane", {
      max_calibration_divergence_multiplier: divergence,
      escalation_precision_floor: precision,
      backstop_deep_contradiction_count: contradictionCount,
      stale_brief_minutes: staleBriefMinutes,
      fresh_tokens_per_day_ceiling: freshTokensCeiling,
    });
  }
}

function validatePredicateLiveFacts(
  predicate: KernelPredicateExpression,
  path: string,
  liveObservableIds: readonly string[],
  failures: K2PolicyAuthorEvidenceV0[],
  evidence: K2PolicyAuthorEvidenceV0[],
): void {
  const liveObservableSet = new Set(liveObservableIds);
  const facts = collectPredicateFacts(predicate);
  const offLiveFacts = facts.filter((fact) => !liveObservableSet.has(fact));

  if (offLiveFacts.length > 0) {
    push(failures, path, "predicate references non-live observable facts", {
      off_live_facts: offLiveFacts,
      live_observables: liveObservableIds,
    });
    return;
  }

  push(evidence, path, "predicate facts are all live observables", { facts });
}

function collectPolicyLiveObservableRefs(
  policy: ReadAuthoredPolicyV0 | undefined,
  liveObservableIds: readonly string[],
): readonly string[] {
  if (policy === undefined) {
    return [];
  }

  const liveObservableSet = new Set(liveObservableIds);

  return [
    ...new Set([
      ...collectPredicateFacts(policy.falsification_predicate),
      ...(policy.backstop_divergence_predicate === undefined
        ? []
        : collectPredicateFacts(policy.backstop_divergence_predicate)),
    ]),
  ]
    .filter((fact) => liveObservableSet.has(fact))
    .sort((left, right) => left.localeCompare(right));
}

function isKernelPredicateExpression(
  value: unknown,
  path: string,
  failures: K2PolicyAuthorEvidenceV0[],
): value is KernelPredicateExpression {
  if (!isRecord(value)) {
    push(failures, path, "predicate must be an object");
    return false;
  }

  const kind = value["kind"];
  switch (kind) {
    case "equals":
    case "not-equals":
      return validateFactPredicate(value, path, failures, false);
    case "greater-than-or-equal":
    case "less-than":
      return validateFactPredicate(value, path, failures, true);
    case "and":
    case "or":
      return validateVariadicPredicate(value, path, failures);
    case "not":
      return isKernelPredicateExpression(
        value["predicate"],
        `${path}.predicate`,
        failures,
      );
    default:
      push(failures, `${path}.kind`, "predicate kind is not supported", {
        actual: kind ?? null,
      });
      return false;
  }
}

function validateFactPredicate(
  value: Readonly<Record<string, unknown>>,
  path: string,
  failures: K2PolicyAuthorEvidenceV0[],
  numeric: boolean,
): value is KernelPredicateExpression {
  let ok = true;

  if (readNonEmptyString(value["fact"], `${path}.fact`, failures) === undefined) {
    ok = false;
  }

  const expected = value["value"];
  if (numeric) {
    if (typeof expected !== "number" || !Number.isFinite(expected)) {
      push(failures, `${path}.value`, "numeric predicate threshold is malformed", {
        actual: expected ?? null,
      });
      ok = false;
    }
  } else if (!isKernelFactValue(expected)) {
    push(failures, `${path}.value`, "predicate value is malformed", {
      actual: expected ?? null,
    });
    ok = false;
  }

  return ok;
}

function validateVariadicPredicate(
  value: Readonly<Record<string, unknown>>,
  path: string,
  failures: K2PolicyAuthorEvidenceV0[],
): value is KernelPredicateExpression {
  const predicates = value["predicates"];
  if (!Array.isArray(predicates) || predicates.length === 0) {
    push(failures, `${path}.predicates`, "variadic predicate must be non-empty");
    return false;
  }

  let ok = true;
  predicates.forEach((predicate, index) => {
    if (
      !isKernelPredicateExpression(predicate, `${path}.predicates[${index}]`, failures)
    ) {
      ok = false;
    }
  });

  return ok;
}

function collectPredicateFacts(
  expression: KernelPredicateExpression,
): readonly string[] {
  const facts = new Set<string>();
  collectFacts(expression, facts);
  return [...facts].sort((left, right) => left.localeCompare(right));
}

function collectFacts(expression: KernelPredicateExpression, facts: Set<string>): void {
  switch (expression.kind) {
    case "equals":
    case "not-equals":
    case "greater-than-or-equal":
    case "less-than":
      facts.add(expression.fact);
      return;
    case "and":
    case "or":
      expression.predicates.forEach((predicate) => collectFacts(predicate, facts));
      return;
    case "not":
      collectFacts(expression.predicate, facts);
      return;
  }
}

function readBoolean(
  value: unknown,
  path: string,
  failures: K2PolicyAuthorEvidenceV0[],
): boolean | undefined {
  if (typeof value !== "boolean") {
    push(failures, path, "field must be boolean", { actual: value ?? null });
    return undefined;
  }

  return value;
}

function readNonEmptyString(
  value: unknown,
  path: string,
  failures: K2PolicyAuthorEvidenceV0[],
): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    push(failures, path, "field must be a non-empty string", {
      actual: value ?? null,
    });
    return undefined;
  }

  return value;
}

function readPositiveSafeInteger(
  value: unknown,
  path: string,
  failures: K2PolicyAuthorEvidenceV0[],
): number | undefined {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    push(failures, path, "field must be a positive safe integer", {
      actual: value ?? null,
    });
    return undefined;
  }

  return value as number;
}

function readPositiveFiniteNumber(
  value: unknown,
  path: string,
  failures: K2PolicyAuthorEvidenceV0[],
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    push(failures, path, "field must be a positive finite number", {
      actual: value ?? null,
    });
    return undefined;
  }

  return value;
}

function readUnitInterval(
  value: unknown,
  path: string,
  failures: K2PolicyAuthorEvidenceV0[],
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 1) {
    push(failures, path, "field must be inside the open unit interval", {
      actual: value ?? null,
    });
    return undefined;
  }

  return value;
}

function isKernelFactValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function finish(input: {
  readonly failures: readonly K2PolicyAuthorEvidenceV0[];
  readonly evidence: readonly K2PolicyAuthorEvidenceV0[];
  readonly liveObservableRefs: readonly string[];
  readonly responsibilityId?: string | undefined;
  readonly kernelValidation?: KernelPolicyArtifactValidation | undefined;
}): K2PolicyAuthorEvaluationV0 {
  const ok = input.failures.length === 0;
  const result = {
    ok,
    status: ok ? ("pass" as const) : ("fail" as const),
    summary: ok
      ? "recorded K2 policy-author output passed shape and B3 validation"
      : "recorded K2 policy-author output failed closed",
    live_observable_refs: Object.freeze([...input.liveObservableRefs]),
    evidence: Object.freeze([...input.evidence]),
    failures: Object.freeze([...input.failures]),
    ...(input.responsibilityId === undefined
      ? {}
      : { responsibility_id: input.responsibilityId }),
    ...(input.kernelValidation === undefined
      ? {}
      : { kernel_validation: input.kernelValidation }),
  };

  return result;
}

function push(
  target: K2PolicyAuthorEvidenceV0[],
  path: string,
  message: string,
  observed?: unknown,
): void {
  target.push(
    observed === undefined ? { path, message } : { path, message, observed },
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadReactorKernel(): ReactorKernelModule {
  try {
    return require("@openprose/reactor/kernel") as ReactorKernelModule;
  } catch (error) {
    if (isMissingReactorKernelPackage(error)) {
      return require("../../../reactor/dist/kernel") as ReactorKernelModule;
    }

    throw error;
  }
}

function isMissingReactorKernelPackage(error: unknown): boolean {
  return (
    isRecord(error) &&
    error["code"] === "MODULE_NOT_FOUND" &&
    typeof error["message"] === "string" &&
    error["message"].includes("@openprose/reactor/kernel")
  );
}
