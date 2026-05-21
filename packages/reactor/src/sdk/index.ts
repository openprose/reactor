import { createRuntimeReactorV0 } from "../reactor";
import {
  createNullSignerReceiptSignatureV0,
  type ContentHashV0,
  type NullReceiptSignatureV0,
  type ReceiptRecheckKindV0,
  type ReceiptV0,
} from "../receipt";
import type {
  PolicyRecompileDecisionV0,
  PolicyRecompileExecutionV0,
  PolicyRollbackDecisionV0,
  PolicyTransitiveFreshnessFunctionV0,
} from "../policy";
import {
  buildReactorExitBundleV0,
  createReactorExitBundleFailureV0,
  type ReactorExitBundleFailureV0,
  type ReactorExitBundleRegistrySnapshotV0,
  type ReactorExitBundleSafeStateV0,
  type ReactorExitBundleV0,
  verifyReactorExitBundleV0,
} from "./exit-bundle";

export * from "./exit-bundle";

export interface ReactorClockAdapterV0 {
  readonly now: () => string;
}

export interface ReactorStorageAdapterV0 {
  readonly appendReceipt: (receipt: ReceiptV0) => void;
  readonly listReceipts: () => readonly ReceiptV0[];
  readonly readRegistry: () => ReactorRegistrySnapshotV0;
  readonly writeRegistry?: (registry: ReactorRegistrySnapshotV0) => void;
}

export interface ReactorModelGatewayAdapterV0 {
  readonly invoke: (request: ReactorModelGatewayRequestV0) => ReactorModelGatewayResponseV0;
}

export interface ReactorAgentSdkAdapterV0 {
  readonly launch: (request: ReactorAgentRequestV0) => ReactorAgentResponseV0;
}

export interface ReactorSandboxAdapterV0 {
  readonly run: (request: ReactorSandboxRequestV0) => ReactorSandboxResponseV0;
}

export type ReactorSignerAdapterV0 = NullReceiptSignatureV0;

export interface ReactorConnectorAdapterV0 {
  readonly read: (request: ReactorConnectorRequestV0) => ReactorConnectorResponseV0;
}

export interface ReactorEventSinkAdapterV0 {
  readonly emit: (event: ReactorSdkEventV0) => void;
}

export interface ReactorAdaptersV0 {
  readonly clock: ReactorClockAdapterV0;
  readonly storage: ReactorStorageAdapterV0;
  readonly modelGateway: ReactorModelGatewayAdapterV0;
  readonly agentSdk: ReactorAgentSdkAdapterV0;
  readonly sandbox: ReactorSandboxAdapterV0;
  readonly signer?: ReactorSignerAdapterV0;
  readonly connectors: ReactorConnectorAdapterV0;
  readonly eventSink: ReactorEventSinkAdapterV0;
}

export interface ReactorRegistrySnapshotV0 {
  readonly [key: string]: unknown;
  readonly contract_revision?: ContentHashV0;
  readonly policy_artifact_id?: string;
  readonly policy_artifact_identity?: string;
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
  readonly policy_artifact_validation_state?: ReactorExitBundleRegistrySnapshotV0["validation_state"];
  readonly validation_state?: ReactorExitBundleRegistrySnapshotV0["validation_state"];
  readonly policy_artifact_bytes?: string;
  readonly policy_artifact_content_hash?: ContentHashV0;
  readonly compiled_evidence_plan?: unknown;
  readonly forecast_schedule?: unknown;
  readonly contract_summary?: unknown;
  readonly last_policy_revalidated_at?: string;
  readonly last_recompile_at?: string;
  readonly last_policy_recompile_at?: string;
  readonly last_unforced_deep_at?: string;
  readonly policy_rollback?: ReactorPolicyRollbackMetadataV0;
  readonly transitive_freshness_function?: PolicyTransitiveFreshnessFunctionV0;
}

