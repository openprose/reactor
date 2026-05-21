import {
  RECEIPT_SCHEMA,
  RECEIPT_VERSION,
  inspectReceiptProofV0,
  type ContentHashV0,
  type ReceiptProofInspectionV0,
  type ReceiptVerdictStatusV0,
} from "../receipt";

export const RECEIPT_PROJECTION_SCHEMA =
  "openprose.receipt.projection" as const;
export const RECEIPT_PROJECTION_VERSION = 0 as const;
export const RECEIPT_PROJECTION_TIERS_V0 = [
  "owner",
  "subscriber",
  "public",
] as const;

export type ReceiptProjectionSchemaV0 = typeof RECEIPT_PROJECTION_SCHEMA;
export type ReceiptProjectionVersionV0 = typeof RECEIPT_PROJECTION_VERSION;
export type ReceiptProjectionTierV0 =
  (typeof RECEIPT_PROJECTION_TIERS_V0)[number];

export interface ProjectReceiptInputV0 {
  readonly tier: string;
  readonly receipt: unknown;
}

export interface ProjectReceiptProofInputV0 {
  readonly tier: string;
  readonly proof: unknown;
  readonly status?: ReceiptVerdictStatusV0 | null;
}

export type ReceiptProjectionSignerV0 =
  | {
      readonly kind: "null";
      readonly scheme: "none";
    }
  | {
      readonly kind: "signed";
      readonly scheme: string;
    };

export interface ReceiptProjectionFreshnessV0 {
  readonly as_of: string;
  readonly next_forecast_recheck: string;
  readonly transitive_freshness_policy_ref: string | null;
  readonly consumed_freshness_evaluated_count: number;
}

export interface ReceiptPublicCompositionPinProjectionV0 {
  readonly upstream_content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly acceptable_signer_set_count: number;
}

export interface ReceiptSubscriberCompositionPinProjectionV0 {
  readonly upstream_content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly acceptable_signer_set: readonly string[];
}

export interface ReceiptPublicCompositionProjectionV0 {
  readonly consumed_receipt_count: number;
  readonly consumed_receipts: readonly ReceiptPublicCompositionPinProjectionV0[];
  readonly cycle_checked: boolean;
}

export interface ReceiptSubscriberCompositionProjectionV0 {
  readonly consumed_receipt_count: number;
  readonly consumed_receipts: readonly ReceiptSubscriberCompositionPinProjectionV0[];
  readonly cycle_checked: boolean;
}

export interface ReceiptPublicTokenTruthProjectionV0 {
  readonly fresh: number;
  readonly reused: number;
  readonly role: string;
  readonly surprise_cause: string;
}

export interface ReceiptSubscriberTokenTruthProjectionV0
  extends ReceiptPublicTokenTruthProjectionV0 {
  readonly provider: string;
  readonly model: string;
}

export interface ReceiptOwnerVerdictProjectionV0 {
  readonly status: ReceiptVerdictStatusV0 | null;
  readonly confidence: {
    readonly value: number | null;
    readonly derivation_method: string | null;
    readonly calibration_grade: string | null;
    readonly label_source: string | null;
  } | null;
  readonly blocked: {
    readonly reason: string | null;
    readonly fix_target: string | null;
    readonly interrupt_cause: string | null;
  } | null;
}

export interface ReceiptProjectionBaseV0 {
  readonly schema: ReceiptProjectionSchemaV0;
  readonly v: ReceiptProjectionVersionV0;
  readonly tier: ReceiptProjectionTierV0;
  readonly receipt_id: ContentHashV0;
  readonly content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly status: ReceiptVerdictStatusV0 | null;
  readonly signer: ReceiptProjectionSignerV0;
  readonly freshness: ReceiptProjectionFreshnessV0;
}

export interface ReceiptOwnerProjectionV0 extends ReceiptProjectionBaseV0 {
  readonly tier: "owner";
  readonly responsibility_id: string;
  readonly role: string;
  readonly composition: ReceiptSubscriberCompositionProjectionV0;
  readonly token_truth: ReceiptSubscriberTokenTruthProjectionV0;
  readonly verdict: ReceiptOwnerVerdictProjectionV0;
  readonly proof: ReceiptProofInspectionV0;
}

