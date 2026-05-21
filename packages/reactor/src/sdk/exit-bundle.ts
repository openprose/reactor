import {
  type ConsumedReceiptPinV0,
  type ContentHashV0,
  type ReceiptCalibrationGradeV0,
  type ReceiptInterruptCauseV0,
  type ReceiptV0,
  type ReceiptVerdictStatusV0,
  canonicalizeForReceiptV0,
  hashCanonicalReceiptV0,
  verifyReceiptV0,
} from "../receipt";
import {
  type CompiledEvidencePlan,
  type CompiledEvidenceSource,
  validateCompiledEvidencePlan,
} from "../evidence-plan";
import type { ForecastScheduleStateV0 } from "../forecast";
import {
  type PolicyArtifactMemoNamespaceV0,
  namespaceKey,
} from "../memo";
import {
  normalizePolicyTransitiveFreshnessFunctionV0,
  type PolicyTransitiveFreshnessFunctionV0,
} from "../policy";

export const EXIT_BUNDLE_SCHEMA = "openprose.reactor.exit-bundle" as const;
export const EXIT_BUNDLE_VERSION = 0 as const;

const EXIT_BUNDLE_RECEIPT_LOG_SCHEMA =
  "openprose.reactor.exit-bundle.receipt-log" as const;
const EXIT_BUNDLE_RUNTIME_REGISTRY_SCHEMA =
  "openprose.reactor.exit-bundle.runtime-registry" as const;
const EXIT_BUNDLE_MANIFEST_SCHEMA =
  "openprose.reactor.exit-bundle.manifest" as const;
const EXIT_BUNDLE_IMPORT_FAILURE_SCHEMA =
  "openprose.reactor.exit-bundle.import-failure" as const;

const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const VALIDATION_STATES = new Set(["validated", "degraded", "blocked"]);
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

export type ReactorPolicyArtifactValidationStatusV0 =
  | "validated"
  | "degraded"
  | "blocked";

export interface ReactorPolicyArtifactValidationRecordV0 {
  readonly status: ReactorPolicyArtifactValidationStatusV0;
  readonly reason?: string;
  readonly validator_id?: string;
  readonly validated_as_of?: string;
  readonly validation_receipt_hash?: ContentHashV0;
}

export type ReactorPolicyArtifactValidationStateV0 =
  | ReactorPolicyArtifactValidationStatusV0
  | ReactorPolicyArtifactValidationRecordV0;

export interface ReactorExitBundleRegistrySnapshotV0 {
  readonly id: string;
  readonly identity: string;
  readonly namespace: string;
  readonly revision: string;
  readonly validation_state: ReactorPolicyArtifactValidationStateV0;
  readonly content_hash?: ContentHashV0;
  readonly bytes?: string;
}

export interface ReactorExitBundleRuntimeRegistryProjectionV0 {
  readonly schema: typeof EXIT_BUNDLE_RUNTIME_REGISTRY_SCHEMA;
  readonly v: typeof EXIT_BUNDLE_VERSION;
  readonly content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact_id: string;
  readonly policy_artifact_identity: string;
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
  readonly policy_artifact_validation_state: ReactorPolicyArtifactValidationStateV0;
  readonly validation_state?: ReactorPolicyArtifactValidationStateV0;
  readonly policy_artifact_content_hash?: ContentHashV0;
  readonly policy_artifact_bytes?: string;
  readonly transitive_freshness_function?: PolicyTransitiveFreshnessFunctionV0;
  readonly compiled_evidence_plan?: CompiledEvidencePlan;
  readonly forecast_schedule?: ForecastScheduleStateV0;
}

export type ReactorExitBundleDependencyReceiptPinV0 = ConsumedReceiptPinV0;

export interface ReactorExitBundleReceiptLogV0 {
  readonly schema: typeof EXIT_BUNDLE_RECEIPT_LOG_SCHEMA;
  readonly v: typeof EXIT_BUNDLE_VERSION;
  readonly content_hash: ContentHashV0;
  readonly head: ContentHashV0 | null;
  readonly member_hashes: readonly ContentHashV0[];
  readonly entries: readonly ReceiptV0[];
}

export interface ReactorExitBundleManifestV0 {
  readonly schema: typeof EXIT_BUNDLE_MANIFEST_SCHEMA;
  readonly v: typeof EXIT_BUNDLE_VERSION;
  readonly content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly active_policy_artifact_identity: string;
  readonly runtime_registry_content_hash: ContentHashV0;
  readonly receipt_log_content_hash: ContentHashV0;
  readonly receipt_log_head: ContentHashV0 | null;
  readonly receipt_member_hashes: readonly ContentHashV0[];
  readonly dependency_receipt_pins: readonly ReactorExitBundleDependencyReceiptPinV0[];
  readonly as_of: string;
  readonly memo_namespace: PolicyArtifactMemoNamespaceV0;
}

export type ReactorExitBundleSafeStateV0 =
  | {
      readonly status: "ready";
      readonly reasons: readonly string[];
      readonly receipt_hash: ContentHashV0 | null;
      readonly as_of: string | null;
    }
  | {
      readonly status: "degraded";
      readonly reasons: readonly string[];
      readonly receipt_hash: ContentHashV0;
      readonly as_of: string;
      readonly verdict_status: Exclude<ReceiptVerdictStatusV0, "blocked">;
      readonly calibration_grade: ReceiptCalibrationGradeV0;
      readonly reason: string;
    }
  | {
      readonly status: "blocked";
      readonly reasons: readonly string[];
      readonly receipt_hash: ContentHashV0;
      readonly as_of: string;
      readonly reason: string;
      readonly fix_target: string;
      readonly interrupt_cause: ReceiptInterruptCauseV0;
    };

export interface ReactorExitBundleV0 {
  readonly schema: typeof EXIT_BUNDLE_SCHEMA;
  readonly v: typeof EXIT_BUNDLE_VERSION;
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact: ReactorExitBundleRegistrySnapshotV0;
  readonly runtime_registry: ReactorExitBundleRuntimeRegistryProjectionV0;
  readonly receipt_log: ReactorExitBundleReceiptLogV0;
  readonly dependency_receipt_pins: readonly ReactorExitBundleDependencyReceiptPinV0[];
  readonly manifest: ReactorExitBundleManifestV0;
  readonly memo_namespace: PolicyArtifactMemoNamespaceV0;
  readonly safe_state: ReactorExitBundleSafeStateV0;
  readonly as_of: string;
}

export interface BuildReactorExitBundleV0Input {
  readonly contract_revision: ContentHashV0;
  readonly active_policy_artifact?: ReactorExitBundleRegistrySnapshotV0;
  readonly policy_artifact?: unknown;
  readonly runtime_registry?: unknown;
  readonly receipts: readonly ReceiptV0[];
  readonly as_of: string;
  readonly dependency_receipt_pins?: readonly ReactorExitBundleDependencyReceiptPinV0[];
  readonly memo_namespace_binding?: PolicyArtifactMemoNamespaceV0;
  readonly memo_namespace?: unknown;
}

export type ReactorExitBundleImportFailureCodeV0 =
  | "malformed-bundle"
  | "unsupported-version"
  | "invalid-contract-revision"
  | "invalid-policy-artifact"
  | "invalid-receipt-log"
  | "invalid-manifest"
  | "memo-namespace-mismatch"
  | "unsafe-state-mismatch"
  | "invalid-dependency-pins";

