import { deepEqual, equal, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";

import * as rootSurface from "../../index";
import {
  type ReceiptV0Input,
  createReceiptV0,
  inspectReceiptProofV0,
} from "../../receipt";
import {
  RECEIPT_PROJECTION_SCHEMA,
  RECEIPT_PROJECTION_VERSION,
  RECEIPT_PROJECTION_TIERS_V0,
  type ReceiptProjectionResultV0,
  projectReceiptProofV0,
  projectReceiptV0,
} from "../index";

const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const HASH_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const HASH_D =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const AS_OF = "2026-05-18T12:00:00Z";
const NEXT_RECHECK = "2026-05-19T12:00:00Z";

test("receipt projections are deterministic across owner subscriber and public tiers", () => {
  const receipt = createReceiptV0(
    makeReceiptInput({
      status: "drifting",
      tokens: { fresh: 12, reused: 34 },
      composition: {
        consumed_receipts: [
          {
            upstream_content_hash: HASH_C,
            contract_revision: HASH_D,
            acceptable_signer_set: ["none", "ed25519:team-a"],
          },
        ],
        cycle_checked: true,
      },
      freshness: {
        as_of: AS_OF,
        next_forecast_recheck: NEXT_RECHECK,
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

  const publicResult = projectReceiptV0({ tier: "public", receipt });
  assertProjectionOk(publicResult);
  deepEqual(publicResult.projection, {
    schema: RECEIPT_PROJECTION_SCHEMA,
    v: RECEIPT_PROJECTION_VERSION,
    tier: "public",
    receipt_id: receipt.content_hash,
    content_hash: receipt.content_hash,
    contract_revision: HASH_A,
    status: "drifting",
    signer: {
      kind: "null",
      scheme: "none",
    },
    freshness: {
      as_of: AS_OF,
      next_forecast_recheck: NEXT_RECHECK,
      transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
      consumed_freshness_evaluated_count: 1,
    },
    composition: {
      consumed_receipt_count: 1,
      consumed_receipts: [
        {
          upstream_content_hash: HASH_C,
          contract_revision: HASH_D,
          acceptable_signer_set_count: 2,
        },
      ],
      cycle_checked: true,
    },
    token_truth: {
      fresh: 12,
      reused: 34,
      role: "judge",
      surprise_cause: "real-input",
    },
  });

  const subscriberResult = projectReceiptV0({ tier: "subscriber", receipt });
  assertProjectionOk(subscriberResult);
  deepEqual(subscriberResult.projection, {
    schema: RECEIPT_PROJECTION_SCHEMA,
    v: RECEIPT_PROJECTION_VERSION,
    tier: "subscriber",
    receipt_id: receipt.content_hash,
    content_hash: receipt.content_hash,
    contract_revision: HASH_A,
    status: "drifting",
    signer: {
      kind: "null",
      scheme: "none",
    },
    freshness: {
      as_of: AS_OF,
      next_forecast_recheck: NEXT_RECHECK,
      transitive_freshness_policy_ref: "policy.transitive-freshness@v0",
      consumed_freshness_evaluated_count: 1,
    },
    responsibility_id: "responsibility.incident-briefing",
    role: "judge",
    composition: {
      consumed_receipt_count: 1,
      consumed_receipts: [
        {
          upstream_content_hash: HASH_C,
          contract_revision: HASH_D,
          acceptable_signer_set: ["none", "ed25519:team-a"],
        },
      ],
      cycle_checked: true,
    },
    token_truth: {
      fresh: 12,
      reused: 34,
      provider: "cradle-double",
      model: "deterministic-replay",
      role: "judge",
      surprise_cause: "real-input",
    },
  });

  const ownerResult = projectReceiptV0({ tier: "owner", receipt });
  assertProjectionOk(ownerResult);
  equal(ownerResult.projection.tier, "owner");
  if (ownerResult.projection.tier !== "owner") {
    throw new Error("expected owner projection");
  }
  equal(ownerResult.projection.proof.content_hash, receipt.content_hash);
  deepEqual(ownerResult.projection.verdict.confidence, {
    value: 0.91,
    derivation_method: "cradle-double-calibration",
    calibration_grade: "authored",
    label_source: "static-world-anchor",
  });
});

test("receipt proof projection consumes inspection output without the raw receipt", () => {
  const receipt = createReceiptV0(makeReceiptInput({ status: "down" }));
  const proof = inspectReceiptProofV0(receipt);

  const subscriberResult = projectReceiptProofV0({
    tier: "subscriber",
    proof,
    status: "down",
  });
  assertProjectionOk(subscriberResult);
  equal(subscriberResult.projection.status, "down");
  equal(subscriberResult.projection.content_hash, receipt.content_hash);

  const publicResult = projectReceiptProofV0({ tier: "public", proof });
  assertProjectionOk(publicResult);
  equal(publicResult.projection.status, null);
  equal(publicResult.projection.content_hash, receipt.content_hash);
});

test("public and subscriber projections omit hostile private receipt payloads", () => {
  const hostileSecret = ["sk", "or-hostile-secret-1234567890"].join("-");
  const hostileBearer = ["Bear", "er"].join("") + " credential_1234567890";
  const hostileEmail = "customer.owner@example.com";
  const hostilePrivateUrl =
    "https://case.internal/v1/raw/customer?token=alpha1234567890";
  const hostileApiKey = ["api", "key"].join("_") + "=value_1234567890";
  const customerPayload = "customer payload: legal matter alpha";
  const receipt = createReceiptV0(
    makeReceiptInput({
      memoKey: hostileSecret,
      runId: hostileEmail,
      tags: [hostilePrivateUrl, hostileApiKey, "raw-evidence-ish"],
      providerNorm: {
        schema: "provider.norm.fixture",
        raw_evidence_payload: {
          customer_payload: customerPayload,
          judge_rationale: hostileBearer,
          private_url: hostilePrivateUrl,
        },
        auth_trace: hostileSecret,
      },
    }),
  );

  const publicResult = projectReceiptV0({ tier: "public", receipt });
  const subscriberResult = projectReceiptV0({ tier: "subscriber", receipt });
  assertProjectionOk(publicResult);
  assertProjectionOk(subscriberResult);

  const serialized = JSON.stringify([
    publicResult.projection,
    subscriberResult.projection,
  ]);
  for (const hostileValue of [
    hostileSecret,
    hostileBearer,
    hostileEmail,
    hostilePrivateUrl,
    hostileApiKey,
    customerPayload,
  ]) {
    ok(!serialized.includes(hostileValue));
  }

  const keys = collectKeys([publicResult.projection, subscriberResult.projection]);
  for (const privateKey of [
    "customer_payload",
    "judge_rationale",
    "memo_key",
    "provider_norm",
    "rationale",
    "raw_evidence_payload",
    "run_id",
    "tags",
  ]) {
    ok(!keys.has(privateKey));
  }
  ok(serialized.includes(receipt.content_hash));
  ok(serialized.includes(HASH_A));
});

test("public and subscriber projections fail closed when a public field is secret shaped", () => {
  const privatePolicyRef =
    "https://policy.internal/freshness?token=secret1234567890";
  const receipt = createReceiptV0(
    makeReceiptInput({
      freshness: {
        as_of: AS_OF,
        next_forecast_recheck: NEXT_RECHECK,
        transitive_freshness_policy_ref: privatePolicyRef,
        consumed_freshness_evaluated: [
          {
            receipt_hash: HASH_C,
            next_forecast_recheck: "2026-05-19T00:00:00Z",
            staleness_outcome: "fresh",
          },
        ],
      },
      composition: {
        consumed_receipts: [
          {
            upstream_content_hash: HASH_C,
            contract_revision: HASH_D,
            acceptable_signer_set: ["none"],
          },
        ],
        cycle_checked: true,
      },
    }),
  );

  for (const tier of ["public", "subscriber"] as const) {
    const result = projectReceiptV0({ tier, receipt });
    assertProjectionFailure(result);
    deepEqual(result.errors, ["projection would expose secret-shaped data"]);
    ok(!JSON.stringify(result).includes(privatePolicyRef));
  }

  const ownerResult = projectReceiptV0({ tier: "owner", receipt });
  assertProjectionOk(ownerResult);
});

test("projection failures never echo malformed private receipt or proof data", () => {
  const hostileBearer = ["Bear", "er"].join("") + " credential_1234567890";
  const customerPayload = "customer payload: sealed evidence beta";
  const receipt = createReceiptV0(makeReceiptInput());
  const malformedReceipt = {
    ...receipt,
    verdict: {
      ...receipt.verdict,
      rationale: hostileBearer,
    },
    raw_evidence_payload: {
      customer_payload: customerPayload,
    },
  };

  const malformedReceiptResult = projectReceiptV0({
    tier: "public",
    receipt: malformedReceipt,
  });
  assertProjectionFailure(malformedReceiptResult);
  deepEqual(malformedReceiptResult.errors, ["receipt failed verification"]);
  ok(!JSON.stringify(malformedReceiptResult).includes(hostileBearer));
  ok(!JSON.stringify(malformedReceiptResult).includes(customerPayload));

  const proof = inspectReceiptProofV0(receipt);
  const malformedProofResult = projectReceiptProofV0({
    tier: "subscriber",
    status: "up",
    proof: {
      ...proof,
      content_hash: "not-a-content-hash",
      token_truth: {
        ...proof.token_truth,
        provider: "customer.owner@example.com",
      },
    },
  });
  assertProjectionFailure(malformedProofResult);
  ok(!JSON.stringify(malformedProofResult).includes("customer.owner@example.com"));
});

test("unknown projection tiers fail closed", () => {
  const receipt = createReceiptV0(makeReceiptInput());

  deepEqual(projectReceiptV0({ tier: "partner", receipt }), {
    ok: false,
    tier: null,
    errors: ["unknown projection tier"],
    projection: null,
  });
});

test("projection public surface is exported from root and package subpath", () => {
  equal(typeof rootSurface.projectReceiptV0, "function");
  equal(typeof rootSurface.projectReceiptProofV0, "function");
  deepEqual(RECEIPT_PROJECTION_TIERS_V0, ["owner", "subscriber", "public"]);

  const packageJson = readPackageJson();
  deepEqual(packageJson.exports?.["./projection"], {
    types: "./dist/projection/index.d.ts",
    default: "./dist/projection/index.js",
  });

  const require = createRequire(__filename);
  const projectionModule = require(join(__dirname, "..", "index.js")) as Record<
    string,
    unknown
  >;
  equal(typeof projectionModule["projectReceiptV0"], "function");
  equal(typeof projectionModule["projectReceiptProofV0"], "function");
});

interface MakeReceiptOptions {
  readonly status?: "up" | "drifting" | "down" | "blocked";
  readonly memoKey?: string;
  readonly runId?: string;
  readonly tags?: readonly string[];
  readonly providerNorm?: ReceiptV0Input["cost"]["provider_norm"];
  readonly freshness?: ReceiptV0Input["freshness"];
  readonly composition?: ReceiptV0Input["composition"];
  readonly tokens?: {
    readonly fresh: number;
    readonly reused: number;
  };
}

interface ReactorPackageJson {
  readonly exports?: Record<string, unknown>;
}

function makeReceiptInput(options: MakeReceiptOptions = {}): ReceiptV0Input {
  return {
    core: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: HASH_A,
      event_cause: "real-input",
      memo_key: options.memoKey ?? "memo-key-static-world",
      evidence_input_ids: [HASH_B],
      as_of: AS_OF,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "single-host v0.1 fixture; no cross-domain non-repudiation",
    },
    verdict: {
      status: options.status ?? "up",
      confidence: {
        value: 0.91,
        derivation_method: "cradle-double-calibration",
        calibration_grade: "authored",
        label_source: "static-world-anchor",
      },
    },
    freshness: options.freshness ?? {
      as_of: AS_OF,
      next_forecast_recheck: NEXT_RECHECK,
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
      run_id: options.runId ?? "run-static-world",
      as_of: AS_OF,
      tokens: options.tokens ?? { fresh: 37, reused: 0 },
      surprise_cause: "real-input",
      ...(options.providerNorm === undefined
        ? {}
        : { provider_norm: options.providerNorm }),
    },
  };
}

function assertProjectionOk(
  result: ReceiptProjectionResultV0,
): asserts result is Extract<ReceiptProjectionResultV0, { readonly ok: true }> {
  equal(result.ok, true);
}

function assertProjectionFailure(
  result: ReceiptProjectionResultV0,
): asserts result is Extract<ReceiptProjectionResultV0, { readonly ok: false }> {
  equal(result.ok, false);
}

function collectKeys(value: unknown): Set<string> {
  const keys = new Set<string>();
  visitKeys(value, keys);
  return keys;
}

function visitKeys(value: unknown, keys: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      visitKeys(item, keys);
    }
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    keys.add(key);
    visitKeys(item, keys);
  }
}

function readPackageJson(): ReactorPackageJson {
  const packageJsonPath = join(__dirname, "..", "..", "..", "package.json");
  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as ReactorPackageJson;
}
