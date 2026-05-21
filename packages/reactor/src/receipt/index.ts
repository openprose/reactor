import { createHash } from "node:crypto";

export const RECEIPT_SCHEMA = "openprose.receipt" as const;
export const RECEIPT_VERSION = 0 as const;
export const RECEIPT_HASH_ALGORITHM = "sha256" as const;

export type ContentHashV0 = `sha256:${string}`;
export type ReceiptSchemaV0 = typeof RECEIPT_SCHEMA;
export type ReceiptVersionV0 = typeof RECEIPT_VERSION;
export type ReceiptHashAlgorithmV0 = typeof RECEIPT_HASH_ALGORITHM;

export type ReceiptEventCauseV0 =
  | "real-input"
  | "forecast-recheck"
  | "escalation";
export type ReceiptRecheckKindV0 = "evidence-age" | "plan-age";
export type ReceiptRoleV0 = "judge" | "fulfill" | "summarize" | "policy-compile";
export type ReceiptVerdictStatusV0 = "up" | "drifting" | "down" | "blocked";
export type ReceiptCalibrationGradeV0 = "authored" | "accrued" | "none";
export type ReceiptInterruptCauseV0 =
  | "needs-judgment"
  | "needs-input"
  | "contract-declared";
export type ReceiptStalenessOutcomeV0 =
  | "fresh"
  | "stale-refetched"
  | "stale-blocked";

export interface ReceiptCoreV0 {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly event_cause: ReceiptEventCauseV0;
  readonly recheck_kind?: ReceiptRecheckKindV0;
  readonly memo_key: string;
  readonly evidence_input_ids: readonly ContentHashV0[];
  readonly as_of: string;
  readonly role: ReceiptRoleV0;
}

export interface NullReceiptSignatureV0 {
  readonly scheme: "none";
  readonly null_reason: string;
}

export interface AdapterReceiptSignatureV0 {
  readonly scheme: string;
  readonly signer_id: string;
  readonly signature: string;
  readonly signed_payload_hash: ContentHashV0;
}

export type ReceiptSignatureV0 =
  | NullReceiptSignatureV0
  | AdapterReceiptSignatureV0;

export const NULL_SIGNER_ADAPTER_NOT_CONFIGURED_REASON_V0 =
  "no-signer-adapter-configured" as const;

export function createNullSignerReceiptSignatureV0(): NullReceiptSignatureV0 {
  return {
    scheme: "none",
    null_reason: NULL_SIGNER_ADAPTER_NOT_CONFIGURED_REASON_V0,
  };
}

export interface ReceiptConfidenceV0 {
  readonly value: number;
  readonly derivation_method: string;
  readonly calibration_grade: ReceiptCalibrationGradeV0;
  readonly label_source: string;
}

export interface ReceiptBlockedV0 {
  readonly reason: string;
  readonly fix_target: string;
  readonly interrupt_cause: ReceiptInterruptCauseV0;
}

export interface ReceiptVerdictV0 {
  readonly status: ReceiptVerdictStatusV0;
  readonly confidence: ReceiptConfidenceV0;
  readonly blocked?: ReceiptBlockedV0;
}

export interface ConsumedFreshnessEvaluationV0 {
  readonly receipt_hash: ContentHashV0;
  readonly next_forecast_recheck: string;
  readonly staleness_outcome: ReceiptStalenessOutcomeV0;
}

export interface ReceiptFreshnessV0 {
  readonly as_of: string;
  readonly next_forecast_recheck: string;
  readonly transitive_freshness_policy_ref?: string;
  readonly consumed_freshness_evaluated?: readonly ConsumedFreshnessEvaluationV0[];
}

export interface ConsumedReceiptPinV0 {
  readonly upstream_content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly acceptable_signer_set: readonly string[];
}

export interface ReceiptCompositionV0 {
  readonly consumed_receipts: readonly ConsumedReceiptPinV0[];
  readonly cycle_checked: boolean;
}

export interface ReceiptTokensV0 {
  readonly fresh: number;
  readonly reused: number;
}

