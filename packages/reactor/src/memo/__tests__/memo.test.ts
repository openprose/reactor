import { deepEqual, equal, ok, notEqual } from "node:assert/strict";
import { test } from "node:test";

import {
  InMemoryMemoStoreV0,
  computeMemoKeyV0,
  createMemoHitReceiptV0,
  createMemoizedVerdictEntryV0,
  namespaceKey,
  normalizeMemoKeyInput,
} from "../index";
import {
  type ReceiptV0Input,
  createReceiptV0,
  readTokenTruthV0,
} from "../../receipt";

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_A =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const EVIDENCE_B =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const DEPENDENCY_A =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const DEPENDENCY_B =
  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;

test("memo key hashes exactly contract revision, evidence receipts, and dependency receipts", () => {
  const left = computeMemoKeyV0({
    contract_revision: CONTRACT_HASH,
    evidence_receipts: [EVIDENCE_B, EVIDENCE_A],
    dependency_receipts: [
      {
        upstream_content_hash: DEPENDENCY_B,
        contract_revision: CONTRACT_HASH,
        acceptable_signer_set: ["signer-b", "signer-a"],
      },
      {
        upstream_content_hash: DEPENDENCY_A,
        contract_revision: CONTRACT_HASH,
        acceptable_signer_set: ["none"],
      },
    ],
  });
  const right = computeMemoKeyV0({
    contract_revision: CONTRACT_HASH,
    evidence_receipts: [EVIDENCE_A, EVIDENCE_B],
    dependency_receipts: [
      {
        upstream_content_hash: DEPENDENCY_A,
        contract_revision: CONTRACT_HASH,
        acceptable_signer_set: ["none"],
      },
      {
        upstream_content_hash: DEPENDENCY_B,
        contract_revision: CONTRACT_HASH,
        acceptable_signer_set: ["signer-a", "signer-b"],
      },
    ],
  });
  const changedDependency = computeMemoKeyV0({
    contract_revision: CONTRACT_HASH,
    evidence_receipts: [EVIDENCE_A, EVIDENCE_B],
    dependency_receipts: [
      {
        upstream_content_hash: DEPENDENCY_A,
        contract_revision: EVIDENCE_A,
        acceptable_signer_set: ["none"],
      },
    ],
  });

  equal(left, right);
  notEqual(left, changedDependency);
  deepEqual(normalizeMemoKeyInput({
    contract_revision: CONTRACT_HASH,
    evidence_receipts: [EVIDENCE_B, EVIDENCE_A],
    dependency_receipts: [],
  }).evidence_receipts, [EVIDENCE_A, EVIDENCE_B]);
});

test("policy artifact namespace scopes reuse without becoming a fourth key term", () => {
  const memoKey = computeMemoKeyV0({
    contract_revision: CONTRACT_HASH,
    evidence_receipts: [EVIDENCE_A],
    dependency_receipts: [],
  });
  const store = new InMemoryMemoStoreV0();
  const receipt = makeReceipt({ memoKey, tokens: { fresh: 42, reused: 0 } });

  store.store(
    {
      policy_artifact_namespace: "policy.static",
      policy_artifact_revision: "v1",
    },
    createMemoizedVerdictEntryV0(memoKey, receipt),
  );

  equal(
    store.lookup(
      {
        policy_artifact_namespace: "policy.static",
        policy_artifact_revision: "v1",
      },
      memoKey,
    ).outcome,
    "hit",
  );
  equal(
    store.lookup(
      {
        policy_artifact_namespace: "policy.static",
        policy_artifact_revision: "v2",
      },
      memoKey,
    ).outcome,
    "miss",
  );
  equal(
    memoKey,
    computeMemoKeyV0({
      contract_revision: CONTRACT_HASH,
      evidence_receipts: [EVIDENCE_A],
      dependency_receipts: [],
    }),
  );
  notEqual(
    namespaceKey({
      policy_artifact_namespace: "policy.static",
      policy_artifact_revision: "v1",
    }),
    namespaceKey({
      policy_artifact_namespace: "policy.static",
      policy_artifact_revision: "v2",
    }),
  );
});

test("unchanged input hash returns a memo-hit receipt with reused tokens and zero fresh tokens", () => {
  const memoKey = computeMemoKeyV0({
    contract_revision: CONTRACT_HASH,
    evidence_receipts: [EVIDENCE_A],
    dependency_receipts: [],
  });
  const sourceReceipt = makeReceipt({ memoKey, tokens: { fresh: 37, reused: 0 } });
  const hitReceipt = createMemoHitReceiptV0({
    source_receipt: sourceReceipt,
    as_of: "2026-05-18T13:00:00Z",
    next_forecast_recheck: "2026-05-19T13:00:00Z",
  });

  deepEqual(readTokenTruthV0(hitReceipt), {
    responsibility_id: "responsibility.incident-briefing",
    run_id: "memo-hit-2026-05-18T13:00:00Z",
    provider: "memo",
    model: "memoized-verdict",
    role: "judge",
    tags: ["memo-hit", "bootstrap"],
    as_of: "2026-05-18T13:00:00Z",
    fresh: 0,
    reused: 37,
    surprise_cause: "real-input",
  });
});

test("forecast recheck changes the key as an evidence receipt, not a fourth term", () => {
  const baseline = computeMemoKeyV0({
    contract_revision: CONTRACT_HASH,
    evidence_receipts: [EVIDENCE_A],
    dependency_receipts: [],
  });
  const forecastRecheck = computeMemoKeyV0({
    contract_revision: CONTRACT_HASH,
    evidence_receipts: [EVIDENCE_A, EVIDENCE_B],
    dependency_receipts: [],
  });
  const forecastReceipt = createMemoHitReceiptV0({
    source_receipt: makeReceipt({ memoKey: baseline, tokens: { fresh: 10, reused: 0 } }),
    as_of: "2026-05-18T14:00:00Z",
    next_forecast_recheck: "2026-05-19T14:00:00Z",
    event_cause: "forecast-recheck",
    recheck_kind: "plan-age",
  });

  notEqual(baseline, forecastRecheck);
  equal(forecastReceipt.core.event_cause, "forecast-recheck");
  equal(forecastReceipt.core.recheck_kind, "plan-age");
  equal(forecastReceipt.cost.surprise_cause, "forecast-recheck");
});

test("memo key canonicalization rejects duplicates instead of normalizing silently", () => {
  assertThrows(() =>
    computeMemoKeyV0({
      contract_revision: CONTRACT_HASH,
      evidence_receipts: [EVIDENCE_A, EVIDENCE_A],
      dependency_receipts: [],
    }),
  );
});

function assertThrows(fn: () => unknown): void {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    ok(error instanceof Error);
    equal(error.message, `duplicate evidence_receipts ref ${EVIDENCE_A}`);
  }
  equal(threw, true);
}

function makeReceipt(input: {
  readonly memoKey: string;
  readonly tokens: {
    readonly fresh: number;
    readonly reused: number;
  };
}): ReturnType<typeof createReceiptV0> {
  const receiptInput: ReceiptV0Input = {
    core: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: CONTRACT_HASH,
      event_cause: "real-input",
      memo_key: input.memoKey,
      evidence_input_ids: [EVIDENCE_A],
      as_of: "2026-05-18T12:00:00Z",
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "memo fixture",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.9,
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
      tags: ["bootstrap"],
      responsibility_id: "responsibility.incident-briefing",
      run_id: "run-bootstrap",
      as_of: "2026-05-18T12:00:00Z",
      tokens: input.tokens,
      surprise_cause: "real-input",
    },
  };

  return createReceiptV0(receiptInput);
}
