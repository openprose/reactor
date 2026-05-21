import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  type CompiledEvidencePlan,
  type EvidenceSourceCollector,
  canonicalizeEvidenceReceiptRefsForPlan,
  executeShallowEvidencePlan,
  reconcileDeepRoam,
  validateCompiledEvidencePlan,
} from "../index";
import {
  type ReceiptV0Input,
  createReceiptV0,
  verifyReceiptV0,
} from "../../receipt";

const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const HASH_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const HASH_D =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;

test("shallow execution consults only sources declared in the compiled plan", () => {
  const plan = makePlan({
    sources: [
      { id: "incident-feed", kind: "adapter", required: true },
      { id: "plan-age-clock", kind: "forecast", required: true },
    ],
  });
  const calls: string[] = [];
  const collectors: Record<string, EvidenceSourceCollector> = {
    "incident-feed": (source) => {
      calls.push(source.id);
      return makeReceipt("incident-feed", HASH_B);
    },
    "plan-age-clock": (source) => {
      calls.push(source.id);
      return makeReceipt("plan-age-clock", HASH_C);
    },
    "unplanned-filesystem-roam": (source) => {
      calls.push(source.id);
      return makeReceipt("unplanned-filesystem-roam", HASH_D);
    },
  };

  const result = executeShallowEvidencePlan(plan, collectors);

  equal(result.outcome, "ready");
  deepEqual(calls, ["incident-feed", "plan-age-clock"]);
  deepEqual(result.consulted_source_ids, ["incident-feed", "plan-age-clock"]);
  ok(
    result.outcome === "ready" &&
      result.evidence_receipts.every(
        (ref) => ref.source_id !== "unplanned-filesystem-roam",
      ),
  );
});

test("shallow execution fails safe when a planned source cannot produce a receipt", () => {
  const result = executeShallowEvidencePlan(makePlan(), {});

  equal(result.outcome, "fail-safe");
  ok(
    result.outcome === "fail-safe" &&
      result.reason.includes("planned source incident-feed has no collector"),
  );
  ok(result.outcome === "fail-safe" && verifyReceiptV0(result.receipt).ok);
  ok(
    result.outcome === "fail-safe" &&
      result.receipt.core.evidence_input_ids.length === 1 &&
      result.receipt.core.evidence_input_ids[0]?.startsWith("sha256:"),
  );
  ok(
    result.outcome === "fail-safe" &&
      result.receipt.verdict.blocked?.reason.includes("planned source"),
  );
});

test("canonical evidence refs sort unordered sets and preserve declared order", () => {
  const refs = [
    { source_id: "late", receipt_hash: HASH_D },
    { source_id: "early", receipt_hash: HASH_B },
  ];

  deepEqual(
    canonicalizeEvidenceReceiptRefsForPlan({ evidence_order: "unordered" }, refs),
    [
      { source_id: "early", receipt_hash: HASH_B },
      { source_id: "late", receipt_hash: HASH_D },
    ],
  );
  deepEqual(
    canonicalizeEvidenceReceiptRefsForPlan({ evidence_order: "declared" }, refs),
    refs,
  );
});

test("canonical evidence refs reject duplicates instead of normalizing silently", () => {
  const refs = [
    { source_id: "a", receipt_hash: HASH_B },
    { source_id: "b", receipt_hash: HASH_B },
  ];

  throwsWithMessage(() =>
    canonicalizeEvidenceReceiptRefsForPlan({ evidence_order: "unordered" }, refs),
  );
});

test("scenario: deep roam discovering a new dependency forces policy recompile", () => {
  const plan = makePlan({
    sources: [{ id: "incident-feed", kind: "adapter", required: true }],
  });

  const reconciliation = reconcileDeepRoam(plan, "forecast-plan-age", [
    {
      source_id: "crm-owner-map",
      kind: "dependency",
      receipt_hash: HASH_D,
    },
  ]);

  deepEqual(reconciliation, {
    outcome: "force-recompile",
    trigger: "forecast-plan-age",
    discovered_source_ids: ["crm-owner-map"],
    discovered_receipt_hashes: [HASH_D],
    reason: "deep roaming discovered evidence outside the compiled plan",
  });
});

test("deep roam confirms the plan when discoveries stay inside declared sources", () => {
  const plan = makePlan({
    sources: [{ id: "incident-feed", kind: "adapter", required: true }],
  });

  deepEqual(
    reconcileDeepRoam(plan, "confidence-escalation", [
      { source_id: "incident-feed", kind: "adapter", receipt_hash: HASH_B },
    ]),
    {
      outcome: "plan-confirmed",
      trigger: "confidence-escalation",
      confirmed_source_ids: ["incident-feed"],
    },
  );
});

test("compiled plan validation rejects duplicate source ids", () => {
  deepEqual(
    validateCompiledEvidencePlan(
      makePlan({
        sources: [
          { id: "incident-feed", kind: "adapter", required: true },
          { id: "incident-feed", kind: "forecast", required: true },
        ],
      }),
    ),
    ["source incident-feed is duplicated"],
  );
});

function throwsWithMessage(fn: () => unknown): void {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    ok(error instanceof Error);
    equal(error.message, `duplicate evidence receipt ref ${HASH_B}`);
  }
  equal(threw, true);
}

function makePlan(
  overrides: Partial<CompiledEvidencePlan> = {},
): CompiledEvidencePlan {
  return {
    responsibility_id: "responsibility.incident-briefing",
    contract_revision: HASH_A,
    policy_artifact_namespace: "policy.incident-briefing.static-v1",
    policy_artifact_revision: "policy-revision-1",
    plan_revision: "compiled-plan-1",
    as_of: "2026-05-18T12:00:00Z",
    evidence_order: "unordered",
    sources: [{ id: "incident-feed", kind: "adapter", required: true }],
    ...overrides,
  };
}

function makeReceipt(sourceId: string, evidenceHash: typeof HASH_B): ReturnType<
  typeof createReceiptV0
>;
function makeReceipt(sourceId: string, evidenceHash: typeof HASH_C): ReturnType<
  typeof createReceiptV0
>;
function makeReceipt(sourceId: string, evidenceHash: typeof HASH_D): ReturnType<
  typeof createReceiptV0
>;
function makeReceipt(
  sourceId: string,
  evidenceHash: typeof HASH_B | typeof HASH_C | typeof HASH_D,
): ReturnType<typeof createReceiptV0> {
  const input: ReceiptV0Input = {
    core: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: HASH_A,
      event_cause: sourceId === "plan-age-clock" ? "forecast-recheck" : "real-input",
      ...(sourceId === "plan-age-clock" ? { recheck_kind: "plan-age" as const } : {}),
      memo_key: `memo-${sourceId}`,
      evidence_input_ids: [evidenceHash],
      as_of: "2026-05-18T12:00:00Z",
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "evidence-plan fixture",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.8,
        derivation_method: "fixture",
        calibration_grade: "authored",
        label_source: "fixture",
      },
    },
    freshness: {
      as_of: "2026-05-18T12:00:00Z",
      next_forecast_recheck: "2026-05-19T12:00:00Z",
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "cradle-double",
      model: "deterministic-replay",
      role: "judge",
      tags: [sourceId],
      responsibility_id: "responsibility.incident-briefing",
      run_id: `run-${sourceId}`,
      as_of: "2026-05-18T12:00:00Z",
      tokens: { fresh: 0, reused: 1 },
      surprise_cause: sourceId === "plan-age-clock" ? "forecast-recheck" : "real-input",
    },
  };

  return createReceiptV0(input);
}
