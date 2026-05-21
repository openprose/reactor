import { readFileSync } from "node:fs";
import {
  K1_ENSEMBLE_SPREAD_SCHEMA_V0,
  K1_ENSEMBLE_SPREAD_VERSION_V0,
  type K1CalibrationAnchorV0,
  type K1CalibrationBarV0,
  type K1EnsembleSpreadFixtureV0,
  type K1EnsembleVerdictStatusV0,
  type K1RecordedModelOutputV0,
} from "./k1-ensemble-spread";

export const OPENPROSE_DOTENV_PATH_V0 = ".env" as const;
export const OPENROUTER_API_KEY_ENV_NAME_V0 = "OPENROUTER_API_KEY" as const;
export const OPENROUTER_LIVE_REFRESH_PROVIDER_V0 = "openrouter" as const;
export const OPENROUTER_LIVE_REFRESH_DEFAULT_MODEL_V0 =
  "google/gemini-3.1-flash-lite-preview" as const;
export const OPENROUTER_LIVE_REFRESH_STANDING_CAP_USD_V0 = 200 as const;
export const OPENROUTER_LIVE_REFRESH_GUARD_SCHEMA_V0 =
  "openprose.reactor-cradle.openrouter-live-refresh-guard" as const;
export const OPENROUTER_LIVE_REFRESH_GUARD_VERSION_V0 = 0 as const;
export const OPENROUTER_K1_LIVE_RECORDING_SCHEMA_V0 =
  "openprose.reactor-cradle.k1-live-recording" as const;
export const OPENROUTER_K1_LIVE_RECORDING_VERSION_V0 = 0 as const;
export const OPENROUTER_K1_LIVE_CHAT_COMPLETIONS_URL_V0 =
  "https://openrouter.ai/api/v1/chat/completions" as const;
export const OPENROUTER_K1_LIVE_RECORDING_MODELS_V0 = Object.freeze([
  {
    provider: "google",
    model: OPENROUTER_LIVE_REFRESH_DEFAULT_MODEL_V0,
    family: "gemini",
    size_class: "small",
    prompt_cost_per_token_usd: 0.00000025,
    completion_cost_per_token_usd: 0.0000015,
    max_output_tokens: 180,
    request_cap_usd: 0.25,
  },
  {
    provider: "mistralai",
    model: "mistralai/mistral-small-3.2-24b-instruct",
    family: "mistral",
    size_class: "small",
    prompt_cost_per_token_usd: 0.000000075,
    completion_cost_per_token_usd: 0.0000002,
    max_output_tokens: 180,
    request_cap_usd: 0.25,
  },
  {
    provider: "qwen",
    model: "qwen/qwen-2.5-72b-instruct",
    family: "qwen",
    size_class: "large",
    prompt_cost_per_token_usd: 0.00000036,
    completion_cost_per_token_usd: 0.0000004,
    max_output_tokens: 180,
    request_cap_usd: 0.25,
  },
] as const satisfies readonly OpenRouterK1LiveModelSpecV0[]);

export type OpenRouterLiveRefreshModelV0 =
  typeof OPENROUTER_LIVE_REFRESH_DEFAULT_MODEL_V0;

export type OpenRouterLiveRefreshEnvReaderV0 = (path: string) => string;

export interface OpenRouterLiveRefreshAccountingV0 {
  readonly currency: "USD";
  readonly cap_usd: number;
  readonly spent_usd: number;
  readonly request_cap_usd: number;
  readonly account_ref: string;
  readonly ledger_ref: string;
}

export interface PrepareOpenRouterLiveRefreshInputV0 {
  readonly allow_live?: boolean;
  readonly accounting?: OpenRouterLiveRefreshAccountingV0;
  readonly env_path?: string;
  readonly model?: string;
  readonly readEnvFile?: OpenRouterLiveRefreshEnvReaderV0;
}