export interface ReactorExitBundleImportFailureV0 {
  readonly ok: false;
  readonly schema: typeof EXIT_BUNDLE_IMPORT_FAILURE_SCHEMA;
  readonly v: typeof EXIT_BUNDLE_VERSION;
  readonly content_hash: ContentHashV0;
  readonly code: ReactorExitBundleImportFailureCodeV0;
  readonly errors: readonly string[];
}

export type ReactorExitBundleFailureV0 = ReactorExitBundleImportFailureV0;

export type ReactorExitBundleVerificationResultV0 =
  | {
      readonly ok: true;
      readonly bundle: ReactorExitBundleV0;
      readonly manifest_hash: ContentHashV0;
      readonly receipt_log_hash: ContentHashV0;
      readonly safe_state: ReactorExitBundleSafeStateV0;
    }
  | ReactorExitBundleImportFailureV0;

export function buildReactorExitBundleV0(
  input: BuildReactorExitBundleV0Input,
): ReactorExitBundleV0 {
  const contractRevision = expectContentHashString(
    input.contract_revision,
    "contract_revision",
  );
  const asOf = expectIsoInstantString(input.as_of, "as_of");
  const activePolicyArtifact = normalizePolicyArtifact(
    input.active_policy_artifact ?? input.policy_artifact,
    "policy_artifact",
  );
  const memoNamespaceBinding = normalizeMemoNamespaceBinding(
    input.memo_namespace_binding ?? input.memo_namespace ?? {
      policy_artifact_namespace: activePolicyArtifact.namespace,
      policy_artifact_revision: activePolicyArtifact.revision,
    },
    "memo_namespace_binding",
  );

  assertMemoNamespaceMatchesArtifact(
    memoNamespaceBinding,
    activePolicyArtifact,
  );
  const runtimeRegistry = normalizeRuntimeRegistryProjection(
    input.runtime_registry ??
      runtimeRegistryProjectionFromPolicyArtifact({
        contract_revision: contractRevision,
        policy_artifact: activePolicyArtifact,
      }),
    {
      contract_revision: contractRevision,
      active_policy_artifact: activePolicyArtifact,
      memo_namespace_binding: memoNamespaceBinding,
      require_envelope: false,
    },
    "runtime_registry",
  );

  const receipts = normalizeVerifiedReceipts(
    input.receipts,
    contractRevision,
    "receipts",
  );
  assertReceiptLogNotAfterBundleAsOf(receipts, asOf);

  const dependencyReceiptPins = collectDependencyReceiptPins(
    receipts,
    input.dependency_receipt_pins ?? [],
  );
  const receiptLog = buildReceiptLog(receipts);
  const manifest = buildManifest({
    contract_revision: contractRevision,
    active_policy_artifact_identity: activePolicyArtifact.identity,
    runtime_registry: runtimeRegistry,
    receipt_log: receiptLog,
    dependency_receipt_pins: dependencyReceiptPins,
    as_of: asOf,
    memo_namespace_binding: memoNamespaceBinding,
  });
  const safeState = deriveSafeState(receipts);
  const bundle: ReactorExitBundleV0 = {
    schema: EXIT_BUNDLE_SCHEMA,
    v: EXIT_BUNDLE_VERSION,
    contract_revision: contractRevision,
    policy_artifact: activePolicyArtifact,
    runtime_registry: runtimeRegistry,
    receipt_log: receiptLog,
    dependency_receipt_pins: dependencyReceiptPins,
    manifest,
    memo_namespace: memoNamespaceBinding,
    safe_state: safeState,
    as_of: asOf,
  };
  const verification = verifyReactorExitBundleV0(bundle);

  if (!verification.ok) {
    throw new Error(
      `Built exit bundle failed verification: ${verification.errors.join("; ")}`,
    );
  }

  return bundle;
}

