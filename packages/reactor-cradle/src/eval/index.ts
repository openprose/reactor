import { createHash } from "node:crypto";

import type { ContentHashV0 } from "@openprose/reactor/receipt";

import type {
  CradleAssertionResultV0,
  CradleAssertionSuiteResultV0,
} from "../assert";
import type {
  ReplayByteIdenticalCheckV0,
  ReplayParityMatrixResultV0,
  ReplayParityRowResultV0,
} from "../replay/parity";

export const CRADLE_EVAL_RESULT_SCHEMA_V0 =
  "openprose.reactor-cradle.eval-result" as const;
export const CRADLE_EVAL_RESULT_VERSION_V0 = 0 as const;
export const CRADLE_EVAL_PROJECTION_SCHEMA_V0 =
  "openprose.reactor-cradle.eval-projection" as const;
export const CRADLE_EVAL_PROJECTION_VERSION_V0 = 0 as const;
export const EVAL_RESULT_SCHEMA_V0 = CRADLE_EVAL_RESULT_SCHEMA_V0;
export const EVAL_RESULT_VERSION_V0 = CRADLE_EVAL_RESULT_VERSION_V0;

export type CradleEvalStatusV0 = "pass" | "fail";
export type CradleEvalModelMatrixStatusV0 = "not-run";
export type CradleEvalProjectionTierV0 = "owner" | "subscriber" | "public";
export type CradleEvalReplayKindV0 =
  | "replay-byte-identical"
  | "cross-adapter-parity";

export interface CradleEvalModelMatrixV0 {
  readonly status: CradleEvalModelMatrixStatusV0;
  readonly reason: string;
}

export interface BuildCradleEvalResultInputV0 {
  readonly suite_id: string;
  readonly generated_at: string;
  readonly as_of: string;
  readonly model_matrix: CradleEvalModelMatrixV0;
  readonly cases: readonly CradleEvalCaseInputV0[];
}

export interface CradleEvalCaseInputV0 {
  readonly case_id: string;
  readonly scenario_id?: string;
  readonly assertions:
    | CradleAssertionSuiteResultV0
    | readonly CradleAssertionResultV0[];
  readonly replay?: CradleEvalReplayInputV0;
  readonly evidence_hashes?: readonly ContentHashV0[];
}

export type CradleEvalReplayInputV0 =
  | ReplayByteIdenticalCheckV0
  | ReplayParityMatrixResultV0;

export interface CradleEvalResultV0 {
  readonly schema: typeof CRADLE_EVAL_RESULT_SCHEMA_V0;
  readonly v: typeof CRADLE_EVAL_RESULT_VERSION_V0;
  readonly generated_at: string;
  readonly as_of: string;
  readonly suite_id: string;
  readonly overall_status: CradleEvalStatusV0;
  readonly metrics: CradleEvalMetricsV0;
  readonly model_matrix: CradleEvalModelMatrixV0;
  readonly cases: readonly CradleEvalCaseResultV0[];
  readonly replay_parity_summary_hashes: readonly ContentHashV0[];
  readonly evidence_hashes: readonly ContentHashV0[];
  readonly content_hash: ContentHashV0;
}

export interface CradleEvalMetricsV0 {
  readonly case_count: number;
  readonly case_pass_count: number;
  readonly case_fail_count: number;
  readonly assertion_count: number;
  readonly assertion_pass_count: number;
  readonly assertion_fail_count: number;
  readonly replay_parity_summary_count: number;
  readonly replay_parity_pass_count: number;
  readonly replay_parity_fail_count: number;
  readonly replay_parity_ready_rows_run: number;
  readonly replay_parity_future_rows: number;
  readonly evidence_hash_count: number;
}

export interface CradleEvalCaseResultV0 {
  readonly case_id: string;
  readonly scenario_id: string;
  readonly status: CradleEvalStatusV0;
  readonly assertions: CradleEvalAssertionSuiteV0;
  readonly replay?: CradleEvalReplaySummaryV0;
  readonly evidence_hashes: readonly ContentHashV0[];
}

export interface CradleEvalAssertionSuiteV0 {
  readonly status: CradleEvalStatusV0;
  readonly pass_count: number;
  readonly fail_count: number;
  readonly results: readonly CradleEvalAssertionResultV0[];
}

export interface CradleEvalAssertionResultV0 {
  readonly family: string;
  readonly relationship: string;
  readonly status: CradleEvalStatusV0;
  readonly summary: string;
  readonly evidence: readonly CradleEvalAssertionEvidenceV0[];
  readonly result_hash: ContentHashV0;
}

