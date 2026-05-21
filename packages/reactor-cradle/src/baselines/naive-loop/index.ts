import type { ReactorModelGatewayResponseV0 } from "@openprose/reactor/sdk";

import type { ModelGatewayCassetteV0 } from "../../replay/model-gateway";
import {
  canonicalScenarioInstant,
  parseScenarioDurationMs,
  parseScenarioInstantMs,
} from "../../scenario/time";
import type {
  ReactorScenarioV0,
  ScenarioScriptStepV0,
} from "../../scenario/types";

export const NAIVE_LOOP_BASELINE_SCHEMA_V0 =
  "openprose.reactor-cradle.baseline.naive-loop.summary" as const;
export const NAIVE_LOOP_BASELINE_VERSION_V0 = 0 as const;
export const NAIVE_LOOP_VARIANT_NAME_V0 = "naive-loop" as const;

export type NaiveLoopReviewKindV0 =
  | "scripted-model-review"
  | "real-input-review"
  | "scheduled-review";

export type NaiveLoopReviewStepKindV0 = "model" | "ingest" | "tick";

export interface NaiveLoopTokenSummaryV0 {
  readonly fresh: number;
  readonly reused: number;
}

export interface NaiveLoopPerInvocationTokenChargeV0 {
  readonly recorded: NaiveLoopTokenSummaryV0;
  readonly charged: NaiveLoopTokenSummaryV0;
}

export interface NaiveLoopReviewTurnV0 {
  readonly index: number;
  readonly step_kind: NaiveLoopReviewStepKindV0;
  readonly review_kind: NaiveLoopReviewKindV0;
  readonly as_of: string;
  readonly prompt: string;
  readonly source_ids: readonly string[];
  readonly recheck_kind?: "evidence-age" | "plan-age";
}

export interface NaiveLoopBaselineSummaryV0 {
  readonly schema: typeof NAIVE_LOOP_BASELINE_SCHEMA_V0;
  readonly v: typeof NAIVE_LOOP_BASELINE_VERSION_V0;
  readonly scenario_id: string;
  readonly world_profile: ReactorScenarioV0["world"]["profile"];
  readonly variant: typeof NAIVE_LOOP_VARIANT_NAME_V0;
  readonly turn_count: number;
  readonly model_invocation_count: number;
  readonly tokens: NaiveLoopTokenSummaryV0;
  readonly ratio: string;
  readonly per_invocation_tokens: NaiveLoopPerInvocationTokenChargeV0;
  readonly review_turns: readonly NaiveLoopReviewTurnV0[];
  readonly notes: readonly string[];
}

export interface MeasureNaiveLoopBaselineInputV0 {
  readonly scenario: ReactorScenarioV0;
  readonly cassette: ModelGatewayCassetteV0;
  readonly prompt?: string;
  readonly include_scripted_model_steps?: boolean;
}

export function measureNaiveLoopBaselineV0(
  input: MeasureNaiveLoopBaselineInputV0,
): NaiveLoopBaselineSummaryV0 {
  const recorded = readRecordedJudgeTokenSummary(input.cassette);
  const charged: NaiveLoopTokenSummaryV0 = Object.freeze({
    fresh: recorded.fresh + recorded.reused,
    reused: 0,
  });
  if (charged.fresh <= 0) {
    throw new Error("naive-loop baseline requires a positive cassette token charge");
  }

  const prompt =
    input.prompt ?? firstScenarioJudgePrompt(input.scenario) ?? "review-static-world";
  const reviewTurns = collectNaiveLoopReviewTurns({
    scenario: input.scenario,
    prompt,
    includeScriptedModelSteps: input.include_scripted_model_steps ?? false,
  });
  if (reviewTurns.length === 0) {
    throw new Error("naive-loop baseline requires at least one review turn");
  }

  const tokens: NaiveLoopTokenSummaryV0 = Object.freeze({
    fresh: multiplySafe(charged.fresh, reviewTurns.length, "naive-loop fresh tokens"),
    reused: 0,
  });

  return Object.freeze({
    schema: NAIVE_LOOP_BASELINE_SCHEMA_V0,
    v: NAIVE_LOOP_BASELINE_VERSION_V0,
    scenario_id: input.scenario.id,
    world_profile: input.scenario.world.profile,
    variant: NAIVE_LOOP_VARIANT_NAME_V0,
    turn_count: reviewTurns.length,
    model_invocation_count: reviewTurns.length,
    tokens,
    ratio: formatFreshReusedRatio(tokens),
    per_invocation_tokens: Object.freeze({
      recorded,
      charged,
    }),
    review_turns: Object.freeze([...reviewTurns]),
    notes: Object.freeze([
      "Non-Reactor control: no receipts, memo keys, forecast policy, stable content identity, or reusable verdict architecture.",
      "Every counted review turn rereads the scenario sources for that turn and sends a fresh prompt.",
      `Per-review charge is the recorded judge cassette total (fresh + reused = ${charged.fresh}) converted to fresh tokens, so the baseline uses the same cassette usage shape without claiming reuse.`,
      "Scripted model steps are Cradle replay setup unless include_scripted_model_steps is true; ingest and tick review steps are the counted model invocations.",
      "Scripted read steps are evidence reads only and do not add a model invocation unless paired with a counted review turn.",
      "Static evidence is intentionally unchanged; this baseline still re-prompts because a cron/prompt loop has no receipt/memo proof that the prior judgment is reusable.",
    ]),
  });
}