export interface OpenRouterLiveRefreshDisabledV0 {
  readonly schema: typeof OPENROUTER_LIVE_REFRESH_GUARD_SCHEMA_V0;
  readonly v: typeof OPENROUTER_LIVE_REFRESH_GUARD_VERSION_V0;
  readonly status: "disabled";
  readonly provider: typeof OPENROUTER_LIVE_REFRESH_PROVIDER_V0;
  readonly reason: "live-opt-in-required";
}

export interface OpenRouterLiveRefreshReadyAccountingV0 {
  readonly currency: "USD";
  readonly cap_usd: number;
  readonly spent_usd: number;
  readonly request_cap_usd: number;
  readonly remaining_usd: number;
  readonly remaining_after_request_usd: number;
  readonly account_ref: string;
  readonly ledger_ref: string;
  readonly standing_cap_usd: typeof OPENROUTER_LIVE_REFRESH_STANDING_CAP_USD_V0;
}

export interface OpenRouterLiveRefreshReadyV0 {
  readonly schema: typeof OPENROUTER_LIVE_REFRESH_GUARD_SCHEMA_V0;
  readonly v: typeof OPENROUTER_LIVE_REFRESH_GUARD_VERSION_V0;
  readonly status: "ready";
  readonly provider: typeof OPENROUTER_LIVE_REFRESH_PROVIDER_V0;
  readonly env_path: string;
  readonly env_key_name: typeof OPENROUTER_API_KEY_ENV_NAME_V0;
  readonly api_key_present: true;
  readonly model: OpenRouterLiveRefreshModelV0;
  readonly accounting: OpenRouterLiveRefreshReadyAccountingV0;
}

export type OpenRouterLiveRefreshGuardResultV0 =
  | OpenRouterLiveRefreshDisabledV0
  | OpenRouterLiveRefreshReadyV0;

export type OpenRouterLiveRefreshInvokerV0<T> = (
  ready: OpenRouterLiveRefreshReadyV0,
) => T;

export interface OpenRouterK1LiveModelSpecV0 {
  readonly provider: string;
  readonly model: string;
  readonly family: string;
  readonly size_class: "small" | "medium" | "large";
  readonly prompt_cost_per_token_usd: number;
  readonly completion_cost_per_token_usd: number;
  readonly max_output_tokens: number;
  readonly request_cap_usd: number;
}

export interface RecordOpenRouterK1LiveFixtureInputV0
  extends PrepareOpenRouterLiveRefreshInputV0 {
  readonly fetch?: typeof fetch;
  readonly models?: readonly OpenRouterK1LiveModelSpecV0[];
  readonly now?: () => Date;
}

export interface OpenRouterK1LiveOutputRecordingV0 {
  readonly output_id: string;
  readonly provider: string;
  readonly model: string;
  readonly request_id: string;
  readonly response_id: string;
  readonly latency_ms: number;
  readonly finish_reason: string;
  readonly usage: Readonly<Record<string, unknown>>;
  readonly spend_usd: number;
  readonly spend_source:
    | "openrouter-usage-cost"
    | "pricing-estimate-from-token-usage";
}

export interface OpenRouterK1LiveRecordingBlockV0 {
  readonly schema: typeof OPENROUTER_K1_LIVE_RECORDING_SCHEMA_V0;
  readonly v: typeof OPENROUTER_K1_LIVE_RECORDING_VERSION_V0;
  readonly provider: typeof OPENROUTER_LIVE_REFRESH_PROVIDER_V0;
  readonly chat_completions_url: typeof OPENROUTER_K1_LIVE_CHAT_COMPLETIONS_URL_V0;
  readonly started_at: string;
  readonly completed_at: string;
  readonly cap_usd: number;
  readonly request_cap_usd: number;
  readonly spend_usd: number;
  readonly currency: "USD";
  readonly model_count: number;
  readonly request_count: number;
  readonly model_specs: readonly OpenRouterK1LiveModelSpecV0[];
  readonly outputs: readonly OpenRouterK1LiveOutputRecordingV0[];
}

export interface OpenRouterK1LiveRecordedFixtureV0
  extends K1EnsembleSpreadFixtureV0 {
  readonly recording: OpenRouterK1LiveRecordingBlockV0;
}

