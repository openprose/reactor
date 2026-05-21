export const K1_ENSEMBLE_SPREAD_SCHEMA_V0 =
  "openprose.reactor-cradle.k1-ensemble-spread" as const;
export const K1_ENSEMBLE_SPREAD_VERSION_V0 = 0 as const;

export type K1AnchorCalibrationGradeV0 = "authored" | "accrued";
export type K1EnsembleVerdictStatusV0 =
  | "up"
  | "drifting"
  | "down"
  | "blocked";
export type K1DiversityFloorComponentV0 =
  | "model-family"
  | "provider"
  | "size-boundary";
export type K1CalibrationStatusV0 = "calibrated" | "degraded";

export type K1IssueCodeV0 =
  | "fixture-not-object"
  | "schema-invalid"
  | "version-invalid"
  | "field-invalid"
  | "anchor-invalid"
  | "calibration-bar-invalid"
  | "outputs-invalid"
  | "ensemble-too-small"
  | "diversity-floor-unmet"
  | "mean-error-too-high"
  | "spread-error-gap-too-high"
  | "low-spread-anchor-error";

export interface K1CalibrationAnchorV0 {
  readonly label_source: string;
  readonly calibration_grade: K1AnchorCalibrationGradeV0;
  readonly verdict: K1EnsembleVerdictStatusV0;
  readonly score: number;
}

export interface K1CalibrationBarV0 {
  readonly max_mean_error: number;
  readonly max_spread_error_gap: number;
  readonly low_spread_threshold: number;
  readonly max_error_when_low_spread: number;
}

export interface K1RecordedModelOutputV0 {
  readonly output_id: string;
  readonly provider: string;
  readonly model: string;
  readonly family: string;
  readonly size_class: string;
  readonly verdict: K1EnsembleVerdictStatusV0;
  readonly score: number;
  readonly confidence: number;
  readonly text: string;
}

export interface K1EnsembleSpreadFixtureV0 {
  readonly schema: typeof K1_ENSEMBLE_SPREAD_SCHEMA_V0;
  readonly v: typeof K1_ENSEMBLE_SPREAD_VERSION_V0;
  readonly fixture_id: string;
  readonly responsibility_id: string;
  readonly recorded_at: string;
  readonly anchor: K1CalibrationAnchorV0;
  readonly calibration_bar: K1CalibrationBarV0;
  readonly outputs: readonly K1RecordedModelOutputV0[];
}

export interface K1DiversityFloorEvaluationV0 {
  readonly floor_met: boolean;
  readonly families: readonly string[];
  readonly providers: readonly string[];
  readonly size_classes: readonly string[];
  readonly missing: readonly K1DiversityFloorComponentV0[];
}

export interface K1OutputAnchorScoreV0 {
  readonly output_id: string;
  readonly provider: string;
  readonly model: string;
  readonly family: string;
  readonly size_class: string;
  readonly verdict: K1EnsembleVerdictStatusV0;
  readonly score: number;
  readonly anchor_error: number;
  readonly matches_anchor_verdict: boolean;
}

export interface K1SpreadMetricsV0 {
  readonly output_count: number;
  readonly spread: number;
  readonly mean_anchor_error: number;
  readonly max_anchor_error: number;
  readonly spread_error_gap: number;
  readonly calibrated_confidence: number | null;
}

export interface K1EvaluationIssueV0 {
  readonly path: string;
  readonly code: K1IssueCodeV0;
  readonly message: string;
  readonly observed: unknown;
}

export interface K1EnsembleSpreadEvaluationV0 {
  readonly ok: boolean;
  readonly status: K1CalibrationStatusV0;
  readonly accepted_as_calibrated_confidence: boolean;
  readonly summary: string;
  readonly fixture_id: string | null;
  readonly responsibility_id: string | null;
  readonly anchor: K1CalibrationAnchorV0 | null;
  readonly diversity: K1DiversityFloorEvaluationV0;
  readonly metrics: K1SpreadMetricsV0;
  readonly output_scores: readonly K1OutputAnchorScoreV0[];
  readonly issues: readonly K1EvaluationIssueV0[];
}