export function verifyReactorExitBundleV0(
  value: unknown,
): ReactorExitBundleVerificationResultV0 {
  try {
    const bundle = normalizeBundle(value);

    return {
      ok: true,
      bundle,
      manifest_hash: bundle.manifest.content_hash,
      receipt_log_hash: bundle.receipt_log.content_hash,
      safe_state: bundle.safe_state,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "exit bundle verification failed";

    return createReactorExitBundleFailureV0(
      classifyVerificationFailure(message),
      [message],
    );
  }
}

export interface ReactorExitBundleFailureInputV0 {
  readonly code?: string;
  readonly reason?: string;
  readonly message?: string;
  readonly errors?: readonly string[];
}

export function createReactorExitBundleFailureV0(
  code: ReactorExitBundleImportFailureCodeV0,
  errors: readonly string[],
): ReactorExitBundleImportFailureV0;
export function createReactorExitBundleFailureV0(
  input: ReactorExitBundleFailureInputV0,
): ReactorExitBundleImportFailureV0;
export function createReactorExitBundleFailureV0(
  codeOrInput:
    | ReactorExitBundleImportFailureCodeV0
    | ReactorExitBundleFailureInputV0,
  errors: readonly string[] = [],
): ReactorExitBundleImportFailureV0 {
  const code =
    typeof codeOrInput === "string"
      ? codeOrInput
      : coerceFailureCode(codeOrInput.code ?? codeOrInput.reason);
  const normalizedErrors =
    typeof codeOrInput === "string"
      ? errors.length === 0
        ? ["exit bundle import failed safe"]
        : [...errors]
      : normalizeFailureInputErrors(codeOrInput);
  const payload = {
    ok: false as const,
    schema: EXIT_BUNDLE_IMPORT_FAILURE_SCHEMA,
    v: EXIT_BUNDLE_VERSION,
    code,
    errors: normalizedErrors,
  };

  return {
    ...payload,
    content_hash: hashCanonicalReceiptV0(canonicalizeForReceiptV0(payload)),
  };
}

function normalizeBundle(value: unknown): ReactorExitBundleV0 {
  const bundle = expectPlainRecord(value, "exit bundle");
  expectExactKeys(
    bundle,
    "exit bundle",
    [
      "schema",
      "v",
      "contract_revision",
      "policy_artifact",
      "active_policy_artifact",
      "runtime_registry",
      "receipt_log",
      "dependency_receipt_pins",
      "manifest",
      "memo_namespace",
      "memo_namespace_binding",
      "safe_state",
      "as_of",
    ],
  );
  expectLiteral(bundle["schema"], EXIT_BUNDLE_SCHEMA, "exit bundle.schema");
  expectLiteral(bundle["v"], EXIT_BUNDLE_VERSION, "exit bundle.v");

  const contractRevision = expectContentHashString(
    bundle["contract_revision"],
    "exit bundle.contract_revision",
  );
  const asOf = expectIsoInstantString(bundle["as_of"], "exit bundle.as_of");
  const activePolicyArtifact = normalizePolicyArtifact(
    bundle["policy_artifact"] ?? bundle["active_policy_artifact"],
    "exit bundle.policy_artifact",
  );
  const memoNamespaceBinding = normalizeMemoNamespaceBinding(
    bundle["memo_namespace"] ?? bundle["memo_namespace_binding"],
    "exit bundle.memo_namespace",
  );
  assertMemoNamespaceMatchesArtifact(
    memoNamespaceBinding,
    activePolicyArtifact,
  );
  const runtimeRegistry = normalizeRuntimeRegistryProjection(
    bundle["runtime_registry"],
    {
      contract_revision: contractRevision,
      active_policy_artifact: activePolicyArtifact,
      memo_namespace_binding: memoNamespaceBinding,
      require_envelope: true,
    },
    "exit bundle.runtime_registry",
  );

  const receiptLog = normalizeReceiptLog(
    bundle["receipt_log"],
    contractRevision,
    "exit bundle.receipt_log",
  );
  assertReceiptLogNotAfterBundleAsOf(receiptLog.entries, asOf);

  const dependencyReceiptPins = normalizeDependencyPins(
    bundle["dependency_receipt_pins"],
    "exit bundle.dependency_receipt_pins",
  );
  assertCanonicalEqual(
    bundle["dependency_receipt_pins"],
    dependencyReceiptPins,
    "exit bundle.dependency_receipt_pins",
  );
  assertDependencyPinsCoverReceiptLog(receiptLog.entries, dependencyReceiptPins);

  const manifest = normalizeManifest(
    bundle["manifest"],
    {
      contract_revision: contractRevision,
      active_policy_artifact_identity: activePolicyArtifact.identity,
      runtime_registry: runtimeRegistry,
      receipt_log: receiptLog,
      dependency_receipt_pins: dependencyReceiptPins,
      as_of: asOf,
      memo_namespace_binding: memoNamespaceBinding,
    },
    "exit bundle.manifest",
  );
  const safeState = normalizeSafeState(
    bundle["safe_state"],
    "exit bundle.safe_state",
  );
  assertCanonicalEqual(
    safeState,
    deriveSafeState(receiptLog.entries),
    "exit bundle.safe_state",
  );

  return {
    schema: EXIT_BUNDLE_SCHEMA,
    v: EXIT_BUNDLE_VERSION,
    contract_revision: contractRevision,
    policy_artifact: activePolicyArtifact,
    runtime_registry: runtimeRegistry,
    receipt_log: receiptLog,
    dependency_receipt_pins: dependencyReceiptPins,
    manifest,
    memo_namespace: memoNamespaceBinding,
    safe_state: safeState,
    as_of: asOf,
  };
}

function normalizePolicyArtifact(
  value: unknown,
  path: string,
): ReactorExitBundleRegistrySnapshotV0 {
  const artifact = expectPlainRecord(value, path);
  expectExactKeys(
    artifact,
    path,
    [
      "id",
      "identity",
      "namespace",
      "revision",
      "content_hash",
      "bytes",
      "policy_artifact_identity",
      "policy_artifact_namespace",
      "policy_artifact_revision",
      "validation_state",
      "artifact_content_hash",
      "artifact_bytes",
    ],
  );

  const policyArtifactIdentity = expectNonEmptyString(
    artifact["identity"] ?? artifact["policy_artifact_identity"] ?? artifact["id"],
    `${path}.identity`,
  );
  const policyArtifactId = expectNonEmptyString(
    artifact["id"] ?? artifact["policy_artifact_identity"] ?? artifact["identity"],
    `${path}.id`,
  );
  const policyArtifactNamespace = expectNonEmptyString(
    artifact["namespace"] ?? artifact["policy_artifact_namespace"],
    `${path}.namespace`,
  );
  const policyArtifactRevision = expectNonEmptyString(
    artifact["revision"] ?? artifact["policy_artifact_revision"],
    `${path}.revision`,
  );
  const validationState = normalizeValidationState(
    artifact["validation_state"],
    `${path}.validation_state`,
  );

  const artifactContentHash =
    (artifact["content_hash"] ?? artifact["artifact_content_hash"]) === undefined
      ? undefined
      : expectContentHashString(
          artifact["content_hash"] ?? artifact["artifact_content_hash"],
          `${path}.content_hash`,
        );
  const artifactBytes =
    (artifact["bytes"] ?? artifact["artifact_bytes"]) === undefined
      ? undefined
      : expectNonEmptyString(
          artifact["bytes"] ?? artifact["artifact_bytes"],
          `${path}.bytes`,
        );

  if (
    artifactContentHash === undefined &&
    artifactBytes === undefined &&
    !CONTENT_HASH_PATTERN.test(policyArtifactIdentity)
  ) {
    throw new Error(
      `${path} must include artifact_bytes, artifact_content_hash, or a content-addressed policy_artifact_identity`,
    );
  }

  return {
    id: policyArtifactId,
    identity: policyArtifactIdentity,
    namespace: policyArtifactNamespace,
    revision: policyArtifactRevision,
    validation_state: validationState,
    ...(artifactContentHash === undefined
      ? {}
      : { content_hash: artifactContentHash }),
    ...(artifactBytes === undefined ? {} : { bytes: artifactBytes }),
  };
}

interface NormalizeRuntimeRegistryProjectionInput {
  readonly contract_revision: ContentHashV0;
  readonly active_policy_artifact: ReactorExitBundleRegistrySnapshotV0;
  readonly memo_namespace_binding: PolicyArtifactMemoNamespaceV0;
  readonly require_envelope: boolean;
}

function runtimeRegistryProjectionFromPolicyArtifact(input: {
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact: ReactorExitBundleRegistrySnapshotV0;
}): unknown {
  return {
    contract_revision: input.contract_revision,
    policy_artifact_id: input.policy_artifact.id,
    policy_artifact_identity: input.policy_artifact.identity,
    policy_artifact_namespace: input.policy_artifact.namespace,
    policy_artifact_revision: input.policy_artifact.revision,
    policy_artifact_validation_state: input.policy_artifact.validation_state,
    validation_state: input.policy_artifact.validation_state,
    ...(input.policy_artifact.content_hash === undefined
      ? {}
      : { policy_artifact_content_hash: input.policy_artifact.content_hash }),
    ...(input.policy_artifact.bytes === undefined
      ? {}
      : { policy_artifact_bytes: input.policy_artifact.bytes }),
  };
}

function normalizeRuntimeRegistryProjection(
  value: unknown,
  expected: NormalizeRuntimeRegistryProjectionInput,
  path: string,
): ReactorExitBundleRuntimeRegistryProjectionV0 {
  const registry = expectPlainRecord(value, path);
  expectExactKeys(registry, path, [
    "schema",
    "v",
    "content_hash",
    "contract_revision",
    "policy_artifact_id",
    "policy_artifact_identity",
    "policy_artifact_namespace",
    "policy_artifact_revision",
    "policy_artifact_validation_state",
    "validation_state",
    "policy_artifact_content_hash",
    "policy_artifact_bytes",
    "transitive_freshness_function",
    "compiled_evidence_plan",
    "forecast_schedule",
  ]);

  if (expected.require_envelope || registry["schema"] !== undefined) {
    expectLiteral(
      registry["schema"],
      EXIT_BUNDLE_RUNTIME_REGISTRY_SCHEMA,
      `${path}.schema`,
    );
  }
  if (expected.require_envelope || registry["v"] !== undefined) {
    expectLiteral(registry["v"], EXIT_BUNDLE_VERSION, `${path}.v`);
  }

  const contractRevision = expectContentHashString(
    registry["contract_revision"],
    `${path}.contract_revision`,
  );
  const policyArtifactId = expectNonEmptyString(
    registry["policy_artifact_id"],
    `${path}.policy_artifact_id`,
  );
  const policyArtifactIdentity = expectNonEmptyString(
    registry["policy_artifact_identity"],
    `${path}.policy_artifact_identity`,
  );
  const policyArtifactNamespace = expectNonEmptyString(
    registry["policy_artifact_namespace"],
    `${path}.policy_artifact_namespace`,
  );
  const policyArtifactRevision = expectNonEmptyString(
    registry["policy_artifact_revision"],
    `${path}.policy_artifact_revision`,
  );
  const validationState = normalizeValidationState(
    registry["policy_artifact_validation_state"],
    `${path}.policy_artifact_validation_state`,
  );
  const validationStateAlias =
    registry["validation_state"] === undefined
      ? undefined
      : normalizeValidationState(registry["validation_state"], `${path}.validation_state`);

  if (
    validationStateAlias !== undefined &&
    canonicalizeForReceiptV0(validationStateAlias) !==
      canonicalizeForReceiptV0(validationState)
  ) {
    throw new Error(`${path}.validation_state must match policy_artifact_validation_state`);
  }

  const policyArtifactContentHash =
    registry["policy_artifact_content_hash"] === undefined
      ? undefined
      : expectContentHashString(
          registry["policy_artifact_content_hash"],
          `${path}.policy_artifact_content_hash`,
        );
  const policyArtifactBytes =
    registry["policy_artifact_bytes"] === undefined
      ? undefined
      : expectNonEmptyString(
          registry["policy_artifact_bytes"],
          `${path}.policy_artifact_bytes`,
        );
  const transitiveFreshnessFunction =
    registry["transitive_freshness_function"] === undefined
      ? undefined
      : normalizePolicyTransitiveFreshnessFunctionV0(
          registry["transitive_freshness_function"],
          `${path}.transitive_freshness_function`,
        );
  const compiledEvidencePlan =
    registry["compiled_evidence_plan"] === undefined
      ? undefined
      : normalizeCompiledEvidencePlan(
          registry["compiled_evidence_plan"],
          `${path}.compiled_evidence_plan`,
        );
  const forecastSchedule =
    registry["forecast_schedule"] === undefined
      ? undefined
      : normalizeForecastSchedule(
          registry["forecast_schedule"],
          `${path}.forecast_schedule`,
        );

  const projection = runtimeRegistryProjectionPayload({
    contract_revision: contractRevision,
    policy_artifact_id: policyArtifactId,
    policy_artifact_identity: policyArtifactIdentity,
    policy_artifact_namespace: policyArtifactNamespace,
    policy_artifact_revision: policyArtifactRevision,
    policy_artifact_validation_state: validationState,
    ...(validationStateAlias === undefined
      ? {}
      : { validation_state: validationStateAlias }),
    ...(policyArtifactContentHash === undefined
      ? {}
      : { policy_artifact_content_hash: policyArtifactContentHash }),
    ...(policyArtifactBytes === undefined
      ? {}
      : { policy_artifact_bytes: policyArtifactBytes }),
    ...(transitiveFreshnessFunction === undefined
      ? {}
      : { transitive_freshness_function: transitiveFreshnessFunction }),
    ...(compiledEvidencePlan === undefined
      ? {}
      : { compiled_evidence_plan: compiledEvidencePlan }),
    ...(forecastSchedule === undefined
      ? {}
      : { forecast_schedule: forecastSchedule }),
  });

  const contentHash = hashCanonicalReceiptV0(canonicalizeForReceiptV0(projection));
  if (expected.require_envelope || registry["content_hash"] !== undefined) {
    const suppliedContentHash = expectContentHashString(
      registry["content_hash"],
      `${path}.content_hash`,
    );
    if (suppliedContentHash !== contentHash) {
      throw new Error(`${path}.content_hash does not match canonical runtime registry projection`);
    }
  }

  const normalized = {
    ...projection,
    content_hash: contentHash,
  };

  assertRuntimeRegistryMatchesBundleEdges(normalized, expected, path);
  assertRuntimeRegistryRuntimeFields(normalized, path);

  return normalized;
}

function runtimeRegistryProjectionPayload(
  input: Omit<ReactorExitBundleRuntimeRegistryProjectionV0, "schema" | "v" | "content_hash">,
): Omit<ReactorExitBundleRuntimeRegistryProjectionV0, "content_hash"> {
  return {
    schema: EXIT_BUNDLE_RUNTIME_REGISTRY_SCHEMA,
    v: EXIT_BUNDLE_VERSION,
    ...input,
  };
}

function assertRuntimeRegistryMatchesBundleEdges(
  registry: ReactorExitBundleRuntimeRegistryProjectionV0,
  expected: NormalizeRuntimeRegistryProjectionInput,
  path: string,
): void {
  if (registry.contract_revision !== expected.contract_revision) {
    throw new Error(`${path}.contract_revision must match exit bundle.contract_revision`);
  }
  if (registry.policy_artifact_id !== expected.active_policy_artifact.id) {
    throw new Error(`${path}.policy_artifact_id must match policy_artifact.id`);
  }
  if (registry.policy_artifact_identity !== expected.active_policy_artifact.identity) {
    throw new Error(`${path}.policy_artifact_identity must match policy_artifact.identity`);
  }
  if (registry.policy_artifact_namespace !== expected.active_policy_artifact.namespace) {
    throw new Error(`${path}.policy_artifact_namespace must match policy_artifact.namespace`);
  }
  if (registry.policy_artifact_revision !== expected.active_policy_artifact.revision) {
    throw new Error(`${path}.policy_artifact_revision must match policy_artifact.revision`);
  }
  if (
    canonicalizeForReceiptV0(registry.policy_artifact_validation_state) !==
    canonicalizeForReceiptV0(expected.active_policy_artifact.validation_state)
  ) {
    throw new Error(`${path}.policy_artifact_validation_state must match policy_artifact.validation_state`);
  }
  if (
    registry.policy_artifact_content_hash !== undefined &&
    expected.active_policy_artifact.content_hash !== undefined &&
    registry.policy_artifact_content_hash !== expected.active_policy_artifact.content_hash
  ) {
    throw new Error(`${path}.policy_artifact_content_hash must match policy_artifact.content_hash`);
  }
  if (
    registry.policy_artifact_bytes !== undefined &&
    expected.active_policy_artifact.bytes !== undefined &&
    registry.policy_artifact_bytes !== expected.active_policy_artifact.bytes
  ) {
    throw new Error(`${path}.policy_artifact_bytes must match policy_artifact.bytes`);
  }
  if (
    registry.policy_artifact_namespace !==
      expected.memo_namespace_binding.policy_artifact_namespace ||
    registry.policy_artifact_revision !==
      expected.memo_namespace_binding.policy_artifact_revision
  ) {
    throw new Error(`${path} must match memo_namespace policy artifact binding`);
  }
}

function assertRuntimeRegistryRuntimeFields(
  registry: ReactorExitBundleRuntimeRegistryProjectionV0,
  path: string,
): void {
  const plan = registry.compiled_evidence_plan;
  if (plan !== undefined) {
    if (plan.contract_revision !== registry.contract_revision) {
      throw new Error(`${path}.compiled_evidence_plan.contract_revision must match registry`);
    }
    if (plan.policy_artifact_namespace !== registry.policy_artifact_namespace) {
      throw new Error(`${path}.compiled_evidence_plan.policy_artifact_namespace must match registry`);
    }
    if (plan.policy_artifact_revision !== registry.policy_artifact_revision) {
      throw new Error(`${path}.compiled_evidence_plan.policy_artifact_revision must match registry`);
    }
  }

  const schedule = registry.forecast_schedule;
  if (schedule !== undefined) {
    if (schedule.contract_revision !== registry.contract_revision) {
      throw new Error(`${path}.forecast_schedule.contract_revision must match registry`);
    }
  }

  if (
    plan !== undefined &&
    schedule !== undefined &&
    plan.responsibility_id !== schedule.responsibility_id
  ) {
    throw new Error(`${path}.compiled_evidence_plan and forecast_schedule responsibility_id must match`);
  }
}

function normalizeCompiledEvidencePlan(
  value: unknown,
  path: string,
): CompiledEvidencePlan {
  const plan = expectPlainRecord(value, path);
  expectExactKeys(plan, path, [
    "responsibility_id",
    "contract_revision",
    "policy_artifact_namespace",
    "policy_artifact_revision",
    "plan_revision",
    "as_of",
    "evidence_order",
    "sources",
  ]);

  const normalized: CompiledEvidencePlan = {
    responsibility_id: expectNonEmptyString(plan["responsibility_id"], `${path}.responsibility_id`),
    contract_revision: expectContentHashString(plan["contract_revision"], `${path}.contract_revision`),
    policy_artifact_namespace: expectNonEmptyString(
      plan["policy_artifact_namespace"],
      `${path}.policy_artifact_namespace`,
    ),
    policy_artifact_revision: expectNonEmptyString(
      plan["policy_artifact_revision"],
      `${path}.policy_artifact_revision`,
    ),
    plan_revision: expectNonEmptyString(plan["plan_revision"], `${path}.plan_revision`),
    as_of: expectIsoInstantString(plan["as_of"], `${path}.as_of`),
    evidence_order: expectEvidenceReceiptOrder(plan["evidence_order"], `${path}.evidence_order`),
    sources: normalizeCompiledEvidenceSources(plan["sources"], `${path}.sources`),
  };
  const errors = validateCompiledEvidencePlan(normalized);
  if (errors.length > 0) {
    throw new Error(`${path} is malformed: ${errors.join("; ")}`);
  }

  return normalized;
}

function normalizeCompiledEvidenceSources(
  value: unknown,
  path: string,
): readonly CompiledEvidenceSource[] {
  return expectArray(value, path).map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const source = expectPlainRecord(item, itemPath);
    expectExactKeys(source, itemPath, ["id", "kind", "required", "receipt_order"]);
    const kind = expectEnumString(
      source["kind"],
      new Set(["adapter", "forecast", "dependency"]),
      `${itemPath}.kind`,
    );
    const required = source["required"];
    if (typeof required !== "boolean") {
      throw new Error(`${itemPath}.required must be boolean`);
    }
    const receiptOrder =
      source["receipt_order"] === undefined
        ? undefined
        : expectEvidenceReceiptOrder(source["receipt_order"], `${itemPath}.receipt_order`);

    return {
      id: expectNonEmptyString(source["id"], `${itemPath}.id`),
      kind: kind as CompiledEvidenceSource["kind"],
      required,
      ...(receiptOrder === undefined ? {} : { receipt_order: receiptOrder }),
    };
  });
}

