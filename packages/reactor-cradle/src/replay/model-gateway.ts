import { createHash } from "node:crypto";

import type {
  ReactorModelGatewayAdapterV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
} from "@openprose/reactor/sdk";
import type { ContentHashV0 } from "@openprose/reactor/receipt";

export const MODEL_GATEWAY_CASSETTE_SCHEMA_V0 =
  "openprose.reactor.model-gateway-cassette" as const;
export const MODEL_GATEWAY_CASSETTE_VERSION_V0 = 0 as const;

export interface RecordedModelGatewayExchangeV0 {
  readonly request: ReactorModelGatewayRequestV0;
  readonly request_canonical: string;
  readonly request_hash: ContentHashV0;
  readonly response: ReactorModelGatewayResponseV0;
  readonly response_canonical: string;
  readonly response_hash: ContentHashV0;
}

export interface ModelGatewayCassetteV0 {
  readonly schema: typeof MODEL_GATEWAY_CASSETTE_SCHEMA_V0;
  readonly v: typeof MODEL_GATEWAY_CASSETTE_VERSION_V0;
  readonly exchanges: readonly RecordedModelGatewayExchangeV0[];
}

export type ModelGatewayHandlerV0 = (
  request: ReactorModelGatewayRequestV0,
) => ReactorModelGatewayResponseV0;

export interface RecordingModelGatewayV0 {
  readonly adapter: ReactorModelGatewayAdapterV0;
  readonly cassette: ModelGatewayCassetteV0;
}

interface CanonicalSnapshotV0<T> {
  readonly value: T;
  readonly canonical: string;
  readonly hash: ContentHashV0;
}

export function createRecordingModelGatewayV0(
  handler: ModelGatewayHandlerV0,
): RecordingModelGatewayV0 {
  const exchanges: RecordedModelGatewayExchangeV0[] = [];
  const adapter: ReactorModelGatewayAdapterV0 = {
    invoke(request: ReactorModelGatewayRequestV0): ReactorModelGatewayResponseV0 {
      const requestSnapshot = createCanonicalSnapshot(
        request,
        "model gateway request",
      );
      const response = handler(cloneFromCanonical(requestSnapshot));
      const responseSnapshot = createCanonicalSnapshot(
        response,
        "model gateway response",
      );

      exchanges.push({
        request: requestSnapshot.value,
        request_canonical: requestSnapshot.canonical,
        request_hash: requestSnapshot.hash,
        response: responseSnapshot.value,
        response_canonical: responseSnapshot.canonical,
        response_hash: responseSnapshot.hash,
      });

      return cloneFromCanonical(responseSnapshot);
    },
  };

  return {
    adapter,
    get cassette(): ModelGatewayCassetteV0 {
      return cloneCassette({
        schema: MODEL_GATEWAY_CASSETTE_SCHEMA_V0,
        v: MODEL_GATEWAY_CASSETTE_VERSION_V0,
        exchanges,
      });
    },
  };
}

export function createReplayModelGatewayV0(
  cassette: ModelGatewayCassetteV0,
): ReactorModelGatewayAdapterV0 {
  const replayCassette = cloneCassette(cassette);
  let cursor = 0;

  return {
    invoke(request: ReactorModelGatewayRequestV0): ReactorModelGatewayResponseV0 {
      const expected = replayCassette.exchanges[cursor];
      if (expected === undefined) {
        throw new Error(
          `model gateway replay exhausted at exchange ${cursor}; cassette has ${replayCassette.exchanges.length} exchanges`,
        );
      }

      const actual = createCanonicalSnapshot(request, "model gateway request");
      if (actual.canonical !== expected.request_canonical) {
        throw new Error(
          `unexpected model gateway request at exchange ${cursor}: expected ${expected.request_hash}, received ${actual.hash}`,
        );
      }

      cursor += 1;
      return cloneFromCanonical({
        value: expected.response,
        canonical: expected.response_canonical,
        hash: expected.response_hash,
      });
    },
  };
}

function cloneCassette(cassette: ModelGatewayCassetteV0): ModelGatewayCassetteV0 {
  if (cassette.schema !== MODEL_GATEWAY_CASSETTE_SCHEMA_V0) {
    throw new Error(
      "model gateway cassette schema must be openprose.reactor.model-gateway-cassette",
    );
  }
  if (cassette.v !== MODEL_GATEWAY_CASSETTE_VERSION_V0) {
    throw new Error("model gateway cassette version must be 0");
  }
  if (!Array.isArray(cassette.exchanges)) {
    throw new Error("model gateway cassette exchanges must be an array");
  }

  return {
    schema: MODEL_GATEWAY_CASSETTE_SCHEMA_V0,
    v: MODEL_GATEWAY_CASSETTE_VERSION_V0,
    exchanges: cassette.exchanges.map((exchange, index) =>
      cloneExchange(exchange, index),
    ),
  };
}

function cloneExchange(
  exchange: RecordedModelGatewayExchangeV0,
  index: number,
): RecordedModelGatewayExchangeV0 {
  const request = createCanonicalSnapshot(
    exchange.request,
    `model gateway cassette exchange ${index} request`,
  );
  const response = createCanonicalSnapshot(
    exchange.response,
    `model gateway cassette exchange ${index} response`,
  );

  assertStoredCanonical(
    exchange.request_canonical,
    request.canonical,
    `model gateway cassette exchange ${index} request_canonical`,
  );
  assertStoredHash(
    exchange.request_hash,
    request.hash,
    `model gateway cassette exchange ${index} request_hash`,
  );
  assertStoredCanonical(
    exchange.response_canonical,
    response.canonical,
    `model gateway cassette exchange ${index} response_canonical`,
  );
  assertStoredHash(
    exchange.response_hash,
    response.hash,
    `model gateway cassette exchange ${index} response_hash`,
  );

  return {
    request: request.value,
    request_canonical: request.canonical,
    request_hash: request.hash,
    response: response.value,
    response_canonical: response.canonical,
    response_hash: response.hash,
  };
}

function createCanonicalSnapshot<T>(
  value: T,
  label: string,
): CanonicalSnapshotV0<T> {
  try {
    const canonical = renderCanonical(value);
    return {
      value: JSON.parse(canonical) as T,
      canonical,
      hash: hashCanonical(canonical),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "canonicalization failed";
    throw new Error(`${label} must be canonical JSON: ${message}`);
  }
}

function cloneFromCanonical<T>(snapshot: CanonicalSnapshotV0<T>): T {
  return JSON.parse(snapshot.canonical) as T;
}

function assertStoredCanonical(
  stored: string,
  actual: string,
  label: string,
): void {
  if (stored !== actual) {
    throw new Error(`${label} does not match canonical payload`);
  }
}

function assertStoredHash(
  stored: ContentHashV0,
  actual: ContentHashV0,
  label: string,
): void {
  if (stored !== actual) {
    throw new Error(`${label} does not match canonical payload hash`);
  }
}

function hashCanonical(canonical: string): ContentHashV0 {
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
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

function isPlainRecord(
  value: object,
): value is Readonly<Record<string, unknown>> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
