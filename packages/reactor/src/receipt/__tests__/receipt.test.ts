import { deepEqual, doesNotMatch, equal, match, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import * as rootSurface from "../../index";
import {
  RECEIPT_HASH_ALGORITHM,
  RECEIPT_SCHEMA,
  RECEIPT_VERSION,
  type ReceiptV0,
  type ReceiptV0Input,
  createNullSignerReceiptSignatureV0,
  createReceiptV0,
  inspectReceiptProofV0,
  readTokenTruthV0,
  serializeReceiptV0,
  verifyReceiptV0,
} from "../index";

const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const HASH_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;

test("receipt v0 round-trips pinned fields through canonical content addressing", () => {
  const receipt = createReceiptV0(makeReceiptInput());
  const verification = verifyReceiptV0(receipt);

  equal(receipt.schema, RECEIPT_SCHEMA);
  equal(receipt.v, RECEIPT_VERSION);
  equal(receipt.hash_algorithm, RECEIPT_HASH_ALGORITHM);
  equal(verification.ok, true);
  match(receipt.content_hash, /^sha256:[a-f0-9]{64}$/);

  const serialized = serializeReceiptV0(receipt);
  const parsed = JSON.parse(serialized) as ReceiptV0;

  deepEqual(parsed, receipt);
  deepEqual(verifyReceiptV0(parsed), {
    ok: true,
    content_hash: receipt.content_hash,
  });
});

test("receipt proof inspection summarizes a valid receipt without private payloads", () => {
  const receipt = createReceiptV0(makeReceiptInput());
  const inspection = inspectReceiptProofV0(receipt);

  deepEqual(inspection, {
    ok: true,
    errors: [],
    schema: RECEIPT_SCHEMA,
    v: RECEIPT_VERSION,
    content_hash: receipt.content_hash,
    contract_revision: HASH_A,
    responsibility_id: "responsibility.incident-briefing",
    role: "judge",
    signer: {
      kind: "null",
      scheme: "none",
    },
    freshness: {
      as_of: "2026-05-18T12:00:00Z",
      next_forecast_recheck: "2026-05-19T12:00:00Z",
      transitive_freshness_policy_ref: null,
      consumed_freshness_evaluated_count: 0,
    },
    composition: {
      consumed_receipt_count: 0,
      consumed_receipts: [],
      cycle_checked: true,
    },
    token_truth: {
      fresh: 37,
      reused: 0,
      provider: "cradle-double",
      model: "deterministic-replay",
      role: "judge",
      surprise_cause: "real-input",
    },
  });

  const serializedInspection = JSON.stringify(inspection);
  doesNotMatch(
    serializedInspection,
    /memo-key-static-world|run-2026-05-18T12:00:00Z|single-host|static-world-anchor/,
  );
  ok(!serializedInspection.includes(HASH_B));
});

test("receipt verification fails when a byte of hashed content is tampered", () => {
  const receipt = createReceiptV0(makeReceiptInput());
  const parsed = JSON.parse(serializeReceiptV0(receipt)) as ReceiptV0;
  const tampered = {
    ...parsed,
    core: {
      ...parsed.core,
      memo_key: "memo-key-after-tamper",
    },
  };

  const verification = verifyReceiptV0(tampered);

  equal(verification.ok, false);
  ok(
    !verification.ok &&
      verification.errors.includes(
        "content_hash does not match canonical receipt payload",
      ),
  );
});

test("receipt proof inspection reports tamper without trusting the old content hash", () => {
  const receipt = createReceiptV0(makeReceiptInput());
  const tampered = {
    ...receipt,
    core: {
      ...receipt.core,
      memo_key: "memo-key-after-tamper",
    },
  };

  const inspection = inspectReceiptProofV0(tampered);

  equal(inspection.ok, false);
  equal(inspection.content_hash, null);
  equal(inspection.responsibility_id, "responsibility.incident-briefing");
  equal(inspection.contract_revision, HASH_A);
  ok(
    inspection.errors.includes(
      "content_hash does not match canonical receipt payload",
    ),
  );
  doesNotMatch(JSON.stringify(inspection), /memo-key-after-tamper|memo-key-static-world/);
});

test("null signer is accepted only as an explicit honest non-signature state", () => {
  const receipt = createReceiptV0(makeReceiptInput());

  deepEqual(receipt.sig, {
    scheme: "none",
    null_reason: "single-host v0.1 fixture; no cross-domain non-repudiation",
  });
  equal(verifyReceiptV0(receipt).ok, true);

  const deceptive = {
    ...receipt,
    sig: { scheme: "none", signature: "not-a-real-signature" },
  };
  const verification = verifyReceiptV0(deceptive);

  equal(verification.ok, false);
  ok(
    !verification.ok &&
      verification.errors.some((error) => error.includes("sig.signature")),
  );
  ok(
    !verification.ok &&
      verification.errors.includes("sig.null_reason must be a non-empty string"),
  );
});

test("null signer adapter not configured state is explicit and non-throwing", () => {
  const sig = createNullSignerReceiptSignatureV0();
  const receipt = createReceiptV0({
    ...makeReceiptInput(),
    sig,
  });

  deepEqual(sig, {
    scheme: "none",
    null_reason: "no-signer-adapter-configured",
  });
  deepEqual(receipt.sig, sig);
  equal(verifyReceiptV0(receipt).ok, true);
});

test("non-null receipt signatures are rejected honestly in v0.1", () => {
  const signed = createReceiptWithoutVerifying({
    ...makeReceiptInput(),
    sig: {
      scheme: "ed25519:test",
      signer_id: "test-signer",
      signature: "detached-signature-bytes",
      signed_payload_hash: HASH_A,
    },
  });

  const verification = verifyReceiptV0(signed);

  equal(verification.ok, false);
  ok(
    !verification.ok &&
      verification.errors.includes(
        "non-null signatures are not supported in receipt v0.1; null signer is the only honest v0.1 state",
      ),
  );
});

test("fresh-vs-reused token truth is recoverable from one receipt", () => {
  const receipt = createReceiptV0(
    makeReceiptInput({
      tokens: { fresh: 0, reused: 1247 },
      eventCause: "forecast-recheck",
      recheckKind: "plan-age",
      tags: ["memo-hit", "plan-audit"],
    }),
  );

  deepEqual(readTokenTruthV0(receipt), {
    responsibility_id: "responsibility.incident-briefing",
    run_id: "run-2026-05-18T12:00:00Z",
    provider: "cradle-double",
    model: "deterministic-replay",
    role: "judge",
    tags: ["memo-hit", "plan-audit"],
    as_of: "2026-05-18T12:00:00Z",
    fresh: 0,
    reused: 1247,
    surprise_cause: "forecast-recheck",
  });
});

test("forecast recheck shape is explicit and never a fourth surprise cause", () => {
  const missingRecheckKind = createReceiptWithoutVerifying(
    makeReceiptInput({ eventCause: "forecast-recheck" }),
  );
  const missingVerification = verifyReceiptV0(missingRecheckKind);

  equal(missingVerification.ok, false);
  ok(
    !missingVerification.ok &&
      missingVerification.errors.includes(
        "core.recheck_kind must be one of evidence-age, plan-age",
      ),
  );

  const extraRecheckKind = createReceiptWithoutVerifying(
    makeReceiptInput({ eventCause: "real-input", recheckKind: "evidence-age" }),
  );
  const extraVerification = verifyReceiptV0(extraRecheckKind);

  equal(extraVerification.ok, false);
  ok(
    !extraVerification.ok &&
      extraVerification.errors.includes(
        "core.recheck_kind is only valid for forecast-recheck",
      ),
  );
});

test("composition pins reject duplicates instead of normalizing silently", () => {
  const duplicateConsumedReceipt = createReceiptWithoutVerifying({
    ...makeReceiptInput(),
    composition: {
      cycle_checked: true,
      consumed_receipts: [
        {
          upstream_content_hash: HASH_C,
          contract_revision: HASH_A,
          acceptable_signer_set: ["none"],
        },
        {
          upstream_content_hash: HASH_C,
          contract_revision: HASH_B,
          acceptable_signer_set: ["none"],
        },
      ],
    },
  });
  const verification = verifyReceiptV0(duplicateConsumedReceipt);

  equal(verification.ok, false);
  ok(
    !verification.ok &&
      verification.errors.includes(
        "composition.consumed_receipts[1].upstream_content_hash duplicates a consumed receipt",
      ),
  );
});

test("composition pins require an explicit acceptable signer set", () => {
  const emptySignerSetReceipt = createReceiptWithoutVerifying({
    ...makeReceiptInput(),
    composition: {
      cycle_checked: true,
      consumed_receipts: [
        {
          upstream_content_hash: HASH_C,
          contract_revision: HASH_A,
          acceptable_signer_set: [],
        },
      ],
    },
  });
  const verification = verifyReceiptV0(emptySignerSetReceipt);

  equal(verification.ok, false);
  ok(
    !verification.ok &&
      verification.errors.includes(
        "composition.consumed_receipts[0].acceptable_signer_set must not be empty",
      ),
  );
});

test("composed receipts require transitive freshness proof for consumed receipts", () => {
  const missingFreshnessProof = createReceiptWithoutVerifying({
    ...makeReceiptInput(),
    composition: {
      cycle_checked: true,
      consumed_receipts: [
        {
          upstream_content_hash: HASH_C,
          contract_revision: HASH_A,
          acceptable_signer_set: ["none"],
        },
      ],
    },
  });
  const missingVerification = verifyReceiptV0(missingFreshnessProof);

  equal(missingVerification.ok, false);
  ok(
    !missingVerification.ok &&
      missingVerification.errors.includes(
        "freshness.transitive_freshness_policy_ref is required when receipts are consumed",
      ),
  );
  ok(
    !missingVerification.ok &&
      missingVerification.errors.includes(
        "freshness.consumed_freshness_evaluated is required when receipts are consumed",
      ),
  );

  const mismatchedFreshnessProof = createReceiptWithoutVerifying({
    ...makeReceiptInput(),
    freshness: {
      ...makeReceiptInput().freshness,
      transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
      consumed_freshness_evaluated: [
        {
          receipt_hash: HASH_B,
          next_forecast_recheck: "2026-05-19T12:00:00Z",
          staleness_outcome: "fresh",
        },
      ],
    },
    composition: {
      cycle_checked: true,
      consumed_receipts: [
        {
          upstream_content_hash: HASH_C,
          contract_revision: HASH_A,
          acceptable_signer_set: ["none"],
        },
      ],
    },
  });
  const mismatchVerification = verifyReceiptV0(mismatchedFreshnessProof);

  equal(mismatchVerification.ok, false);
  ok(
    !mismatchVerification.ok &&
      mismatchVerification.errors.includes(
        "freshness.consumed_freshness_evaluated[0].receipt_hash must match a consumed receipt",
      ),
  );
});

test("receipt proof inspection carries composed proof counts and pins", () => {
  const receipt = createReceiptV0(
    makeReceiptInput({
      composition: {
        cycle_checked: true,
        consumed_receipts: [
          {
            upstream_content_hash: HASH_C,
            contract_revision: HASH_B,
            acceptable_signer_set: ["none", "ed25519:team-a"],
          },
        ],
      },
      freshness: {
        as_of: "2026-05-18T12:00:00Z",
        next_forecast_recheck: "2026-05-19T12:00:00Z",
        transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
        consumed_freshness_evaluated: [
          {
            receipt_hash: HASH_C,
            next_forecast_recheck: "2026-05-19T00:00:00Z",
            staleness_outcome: "fresh",
          },
        ],
      },
    }),
  );

  const inspection = inspectReceiptProofV0(receipt);

  equal(inspection.ok, true);
  deepEqual(inspection.freshness, {
    as_of: "2026-05-18T12:00:00Z",
    next_forecast_recheck: "2026-05-19T12:00:00Z",
    transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
    consumed_freshness_evaluated_count: 1,
  });
  deepEqual(inspection.composition, {
    consumed_receipt_count: 1,
    consumed_receipts: [
      {
        upstream_content_hash: HASH_C,
        contract_revision: HASH_B,
        acceptable_signer_set: ["none", "ed25519:team-a"],
      },
    ],
    cycle_checked: true,
  });
});

test("receipt proof inspection is exported from root and package subpath", () => {
  equal(typeof rootSurface.inspectReceiptProofV0, "function");
  equal(typeof inspectReceiptProofV0, "function");

  const packageJson = readPackageJson();

  deepEqual(packageJson.exports?.["./receipt"], {
    types: "./dist/receipt/index.d.ts",
    default: "./dist/receipt/index.js",
  });
});

test("core evidence input ids must be content-addressed receipt refs", () => {
  const receipt = createReceiptV0(makeReceiptInput());
  const pathBackedReceipt = {
    ...receipt,
    core: {
      ...receipt.core,
      evidence_input_ids: ["fixtures/local-evidence.json"],
    },
  } as unknown as ReceiptV0;

  const verification = verifyReceiptV0(pathBackedReceipt);

  equal(verification.ok, false);
  ok(
    !verification.ok &&
      verification.errors.includes(
        "core.evidence_input_ids[0] must use sha256:<64 lowercase hex>",
      ),
  );
});

interface MakeReceiptInputOptions {
  readonly eventCause?: "real-input" | "forecast-recheck" | "escalation";
  readonly recheckKind?: "evidence-age" | "plan-age";
  readonly composition?: ReceiptV0Input["composition"];
  readonly freshness?: ReceiptV0Input["freshness"];
  readonly tokens?: {
    readonly fresh: number;
    readonly reused: number;
  };
  readonly tags?: readonly string[];
}

interface ReactorPackageJson {
  readonly exports?: Record<string, unknown>;
}

function makeReceiptInput(options: MakeReceiptInputOptions = {}): ReceiptV0Input {
  const asOf = "2026-05-18T12:00:00Z";
  const eventCause = options.eventCause ?? "real-input";
  const core = {
    responsibility_id: "responsibility.incident-briefing",
    contract_revision: HASH_A,
    event_cause: eventCause,
    ...(options.recheckKind === undefined
      ? {}
      : { recheck_kind: options.recheckKind }),
    memo_key: "memo-key-static-world",
    evidence_input_ids: [HASH_B],
    as_of: asOf,
    role: "judge" as const,
  };

  return {
    core,
    sig: {
      scheme: "none",
      null_reason: "single-host v0.1 fixture; no cross-domain non-repudiation",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.91,
        derivation_method: "cradle-double-calibration",
        calibration_grade: "authored",
        label_source: "static-world-anchor",
      },
    },
    freshness: options.freshness ?? {
      as_of: asOf,
      next_forecast_recheck: "2026-05-19T12:00:00Z",
    },
    composition: options.composition ?? {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "cradle-double",
      model: "deterministic-replay",
      role: "judge",
      tags: options.tags ?? ["static-world"],
      responsibility_id: "responsibility.incident-briefing",
      run_id: "run-2026-05-18T12:00:00Z",
      as_of: asOf,
      tokens: options.tokens ?? { fresh: 37, reused: 0 },
      surprise_cause: eventCause,
    },
  };
}

function readPackageJson(): ReactorPackageJson {
  const packageJsonPath = join(__dirname, "..", "..", "..", "package.json");
  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as ReactorPackageJson;
}

function createReceiptWithoutVerifying(input: ReceiptV0Input): ReceiptV0 {
  const validInput = makeReceiptInput();
  const validReceipt = createReceiptV0(validInput);
  const receipt = {
    ...validReceipt,
    core: input.core,
    sig: input.sig,
    verdict: input.verdict,
    freshness: input.freshness,
    composition: input.composition,
    cost: input.cost,
  };

  return receipt;
}