export interface ReceiptProviderNormV0 {
  readonly schema: string;
  readonly [key: string]: unknown;
}

export interface ReceiptCostV0 {
  readonly provider: string;
  readonly model: string;
  readonly role: ReceiptRoleV0;
  readonly tags: readonly string[];
  readonly responsibility_id: string;
  readonly run_id: string;
  readonly as_of: string;
  readonly tokens: ReceiptTokensV0;
  readonly surprise_cause: ReceiptEventCauseV0;
  readonly provider_norm?: ReceiptProviderNormV0;
}

export interface ReceiptV0 {
  readonly schema: ReceiptSchemaV0;
  readonly v: ReceiptVersionV0;
  readonly hash_algorithm: ReceiptHashAlgorithmV0;
  readonly content_hash: ContentHashV0;
  readonly core: ReceiptCoreV0;
  readonly sig: ReceiptSignatureV0;
  readonly verdict: ReceiptVerdictV0;
  readonly freshness: ReceiptFreshnessV0;
  readonly composition: ReceiptCompositionV0;
  readonly cost: ReceiptCostV0;
}

export type ReceiptHashPayloadV0 = Omit<ReceiptV0, "content_hash">;

export interface ReceiptV0Input {
  readonly core: ReceiptCoreV0;
  readonly sig: ReceiptSignatureV0;
  readonly verdict: ReceiptVerdictV0;
  readonly freshness: ReceiptFreshnessV0;
  readonly composition: ReceiptCompositionV0;
  readonly cost: ReceiptCostV0;
}

export interface ReceiptTokenTruthV0 {
  readonly responsibility_id: string;
  readonly run_id: string;
  readonly provider: string;
  readonly model: string;
  readonly role: ReceiptRoleV0;
  readonly tags: readonly string[];
  readonly as_of: string;
  readonly fresh: number;
  readonly reused: number;
  readonly surprise_cause: ReceiptEventCauseV0;
}

export type ReceiptVerificationResultV0 =
  | {
      readonly ok: true;
      readonly content_hash: ContentHashV0;
    }
  | {
      readonly ok: false;
      readonly errors: readonly string[];
      readonly expected_content_hash?: ContentHashV0;
      readonly actual_content_hash?: string;
    };

export type ReceiptSignerPostureInspectionV0 =
  | {
      readonly kind: "null";
      readonly scheme: "none";
    }
  | {
      readonly kind: "signed";
      readonly scheme: string;
    };

export interface ReceiptFreshnessInspectionV0 {
  readonly as_of: string | null;
  readonly next_forecast_recheck: string | null;
  readonly transitive_freshness_policy_ref: string | null;
  readonly consumed_freshness_evaluated_count: number;
}

export interface ReceiptCompositionPinInspectionV0 {
  readonly upstream_content_hash: ContentHashV0 | null;
  readonly contract_revision: ContentHashV0 | null;
  readonly acceptable_signer_set: readonly string[];
}

export interface ReceiptCompositionInspectionV0 {
  readonly consumed_receipt_count: number;
  readonly consumed_receipts: readonly ReceiptCompositionPinInspectionV0[];
  readonly cycle_checked: boolean | null;
}

export interface ReceiptTokenTruthInspectionV0 {
  readonly fresh: number | null;
  readonly reused: number | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly role: string | null;
  readonly surprise_cause: string | null;
}

export interface ReceiptProofInspectionV0 {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly schema: string | null;
  readonly v: number | null;
  readonly content_hash: ContentHashV0 | null;
  readonly contract_revision: ContentHashV0 | null;
  readonly responsibility_id: string | null;
  readonly role: string | null;
  readonly signer: ReceiptSignerPostureInspectionV0 | null;
  readonly freshness: ReceiptFreshnessInspectionV0;
  readonly composition: ReceiptCompositionInspectionV0;
  readonly token_truth: ReceiptTokenTruthInspectionV0;
}