function expectEvidenceReceiptOrder(
  value: unknown,
  path: string,
): CompiledEvidencePlan["evidence_order"] {
  return expectEnumString(
    value,
    new Set(["unordered", "declared"]),
    path,
  ) as CompiledEvidencePlan["evidence_order"];
}

function normalizeForecastSchedule(
  value: unknown,
  path: string,
): ForecastScheduleStateV0 {
  const schedule = expectPlainRecord(value, path);
  expectExactKeys(schedule, path, [
    "responsibility_id",
    "contract_revision",
    "memo_key",
    "evidence_input_ids",
    "next_evidence_recheck",
    "next_plan_recheck",
  ]);

  return {
    responsibility_id: expectNonEmptyString(
      schedule["responsibility_id"],
      `${path}.responsibility_id`,
    ),
    contract_revision: expectContentHashString(
      schedule["contract_revision"],
      `${path}.contract_revision`,
    ),
    memo_key: expectNonEmptyString(schedule["memo_key"], `${path}.memo_key`),
    evidence_input_ids: expectContentHashArray(
      schedule["evidence_input_ids"],
      `${path}.evidence_input_ids`,
    ),
    next_evidence_recheck: expectIsoInstantString(
      schedule["next_evidence_recheck"],
      `${path}.next_evidence_recheck`,
    ),
    next_plan_recheck: expectIsoInstantString(
      schedule["next_plan_recheck"],
      `${path}.next_plan_recheck`,
    ),
  };
}

