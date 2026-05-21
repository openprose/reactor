import { createHash } from "node:crypto";
import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";

import type {
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
} from "@openprose/reactor/sdk";
import {
  MODEL_GATEWAY_CASSETTE_SCHEMA_V0,
  MODEL_GATEWAY_CASSETTE_VERSION_V0,
  type ModelGatewayCassetteV0,
  createRecordingModelGatewayV0,
  createReplayModelGatewayV0,
} from "../model-gateway";

const JUDGE_REQUEST_CANONICAL = [
  '{"kind":"judge","payload":{',
  '"calibration":{"a":true,"b":false},',
  '"evidence":["sha256:alpha","sha256:beta"],',
  '"prompt":"review-static-world"}}',
].join("");
const JUDGE_RESPONSE_CANONICAL = [
  '{"payload":{',
  '"echoed_kind":"judge",',
  '"echoed_payload":{"calibration":{"a":true,"b":false},',
  '"evidence":["sha256:alpha","sha256:beta"],',
  '"prompt":"review-static-world"},',
  '"text":"response:review-static-world",',
  '"tokens":{"fresh":0,"reused":37}}}',
].join("");

test("recording stores deterministic canonical exchanges", () => {
  const recording = createRecordingModelGatewayV0(deterministicHandler);
  const request = makeJudgeRequest();

  recording.adapter.invoke(request);
  recording.adapter.invoke(makeJudgeRequest());

  const cassette = recording.cassette;
  equal(cassette.schema, MODEL_GATEWAY_CASSETTE_SCHEMA_V0);
  equal(cassette.v, MODEL_GATEWAY_CASSETTE_VERSION_V0);
  equal(cassette.exchanges.length, 2);
  deepEqual(exchangeAt(cassette, 0), exchangeAt(cassette, 1));

  const exchange = exchangeAt(cassette, 0);
  equal(exchange.request_canonical, JUDGE_REQUEST_CANONICAL);
  equal(exchange.request_hash, hashCanonical(exchange.request_canonical));
  equal(exchange.response_canonical, JUDGE_RESPONSE_CANONICAL);
  equal(exchange.response_hash, hashCanonical(exchange.response_canonical));
});

test("replay returns byte-identical payloads in recorded order", () => {
  const firstRequest = makeJudgeRequest();
  const secondRequest = makePolicyCompileRequest();
  const recording = createRecordingModelGatewayV0(deterministicHandler);
  const firstRecorded = recording.adapter.invoke(firstRequest);
  const secondRecorded = recording.adapter.invoke(secondRequest);
  const cassette = recording.cassette;
  const replay = createReplayModelGatewayV0(cassette);

  const firstReplayed = replay.invoke(makeEquivalentJudgeRequest());
  const secondReplayed = replay.invoke(secondRequest);

  deepEqual(firstReplayed, firstRecorded);
  deepEqual(secondReplayed, secondRecorded);
  equal(
    JSON.stringify(firstReplayed),
    exchangeAt(cassette, 0).response_canonical,
  );
  equal(
    JSON.stringify(secondReplayed),
    exchangeAt(cassette, 1).response_canonical,
  );
});

test("replay fails closed on an unexpected request", () => {
  const request = makeJudgeRequest();
  const recording = createRecordingModelGatewayV0(deterministicHandler);
  const recorded = recording.adapter.invoke(request);
  const replay = createReplayModelGatewayV0(recording.cassette);

  throws(
    () => replay.invoke(makePolicyCompileRequest()),
    /unexpected model gateway request at exchange 0/,
  );
  deepEqual(replay.invoke(request), recorded);
});

test("replay fails closed when the cassette is exhausted", () => {
  const request = makeJudgeRequest();
  const recording = createRecordingModelGatewayV0(deterministicHandler);
  recording.adapter.invoke(request);
  const replay = createReplayModelGatewayV0(recording.cassette);

  replay.invoke(request);

  throws(
    () => replay.invoke(request),
    /model gateway replay exhausted at exchange 1; cassette has 1 exchanges/,
  );
});

test("cassette snapshots are not mutated by callers", () => {
  const request = makeJudgeRequest();
  const recording = createRecordingModelGatewayV0(deterministicHandler);
  recording.adapter.invoke(request);

  const callerSnapshot = recording.cassette;
  setFirstCassetteResponseText(callerSnapshot, "caller-mutated-snapshot");

  equal(
    responseText(exchangeAt(recording.cassette, 0).response),
    "response:review-static-world",
  );

  const replayInput = recording.cassette;
  const replay = createReplayModelGatewayV0(replayInput);
  setFirstCassetteResponseText(replayInput, "caller-mutated-before-replay");

  const replayed = replay.invoke(request);
  equal(responseText(replayed), "response:review-static-world");

  setResponseText(replayed, "caller-mutated-returned-response");
  equal(
    responseText(exchangeAt(recording.cassette, 0).response),
    "response:review-static-world",
  );
});

function deterministicHandler(
  request: ReactorModelGatewayRequestV0,
): ReactorModelGatewayResponseV0 {
  return {
    payload: {
      echoed_kind: request.kind,
      echoed_payload: request.payload,
      text: `response:${promptFromPayload(request.payload)}`,
      tokens: {
        fresh: 0,
        reused: 37,
      },
    },
  };
}

function makeJudgeRequest(): ReactorModelGatewayRequestV0 {
  return {
    kind: "judge",
    payload: {
      prompt: "review-static-world",
      evidence: ["sha256:alpha", "sha256:beta"],
      calibration: {
        a: true,
        b: false,
      },
    },
  };
}

function makeEquivalentJudgeRequest(): ReactorModelGatewayRequestV0 {
  return {
    kind: "judge",
    payload: {
      calibration: {
        b: false,
        a: true,
      },
      evidence: ["sha256:alpha", "sha256:beta"],
      prompt: "review-static-world",
    },
  };
}

function makePolicyCompileRequest(): ReactorModelGatewayRequestV0 {
  return {
    kind: "policy-compile",
    payload: {
      prompt: "compile-static-policy",
      contract_revision: "sha256:contract",
    },
  };
}

function exchangeAt(cassette: ModelGatewayCassetteV0, index: number) {
  const exchange = cassette.exchanges[index];
  if (exchange === undefined) {
    throw new Error(`expected cassette exchange ${index}`);
  }

  return exchange;
}

function promptFromPayload(payload: unknown): string {
  if (!isRecord(payload)) {
    return "unknown";
  }

  const prompt = payload["prompt"];
  if (typeof prompt !== "string") {
    return "unknown";
  }

  return prompt;
}

function responseText(response: ReactorModelGatewayResponseV0): string {
  return (response.payload as { readonly text: string }).text;
}

function setResponseText(
  response: ReactorModelGatewayResponseV0,
  text: string,
): void {
  (response.payload as { text: string }).text = text;
}

function setFirstCassetteResponseText(
  cassette: ModelGatewayCassetteV0,
  text: string,
): void {
  const mutable = cassette as unknown as {
    exchanges: Array<{
      response: {
        payload: {
          text: string;
        };
      };
    }>;
  };
  const first = mutable.exchanges[0];
  if (first === undefined) {
    throw new Error("expected first cassette exchange");
  }

  first.response.payload.text = text;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hashCanonical(canonical: string): string {
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}