export interface OpenRouterLiveRefreshSkippedRunV0 {
  readonly status: "disabled";
  readonly invoked: false;
  readonly guard: OpenRouterLiveRefreshDisabledV0;
}

export interface OpenRouterLiveRefreshInvokedRunV0<T> {
  readonly status: "ready";
  readonly invoked: true;
  readonly guard: OpenRouterLiveRefreshReadyV0;
  readonly result: T;
}

export type OpenRouterLiveRefreshRunResultV0<T> =
  | OpenRouterLiveRefreshSkippedRunV0
  | OpenRouterLiveRefreshInvokedRunV0<T>;

export function prepareOpenRouterLiveRefreshV0(
  input: PrepareOpenRouterLiveRefreshInputV0 = {},
): OpenRouterLiveRefreshGuardResultV0 {
  if (input.allow_live !== true) {
    return {
      schema: OPENROUTER_LIVE_REFRESH_GUARD_SCHEMA_V0,
      v: OPENROUTER_LIVE_REFRESH_GUARD_VERSION_V0,
      status: "disabled",
      provider: OPENROUTER_LIVE_REFRESH_PROVIDER_V0,
      reason: "live-opt-in-required",
    };
  }

  const accounting = validateAccounting(input.accounting);
  const model = validateModel(input.model);
  const envPath = normalizeEnvPath(input.env_path);
  const envText = readDotenvText(envPath, input.readEnvFile);

  if (!hasOpenRouterApiKeyInDotenvV0(envText)) {
    throw new Error(
      `live refresh requires ${OPENROUTER_API_KEY_ENV_NAME_V0} in ${envPath}`,
    );
  }

  return {
    schema: OPENROUTER_LIVE_REFRESH_GUARD_SCHEMA_V0,
    v: OPENROUTER_LIVE_REFRESH_GUARD_VERSION_V0,
    status: "ready",
    provider: OPENROUTER_LIVE_REFRESH_PROVIDER_V0,
    env_path: envPath,
    env_key_name: OPENROUTER_API_KEY_ENV_NAME_V0,
    api_key_present: true,
    model,
    accounting,
  };
}

export function runOpenRouterLiveRefreshV0<T>(
  input: PrepareOpenRouterLiveRefreshInputV0,
  invokeLiveRefresh: OpenRouterLiveRefreshInvokerV0<T>,
): OpenRouterLiveRefreshRunResultV0<T> {
  const guard = prepareOpenRouterLiveRefreshV0(input);
  if (guard.status === "disabled") {
    return {
      status: "disabled",
      invoked: false,
      guard,
    };
  }

  return {
    status: "ready",
    invoked: true,
    guard,
    result: invokeLiveRefresh(guard),
  };
}