export interface ReceiptSubscriberProjectionV0 extends ReceiptProjectionBaseV0 {
  readonly tier: "subscriber";
  readonly responsibility_id: string;
  readonly role: string;
  readonly composition: ReceiptSubscriberCompositionProjectionV0;
  readonly token_truth: ReceiptSubscriberTokenTruthProjectionV0;
}

export interface ReceiptPublicProjectionV0 extends ReceiptProjectionBaseV0 {
  readonly tier: "public";
  readonly composition: ReceiptPublicCompositionProjectionV0;
  readonly token_truth: ReceiptPublicTokenTruthProjectionV0;
}

export type ReceiptProjectionV0 =
  | ReceiptOwnerProjectionV0
  | ReceiptSubscriberProjectionV0
  | ReceiptPublicProjectionV0;

export type ReceiptProjectionResultV0 =
  | {
      readonly ok: true;
      readonly tier: ReceiptProjectionTierV0;
      readonly projection: ReceiptProjectionV0;
    }
  | {
      readonly ok: false;
      readonly tier: ReceiptProjectionTierV0 | null;
      readonly errors: readonly string[];
      readonly projection: null;
    };

interface NormalizedProofV0 {
  readonly inspection: ReceiptProofInspectionV0;
  readonly content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly responsibility_id: string;
  readonly role: string;
  readonly signer: ReceiptProjectionSignerV0;
  readonly freshness: ReceiptProjectionFreshnessV0;
  readonly composition: ReceiptSubscriberCompositionProjectionV0;
  readonly token_truth: ReceiptSubscriberTokenTruthProjectionV0;
}

