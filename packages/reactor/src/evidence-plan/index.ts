import { createKernelSafetyReceipt } from "../kernel";
import {
  type ContentHashV0,
  type ReceiptV0,
  canonicalizeForReceiptV0,
  hashCanonicalReceiptV0,
  verifyReceiptV0,
} from "../receipt";

export type EvidenceSourceKind = "adapter" | "forecast" | "dependency";
export type EvidenceReceiptOrder = "unordered" | "declared";
export type DeepRoamTrigger =
  | "confidence-escalation"
  | "stakes-escalation"
  | "forecast-evidence-age"
  | "forecast-plan-age"
  | "no-anchor-forced-deep"
  | "degraded-calibration";

export interface CompiledEvidenceSource {
  readonly id: string;
  readonly kind: EvidenceSourceKind;
  readonly required: boolean;
  readonly receipt_order?: EvidenceReceiptOrder;
}

export interface CompiledEvidencePlan {
  readonly responsibility_id: string;
  readonly contract_revision: ContentHashV0;
  readonly policy_artifact_namespace: string;
  readonly policy_artifact_revision: string;
  readonly plan_revision: string;
  readonly as_of: string;
  readonly evidence_order: EvidenceReceiptOrder;
  readonly sources: readonly CompiledEvidenceSource[];
}

export interface EvidenceReceiptRef {
  readonly source_id: string;
  readonly receipt_hash: ContentHashV0;
}

export type EvidenceSourceCollector = (
  source: CompiledEvidenceSource,
) => ReceiptV0 | undefined;

export type ShallowEvidencePlanResult =
  | {
      readonly outcome: "ready";
      readonly consulted_source_ids: readonly string[];
      readonly evidence_receipts: readonly EvidenceReceiptRef[];
      readonly canonical_evidence_receipts: readonly EvidenceReceiptRef[];
    }
  | {
      readonly outcome: "fail-safe";
      readonly consulted_source_ids: readonly string[];
      readonly reason: string;
      readonly receipt: ReceiptV0;
    };

export interface DeepRoamDiscovery {
  readonly source_id: string;
  readonly kind: EvidenceSourceKind;
  readonly receipt_hash?: ContentHashV0;
}

export type DeepRoamReconciliation =
  | {
      readonly outcome: "plan-confirmed";
      readonly trigger: DeepRoamTrigger;
      readonly confirmed_source_ids: readonly string[];
    }
  | {
      readonly outcome: "force-recompile";
      readonly trigger: DeepRoamTrigger;
      readonly discovered_source_ids: readonly string[];
      readonly discovered_receipt_hashes: readonly ContentHashV0[];
      readonly reason: string;
    };

export function executeShallowEvidencePlan(
  plan: CompiledEvidencePlan,
  collectors: Readonly<Record<string, EvidenceSourceCollector>>,
): ShallowEvidencePlanResult {
  const validation = validateCompiledEvidencePlan(plan);
  if (validation.length > 0) {
    return failSafe(plan, [], validation.join("; "));
  }

  const consultedSourceIds: string[] = [];
  const evidenceReceipts: EvidenceReceiptRef[] = [];

  for (const source of plan.sources) {
    consultedSourceIds.push(source.id);
    const collector = collectors[source.id];

    if (collector === undefined) {
      if (!source.required) {
        continue;
      }
      return failSafe(
        plan,
        consultedSourceIds,
        `planned source ${source.id} has no collector`,
      );
    }

    const receipt = collector(source);
    if (receipt === undefined) {
      if (!source.required) {
        continue;
      }
      return failSafe(
        plan,
        consultedSourceIds,
        `planned source ${source.id} produced no receipt`,
      );
    }

    const verification = verifyReceiptV0(receipt);
    if (!verification.ok) {
      return failSafe(
        plan,
        consultedSourceIds,
        `planned source ${source.id} produced an unverifiable receipt`,
      );
    }

    evidenceReceipts.push({
      source_id: source.id,
      receipt_hash: verification.content_hash,
    });
  }

  const canonicalEvidenceReceipts =
    canonicalizeEvidenceReceiptRefsForPlan(plan, evidenceReceipts);

  return {
    outcome: "ready",
    consulted_source_ids: consultedSourceIds,
    evidence_receipts: evidenceReceipts,
    canonical_evidence_receipts: canonicalEvidenceReceipts,
  };
}