type FixtureReadResultV0 =
  | { readonly ok: true; readonly fixture: K1EnsembleSpreadFixtureV0 }
  | { readonly ok: false; readonly issues: readonly K1EvaluationIssueV0[] };

const VERDICT_STATUSES = new Set<K1EnsembleVerdictStatusV0>([
  "up",
  "drifting",
  "down",
  "blocked",
]);
const ANCHOR_GRADES = new Set<K1AnchorCalibrationGradeV0>([
  "authored",
  "accrued",
]);
const EPSILON = 1e-12;

export function evaluateK1EnsembleSpreadV0(
  input: unknown,
): K1EnsembleSpreadEvaluationV0 {
  const read = readFixture(input);
  if (!read.ok) {
    return degradedResult({
      summary: "K1 ensemble spread fixture failed validation",
      fixture_id: null,
      responsibility_id: null,
      anchor: null,
      diversity: emptyDiversity(),
      metrics: emptyMetrics(),
      output_scores: [],
      issues: read.issues,
    });
  }

  const fixture = read.fixture;
  const diversity = evaluateK1DiversityFloorV0(fixture.outputs);
  const outputScores = fixture.outputs.map((output) =>
    scoreOutputAgainstAnchor(output, fixture.anchor),
  );
  const rawErrors = outputScores.map((score) => score.anchor_error);
  const rawSpread = meanPairwiseDistance(
    fixture.outputs.map((output) => output.score),
  );
  const rawMeanError = mean(rawErrors);
  const rawMaxError = rawErrors.length === 0 ? 0 : Math.max(...rawErrors);
  const rawSpreadErrorGap = Math.abs(rawMeanError - rawSpread);

  const issues: K1EvaluationIssueV0[] = [];
  if (fixture.outputs.length < 2) {
    issues.push(
      issue(
        "outputs",
        "ensemble-too-small",
        "K1 ensemble spread requires at least two recorded outputs",
        { outputs: fixture.outputs.length },
      ),
    );
  }

  if (!diversity.floor_met) {
    issues.push(
      issue(
        "outputs",
        "diversity-floor-unmet",
        "spread cannot be treated as calibrated confidence until the ensemble spans at least two families, two providers, and two size classes",
        {
          families: diversity.families,
          providers: diversity.providers,
          size_classes: diversity.size_classes,
          missing: diversity.missing,
        },
      ),
    );
  }

  if (rawMeanError > fixture.calibration_bar.max_mean_error + EPSILON) {
    issues.push(
      issue(
        "outputs",
        "mean-error-too-high",
        "ensemble outputs exceed the anchor mean-error calibration bar",
        {
          mean_anchor_error: roundMetric(rawMeanError),
          max_mean_error: fixture.calibration_bar.max_mean_error,
        },
      ),
    );
  }

  if (
    rawSpreadErrorGap >
    fixture.calibration_bar.max_spread_error_gap + EPSILON
  ) {
    issues.push(
      issue(
        "outputs",
        "spread-error-gap-too-high",
        "spread does not track anchor error within the recorded calibration bar",
        {
          spread: roundMetric(rawSpread),
          mean_anchor_error: roundMetric(rawMeanError),
          max_spread_error_gap: fixture.calibration_bar.max_spread_error_gap,
        },
      ),
    );
  }

  if (
    rawSpread <= fixture.calibration_bar.low_spread_threshold + EPSILON &&
    rawMeanError >
      fixture.calibration_bar.max_error_when_low_spread + EPSILON
  ) {
    issues.push(
      issue(
        "outputs",
        "low-spread-anchor-error",
        "low inter-model spread disagrees with the correctness anchor and cannot license calibrated confidence",
        {
          spread: roundMetric(rawSpread),
          mean_anchor_error: roundMetric(rawMeanError),
          low_spread_threshold: fixture.calibration_bar.low_spread_threshold,
          max_error_when_low_spread:
            fixture.calibration_bar.max_error_when_low_spread,
        },
      ),
    );
  }

  const accepted = issues.length === 0;
  const metrics: K1SpreadMetricsV0 = {
    output_count: fixture.outputs.length,
    spread: roundMetric(rawSpread),
    mean_anchor_error: roundMetric(rawMeanError),
    max_anchor_error: roundMetric(rawMaxError),
    spread_error_gap: roundMetric(rawSpreadErrorGap),
    calibrated_confidence: accepted
      ? roundMetric(1 - Math.min(1, rawSpread))
      : null,
  };

  if (!accepted) {
    return degradedResult({
      summary:
        "K1 ensemble spread is degraded; spread is not accepted as calibrated confidence",
      fixture_id: fixture.fixture_id,
      responsibility_id: fixture.responsibility_id,
      anchor: fixture.anchor,
      diversity,
      metrics,
      output_scores: outputScores,
      issues,
    });
  }

  return {
    ok: true,
    status: "calibrated",
    accepted_as_calibrated_confidence: true,
    summary:
      "K1 ensemble spread is calibrated against the anchor with the diversity floor met",
    fixture_id: fixture.fixture_id,
    responsibility_id: fixture.responsibility_id,
    anchor: fixture.anchor,
    diversity,
    metrics,
    output_scores: Object.freeze([...outputScores]),
    issues: Object.freeze([]),
  };
}