const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const PROJECTION_TIERS = new Set<string>(RECEIPT_PROJECTION_TIERS_V0);
const RECEIPT_STATUSES = new Set<string>([
  "up",
  "drifting",
  "down",
  "blocked",
]);
const OPENROUTER_SECRET_PREFIX = ["sk", "or"].join("-");
const PRIVATE_OUTPUT_KEYS = new Set([
  "customer_payload",
  "evidence_payload",
  "judge_rationale",
  "memo_key",
  "provider_norm",
  "rationale",
  "raw_evidence",
  "raw_evidence_payload",
  "run_id",
  "tags",
]);
const SECRET_SHAPED_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\bBearer\s+[A-Za-z0-9._-]{8,}\b/i,
  new RegExp(
    `\\b${escapeRegex(OPENROUTER_SECRET_PREFIX)}-[A-Za-z0-9._-]{8,}\\b`,
  ),
  /\bapi[_-]?key[_:/= -]+[A-Za-z0-9._-]{8,}\b/i,
  /\b(?:secret|token|password|credential|authorization)[_:/= -]+[A-Za-z0-9._-]{8,}\b/i,
  /\bhttps?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|[^/\s?#]+(?:\.internal|\.local))(?::\d+)?(?:[/?#][^\s]*)?/i,
  /\bhttps?:\/\/[^\s?#]+[/?#][^\s]*(?:token|secret|signature|credential|password)=/i,
];

export function projectReceiptV0(
  input: ProjectReceiptInputV0,
): ReceiptProjectionResultV0 {
  const tier = normalizeTier(input.tier);
  if (tier === null) {
    return failProjection(null, ["unknown projection tier"]);
  }

  const proof = inspectReceiptProofV0(input.receipt);
  if (!proof.ok) {
    return failProjection(tier, ["receipt failed verification"]);
  }

  const normalized = normalizeProof(proof);
  if (!normalized.ok) {
    return failProjection(tier, normalized.errors);
  }

  const status = readReceiptStatus(input.receipt);
  if (status === null) {
    return failProjection(tier, ["receipt status is malformed"]);
  }

  return projectNormalizedProof({
    tier,
    proof: normalized.proof,
    status,
    verdict: readOwnerVerdict(input.receipt, status),
  });
}

export function projectReceiptProofV0(
  input: ProjectReceiptProofInputV0,
): ReceiptProjectionResultV0 {
  const tier = normalizeTier(input.tier);
  if (tier === null) {
    return failProjection(null, ["unknown projection tier"]);
  }

  const normalized = normalizeProof(input.proof);
  if (!normalized.ok) {
    return failProjection(tier, normalized.errors);
  }

  const status =
    input.status === undefined || input.status === null
      ? null
      : normalizeStatus(input.status);
  if (input.status !== undefined && input.status !== null && status === null) {
    return failProjection(tier, ["receipt status is malformed"]);
  }

  return projectNormalizedProof({
    tier,
    proof: normalized.proof,
    status,
    verdict: {
      status,
      confidence: null,
      blocked: null,
    },
  });
}

function projectNormalizedProof(input: {
  readonly tier: ReceiptProjectionTierV0;
  readonly proof: NormalizedProofV0;
  readonly status: ReceiptVerdictStatusV0 | null;
  readonly verdict: ReceiptOwnerVerdictProjectionV0;
}): ReceiptProjectionResultV0 {
  const base = {
    schema: RECEIPT_PROJECTION_SCHEMA,
    v: RECEIPT_PROJECTION_VERSION,
    tier: input.tier,
    receipt_id: input.proof.content_hash,
    content_hash: input.proof.content_hash,
    contract_revision: input.proof.contract_revision,
    status: input.status,
    signer: input.proof.signer,
    freshness: input.proof.freshness,
  } satisfies ReceiptProjectionBaseV0;

  const projection = buildProjection(input.tier, base, input.proof, input.verdict);
  if (
    (input.tier === "public" || input.tier === "subscriber") &&
    hasPublicProjectionLeak(projection)
  ) {
    return failProjection(input.tier, ["projection would expose secret-shaped data"]);
  }

  return {
    ok: true,
    tier: input.tier,
    projection,
  };
}

function buildProjection(
  tier: ReceiptProjectionTierV0,
  base: ReceiptProjectionBaseV0,
  proof: NormalizedProofV0,
  verdict: ReceiptOwnerVerdictProjectionV0,
): ReceiptProjectionV0 {
  switch (tier) {
    case "owner":
      return {
        ...base,
        tier,
        responsibility_id: proof.responsibility_id,
        role: proof.role,
        composition: proof.composition,
        token_truth: proof.token_truth,
        verdict,
        proof: proof.inspection,
      };
    case "subscriber":
      return {
        ...base,
        tier,
        responsibility_id: proof.responsibility_id,
        role: proof.role,
        composition: proof.composition,
        token_truth: proof.token_truth,
      };
    case "public":
      return {
        ...base,
        tier,
        composition: {
          consumed_receipt_count: proof.composition.consumed_receipt_count,
          consumed_receipts: proof.composition.consumed_receipts.map((pin) => ({
            upstream_content_hash: pin.upstream_content_hash,
            contract_revision: pin.contract_revision,
            acceptable_signer_set_count: pin.acceptable_signer_set.length,
          })),
          cycle_checked: proof.composition.cycle_checked,
        },
        token_truth: {
          fresh: proof.token_truth.fresh,
          reused: proof.token_truth.reused,
          role: proof.token_truth.role,
          surprise_cause: proof.token_truth.surprise_cause,
        },
      };
  }
}

function normalizeTier(tier: string): ReceiptProjectionTierV0 | null {
  return PROJECTION_TIERS.has(tier) ? (tier as ReceiptProjectionTierV0) : null;
}

function normalizeProof(
  value: unknown,
):
  | {
      readonly ok: true;
      readonly proof: NormalizedProofV0;
    }
  | {
      readonly ok: false;
      readonly errors: readonly string[];
    } {
  const errors: string[] = [];
  const proof = expectRecord(value, "receipt proof", errors);
  if (proof === undefined) {
    return { ok: false, errors };
  }

  if (proof["ok"] !== true) {
    errors.push("receipt proof must be verified");
  }
  const proofErrors = proof["errors"];
  if (
    !Array.isArray(proofErrors) ||
    proofErrors.length > 0 ||
    proofErrors.some((item) => typeof item !== "string")
  ) {
    errors.push("receipt proof errors must be empty");
  }
  if (proof["schema"] !== RECEIPT_SCHEMA) {
    errors.push("receipt proof schema is malformed");
  }
  if (proof["v"] !== RECEIPT_VERSION) {
    errors.push("receipt proof version is malformed");
  }

  const contentHash = readContentHash(proof, "content_hash", errors);
  const contractRevision = readContentHash(proof, "contract_revision", errors);
  const responsibilityId = readNonEmptyString(
    proof,
    "responsibility_id",
    errors,
  );
  const role = readNonEmptyString(proof, "role", errors);
  const signer = normalizeSigner(proof["signer"], errors);
  const freshness = normalizeFreshness(proof["freshness"], errors);
  const composition = normalizeComposition(proof["composition"], errors);
  const tokenTruth = normalizeTokenTruth(proof["token_truth"], errors);

  if (
    errors.length > 0 ||
    contentHash === null ||
    contractRevision === null ||
    responsibilityId === null ||
    role === null ||
    signer === null ||
    freshness === null ||
    composition === null ||
    tokenTruth === null
  ) {
    return { ok: false, errors };
  }

  const inspection: ReceiptProofInspectionV0 = {
    ok: true,
    errors: [],
    schema: RECEIPT_SCHEMA,
    v: RECEIPT_VERSION,
    content_hash: contentHash,
    contract_revision: contractRevision,
    responsibility_id: responsibilityId,
    role,
    signer,
    freshness: {
      as_of: freshness.as_of,
      next_forecast_recheck: freshness.next_forecast_recheck,
      transitive_freshness_policy_ref:
        freshness.transitive_freshness_policy_ref,
      consumed_freshness_evaluated_count:
        freshness.consumed_freshness_evaluated_count,
    },
    composition: {
      consumed_receipt_count: composition.consumed_receipt_count,
      consumed_receipts: composition.consumed_receipts,
      cycle_checked: composition.cycle_checked,
    },
    token_truth: {
      fresh: tokenTruth.fresh,
      reused: tokenTruth.reused,
      provider: tokenTruth.provider,
      model: tokenTruth.model,
      role: tokenTruth.role,
      surprise_cause: tokenTruth.surprise_cause,
    },
  };

  return {
    ok: true,
    proof: {
      inspection,
      content_hash: contentHash,
      contract_revision: contractRevision,
      responsibility_id: responsibilityId,
      role,
      signer,
      freshness,
      composition,
      token_truth: tokenTruth,
    },
  };
}

function normalizeSigner(
  value: unknown,
  errors: string[],
): ReceiptProjectionSignerV0 | null {
  const signer = expectRecord(value, "receipt proof signer", errors);
  if (signer === undefined) {
    return null;
  }

  const kind = readString(signer, "kind");
  const scheme = readNonEmptyString(signer, "scheme", errors);
  if (scheme === null) {
    return null;
  }
  if (kind === "null" && scheme === "none") {
    return { kind, scheme };
  }
  if (kind === "signed" && scheme !== "none") {
    return { kind, scheme };
  }

  errors.push("receipt proof signer is malformed");
  return null;
}

function normalizeFreshness(
  value: unknown,
  errors: string[],
): ReceiptProjectionFreshnessV0 | null {
  const freshness = expectRecord(value, "receipt proof freshness", errors);
  if (freshness === undefined) {
    return null;
  }

  const asOf = readIsoInstant(freshness, "as_of", errors);
  const nextForecastRecheck = readIsoInstant(
    freshness,
    "next_forecast_recheck",
    errors,
  );
  const transitiveRef = readNullableString(
    freshness,
    "transitive_freshness_policy_ref",
    errors,
  );
  const consumedCount = readNonNegativeInteger(
    freshness,
    "consumed_freshness_evaluated_count",
    errors,
  );

  if (asOf === null || nextForecastRecheck === null || consumedCount === null) {
    return null;
  }

  return {
    as_of: asOf,
    next_forecast_recheck: nextForecastRecheck,
    transitive_freshness_policy_ref: transitiveRef,
    consumed_freshness_evaluated_count: consumedCount,
  };
}

function normalizeComposition(
  value: unknown,
  errors: string[],
): ReceiptSubscriberCompositionProjectionV0 | null {
  const composition = expectRecord(value, "receipt proof composition", errors);
  if (composition === undefined) {
    return null;
  }

  const consumedCount = readNonNegativeInteger(
    composition,
    "consumed_receipt_count",
    errors,
  );
  const cycleChecked = readBoolean(composition, "cycle_checked", errors);
  const consumedReceiptsValue = composition["consumed_receipts"];
  if (!Array.isArray(consumedReceiptsValue)) {
    errors.push("receipt proof composition consumed receipts are malformed");
    return null;
  }

  const consumedReceipts: ReceiptSubscriberCompositionPinProjectionV0[] = [];
  for (const item of consumedReceiptsValue) {
    const pin = expectRecord(item, "receipt proof composition pin", errors);
    if (pin === undefined) {
      continue;
    }

    const upstreamContentHash = readContentHash(
      pin,
      "upstream_content_hash",
      errors,
    );
    const contractRevision = readContentHash(pin, "contract_revision", errors);
    const acceptableSignerSet = readStringArray(
      pin,
      "acceptable_signer_set",
      errors,
    );
    if (
      upstreamContentHash !== null &&
      contractRevision !== null &&
      acceptableSignerSet !== null
    ) {
      consumedReceipts.push({
        upstream_content_hash: upstreamContentHash,
        contract_revision: contractRevision,
        acceptable_signer_set: acceptableSignerSet,
      });
    }
  }

  if (consumedCount === null || cycleChecked === null) {
    return null;
  }
  if (consumedReceipts.length !== consumedCount) {
    errors.push("receipt proof composition count is malformed");
    return null;
  }

  return {
    consumed_receipt_count: consumedCount,
    consumed_receipts: consumedReceipts,
    cycle_checked: cycleChecked,
  };
}

function normalizeTokenTruth(
  value: unknown,
  errors: string[],
): ReceiptSubscriberTokenTruthProjectionV0 | null {
  const tokenTruth = expectRecord(value, "receipt proof token truth", errors);
  if (tokenTruth === undefined) {
    return null;
  }

  const fresh = readNonNegativeInteger(tokenTruth, "fresh", errors);
  const reused = readNonNegativeInteger(tokenTruth, "reused", errors);
  const provider = readNonEmptyString(tokenTruth, "provider", errors);
  const model = readNonEmptyString(tokenTruth, "model", errors);
  const role = readNonEmptyString(tokenTruth, "role", errors);
  const surpriseCause = readNonEmptyString(
    tokenTruth,
    "surprise_cause",
    errors,
  );

  if (
    fresh === null ||
    reused === null ||
    provider === null ||
    model === null ||
    role === null ||
    surpriseCause === null
  ) {
    return null;
  }

  return {
    fresh,
    reused,
    provider,
    model,
    role,
    surprise_cause: surpriseCause,
  };
}

function readReceiptStatus(value: unknown): ReceiptVerdictStatusV0 | null {
  const receipt = isRecord(value) ? value : undefined;
  const verdict = readRecord(receipt, "verdict");
  return normalizeStatus(readString(verdict, "status"));
}

function normalizeStatus(value: unknown): ReceiptVerdictStatusV0 | null {
  return typeof value === "string" && RECEIPT_STATUSES.has(value)
    ? (value as ReceiptVerdictStatusV0)
    : null;
}

function readOwnerVerdict(
  value: unknown,
  status: ReceiptVerdictStatusV0 | null,
): ReceiptOwnerVerdictProjectionV0 {
  const receipt = isRecord(value) ? value : undefined;
  const verdict = readRecord(receipt, "verdict");
  const confidence = readRecord(verdict, "confidence");
  const blocked = readRecord(verdict, "blocked");

  return {
    status,
    confidence:
      confidence === undefined
        ? null
        : {
            value: readNumber(confidence, "value"),
            derivation_method: readString(confidence, "derivation_method"),
            calibration_grade: readString(confidence, "calibration_grade"),
            label_source: readString(confidence, "label_source"),
          },
    blocked:
      blocked === undefined
        ? null
        : {
            reason: readString(blocked, "reason"),
            fix_target: readString(blocked, "fix_target"),
            interrupt_cause: readString(blocked, "interrupt_cause"),
          },
  };
}

function hasPublicProjectionLeak(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasPublicProjectionLeak);
  }
  if (isRecord(value)) {
    return Object.entries(value).some(
      ([key, item]) => isForbiddenOutputKey(key) || hasPublicProjectionLeak(item),
    );
  }
  return typeof value === "string" && hasSecretShapedText(value);
}