function collectNaiveLoopReviewTurns(input: {
  readonly scenario: ReactorScenarioV0;
  readonly prompt: string;
  readonly includeScriptedModelSteps: boolean;
}): readonly NaiveLoopReviewTurnV0[] {
  const initialInstant = canonicalScenarioInstant(
    input.scenario.initial_instant,
    "scenario.initial_instant",
  );
  const initialEpochMs = parseScenarioInstantMs(
    initialInstant,
    "scenario.initial_instant",
  );
  let currentEpochMs = initialEpochMs;
  const turns: NaiveLoopReviewTurnV0[] = [];

  for (const [index, step] of input.scenario.script.entries()) {
    currentEpochMs = stepEpochMs(step, initialEpochMs, currentEpochMs);
    const turn = reviewTurnForStep({
      scenario: input.scenario,
      step,
      index,
      asOf: new Date(currentEpochMs).toISOString(),
      prompt: input.prompt,
      includeScriptedModelSteps: input.includeScriptedModelSteps,
    });
    if (turn !== undefined) {
      turns.push(turn);
    }
  }

  return Object.freeze(turns);
}

function stepEpochMs(
  step: ScenarioScriptStepV0,
  initialEpochMs: number,
  currentEpochMs: number,
): number {
  if ("at" in step.time) {
    const nextEpochMs =
      initialEpochMs + parseScenarioDurationMs(step.time.at, "script at");
    if (nextEpochMs < currentEpochMs) {
      throw new Error(`scenario step cannot move time backward to ${step.time.at}`);
    }

    return nextEpochMs;
  }

  return currentEpochMs + parseScenarioDurationMs(step.time.after, "script after");
}

function reviewTurnForStep(input: {
  readonly scenario: ReactorScenarioV0;
  readonly step: ScenarioScriptStepV0;
  readonly index: number;
  readonly asOf: string;
  readonly prompt: string;
  readonly includeScriptedModelSteps: boolean;
}): NaiveLoopReviewTurnV0 | undefined {
  switch (input.step.kind) {
    case "model":
      if (
        !input.includeScriptedModelSteps ||
        input.step.request_kind !== "judge"
      ) {
        return undefined;
      }

      return Object.freeze({
        index: input.index,
        step_kind: "model",
        review_kind: "scripted-model-review",
        as_of: input.asOf,
        prompt: input.step.prompt,
        source_ids: scenarioSourceIds(input.scenario),
      });
    case "ingest":
      return Object.freeze({
        index: input.index,
        step_kind: "ingest",
        review_kind: "real-input-review",
        as_of: input.asOf,
        prompt: input.prompt,
        source_ids:
          input.step.source_id === undefined
            ? scenarioSourceIds(input.scenario)
            : Object.freeze([input.step.source_id]),
      });
    case "tick":
      return Object.freeze({
        index: input.index,
        step_kind: "tick",
        review_kind: "scheduled-review",
        as_of: input.asOf,
        prompt: input.prompt,
        source_ids: scenarioSourceIds(input.scenario),
        ...(input.step.recheck_kind === undefined
          ? {}
          : { recheck_kind: input.step.recheck_kind }),
      });
    case "read":
      return undefined;
  }
}

function scenarioSourceIds(scenario: ReactorScenarioV0): readonly string[] {
  return Object.freeze(scenario.sources.map((source) => source.id));
}

function firstScenarioJudgePrompt(
  scenario: ReactorScenarioV0,
): string | undefined {
  for (const step of scenario.script) {
    if (step.kind === "model" && step.request_kind === "judge") {
      return step.prompt;
    }
  }

  return undefined;
}

function readRecordedJudgeTokenSummary(
  cassette: ModelGatewayCassetteV0,
): NaiveLoopTokenSummaryV0 {
  const exchange =
    cassette.exchanges.find((item) => item.request.kind === "judge") ??
    cassette.exchanges[0];
  if (exchange === undefined) {
    throw new Error("naive-loop baseline requires a cassette exchange");
  }

  return readResponseTokenSummary(exchange.response);
}

function readResponseTokenSummary(
  response: ReactorModelGatewayResponseV0,
): NaiveLoopTokenSummaryV0 {
  if (response.usage !== undefined) {
    return Object.freeze({
      fresh: readTokenCount(response.usage.tokens.fresh, "response.usage.tokens.fresh"),
      reused: readTokenCount(
        response.usage.tokens.reused,
        "response.usage.tokens.reused",
      ),
    });
  }

  const payloadTokens = readPayloadTokens(response.payload);
  if (payloadTokens !== undefined) {
    return payloadTokens;
  }

  throw new Error("model gateway response must include usage tokens or payload tokens");
}

function readPayloadTokens(payload: unknown): NaiveLoopTokenSummaryV0 | undefined {
  if (!isRecord(payload) || !isRecord(payload["tokens"])) {
    return undefined;
  }

  return Object.freeze({
    fresh: readTokenCount(payload["tokens"]["fresh"], "response.payload.tokens.fresh"),
    reused: readTokenCount(
      payload["tokens"]["reused"],
      "response.payload.tokens.reused",
    ),
  });
}

function readTokenCount(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }

  return value;
}

function multiplySafe(left: number, right: number, label: string): number {
  const product = left * right;
  if (!Number.isSafeInteger(product)) {
    throw new Error(`${label} exceeded the safe integer range`);
  }

  return product;
}

function formatFreshReusedRatio(tokens: NaiveLoopTokenSummaryV0): string {
  return `${tokens.fresh}:${tokens.reused}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