export async function recordOpenRouterK1LiveFixtureV0(
  input: RecordOpenRouterK1LiveFixtureInputV0,
): Promise<OpenRouterK1LiveRecordedFixtureV0> {
  const guard = prepareOpenRouterLiveRefreshV0(input);
  if (guard.status !== "ready") {
    throw new Error("K1 live recording requires explicit live opt-in");
  }

  const models = Object.freeze([
    ...(input.models ?? OPENROUTER_K1_LIVE_RECORDING_MODELS_V0),
  ]);
  validateK1LiveModelSet(models);
  const prompt = buildK1LivePrompt();
  const costPlan = planK1LiveRequestCosts(models, prompt, guard.accounting);
  const apiKey = readOpenRouterApiKey(input.env_path, input.readEnvFile);
  const liveFetch = input.fetch ?? fetch;
  const startedAt = (input.now?.() ?? new Date()).toISOString();
  const outputs: K1RecordedModelOutputV0[] = [];
  const outputRecordings: OpenRouterK1LiveOutputRecordingV0[] = [];

  for (const [index, model] of models.entries()) {
    const requestStartedAt = Date.now();
    const response = await liveFetch(OPENROUTER_K1_LIVE_CHAT_COMPLETIONS_URL_V0, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "http-referer": "https://github.com/openprose/prose",
        "x-title": "OpenProse Reactor Cradle K1 Live Recording",
      },
      body: JSON.stringify({
        model: model.model,
        messages: [
          {
            role: "system",
            content:
              "You are a calibration judge. Return only compact JSON. Do not include markdown fences.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0,
        max_tokens: model.max_output_tokens,
        usage: { include: true },
      }),
    });
    const latencyMs = Math.max(0, Date.now() - requestStartedAt);
    const requestId =
      response.headers.get("x-request-id") ??
      response.headers.get("x-openrouter-request-id") ??
      response.headers.get("cf-ray") ??
      "";

    if (!response.ok) {
      const body = await safeResponseText(response);
      throw new Error(
        `OpenRouter K1 live recording failed for ${model.model}: HTTP ${response.status} ${body}`,
      );
    }

    const body = (await response.json()) as unknown;
    const parsed = parseOpenRouterChatCompletion(body, model, index);
    const usage = parsed.usage;
    const spend = usageCostUsd(usage) ?? estimateUsageCostUsd(model, usage);
    if (spend > model.request_cap_usd) {
      throw new Error(
        `OpenRouter K1 live recording spend for ${model.model} exceeded per-call cap`,
      );
    }

    const outputId = `${sanitizeOutputId(model.model)}-${parsed.response_id}`;
    outputs.push({
      output_id: outputId,
      provider: model.provider,
      model: model.model,
      family: model.family,
      size_class: model.size_class,
      verdict: parsed.verdict,
      score: parsed.score,
      confidence: parsed.confidence,
      text: parsed.text,
    });
    outputRecordings.push({
      output_id: outputId,
      provider: model.provider,
      model: model.model,
      request_id: requestId.length === 0 ? parsed.response_id : requestId,
      response_id: parsed.response_id,
      latency_ms: latencyMs,
      finish_reason: parsed.finish_reason,
      usage,
      spend_usd: roundLiveSpendUsd(spend),
      spend_source:
        usageCostUsd(usage) === undefined
          ? "pricing-estimate-from-token-usage"
          : "openrouter-usage-cost",
    });
  }

  const spendUsd = roundLiveSpendUsd(
    outputRecordings.reduce((total, output) => total + output.spend_usd, 0),
  );
  if (spendUsd > costPlan.total_request_cap_usd) {
    throw new Error("OpenRouter K1 live recording exceeded total request cap");
  }

  const completedAt = (input.now?.() ?? new Date()).toISOString();
  return {
    schema: K1_ENSEMBLE_SPREAD_SCHEMA_V0,
    v: K1_ENSEMBLE_SPREAD_VERSION_V0,
    fixture_id: `k1-live-recorded-openrouter-${startedAt.slice(0, 10)}`,
    responsibility_id: "incident-briefing",
    recorded_at: completedAt,
    anchor: K1_LIVE_ANCHOR_V0,
    calibration_bar: K1_LIVE_CALIBRATION_BAR_V0,
    outputs,
    recording: {
      schema: OPENROUTER_K1_LIVE_RECORDING_SCHEMA_V0,
      v: OPENROUTER_K1_LIVE_RECORDING_VERSION_V0,
      provider: OPENROUTER_LIVE_REFRESH_PROVIDER_V0,
      chat_completions_url: OPENROUTER_K1_LIVE_CHAT_COMPLETIONS_URL_V0,
      started_at: startedAt,
      completed_at: completedAt,
      cap_usd: guard.accounting.cap_usd,
      request_cap_usd: costPlan.total_request_cap_usd,
      spend_usd: spendUsd,
      currency: "USD",
      model_count: models.length,
      request_count: outputRecordings.length,
      model_specs: models,
      outputs: outputRecordings,
    },
  };
}

export function hasOpenRouterApiKeyInDotenvV0(dotenvText: string): boolean {
  for (const line of dotenvText.split(/\r?\n/)) {
    const match = /^(?:export\s+)?OPENROUTER_API_KEY\s*=\s*(.*)$/.exec(
      line.trim(),
    );
    if (match === null) {
      continue;
    }

    const rawValue = match[1];
    if (rawValue === undefined) {
      return false;
    }

    return normalizeDotenvValue(rawValue).length > 0;
  }

  return false;
}

