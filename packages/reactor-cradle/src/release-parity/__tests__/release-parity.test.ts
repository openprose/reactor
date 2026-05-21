import { deepEqual, equal, match, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  projectCradleEvalResultV0,
  renderCradleEvalProjectionReportMarkdownV0,
  renderCradleEvalReportMarkdownV0,
} from "../../eval";
import {
  R6_RELEASE_PARITY_CASE_IDS_V0,
  assertRecordedR6ReleaseParitySuiteV0,
  buildR6ReleaseParityEvalResultV0,
  makeRecordedR6ReleaseParitySuiteV0,
  runRecordedR6ReleaseParityProofV0,
  type RecordedR6ReleaseParityCaseV0,
  type RecordedR6ReleaseParitySuiteV0,
  type R6ReleaseParityCaseIdV0,
} from "../index";

test("builds a deterministic R6 release-parity suite with explicit deferred budget exhaustion", () => {
  const suite = makeRecordedR6ReleaseParitySuiteV0();
  const repeated = makeRecordedR6ReleaseParitySuiteV0();

  deepEqual(repeated, suite);
  assertRecordedR6ReleaseParitySuiteV0(suite);
  equal(suite.suite_id, "v0.4-r6-release-parity-fixture-floor");
  equal(suite.world_profile, "recorded-release-parity");
  match(suite.registry_content_hash, /^sha256:[a-f0-9]{64}$/);
  deepEqual(
    suite.cases.map((item) => item.case_id),
    [...R6_RELEASE_PARITY_CASE_IDS_V0],
  );
  deepEqual(
    suite.deferred_cases.map((item) => item.case_id),
    ["down-after-budget-exhaustion"],
  );
  match(
    suite.deferred_cases[0]?.reason ?? "",
    /typed retry-budget or pressure-dispatch primitive/,
  );
});

test("runs R6 parity proof across memory/filesystem rows with Postgres marked future", () => {
  const proof = runRecordedR6ReleaseParityProofV0();

  equal(proof.parity.ok, true);
  equal(proof.parity.ready_rows_run, 2);
  equal(proof.parity.future_rows, 1);
  deepEqual(
    proof.parity.rows.map((row) => `${row.adapter_name}:${row.status}`),
    [
      "deterministic-in-memory:passed",
      "filesystem:passed",
      "postgres:future",
    ],
  );
  equal(proof.assertions.length, R6_RELEASE_PARITY_CASE_IDS_V0.length);
  ok(proof.assertions.every((item) => item.status === "pass"));
  match(proof.replay_snapshot.content_hash, /^sha256:[a-f0-9]{64}$/);
});

test("R6 recorded cases preserve the release semantics without live services", () => {
  const suite = makeRecordedR6ReleaseParitySuiteV0();
  const forecast = requiredCase(suite, "forecast-pulls-judge-earlier");
  const duplicate = requiredCase(suite, "duplicate-event-idempotency");
  const stale = requiredCase(suite, "stale-status-fencing");
  const contract = requiredCase(suite, "contract-revision-fencing");
  const recompile = requiredCase(
    suite,
    "policy-recompile-byte-identical-registry",
  );
  const memo = requiredCase(suite, "memoized-verdict-zero-fresh-tokens");

  const forecastReceipt = requiredReceipt(forecast, 0);
  equal(forecastReceipt.verdict.status, "blocked");
  equal(forecastReceipt.core.event_cause, "forecast-recheck");
  equal(forecastReceipt.core.recheck_kind, "evidence-age");
  equal(forecastReceipt.cost.tokens.fresh, 0);

  const duplicateMemoHit = requiredReceipt(duplicate, 1);
  equal(duplicateMemoHit.cost.provider, "memo");
  equal(duplicateMemoHit.cost.tokens.fresh, 0);
  equal(duplicate.decisions[0]?.outcome, "one-decision-for-duplicate-event");

  const staleBlocked = requiredReceipt(stale, 1);
  equal(staleBlocked.verdict.status, "blocked");
  equal(
    staleBlocked.freshness.consumed_freshness_evaluated?.[0]?.staleness_outcome,
    "stale-blocked",
  );
  equal(stale.decisions[0]?.outcome, "stale-blocked");

  const contractBlocked = requiredReceipt(contract, 1);
  equal(contractBlocked.verdict.status, "blocked");
  match(contractBlocked.verdict.blocked?.reason ?? "", /contract revision/);
  equal(contract.decisions[0]?.outcome, "contract-mismatch-blocked");

  const registryObserved = recompile.trace[0]?.observed;
  ok(isRecord(registryObserved));
  equal(registryObserved["byte_identical"], true);
  equal(
    registryObserved["before_registry_hash"],
    registryObserved["after_registry_hash"],
  );

  const memoHit = requiredReceipt(memo, 1);
  equal(memoHit.cost.provider, "memo");
  equal(memoHit.cost.tokens.fresh, 0);
  ok(memoHit.cost.tokens.reused > 0);
});