const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const EVENT_CAUSES = new Set<ReceiptEventCauseV0>([
  "real-input",
  "forecast-recheck",
  "escalation",
]);
const RECHECK_KINDS = new Set<ReceiptRecheckKindV0>([
  "evidence-age",
  "plan-age",
]);
const ROLES = new Set<ReceiptRoleV0>([
  "judge",
  "fulfill",
  "summarize",
  "policy-compile",
]);
const VERDICT_STATUSES = new Set<ReceiptVerdictStatusV0>([
  "up",
  "drifting",
  "down",
  "blocked",
]);
const CALIBRATION_GRADES = new Set<ReceiptCalibrationGradeV0>([
  "authored",
  "accrued",
  "none",
]);
const INTERRUPT_CAUSES = new Set<ReceiptInterruptCauseV0>([
  "needs-judgment",
  "needs-input",
  "contract-declared",
]);
const STALENESS_OUTCOMES = new Set<ReceiptStalenessOutcomeV0>([
  "fresh",
  "stale-refetched",
  "stale-blocked",
]);

export function createReceiptV0(input: ReceiptV0Input): ReceiptV0 {
  const payload: ReceiptHashPayloadV0 = {
    schema: RECEIPT_SCHEMA,
    v: RECEIPT_VERSION,
    hash_algorithm: RECEIPT_HASH_ALGORITHM,
    core: input.core,
    sig: input.sig,
    verdict: input.verdict,
    freshness: input.freshness,
    composition: input.composition,
    cost: input.cost,
  };
  const receipt: ReceiptV0 = {
    ...payload,
    content_hash: computeReceiptContentHashV0(payload),
  };
  const verification = verifyReceiptV0(receipt);

  if (!verification.ok) {
    throw new Error(`Invalid receipt v0 input: ${verification.errors.join("; ")}`);
  }

  return receipt;
}

export function verifyReceiptV0(value: unknown): ReceiptVerificationResultV0 {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["receipt must be an object"] };
  }

  validateReceiptShape(value, errors);

  let expectedContentHash: ContentHashV0 | undefined;
  try {
    expectedContentHash = computeReceiptContentHashV0(
      value as ReceiptV0 | ReceiptHashPayloadV0,
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "content hash failed");
  }

  const actualContentHash = value["content_hash"];
  if (typeof actualContentHash !== "string") {
    errors.push("content_hash must be a sha256 content address");
  } else if (!CONTENT_HASH_PATTERN.test(actualContentHash)) {
    errors.push("content_hash must use sha256:<64 lowercase hex>");
  } else if (
    expectedContentHash !== undefined &&
    actualContentHash !== expectedContentHash
  ) {
    errors.push("content_hash does not match canonical receipt payload");
  }

  if (errors.length > 0) {
    const failure: {
      readonly ok: false;
      readonly errors: readonly string[];
      readonly expected_content_hash?: ContentHashV0;
      readonly actual_content_hash?: string;
    } = { ok: false, errors };

    return {
      ...failure,
      ...(expectedContentHash === undefined
        ? {}
        : { expected_content_hash: expectedContentHash }),
      ...(typeof actualContentHash === "string"
        ? { actual_content_hash: actualContentHash }
        : {}),
    };
  }

  return {
    ok: true,
    content_hash: actualContentHash as ContentHashV0,
  };
}

export function assertReceiptV0(value: unknown): asserts value is ReceiptV0 {
  const verification = verifyReceiptV0(value);

  if (!verification.ok) {
    throw new Error(`Invalid receipt v0: ${verification.errors.join("; ")}`);
  }
}

export function inspectReceiptProofV0(value: unknown): ReceiptProofInspectionV0 {
  const verification = verifyReceiptV0(value);
  const receipt = isRecord(value) ? value : undefined;
  const core = readRecord(receipt, "core");

  return {
    ok: verification.ok,
    errors: verification.ok ? [] : verification.errors,
    schema: readString(receipt, "schema"),
    v: readNumber(receipt, "v"),
    content_hash: verification.ok ? verification.content_hash : null,
    contract_revision: readContentHash(core, "contract_revision"),
    responsibility_id: readString(core, "responsibility_id"),
    role: readString(core, "role"),
    signer: inspectSigner(readRecord(receipt, "sig")),
    freshness: inspectFreshness(readRecord(receipt, "freshness")),
    composition: inspectComposition(readRecord(receipt, "composition")),
    token_truth: inspectTokenTruth(readRecord(receipt, "cost")),
  };
}

