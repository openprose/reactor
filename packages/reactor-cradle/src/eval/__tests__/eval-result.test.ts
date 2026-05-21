import { deepEqual, equal, fail, match, notEqual, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import type { ContentHashV0 } from "@openprose/reactor/receipt";

import type {
  CradleAssertionResultV0,
  CradleAssertionSuiteResultV0,
} from "../../assert";
import {
  type ReplayByteIdenticalFailV0,
  type ReplayByteIdenticalPassV0,
  REPLAY_PARITY_MATRIX_SCHEMA_V0,
  REPLAY_PARITY_MATRIX_VERSION_V0,
  type ReplayParityMatrixResultV0,
} from "../../replay/parity";
import {
  CRADLE_EVAL_PROJECTION_SCHEMA_V0,
  CRADLE_EVAL_RESULT_SCHEMA_V0,
  buildCradleEvalResultV0,
  projectCradleEvalResultV0,
  renderCradleEvalProjectionReportMarkdownV0,
  renderCradleEvalReportMarkdownV0,
} from "../index";

const GENERATED_AT = "2026-05-18T20:00:00.000Z";
const AS_OF = "2026-05-18T19:45:00.000Z";
const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as ContentHashV0;
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as ContentHashV0;
const HASH_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as ContentHashV0;

test("builds a deterministic eval-result artifact over assertion and parity outputs", () => {
  const artifact = buildPassingArtifact();
  const repeated = buildPassingArtifact();

  deepEqual(repeated, artifact);
  equal(artifact.schema, CRADLE_EVAL_RESULT_SCHEMA_V0);
  equal(artifact.v, 0);
  equal(artifact.generated_at, GENERATED_AT);
  equal(artifact.as_of, AS_OF);
  equal(artifact.suite_id, "v0.4-r2-release-evidence");
  equal(artifact.overall_status, "pass");
  equal(artifact.model_matrix.status, "not-run");
  match(artifact.content_hash, /^sha256:[a-f0-9]{64}$/);
  deepEqual(artifact.replay_parity_summary_hashes, [
    artifact.cases[0]?.replay?.summary_hash,
  ]);
  deepEqual(artifact.metrics, {
    case_count: 1,
    case_pass_count: 1,
    case_fail_count: 0,
    assertion_count: 2,
    assertion_pass_count: 2,
    assertion_fail_count: 0,
    replay_parity_summary_count: 1,
    replay_parity_pass_count: 1,
    replay_parity_fail_count: 0,
    replay_parity_ready_rows_run: 2,
    replay_parity_future_rows: 1,
    evidence_hash_count: 4,
  });
  equal(artifact.cases[0]?.assertions.results[0]?.evidence[0]?.observed_hash !== undefined, true);

  const shifted = buildCradleEvalResultV0({
    ...passingInput(),
    generated_at: "2026-05-18T20:01:00.000Z",
  });
  notEqual(shifted.content_hash, artifact.content_hash);
});

test("renders a Markdown report with hash, summary, case table, deferred matrix note, and evidence hashes", () => {
  const artifact = buildPassingArtifact();
  const report = renderCradleEvalReportMarkdownV0(artifact);

  match(report, /Artifact hash: `sha256:[a-f0-9]{64}`/);
  match(report, /## Pass\/Fail Summary/);
  match(report, /- Overall: pass/);
  match(report, /## Case Table/);
  match(report, /\| Case \| Scenario \| Status \| Assertions \| Replay\/parity \| Evidence hashes \|/);
  match(report, /## Deferred Live Matrix/);
  match(report, /Live model matrix is not-run/);
  match(report, /## Evidence Hashes/);
  match(report, new RegExp(HASH_C));
  match(report, new RegExp(artifact.replay_parity_summary_hashes[0] ?? ""));
});

test("redacts raw assertion observations and replay bytes from artifacts and reports", () => {
  const providerToken = `${["sk", "or"].join("-")}-test-token`;
  const headerToken = `${["Bear", "er"].join("")} test.header`;
  const keyName = ["api", "Key"].join("");
  const replayFail: ReplayByteIdenticalFailV0 = {
    ok: false,
    relationship: "replay-byte-identical",
    expected_hash: HASH_A,
    actual_hash: HASH_B,
    expected_bytes: `{"token":"${providerToken}"}`,
    actual_bytes: `{"header":"${headerToken}"}`,
    evidence_path: "$",
    reason: `payload changed for ${headerToken}`,
  };
  const artifact = buildCradleEvalResultV0({
    suite_id: "v0.4-r2-redaction",
    generated_at: GENERATED_AT,
    as_of: AS_OF,
    model_matrix: {
      status: "not-run",
      reason: `deferred with ${keyName}=local`,
    },
    cases: [
      {
        case_id: "redaction-case",
        assertions: [
          {
            ok: false,
            relationship: "surprise-attribution-complete",
            family: "surprise-attribution-complete",
            status: "fail",
            summary: `missing attribution for ${providerToken}`,
            evidence: [
              {
                path: "trace[0].model_response.payload",
                message: `raw payload contained ${headerToken}`,
                observed: {
                  payload: providerToken,
                  nested: [headerToken],
                },
              },
            ],
          },
        ],
        replay: replayFail,
        evidence_hashes: [HASH_C],
      },
    ],
  });
  const json = JSON.stringify(artifact);
  const report = renderCradleEvalReportMarkdownV0(artifact);

  equal(artifact.overall_status, "fail");
  equal(artifact.cases[0]?.replay?.status, "fail");
  ok(!json.includes(providerToken));
  ok(!json.includes(headerToken));
  ok(!json.includes("expected_bytes"));
  ok(!json.includes("actual_bytes"));
  ok(!report.includes(providerToken));
  ok(!report.includes(headerToken));
  match(json, /\[redacted-secret\]/);
  match(report, /\[redacted-secret\]/);
});

test("projects hostile eval artifacts for public and subscriber tiers without leaking private text", () => {
  const artifact = buildHostilePrivacyArtifact();
  const repeatedPublicProjection = projectCradleEvalResultV0(artifact, "public");
  const publicProjection = projectCradleEvalResultV0(artifact, "public");
  const subscriberProjection = projectCradleEvalResultV0(artifact, "subscriber");
  const evalReport = renderCradleEvalReportMarkdownV0(artifact);
  const projectionReport =
    renderCradleEvalProjectionReportMarkdownV0(publicProjection);
  const projectedAssertion =
    publicProjection.cases[0]?.assertions.results[0] ??
    fail("expected projected assertion");
  const sourceAssertion =
    artifact.cases[0]?.assertions.results[0] ??
    fail("expected source assertion");
  const sourceReplay = artifact.cases[0]?.replay;
  const projectedReplay = publicProjection.cases[0]?.replay;

  deepEqual(repeatedPublicProjection, publicProjection);
  equal(publicProjection.schema, CRADLE_EVAL_PROJECTION_SCHEMA_V0);
  equal(publicProjection.v, 0);
  equal(publicProjection.tier, "public");
  equal(subscriberProjection.tier, "subscriber");
  equal(publicProjection.source_content_hash, artifact.content_hash);
  deepEqual(publicProjection.metrics, artifact.metrics);
  deepEqual(publicProjection.evidence_hashes, artifact.evidence_hashes);
  deepEqual(
    publicProjection.replay_parity_summary_hashes,
    artifact.replay_parity_summary_hashes,
  );
  equal(publicProjection.model_matrix.status, "not-run");
  equal(publicProjection.model_matrix.reason.includes("not-run"), true);
  equal(projectedAssertion.result_hash, sourceAssertion.result_hash);
  deepEqual(
    projectedAssertion.observed_hashes,
    sourceAssertion.evidence.flatMap((item) =>
      item.observed_hash === undefined ? [] : [item.observed_hash],
    ),
  );
  equal(projectedAssertion.evidence_count, sourceAssertion.evidence.length);
  ok(!JSON.stringify(publicProjection).includes("evidence_path"));
  ok(!JSON.stringify(publicProjection).includes("message"));
  ok(!JSON.stringify(publicProjection).includes("path"));
  ok(sourceReplay !== undefined);
  ok(projectedReplay !== undefined);
  equal(projectedReplay.summary_hash, sourceReplay.summary_hash);

  assertPrivacySafe(JSON.stringify(artifact), hostilePrivacyNeedles());
  assertPrivacySafe(evalReport, hostilePrivacyNeedles());
  assertPrivacySafe(JSON.stringify(publicProjection), hostilePrivacyNeedles());
  assertPrivacySafe(JSON.stringify(subscriberProjection), hostilePrivacyNeedles());
  assertPrivacySafe(projectionReport, hostilePrivacyNeedles());
  match(JSON.stringify(artifact), /\[redacted-email\]/);
  match(JSON.stringify(artifact), /\[redacted-url\]/);
  match(JSON.stringify(artifact), /\[redacted-private-text\]/);
  match(JSON.stringify(artifact), /\[redacted-runtime-id\]/);
  match(JSON.stringify(artifact), /\[redacted-rationale\]/);
  match(JSON.stringify(artifact), /\[redacted-replay-bytes\]/);
});

test("validates caller-supplied clocks and explicit not-run model matrix", () => {
  throws(
    () =>
      buildCradleEvalResultV0({
        ...passingInput(),
        generated_at: "now",
      }),
    /generated_at must be an ISO instant string/,
  );
  throws(
    () =>
      buildCradleEvalResultV0({
        ...passingInput(),
        model_matrix: {
          status: "not-run",
          reason: "",
        },
      }),
    /model_matrix.reason must be non-empty/,
  );
  throws(
    () =>
      buildCradleEvalResultV0({
        ...passingInput(),
        cases: [],
      }),
    /cases must include at least one eval case/,
  );
  throws(
    () =>
      buildCradleEvalResultV0({
        ...passingInput(),
        cases: [
          {
            case_id: "empty-assertions",
            assertions: [],
          },
        ],
      }),
    /assertions must include at least one result/,
  );
});

test("root and eval subpath exports expose the public eval builder and renderer", () => {
  const root = require("../../index") as Record<string, unknown>;
  const evalSubpath = require("@openprose/reactor-cradle/eval") as Record<
    string,
    unknown
  >;

  equal(root["CRADLE_EVAL_RESULT_SCHEMA_V0"], CRADLE_EVAL_RESULT_SCHEMA_V0);
  equal(root["CRADLE_EVAL_PROJECTION_SCHEMA_V0"], CRADLE_EVAL_PROJECTION_SCHEMA_V0);
  equal(typeof root["buildCradleEvalResultV0"], "function");
  equal(typeof root["projectCradleEvalResultV0"], "function");
  equal(typeof root["renderCradleEvalReportMarkdownV0"], "function");
  equal(typeof root["renderCradleEvalProjectionReportMarkdownV0"], "function");
  equal(evalSubpath["CRADLE_EVAL_RESULT_SCHEMA_V0"], CRADLE_EVAL_RESULT_SCHEMA_V0);
  equal(
    evalSubpath["CRADLE_EVAL_PROJECTION_SCHEMA_V0"],
    CRADLE_EVAL_PROJECTION_SCHEMA_V0,
  );
  equal(typeof evalSubpath["createCradleEvalResultArtifactV0"], "function");
  equal(typeof evalSubpath["createCradleEvalProjectionV0"], "function");
  equal(typeof evalSubpath["renderCradleEvalMarkdownReportV0"], "function");
  equal(
    typeof evalSubpath["renderCradleEvalProjectionMarkdownReportV0"],
    "function",
  );
});

function buildPassingArtifact() {
  return buildCradleEvalResultV0(passingInput());
}

function passingInput() {
  return {
    suite_id: "v0.4-r2-release-evidence",
    generated_at: GENERATED_AT,
    as_of: AS_OF,
    model_matrix: {
      status: "not-run" as const,
      reason: "live provider/model matrix deferred for v0.4 R2",
    },
    cases: [
      {
        case_id: "c2-static-parity",
        scenario_id: "incident-briefing-static-zero",
        assertions: passingAssertions(),
        replay: passingParity(),
        evidence_hashes: [HASH_C],
      },
    ],
  };
}

function passingAssertions(): CradleAssertionSuiteResultV0 {
  const results: readonly CradleAssertionResultV0[] = [
    {
      ok: true,
      relationship: "static-surprise-zero",
      family: "static-surprise-zero",
      status: "pass",
      summary: "static surprise stayed zero",
      evidence: [
        {
          path: "trace",
          message: "checked static surprise observations",
          observed: { observations: 2 },
        },
      ],
    },
    {
      ok: true,
      relationship: "flat-spend-under-static",
      family: "flat-spend-under-static",
      status: "pass",
      summary: "fresh spend stayed flat after bootstrap",
      evidence: [
        {
          path: "receipt_log.entries",
          message: "checked token-bearing receipts",
          observed: { token_bearing_payloads: 1 },
        },
      ],
    },
  ];

  return {
    status: "pass",
    results,
  };
}

function passingParity(): ReplayParityMatrixResultV0 {
  const check: ReplayByteIdenticalPassV0 = {
    ok: true,
    relationship: "replay-byte-identical",
    expected_hash: HASH_A,
    actual_hash: HASH_A,
    byte_length: 256,
    evidence_path: "$",
  };

  return {
    schema: REPLAY_PARITY_MATRIX_SCHEMA_V0,
    v: REPLAY_PARITY_MATRIX_VERSION_V0,
    relationship: "cross-adapter-parity",
    ok: true,
    ready_rows_run: 2,
    future_rows: 1,
    rows: [
      {
        adapter_name: "deterministic-in-memory",
        storage_adapter: "memory",
        status: "passed",
        check,
      },
      {
        adapter_name: "filesystem",
        storage_adapter: "fs",
        status: "passed",
        check,
      },
      {
        adapter_name: "postgres",
        storage_adapter: "pg",
        status: "future",
        reason: "future adapter row",
      },
    ],
  };
}

function buildHostilePrivacyArtifact() {
  const {
    keyAssignment,
    bearerHeader,
    customerPayload,
    email,
    memoKey,
    privateUrl,
    providerNormalized,
    providerToken,
    rawJudgeRationale,
    rawReplayBytes,
    runId,
    tags,
  } = hostilePrivacyFixture();
  const replayFail: ReplayByteIdenticalFailV0 = {
    ok: false,
    relationship: "replay-byte-identical",
    expected_hash: HASH_A,
    actual_hash: HASH_B,
    expected_bytes: `expected raw bytes ${rawReplayBytes} ${customerPayload}`,
    actual_bytes: `actual raw bytes ${privateUrl} ${providerNormalized}`,
    evidence_path: "$",
    reason: `${rawReplayBytes} ${privateUrl} ${bearerHeader}`,
  };

  return buildCradleEvalResultV0({
    suite_id: `v0.4-r5-${email}`,
    generated_at: GENERATED_AT,
    as_of: AS_OF,
    model_matrix: {
      status: "not-run",
      reason: `not-run live matrix deferred; ${keyAssignment} ${privateUrl}`,
    },
    cases: [
      {
        case_id: `privacy-${email}`,
        scenario_id: `scenario-${privateUrl}`,
        assertions: [
          {
            ok: false,
            relationship: "surprise-attribution-complete",
            family: "surprise-attribution-complete",
            status: "fail",
            summary: [
              rawJudgeRationale,
              providerToken,
              bearerHeader,
              keyAssignment,
              customerPayload,
              memoKey,
              runId,
              tags,
              providerNormalized,
            ].join(" "),
            evidence: [
              {
                path: `trace.${privateUrl}.${email}`,
                message: `${rawJudgeRationale} ${rawReplayBytes} ${providerNormalized}`,
                observed: {
                  [email]: providerToken,
                  private_url: privateUrl,
                  customer_payload: customerPayload,
                  judge_rationale: rawJudgeRationale,
                  replay_bytes: rawReplayBytes,
                  memo_key: memoKey,
                  run_id: runId,
                  tags,
                  provider_norm: providerNormalized,
                },
              },
            ],
          },
        ],
        replay: {
          schema: REPLAY_PARITY_MATRIX_SCHEMA_V0,
          v: REPLAY_PARITY_MATRIX_VERSION_V0,
          relationship: "cross-adapter-parity",
          ok: false,
          ready_rows_run: 1,
          future_rows: 1,
          rows: [
            {
              adapter_name: "filesystem",
              storage_adapter: "fs",
              status: "failed",
              reason: `${rawReplayBytes} ${memoKey}`,
              check: replayFail,
            },
            {
              adapter_name: "postgres",
              storage_adapter: "pg",
              status: "future",
              reason: `future row not-run; ${providerNormalized}`,
            },
          ],
        },
        evidence_hashes: [HASH_C],
      },
    ],
  });
}

function hostilePrivacyFixture() {
  const providerToken = `${["sk", "or"].join("-")}-hostile-private-token`;
  const bearerHeader = `${["Bear", "er"].join("")} hostile.header-token`;
  const keyName = ["api", "Key"].join("");
  const email = ["customer.alpha", "example.invalid"].join("@");
  const privateUrl = "https://internal.example.invalid/customers/alpha?ticket=secret";
  const customerPayload = `customer_payload={"name":"Rina Sensitive","email":"${email}"}`;
  const rawJudgeRationale = `raw judge rationale: ${customerPayload}`;
  const rawReplayBytes = `raw replay bytes: {"url":"${privateUrl}"}`;
  const memoKey = `memo_key=memo:private:${email}`;
  const runId = "run_id=run-private-alpha";
  const tags = `tags=[vip-private,${email}]`;
  const providerNormalized = `provider_norm={"url":"${privateUrl}","header":"${bearerHeader}"}`;

  return {
    keyAssignment: `${keyName}=local-private-token`,
    bearerHeader,
    customerPayload,
    email,
    memoKey,
    privateUrl,
    providerNormalized,
    providerToken,
    rawJudgeRationale,
    rawReplayBytes,
    runId,
    tags,
  };
}

function hostilePrivacyNeedles(): readonly string[] {
  const {
    keyAssignment,
    bearerHeader,
    customerPayload,
    email,
    memoKey,
    privateUrl,
    providerNormalized,
    providerToken,
    rawJudgeRationale,
    rawReplayBytes,
    runId,
    tags,
  } = hostilePrivacyFixture();

  return [
    keyAssignment,
    bearerHeader,
    customerPayload,
    email,
    memoKey,
    privateUrl,
    providerNormalized,
    providerToken,
    rawJudgeRationale,
    rawReplayBytes,
    runId,
    tags,
    "expected raw bytes",
    "actual raw bytes",
    "Rina Sensitive",
  ];
}

function assertPrivacySafe(output: string, forbidden: readonly string[]): void {
  for (const value of forbidden) {
    ok(!output.includes(value), `output leaked ${value}`);
  }
}
