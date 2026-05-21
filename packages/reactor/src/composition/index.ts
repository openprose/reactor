import {
  type DependencyReceiptMemoRefV0,
  type MemoLookupResultV0,
  type PolicyArtifactMemoNamespaceV0,
  computeMemoKeyV0,
  createMemoHitReceiptV0,
} from "../memo";
import {
  normalizePolicyTransitiveFreshnessFunctionV0,
  type PolicyTransitiveFreshnessFunctionV0,
} from "../policy";
import {
  type ConsumedFreshnessEvaluationV0,
  type ConsumedReceiptPinV0,
  type ContentHashV0,
  type ReceiptFreshnessV0,
  type ReceiptEventCauseV0,
  type ReceiptRecheckKindV0,
  type ReceiptV0,
  canonicalizeForReceiptV0,
  verifyReceiptV0,
} from "../receipt";

export interface UpstreamReceiptDependencyPinInputV0 {
  readonly upstream_receipt: unknown;
  readonly acceptable_signer_set: readonly string[];
}

export interface UpstreamReceiptDependencyPinVerificationInputV0 {
  readonly upstream_receipt: unknown;
  readonly expected_dependency_pin: unknown;
}

export interface VerifiedUpstreamReceiptDependencyPinV0 {
  readonly receipt: ReceiptV0;
  readonly content_hash: ContentHashV0;
  readonly dependency_pin: ConsumedReceiptPinV0;
  readonly signer_posture: string;
}

export type TransitiveFreshnessOutcomeV0 = "fresh" | "stale-blocked";

export interface TransitiveFreshnessConsumedReceiptInputV0 {
  readonly upstream_receipt: unknown;
  readonly dependency_pin: unknown;
  readonly refetched_from_receipt?: unknown;
  readonly refetched_from_dependency_pin?: unknown;
}

export interface TransitiveFreshnessEvaluationInputV0 {
  readonly as_of: string;
  readonly transitive_freshness_policy_ref: string;
  readonly transitive_freshness_function?: PolicyTransitiveFreshnessFunctionV0;
  readonly consumed_receipts: readonly TransitiveFreshnessConsumedReceiptInputV0[];
}

export interface TransitiveFreshnessEvaluationResultV0 {
  readonly outcome: TransitiveFreshnessOutcomeV0;
  readonly as_of: string;
  readonly transitive_freshness_policy_ref: string;
  readonly consumed_freshness_evaluated: readonly ConsumedFreshnessEvaluationV0[];
  readonly stale_receipt_hashes: readonly ContentHashV0[];
}

export interface ComposedReceiptFreshnessInputV0
  extends TransitiveFreshnessEvaluationInputV0 {
  readonly next_forecast_recheck: string;
}

export interface DownstreamComposedMemoKeyInputV0 {
  readonly contract_revision: ContentHashV0;
  readonly evidence_receipts: readonly ContentHashV0[];
  readonly dependency_receipts: readonly ConsumedReceiptPinV0[];
}

export interface CompositionMemoStoreV0 {
  readonly lookup: (
    namespace: PolicyArtifactMemoNamespaceV0,
    memoKey: ContentHashV0,
  ) => MemoLookupResultV0;
}

export interface CompositionPropagationPlanInputV0
  extends DownstreamComposedMemoKeyInputV0 {
  readonly memo_namespace: PolicyArtifactMemoNamespaceV0;
  readonly memo_store: CompositionMemoStoreV0;
  readonly as_of: string;
  readonly next_forecast_recheck: string;
  readonly event_cause?: ReceiptEventCauseV0;
  readonly recheck_kind?: ReceiptRecheckKindV0;
}

export type CompositionPropagationPlanV0 =
  | {
      readonly outcome: "rejudge-required";
      readonly memo_key: ContentHashV0;
      readonly memo_lookup: Extract<MemoLookupResultV0, { outcome: "miss" }>;
      readonly dependency_receipts: readonly ConsumedReceiptPinV0[];
    }
  | {
      readonly outcome: "stop-memo-hit";
      readonly memo_key: ContentHashV0;
      readonly memo_lookup: Extract<MemoLookupResultV0, { outcome: "hit" }>;
      readonly memo_hit_receipt: ReceiptV0;
      readonly dependency_receipts: readonly ConsumedReceiptPinV0[];
    };