export function evaluateK1DiversityFloorV0(
  outputs: readonly K1RecordedModelOutputV0[],
): K1DiversityFloorEvaluationV0 {
  const families = uniqueSorted(outputs.map((output) => output.family));
  const providers = uniqueSorted(outputs.map((output) => output.provider));
  const sizeClasses = uniqueSorted(outputs.map((output) => output.size_class));
  const missing: K1DiversityFloorComponentV0[] = [];

  if (families.length < 2) {
    missing.push("model-family");
  }
  if (providers.length < 2) {
    missing.push("provider");
  }
  if (sizeClasses.length < 2) {
    missing.push("size-boundary");
  }

  return {
    floor_met: missing.length === 0,
    families,
    providers,
    size_classes: sizeClasses,
    missing: Object.freeze([...missing]),
  };
}

function readFixture(input: unknown): FixtureReadResultV0 {
  const issues: K1EvaluationIssueV0[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        issue(
          "fixture",
          "fixture-not-object",
          "K1 ensemble spread fixture must be an object",
          input,
        ),
      ],
    };
  }

  if (input["schema"] !== K1_ENSEMBLE_SPREAD_SCHEMA_V0) {
    issues.push(
      issue(
        "schema",
        "schema-invalid",
        "K1 fixture schema must be openprose.reactor-cradle.k1-ensemble-spread",
        input["schema"],
      ),
    );
  }
  if (input["v"] !== K1_ENSEMBLE_SPREAD_VERSION_V0) {
    issues.push(
      issue(
        "v",
        "version-invalid",
        "K1 fixture version must be 0",
        input["v"],
      ),
    );
  }

  const fixtureId = readNonEmptyString(input, "fixture_id", "fixture", issues);
  const responsibilityId = readNonEmptyString(
    input,
    "responsibility_id",
    "fixture",
    issues,
  );
  const recordedAt = readNonEmptyString(input, "recorded_at", "fixture", issues);
  const anchor = readAnchor(input["anchor"], issues);
  const calibrationBar = readCalibrationBar(input["calibration_bar"], issues);
  const outputs = readOutputs(input["outputs"], issues);

  if (
    issues.length > 0 ||
    fixtureId === undefined ||
    responsibilityId === undefined ||
    recordedAt === undefined ||
    anchor === undefined ||
    calibrationBar === undefined ||
    outputs === undefined
  ) {
    return { ok: false, issues: Object.freeze([...issues]) };
  }

  return {
    ok: true,
    fixture: {
      schema: K1_ENSEMBLE_SPREAD_SCHEMA_V0,
      v: K1_ENSEMBLE_SPREAD_VERSION_V0,
      fixture_id: fixtureId,
      responsibility_id: responsibilityId,
      recorded_at: recordedAt,
      anchor,
      calibration_bar: calibrationBar,
      outputs,
    },
  };
}