export interface CradleEvalAssertionEvidenceV0 {
  readonly path: string;
  readonly message: string;
  readonly observed_hash?: ContentHashV0;
}

export type CradleEvalReplaySummaryV0 =
  | CradleEvalReplayByteIdenticalSummaryV0
  | CradleEvalReplayParityMatrixSummaryV0;

export interface CradleEvalReplayByteIdenticalSummaryV0 {
  readonly kind: "replay-byte-identical";
  readonly status: CradleEvalStatusV0;
  readonly expected_hash: ContentHashV0;
  readonly actual_hash: ContentHashV0;
  readonly evidence_path: string;
  readonly byte_length?: number;
  readonly reason?: string;
  readonly summary_hash: ContentHashV0;
}

export interface CradleEvalReplayParityMatrixSummaryV0 {
  readonly kind: "cross-adapter-parity";
  readonly status: CradleEvalStatusV0;
  readonly ready_rows_run: number;
  readonly future_rows: number;
  readonly rows: readonly CradleEvalReplayParityRowSummaryV0[];
  readonly summary_hash: ContentHashV0;
}

export interface CradleEvalReplayParityRowSummaryV0 {
  readonly adapter_name: string;
  readonly storage_adapter: string;
  readonly status: string;
  readonly reason?: string;
  readonly check?: CradleEvalReplayByteIdenticalSummaryWithoutKindV0;
}

export interface CradleEvalReplayByteIdenticalSummaryWithoutKindV0 {
  readonly status: CradleEvalStatusV0;
  readonly expected_hash: ContentHashV0;
  readonly actual_hash: ContentHashV0;
  readonly evidence_path: string;
  readonly byte_length?: number;
  readonly reason?: string;
}

export interface CradleEvalProjectionV0 {
  readonly schema: typeof CRADLE_EVAL_PROJECTION_SCHEMA_V0;
  readonly v: typeof CRADLE_EVAL_PROJECTION_VERSION_V0;
  readonly tier: CradleEvalProjectionTierV0;
  readonly source_content_hash: ContentHashV0;
  readonly generated_at: string;
  readonly as_of: string;
  readonly suite_id: string;
  readonly overall_status: CradleEvalStatusV0;
  readonly metrics: CradleEvalMetricsV0;
  readonly model_matrix: CradleEvalModelMatrixV0;
  readonly cases: readonly CradleEvalProjectionCaseV0[];
  readonly replay_parity_summary_hashes: readonly ContentHashV0[];
  readonly evidence_hashes: readonly ContentHashV0[];
  readonly content_hash: ContentHashV0;
}

export interface CradleEvalProjectionCaseV0 {
  readonly case_id: string;
  readonly scenario_id: string;
  readonly status: CradleEvalStatusV0;
  readonly assertions: CradleEvalProjectionAssertionSuiteV0;
  readonly replay?: CradleEvalProjectionReplaySummaryV0;
  readonly evidence_hashes: readonly ContentHashV0[];
}

export interface CradleEvalProjectionAssertionSuiteV0 {
  readonly status: CradleEvalStatusV0;
  readonly pass_count: number;
  readonly fail_count: number;
  readonly results: readonly CradleEvalProjectionAssertionResultV0[];
}

export interface CradleEvalProjectionAssertionResultV0 {
  readonly family: string;
  readonly relationship: string;
  readonly status: CradleEvalStatusV0;
  readonly summary: string;
  readonly result_hash: ContentHashV0;
  readonly evidence_count: number;
  readonly observed_hashes: readonly ContentHashV0[];
}

export type CradleEvalProjectionReplaySummaryV0 =
  | CradleEvalProjectionReplayByteIdenticalSummaryV0
  | CradleEvalProjectionReplayParityMatrixSummaryV0;

export interface CradleEvalProjectionReplayByteIdenticalSummaryV0 {
  readonly kind: "replay-byte-identical";
  readonly status: CradleEvalStatusV0;
  readonly expected_hash: ContentHashV0;
  readonly actual_hash: ContentHashV0;
  readonly byte_length?: number;
  readonly reason?: string;
  readonly summary_hash: ContentHashV0;
}

export interface CradleEvalProjectionReplayParityMatrixSummaryV0 {
  readonly kind: "cross-adapter-parity";
  readonly status: CradleEvalStatusV0;
  readonly ready_rows_run: number;
  readonly future_rows: number;
  readonly rows: readonly CradleEvalProjectionReplayParityRowSummaryV0[];
  readonly summary_hash: ContentHashV0;
}

