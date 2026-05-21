import type {
  ReceiptEventCauseV0,
  ReceiptRecheckKindV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";

import type {
  ScenarioExpectedRelationshipV0,
  ScenarioReceiptLogV0,
  ScenarioRunReceiptV0,
  ScenarioRunTraceEntryV0,
  ScenarioWorldSurpriseV0,
} from "../scenario/types";

export type CradleAssertionFamilyV0 =
  | "static-surprise-zero"
  | "surprise-attribution-complete"
  | "flat-spend-under-static"
  | "no-fixed-interval-work"
  | "release-parity-fixture";

export type CradleAssertionStatusV0 = "pass" | "fail";

export interface CradleAssertionEvidenceV0 {
  readonly path: string;
  readonly message: string;
  readonly observed?: unknown;
}

export interface CradleAssertionResultV0 {
  readonly ok: boolean;
  readonly relationship: CradleAssertionFamilyV0;
  readonly family: CradleAssertionFamilyV0;
  readonly status: CradleAssertionStatusV0;
  readonly summary: string;
  readonly evidence: readonly CradleAssertionEvidenceV0[];
}

export interface CradleAssertionSuiteResultV0 {
  readonly status: CradleAssertionStatusV0;
  readonly results: readonly CradleAssertionResultV0[];
}

export interface FlatSpendUnderStaticOptionsV0 {
  readonly bootstrap_receipt_count?: number;
}

export interface CradleAssertionOptionsV0 {
  readonly flat_spend?: FlatSpendUnderStaticOptionsV0;
}

type TokenSourceKindV0 = "receipt" | "model-response";

interface TokenObservationV0 {
  readonly kind: TokenSourceKindV0;
  readonly path: string;
  readonly as_of: string;
  readonly fresh: number;
  readonly reused: number;
  readonly surprise_cause?: string;
  readonly recheck_kind?: string;
}

interface SurpriseObservationV0 {
  readonly path: string;
  readonly surprise: ScenarioWorldSurpriseV0;
}

const ALLOWED_SURPRISE_CAUSES = new Set<ReceiptEventCauseV0>([
  "real-input",
  "forecast-recheck",
  "escalation",
]);

export function assertStaticSurpriseZeroV0(
  run: ScenarioRunReceiptV0,
): CradleAssertionResultV0 {
  const failures: CradleAssertionEvidenceV0[] = [];
  const observations = collectSurpriseObservations(run);

  if (run.world_profile !== "static") {
    failures.push({
      path: "world_profile",
      message: "static-surprise-zero only applies to static world runs",
      observed: run.world_profile,
    });
  }

  if (observations.length === 0) {
    failures.push({
      path: "trace",
      message: "static world run has no surprise observations to prove zero",
    });
  }

  for (const observation of observations) {
    const surprise = observation.surprise;
    if (surprise.profile !== "static") {
      failures.push({
        path: `${observation.path}.profile`,
        message: "static run reported a non-static surprise profile",
        observed: surprise.profile,
      });
    }
    if (surprise.count !== 0) {
      failures.push({
        path: `${observation.path}.count`,
        message: "static run reported material surprise",
        observed: surprise.count,
      });
    }
    if (surprise.causes.length !== 0) {
      failures.push({
        path: `${observation.path}.causes`,
        message: "static run reported surprise causes",
        observed: surprise.causes,
      });
    }
  }

  if (failures.length > 0) {
    return result(
      "static-surprise-zero",
      "fail",
      "static-world surprise observations must all remain zero",
      failures,
    );
  }

  return result(
    "static-surprise-zero",
    "pass",
    "static-world surprise stayed at zero across the run trace",
    [
      {
        path: "trace",
        message: "checked static surprise observations",
        observed: { observations: observations.length },
      },
    ],
  );
}

export function assertSurpriseAttributionCompleteV0(
  run: ScenarioRunReceiptV0 | ScenarioReceiptLogV0 | readonly ReceiptV0[],
): CradleAssertionResultV0 {
  const observations = collectTokenObservations(run);
  const tokenBearing = observations.filter(isTokenBearing);
  const failures: CradleAssertionEvidenceV0[] = [];

  for (const observation of tokenBearing) {
    if (
      observation.surprise_cause === undefined ||
      !ALLOWED_SURPRISE_CAUSES.has(
        observation.surprise_cause as ReceiptEventCauseV0,
      )
    ) {
      failures.push({
        path: `${observation.path}.surprise_cause`,
        message: "token-bearing payload is missing a valid surprise cause",
        observed: {
          kind: observation.kind,
          fresh: observation.fresh,
          reused: observation.reused,
          surprise_cause: observation.surprise_cause ?? null,
        },
      });
    }
  }

  if (failures.length > 0) {
    return result(
      "surprise-attribution-complete",
      "fail",
      "every token-bearing receipt/model payload must name its surprise cause",
      failures,
    );
  }

  return result(
    "surprise-attribution-complete",
    "pass",
    "all token-bearing receipt/model payloads name a valid surprise cause",
    [
      {
        path: "receipt_log.entries",
        message: "checked token-bearing payloads",
        observed: {
          token_bearing_payloads: tokenBearing.length,
          token_payloads_seen: observations.length,
        },
      },
    ],
  );
}

export function assertFlatSpendUnderStaticV0(
  run: ScenarioRunReceiptV0,
  options: FlatSpendUnderStaticOptionsV0 = {},
): CradleAssertionResultV0 {
  const failures: CradleAssertionEvidenceV0[] = [];
  const tokenBearing = collectTokenObservations(run).filter(isTokenBearing);
  const bootstrapReceiptCount = options.bootstrap_receipt_count ?? 1;
  const postBootstrap = tokenBearing.slice(bootstrapReceiptCount);

  if (run.world_profile !== "static") {
    failures.push({
      path: "world_profile",
      message: "flat-spend-under-static only applies to static world runs",
      observed: run.world_profile,
    });
  }

  if (tokenBearing.length === 0) {
    failures.push({
      path: "receipt_log.entries",
      message: "static spend relationship needs token-bearing payload evidence",
    });
  }

  for (const observation of postBootstrap) {
    if (observation.fresh === 0) {
      continue;
    }
    if (isPlanAuditObservation(observation)) {
      continue;
    }

    failures.push({
      path: `${observation.path}.tokens.fresh`,
      message:
        "post-bootstrap static-world fresh spend must stay flat except plan-audit floor receipts",
      observed: {
        kind: observation.kind,
        fresh: observation.fresh,
        reused: observation.reused,
        surprise_cause: observation.surprise_cause ?? null,
        recheck_kind: observation.recheck_kind ?? null,
      },
    });
  }

  if (failures.length > 0) {
    return result(
      "flat-spend-under-static",
      "fail",
      "static-world fresh spend increased after bootstrap outside the plan-audit floor",
      failures,
    );
  }

  return result(
    "flat-spend-under-static",
    "pass",
    "static-world post-bootstrap fresh spend stayed flat apart from allowed plan-audit floor receipts",
    [
      {
        path: "receipt_log.entries",
        message: "checked token-bearing receipts by relationship after bootstrap",
        observed: {
          token_bearing_payloads: tokenBearing.length,
          bootstrap_receipt_count: bootstrapReceiptCount,
          post_bootstrap_payloads: postBootstrap.length,
          plan_audit_floor_payloads:
            postBootstrap.filter(isPlanAuditObservation).length,
        },
      },
    ],
  );
}

export function assertNoFixedIntervalWorkV0(
  run: ScenarioRunReceiptV0,
): CradleAssertionResultV0 {
  const failures: CradleAssertionEvidenceV0[] = [];
  const schedules = collectReceiptSchedules(run);
  const forecastTokenWork = collectTokenObservations(run).filter(
    (observation) =>
      isTokenBearing(observation) &&
      observation.surprise_cause === "forecast-recheck",
  );

  for (const work of forecastTokenWork) {
    const activeSchedule = findActiveSchedule(schedules, work.as_of);
    if (activeSchedule === undefined) {
      continue;
    }
    if (compareIsoInstants(work.as_of, activeSchedule.next_forecast_recheck) < 0) {
      failures.push({
        path: work.path,
        message:
          "forecast-recheck token work occurred before the prior scheduled check",
        observed: {
          as_of: work.as_of,
          previous_receipt_path: activeSchedule.path,
          next_forecast_recheck: activeSchedule.next_forecast_recheck,
          fresh: work.fresh,
          reused: work.reused,
        },
      });
    }
  }

  const traceGaps = collectTraceGaps(run);

  if (failures.length > 0) {
    return result(
      "no-fixed-interval-work",
      "fail",
      "forecast-paced runs must not spend tokens in virtual-clock gaps before the next scheduled check",
      failures,
    );
  }

  return result(
    "no-fixed-interval-work",
    "pass",
    "no forecast-recheck token work appeared before the next scheduled check",
    [
      {
        path: "trace",
        message: "checked virtual-clock trace gaps against receipt schedules",
        observed: {
          trace_gaps: traceGaps,
          scheduled_receipts: schedules.length,
          forecast_token_work: forecastTokenWork.length,
        },
      },
    ],
  );
}

export function evaluateCradleAssertionV0(
  run: ScenarioRunReceiptV0,
  family: CradleAssertionFamilyV0,
  options: CradleAssertionOptionsV0 = {},
): CradleAssertionResultV0 {
  switch (family) {
    case "static-surprise-zero":
      return assertStaticSurpriseZeroV0(run);
    case "surprise-attribution-complete":
      return assertSurpriseAttributionCompleteV0(run);
    case "flat-spend-under-static":
      return assertFlatSpendUnderStaticV0(run, options.flat_spend);
    case "no-fixed-interval-work":
      return assertNoFixedIntervalWorkV0(run);
    case "release-parity-fixture":
      throw new Error(
        "release-parity-fixture assertions are emitted by the recorded release-parity module",
      );
  }
}

export function evaluateCradleAssertionsV0(
  run: ScenarioRunReceiptV0,
  families: readonly CradleAssertionFamilyV0[],
  options: CradleAssertionOptionsV0 = {},
): CradleAssertionSuiteResultV0 {
  return suiteResult(
    families.map((family) => evaluateCradleAssertionV0(run, family, options)),
  );
}

export function evaluateExpectedCradleRelationshipsV0(
  run: ScenarioRunReceiptV0,
  options: CradleAssertionOptionsV0 = {},
): CradleAssertionSuiteResultV0 {
  const families = run.expected_relationships.flatMap((relationship) =>
    familyFromExpectedRelationship(relationship),
  );

  return evaluateCradleAssertionsV0(run, uniqueFamilies(families), options);
}

function familyFromExpectedRelationship(
  relationship: ScenarioExpectedRelationshipV0,
): readonly CradleAssertionFamilyV0[] {
  switch (relationship.relationship) {
    case "static-surprise-zero":
      return ["static-surprise-zero"];
    case "surprise-attribution-complete":
    case "every-token-has-surprise-cause":
      return ["surprise-attribution-complete"];
    case "flat-spend-under-static":
    case "tokens-flat-after-bootstrap":
      return ["flat-spend-under-static"];
    case "no-fixed-interval-work":
      return ["no-fixed-interval-work"];
    default:
      return [];
  }
}

function uniqueFamilies(
  families: readonly CradleAssertionFamilyV0[],
): readonly CradleAssertionFamilyV0[] {
  return Array.from(new Set(families));
}

function suiteResult(
  results: readonly CradleAssertionResultV0[],
): CradleAssertionSuiteResultV0 {
  return {
    status: results.some((item) => item.status === "fail") ? "fail" : "pass",
    results: Object.freeze([...results]),
  };
}

function result(
  family: CradleAssertionFamilyV0,
  status: CradleAssertionStatusV0,
  summary: string,
  evidence: readonly CradleAssertionEvidenceV0[],
): CradleAssertionResultV0 {
  return {
    ok: status === "pass",
    relationship: family,
    family,
    status,
    summary,
    evidence: Object.freeze([...evidence]),
  };
}

function collectSurpriseObservations(
  run: ScenarioRunReceiptV0,
): readonly SurpriseObservationV0[] {
  const observations: SurpriseObservationV0[] = [];

  for (const [traceIndex, entry] of run.trace.entries()) {
    if (entry.world_advance?.surprise !== undefined) {
      observations.push({
        path: `trace[${traceIndex}].world_advance.surprise`,
        surprise: entry.world_advance.surprise,
      });
    }

    if (entry.world_event?.surprise !== undefined) {
      observations.push({
        path: `trace[${traceIndex}].world_event.surprise`,
        surprise: entry.world_event.surprise,
      });
    }

    for (const [readIndex, read] of entry.world_reads.entries()) {
      if (read.surprise !== undefined) {
        observations.push({
          path: `trace[${traceIndex}].world_reads[${readIndex}].surprise`,
          surprise: read.surprise,
        });
      }
    }
  }

  return observations;
}

function collectTokenObservations(
  input: ScenarioRunReceiptV0 | ScenarioReceiptLogV0 | readonly ReceiptV0[],
): readonly TokenObservationV0[] {
  const receipts = readReceipts(input);
  const observations: TokenObservationV0[] = receipts.map((receipt, index) => ({
    kind: "receipt",
    path: `receipt_log.entries[${index}].cost`,
    as_of: receipt.cost.as_of,
    fresh: receipt.cost.tokens.fresh,
    reused: receipt.cost.tokens.reused,
    surprise_cause: receipt.cost.surprise_cause,
    ...(receipt.core.recheck_kind === undefined
      ? {}
      : { recheck_kind: receipt.core.recheck_kind }),
  }));

  if (isScenarioRun(input)) {
    observations.push(...collectModelResponseTokenObservations(input));
  }

  return observations;
}

function collectModelResponseTokenObservations(
  run: ScenarioRunReceiptV0,
): readonly TokenObservationV0[] {
  const observations: TokenObservationV0[] = [];

  for (const [traceIndex, entry] of run.trace.entries()) {
    const payload = entry.model_response?.payload;
    if (!isRecord(payload)) {
      continue;
    }

    const tokens = readTokens(payload["tokens"]);
    if (tokens === undefined) {
      continue;
    }

    observations.push({
      kind: "model-response",
      path: `trace[${traceIndex}].model_response.payload`,
      as_of: entry.as_of,
      fresh: tokens.fresh,
      reused: tokens.reused,
      ...(typeof payload["surprise_cause"] === "string"
        ? { surprise_cause: payload["surprise_cause"] }
        : {}),
      ...(typeof payload["recheck_kind"] === "string"
        ? { recheck_kind: payload["recheck_kind"] }
        : {}),
    });
  }

  return observations;
}

function readReceipts(
  input: ScenarioRunReceiptV0 | ScenarioReceiptLogV0 | readonly ReceiptV0[],
): readonly ReceiptV0[] {
  if (isReceiptArray(input)) {
    return input;
  }
  if (isScenarioRun(input)) {
    return input.receipt_log.entries;
  }
  if (isScenarioReceiptLog(input)) {
    return input.entries;
  }

  return [];
}

function isScenarioRun(value: unknown): value is ScenarioRunReceiptV0 {
  return isRecord(value) && Array.isArray(value["trace"]);
}

function isScenarioReceiptLog(value: unknown): value is ScenarioReceiptLogV0 {
  return isRecord(value) && Array.isArray(value["entries"]);
}

function isReceiptArray(value: unknown): value is readonly ReceiptV0[] {
  return Array.isArray(value);
}

function isTokenBearing(observation: TokenObservationV0): boolean {
  return observation.fresh + observation.reused > 0;
}

function isPlanAuditObservation(observation: TokenObservationV0): boolean {
  return (
    observation.surprise_cause === "forecast-recheck" &&
    observation.recheck_kind === ("plan-age" satisfies ReceiptRecheckKindV0)
  );
}

interface ReceiptScheduleV0 {
  readonly path: string;
  readonly as_of: string;
  readonly next_forecast_recheck: string;
}

function collectReceiptSchedules(
  run: ScenarioRunReceiptV0,
): readonly ReceiptScheduleV0[] {
  return run.receipt_log.entries
    .map((receipt, index) => ({
      path: `receipt_log.entries[${index}].freshness.next_forecast_recheck`,
      as_of: receipt.freshness.as_of,
      next_forecast_recheck: receipt.freshness.next_forecast_recheck,
    }))
    .sort((left, right) => compareIsoInstants(left.as_of, right.as_of));
}

function findActiveSchedule(
  schedules: readonly ReceiptScheduleV0[],
  asOf: string,
): ReceiptScheduleV0 | undefined {
  let active: ReceiptScheduleV0 | undefined;

  for (const schedule of schedules) {
    if (compareIsoInstants(schedule.as_of, asOf) < 0) {
      active = schedule;
    }
  }

  return active;
}

function collectTraceGaps(run: ScenarioRunReceiptV0): readonly string[] {
  const gaps: string[] = [];

  for (let index = 1; index < run.trace.length; index += 1) {
    const previous = run.trace[index - 1];
    const current = run.trace[index];
    if (previous === undefined || current === undefined) {
      continue;
    }
    if (previous.as_of !== current.as_of) {
      gaps.push(`${previous.as_of}..${current.as_of}`);
    }
  }

  return gaps;
}

function compareIsoInstants(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}

function readTokens(
  value: unknown,
): { readonly fresh: number; readonly reused: number } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fresh = value["fresh"];
  const reused = value["reused"];
  if (
    typeof fresh !== "number" ||
    typeof reused !== "number" ||
    !Number.isFinite(fresh) ||
    !Number.isFinite(reused)
  ) {
    return undefined;
  }

  return { fresh, reused };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