function readAnchor(
  value: unknown,
  issues: K1EvaluationIssueV0[],
): K1CalibrationAnchorV0 | undefined {
  if (!isRecord(value)) {
    issues.push(
      issue(
        "anchor",
        "anchor-invalid",
        "K1 fixture must include a correctness anchor object",
        value,
      ),
    );
    return undefined;
  }

  const labelSource = readNonEmptyString(value, "label_source", "anchor", issues);
  const verdict = readVerdict(value, "verdict", "anchor", issues);
  const score = readUnitInterval(value, "score", "anchor", issues);
  const grade = value["calibration_grade"];
  if (
    typeof grade !== "string" ||
    !ANCHOR_GRADES.has(grade as K1AnchorCalibrationGradeV0)
  ) {
    issues.push(
      issue(
        "anchor.calibration_grade",
        "anchor-invalid",
        "K1 correctness anchor must be authored or accrued",
        grade,
      ),
    );
  }

  if (
    labelSource === undefined ||
    verdict === undefined ||
    score === undefined ||
    typeof grade !== "string" ||
    !ANCHOR_GRADES.has(grade as K1AnchorCalibrationGradeV0)
  ) {
    return undefined;
  }

  return {
    label_source: labelSource,
    calibration_grade: grade as K1AnchorCalibrationGradeV0,
    verdict,
    score,
  };
}

function readCalibrationBar(
  value: unknown,
  issues: K1EvaluationIssueV0[],
): K1CalibrationBarV0 | undefined {
  if (!isRecord(value)) {
    issues.push(
      issue(
        "calibration_bar",
        "calibration-bar-invalid",
        "K1 fixture must include a calibration bar object",
        value,
      ),
    );
    return undefined;
  }

  const maxMeanError = readUnitInterval(
    value,
    "max_mean_error",
    "calibration_bar",
    issues,
  );
  const maxSpreadErrorGap = readUnitInterval(
    value,
    "max_spread_error_gap",
    "calibration_bar",
    issues,
  );
  const lowSpreadThreshold = readUnitInterval(
    value,
    "low_spread_threshold",
    "calibration_bar",
    issues,
  );
  const maxErrorWhenLowSpread = readUnitInterval(
    value,
    "max_error_when_low_spread",
    "calibration_bar",
    issues,
  );

  if (
    maxMeanError === undefined ||
    maxSpreadErrorGap === undefined ||
    lowSpreadThreshold === undefined ||
    maxErrorWhenLowSpread === undefined
  ) {
    return undefined;
  }

  return {
    max_mean_error: maxMeanError,
    max_spread_error_gap: maxSpreadErrorGap,
    low_spread_threshold: lowSpreadThreshold,
    max_error_when_low_spread: maxErrorWhenLowSpread,
  };
}

function readOutputs(
  value: unknown,
  issues: K1EvaluationIssueV0[],
): readonly K1RecordedModelOutputV0[] | undefined {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        "outputs",
        "outputs-invalid",
        "K1 fixture outputs must be an array of recorded model outputs",
        value,
      ),
    );
    return undefined;
  }

  const outputs: K1RecordedModelOutputV0[] = [];
  for (const [index, item] of value.entries()) {
    const output = readOutput(item, index, issues);
    if (output !== undefined) {
      outputs.push(output);
    }
  }

  return Object.freeze([...outputs]);
}

function readOutput(
  value: unknown,
  index: number,
  issues: K1EvaluationIssueV0[],
): K1RecordedModelOutputV0 | undefined {
  const path = `outputs[${index}]`;
  if (!isRecord(value)) {
    issues.push(
      issue(
        path,
        "outputs-invalid",
        "K1 recorded model output must be an object",
        value,
      ),
    );
    return undefined;
  }

  const outputId = readNonEmptyString(value, "output_id", path, issues);
  const provider = readNonEmptyString(value, "provider", path, issues);
  const model = readNonEmptyString(value, "model", path, issues);
  const family = readNonEmptyString(value, "family", path, issues);
  const sizeClass = readNonEmptyString(value, "size_class", path, issues);
  const verdict = readVerdict(value, "verdict", path, issues);
  const score = readUnitInterval(value, "score", path, issues);
  const confidence = readUnitInterval(value, "confidence", path, issues);
  const text = readNonEmptyString(value, "text", path, issues);

  if (
    outputId === undefined ||
    provider === undefined ||
    model === undefined ||
    family === undefined ||
    sizeClass === undefined ||
    verdict === undefined ||
    score === undefined ||
    confidence === undefined ||
    text === undefined
  ) {
    return undefined;
  }

  return {
    output_id: outputId,
    provider,
    model,
    family,
    size_class: sizeClass,
    verdict,
    score,
    confidence,
    text,
  };
}

