import { deepEqual, ok } from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";

import {
  ALLOWED_SURPRISE_CAUSES_V0,
  type ReceiptV0Input,
  createReceiptV0,
  evaluateFlatSpendUnderStaticV0,
  evaluateSurpriseAttributionCompleteV0,
  isTokenBearingReceiptV0,
  readTokenTruthV0,
} from "../../index";

const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

interface ReactorPackageJson {
  readonly exports?: Record<string, unknown>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
}

test("package declares the W7 cost subpath export", () => {
  const packageJson = readPackageJson();

  deepEqual(packageJson.exports?.["./cost"], {
    types: "./dist/cost/index.d.ts",
    default: "./dist/cost/index.js",
  });
});

test("reactor package does not depend on the Cradle package", () => {
  const packageJson = readPackageJson();
  const dependencyMaps = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.optionalDependencies,
    packageJson.peerDependencies,
  ];

  ok(
    dependencyMaps.every(
      (dependencies) =>
        dependencies === undefined ||
        dependencies["@openprose/reactor-cradle"] === undefined,
    ),
  );
});

test("root package surface composes W7 cost helpers with receipt fixtures", () => {
  const receipt = createReceiptV0(makeReceiptInput());

  deepEqual(ALLOWED_SURPRISE_CAUSES_V0, [
    "real-input",
    "forecast-recheck",
    "escalation",
  ]);
  ok(isTokenBearingReceiptV0(receipt));
  deepEqual(evaluateSurpriseAttributionCompleteV0([receipt]), {
    ok: true,
    relationship: "surprise-attribution-complete",
    summary: "all token-bearing receipts name exactly one allowed surprise cause",
    issues: [],
    checked: {
      receipts: 1,
      token_bearing_receipts: 1,
      post_bootstrap_token_bearing_receipts: 0,
      plan_age_audit_floor_receipts: 0,
    },
  });
  deepEqual(
    evaluateFlatSpendUnderStaticV0({
      receipts: [receipt],
      bootstrap_receipt_count: 0,
      world_profile: "static",
    }),
    {
      ok: true,
      relationship: "flat-spend-under-static",
      summary:
        "static-world post-bootstrap fresh spend stayed flat apart from the plan-age audit floor",
      issues: [],
      checked: {
        receipts: 1,
        token_bearing_receipts: 1,
        post_bootstrap_token_bearing_receipts: 1,
        plan_age_audit_floor_receipts: 1,
      },
    },
  );
  deepEqual(readTokenTruthV0(receipt), {
    responsibility_id: "responsibility.incident-briefing",
    run_id: "run-static-world",
    provider: "cradle-double",
    model: "deterministic-replay",
    role: "judge",
    tags: ["static-world", "plan-audit"],
    as_of: "2026-05-18T12:00:00Z",
    fresh: 0,
    reused: 144,
    surprise_cause: "forecast-recheck",
  });
});

const packageRootPath = join(__dirname, "..", "..", "..");
const sourceCostIndexPath = join(packageRootPath, "src", "cost", "index.ts");
const builtCostIndexPath = join(__dirname, "..", "index.js");

test(
  "cost subpath is importable once Worker A implementation lands",
  {
    skip: existsSync(sourceCostIndexPath)
      ? false
      : "Worker A cost implementation is not present in this worktree yet",
  },
  () => {
    const require = createRequire(__filename);
    const costModule = require(builtCostIndexPath) as Record<string, unknown>;

    ok(Object.keys(costModule).length > 0);
  },
);

function readPackageJson(): ReactorPackageJson {
  const packageJsonPath = join(packageRootPath, "package.json");
  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as ReactorPackageJson;
}

function makeReceiptInput(): ReceiptV0Input {
  const asOf = "2026-05-18T12:00:00Z";

  return {
    core: {
      responsibility_id: "responsibility.incident-briefing",
      contract_revision: HASH_A,
      event_cause: "forecast-recheck",
      recheck_kind: "plan-age",
      memo_key: "memo-key-static-world",
      evidence_input_ids: [HASH_B],
      as_of: asOf,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "single-host v0.1 fixture; no cross-domain non-repudiation",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 0.95,
        derivation_method: "cradle-double-calibration",
        calibration_grade: "authored",
        label_source: "static-world-anchor",
      },
    },
    freshness: {
      as_of: asOf,
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
      tags: ["static-world", "plan-audit"],
      responsibility_id: "responsibility.incident-briefing",
      run_id: "run-static-world",
      as_of: asOf,
      tokens: { fresh: 0, reused: 144 },
      surprise_cause: "forecast-recheck",
    },
  };
}