export interface ReactorPolicyRollbackMetadataV0 {
  readonly schema: "openprose.reactor.policy-rollback.metadata";
  readonly v: 0;
  readonly fresh_policy_revision: string;
  readonly fresh_policy_installed_at: string;
  readonly last_known_good: {
    readonly policy_artifact_revision: string;
    readonly judged_activations_before_trip: number;
    readonly registry: ReactorRegistrySnapshotV0;
  };
}

export interface ReactorModelGatewayRequestV0 {
  readonly kind: "judge" | "policy-compile" | "spike";
  readonly payload: unknown;
}

export interface ReactorModelGatewayResponseV0 {
  readonly payload: unknown;
  readonly usage?: ReactorModelGatewayUsageV0;
}

export interface ReactorModelGatewayUsageV0 {
  readonly provider: string;
  readonly model: string;
  readonly tokens: {
    readonly fresh: number;
    readonly reused: number;
  };
  readonly provider_norm?: {
    readonly schema: string;
    readonly [key: string]: unknown;
  };
}

export interface ReactorAgentRequestV0 {
  readonly kind: "bounded-activation" | "policy-author";
  readonly payload: unknown;
}

export interface ReactorAgentResponseV0 {
  readonly payload: unknown;
}

export interface ReactorSandboxRequestV0 {
  readonly command: string;
  readonly args: readonly string[];
}