export function reconcileDeepRoam(
  plan: CompiledEvidencePlan,
  trigger: DeepRoamTrigger,
  discoveries: readonly DeepRoamDiscovery[],
): DeepRoamReconciliation {
  const plannedSourceIds = new Set(plan.sources.map((source) => source.id));
  const discovered = discoveries.filter(
    (discovery) => !plannedSourceIds.has(discovery.source_id),
  );

  if (discovered.length === 0) {
    return {
      outcome: "plan-confirmed",
      trigger,
      confirmed_source_ids: plan.sources.map((source) => source.id),
    };
  }

  return {
    outcome: "force-recompile",
    trigger,
    discovered_source_ids: discovered.map((discovery) => discovery.source_id),
    discovered_receipt_hashes: discovered.flatMap((discovery) =>
      discovery.receipt_hash === undefined ? [] : [discovery.receipt_hash],
    ),
    reason: "deep roaming discovered evidence outside the compiled plan",
  };
}

export function canonicalizeEvidenceReceiptRefsForPlan(
  plan: Pick<CompiledEvidencePlan, "evidence_order">,
  refs: readonly EvidenceReceiptRef[],
): readonly EvidenceReceiptRef[] {
  const seen = new Set<string>();
  for (const ref of refs) {
    if (seen.has(ref.receipt_hash)) {
      throw new Error(`duplicate evidence receipt ref ${ref.receipt_hash}`);
    }
    seen.add(ref.receipt_hash);
  }

  if (plan.evidence_order === "declared") {
    return [...refs];
  }

  return [...refs].sort((left, right) =>
    left.receipt_hash.localeCompare(right.receipt_hash),
  );
}

export function validateCompiledEvidencePlan(
  plan: CompiledEvidencePlan,
): readonly string[] {
  const errors: string[] = [];

  if (plan.responsibility_id.length === 0) {
    errors.push("plan.responsibility_id must be non-empty");
  }
  if (!isContentHash(plan.contract_revision)) {
    errors.push("plan.contract_revision must be a sha256 content address");
  }
  if (plan.policy_artifact_namespace.length === 0) {
    errors.push("plan.policy_artifact_namespace must be non-empty");
  }
  if (plan.policy_artifact_revision.length === 0) {
    errors.push("plan.policy_artifact_revision must be non-empty");
  }
  if (plan.plan_revision.length === 0) {
    errors.push("plan.plan_revision must be non-empty");
  }
  if (!isReplayableInstant(plan.as_of)) {
    errors.push("plan.as_of must be a replayable ISO instant");
  }
  if (plan.evidence_order !== "unordered" && plan.evidence_order !== "declared") {
    errors.push("plan.evidence_order is malformed");
  }

  const seenSourceIds = new Set<string>();
  for (const source of plan.sources) {
    if (source.id.length === 0) {
      errors.push("source.id must be non-empty");
    }
    if (seenSourceIds.has(source.id)) {
      errors.push(`source ${source.id} is duplicated`);
    }
    seenSourceIds.add(source.id);
    if (
      source.kind !== "adapter" &&
      source.kind !== "forecast" &&
      source.kind !== "dependency"
    ) {
      errors.push(`source ${source.id} has malformed kind`);
    }
    if (typeof source.required !== "boolean") {
      errors.push(`source ${source.id} required flag is malformed`);
    }
    if (
      source.receipt_order !== undefined &&
      source.receipt_order !== "unordered" &&
      source.receipt_order !== "declared"
    ) {
      errors.push(`source ${source.id} receipt_order is malformed`);
    }
  }

  return errors;
}

function failSafe(
  plan: CompiledEvidencePlan,
  consultedSourceIds: readonly string[],
  reason: string,
): ShallowEvidencePlanResult {
  return {
    outcome: "fail-safe",
    consulted_source_ids: consultedSourceIds,
    reason,
    receipt: createKernelSafetyReceipt({
      responsibility_id: plan.responsibility_id,
      contract_revision: plan.contract_revision,
      memo_key: `evidence-plan-fail-safe:${plan.policy_artifact_namespace}:${plan.plan_revision}`,
      evidence_input_ids: [failSafeEvidenceInputId(plan, consultedSourceIds, reason)],
      as_of: plan.as_of,
      reason,
      fix_target: "policy-artifact",
      interrupt_cause: "needs-judgment",
      event_cause: "escalation",
    }),
  };
}

function failSafeEvidenceInputId(
  plan: CompiledEvidencePlan,
  consultedSourceIds: readonly string[],
  reason: string,
): ContentHashV0 {
  return hashCanonicalReceiptV0(
    canonicalizeForReceiptV0({
      schema: "openprose.evidence-plan.fail-safe-input",
      v: 0,
      contract_revision: plan.contract_revision,
      policy_artifact_namespace: plan.policy_artifact_namespace,
      policy_artifact_revision: plan.policy_artifact_revision,
      plan_revision: plan.plan_revision,
      consulted_source_ids: consultedSourceIds,
      reason,
      as_of: plan.as_of,
    }),
  );
}

function isContentHash(value: string): value is ContentHashV0 {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

function isReplayableInstant(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
}
