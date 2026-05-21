import type {
  ReceiptEventCauseV0,
  ReceiptRecheckKindV0,
  ReceiptV0,
} from "../receipt";

export const ALLOWED_SURPRISE_CAUSES_V0 = Object.freeze([
  "real-input",
  "forecast-recheck",
  "escalation",
] as const satisfies readonly ReceiptEventCauseV0[]);

export type CostRelationshipV0 =
  | "surprise-attribution-complete"
  | "flat-spend-under-static";

export type CostEvaluationIssueCodeV0 =
  | "receipt-not-object"
  | "core-not-object"
  | "core-event-cause-invalid"
  | "cost-not-object"
  | "tokens-not-object"
  | "tokens-invalid"
  | "surprise-cause-missing"
  | "surprise-cause-invalid"
  | "surprise-cause-multiple"
  | "surprise-cause-mismatch"
  | "bootstrap-receipt-count-invalid"
  | "world-profile-not-static"
  | "token-bearing-evidence-missing"
  | "post-bootstrap-fresh-spend";

export interface CostEvaluationIssueV0 {
  readonly path: string;
  readonly code: CostEvaluationIssueCodeV0;
  readonly message: string;
  readonly observed: unknown;
}

export interface ReceiptCostObservationV0 {
  readonly path: string;
  readonly token_bearing: boolean;
  readonly fresh: number;
  readonly reused: number;
  readonly surprise_cause: ReceiptEventCauseV0;
  readonly recheck_kind: ReceiptRecheckKindV0 | null;
  readonly content_hash: string | null;
}

export interface ReceiptSurpriseAttributionCheckV0 {
  readonly ok: boolean;
  readonly issues: readonly CostEvaluationIssueV0[];
  readonly observation: ReceiptCostObservationV0 | null;
}

export interface CostRelationshipEvaluationV0 {
  readonly ok: boolean;
  readonly relationship: CostRelationshipV0;
  readonly summary: string;
  readonly issues: readonly CostEvaluationIssueV0[];
  readonly checked: {
    readonly receipts: number;
    readonly token_bearing_receipts: number;
    readonly post_bootstrap_token_bearing_receipts: number;
    readonly plan_age_audit_floor_receipts: number;
  };
}

export interface FlatSpendUnderStaticInputV0 {
  readonly receipts: readonly unknown[];
  readonly bootstrap_receipt_count?: number;
  readonly world_profile?: string;
}

const ALLOWED_SURPRISE_CAUSE_SET = new Set<ReceiptEventCauseV0>(
  ALLOWED_SURPRISE_CAUSES_V0,
);
const ALLOWED_RECHECK_KIND_SET = new Set<ReceiptRecheckKindV0>([
  "evidence-age",
  "plan-age",
]);

export function isAllowedSurpriseCauseV0(
  value: unknown,
): value is ReceiptEventCauseV0 {
  return (
    typeof value === "string" &&
    ALLOWED_SURPRISE_CAUSE_SET.has(value as ReceiptEventCauseV0)
  );
}

export function isTokenBearingReceiptV0(
  receipt: Pick<ReceiptV0, "cost">,
): boolean {
  return receipt.cost.tokens.fresh + receipt.cost.tokens.reused > 0;
}

export function validateReceiptSurpriseAttributionV0(
  receipt: unknown,
  path = "receipt",
): ReceiptSurpriseAttributionCheckV0 {
  const issues: CostEvaluationIssueV0[] = [];

  if (!isRecord(receipt)) {
    return {
      ok: false,
      issues: [
        issue(
          path,
          "receipt-not-object",
          "receipt must be an object before cost attribution can be evaluated",
          receipt,
        ),
      ],
      observation: null,
    };
  }

  const cost = readRecord(receipt, "cost", path, "cost-not-object", issues);
  const core = readRecord(receipt, "core", path, "core-not-object", issues);
  if (cost === undefined || core === undefined) {
    return { ok: false, issues: Object.freeze([...issues]), observation: null };
  }

  const tokenSpend = readTokenSpend(cost, `${path}.cost`, issues);
  const coreEventCause = readCoreEventCause(core, `${path}.core`, issues);
  const surpriseCause = readExactlyOneSurpriseCause(cost, `${path}.cost`, issues);

  if (
    surpriseCause !== undefined &&
    coreEventCause !== undefined &&
    surpriseCause !== coreEventCause
  ) {
    issues.push(
      issue(
        `${path}.cost.surprise_cause`,
        "surprise-cause-mismatch",
        "cost.surprise_cause must match receipt core.event_cause",
        { surprise_cause: surpriseCause, event_cause: coreEventCause },
      ),
    );
  }

  const recheckKind = readRecheckKind(core, `${path}.core`);

  if (
    tokenSpend === undefined ||
    surpriseCause === undefined ||
    coreEventCause === undefined
  ) {
    return { ok: false, issues: Object.freeze([...issues]), observation: null };
  }

  const observation: ReceiptCostObservationV0 = {
    path: `${path}.cost`,
    token_bearing: tokenSpend.fresh + tokenSpend.reused > 0,
    fresh: tokenSpend.fresh,
    reused: tokenSpend.reused,
    surprise_cause: surpriseCause,
    recheck_kind: recheckKind,
    content_hash:
      typeof receipt["content_hash"] === "string" ? receipt["content_hash"] : null,
  };

  return {
    ok: issues.length === 0,
    issues: Object.freeze([...issues]),
    observation,
  };
}