function normalizeValidationState(
  value: unknown,
  path: string,
): ReactorPolicyArtifactValidationStateV0 {
  if (typeof value === "string") {
    return expectEnumString(
      value,
      VALIDATION_STATES,
      path,
    ) as ReactorPolicyArtifactValidationStatusV0;
  }

  const state = expectPlainRecord(value, path);
  expectExactKeys(
    state,
    path,
    [
      "status",
      "reason",
      "validator_id",
      "validated_as_of",
      "validation_receipt_hash",
    ],
  );

  const status = expectEnumString(
    state["status"],
    VALIDATION_STATES,
    `${path}.status`,
  ) as ReactorPolicyArtifactValidationStatusV0;
  const reason =
    state["reason"] === undefined
      ? undefined
      : expectNonEmptyString(state["reason"], `${path}.reason`);
  const validatorId =
    state["validator_id"] === undefined
      ? undefined
      : expectNonEmptyString(state["validator_id"], `${path}.validator_id`);
  const validatedAsOf =
    state["validated_as_of"] === undefined
      ? undefined
      : expectIsoInstantString(state["validated_as_of"], `${path}.validated_as_of`);
  const validationReceiptHash =
    state["validation_receipt_hash"] === undefined
      ? undefined
      : expectContentHashString(
          state["validation_receipt_hash"],
          `${path}.validation_receipt_hash`,
        );

  if ((status === "degraded" || status === "blocked") && reason === undefined) {
    throw new Error(`${path}.reason is required when status is ${status}`);
  }

  return {
    status,
    ...(reason === undefined ? {} : { reason }),
    ...(validatorId === undefined ? {} : { validator_id: validatorId }),
    ...(validatedAsOf === undefined ? {} : { validated_as_of: validatedAsOf }),
    ...(validationReceiptHash === undefined
      ? {}
      : { validation_receipt_hash: validationReceiptHash }),
  };
}

function normalizeMemoNamespaceBinding(
  value: unknown,
  path: string,
): PolicyArtifactMemoNamespaceV0 {
  const binding = expectPlainRecord(value, path);
  expectExactKeys(
    binding,
    path,
    ["policy_artifact_namespace", "policy_artifact_revision"],
  );

  const normalized = {
    policy_artifact_namespace: expectNonEmptyString(
      binding["policy_artifact_namespace"],
      `${path}.policy_artifact_namespace`,
    ),
    policy_artifact_revision: expectNonEmptyString(
      binding["policy_artifact_revision"],
      `${path}.policy_artifact_revision`,
    ),
  };

  namespaceKey(normalized);
  return normalized;
}