export interface ReactorSandboxResponseV0 {
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ReactorConnectorRequestV0 {
  readonly source_id: string;
  readonly as_of: string;
}

export interface ReactorConnectorResponseV0 {
  readonly payload: unknown;
  readonly content_hash?: ContentHashV0;
  readonly payload_hash?: ContentHashV0;
  readonly receipt?: ReceiptV0;
}

export interface ReactorSdkEventV0 {
  readonly type: "ingest";
  readonly responsibility_id: string;
  readonly as_of: string;
  readonly payload: unknown;
}

export interface ReactorCreateInputV0 {
  readonly responsibility_id: string;
  readonly adapters: ReactorAdaptersV0;
}

export interface ReactorIngestResultV0 {
  readonly accepted: boolean;
  readonly responsibility_id: string;
  readonly as_of: string;
  readonly receipt_hash?: ContentHashV0;
  readonly outcome?:
    | "fresh-judge-receipt"
    | "memo-hit-receipt"
    | "forecast-recheck-receipt"
    | "blocked-escalation-receipt"
    | "failed-before-write";
  readonly next_due_at?: string;
  readonly due_rechecks?: readonly ReceiptRecheckKindV0[];
  readonly errors?: readonly string[];
}

export interface ReactorTickResultV0 {
  readonly accepted: boolean;
  readonly responsibility_id: string;
  readonly as_of: string;
  readonly outcome:
    | "no-work"
    | "rechecks-completed"
    | "failed-before-write"
    | "policy-recompile-failed"
    | "policy-rollback-failed";
  readonly receipts_appended: number;
  readonly receipt_hashes: readonly ContentHashV0[];
  readonly next_due_at?: string;
  readonly due_rechecks?: readonly ReceiptRecheckKindV0[];
  readonly recheck_results?: readonly ReactorIngestResultV0[];
  readonly policy_recompile?: ReactorPolicyRecompileTickResultV0;
  readonly policy_rollback?: ReactorPolicyRollbackTickResultV0;
  readonly errors?: readonly string[];
}

export interface ReactorPolicyRecompileTickResultV0 {
  readonly policy_artifact_revision_before: string;
  readonly policy_artifact_revision_after?: string;
  readonly compiled_evidence_plan_strategy?: "carried-forward";
  readonly decision: PolicyRecompileDecisionV0;
  readonly execution?: PolicyRecompileExecutionV0;
}

export interface ReactorPolicyRollbackTickResultV0 {
  readonly policy_artifact_revision_before: string;
  readonly policy_artifact_revision_after?: string;
  readonly fresh_policy_installed_at: string;
  readonly fresh_policy_judged_activations_before_trip: number;
  readonly last_known_good_judged_activations_before_trip: number;
  readonly receipt_hash?: ContentHashV0;
  readonly decision: PolicyRollbackDecisionV0;
  readonly self_trip: PolicyRecompileDecisionV0;
}

export type ReactorExportResultV0 =
  | ReactorExitBundleV0
  | ReactorExitBundleFailureV0;

export interface ReactorMemoNamespaceBindingV0 {
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
}

export type ReactorImportExitBundleInputV0 =
  | {
      readonly adapters: ReactorAdaptersV0;
      readonly bundle: unknown;
    }
  | {
      readonly reactor: Pick<ReactorSdkV0, "adapters">;
      readonly bundle: unknown;
    };

export type ReactorImportExitBundleResultV0 =
  | ReactorImportExitBundleSuccessV0
  | ReactorExitBundleFailureV0;

export interface ReactorImportExitBundleSuccessV0 {
  readonly ok: true;
  readonly imported: true;
  readonly as_of: string;
  readonly receipts_appended: number;
  readonly memo_namespace: ReactorMemoNamespaceBindingV0;
  readonly safe_state: ReactorExitBundleSafeStateV0;
}

export interface ReactorSdkV0 {
  readonly adapters: ReactorAdaptersV0;
  readonly ingest: (event: unknown) => ReactorIngestResultV0;
  readonly tick: (as_of?: string) => ReactorTickResultV0;
  readonly receipts: () => readonly ReceiptV0[];
  readonly registry: () => ReactorRegistrySnapshotV0;
  readonly export: () => ReactorExportResultV0;
}

export function createNullSignerAdapterV0(): ReactorSignerAdapterV0 {
  return createNullSignerReceiptSignatureV0();
}

export function createReactor(input: ReactorCreateInputV0): ReactorSdkV0 {
  if (input.responsibility_id.length === 0) {
    throw new Error("responsibility_id must be non-empty");
  }

  assertAdapters(input.adapters);
  const adapters = normalizeAdapters(input.adapters);
  const runtime = createRuntimeReactorV0({ ...input, adapters });

  return {
    adapters,
    ingest: runtime.ingest,
    tick: runtime.tick,
    receipts(): readonly ReceiptV0[] {
      return runtime.receipts();
    },
    registry(): ReactorRegistrySnapshotV0 {
      return runtime.registry();
    },
    export(): ReactorExportResultV0 {
      const asOf = adapters.clock.now();
      const receipts = adapters.storage.listReceipts();
      const registry = adapters.storage.readRegistry();
      const exportableRegistry = readExportableRegistry(registry);

      if (!exportableRegistry.ok) {
        return exportableRegistry.failure;
      }

      try {
        return buildReactorExitBundleV0({
          contract_revision: exportableRegistry.registry.contract_revision,
          active_policy_artifact: {
            id: exportableRegistry.registry.policy_artifact_id,
            identity: exportableRegistry.registry.policy_artifact_identity,
            namespace: exportableRegistry.registry.policy_artifact_namespace,
            revision: exportableRegistry.registry.policy_artifact_revision,
            validation_state:
              exportableRegistry.registry.policy_artifact_validation_state,
            ...(exportableRegistry.registry.policy_artifact_bytes === undefined
              ? {}
              : { bytes: exportableRegistry.registry.policy_artifact_bytes }),
            ...(exportableRegistry.registry.policy_artifact_content_hash === undefined
              ? {}
              : {
                  content_hash:
                    exportableRegistry.registry.policy_artifact_content_hash,
                }),
          },
          receipts,
          dependency_receipt_pins: collectDependencyReceiptPins(receipts),
          runtime_registry: {
            contract_revision: exportableRegistry.registry.contract_revision,
            policy_artifact_id: exportableRegistry.registry.policy_artifact_id,
            policy_artifact_identity:
              exportableRegistry.registry.policy_artifact_identity,
            policy_artifact_namespace:
              exportableRegistry.registry.policy_artifact_namespace,
            policy_artifact_revision:
              exportableRegistry.registry.policy_artifact_revision,
            policy_artifact_validation_state:
              exportableRegistry.registry.policy_artifact_validation_state,
            ...(exportableRegistry.registry.validation_state === undefined
              ? {}
              : { validation_state: exportableRegistry.registry.validation_state }),
            ...(exportableRegistry.registry.policy_artifact_bytes === undefined
              ? {}
              : {
                  policy_artifact_bytes:
                    exportableRegistry.registry.policy_artifact_bytes,
                }),
            ...(exportableRegistry.registry.policy_artifact_content_hash === undefined
              ? {}
              : {
                  policy_artifact_content_hash:
                    exportableRegistry.registry.policy_artifact_content_hash,
                }),
            ...(exportableRegistry.registry.transitive_freshness_function === undefined
              ? {}
              : {
                  transitive_freshness_function:
                    exportableRegistry.registry.transitive_freshness_function,
                }),
            ...(exportableRegistry.registry.compiled_evidence_plan === undefined
              ? {}
              : {
                  compiled_evidence_plan:
                    exportableRegistry.registry.compiled_evidence_plan,
                }),
            ...(exportableRegistry.registry.forecast_schedule === undefined
              ? {}
              : {
                  forecast_schedule:
                    exportableRegistry.registry.forecast_schedule,
                }),
          },
          memo_namespace_binding: {
            policy_artifact_namespace:
              exportableRegistry.registry.policy_artifact_namespace,
            policy_artifact_revision:
              exportableRegistry.registry.policy_artifact_revision,
          },
          as_of: asOf,
        });
      } catch (error) {
        return createReactorExitBundleFailureV0("malformed-bundle", [
          error instanceof Error ? error.message : "exit bundle build failed",
        ]);
      }
    },
  };
}

export function importReactorExitBundleV0(
  input: ReactorImportExitBundleInputV0,
): ReactorImportExitBundleResultV0 {
  const rawAdapters = readImportAdapters(input);
  assertAdapters(rawAdapters);
  const adapters = normalizeAdapters(rawAdapters);

  const verification = verifyReactorExitBundleV0(input.bundle);
  if (!verification.ok) {
    return verification;
  }

  const bundle = verification.bundle;
  const asOf = adapters.clock.now();
  const registry = adapters.storage.readRegistry();
  const compatibility = verifyLocalImportCompatibility(registry, bundle);
  if (!compatibility.ok) {
    return compatibility.failure;
  }

  const writeRegistry = adapters.storage.writeRegistry;
  if (typeof writeRegistry !== "function") {
    return createReactorExitBundleFailureV0("invalid-policy-artifact", [
      "storage.writeRegistry adapter is required before importing receipts",
    ]);
  }

  try {
    writeRegistry(hydrateRegistryFromExitBundle(bundle));
  } catch (error) {
    return createReactorExitBundleFailureV0("invalid-policy-artifact", [
      error instanceof Error ? error.message : "registry hydration failed",
    ]);
  }

  for (const receipt of bundle.receipt_log.entries) {
    adapters.storage.appendReceipt(receipt);
  }

  return {
    ok: true,
    imported: true,
    as_of: asOf,
    receipts_appended: bundle.receipt_log.entries.length,
    memo_namespace: bundle.memo_namespace,
    safe_state: bundle.safe_state,
  };
}

function assertAdapters(adapters: ReactorAdaptersV0): void {
  assertFunction(adapters.clock?.now, "clock.now");
  assertFunction(adapters.storage?.appendReceipt, "storage.appendReceipt");
  assertFunction(adapters.storage?.listReceipts, "storage.listReceipts");
  assertFunction(adapters.storage?.readRegistry, "storage.readRegistry");
  assertFunction(adapters.modelGateway?.invoke, "modelGateway.invoke");
  assertFunction(adapters.agentSdk?.launch, "agentSdk.launch");
  assertFunction(adapters.sandbox?.run, "sandbox.run");
  const signer = adapters.signer;
  if (signer !== undefined) {
    assertNullSignerAdapter(signer);
  }
  assertFunction(adapters.connectors?.read, "connectors.read");
  assertFunction(adapters.eventSink?.emit, "eventSink.emit");
}

function normalizeAdapters(adapters: ReactorAdaptersV0): ReactorAdaptersV0 {
  return {
    ...adapters,
    signer: adapters.signer ?? createNullSignerAdapterV0(),
  };
}

function assertNullSignerAdapter(value: unknown): asserts value is ReactorSignerAdapterV0 {
  if (!isRecord(value)) {
    throw new Error("signer adapter must be the null signer state in receipt v0.1");
  }

  const keys = Object.keys(value).sort();
  const expectedKeys = ["null_reason", "scheme"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(
      "signer adapter support is honestly deferred in receipt v0.1; only {scheme:\"none\", null_reason:\"no-signer-adapter-configured\"} is supported",
    );
  }

  if (
    value["scheme"] !== "none" ||
    value["null_reason"] !== "no-signer-adapter-configured"
  ) {
    throw new Error(
      "signer adapter support is honestly deferred in receipt v0.1; only {scheme:\"none\", null_reason:\"no-signer-adapter-configured\"} is supported",
    );
  }
}

function assertFunction(value: unknown, name: string): asserts value is (...args: never[]) => unknown {
  if (typeof value !== "function") {
    throw new Error(`${name} adapter is required`);
  }
}

function readImportAdapters(input: ReactorImportExitBundleInputV0): ReactorAdaptersV0 {
  return "adapters" in input ? input.adapters : input.reactor.adapters;
}

interface ExportableRegistryV0 {
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact_id: string;
  readonly policy_artifact_identity: string;
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
  readonly policy_artifact_validation_state: ReactorExitBundleRegistrySnapshotV0["validation_state"];
  readonly validation_state?: ReactorExitBundleRegistrySnapshotV0["validation_state"];
  readonly policy_artifact_bytes?: string;
  readonly policy_artifact_content_hash?: ContentHashV0;
  readonly transitive_freshness_function?: PolicyTransitiveFreshnessFunctionV0;
  readonly compiled_evidence_plan?: unknown;
  readonly forecast_schedule?: unknown;
}

type ReadExportableRegistryResultV0 =
  | {
      readonly ok: true;
      readonly registry: ExportableRegistryV0;
    }
  | {
      readonly ok: false;
      readonly failure: ReactorExitBundleFailureV0;
    };

type ImportCompatibilityResultV0 =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly failure: ReactorExitBundleFailureV0;
    };