export interface CradleEvalProjectionReplayParityRowSummaryV0 {
  readonly adapter_name: string;
  readonly storage_adapter: string;
  readonly status: string;
  readonly reason?: string;
  readonly check?: CradleEvalProjectionReplayByteIdenticalSummaryWithoutKindV0;
}

export interface CradleEvalProjectionReplayByteIdenticalSummaryWithoutKindV0 {
  readonly status: CradleEvalStatusV0;
  readonly expected_hash: ContentHashV0;
  readonly actual_hash: ContentHashV0;
  readonly byte_length?: number;
  readonly reason?: string;
}

type CradleEvalResultPayloadV0 = Omit<CradleEvalResultV0, "content_hash">;
type CradleEvalProjectionPayloadV0 = Omit<
  CradleEvalProjectionV0,
  "content_hash"
>;

const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const REDACTED_TEXT = "[redacted-secret]";
const REDACTED_EMAIL_TEXT = "[redacted-email]";
const REDACTED_URL_TEXT = "[redacted-url]";
const REDACTED_PRIVATE_TEXT = "[redacted-private-text]";
const REDACTED_RUNTIME_TEXT = "[redacted-runtime-id]";
const REDACTED_RATIONALE_TEXT = "[redacted-rationale]";
const REDACTED_REPLAY_TEXT = "[redacted-replay-bytes]";
const SENSITIVE_ASSIGNMENT_VALUE_PATTERN =
  "\"[^\"]*\"|'[^']*'|\\{[^}\\n\\r]*\\}|\\[[^\\]\\n\\r]*\\]|[^\\s,;|]+";
const TEXT_REDACTION_PATTERNS = Object.freeze([
  {
    pattern: new RegExp(`\\b${["sk", "or"].join("-")}-[A-Za-z0-9._-]+`, "g"),
    replacement: REDACTED_TEXT,
  },
  {
    pattern: new RegExp(`\\b${["Bear", "er"].join("")} [A-Za-z0-9._-]+`, "g"),
    replacement: REDACTED_TEXT,
  },
  {
    pattern: new RegExp(
      `\\b${["api", "Key"].join("")}\\s*[:=]\\s*[A-Za-z0-9._-]+`,
      "gi",
    ),
    replacement: REDACTED_TEXT,
  },
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: REDACTED_EMAIL_TEXT,
  },
  {
    pattern: /\bhttps?:\/\/[^\s<>)\]}"']+/gi,
    replacement: REDACTED_URL_TEXT,
  },
  {
    pattern: new RegExp(
      `\\b(?:customer|tenant|account|user)[_-]?(?:payload|data|record|id|email)\\b\\s*[:=]\\s*(?:${SENSITIVE_ASSIGNMENT_VALUE_PATTERN})`,
      "gi",
    ),
    replacement: REDACTED_PRIVATE_TEXT,
  },
  {
    pattern: new RegExp(
      `\\b(?:raw\\s+)?judge[_ -]?rationale\\b\\s*[:=]\\s*(?:${SENSITIVE_ASSIGNMENT_VALUE_PATTERN})`,
      "gi",
    ),
    replacement: REDACTED_RATIONALE_TEXT,
  },
  {
    pattern: new RegExp(
      `\\braw[_ -]?replay[_ -]?bytes\\b\\s*[:=]\\s*(?:${SENSITIVE_ASSIGNMENT_VALUE_PATTERN})`,
      "gi",
    ),
    replacement: REDACTED_REPLAY_TEXT,
  },
  {
    pattern: new RegExp(
      `\\b(?:memo[_ -]?key|run[_ -]?id|tags?|provider[_ -]?norm(?:alized)?(?:[_ -]?payload)?)\\b\\s*[:=]\\s*(?:${SENSITIVE_ASSIGNMENT_VALUE_PATTERN})`,
      "gi",
    ),
    replacement: REDACTED_RUNTIME_TEXT,
  },
]);