function normalizeReceiptLog(
  value: unknown,
  contractRevision: ContentHashV0,
  path: string,
): ReactorExitBundleReceiptLogV0 {
  const log = expectPlainRecord(value, path);
  expectExactKeys(log, path, [
    "schema",
    "v",
    "content_hash",
    "head",
    "member_hashes",
    "entries",
  ]);
  expectLiteral(log["schema"], EXIT_BUNDLE_RECEIPT_LOG_SCHEMA, `${path}.schema`);
  expectLiteral(log["v"], EXIT_BUNDLE_VERSION, `${path}.v`);
  expectContentHashString(log["content_hash"], `${path}.content_hash`);
  expectNullableContentHash(log["head"], `${path}.head`);
  expectContentHashArray(log["member_hashes"], `${path}.member_hashes`);

  const rawReceipts = expectArray(log["entries"], `${path}.entries`);
  const receipts = normalizeVerifiedReceipts(
    rawReceipts,
    contractRevision,
    `${path}.entries`,
  );
  const expected = buildReceiptLog(receipts);
  assertCanonicalEqual(log, expected, path);

  return expected;
}

function normalizeManifest(
  value: unknown,
  input: BuildManifestInput,
  path: string,
): ReactorExitBundleManifestV0 {
  const manifest = expectPlainRecord(value, path);
  expectExactKeys(manifest, path, [
    "schema",
    "v",
    "content_hash",
    "contract_revision",
    "active_policy_artifact_identity",
    "runtime_registry_content_hash",
    "receipt_log_content_hash",
    "receipt_log_head",
    "receipt_member_hashes",
    "dependency_receipt_pins",
    "as_of",
    "memo_namespace",
  ]);
  expectLiteral(manifest["schema"], EXIT_BUNDLE_MANIFEST_SCHEMA, `${path}.schema`);
  expectLiteral(manifest["v"], EXIT_BUNDLE_VERSION, `${path}.v`);
  expectContentHashString(manifest["content_hash"], `${path}.content_hash`);
  expectContentHashString(
    manifest["contract_revision"],
    `${path}.contract_revision`,
  );
  expectNonEmptyString(
    manifest["active_policy_artifact_identity"],
    `${path}.active_policy_artifact_identity`,
  );
  expectContentHashString(
    manifest["runtime_registry_content_hash"],
    `${path}.runtime_registry_content_hash`,
  );
  expectContentHashString(
    manifest["receipt_log_content_hash"],
    `${path}.receipt_log_content_hash`,
  );
  expectNullableContentHash(manifest["receipt_log_head"], `${path}.receipt_log_head`);
  expectContentHashArray(
    manifest["receipt_member_hashes"],
    `${path}.receipt_member_hashes`,
  );
  normalizeDependencyPins(
    manifest["dependency_receipt_pins"],
    `${path}.dependency_receipt_pins`,
  );
  expectIsoInstantString(manifest["as_of"], `${path}.as_of`);
  normalizeMemoNamespaceBinding(
    manifest["memo_namespace"],
    `${path}.memo_namespace`,
  );

  const expected = buildManifest(input);
  assertCanonicalEqual(manifest, expected, path);

  return expected;
}

function normalizeSafeState(
  value: unknown,
  path: string,
): ReactorExitBundleSafeStateV0 {
  const safeState = expectPlainRecord(value, path);
  const status = expectEnumString(
    safeState["status"],
    new Set(["ready", "degraded", "blocked"]),
    `${path}.status`,
  );

  if (status === "ready") {
    expectExactKeys(safeState, path, ["status", "reasons", "receipt_hash", "as_of"]);
    const reasons = expectStringArray(safeState["reasons"], `${path}.reasons`);
    if (reasons.length > 0) {
      throw new Error(`${path}.reasons must be empty when status is ready`);
    }
    const receiptHash = expectNullableContentHash(
      safeState["receipt_hash"],
      `${path}.receipt_hash`,
    );
    const asOf = expectNullableIsoInstant(safeState["as_of"], `${path}.as_of`);

    if ((receiptHash === null) !== (asOf === null)) {
      throw new Error(`${path}.receipt_hash and ${path}.as_of must be paired`);
    }

    return {
      status: "ready",
      reasons,
      receipt_hash: receiptHash,
      as_of: asOf,
    };
  }

  if (status === "degraded") {
    expectExactKeys(safeState, path, [
      "status",
      "reasons",
      "receipt_hash",
      "as_of",
      "verdict_status",
      "calibration_grade",
      "reason",
    ]);

    const verdictStatus = expectEnumString(
      safeState["verdict_status"],
      VERDICT_STATUSES,
      `${path}.verdict_status`,
    ) as ReceiptVerdictStatusV0;
    if (verdictStatus === "blocked") {
      throw new Error(`${path}.verdict_status must not be blocked for degraded state`);
    }

    return {
      status: "degraded",
      reasons: expectNonEmptyStringArray(safeState["reasons"], `${path}.reasons`),
      receipt_hash: expectContentHashString(
        safeState["receipt_hash"],
        `${path}.receipt_hash`,
      ),
      as_of: expectIsoInstantString(safeState["as_of"], `${path}.as_of`),
      verdict_status: verdictStatus,
      calibration_grade: expectEnumString(
        safeState["calibration_grade"],
        CALIBRATION_GRADES,
        `${path}.calibration_grade`,
      ) as ReceiptCalibrationGradeV0,
      reason: expectNonEmptyString(safeState["reason"], `${path}.reason`),
    };
  }

  expectExactKeys(safeState, path, [
    "status",
    "reasons",
    "receipt_hash",
    "as_of",
    "reason",
    "fix_target",
    "interrupt_cause",
  ]);

  return {
    status: "blocked",
    reasons: expectNonEmptyStringArray(safeState["reasons"], `${path}.reasons`),
    receipt_hash: expectContentHashString(
      safeState["receipt_hash"],
      `${path}.receipt_hash`,
    ),
    as_of: expectIsoInstantString(safeState["as_of"], `${path}.as_of`),
    reason: expectNonEmptyString(safeState["reason"], `${path}.reason`),
    fix_target: expectNonEmptyString(safeState["fix_target"], `${path}.fix_target`),
    interrupt_cause: expectEnumString(
      safeState["interrupt_cause"],
      INTERRUPT_CAUSES,
      `${path}.interrupt_cause`,
    ) as ReceiptInterruptCauseV0,
  };
}

function normalizeVerifiedReceipts(
  value: readonly unknown[],
  contractRevision: ContentHashV0,
  path: string,
): readonly ReceiptV0[] {
  const receipts: ReceiptV0[] = [];
  const seen = new Set<string>();

  for (const [index, receipt] of value.entries()) {
    const verification = verifyReceiptV0(receipt);
    if (!verification.ok) {
      throw new Error(
        `${path}[${index}] failed receipt v0 verification: ${verification.errors.join("; ")}`,
      );
    }

    const verifiedReceipt = receipt as ReceiptV0;
    if (verifiedReceipt.core.contract_revision !== contractRevision) {
      throw new Error(
        `${path}[${index}].core.contract_revision must match bundle contract_revision`,
      );
    }
    if (seen.has(verification.content_hash)) {
      throw new Error(`${path}[${index}] duplicates receipt ${verification.content_hash}`);
    }

    seen.add(verification.content_hash);
    receipts.push(verifiedReceipt);
  }

  return receipts.sort(compareReceiptsForLog);
}

function collectDependencyReceiptPins(
  receipts: readonly ReceiptV0[],
  explicitPins: readonly ReactorExitBundleDependencyReceiptPinV0[],
): readonly ReactorExitBundleDependencyReceiptPinV0[] {
  const receiptPins: ReactorExitBundleDependencyReceiptPinV0[] = [];
  for (const receipt of receipts) {
    receiptPins.push(...receipt.composition.consumed_receipts);
  }

  return normalizeDependencyPins([...explicitPins, ...receiptPins], "dependency_receipt_pins");
}

