import { deepEqual, equal, ok, rejects, throws } from "node:assert/strict";
import { test } from "node:test";

import {
  OPENPROSE_DOTENV_PATH_V0,
  OPENROUTER_K1_LIVE_RECORDING_MODELS_V0,
  OPENROUTER_K1_LIVE_RECORDING_SCHEMA_V0,
  OPENROUTER_LIVE_REFRESH_DEFAULT_MODEL_V0,
  evaluateK1EnsembleSpreadV0,
  hasOpenRouterApiKeyInDotenvV0,
  prepareOpenRouterLiveRefreshV0,
  recordOpenRouterK1LiveFixtureV0,
  runOpenRouterLiveRefreshV0,
  type OpenRouterLiveRefreshAccountingV0,
} from "../index";
import * as cradlePublicSurface from "../../index";

test("root public surface exports the recorded spike harness", () => {
  equal(typeof cradlePublicSurface.evaluateK1EnsembleSpreadV0, "function");
  equal(typeof cradlePublicSurface.evaluateK2PolicyAuthorFixtureV0, "function");
  equal(typeof cradlePublicSurface.prepareOpenRouterLiveRefreshV0, "function");
  equal(
    cradlePublicSurface.REACTOR_CRADLE_SPIKE_PUBLIC_EXPORTS_V0
      .k1_ensemble_spread,
    "./spikes/k1-ensemble-spread",
  );
  equal(
    cradlePublicSurface.REACTOR_CRADLE_SPIKE_PUBLIC_EXPORTS_V0
      .k2_policy_author,
    "./spikes/k2-policy-author",
  );
});

test("normal path stays disabled without reading env or invoking live refresh", () => {
  let envReads = 0;
  let liveInvocations = 0;
  const result = runOpenRouterLiveRefreshV0(
    {
      readEnvFile: () => {
        envReads += 1;
        throw new Error("normal tests must not read live env");
      },
    },
    () => {
      liveInvocations += 1;
      return "called";
    },
  );

  if (result.status !== "disabled") {
    throw new Error("expected disabled live-refresh guard");
  }

  equal(result.invoked, false);
  equal(result.guard.reason, "live-opt-in-required");
  equal(Object.hasOwn(result.guard, "model"), false);
  equal(envReads, 0);
  equal(liveInvocations, 0);
});

test("explicit live opt-in defaults to the standing cheap model without exposing the key", () => {
  const secret = "fixture-live-refresh-token-never-leak";
  const guard = prepareOpenRouterLiveRefreshV0({
    allow_live: true,
    accounting: makeAccounting(),
    readEnvFile: (path) => {
      equal(path, OPENPROSE_DOTENV_PATH_V0);
      return `# fixture\nexport OPENROUTER_API_KEY="${secret}"\n`;
    },
  });

  if (guard.status !== "ready") {
    throw new Error("expected ready live-refresh guard");
  }

  equal(guard.model, OPENROUTER_LIVE_REFRESH_DEFAULT_MODEL_V0);
  equal(guard.api_key_present, true);
  equal(guard.accounting.remaining_usd, 15);
  equal(guard.accounting.remaining_after_request_usd, 14);
  ok(!JSON.stringify(guard).includes(secret));
  ok(!JSON.stringify(guard).includes("fixture-live-refresh-token"));
});

test("cap and accounting are enforced before the env file is read", () => {
  throws(
    () =>
      prepareOpenRouterLiveRefreshV0({
        allow_live: true,
        readEnvFile: () => {
          throw new Error("env should not be read without accounting");
        },
      }),
    /live refresh requires explicit cap and accounting input/,
  );

  let envReads = 0;
  throws(
    () =>
      prepareOpenRouterLiveRefreshV0({
        allow_live: true,
        accounting: makeAccounting({
          cap_usd: 10,
          spent_usd: 9.5,
          request_cap_usd: 1,
        }),
        readEnvFile: () => {
          envReads += 1;
          return "OPENROUTER_API_KEY=present";
        },
      }),
    /live refresh request_cap_usd would exceed explicit cap/,
  );
  equal(envReads, 0);

  throws(
    () =>
      prepareOpenRouterLiveRefreshV0({
        allow_live: true,
        accounting: makeAccounting({ cap_usd: 201 }),
        readEnvFile: () => "OPENROUTER_API_KEY=present",
      }),
    /live refresh cap_usd must not exceed standing cap 200 USD/,
  );
});