export function buildCradleEvalResultV0(
  input: BuildCradleEvalResultInputV0,
): CradleEvalResultV0 {
  assertNonEmptyString(input.suite_id, "suite_id");
  assertIsoInstant(input.generated_at, "generated_at");
  assertIsoInstant(input.as_of, "as_of");
  assertModelMatrix(input.model_matrix);
  if (input.cases.length === 0) {
    throw new Error("cases must include at least one eval case");
  }

  const cases = Object.freeze(input.cases.map(normalizeCase));
  const replayParitySummaryHashes = uniqueSortedHashes(
    cases.flatMap((item) =>
      item.replay === undefined ? [] : [item.replay.summary_hash],
    ),
  );
  const evidenceHashes = uniqueSortedHashes(
    cases.flatMap((item) => item.evidence_hashes),
  );
  const metrics = computeMetrics(cases, evidenceHashes.length);
  const overallStatus: CradleEvalStatusV0 =
    cases.some((item) => item.status === "fail") ? "fail" : "pass";
  const payload: CradleEvalResultPayloadV0 = {
    schema: CRADLE_EVAL_RESULT_SCHEMA_V0,
    v: CRADLE_EVAL_RESULT_VERSION_V0,
    generated_at: input.generated_at,
    as_of: input.as_of,
    suite_id: sanitizeText(input.suite_id),
    overall_status: overallStatus,
    metrics,
    model_matrix: {
      status: "not-run",
      reason: sanitizeText(input.model_matrix.reason),
    },
    cases,
    replay_parity_summary_hashes: replayParitySummaryHashes,
    evidence_hashes: evidenceHashes,
  };

  return Object.freeze({
    ...payload,
    content_hash: hashCanonicalValue(payload),
  });
}

export const createCradleEvalResultV0 = buildCradleEvalResultV0;
export const createCradleEvalResultArtifactV0 = buildCradleEvalResultV0;
export const buildCradleEvalResultArtifactV0 = buildCradleEvalResultV0;

export function renderCradleEvalReportMarkdownV0(
  result: CradleEvalResultV0,
): string {
  const caseRows = result.cases.map((item) => {
    const assertionSummary = `${item.assertions.pass_count}/${item.assertions.results.length} pass`;
    const replaySummary =
      item.replay === undefined
        ? "not run"
        : `${item.replay.kind} ${item.replay.status} ${item.replay.summary_hash}`;

    return [
      item.case_id,
      item.scenario_id,
      item.status,
      assertionSummary,
      replaySummary,
      item.evidence_hashes.join("<br>"),
    ]
      .map(markdownTableCell)
      .join(" | ");
  });
  const evidenceHashLines =
    result.evidence_hashes.length === 0
      ? ["- none"]
      : result.evidence_hashes.map((hash) => `- \`${hash}\``);
  const replayHashLines =
    result.replay_parity_summary_hashes.length === 0
      ? ["- none"]
      : result.replay_parity_summary_hashes.map((hash) => `- \`${hash}\``);

  return [
    "# Cradle Eval Report",
    "",
    `Artifact hash: \`${result.content_hash}\``,
    `Suite: \`${markdownInline(result.suite_id)}\``,
    `Generated at: \`${result.generated_at}\``,
    `As of: \`${result.as_of}\``,
    "",
    "## Pass/Fail Summary",
    `- Overall: ${result.overall_status}`,
    `- Cases: ${result.metrics.case_pass_count}/${result.metrics.case_count} pass, ${result.metrics.case_fail_count} fail`,
    `- Assertions: ${result.metrics.assertion_pass_count}/${result.metrics.assertion_count} pass, ${result.metrics.assertion_fail_count} fail`,
    `- Replay/parity: ${result.metrics.replay_parity_pass_count}/${result.metrics.replay_parity_summary_count} pass, ${result.metrics.replay_parity_fail_count} fail, ${result.metrics.replay_parity_future_rows} future rows`,
    "",
    "## Case Table",
    "| Case | Scenario | Status | Assertions | Replay/parity | Evidence hashes |",
    "| --- | --- | --- | --- | --- | --- |",
    ...caseRows.map((row) => `| ${row} |`),
    "",
    "## Deferred Live Matrix",
    `Live model matrix is ${result.model_matrix.status}: ${sanitizeText(
      result.model_matrix.reason,
    )}`,
    "",
    "## Replay/Parity Summary Hashes",
    ...replayHashLines,
    "",
    "## Evidence Hashes",
    ...evidenceHashLines,
    "",
  ].join("\n");
}

export const renderCradleEvalMarkdownReportV0 =
  renderCradleEvalReportMarkdownV0;

export function projectCradleEvalResultV0(
  result: CradleEvalResultV0,
  tier: CradleEvalProjectionTierV0,
): CradleEvalProjectionV0 {
  assertProjectionTier(tier);
  assertContentHash(result.content_hash, "result.content_hash");
  const payload: CradleEvalProjectionPayloadV0 = {
    schema: CRADLE_EVAL_PROJECTION_SCHEMA_V0,
    v: CRADLE_EVAL_PROJECTION_VERSION_V0,
    tier,
    source_content_hash: result.content_hash,
    generated_at: result.generated_at,
    as_of: result.as_of,
    suite_id: sanitizeText(result.suite_id),
    overall_status: normalizeStatus(result.overall_status, "overall_status"),
    metrics: result.metrics,
    model_matrix: {
      status: "not-run",
      reason: sanitizeText(result.model_matrix.reason),
    },
    cases: Object.freeze(result.cases.map(projectCase)),
    replay_parity_summary_hashes: uniqueSortedHashes(
      result.replay_parity_summary_hashes,
    ),
    evidence_hashes: uniqueSortedHashes(result.evidence_hashes),
  };

  return Object.freeze({
    ...payload,
    content_hash: hashCanonicalValue(payload),
  });
}