const K1_LIVE_ANCHOR_V0: K1CalibrationAnchorV0 = Object.freeze({
  label_source: "authored-incident-oracle-live-refresh",
  calibration_grade: "authored",
  verdict: "up",
  score: 1,
});

const K1_LIVE_CALIBRATION_BAR_V0: K1CalibrationBarV0 = Object.freeze({
  max_mean_error: 0.18,
  max_spread_error_gap: 0.12,
  low_spread_threshold: 0.15,
  max_error_when_low_spread: 0.18,
});

function validateK1LiveModelSet(
  models: readonly OpenRouterK1LiveModelSpecV0[],
): void {
  if (models.length < 2) {
    throw new Error("K1 live recording requires at least two models");
  }
  const families = new Set(models.map((model) => model.family));
  const providers = new Set(models.map((model) => model.provider));
  const sizes = new Set(models.map((model) => model.size_class));
  if (families.size < 2 || providers.size < 2 || sizes.size < 2) {
    throw new Error(
      "K1 live recording requires >=2 model families, >=2 providers, and cross-size models",
    );
  }
  for (const model of models) {
    assertNonEmpty(model.provider, "model.provider");
    assertNonEmpty(model.model, "model.model");
    assertNonEmpty(model.family, "model.family");
    assertFiniteUsd(model.prompt_cost_per_token_usd, "prompt_cost_per_token_usd");
    assertFiniteUsd(
      model.completion_cost_per_token_usd,
      "completion_cost_per_token_usd",
    );
    assertFiniteUsd(model.request_cap_usd, "request_cap_usd");
    if (!Number.isSafeInteger(model.max_output_tokens) || model.max_output_tokens <= 0) {
      throw new Error("K1 live recording max_output_tokens must be a positive safe integer");
    }
  }
}

function buildK1LivePrompt(): string {
  return [
    "Judge this static incident-briefing responsibility against the correctness anchor.",
    "Anchor verdict: up. Anchor score: 1.0.",
    "Current evidence: the incident mitigation is acknowledged, no new source contradicts it, the status page remains green, and no customer-impact update has arrived since the last briefing.",
    "Return JSON with keys: verdict, score, confidence, text.",
    "verdict must be one of up, drifting, down, blocked.",
    "score and confidence must be numbers between 0 and 1.",
    "The text should be one concise sentence explaining the judgment.",
  ].join("\n");
}

function planK1LiveRequestCosts(
  models: readonly OpenRouterK1LiveModelSpecV0[],
  prompt: string,
  accounting: OpenRouterLiveRefreshReadyAccountingV0,
): { total_request_cap_usd: number } {
  let total = 0;
  const promptTokenEstimate = Math.ceil(prompt.length / 4);
  for (const model of models) {
    const estimatedMax = roundUsd(
      promptTokenEstimate * model.prompt_cost_per_token_usd +
        model.max_output_tokens * model.completion_cost_per_token_usd,
    );
    if (estimatedMax > model.request_cap_usd) {
      throw new Error(
        `K1 live recording estimated request cost for ${model.model} exceeds per-call cap`,
      );
    }
    if (model.request_cap_usd > accounting.request_cap_usd) {
      throw new Error(
        `K1 live recording per-model cap for ${model.model} exceeds live refresh request_cap_usd`,
      );
    }
    total += model.request_cap_usd;
  }
  const totalCap = roundUsd(total);
  if (totalCap > accounting.remaining_usd) {
    throw new Error("K1 live recording total request cap would exceed remaining cap");
  }
  return { total_request_cap_usd: totalCap };
}