export function dependencyReceiptPinFromVerifiedReceiptV0(
  input: UpstreamReceiptDependencyPinInputV0,
): ConsumedReceiptPinV0 {
  const verification = verifyReceiptV0(input.upstream_receipt);
  if (!verification.ok) {
    throw new Error("upstream receipt must verify before composition");
  }

  const upstreamReceipt = input.upstream_receipt as ReceiptV0;
  const acceptableSignerSet = normalizeAcceptableSignerSetV0(
    input.acceptable_signer_set,
    "acceptable_signer_set",
  );
  const signerPosture = signerPostureForVerifiedReceiptV0(upstreamReceipt);
  if (!acceptableSignerSet.includes(signerPosture)) {
    throw new Error("upstream receipt signer posture is not allowed by dependency pin");
  }

  return {
    upstream_content_hash: verification.content_hash,
    contract_revision: upstreamReceipt.core.contract_revision,
    acceptable_signer_set: acceptableSignerSet,
  };
}

export function verifyUpstreamReceiptDependencyPinV0(
  input: UpstreamReceiptDependencyPinVerificationInputV0,
): VerifiedUpstreamReceiptDependencyPinV0 {
  const verification = verifyReceiptV0(input.upstream_receipt);
  if (!verification.ok) {
    throw new Error("upstream receipt must verify before dependency pin check");
  }

  const upstreamReceipt = input.upstream_receipt as ReceiptV0;
  const dependencyPin = normalizeDependencyReceiptPinV0(
    input.expected_dependency_pin,
    "expected_dependency_pin",
  );

  if (verification.content_hash !== dependencyPin.upstream_content_hash) {
    throw new Error("upstream receipt content hash must match dependency pin");
  }
  if (upstreamReceipt.core.contract_revision !== dependencyPin.contract_revision) {
    throw new Error("upstream receipt contract revision must match dependency pin");
  }

  const signerPosture = signerPostureForVerifiedReceiptV0(upstreamReceipt);
  if (!dependencyPin.acceptable_signer_set.includes(signerPosture)) {
    throw new Error("upstream receipt signer posture is not allowed by dependency pin");
  }

  return {
    receipt: upstreamReceipt,
    content_hash: verification.content_hash,
    dependency_pin: dependencyPin,
    signer_posture: signerPosture,
  };
}

export function evaluateTransitiveFreshnessV0(
  input: TransitiveFreshnessEvaluationInputV0,
): TransitiveFreshnessEvaluationResultV0 {
  const asOfMs = parseReplayableInstantMsV0(input.as_of, "as_of");
  assertNonEmptyStringV0(
    input.transitive_freshness_policy_ref,
    "transitive_freshness_policy_ref",
  );
  const transitiveFreshnessFunction = normalizePolicyTransitiveFreshnessFunctionV0(
    input.transitive_freshness_function,
  );
  if (!Array.isArray(input.consumed_receipts)) {
    throw new Error("consumed_receipts must be an array");
  }

  const staleReceiptHashes: ContentHashV0[] = [];
  const consumedFreshnessEvaluated = input.consumed_receipts.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`consumed_receipts[${index}] must be an object`);
    }

    const verified = verifyUpstreamReceiptDependencyPinV0({
      upstream_receipt: entry.upstream_receipt,
      expected_dependency_pin: entry.dependency_pin,
    });
    const refetchedFrom = readRefetchedFromReceiptV0(entry, index, asOfMs);
    const nextForecastRecheck = verified.receipt.freshness.next_forecast_recheck;
    const nextForecastRecheckMs = parseReplayableInstantMsV0(
      nextForecastRecheck,
      `consumed_receipts[${index}].upstream_receipt.freshness.next_forecast_recheck`,
    );
    const isStale =
      nextForecastRecheckMs <= asOfMs ||
      isStaleByAuthoredTransitiveFreshnessFunctionV0(
        transitiveFreshnessFunction,
        nextForecastRecheckMs,
        asOfMs,
      );

    if (isStale) {
      staleReceiptHashes.push(verified.content_hash);
    }

    return {
      receipt_hash: verified.content_hash,
      next_forecast_recheck: nextForecastRecheck,
      staleness_outcome: isStale
        ? "stale-blocked"
        : refetchedFrom === undefined
          ? "fresh"
          : "stale-refetched",
    } satisfies ConsumedFreshnessEvaluationV0;
  });

  return {
    outcome: staleReceiptHashes.length === 0 ? "fresh" : "stale-blocked",
    as_of: input.as_of,
    transitive_freshness_policy_ref: input.transitive_freshness_policy_ref,
    consumed_freshness_evaluated: consumedFreshnessEvaluated,
    stale_receipt_hashes: staleReceiptHashes,
  };
}