export const validateReceiptSurpriseCauseV0 =
  validateReceiptSurpriseAttributionV0;

export function evaluateSurpriseAttributionCompleteV0(
  receipts: readonly unknown[],
): CostRelationshipEvaluationV0 {
  const checks = receipts.map((receipt, index) =>
    validateReceiptSurpriseAttributionV0(receipt, `receipts[${index}]`),
  );
  const observations = checks.flatMap((check) =>
    check.observation === null ? [] : [check.observation],
  );
  const tokenBearing = observations.filter(
    (observation) => observation.token_bearing,
  );
  const issues = checks.flatMap((check) => check.issues);

  if (tokenBearing.length === 0) {
    issues.push(
      issue(
        "receipts",
        "token-bearing-evidence-missing",
        "surprise attribution needs at least one token-bearing receipt",
        { receipts: receipts.length },
      ),
    );
  }

  return relationshipResult(
    "surprise-attribution-complete",
    issues.length === 0
      ? "all token-bearing receipts name exactly one allowed surprise cause"
      : "one or more token-bearing receipts failed surprise attribution",
    receipts.length,
    tokenBearing.length,
    0,
    0,
    issues,
  );
}

export function evaluateFlatSpendUnderStaticV0(
  input: FlatSpendUnderStaticInputV0,
): CostRelationshipEvaluationV0 {
  const issues: CostEvaluationIssueV0[] = [];
  const bootstrapReceiptCount = input.bootstrap_receipt_count ?? 1;

  if (
    !Number.isSafeInteger(bootstrapReceiptCount) ||
    bootstrapReceiptCount < 0
  ) {
    issues.push(
      issue(
        "bootstrap_receipt_count",
        "bootstrap-receipt-count-invalid",
        "bootstrap_receipt_count must be a non-negative safe integer",
        bootstrapReceiptCount,
      ),
    );
  }

  if (
    input.world_profile !== undefined &&
    input.world_profile !== "static"
  ) {
    issues.push(
      issue(
        "world_profile",
        "world-profile-not-static",
        "flat-spend-under-static only applies to static world runs",
        input.world_profile,
      ),
    );
  }

  const checks = input.receipts.map((receipt, index) =>
    validateReceiptSurpriseAttributionV0(receipt, `receipts[${index}]`),
  );
  issues.push(...checks.flatMap((check) => check.issues));

  const observations = checks.flatMap((check) =>
    check.observation === null ? [] : [check.observation],
  );
  const tokenBearing = observations.filter(
    (observation) => observation.token_bearing,
  );
  const safeBootstrapReceiptCount =
    Number.isSafeInteger(bootstrapReceiptCount) && bootstrapReceiptCount >= 0
      ? bootstrapReceiptCount
      : 0;
  const postBootstrap = tokenBearing.slice(safeBootstrapReceiptCount);

  if (tokenBearing.length === 0) {
    issues.push(
      issue(
        "receipts",
        "token-bearing-evidence-missing",
        "flat-spend-under-static needs token-bearing receipt evidence",
        { receipts: input.receipts.length },
      ),
    );
  }

  for (const observation of postBootstrap) {
    if (observation.fresh === 0 || isPlanAgeAuditObservationV0(observation)) {
      continue;
    }

    issues.push(
      issue(
        `${observation.path}.tokens.fresh`,
        "post-bootstrap-fresh-spend",
        "post-bootstrap static-world fresh spend must stay flat except plan-age audit receipts",
        {
          fresh: observation.fresh,
          reused: observation.reused,
          surprise_cause: observation.surprise_cause,
          recheck_kind: observation.recheck_kind,
          content_hash: observation.content_hash,
        },
      ),
    );
  }

  return relationshipResult(
    "flat-spend-under-static",
    issues.length === 0
      ? "static-world post-bootstrap fresh spend stayed flat apart from the plan-age audit floor"
      : "static-world post-bootstrap fresh spend increased outside the plan-age audit floor",
    input.receipts.length,
    tokenBearing.length,
    postBootstrap.length,
    postBootstrap.filter(isPlanAgeAuditObservationV0).length,
    issues,
  );
}