function isForbiddenOutputKey(key: string): boolean {
  return PRIVATE_OUTPUT_KEYS.has(key.toLowerCase());
}

function hasSecretShapedText(value: string): boolean {
  return SECRET_SHAPED_PATTERNS.some((pattern) => pattern.test(value));
}

function failProjection(
  tier: ReceiptProjectionTierV0 | null,
  errors: readonly string[],
): ReceiptProjectionResultV0 {
  return {
    ok: false,
    tier,
    errors,
    projection: null,
  };
}

function expectRecord(
  value: unknown,
  label: string,
  errors: string[],
): Readonly<Record<string, unknown>> | undefined {
  if (!isRecord(value)) {
    errors.push(`${label} is malformed`);
    return undefined;
  }

  return value;
}

function readRecord(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): Readonly<Record<string, unknown>> | undefined {
  const value = record?.[key];
  return isRecord(value) ? value : undefined;
}

function readString(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function readNonEmptyString(
  record: Readonly<Record<string, unknown>>,
  key: string,
  errors: string[],
): string | null {
  const value = readString(record, key);
  if (value === null || value.length === 0) {
    errors.push(`${key} is malformed`);
    return null;
  }

  return value;
}

function readNullableString(
  record: Readonly<Record<string, unknown>>,
  key: string,
  errors: string[],
): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  errors.push(`${key} is malformed`);
  return null;
}