function readOpenRouterApiKey(
  envPath: string | undefined,
  readEnvFile: OpenRouterLiveRefreshEnvReaderV0 | undefined,
): string {
  const normalizedPath = normalizeEnvPath(envPath);
  const envText = readDotenvText(normalizedPath, readEnvFile);
  for (const line of envText.split(/\r?\n/)) {
    const match = /^(?:export\s+)?OPENROUTER_API_KEY\s*=\s*(.*)$/.exec(
      line.trim(),
    );
    if (match?.[1] === undefined) {
      continue;
    }
    const value = normalizeDotenvValue(match[1]);
    if (value.length > 0) {
      return value;
    }
  }
  throw new Error(
    `live refresh requires ${OPENROUTER_API_KEY_ENV_NAME_V0} in ${normalizedPath}`,
  );
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

function parseOpenRouterChatCompletion(
  body: unknown,
  model: OpenRouterK1LiveModelSpecV0,
  index: number,
): {
  readonly response_id: string;
  readonly finish_reason: string;
  readonly usage: Readonly<Record<string, unknown>>;
  readonly verdict: K1EnsembleVerdictStatusV0;
  readonly score: number;
  readonly confidence: number;
  readonly text: string;
} {
  if (!isRecord(body)) {
    throw new Error(`OpenRouter response for ${model.model} was not an object`);
  }
  const responseId =
    typeof body["id"] === "string" && body["id"].length > 0
      ? body["id"]
      : `response-${index + 1}`;
  const choices = body["choices"];
  if (!Array.isArray(choices) || !isRecord(choices[0])) {
    throw new Error(`OpenRouter response for ${model.model} had no choice`);
  }
  const choice = choices[0];
  const finishReason =
    typeof choice["finish_reason"] === "string" && choice["finish_reason"].length > 0
      ? choice["finish_reason"]
      : "unknown";
  const message = choice["message"];
  const content =
    isRecord(message) && typeof message["content"] === "string"
      ? message["content"]
      : "";
  const parsed = parseK1JudgeJson(content, model.model);
  const usage = isRecord(body["usage"]) ? body["usage"] : {};

  return {
    response_id: responseId,
    finish_reason: finishReason,
    usage,
    ...parsed,
  };
}

function parseK1JudgeJson(
  content: string,
  model: string,
): {
  readonly verdict: K1EnsembleVerdictStatusV0;
  readonly score: number;
  readonly confidence: number;
  readonly text: string;
} {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : (trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`OpenRouter K1 output for ${model} was not JSON`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`OpenRouter K1 output for ${model} was not a JSON object`);
  }
  const verdict = parsed["verdict"];
  const score = parsed["score"];
  const confidence = parsed["confidence"];
  const text = parsed["text"];
  if (
    verdict !== "up" &&
    verdict !== "drifting" &&
    verdict !== "down" &&
    verdict !== "blocked"
  ) {
    throw new Error(`OpenRouter K1 output for ${model} had invalid verdict`);
  }
  if (!isUnitInterval(score)) {
    throw new Error(`OpenRouter K1 output for ${model} had invalid score`);
  }
  if (!isUnitInterval(confidence)) {
    throw new Error(`OpenRouter K1 output for ${model} had invalid confidence`);
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error(`OpenRouter K1 output for ${model} had invalid text`);
  }

  return {
    verdict,
    score,
    confidence,
    text: text.trim(),
  };
}

function usageCostUsd(usage: Readonly<Record<string, unknown>>): number | undefined {
  const direct = usage["cost"];
  if (typeof direct === "number" && Number.isFinite(direct) && direct >= 0) {
    return direct;
  }
  const nested = usage["cost_usd"];
  if (typeof nested === "number" && Number.isFinite(nested) && nested >= 0) {
    return nested;
  }
  return undefined;
}

function estimateUsageCostUsd(
  model: OpenRouterK1LiveModelSpecV0,
  usage: Readonly<Record<string, unknown>>,
): number {
  const promptTokens = readTokenCount(usage, "prompt_tokens");
  const completionTokens = readTokenCount(usage, "completion_tokens");
  return roundLiveSpendUsd(
    promptTokens * model.prompt_cost_per_token_usd +
      completionTokens * model.completion_cost_per_token_usd,
  );
}