function isStaleByAuthoredTransitiveFreshnessFunctionV0(
  fn: PolicyTransitiveFreshnessFunctionV0,
  nextForecastRecheckMs: number,
  asOfMs: number,
): boolean {
  switch (fn.kind) {
    case "kernel-default":
      return false;
    case "minimum-remaining-freshness-ms":
      return nextForecastRecheckMs <= asOfMs + fn.minimum_remaining_ms;
  }
}

function readRefetchedFromReceiptV0(
  entry: Readonly<Record<string, unknown>>,
  index: number,
  asOfMs: number,
): VerifiedUpstreamReceiptDependencyPinV0 | undefined {
  const refetchedReceipt = entry["refetched_from_receipt"];
  const refetchedPin = entry["refetched_from_dependency_pin"];

  if (refetchedReceipt === undefined && refetchedPin === undefined) {
    return undefined;
  }
  if (refetchedReceipt === undefined || refetchedPin === undefined) {
    throw new Error(
      `consumed_receipts[${index}] refetch evidence requires both receipt and dependency pin`,
    );
  }

  const verified = verifyUpstreamReceiptDependencyPinV0({
    upstream_receipt: refetchedReceipt,
    expected_dependency_pin: refetchedPin,
  });
  const previousNextForecastRecheckMs = parseReplayableInstantMsV0(
    verified.receipt.freshness.next_forecast_recheck,
    `consumed_receipts[${index}].refetched_from_receipt.freshness.next_forecast_recheck`,
  );
  if (previousNextForecastRecheckMs > asOfMs) {
    throw new Error(
      `consumed_receipts[${index}].refetched_from_receipt must be stale at as_of`,
    );
  }

  return verified;
}

export function createComposedReceiptFreshnessV0(
  input: ComposedReceiptFreshnessInputV0,
): ReceiptFreshnessV0 {
  const asOfMs = parseReplayableInstantMsV0(input.as_of, "as_of");
  const nextForecastRecheckMs = parseReplayableInstantMsV0(
    input.next_forecast_recheck,
    "next_forecast_recheck",
  );
  if (nextForecastRecheckMs < asOfMs) {
    throw new Error("next_forecast_recheck must not be before as_of");
  }

  const evaluation = evaluateTransitiveFreshnessV0(input);

  return {
    as_of: input.as_of,
    next_forecast_recheck: input.next_forecast_recheck,
    transitive_freshness_policy_ref: input.transitive_freshness_policy_ref,
    consumed_freshness_evaluated: evaluation.consumed_freshness_evaluated,
  };
}

export function computeDownstreamComposedMemoKeyV0(
  input: DownstreamComposedMemoKeyInputV0,
): ContentHashV0 {
  const dependencyReceipts = assertNoDuplicateDependencyPinsV0(
    input.dependency_receipts,
  );

  return computeMemoKeyV0({
    contract_revision: input.contract_revision,
    evidence_receipts: input.evidence_receipts,
    dependency_receipts: dependencyReceipts,
  });
}

export function planCompositionPropagationV0(
  input: CompositionPropagationPlanInputV0,
): CompositionPropagationPlanV0 {
  const dependencyReceipts = assertNoDuplicateDependencyPinsV0(
    input.dependency_receipts,
  );
  const memoKey = computeDownstreamComposedMemoKeyV0({
    contract_revision: input.contract_revision,
    evidence_receipts: input.evidence_receipts,
    dependency_receipts: dependencyReceipts,
  });
  const memoLookup = input.memo_store.lookup(input.memo_namespace, memoKey);

  if (memoLookup.outcome === "miss") {
    return {
      outcome: "rejudge-required",
      memo_key: memoKey,
      memo_lookup: memoLookup,
      dependency_receipts: dependencyReceipts,
    };
  }
  assertMemoHitMatchesComposedInputV0(memoLookup, memoKey, dependencyReceipts);

  return {
    outcome: "stop-memo-hit",
    memo_key: memoKey,
    memo_lookup: memoLookup,
    memo_hit_receipt: createMemoHitReceiptV0({
      source_receipt: memoLookup.entry.receipt,
      as_of: input.as_of,
      next_forecast_recheck: input.next_forecast_recheck,
      ...(input.event_cause === undefined ? {} : { event_cause: input.event_cause }),
      ...(input.recheck_kind === undefined ? {} : { recheck_kind: input.recheck_kind }),
    }),
    dependency_receipts: dependencyReceipts,
  };
}