function readNumber(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNonNegativeInteger(
  record: Readonly<Record<string, unknown>>,
  key: string,
  errors: string[],
): number | null {
  const value = readNumber(record, key);
  if (value === null || !Number.isInteger(value) || value < 0) {
    errors.push(`${key} is malformed`);
    return null;
  }

  return value;
}

function readBoolean(
  record: Readonly<Record<string, unknown>>,
  key: string,
  errors: string[],
): boolean | null {
  const value = record[key];
  if (typeof value !== "boolean") {
    errors.push(`${key} is malformed`);
    return null;
  }

  return value;
}

function readIsoInstant(
  record: Readonly<Record<string, unknown>>,
  key: string,
  errors: string[],
): string | null {
  const value = readNonEmptyString(record, key, errors);
  if (value === null) {
    return null;
  }
  if (!ISO_INSTANT_PATTERN.test(value)) {
    errors.push(`${key} is malformed`);
    return null;
  }

  return value;
}

function readContentHash(
  record: Readonly<Record<string, unknown>>,
  key: string,
  errors: string[],
): ContentHashV0 | null {
  const value = readNonEmptyString(record, key, errors);
  if (value === null) {
    return null;
  }
  if (!CONTENT_HASH_PATTERN.test(value)) {
    errors.push(`${key} is malformed`);
    return null;
  }

  return value as ContentHashV0;
}

function readStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
  errors: string[],
): readonly string[] | null {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${key} is malformed`);
    return null;
  }

  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
