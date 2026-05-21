import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import { createPassthroughAgentSdkAdapterV0, createNullAgentSdkAdapterV0 } from "../agent-sdk-passthrough";
import { createFixedClockAdapterV0 } from "../clock-system";
import { createStaticConnectorAdapterV0 } from "../connector-static";
import { createMemoryEventSinkAdapterV0 } from "../event-sink-memory";
import { createNullSandboxAdapterV0 } from "../sandbox-null";

test("local helper adapters keep deterministic observable state", () => {
  const clock = createFixedClockAdapterV0("2026-05-18T12:00:00Z");
  equal(clock.now(), "2026-05-18T12:00:00Z");
  equal(clock.advanceByMs(60_000), "2026-05-18T12:01:00.000Z");
  equal(clock.now(), "2026-05-18T12:01:00.000Z");
  deepEqual(clock.readings(), [
    "2026-05-18T12:00:00Z",
    "2026-05-18T12:01:00.000Z",
  ]);

  const connector = createStaticConnectorAdapterV0([
    {
      source_id: "source.release-risk",
      payload: { state: "quiet" },
    },
  ]);
  deepEqual(
    connector.read({
      source_id: "source.release-risk",
      as_of: "2026-05-18T12:01:00Z",
    }),
    { payload: { state: "quiet" } },
  );
  deepEqual(connector.reads(), [
    {
      source_id: "source.release-risk",
      as_of: "2026-05-18T12:01:00Z",
    },
  ]);

  const eventSink = createMemoryEventSinkAdapterV0();
  eventSink.emit({
    type: "ingest",
    responsibility_id: "responsibility.adapters",
    as_of: "2026-05-18T12:01:00Z",
    payload: { kind: "real-input" },
  });
  deepEqual(eventSink.events(), [
    {
      type: "ingest",
      responsibility_id: "responsibility.adapters",
      as_of: "2026-05-18T12:01:00Z",
      payload: { kind: "real-input" },
    },
  ]);

  const passthroughAgent = createPassthroughAgentSdkAdapterV0();
  deepEqual(
    passthroughAgent.launch({
      kind: "bounded-activation",
      payload: { step: "echo" },
    }),
    { payload: { step: "echo" } },
  );
  deepEqual(passthroughAgent.launches(), [
    {
      kind: "bounded-activation",
      payload: { step: "echo" },
    },
  ]);

  const nullAgent = createNullAgentSdkAdapterV0();
  deepEqual(
    nullAgent.launch({ kind: "policy-author", payload: { step: "unused" } }),
    { payload: null },
  );

  deepEqual(createNullSandboxAdapterV0().run({ command: "noop", args: [] }), {
    exit_code: 0,
    stdout: "",
    stderr: "",
  });
});