export const createCradleEvalProjectionV0 = projectCradleEvalResultV0;
export const projectCradleEvalResultArtifactV0 = projectCradleEvalResultV0;

export function renderCradleEvalProjectionReportMarkdownV0(
  projection: CradleEvalProjectionV0,
): string {
  const caseRows = projection.cases.map((item) => {
    const assertionSummary = `${item.assertions.pass_count}/${item.assertions.results.length} pass`;
    const replaySummary =
      item.replay === undefined
        ? "not run"
        : `${item.replay.kind} ${item.replay.status} ${item.replay.summary_hash}`;

    return [
      item.case_id,
      item.scenario_id,
      item.status,
      assertionSummary,
      replaySummary,
      item.evidence_hashes.join("<br>"),
    ]
      .map(markdownTableCell)
      .join(" | ");
  });
  const evidenceHashLines =
    projection.evidence_hashes.length === 0
      ? ["- none"]
      : projection.evidence_hashes.map((hash) => `- \`${hash}\``);
  const replayHashLines =
    projection.replay_parity_summary_hashes.length === 0
      ? ["- none"]
      : projection.replay_parity_summary_hashes.map((hash) => `- \`${hash}\``);

  return [
    "# Cradle Eval Projection",
    "",
    `Projection hash: \`${projection.content_hash}\``,
    `Source artifact hash: \`${projection.source_content_hash}\``,
    `Tier: \`${projection.tier}\``,
    `Suite: \`${markdownInline(projection.suite_id)}\``,
    `Generated at: \`${projection.generated_at}\``,
    `As of: \`${projection.as_of}\``,
    "",
    "## Pass/Fail Summary",
    `- Overall: ${projection.overall_status}`,
    `- Cases: ${projection.metrics.case_pass_count}/${projection.metrics.case_count} pass, ${projection.metrics.case_fail_count} fail`,
    `- Assertions: ${projection.metrics.assertion_pass_count}/${projection.metrics.assertion_count} pass, ${projection.metrics.assertion_fail_count} fail`,
    `- Replay/parity: ${projection.metrics.replay_parity_pass_count}/${projection.metrics.replay_parity_summary_count} pass, ${projection.metrics.replay_parity_fail_count} fail, ${projection.metrics.replay_parity_future_rows} future rows`,
    "",
    "## Case Table",
    "| Case | Scenario | Status | Assertions | Replay/parity | Evidence hashes |",
    "| --- | --- | --- | --- | --- | --- |",
    ...caseRows.map((row) => `| ${row} |`),
    "",
    "## Deferred Live Matrix",
    `Live model matrix is ${projection.model_matrix.status}: ${sanitizeText(
      projection.model_matrix.reason,
    )}`,
    "",
    "## Replay/Parity Summary Hashes",
    ...replayHashLines,
    "",
    "## Evidence Hashes",
    ...evidenceHashLines,
    "",
  ].join("\n");
}

export const renderCradleEvalProjectionMarkdownReportV0 =
  renderCradleEvalProjectionReportMarkdownV0;

function normalizeCase(input: CradleEvalCaseInputV0): CradleEvalCaseResultV0 {
  assertNonEmptyString(input.case_id, "case_id");
  const assertions = normalizeAssertionSuite(input.assertions);
  const replay =
    input.replay === undefined ? undefined : summarizeReplayInput(input.replay);
  const caseEvidenceHashes = uniqueSortedHashes([
    ...assertions.results.map((item) => item.result_hash),
    ...(replay === undefined ? [] : [replay.summary_hash]),
    ...(input.evidence_hashes ?? []),
  ]);
  const status: CradleEvalStatusV0 =
    assertions.status === "fail" || replay?.status === "fail" ? "fail" : "pass";

  return Object.freeze({
    case_id: sanitizeText(input.case_id),
    scenario_id: sanitizeText(input.scenario_id ?? input.case_id),
    status,
    assertions,
    ...(replay === undefined ? {} : { replay }),
    evidence_hashes: caseEvidenceHashes,
  });
}