function normalizeDependencyPins(
  value: unknown,
  path: string,
): readonly ReactorExitBundleDependencyReceiptPinV0[] {
  const pins = expectArray(value, path);
  const normalized: ReactorExitBundleDependencyReceiptPinV0[] = [];
  const byUpstreamHash = new Map<string, string>();
  const seen = new Set<string>();

  for (const [index, item] of pins.entries()) {
    const itemPath = `${path}[${index}]`;
    const pin = expectPlainRecord(item, itemPath);
    expectExactKeys(pin, itemPath, [
      "upstream_content_hash",
      "contract_revision",
      "acceptable_signer_set",
    ]);

    const upstreamContentHash = expectContentHashString(
      pin["upstream_content_hash"],
      `${itemPath}.upstream_content_hash`,
    );
    const contractRevision = expectContentHashString(
      pin["contract_revision"],
      `${itemPath}.contract_revision`,
    );
    const acceptableSignerSet = normalizeSignerSet(
      pin["acceptable_signer_set"],
      `${itemPath}.acceptable_signer_set`,
    );
    const pinIdentity = canonicalizeForReceiptV0({
      upstream_content_hash: upstreamContentHash,
      contract_revision: contractRevision,
      acceptable_signer_set: acceptableSignerSet,
    });
    const existingIdentity = byUpstreamHash.get(upstreamContentHash);
    if (existingIdentity !== undefined && existingIdentity !== pinIdentity) {
      throw new Error(`${itemPath}.upstream_content_hash has conflicting pins`);
    }
    if (seen.has(pinIdentity)) {
      continue;
    }

    byUpstreamHash.set(upstreamContentHash, pinIdentity);
    seen.add(pinIdentity);
    normalized.push({
      upstream_content_hash: upstreamContentHash,
      contract_revision: contractRevision,
      acceptable_signer_set: acceptableSignerSet,
    });
  }

  return normalized.sort(compareDependencyPins);
}

function normalizeSignerSet(value: unknown, path: string): readonly string[] {
  const signers = expectStringArray(value, path);
  if (signers.length === 0) {
    throw new Error(`${path} must not be empty`);
  }

  const seen = new Set<string>();
  for (const signer of signers) {
    if (signer.length === 0) {
      throw new Error(`${path} must not contain empty signer ids`);
    }
    if (seen.has(signer)) {
      throw new Error(`${path} must not contain duplicate signer ${signer}`);
    }
    seen.add(signer);
  }

  return [...signers].sort((left, right) => left.localeCompare(right));
}

interface BuildManifestInput {
  readonly contract_revision: ContentHashV0;
  readonly active_policy_artifact_identity: string;
  readonly runtime_registry: ReactorExitBundleRuntimeRegistryProjectionV0;
  readonly receipt_log: ReactorExitBundleReceiptLogV0;
  readonly dependency_receipt_pins: readonly ReactorExitBundleDependencyReceiptPinV0[];
  readonly as_of: string;
  readonly memo_namespace_binding: PolicyArtifactMemoNamespaceV0;
}

function buildManifest(input: BuildManifestInput): ReactorExitBundleManifestV0 {
  const payload = {
    schema: EXIT_BUNDLE_MANIFEST_SCHEMA,
    v: EXIT_BUNDLE_VERSION,
    contract_revision: input.contract_revision,
    active_policy_artifact_identity: input.active_policy_artifact_identity,
    runtime_registry_content_hash: input.runtime_registry.content_hash,
    receipt_log_content_hash: input.receipt_log.content_hash,
    receipt_log_head: input.receipt_log.head,
    receipt_member_hashes: input.receipt_log.member_hashes,
    dependency_receipt_pins: input.dependency_receipt_pins,
    as_of: input.as_of,
    memo_namespace: input.memo_namespace_binding,
  };

  return {
    ...payload,
    content_hash: hashCanonicalReceiptV0(canonicalizeForReceiptV0(payload)),
  };
}

function buildReceiptLog(
  receipts: readonly ReceiptV0[],
): ReactorExitBundleReceiptLogV0 {
  const sortedReceipts = [...receipts].sort(compareReceiptsForLog);
  const memberHashes = sortedReceipts
    .map((receipt) => receipt.content_hash)
    .sort((left, right) => left.localeCompare(right));
  const head =
    sortedReceipts.length === 0
      ? null
      : sortedReceipts[sortedReceipts.length - 1]?.content_hash ?? null;
  const payload = {
    schema: EXIT_BUNDLE_RECEIPT_LOG_SCHEMA,
    v: EXIT_BUNDLE_VERSION,
    head,
    member_hashes: memberHashes,
    entries: sortedReceipts,
  };

  return {
    ...payload,
    content_hash: hashCanonicalReceiptV0(canonicalizeForReceiptV0(payload)),
  };
}

function deriveSafeState(
  receipts: readonly ReceiptV0[],
): ReactorExitBundleSafeStateV0 {
  const latestReceipt = latestReceiptByAsOf(receipts);
  if (latestReceipt === undefined) {
    return {
      status: "ready",
      reasons: [],
      receipt_hash: null,
      as_of: null,
    };
  }

  if (latestReceipt.verdict.status === "blocked") {
    const blocked = latestReceipt.verdict.blocked;
    if (blocked === undefined) {
      throw new Error("latest blocked receipt is missing blocked details");
    }

    return {
      status: "blocked",
      reasons: [blocked.reason],
      receipt_hash: latestReceipt.content_hash,
      as_of: latestReceipt.core.as_of,
      reason: blocked.reason,
      fix_target: blocked.fix_target,
      interrupt_cause: blocked.interrupt_cause,
    };
  }

  if (
    latestReceipt.verdict.status !== "up" ||
    latestReceipt.verdict.confidence.calibration_grade === "none"
  ) {
    const reason = degradedReason(latestReceipt);

    return {
      status: "degraded",
      reasons: [reason],
      receipt_hash: latestReceipt.content_hash,
      as_of: latestReceipt.core.as_of,
      verdict_status: latestReceipt.verdict.status,
      calibration_grade: latestReceipt.verdict.confidence.calibration_grade,
      reason,
    };
  }

  return {
    status: "ready",
    reasons: [],
    receipt_hash: latestReceipt.content_hash,
    as_of: latestReceipt.core.as_of,
  };
}

function degradedReason(receipt: ReceiptV0): string {
  if (receipt.verdict.status !== "up") {
    return `latest receipt verdict is ${receipt.verdict.status}`;
  }

  return "latest receipt has no calibrated confidence";
}

function assertDependencyPinsCoverReceiptLog(
  receipts: readonly ReceiptV0[],
  dependencyReceiptPins: readonly ReactorExitBundleDependencyReceiptPinV0[],
): void {
  const pinned = new Set(
    dependencyReceiptPins.map((pin) =>
      canonicalizeForReceiptV0({
        upstream_content_hash: pin.upstream_content_hash,
        contract_revision: pin.contract_revision,
        acceptable_signer_set: pin.acceptable_signer_set,
      }),
    ),
  );

  for (const receipt of receipts) {
    const requiredPins = normalizeDependencyPins(
      receipt.composition.consumed_receipts,
      "receipt.composition.consumed_receipts",
    );
    for (const pin of requiredPins) {
      const key = canonicalizeForReceiptV0(pin);
      if (!pinned.has(key)) {
        throw new Error(
          `exit bundle.dependency_receipt_pins is missing consumed receipt ${pin.upstream_content_hash}`,
        );
      }
    }
  }
}

