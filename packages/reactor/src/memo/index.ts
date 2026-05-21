import {
  type ContentHashV0,
  type ReceiptRecheckKindV0,
  type ReceiptV0,
  canonicalizeForReceiptV0,
  createNullSignerReceiptSignatureV0,
  createReceiptV0,
  hashCanonicalReceiptV0,
  verifyReceiptV0,
} from "../receipt";

export const MEMO_KEY_SCHEMA = "openprose.memo-key" as const;
export const MEMO_KEY_VERSION = 0 as const;

export interface DependencyReceiptMemoRefV0 {
  readonly upstream_content_hash: ContentHashV0;
  readonly contract_revision: ContentHashV0;
  readonly acceptable_signer_set: readonly string[];
}

export interface MemoKeyInputV0 {
  readonly contract_revision: ContentHashV0;
  readonly evidence_receipts: readonly ContentHashV0[];
  readonly dependency_receipts: readonly DependencyReceiptMemoRefV0[];
}

export interface PolicyArtifactMemoNamespaceV0 {
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
}

export interface MemoizedVerdictV0 {
  readonly memo_key: ContentHashV0;
  readonly verdict_receipt_hash: ContentHashV0;
  readonly reusable_tokens: number;
  readonly stored_as_of: string;
  readonly receipt: ReceiptV0;
}

export type MemoLookupResultV0 =
  | {
      readonly outcome: "hit";
      readonly entry: MemoizedVerdictV0;
    }
  | {
      readonly outcome: "miss";
      readonly reason: "absent" | "namespace-empty";
    };

export interface MemoHitReceiptInputV0 {
  readonly source_receipt: ReceiptV0;
  readonly as_of: string;
  readonly next_forecast_recheck: string;
  readonly event_cause?: "real-input" | "forecast-recheck" | "escalation";
  readonly recheck_kind?: ReceiptRecheckKindV0;
}

export class InMemoryMemoStoreV0 {
  private readonly namespaces = new Map<string, Map<ContentHashV0, MemoizedVerdictV0>>();

  lookup(
    namespace: PolicyArtifactMemoNamespaceV0,
    memoKey: ContentHashV0,
  ): MemoLookupResultV0 {
    const scoped = this.namespaces.get(namespaceKey(namespace));
    if (scoped === undefined) {
      return { outcome: "miss", reason: "namespace-empty" };
    }

    const entry = scoped.get(memoKey);
    if (entry === undefined) {
      return { outcome: "miss", reason: "absent" };
    }

    return { outcome: "hit", entry };
  }

  store(
    namespace: PolicyArtifactMemoNamespaceV0,
    entry: MemoizedVerdictV0,
  ): void {
    const verification = verifyReceiptV0(entry.receipt);
    if (!verification.ok) {
      throw new Error("memo entry receipt must verify before storage");
    }
    if (verification.content_hash !== entry.verdict_receipt_hash) {
      throw new Error("memo entry receipt hash must match verdict_receipt_hash");
    }
    if (entry.reusable_tokens <= 0 || !Number.isSafeInteger(entry.reusable_tokens)) {
      throw new Error("memo entry reusable_tokens must be a positive safe integer");
    }

    const key = namespaceKey(namespace);
    const scoped = this.namespaces.get(key) ?? new Map<ContentHashV0, MemoizedVerdictV0>();
    scoped.set(entry.memo_key, entry);
    this.namespaces.set(key, scoped);
  }
}

export function computeMemoKeyV0(input: MemoKeyInputV0): ContentHashV0 {
  const normalized = normalizeMemoKeyInput(input);
  return hashCanonicalReceiptV0(canonicalizeForReceiptV0(normalized));
}

export function normalizeMemoKeyInput(input: MemoKeyInputV0): {
  readonly schema: typeof MEMO_KEY_SCHEMA;
  readonly v: typeof MEMO_KEY_VERSION;
  readonly contract_revision: ContentHashV0;
  readonly evidence_receipts: readonly ContentHashV0[];
  readonly dependency_receipts: readonly {
    readonly upstream_content_hash: ContentHashV0;
    readonly contract_revision: ContentHashV0;
    readonly acceptable_signer_set: readonly string[];
  }[];
} {
  assertContentHash(input.contract_revision, "contract_revision");
  const evidenceReceipts = normalizeReceiptHashSet(
    input.evidence_receipts,
    "evidence_receipts",
  );
  const dependencyReceipts = normalizeDependencyReceipts(input.dependency_receipts);

  return {
    schema: MEMO_KEY_SCHEMA,
    v: MEMO_KEY_VERSION,
    contract_revision: input.contract_revision,
    evidence_receipts: evidenceReceipts,
    dependency_receipts: dependencyReceipts,
  };
}