function normalizeAssertionSuite(
  input: CradleAssertionSuiteResultV0 | readonly CradleAssertionResultV0[],
): CradleEvalAssertionSuiteV0 {
  const sourceResults: readonly CradleAssertionResultV0[] = isAssertionResultArray(
    input,
  )
    ? input
    : input.results;
  if (sourceResults.length === 0) {
    throw new Error("assertions must include at least one result");
  }

  const results = sourceResults.map(normalizeAssertionResult);
  const failCount = results.filter((item) => item.status === "fail").length;
  const passCount = results.length - failCount;

  return Object.freeze({
    status: failCount === 0 ? "pass" : "fail",
    pass_count: passCount,
    fail_count: failCount,
    results: Object.freeze(results),
  });
}

function normalizeAssertionResult(
  input: CradleAssertionResultV0,
): CradleEvalAssertionResultV0 {
  const evidence = input.evidence.map(normalizeAssertionEvidence);
  const payload = {
    family: sanitizeText(input.family),
    relationship: sanitizeText(input.relationship),
    status: normalizeStatus(input.status, "assertion status"),
    summary: sanitizeText(input.summary),
    evidence,
  };

  return Object.freeze({
    ...payload,
    result_hash: hashCanonicalValue(payload),
  });
}

function normalizeAssertionEvidence(
  input: CradleAssertionResultV0["evidence"][number],
): CradleEvalAssertionEvidenceV0 {
  const observedHash =
    input.observed === undefined
      ? undefined
      : hashRedactedObservedValue(input.observed);

  return Object.freeze({
    path: sanitizeText(input.path),
    message: sanitizeText(input.message),
    ...(observedHash === undefined ? {} : { observed_hash: observedHash }),
  });
}

function summarizeReplayInput(
  input: CradleEvalReplayInputV0,
): CradleEvalReplaySummaryV0 {
  if (input.relationship === "replay-byte-identical") {
    return summarizeReplayByteIdentical(input);
  }

  return summarizeReplayParityMatrix(input);
}

function summarizeReplayByteIdentical(
  input: ReplayByteIdenticalCheckV0,
): CradleEvalReplayByteIdenticalSummaryV0 {
  const payload = {
    kind: "replay-byte-identical" as const,
    ...summarizeReplayByteIdenticalWithoutKind(input),
  };

  return Object.freeze({
    ...payload,
    summary_hash: hashCanonicalValue(payload),
  });
}

function summarizeReplayByteIdenticalWithoutKind(
  input: ReplayByteIdenticalCheckV0,
): CradleEvalReplayByteIdenticalSummaryWithoutKindV0 {
  const payload = {
    status: input.ok ? "pass" : "fail",
    expected_hash: input.expected_hash,
    actual_hash: input.actual_hash,
    evidence_path: sanitizeText(input.evidence_path),
    ...("byte_length" in input ? { byte_length: input.byte_length } : {}),
    ...("reason" in input ? { reason: sanitizeText(input.reason) } : {}),
  } satisfies CradleEvalReplayByteIdenticalSummaryWithoutKindV0;

  return Object.freeze(payload);
}

function projectCase(input: CradleEvalCaseResultV0): CradleEvalProjectionCaseV0 {
  return Object.freeze({
    case_id: sanitizeText(input.case_id),
    scenario_id: sanitizeText(input.scenario_id),
    status: normalizeStatus(input.status, "case status"),
    assertions: projectAssertionSuite(input.assertions),
    ...(input.replay === undefined ? {} : { replay: projectReplay(input.replay) }),
    evidence_hashes: uniqueSortedHashes(input.evidence_hashes),
  });
}

function projectAssertionSuite(
  input: CradleEvalAssertionSuiteV0,
): CradleEvalProjectionAssertionSuiteV0 {
  return Object.freeze({
    status: normalizeStatus(input.status, "assertion suite status"),
    pass_count: input.pass_count,
    fail_count: input.fail_count,
    results: Object.freeze(input.results.map(projectAssertionResult)),
  });
}

function projectAssertionResult(
  input: CradleEvalAssertionResultV0,
): CradleEvalProjectionAssertionResultV0 {
  return Object.freeze({
    family: sanitizeText(input.family),
    relationship: sanitizeText(input.relationship),
    status: normalizeStatus(input.status, "assertion status"),
    summary: sanitizeText(input.summary),
    result_hash: input.result_hash,
    evidence_count: input.evidence.length,
    observed_hashes: uniqueSortedHashes(
      input.evidence.flatMap((item) =>
        item.observed_hash === undefined ? [] : [item.observed_hash],
      ),
    ),
  });
}