function verifyLocalImportCompatibility(
  registry: ReactorRegistrySnapshotV0,
  bundle: ReactorExitBundleV0,
): ImportCompatibilityResultV0 {
  if (!registryHasActivePolicy(registry)) {
    return { ok: true };
  }

  if (
    registry.contract_revision !== undefined &&
    registry.contract_revision !== bundle.contract_revision
  ) {
    return {
      ok: false,
      failure: createReactorExitBundleFailureV0("invalid-contract-revision", [
        `local registry ${registry.contract_revision} does not match bundle ${bundle.contract_revision}`,
      ]),
    };
  }

  if (
    registry.policy_artifact_namespace !==
      bundle.memo_namespace.policy_artifact_namespace ||
    registry.policy_artifact_revision !==
      bundle.memo_namespace.policy_artifact_revision
  ) {
    return {
      ok: false,
      failure: createReactorExitBundleFailureV0("memo-namespace-mismatch", [
        `local registry ${registry.policy_artifact_namespace}@${registry.policy_artifact_revision} does not match bundle ${bundle.memo_namespace.policy_artifact_namespace}@${bundle.memo_namespace.policy_artifact_revision}`,
      ]),
    };
  }

  if (
    registry.policy_artifact_identity !== undefined &&
    registry.policy_artifact_identity !== bundle.policy_artifact.identity
  ) {
    return {
      ok: false,
      failure: createReactorExitBundleFailureV0("invalid-policy-artifact", [
        `local policy artifact ${registry.policy_artifact_identity} does not match bundle ${bundle.policy_artifact.identity}`,
      ]),
    };
  }

  if (
    registry.policy_artifact_content_hash !== undefined &&
    bundle.policy_artifact.content_hash !== undefined &&
    registry.policy_artifact_content_hash !== bundle.policy_artifact.content_hash
  ) {
    return {
      ok: false,
      failure: createReactorExitBundleFailureV0("invalid-policy-artifact", [
        `local policy artifact hash ${registry.policy_artifact_content_hash} does not match bundle ${bundle.policy_artifact.content_hash}`,
      ]),
    };
  }

  return { ok: true };
}