test("non-default live model is rejected before the env file is read", () => {
  let envReads = 0;

  throws(
    () =>
      prepareOpenRouterLiveRefreshV0({
        allow_live: true,
        accounting: makeAccounting(),
        model: "not-approved/model",
        readEnvFile: () => {
          envReads += 1;
          return "OPENROUTER_API_KEY=present";
        },
      }),
    /live refresh model must be google\/gemini-3\.1-flash-lite-preview/,
  );
  equal(envReads, 0);
});

test("env parsing checks only OPENROUTER_API_KEY presence", () => {
  equal(hasOpenRouterApiKeyInDotenvV0("OPENROUTER_API_KEY=\n"), false);
  equal(hasOpenRouterApiKeyInDotenvV0("OPENROUTER_API_KEY='  '\n"), false);
  equal(
    hasOpenRouterApiKeyInDotenvV0("OTHER=value\nOPENROUTER_API_KEY=present\n"),
    true,
  );
});

test("env reader errors are redacted", () => {
  const leakedSecret = "fixture-reader-error-token-never-leak";

  throws(
    () =>
      prepareOpenRouterLiveRefreshV0({
        allow_live: true,
        accounting: makeAccounting(),
        readEnvFile: () => {
          throw new Error(leakedSecret);
        },
      }),
    (error) => {
      ok(error instanceof Error);
      ok(!error.message.includes(leakedSecret));
      ok(!error.message.includes("fixture-reader-error-token"));
      return true;
    },
  );
});

test("K1 live recording builds diverse cassette metadata without leaking the key", async () => {
  const secret = "fixture-k1-live-token-never-leak";
  const seenModels: string[] = [];
  const fakeFetch: typeof fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
    const model = request.model ?? "missing-model";
    const index = seenModels.length;
    seenModels.push(model);
    return new Response(
      JSON.stringify({
        id: `live-response-${index + 1}`,
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                verdict: "up",
                score: [0.94, 0.92, 0.91][index] ?? 0.9,
                confidence: [0.93, 0.91, 0.9][index] ?? 0.89,
                text: `Fixture ${model} agrees the briefing remains current.`,
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 114,
          completion_tokens: 38,
          total_tokens: 152,
          cost: 0.00042 + index / 100000,
        },
      }),
      {
        status: 200,
        headers: { "x-request-id": `request-${index + 1}` },
      },
    );
  };

  const fixture = await recordOpenRouterK1LiveFixtureV0({
    allow_live: true,
    accounting: makeAccounting({ cap_usd: 2, spent_usd: 0, request_cap_usd: 2 }),
    fetch: fakeFetch,
    now: () => new Date("2026-05-20T18:00:00.000Z"),
    readEnvFile: () => `OPENROUTER_API_KEY=${secret}`,
  });

  deepEqual(
    seenModels,
    OPENROUTER_K1_LIVE_RECORDING_MODELS_V0.map((model) => model.model),
  );
  equal(fixture.recording.schema, OPENROUTER_K1_LIVE_RECORDING_SCHEMA_V0);
  equal(fixture.recording.model_count, OPENROUTER_K1_LIVE_RECORDING_MODELS_V0.length);
  equal(fixture.recording.request_count, OPENROUTER_K1_LIVE_RECORDING_MODELS_V0.length);
  ok(fixture.recording.spend_usd > 0);
  ok(fixture.recording.spend_usd < 2);
  ok(fixture.recording.outputs.every((output) => output.request_id.length > 0));
  ok(fixture.recording.outputs.every((output) => output.response_id.length > 0));
  ok(fixture.recording.outputs.every((output) => output.latency_ms >= 0));
  ok(fixture.recording.outputs.every((output) => output.finish_reason === "stop"));
  equal(evaluateK1EnsembleSpreadV0(fixture).ok, true);
  ok(!JSON.stringify(fixture).includes(secret));
});

test("K1 live recording aborts before fetch when the cap cannot cover the model set", async () => {
  let calls = 0;
  await rejects(
    recordOpenRouterK1LiveFixtureV0({
      allow_live: true,
      accounting: makeAccounting({ cap_usd: 0.01, spent_usd: 0, request_cap_usd: 0.01 }),
      fetch: async () => {
        calls += 1;
        return new Response("{}");
      },
      readEnvFile: () => "OPENROUTER_API_KEY=present",
    }),
    /exceeds live refresh request_cap_usd/,
  );
  equal(calls, 0);
});

function makeAccounting(
  overrides: Partial<OpenRouterLiveRefreshAccountingV0> = {},
): OpenRouterLiveRefreshAccountingV0 {
  return {
    currency: "USD",
    cap_usd: 20,
    spent_usd: 5,
    request_cap_usd: 1,
    account_ref: "openrouter-build-spike-account",
    ledger_ref: "wave-spikes-k1-k2-ledger",
    ...overrides,
  };
}