function readTokenCount(
  usage: Readonly<Record<string, unknown>>,
  key: string,
): number {
  const value = usage[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function sanitizeOutputId(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function roundLiveSpendUsd(value: number): number {
  return Number(value.toFixed(8));
}

function isUnitInterval(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAccounting(
  accounting: OpenRouterLiveRefreshAccountingV0 | undefined,
): OpenRouterLiveRefreshReadyAccountingV0 {
  if (accounting === undefined) {
    throw new Error("live refresh requires explicit cap and accounting input");
  }
  if (accounting.currency !== "USD") {
    throw new Error("live refresh accounting currency must be USD");
  }
  assertFiniteUsd(accounting.cap_usd, "cap_usd");
  assertFiniteUsd(accounting.spent_usd, "spent_usd");
  assertFiniteUsd(accounting.request_cap_usd, "request_cap_usd");
  if (accounting.cap_usd <= 0) {
    throw new Error("live refresh cap_usd must be greater than zero");
  }
  if (accounting.cap_usd > OPENROUTER_LIVE_REFRESH_STANDING_CAP_USD_V0) {
    throw new Error(
      `live refresh cap_usd must not exceed standing cap ${OPENROUTER_LIVE_REFRESH_STANDING_CAP_USD_V0} USD`,
    );
  }
  if (accounting.spent_usd < 0) {
    throw new Error("live refresh spent_usd must be non-negative");
  }
  if (accounting.request_cap_usd <= 0) {
    throw new Error("live refresh request_cap_usd must be greater than zero");
  }
  if (accounting.spent_usd > accounting.cap_usd) {
    throw new Error("live refresh spent_usd must not exceed cap_usd");
  }

  const remainingUsd = roundUsd(accounting.cap_usd - accounting.spent_usd);
  if (accounting.request_cap_usd > remainingUsd) {
    throw new Error("live refresh request_cap_usd would exceed explicit cap");
  }

  return {
    currency: "USD",
    cap_usd: roundUsd(accounting.cap_usd),
    spent_usd: roundUsd(accounting.spent_usd),
    request_cap_usd: roundUsd(accounting.request_cap_usd),
    remaining_usd: remainingUsd,
    remaining_after_request_usd: roundUsd(remainingUsd - accounting.request_cap_usd),
    account_ref: assertNonEmpty(accounting.account_ref, "account_ref"),
    ledger_ref: assertNonEmpty(accounting.ledger_ref, "ledger_ref"),
    standing_cap_usd: OPENROUTER_LIVE_REFRESH_STANDING_CAP_USD_V0,
  };
}

function validateModel(model: string | undefined): OpenRouterLiveRefreshModelV0 {
  if (model === undefined) {
    return OPENROUTER_LIVE_REFRESH_DEFAULT_MODEL_V0;
  }
  if (model !== OPENROUTER_LIVE_REFRESH_DEFAULT_MODEL_V0) {
    throw new Error(
      `live refresh model must be ${OPENROUTER_LIVE_REFRESH_DEFAULT_MODEL_V0}`,
    );
  }

  return model;
}

function normalizeEnvPath(envPath: string | undefined): string {
  const path = envPath ?? OPENPROSE_DOTENV_PATH_V0;
  if (path.trim().length === 0) {
    throw new Error("live refresh env_path must be non-empty");
  }

  return path;
}

function readDotenvText(
  envPath: string,
  readEnvFile: OpenRouterLiveRefreshEnvReaderV0 | undefined,
): string {
  try {
    return readEnvFile?.(envPath) ?? readFileSync(envPath, "utf8");
  } catch {
    throw new Error(
      `live refresh requires readable ${OPENROUTER_API_KEY_ENV_NAME_V0} source at ${envPath}`,
    );
  }
}

function normalizeDotenvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return value.slice(1, -1).trim();
  }

  return value;
}

function assertFiniteUsd(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`live refresh ${label} must be finite`);
  }
}

function assertNonEmpty(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`live refresh ${label} must be non-empty`);
  }

  return value;
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}