export function readTokenTruthV0(receipt: ReceiptV0): ReceiptTokenTruthV0 {
  return {
    responsibility_id: receipt.cost.responsibility_id,
    run_id: receipt.cost.run_id,
    provider: receipt.cost.provider,
    model: receipt.cost.model,
    role: receipt.cost.role,
    tags: receipt.cost.tags,
    as_of: receipt.cost.as_of,
    fresh: receipt.cost.tokens.fresh,
    reused: receipt.cost.tokens.reused,
    surprise_cause: receipt.cost.surprise_cause,
  };
}

export function serializeReceiptV0(receipt: ReceiptV0): string {
  assertReceiptV0(receipt);
  return canonicalizeForReceiptV0(receipt);
}

export function computeReceiptContentHashV0(
  value: ReceiptV0 | ReceiptHashPayloadV0,
): ContentHashV0 {
  const payload = withoutContentHash(value);
  return hashCanonicalReceiptV0(canonicalizeForReceiptV0(payload));
}

export function canonicalizeForReceiptV0(value: unknown): string {
  return renderCanonical(value);
}

export function hashCanonicalReceiptV0(canonical: string): ContentHashV0 {
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function inspectSigner(
  sig: Readonly<Record<string, unknown>> | undefined,
): ReceiptSignerPostureInspectionV0 | null {
  const scheme = readString(sig, "scheme");
  if (scheme === null || scheme.length === 0) {
    return null;
  }
  if (scheme === "none") {
    return { kind: "null", scheme };
  }
  return { kind: "signed", scheme };
}

function inspectFreshness(
  freshness: Readonly<Record<string, unknown>> | undefined,
): ReceiptFreshnessInspectionV0 {
  const consumed = freshness?.["consumed_freshness_evaluated"];

  return {
    as_of: readString(freshness, "as_of"),
    next_forecast_recheck: readString(freshness, "next_forecast_recheck"),
    transitive_freshness_policy_ref: readString(
      freshness,
      "transitive_freshness_policy_ref",
    ),
    consumed_freshness_evaluated_count: Array.isArray(consumed)
      ? consumed.length
      : 0,
  };
}

function inspectComposition(
  composition: Readonly<Record<string, unknown>> | undefined,
): ReceiptCompositionInspectionV0 {
  const consumed = composition?.["consumed_receipts"];
  const consumedReceipts = Array.isArray(consumed) ? consumed : [];

  return {
    consumed_receipt_count: consumedReceipts.length,
    consumed_receipts: consumedReceipts
      .filter(isRecord)
      .map((pin) => ({
        upstream_content_hash: readContentHash(pin, "upstream_content_hash"),
        contract_revision: readContentHash(pin, "contract_revision"),
        acceptable_signer_set: readStringArray(pin, "acceptable_signer_set"),
      })),
    cycle_checked: readBoolean(composition, "cycle_checked"),
  };
}

function inspectTokenTruth(
  cost: Readonly<Record<string, unknown>> | undefined,
): ReceiptTokenTruthInspectionV0 {
  const tokens = readRecord(cost, "tokens");

  return {
    fresh: readNumber(tokens, "fresh"),
    reused: readNumber(tokens, "reused"),
    provider: readString(cost, "provider"),
    model: readString(cost, "model"),
    role: readString(cost, "role"),
    surprise_cause: readString(cost, "surprise_cause"),
  };
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

function readNumber(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): boolean | null {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

function readStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function readContentHash(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): ContentHashV0 | null {
  const value = readString(record, key);
  return value !== null && CONTENT_HASH_PATTERN.test(value)
    ? (value as ContentHashV0)
    : null;
}

function withoutContentHash(
  value: ReceiptV0 | ReceiptHashPayloadV0,
): ReceiptHashPayloadV0 {
  const { content_hash: _contentHash, ...payload } = value as ReceiptV0;
  return payload;
}

function validateReceiptShape(
  receipt: Readonly<Record<string, unknown>>,
  errors: string[],
): void {
  validateExactKeys(
    receipt,
    "receipt",
    [
      "schema",
      "v",
      "hash_algorithm",
      "content_hash",
      "core",
      "sig",
      "verdict",
      "freshness",
      "composition",
      "cost",
    ],
    errors,
  );
  expectLiteral(receipt, "schema", RECEIPT_SCHEMA, "receipt", errors);
  expectLiteral(receipt, "v", RECEIPT_VERSION, "receipt", errors);
  expectLiteral(
    receipt,
    "hash_algorithm",
    RECEIPT_HASH_ALGORITHM,
    "receipt",
    errors,
  );

  const core = expectRecord(receipt, "core", "receipt", errors);
  if (core !== undefined) {
    validateCore(core, errors);
  }

  const sig = expectRecord(receipt, "sig", "receipt", errors);
  if (sig !== undefined) {
    validateSignature(sig, errors);
  }

  const verdict = expectRecord(receipt, "verdict", "receipt", errors);
  if (verdict !== undefined) {
    validateVerdict(verdict, errors);
  }

  const freshness = expectRecord(receipt, "freshness", "receipt", errors);
  if (freshness !== undefined) {
    validateFreshness(freshness, errors);
  }

  const composition = expectRecord(receipt, "composition", "receipt", errors);
  if (composition !== undefined) {
    validateComposition(composition, errors);
  }

  const cost = expectRecord(receipt, "cost", "receipt", errors);
  if (cost !== undefined) {
    validateCost(cost, errors);
  }

  if (core !== undefined && freshness !== undefined) {
    expectSameString(
      "freshness.as_of",
      freshness["as_of"],
      "core.as_of",
      core["as_of"],
      errors,
    );
  }

  if (freshness !== undefined && composition !== undefined) {
    validateComposedFreshness(composition, freshness, errors);
  }

  if (core !== undefined && cost !== undefined) {
    expectSameString(
      "cost.responsibility_id",
      cost["responsibility_id"],
      "core.responsibility_id",
      core["responsibility_id"],
      errors,
    );
    expectSameString("cost.role", cost["role"], "core.role", core["role"], errors);
    expectSameString("cost.as_of", cost["as_of"], "core.as_of", core["as_of"], errors);
    expectSameString(
      "cost.surprise_cause",
      cost["surprise_cause"],
      "core.event_cause",
      core["event_cause"],
      errors,
    );
  }
}

function validateCore(
  core: Readonly<Record<string, unknown>>,
  errors: string[],
): void {
  validateExactKeys(
    core,
    "core",
    [
      "responsibility_id",
      "contract_revision",
      "event_cause",
      "recheck_kind",
      "memo_key",
      "evidence_input_ids",
      "as_of",
      "role",
    ],
    errors,
  );
  expectNonEmptyString(core, "responsibility_id", "core", errors);
  expectContentHash(core, "contract_revision", "core", errors);
  expectEnum(core, "event_cause", "core", EVENT_CAUSES, errors);
  expectNonEmptyString(core, "memo_key", "core", errors);
  expectContentHashArray(core, "evidence_input_ids", "core", errors);
  expectIsoInstant(core, "as_of", "core", errors);
  expectEnum(core, "role", "core", ROLES, errors);

  const eventCause = core["event_cause"];
  const recheckKind = core["recheck_kind"];
  if (eventCause === "forecast-recheck") {
    expectEnum(core, "recheck_kind", "core", RECHECK_KINDS, errors);
  } else if (recheckKind !== undefined) {
    errors.push("core.recheck_kind is only valid for forecast-recheck");
  }
}

function validateSignature(
  sig: Readonly<Record<string, unknown>>,
  errors: string[],
): void {
  const scheme = sig["scheme"];
  if (scheme === "none") {
    validateExactKeys(sig, "sig", ["scheme", "null_reason"], errors);
    expectNonEmptyString(sig, "null_reason", "sig", errors);
    return;
  }

  validateExactKeys(
    sig,
    "sig",
    ["scheme", "signer_id", "signature", "signed_payload_hash"],
    errors,
  );
  expectNonEmptyString(sig, "scheme", "sig", errors);
  expectNonEmptyString(sig, "signer_id", "sig", errors);
  expectNonEmptyString(sig, "signature", "sig", errors);
  expectContentHash(sig, "signed_payload_hash", "sig", errors);
  errors.push(
    "non-null signatures are not supported in receipt v0.1; null signer is the only honest v0.1 state",
  );
}

function validateVerdict(
  verdict: Readonly<Record<string, unknown>>,
  errors: string[],
): void {
  validateExactKeys(verdict, "verdict", ["status", "confidence", "blocked"], errors);
  expectEnum(verdict, "status", "verdict", VERDICT_STATUSES, errors);

  const confidence = expectRecord(verdict, "confidence", "verdict", errors);
  if (confidence !== undefined) {
    validateExactKeys(
      confidence,
      "verdict.confidence",
      ["value", "derivation_method", "calibration_grade", "label_source"],
      errors,
    );
    expectUnitInterval(confidence, "value", "verdict.confidence", errors);
    expectNonEmptyString(
      confidence,
      "derivation_method",
      "verdict.confidence",
      errors,
    );
    expectEnum(
      confidence,
      "calibration_grade",
      "verdict.confidence",
      CALIBRATION_GRADES,
      errors,
    );
    expectNonEmptyString(confidence, "label_source", "verdict.confidence", errors);
  }

  const blocked = verdict["blocked"];
  if (verdict["status"] === "blocked") {
    const blockedRecord = expectRecord(verdict, "blocked", "verdict", errors);
    if (blockedRecord !== undefined) {
      validateBlocked(blockedRecord, errors);
    }
  } else if (blocked !== undefined) {
    errors.push("verdict.blocked is only valid when status is blocked");
  }
}

function validateBlocked(
  blocked: Readonly<Record<string, unknown>>,
  errors: string[],
): void {
  validateExactKeys(
    blocked,
    "verdict.blocked",
    ["reason", "fix_target", "interrupt_cause"],
    errors,
  );
  expectNonEmptyString(blocked, "reason", "verdict.blocked", errors);
  expectNonEmptyString(blocked, "fix_target", "verdict.blocked", errors);
  expectEnum(
    blocked,
    "interrupt_cause",
    "verdict.blocked",
    INTERRUPT_CAUSES,
    errors,
  );
}

function validateFreshness(
  freshness: Readonly<Record<string, unknown>>,
  errors: string[],
): void {
  validateExactKeys(
    freshness,
    "freshness",
    [
      "as_of",
      "next_forecast_recheck",
      "transitive_freshness_policy_ref",
      "consumed_freshness_evaluated",
    ],
    errors,
  );
  expectIsoInstant(freshness, "as_of", "freshness", errors);
  expectIsoInstant(freshness, "next_forecast_recheck", "freshness", errors);

  if (freshness["transitive_freshness_policy_ref"] !== undefined) {
    expectNonEmptyString(
      freshness,
      "transitive_freshness_policy_ref",
      "freshness",
      errors,
    );
  }

  const consumed = freshness["consumed_freshness_evaluated"];
  if (consumed !== undefined) {
    if (!Array.isArray(consumed)) {
      errors.push("freshness.consumed_freshness_evaluated must be an array");
    } else {
      for (const [index, item] of consumed.entries()) {
        const path = `freshness.consumed_freshness_evaluated[${index}]`;
        if (!isRecord(item)) {
          errors.push(`${path} must be an object`);
          continue;
        }
        validateExactKeys(
          item,
          path,
          ["receipt_hash", "next_forecast_recheck", "staleness_outcome"],
          errors,
        );
        expectContentHash(item, "receipt_hash", path, errors);
        expectIsoInstant(item, "next_forecast_recheck", path, errors);
        expectEnum(item, "staleness_outcome", path, STALENESS_OUTCOMES, errors);
      }
    }
  }
}

function validateComposition(
  composition: Readonly<Record<string, unknown>>,
  errors: string[],
): void {
  validateExactKeys(
    composition,
    "composition",
    ["consumed_receipts", "cycle_checked"],
    errors,
  );
  expectBoolean(composition, "cycle_checked", "composition", errors);

  const consumed = composition["consumed_receipts"];
  if (!Array.isArray(consumed)) {
    errors.push("composition.consumed_receipts must be an array");
    return;
  }

  const seenHashes = new Set<string>();
  for (const [index, item] of consumed.entries()) {
    const path = `composition.consumed_receipts[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${path} must be an object`);
      continue;
    }
    validateExactKeys(
      item,
      path,
      ["upstream_content_hash", "contract_revision", "acceptable_signer_set"],
      errors,
    );
    expectContentHash(item, "upstream_content_hash", path, errors);
    expectContentHash(item, "contract_revision", path, errors);
    expectStringArray(item, "acceptable_signer_set", path, errors);
    if (
      Array.isArray(item["acceptable_signer_set"]) &&
      item["acceptable_signer_set"].length === 0
    ) {
      errors.push(`${path}.acceptable_signer_set must not be empty`);
    }

    const hash = item["upstream_content_hash"];
    if (typeof hash === "string") {
      if (seenHashes.has(hash)) {
        errors.push(`${path}.upstream_content_hash duplicates a consumed receipt`);
      }
      seenHashes.add(hash);
    }
  }
}

function validateComposedFreshness(
  composition: Readonly<Record<string, unknown>>,
  freshness: Readonly<Record<string, unknown>>,
  errors: string[],
): void {
  const consumed = composition["consumed_receipts"];
  if (!Array.isArray(consumed) || consumed.length === 0) {
    return;
  }

  if (typeof freshness["transitive_freshness_policy_ref"] !== "string") {
    errors.push(
      "freshness.transitive_freshness_policy_ref is required when receipts are consumed",
    );
  }

  const evaluated = freshness["consumed_freshness_evaluated"];
  if (!Array.isArray(evaluated)) {
    errors.push(
      "freshness.consumed_freshness_evaluated is required when receipts are consumed",
    );
    return;
  }
  if (evaluated.length !== consumed.length) {
    errors.push(
      "freshness.consumed_freshness_evaluated must cover every consumed receipt",
    );
  }

  const consumedHashes = new Set<string>();
  for (const item of consumed) {
    if (isRecord(item) && typeof item["upstream_content_hash"] === "string") {
      consumedHashes.add(item["upstream_content_hash"]);
    }
  }

  for (const [index, item] of evaluated.entries()) {
    if (!isRecord(item)) {
      continue;
    }
    const receiptHash = item["receipt_hash"];
    if (typeof receiptHash === "string" && !consumedHashes.has(receiptHash)) {
      errors.push(
        `freshness.consumed_freshness_evaluated[${index}].receipt_hash must match a consumed receipt`,
      );
    }
  }
}

function validateCost(
  cost: Readonly<Record<string, unknown>>,
  errors: string[],
): void {
  validateExactKeys(
    cost,
    "cost",
    [
      "provider",
      "model",
      "role",
      "tags",
      "responsibility_id",
      "run_id",
      "as_of",
      "tokens",
      "surprise_cause",
      "provider_norm",
    ],
    errors,
  );
  expectNonEmptyString(cost, "provider", "cost", errors);
  expectNonEmptyString(cost, "model", "cost", errors);
  expectEnum(cost, "role", "cost", ROLES, errors);
  expectStringArray(cost, "tags", "cost", errors);
  expectNonEmptyString(cost, "responsibility_id", "cost", errors);
  expectNonEmptyString(cost, "run_id", "cost", errors);
  expectIsoInstant(cost, "as_of", "cost", errors);
  expectEnum(cost, "surprise_cause", "cost", EVENT_CAUSES, errors);

  const tokens = expectRecord(cost, "tokens", "cost", errors);
  if (tokens !== undefined) {
    validateExactKeys(tokens, "cost.tokens", ["fresh", "reused"], errors);
    expectNonNegativeInteger(tokens, "fresh", "cost.tokens", errors);
    expectNonNegativeInteger(tokens, "reused", "cost.tokens", errors);
  }

  const providerNorm = cost["provider_norm"];
  if (providerNorm !== undefined) {
    if (!isRecord(providerNorm)) {
      errors.push("cost.provider_norm must be an object when present");
    } else {
      expectNonEmptyString(providerNorm, "schema", "cost.provider_norm", errors);
    }
  }
}

function validateExactKeys(
  record: Readonly<Record<string, unknown>>,
  path: string,
  allowedKeys: readonly string[],
  errors: string[],
): void {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      errors.push(`${path}.${key} is not pinned in receipt v0`);
    }
  }
}