export function isPlanAgeAuditObservationV0(
  observation: Pick<
    ReceiptCostObservationV0,
    "surprise_cause" | "recheck_kind"
  >,
): boolean {
  return (
    observation.surprise_cause === "forecast-recheck" &&
    observation.recheck_kind === "plan-age"
  );
}

function relationshipResult(
  relationship: CostRelationshipV0,
  summary: string,
  receiptCount: number,
  tokenBearingReceiptCount: number,
  postBootstrapTokenBearingReceiptCount: number,
  planAgeAuditFloorReceiptCount: number,
  issues: readonly CostEvaluationIssueV0[],
): CostRelationshipEvaluationV0 {
  return {
    ok: issues.length === 0,
    relationship,
    summary,
    issues: Object.freeze([...issues]),
    checked: {
      receipts: receiptCount,
      token_bearing_receipts: tokenBearingReceiptCount,
      post_bootstrap_token_bearing_receipts:
        postBootstrapTokenBearingReceiptCount,
      plan_age_audit_floor_receipts: planAgeAuditFloorReceiptCount,
    },
  };
}

function readRecord(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  code: "cost-not-object" | "core-not-object",
  issues: CostEvaluationIssueV0[],
): Readonly<Record<string, unknown>> | undefined {
  const value = record[key];
  if (!isRecord(value)) {
    issues.push(
      issue(
        `${path}.${key}`,
        code,
        `${path}.${key} must be an object`,
        value,
      ),
    );
    return undefined;
  }

  return value;
}

function readTokenSpend(
  cost: Readonly<Record<string, unknown>>,
  path: string,
  issues: CostEvaluationIssueV0[],
): { readonly fresh: number; readonly reused: number } | undefined {
  const tokens = cost["tokens"];
  if (!isRecord(tokens)) {
    issues.push(
      issue(
        `${path}.tokens`,
        "tokens-not-object",
        "cost.tokens must carry fresh and reused token counts",
        tokens,
      ),
    );
    return undefined;
  }

  const fresh = tokens["fresh"];
  const reused = tokens["reused"];
  if (!isNonNegativeSafeInteger(fresh) || !isNonNegativeSafeInteger(reused)) {
    issues.push(
      issue(
        `${path}.tokens`,
        "tokens-invalid",
        "cost.tokens.fresh and cost.tokens.reused must be non-negative safe integers",
        { fresh, reused },
      ),
    );
    return undefined;
  }

  return { fresh, reused };
}

function readCoreEventCause(
  core: Readonly<Record<string, unknown>>,
  path: string,
  issues: CostEvaluationIssueV0[],
): ReceiptEventCauseV0 | undefined {
  const eventCause = core["event_cause"];
  if (!isAllowedSurpriseCauseV0(eventCause)) {
    issues.push(
      issue(
        `${path}.event_cause`,
        "core-event-cause-invalid",
        "core.event_cause must be one of the allowed surprise causes",
        eventCause,
      ),
    );
    return undefined;
  }

  return eventCause;
}

function readExactlyOneSurpriseCause(
  cost: Readonly<Record<string, unknown>>,
  path: string,
  issues: CostEvaluationIssueV0[],
): ReceiptEventCauseV0 | undefined {
  if (!Object.hasOwn(cost, "surprise_cause")) {
    issues.push(
      issue(
        `${path}.surprise_cause`,
        "surprise-cause-missing",
        "cost.surprise_cause is required for receipt v0 cost attribution",
        null,
      ),
    );
    return undefined;
  }

  const surpriseCause = cost["surprise_cause"];
  if (Array.isArray(surpriseCause) || Object.hasOwn(cost, "surprise_causes")) {
    issues.push(
      issue(
        `${path}.surprise_cause`,
        "surprise-cause-multiple",
        "receipt v0 cost attribution must name exactly one surprise cause",
        {
          surprise_cause: surpriseCause,
          surprise_causes: cost["surprise_causes"] ?? null,
        },
      ),
    );
    return undefined;
  }

  if (!isAllowedSurpriseCauseV0(surpriseCause)) {
    issues.push(
      issue(
        `${path}.surprise_cause`,
        "surprise-cause-invalid",
        "cost.surprise_cause must be one of real-input, forecast-recheck, escalation",
        surpriseCause,
      ),
    );
    return undefined;
  }

  return surpriseCause;
}

function readRecheckKind(
  core: Readonly<Record<string, unknown>>,
  path: string,
): ReceiptRecheckKindV0 | null {
  const recheckKind = core["recheck_kind"];
  if (
    typeof recheckKind === "string" &&
    ALLOWED_RECHECK_KIND_SET.has(recheckKind as ReceiptRecheckKindV0)
  ) {
    return recheckKind as ReceiptRecheckKindV0;
  }

  return null;
}

function issue(
  path: string,
  code: CostEvaluationIssueCodeV0,
  message: string,
  observed: unknown,
): CostEvaluationIssueV0 {
  return { path, code, message, observed };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