test("builds eval, projection, and Markdown evidence for represented R6 cases", () => {
  const proof = runRecordedR6ReleaseParityProofV0();
  const evalResult = buildR6ReleaseParityEvalResultV0(proof);
  const publicProjection = projectCradleEvalResultV0(evalResult, "public");
  const report = renderCradleEvalReportMarkdownV0(evalResult);
  const projectionReport =
    renderCradleEvalProjectionReportMarkdownV0(publicProjection);

  equal(evalResult.overall_status, "pass");
  equal(evalResult.metrics.case_count, R6_RELEASE_PARITY_CASE_IDS_V0.length);
  equal(evalResult.metrics.assertion_count, R6_RELEASE_PARITY_CASE_IDS_V0.length);
  equal(evalResult.metrics.replay_parity_pass_count, 1);
  equal(evalResult.metrics.replay_parity_ready_rows_run, 2);
  equal(evalResult.metrics.replay_parity_future_rows, 1);
  equal(evalResult.model_matrix.status, "not-run");
  equal(publicProjection.source_content_hash, evalResult.content_hash);
  equal(publicProjection.overall_status, "pass");
  match(report, /v0\.4-r6-release-parity-fixture-floor/);
  match(report, /forecast-pulls-judge-earlier/);
  match(projectionReport, /Cradle Eval Projection/);
});

test("root and release-parity subpath expose the R6 helpers", () => {
  const root = require("../../index") as Record<string, unknown>;
  const subpath = require("@openprose/reactor-cradle/release-parity") as Record<
    string,
    unknown
  >;

  equal(typeof root["makeRecordedR6ReleaseParitySuiteV0"], "function");
  equal(typeof root["runRecordedR6ReleaseParityProofV0"], "function");
  equal(typeof root["buildR6ReleaseParityEvalResultV0"], "function");
  equal(typeof subpath["makeRecordedR6ReleaseParitySuiteV0"], "function");
  equal(typeof subpath["runRecordedR6ReleaseParityProofV0"], "function");
  equal(typeof subpath["buildRecordedR6ReleaseParityEvalResultV0"], "function");
});

function requiredCase(
  suite: RecordedR6ReleaseParitySuiteV0,
  caseId: R6ReleaseParityCaseIdV0,
): RecordedR6ReleaseParityCaseV0 {
  const item = suite.cases.find((candidate) => candidate.case_id === caseId);
  if (item === undefined) {
    throw new Error(`missing case ${caseId}`);
  }

  return item;
}

function requiredReceipt(
  item: RecordedR6ReleaseParityCaseV0,
  index: number,
): RecordedR6ReleaseParityCaseV0["receipts"][number] {
  const receipt = item.receipts[index];
  if (receipt === undefined) {
    throw new Error(`missing receipt ${index} for ${item.case_id}`);
  }

  return receipt;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