function expectLiteral(
  record: Readonly<Record<string, unknown>>,
  key: string,
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (record[key] !== value) {
    errors.push(`${path}.${key} must be ${JSON.stringify(value)}`);
  }
}

function expectRecord(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: string[],
): Readonly<Record<string, unknown>> | undefined {
  const value = record[key];
  if (!isRecord(value)) {
    errors.push(`${path}.${key} must be an object`);
    return undefined;
  }

  return value;
}

function expectNonEmptyString(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${path}.${key} must be a non-empty string`);
  }
}

function expectContentHash(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = record[key];
  if (typeof value !== "string" || !CONTENT_HASH_PATTERN.test(value)) {
    errors.push(`${path}.${key} must use sha256:<64 lowercase hex>`);
  }
}

function expectStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${path}.${key} must be an array of strings`);
  }
}

function expectContentHashArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = record[key];
  if (!Array.isArray(value)) {
    errors.push(`${path}.${key} must be an array of sha256 content addresses`);
    return;
  }

  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || !CONTENT_HASH_PATTERN.test(item)) {
      errors.push(`${path}.${key}[${index}] must use sha256:<64 lowercase hex>`);
    }
  }
}

function expectBoolean(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: string[],
): void {
  if (typeof record[key] !== "boolean") {
    errors.push(`${path}.${key} must be a boolean`);
  }
}