function registryHasActivePolicy(registry: ReactorRegistrySnapshotV0): boolean {
  const hasMaterialPolicyState =
    registry.contract_revision !== undefined ||
    registry.policy_artifact_id !== undefined ||
    registry.policy_artifact_identity !== undefined ||
    registry.policy_artifact_validation_state !== undefined ||
    registry.validation_state !== undefined ||
    registry.policy_artifact_bytes !== undefined ||
    registry.policy_artifact_content_hash !== undefined ||
    registry.compiled_evidence_plan !== undefined ||
    registry.forecast_schedule !== undefined;

  if (hasMaterialPolicyState) {
    return true;
  }

  return !(
    registry.policy_artifact_namespace === "policy.uninitialized" &&
    registry.policy_artifact_revision === "0"
  );
}

function hydrateRegistryFromExitBundle(
  bundle: ReactorExitBundleV0,
): ReactorRegistrySnapshotV0 {
  const registry = bundle.runtime_registry;

  return {
    contract_revision: bundle.contract_revision,
    policy_artifact_id: registry.policy_artifact_id,
    policy_artifact_identity: registry.policy_artifact_identity,
    policy_artifact_namespace: registry.policy_artifact_namespace,
    policy_artifact_revision: registry.policy_artifact_revision,
    policy_artifact_validation_state: registry.policy_artifact_validation_state,
    ...(registry.validation_state === undefined
      ? {}
      : { validation_state: registry.validation_state }),
    ...(registry.policy_artifact_bytes === undefined
      ? {}
      : { policy_artifact_bytes: registry.policy_artifact_bytes }),
    ...(registry.policy_artifact_content_hash === undefined
      ? {}
      : {
          policy_artifact_content_hash: registry.policy_artifact_content_hash,
        }),
    ...(registry.transitive_freshness_function === undefined
      ? {}
      : {
          transitive_freshness_function:
            registry.transitive_freshness_function,
        }),
    ...(registry.compiled_evidence_plan === undefined
      ? {}
      : { compiled_evidence_plan: registry.compiled_evidence_plan }),
    ...(registry.forecast_schedule === undefined
      ? {}
      : { forecast_schedule: registry.forecast_schedule }),
  };
}

