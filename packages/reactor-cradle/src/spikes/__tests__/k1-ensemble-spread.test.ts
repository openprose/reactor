import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  K1_ENSEMBLE_SPREAD_SCHEMA_V0,
  K1_ENSEMBLE_SPREAD_VERSION_V0,
  type K1DiversityFloorComponentV0,
  type K1EnsembleSpreadFixtureV0,
  type K1RecordedModelOutputV0,
  evaluateK1EnsembleSpreadV0,
} from "../k1-ensemble-spread";

const FIXTURE_DIR = join(process.cwd(), "src", "spikes", "fixtures");
const DIVERSE_FIXTURE = join(FIXTURE_DIR, "k1-diverse-calibrated.json");
const LIVE_RECORDED_FIXTURE = join(FIXTURE_DIR, "k1-live-recorded.json");
const CORRELATED_FIXTURE = join(
  FIXTURE_DIR,
  "k1-single-family-correlated.json",
);

test("recorded diverse ensemble scores against the anchor as calibrated confidence", () => {
  const fixture = loadFixture(DIVERSE_FIXTURE);
  const result = evaluateK1EnsembleSpreadV0(fixture);

  equal(fixture.schema, K1_ENSEMBLE_SPREAD_SCHEMA_V0);
  equal(fixture.v, K1_ENSEMBLE_SPREAD_VERSION_V0);
  equal(result.ok, true);
  equal(result.status, "calibrated");
  equal(result.accepted_as_calibrated_confidence, true);
  equal(result.issues.length, 0);
  equal(result.diversity.floor_met, true);
  deepEqual(result.diversity.missing, []);
  ok(result.diversity.families.length >= 2);
  ok(result.diversity.providers.length >= 2);
  ok(result.diversity.size_classes.length >= 2);
  equal(result.metrics.output_count, fixture.outputs.length);
  ok(result.metrics.spread <= fixture.calibration_bar.low_spread_threshold);
  ok(result.metrics.mean_anchor_error <= fixture.calibration_bar.max_mean_error);
  ok(
    result.metrics.spread_error_gap <=
      fixture.calibration_bar.max_spread_error_gap,
  );
  ok(result.metrics.calibrated_confidence !== null);
  ok(result.output_scores.every((score) => score.matches_anchor_verdict));
});

test("live-recorded OpenRouter ensemble scores against the anchor as calibrated confidence", () => {
  const fixture = loadFixture(LIVE_RECORDED_FIXTURE);
  const result = evaluateK1EnsembleSpreadV0(fixture);
  const recording = (fixture as unknown as {
    readonly recording?: {
      readonly spend_usd?: number;
      readonly outputs?: readonly {
        readonly request_id?: string;
        readonly response_id?: string;
        readonly latency_ms?: number;
        readonly finish_reason?: string;
        readonly usage?: unknown;
      }[];
    };
  }).recording;

  equal(result.ok, true);
  equal(result.status, "calibrated");
  equal(result.accepted_as_calibrated_confidence, true);
  equal(result.issues.length, 0);
  equal(result.diversity.floor_met, true);
  ok(result.diversity.families.length >= 2);
  ok(result.diversity.providers.length >= 2);
  ok(result.diversity.size_classes.length >= 2);
  ok((recording?.spend_usd ?? 0) > 0);
  ok((recording?.spend_usd ?? 2) < 2);
  equal(recording?.outputs?.length, fixture.outputs.length);
  ok(recording?.outputs?.every((output) => typeof output.request_id === "string" && output.request_id.length > 0));
  ok(recording?.outputs?.every((output) => typeof output.response_id === "string" && output.response_id.length > 0));
  ok(recording?.outputs?.every((output) => typeof output.latency_ms === "number" && output.latency_ms >= 0));
  ok(recording?.outputs?.every((output) => output.finish_reason === "stop"));
  ok(recording?.outputs?.every((output) => typeof output.usage === "object" && output.usage !== null));
});

test("single-family correlated outputs auto-degrade despite low spread", () => {
  const fixture = loadFixture(CORRELATED_FIXTURE);
  const result = evaluateK1EnsembleSpreadV0(fixture);

  equal(result.ok, false);
  equal(result.status, "degraded");
  equal(result.accepted_as_calibrated_confidence, false);
  equal(result.metrics.calibrated_confidence, null);
  equal(result.diversity.floor_met, false);
  deepEqual(result.diversity.missing, [
    "model-family",
    "provider",
    "size-boundary",
  ]);
  ok(result.metrics.spread <= fixture.calibration_bar.low_spread_threshold);
  ok(result.metrics.mean_anchor_error > result.metrics.spread);
  ok(result.output_scores.every((score) => !score.matches_anchor_verdict));
  deepEqual(issueCodes(result), [
    "diversity-floor-unmet",
    "mean-error-too-high",
    "spread-error-gap-too-high",
    "low-spread-anchor-error",
  ]);
});

test("diversity floor is conjunctive before spread can be calibrated", () => {
  const fixture = loadFixture(DIVERSE_FIXTURE);
  const cases: readonly {
    readonly name: string;
    readonly missing: K1DiversityFloorComponentV0;
    readonly mutate: (
      output: K1RecordedModelOutputV0,
    ) => K1RecordedModelOutputV0;
  }[] = [
    {
      name: "one family",
      missing: "model-family",
      mutate: (output) => ({ ...output, family: "gpt" }),
    },
    {
      name: "one provider",
      missing: "provider",
      mutate: (output) => ({ ...output, provider: "openai" }),
    },
    {
      name: "one size class",
      missing: "size-boundary",
      mutate: (output) => ({ ...output, size_class: "small" }),
    },
  ];

  for (const item of cases) {
    const result = evaluateK1EnsembleSpreadV0({
      ...fixture,
      fixture_id: `${fixture.fixture_id}.${item.name}`,
      outputs: fixture.outputs.map(item.mutate),
    });

    equal(result.status, "degraded", item.name);
    equal(result.accepted_as_calibrated_confidence, false, item.name);
    equal(result.metrics.calibrated_confidence, null, item.name);
    ok(result.diversity.missing.includes(item.missing), item.name);
    ok(issueCodes(result).includes("diversity-floor-unmet"), item.name);
  }
});

function loadFixture(path: string): K1EnsembleSpreadFixtureV0 {
  return JSON.parse(readFileSync(path, "utf8")) as K1EnsembleSpreadFixtureV0;
}

function issueCodes(result: {
  readonly issues: readonly { readonly code: string }[];
}): readonly string[] {
  return result.issues.map((issue) => issue.code);
}