function projectReplay(
  input: CradleEvalReplaySummaryV0,
): CradleEvalProjectionReplaySummaryV0 {
  if (input.kind === "replay-byte-identical") {
    return projectReplayByteIdentical(input);
  }

  return projectReplayParityMatrix(input);
}

function projectReplayByteIdentical(
  input: CradleEvalReplayByteIdenticalSummaryV0,
): CradleEvalProjectionReplayByteIdenticalSummaryV0 {
  return Object.freeze({
    kind: "replay-byte-identical",
    ...projectReplayByteIdenticalWithoutKind(input),
    summary_hash: input.summary_hash,
  });
}

function projectReplayByteIdenticalWithoutKind(
  input: CradleEvalReplayByteIdenticalSummaryWithoutKindV0,
): CradleEvalProjectionReplayByteIdenticalSummaryWithoutKindV0 {
  return Object.freeze({
    status: normalizeStatus(input.status, "replay status"),
    expected_hash: input.expected_hash,
    actual_hash: input.actual_hash,
    ...("byte_length" in input ? { byte_length: input.byte_length } : {}),
    ...("reason" in input ? { reason: sanitizeText(input.reason) } : {}),
  });
}

function projectReplayParityMatrix(
  input: CradleEvalReplayParityMatrixSummaryV0,
): CradleEvalProjectionReplayParityMatrixSummaryV0 {
  return Object.freeze({
    kind: "cross-adapter-parity",
    status: normalizeStatus(input.status, "replay parity status"),
    ready_rows_run: input.ready_rows_run,
    future_rows: input.future_rows,
    rows: Object.freeze(input.rows.map(projectReplayParityRow)),
    summary_hash: input.summary_hash,
  });
}

function projectReplayParityRow(
  input: CradleEvalReplayParityRowSummaryV0,
): CradleEvalProjectionReplayParityRowSummaryV0 {
  return Object.freeze({
    adapter_name: sanitizeText(input.adapter_name),
    storage_adapter: sanitizeText(input.storage_adapter),
    status: sanitizeText(input.status),
    ...("reason" in input ? { reason: sanitizeText(input.reason) } : {}),
    ...("check" in input && input.check !== undefined
      ? { check: projectReplayByteIdenticalWithoutKind(input.check) }
      : {}),
  });
}

function summarizeReplayParityMatrix(
  input: ReplayParityMatrixResultV0,
): CradleEvalReplayParityMatrixSummaryV0 {
  const status: CradleEvalStatusV0 = input.ok ? "pass" : "fail";
  const payload = {
    kind: "cross-adapter-parity" as const,
    status,
    ready_rows_run: input.ready_rows_run,
    future_rows: input.future_rows,
    rows: Object.freeze(input.rows.map(summarizeReplayParityRow)),
  };

  return Object.freeze({
    ...payload,
    summary_hash: hashCanonicalValue(payload),
  });
}

function summarizeReplayParityRow(
  input: ReplayParityRowResultV0,
): CradleEvalReplayParityRowSummaryV0 {
  return Object.freeze({
    adapter_name: sanitizeText(input.adapter_name),
    storage_adapter: sanitizeText(input.storage_adapter),
    status: sanitizeText(input.status),
    ...("reason" in input ? { reason: sanitizeText(input.reason) } : {}),
    ...("check" in input && input.check !== undefined
      ? { check: summarizeReplayByteIdenticalWithoutKind(input.check) }
      : {}),
  });
}

function computeMetrics(
  cases: readonly CradleEvalCaseResultV0[],
  evidenceHashCount: number,
): CradleEvalMetricsV0 {
  const assertionResults = cases.flatMap((item) => item.assertions.results);
  const replaySummaries = cases.flatMap((item) =>
    item.replay === undefined ? [] : [item.replay],
  );
  const replayParitySummaries = replaySummaries.filter(
    (item): item is CradleEvalReplayParityMatrixSummaryV0 =>
      item.kind === "cross-adapter-parity",
  );

  return Object.freeze({
    case_count: cases.length,
    case_pass_count: cases.filter((item) => item.status === "pass").length,
    case_fail_count: cases.filter((item) => item.status === "fail").length,
    assertion_count: assertionResults.length,
    assertion_pass_count: assertionResults.filter(
      (item) => item.status === "pass",
    ).length,
    assertion_fail_count: assertionResults.filter(
      (item) => item.status === "fail",
    ).length,
    replay_parity_summary_count: replaySummaries.length,
    replay_parity_pass_count: replaySummaries.filter(
      (item) => item.status === "pass",
    ).length,
    replay_parity_fail_count: replaySummaries.filter(
      (item) => item.status === "fail",
    ).length,
    replay_parity_ready_rows_run: replayParitySummaries.reduce(
      (sum, item) => sum + item.ready_rows_run,
      0,
    ),
    replay_parity_future_rows: replayParitySummaries.reduce(
      (sum, item) => sum + item.future_rows,
      0,
    ),
    evidence_hash_count: evidenceHashCount,
  });
}