function readExportableRegistry(
  registry: ReactorRegistrySnapshotV0,
): ReadExportableRegistryResultV0 {
  const errors: string[] = [];
  const contractRevision = registry.contract_revision;
  const policyArtifactId =
    registry.policy_artifact_id ?? registry.policy_artifact_identity;
  const policyArtifactIdentity =
    registry.policy_artifact_identity ?? registry.policy_artifact_id;
  const validationState =
    registry.policy_artifact_validation_state ?? registry.validation_state;
  const validationStateAlias = registry.validation_state;
  const artifactContentHash = registry.policy_artifact_content_hash;

  if (!isContentHash(contractRevision)) {
    errors.push("registry.contract_revision must be a sha256 content address");
  }
  if (typeof policyArtifactId !== "string" || policyArtifactId.length === 0) {
    errors.push("registry.policy_artifact_id must be non-empty");
  }
  if (
    typeof policyArtifactIdentity !== "string" ||
    policyArtifactIdentity.length === 0
  ) {
    errors.push("registry.policy_artifact_identity must be non-empty");
  }
  if (registry.policy_artifact_namespace.length === 0) {
    errors.push("registry.policy_artifact_namespace must be non-empty");
  }
  if (registry.policy_artifact_revision.length === 0) {
    errors.push("registry.policy_artifact_revision must be non-empty");
  }
  if (!isPolicyArtifactValidationState(validationState)) {
    errors.push("registry.policy_artifact_validation_state must be present");
  }
  if (
    validationStateAlias !== undefined &&
    !isPolicyArtifactValidationState(validationStateAlias)
  ) {
    errors.push("registry.validation_state must be a valid policy artifact validation state");
  }
  if (
    registry.policy_artifact_bytes === undefined &&
    !isContentHash(artifactContentHash)
  ) {
    errors.push(
      "registry must include policy_artifact_bytes or policy_artifact_content_hash",
    );
  }
  if (
    artifactContentHash !== undefined &&
    !isContentHash(artifactContentHash)
  ) {
    errors.push("registry.policy_artifact_content_hash must be a sha256 content address");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      failure: createReactorExitBundleFailureV0("malformed-bundle", errors),
    };
  }

  return {
    ok: true,
    registry: {
      contract_revision: contractRevision as ContentHashV0,
      policy_artifact_id: policyArtifactId as string,
      policy_artifact_identity: policyArtifactIdentity as string,
      policy_artifact_namespace: registry.policy_artifact_namespace,
      policy_artifact_revision: registry.policy_artifact_revision,
      policy_artifact_validation_state:
        validationState as ReactorExitBundleRegistrySnapshotV0["validation_state"],
      ...(validationStateAlias === undefined
        ? {}
        : {
            validation_state:
              validationStateAlias as ReactorExitBundleRegistrySnapshotV0["validation_state"],
          }),
      ...(registry.policy_artifact_bytes === undefined
        ? {}
        : { policy_artifact_bytes: registry.policy_artifact_bytes }),
      ...(artifactContentHash === undefined
        ? {}
        : {
            policy_artifact_content_hash: artifactContentHash,
          }),
      ...(registry.transitive_freshness_function === undefined
        ? {}
        : {
            transitive_freshness_function:
              registry.transitive_freshness_function,
          }),
      ...(registry.compiled_evidence_plan === undefined
        ? {}
        : { compiled_evidence_plan: registry.compiled_evidence_plan }),
      ...(registry.forecast_schedule === undefined
        ? {}
        : { forecast_schedule: registry.forecast_schedule }),
    },
  };
}

