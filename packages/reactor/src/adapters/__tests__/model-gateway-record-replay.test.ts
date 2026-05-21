import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import type {
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayUsageV0,
} from "../../sdk";
import { createRecordReplayModelGatewayAdapterV0 } from "../model-gateway-record-replay";

test("record-replay gateway returns adapter-owned usage outside payload", () => {
  const request: ReactorModelGatewayRequestV0 = {
    kind: "judge",
    payload: {
      prompt: "judge release risk",
      model_authored_text_about_tokens: "fresh=999 reused=999",
    },
  };
  const usage: ReactorModelGatewayUsageV0 = {
    provider: "recorded-provider",
    model: "recorded-model",
    tokens: { fresh: 17, reused: 3 },
    provider_norm: {
      schema: "recorded-provider.usage.v0",
      input_tokens: 17,
      cached_tokens: 3,
    },
  };
  const gateway = createRecordReplayModelGatewayAdapterV0({
    records: [
      {
        id: "judge-1",
        request,
        response: {
          payload: {
            status: "up",
            text: "the model payload is not token truth",
          },
          usage,
        },
      },
    ],
  });

  const response = gateway.invoke({
    kind: "judge",
    payload: {
      model_authored_text_about_tokens: "fresh=999 reused=999",
      prompt: "judge release risk",
    },
  });

  deepEqual(response.payload, {
    status: "up",
    text: "the model payload is not token truth",
  });
  deepEqual(response.usage, usage);
  equal(Object.hasOwn(response.payload as Record<string, unknown>, "usage"), false);
  equal(gateway.remaining(), 0);
  deepEqual(gateway.calls(), [
    {
      record_id: "judge-1",
      request,
      usage,
    },
  ]);
});