function assertReceiptLogNotAfterBundleAsOf(
  receipts: readonly ReceiptV0[],
  asOf: string,
): void {
  const latestReceipt = latestReceiptByAsOf(receipts);
  if (latestReceipt !== undefined && latestReceipt.core.as_of > asOf) {
    throw new Error("exit bundle.as_of must be at or after the latest receipt");
  }
}

function assertMemoNamespaceMatchesArtifact(
  memoNamespaceBinding: PolicyArtifactMemoNamespaceV0,
  activePolicyArtifact: ReactorExitBundleRegistrySnapshotV0,
): void {
  if (
    memoNamespaceBinding.policy_artifact_namespace !==
      activePolicyArtifact.namespace ||
    memoNamespaceBinding.policy_artifact_revision !==
      activePolicyArtifact.revision
  ) {
    throw new Error(
      "memo_namespace_binding must match active policy artifact namespace and revision",
    );
  }
}

function assertCanonicalEqual(left: unknown, right: unknown, path: string): void {
  const leftCanonical = canonicalizeForReceiptV0(left);
  const rightCanonical = canonicalizeForReceiptV0(right);

  if (leftCanonical !== rightCanonical) {
    throw new Error(`${path} does not match canonical exit-bundle content`);
  }
}

function latestReceiptByAsOf(
  receipts: readonly ReceiptV0[],
): ReceiptV0 | undefined {
  return [...receipts].sort(compareReceiptsForLog).at(-1);
}

function compareReceiptsForLog(left: ReceiptV0, right: ReceiptV0): number {
  const asOf = left.core.as_of.localeCompare(right.core.as_of);
  if (asOf !== 0) {
    return asOf;
  }

  return left.content_hash.localeCompare(right.content_hash);
}

function compareDependencyPins(
  left: ReactorExitBundleDependencyReceiptPinV0,
  right: ReactorExitBundleDependencyReceiptPinV0,
): number {
  const upstream = left.upstream_content_hash.localeCompare(
    right.upstream_content_hash,
  );
  if (upstream !== 0) {
    return upstream;
  }

  const contract = left.contract_revision.localeCompare(right.contract_revision);
  if (contract !== 0) {
    return contract;
  }

  return left.acceptable_signer_set
    .join("\0")
    .localeCompare(right.acceptable_signer_set.join("\0"));
}

function classifyVerificationFailure(
  message: string,
): ReactorExitBundleImportFailureCodeV0 {
  if (message.includes(".v") || message.includes("unsupported")) {
    return "unsupported-version";
  }
  if (message.includes("contract_revision")) {
    return "invalid-contract-revision";
  }
  if (message.includes("active_policy_artifact") || message.includes("policy_artifact")) {
    return "invalid-policy-artifact";
  }
  if (message.includes("runtime_registry")) {
    return "invalid-manifest";
  }
  if (message.includes("receipt_log") || message.includes("receipt v0")) {
    return "invalid-receipt-log";
  }
  if (message.includes("manifest")) {
    return "invalid-manifest";
  }
  if (message.includes("memo_namespace_binding") || message.includes("memo_namespace")) {
    return "memo-namespace-mismatch";
  }
  if (message.includes("safe_state")) {
    return "unsafe-state-mismatch";
  }
  if (message.includes("dependency_receipt_pins")) {
    return "invalid-dependency-pins";
  }

  return "malformed-bundle";
}

function coerceFailureCode(
  code: string | undefined,
): ReactorExitBundleImportFailureCodeV0 {
  if (code === undefined) {
    return "malformed-bundle";
  }

  if (
    code === "malformed-bundle" ||
    code === "unsupported-version" ||
    code === "invalid-contract-revision" ||
    code === "invalid-policy-artifact" ||
    code === "invalid-receipt-log" ||
    code === "invalid-manifest" ||
    code === "memo-namespace-mismatch" ||
    code === "unsafe-state-mismatch" ||
    code === "invalid-dependency-pins"
  ) {
    return code;
  }

  return classifyVerificationFailure(code);
}

function normalizeFailureInputErrors(
  input: ReactorExitBundleFailureInputV0,
): readonly string[] {
  if (input.errors !== undefined && input.errors.length > 0) {
    return [...input.errors];
  }
  if (input.message !== undefined && input.message.length > 0) {
    return [input.message];
  }
  if (input.code !== undefined && input.code.length > 0) {
    return [input.code];
  }

  return ["exit bundle import failed safe"];
}

function expectPlainRecord(
  value: unknown,
  path: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${path} must be a plain object`);
  }

  return value as Readonly<Record<string, unknown>>;
}

function expectExactKeys(
  value: Readonly<Record<string, unknown>>,
  path: string,
  allowedKeys: readonly string[],
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${path}.${key} is not pinned in exit-bundle v0`);
    }
  }
}

function expectLiteral(value: unknown, expected: unknown, path: string): void {
  if (value !== expected) {
    throw new Error(`${path} must be ${JSON.stringify(expected)}`);
  }
}

function expectNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }

  return value;
}

function expectEnumString(
  value: unknown,
  allowed: ReadonlySet<string>,
  path: string,
): string {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${path} must be one of ${Array.from(allowed).join(", ")}`);
  }

  return value;
}

function expectContentHashString(value: unknown, path: string): ContentHashV0 {
  if (typeof value !== "string" || !CONTENT_HASH_PATTERN.test(value)) {
    throw new Error(`${path} must use sha256:<64 lowercase hex>`);
  }

  return value as ContentHashV0;
}

function expectNullableContentHash(
  value: unknown,
  path: string,
): ContentHashV0 | null {
  if (value === null) {
    return null;
  }

  return expectContentHashString(value, path);
}

function expectContentHashArray(
  value: unknown,
  path: string,
): readonly ContentHashV0[] {
  const items = expectArray(value, path).map((item, index) =>
    expectContentHashString(item, `${path}[${index}]`),
  );
  const sorted = [...items].sort((left, right) => left.localeCompare(right));
  const seen = new Set<string>();
  for (const item of sorted) {
    if (seen.has(item)) {
      throw new Error(`${path} must not contain duplicate content hash ${item}`);
    }
    seen.add(item);
  }

  return items;
}

function expectIsoInstantString(value: unknown, path: string): string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) {
    throw new Error(`${path} must be a replayable ISO instant`);
  }

  return value;
}

function expectNullableIsoInstant(value: unknown, path: string): string | null {
  if (value === null) {
    return null;
  }

  return expectIsoInstantString(value, path);
}

function expectStringArray(value: unknown, path: string): readonly string[] {
  const items = expectArray(value, path);
  for (const [index, item] of items.entries()) {
    if (typeof item !== "string") {
      throw new Error(`${path}[${index}] must be a string`);
    }
  }

  return items as readonly string[];
}

function expectNonEmptyStringArray(
  value: unknown,
  path: string,
): readonly string[] {
  const items = expectStringArray(value, path);
  if (items.length === 0) {
    throw new Error(`${path} must not be empty`);
  }

  for (const [index, item] of items.entries()) {
    if (item.length === 0) {
      throw new Error(`${path}[${index}] must be non-empty`);
    }
  }

  return items;
}

function expectArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  return value;
}