function hashRedactedObservedValue(value: unknown): ContentHashV0 | undefined {
  try {
    return hashCanonicalValue(redactJsonValue(value));
  } catch {
    return undefined;
  }
}

function hashCanonicalValue(value: unknown): ContentHashV0 {
  return `sha256:${createHash("sha256").update(renderCanonical(value)).digest("hex")}`;
}

function redactJsonValue(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "boolean":
    case "number":
      return value;
    case "string":
      return sanitizeText(value);
    case "object":
      if (Array.isArray(value)) {
        return value.map(redactJsonValue);
      }
      if (!isPlainRecord(value)) {
        throw new TypeError("observed value is not canonical JSON");
      }
      return redactJsonObject(value);
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`observed value cannot be ${typeof value}`);
  }
}

function redactJsonObject(value: Readonly<Record<string, unknown>>): unknown {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (item === undefined) {
      continue;
    }
    result[redactedObjectKey(result, sanitizeText(key))] = redactJsonValue(item);
  }

  return result;
}

function sanitizeText(value: string): string {
  return TEXT_REDACTION_PATTERNS.reduce(
    (current, item) => current.replace(item.pattern, item.replacement),
    value,
  );
}

function redactedObjectKey(
  result: Readonly<Record<string, unknown>>,
  key: string,
): string {
  if (!(key in result)) {
    return key;
  }

  let index = 2;
  let candidate = `${key}#${index}`;
  while (candidate in result) {
    index += 1;
    candidate = `${key}#${index}`;
  }

  return candidate;
}

function normalizeStatus(
  status: CradleAssertionResultV0["status"],
  label: string,
): CradleEvalStatusV0 {
  if (status === "pass" || status === "fail") {
    return status;
  }
  throw new Error(`${label} must be pass or fail`);
}

function uniqueSortedHashes(values: readonly ContentHashV0[]): readonly ContentHashV0[] {
  const seen = new Set<ContentHashV0>();
  for (const value of values) {
    assertContentHash(value, "evidence hash");
    seen.add(value);
  }

  return Object.freeze(Array.from(seen).sort());
}

function assertModelMatrix(value: CradleEvalModelMatrixV0): void {
  if (value.status !== "not-run") {
    throw new Error("model_matrix.status must be not-run");
  }
  assertNonEmptyString(value.reason, "model_matrix.reason");
}

function assertProjectionTier(value: CradleEvalProjectionTierV0): void {
  if (value !== "owner" && value !== "subscriber" && value !== "public") {
    throw new Error("projection tier must be owner, subscriber, or public");
  }
}

function assertNonEmptyString(value: string, label: string): void {
  if (value.length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
}

function assertIsoInstant(value: string, label: string): void {
  if (!ISO_INSTANT_PATTERN.test(value)) {
    throw new Error(`${label} must be an ISO instant string`);
  }
}

function assertContentHash(value: string, label: string): asserts value is ContentHashV0 {
  if (!CONTENT_HASH_PATTERN.test(value)) {
    throw new Error(`${label} must be a sha256 content hash`);
  }
}

function isAssertionResultArray(
  value: CradleAssertionSuiteResultV0 | readonly CradleAssertionResultV0[],
): value is readonly CradleAssertionResultV0[] {
  return Array.isArray(value);
}

function markdownTableCell(value: string): string {
  return sanitizeText(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function markdownInline(value: string): string {
  return sanitizeText(value).replace(/`/g, "\\`");
}

function renderCanonical(value: unknown): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("Cannot canonicalize non-finite numbers");
      }
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => renderCanonical(item)).join(",")}]`;
      }
      if (!isPlainRecord(value)) {
        throw new TypeError("Cannot canonicalize non-plain objects");
      }
      return renderCanonicalObject(value);
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`Cannot canonicalize ${typeof value}`);
  }

  throw new TypeError("Cannot canonicalize unknown value");
}

function renderCanonicalObject(value: Readonly<Record<string, unknown>>): string {
  const fields: string[] = [];

  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined) {
      throw new TypeError(`Cannot canonicalize undefined field ${key}`);
    }
    fields.push(`${JSON.stringify(key)}:${renderCanonical(item)}`);
  }

  return `{${fields.join(",")}}`;
}

function isPlainRecord(value: object): value is Readonly<Record<string, unknown>> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