function assertMemoHitMatchesComposedInputV0(
  memoLookup: Extract<MemoLookupResultV0, { outcome: "hit" }>,
  memoKey: ContentHashV0,
  dependencyReceipts: readonly ConsumedReceiptPinV0[],
): void {
  if (memoLookup.entry.memo_key !== memoKey) {
    throw new Error("composition memo hit entry key must match composed memo key");
  }
  if (memoLookup.entry.receipt.core.memo_key !== memoKey) {
    throw new Error("composition memo hit receipt key must match composed memo key");
  }
  if (
    canonicalizeDependencyPinsForComparisonV0(
      memoLookup.entry.receipt.composition.consumed_receipts,
    ) !== canonicalizeDependencyPinsForComparisonV0(dependencyReceipts)
  ) {
    throw new Error("composition memo hit receipt dependencies must match composed input");
  }
}

function assertNoDuplicateDependencyPinsV0(
  dependencyReceipts: readonly ConsumedReceiptPinV0[],
): readonly DependencyReceiptMemoRefV0[] {
  const seen = new Set<ContentHashV0>();

  for (const dependencyReceipt of dependencyReceipts) {
    if (seen.has(dependencyReceipt.upstream_content_hash)) {
      throw new Error(
        `duplicate dependency receipt pin ${dependencyReceipt.upstream_content_hash}`,
      );
    }
    seen.add(dependencyReceipt.upstream_content_hash);
  }

  return dependencyReceipts;
}

function canonicalizeDependencyPinsForComparisonV0(
  dependencyReceipts: readonly ConsumedReceiptPinV0[],
): string {
  return canonicalizeForReceiptV0(
    dependencyReceipts
      .map((dependencyReceipt, index) => ({
        upstream_content_hash: dependencyReceipt.upstream_content_hash,
        contract_revision: dependencyReceipt.contract_revision,
        acceptable_signer_set: normalizeAcceptableSignerSetV0(
          dependencyReceipt.acceptable_signer_set,
          `dependency_receipts[${index}].acceptable_signer_set`,
        ),
      }))
      .sort((left, right) =>
        left.upstream_content_hash.localeCompare(right.upstream_content_hash),
      ),
  );
}

function normalizeAcceptableSignerSetV0(
  acceptableSignerSet: unknown,
  path: string,
): readonly string[] {
  if (!Array.isArray(acceptableSignerSet)) {
    throw new Error(`${path} must be an array`);
  }
  if (acceptableSignerSet.length === 0) {
    throw new Error(`${path} must not be empty`);
  }

  const seen = new Set<string>();
  for (const [index, signer] of acceptableSignerSet.entries()) {
    if (typeof signer !== "string") {
      throw new Error(`${path}[${index}] must be a non-empty string`);
    }
    if (signer.length === 0) {
      throw new Error(`${path} contains an empty signer`);
    }
    if (seen.has(signer)) {
      throw new Error(`${path} contains duplicate signer ${signer}`);
    }
    seen.add(signer);
  }

  return [...acceptableSignerSet].sort((left, right) => left.localeCompare(right));
}

function normalizeDependencyReceiptPinV0(
  value: unknown,
  path: string,
): ConsumedReceiptPinV0 {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`);
  }

  assertExactPinKeysV0(value, path);
  assertContentHashV0(value["upstream_content_hash"], `${path}.upstream_content_hash`);
  assertContentHashV0(value["contract_revision"], `${path}.contract_revision`);

  return {
    upstream_content_hash: value["upstream_content_hash"],
    contract_revision: value["contract_revision"],
    acceptable_signer_set: normalizeAcceptableSignerSetV0(
      value["acceptable_signer_set"],
      `${path}.acceptable_signer_set`,
    ),
  };
}

function signerPostureForVerifiedReceiptV0(receipt: ReceiptV0): string {
  if (receipt.sig.scheme === "none") {
    return "none";
  }

  throw new Error(
    "upstream receipt non-null signer posture is rejected in receipt v0.1; null signer is the only honest v0.1 dependency posture",
  );
}

function assertExactPinKeysV0(
  value: Readonly<Record<string, unknown>>,
  path: string,
): void {
  const allowed = new Set([
    "upstream_content_hash",
    "contract_revision",
    "acceptable_signer_set",
  ]);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${path}.${key} is not pinned in dependency receipt v0`);
    }
  }
}

function assertContentHashV0(value: unknown, path: string): asserts value is ContentHashV0 {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${path} must be a sha256 content address`);
  }
}

function assertNonEmptyStringV0(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function parseReplayableInstantMsV0(value: string, path: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new Error(`${path} must be a replayable ISO instant`);
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${path} must be a replayable ISO instant`);
  }

  return parsed;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