function collectDependencyReceiptPins(
  receipts: readonly ReceiptV0[],
): readonly {
  readonly upstream_content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly acceptable_signer_set: readonly string[];
}[] {
  const pins = new Map<string, {
    readonly upstream_content_hash: ContentHashV0;
    readonly contract_revision: ContentHashV0;
    readonly acceptable_signer_set: readonly string[];
  }>();

  for (const receipt of receipts) {
    for (const pin of receipt.composition.consumed_receipts) {
      const acceptableSignerSet = [...pin.acceptable_signer_set].sort();
      const key = [
        pin.upstream_content_hash,
        pin.contract_revision,
        acceptableSignerSet.join("\0"),
      ].join("\0");
      pins.set(key, {
        upstream_content_hash: pin.upstream_content_hash,
        contract_revision: pin.contract_revision,
        acceptable_signer_set: acceptableSignerSet,
      });
    }
  }

  return [...pins.values()].sort((left, right) =>
    left.upstream_content_hash.localeCompare(right.upstream_content_hash),
  );
}

function isPolicyArtifactValidationState(
  value: unknown,
): value is ReactorExitBundleRegistrySnapshotV0["validation_state"] {
  if (value === "validated" || value === "degraded" || value === "blocked") {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return (
    value["status"] === "validated" ||
    value["status"] === "degraded" ||
    value["status"] === "blocked"
  );
}

function isContentHash(value: unknown): value is ContentHashV0 {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