export function createMemoHitReceiptV0(
  input: MemoHitReceiptInputV0,
): ReceiptV0 {
  const verification = verifyReceiptV0(input.source_receipt);
  if (!verification.ok) {
    throw new Error("source receipt must verify before memo reuse");
  }

  const totalReused =
    input.source_receipt.cost.tokens.fresh + input.source_receipt.cost.tokens.reused;
  if (totalReused <= 0) {
    throw new Error("source receipt must contain reusable token work");
  }

  const eventCause = input.event_cause ?? input.source_receipt.core.event_cause;
  const core = {
    responsibility_id: input.source_receipt.core.responsibility_id,
    contract_revision: input.source_receipt.core.contract_revision,
    event_cause: eventCause,
    ...(eventCause === "forecast-recheck"
      ? { recheck_kind: input.recheck_kind ?? "plan-age" }
      : {}),
    memo_key: input.source_receipt.core.memo_key,
    evidence_input_ids: input.source_receipt.core.evidence_input_ids,
    as_of: input.as_of,
    role: input.source_receipt.core.role,
  };

  return createReceiptV0({
    core,
    sig: createNullSignerReceiptSignatureV0(),
    verdict: input.source_receipt.verdict,
    freshness: {
      as_of: input.as_of,
      next_forecast_recheck: input.next_forecast_recheck,
      ...(input.source_receipt.freshness.transitive_freshness_policy_ref === undefined
        ? {}
        : {
            transitive_freshness_policy_ref:
              input.source_receipt.freshness.transitive_freshness_policy_ref,
          }),
      ...(input.source_receipt.freshness.consumed_freshness_evaluated === undefined
        ? {}
        : {
            consumed_freshness_evaluated:
              input.source_receipt.freshness.consumed_freshness_evaluated,
          }),
    },
    composition: input.source_receipt.composition,
    cost: {
      provider: "memo",
      model: "memoized-verdict",
      role: input.source_receipt.core.role,
      tags: ["memo-hit", ...input.source_receipt.cost.tags],
      responsibility_id: input.source_receipt.core.responsibility_id,
      run_id: `memo-hit-${input.as_of}`,
      as_of: input.as_of,
      tokens: {
        fresh: 0,
        reused: totalReused,
      },
      surprise_cause: eventCause,
    },
  });
}

export function createMemoizedVerdictEntryV0(
  memoKey: ContentHashV0,
  receipt: ReceiptV0,
): MemoizedVerdictV0 {
  const verification = verifyReceiptV0(receipt);
  if (!verification.ok) {
    throw new Error("memoized verdict receipt must verify");
  }

  return {
    memo_key: memoKey,
    verdict_receipt_hash: verification.content_hash,
    reusable_tokens: receipt.cost.tokens.fresh + receipt.cost.tokens.reused,
    stored_as_of: receipt.core.as_of,
    receipt,
  };
}

export function namespaceKey(namespace: PolicyArtifactMemoNamespaceV0): string {
  if (
    namespace.policy_artifact_namespace.length === 0 ||
    namespace.policy_artifact_revision.length === 0
  ) {
    throw new Error("policy artifact namespace and revision must be non-empty");
  }

  return canonicalizeForReceiptV0({
    policy_artifact_namespace: namespace.policy_artifact_namespace,
    policy_artifact_revision: namespace.policy_artifact_revision,
  });
}

function normalizeDependencyReceipts(
  refs: readonly DependencyReceiptMemoRefV0[],
): readonly DependencyReceiptMemoRefV0[] {
  const seen = new Set<string>();
  const normalized = refs.map((ref, index) => {
    assertContentHash(ref.upstream_content_hash, `dependency_receipts[${index}].upstream_content_hash`);
    assertContentHash(ref.contract_revision, `dependency_receipts[${index}].contract_revision`);
    const acceptableSignerSet = normalizeSignerSet(
      ref.acceptable_signer_set,
      `dependency_receipts[${index}].acceptable_signer_set`,
    );
    const key = `${ref.upstream_content_hash}\0${ref.contract_revision}\0${acceptableSignerSet.join("\0")}`;
    if (seen.has(key)) {
      throw new Error(`duplicate dependency receipt ref ${ref.upstream_content_hash}`);
    }
    seen.add(key);

    return {
      upstream_content_hash: ref.upstream_content_hash,
      contract_revision: ref.contract_revision,
      acceptable_signer_set: acceptableSignerSet,
    };
  });

  return normalized.sort((left, right) =>
    left.upstream_content_hash.localeCompare(right.upstream_content_hash),
  );
}

function normalizeReceiptHashSet(
  refs: readonly ContentHashV0[],
  path: string,
): readonly ContentHashV0[] {
  const seen = new Set<string>();
  for (const [index, ref] of refs.entries()) {
    assertContentHash(ref, `${path}[${index}]`);
    if (seen.has(ref)) {
      throw new Error(`duplicate ${path} ref ${ref}`);
    }
    seen.add(ref);
  }

  return [...refs].sort((left, right) => left.localeCompare(right));
}

function normalizeSignerSet(
  signers: readonly string[],
  path: string,
): readonly string[] {
  if (signers.length === 0) {
    throw new Error(`${path} must not be empty`);
  }
  const seen = new Set<string>();
  for (const signer of signers) {
    if (signer.length === 0) {
      throw new Error(`${path} contains an empty signer`);
    }
    if (seen.has(signer)) {
      throw new Error(`${path} contains duplicate signer ${signer}`);
    }
    seen.add(signer);
  }

  return [...signers].sort((left, right) => left.localeCompare(right));
}

function assertContentHash(value: string, path: string): asserts value is ContentHashV0 {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${path} must be a sha256 content address`);
  }
}