function readNonEmptyString(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  issues: K1EvaluationIssueV0[],
): string | undefined {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    issues.push(
      issue(
        `${path}.${key}`,
        "field-invalid",
        `${path}.${key} must be a non-empty string`,
        value,
      ),
    );
    return undefined;
  }

  return value;
}

function readUnitInterval(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  issues: K1EvaluationIssueV0[],
): number | undefined {
  const value = record[key];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    issues.push(
      issue(
        `${path}.${key}`,
        "field-invalid",
        `${path}.${key} must be a finite number in [0, 1]`,
        value,
      ),
    );
    return undefined;
  }

  return value;
}

function readVerdict(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  issues: K1EvaluationIssueV0[],
): K1EnsembleVerdictStatusV0 | undefined {
  const value = record[key];
  if (
    typeof value !== "string" ||
    !VERDICT_STATUSES.has(value as K1EnsembleVerdictStatusV0)
  ) {
    issues.push(
      issue(
        `${path}.${key}`,
        "field-invalid",
        `${path}.${key} must be one of up, drifting, down, blocked`,
        value,
      ),
    );
    return undefined;
  }

  return value as K1EnsembleVerdictStatusV0;
}

function scoreOutputAgainstAnchor(
  output: K1RecordedModelOutputV0,
  anchor: K1CalibrationAnchorV0,
): K1OutputAnchorScoreV0 {
  return {
    output_id: output.output_id,
    provider: output.provider,
    model: output.model,
    family: output.family,
    size_class: output.size_class,
    verdict: output.verdict,
    score: output.score,
    anchor_error: roundMetric(Math.abs(output.score - anchor.score)),
    matches_anchor_verdict: output.verdict === anchor.verdict,
  };
}

function degradedResult(input: {
  readonly summary: string;
  readonly fixture_id: string | null;
  readonly responsibility_id: string | null;
  readonly anchor: K1CalibrationAnchorV0 | null;
  readonly diversity: K1DiversityFloorEvaluationV0;
  readonly metrics: K1SpreadMetricsV0;
  readonly output_scores: readonly K1OutputAnchorScoreV0[];
  readonly issues: readonly K1EvaluationIssueV0[];
}): K1EnsembleSpreadEvaluationV0 {
  return {
    ok: false,
    status: "degraded",
    accepted_as_calibrated_confidence: false,
    summary: input.summary,
    fixture_id: input.fixture_id,
    responsibility_id: input.responsibility_id,
    anchor: input.anchor,
    diversity: input.diversity,
    metrics: input.metrics,
    output_scores: Object.freeze([...input.output_scores]),
    issues: Object.freeze([...input.issues]),
  };
}

function emptyDiversity(): K1DiversityFloorEvaluationV0 {
  return {
    floor_met: false,
    families: Object.freeze([]),
    providers: Object.freeze([]),
    size_classes: Object.freeze([]),
    missing: Object.freeze(["model-family", "provider", "size-boundary"]),
  };
}

function emptyMetrics(): K1SpreadMetricsV0 {
  return {
    output_count: 0,
    spread: 0,
    mean_anchor_error: 0,
    max_anchor_error: 0,
    spread_error_gap: 0,
    calibrated_confidence: null,
  };
}

function meanPairwiseDistance(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }

  let total = 0;
  let count = 0;
  for (let left = 0; left < values.length; left += 1) {
    const leftValue = values[left];
    if (leftValue === undefined) {
      continue;
    }
    for (let right = left + 1; right < values.length; right += 1) {
      const rightValue = values[right];
      if (rightValue === undefined) {
        continue;
      }
      total += Math.abs(leftValue - rightValue);
      count += 1;
    }
  }

  return count === 0 ? 0 : total / count;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze(Array.from(new Set(values)).sort());
}

function issue(
  path: string,
  code: K1IssueCodeV0,
  message: string,
  observed: unknown,
): K1EvaluationIssueV0 {
  return { path, code, message, observed };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