function expectEnum<T extends string>(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  allowed: ReadonlySet<T>,
  errors: string[],
): void {
  const value = record[key];
  if (typeof value !== "string" || !allowed.has(value as T)) {
    errors.push(`${path}.${key} must be one of ${Array.from(allowed).join(", ")}`);
  }
}

function expectIsoInstant(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = record[key];
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) {
    errors.push(`${path}.${key} must be a replayable ISO instant`);
  }
}

function expectUnitInterval(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    errors.push(`${path}.${key} must be a finite number between 0 and 1`);
  }
}

function expectNonNegativeInteger(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  errors: string[],
): void {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    errors.push(`${path}.${key} must be a non-negative safe integer`);
  }
}

function expectSameString(
  leftPath: string,
  left: unknown,
  rightPath: string,
  right: unknown,
  errors: string[],
): void {
  if (typeof left === "string" && typeof right === "string" && left !== right) {
    errors.push(`${leftPath} must match ${rightPath}`);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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
      return renderCanonicalObject(value);
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`Cannot canonicalize ${typeof value}`);
  }

  throw new TypeError("Cannot canonicalize unknown value");
}

function renderCanonicalObject(
  value: Readonly<Record<string, unknown>>,
): string {
  const fields: string[] = [];

  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined) {
      throw new TypeError(`Cannot canonicalize undefined field ${key}`);
    }
    fields.push(`${JSON.stringify(key)}:${renderCanonical(item)}`);
  }

  return `{${fields.join(",")}}`;
}
