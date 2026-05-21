import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";

import { parseScenarioV0 } from "../parser";

const FIXTURE_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "src",
  "scenario",
  "__tests__",
  "fixtures",
  "static-flat-spend.scenario",
);

test("parseScenarioV0 parses the minimal static-world fixture shape", () => {
  const scenario = parseScenarioV0(readFileSync(FIXTURE_PATH, "utf8"), {
    sourceName: FIXTURE_PATH,
  });

  equal(scenario.schema, "openprose.reactor-cradle.scenario");
  equal(scenario.v, 0);
  equal(scenario.id, "incident-briefing-flat-spend");
  deepEqual(scenario.world, { profile: "static" });
  equal(scenario.initial_instant, "2026-05-18T12:00:00.000Z");
  deepEqual(scenario.cassette, {
    path: "./cassettes/incident-briefing.replay.json",
  });
  deepEqual(
    scenario.sources.map((source) => ({
      id: source.id,
      kind: source.kind,
      fixture_ref: source.fixture_ref,
    })),
    [
      {
        id: "incident-channel",
        kind: "synthetic",
        fixture_ref: "incident-channel.static",
      },
      {
        id: "status-page",
        kind: "synthetic",
        fixture_ref: "status-page.static",
      },
    ],
  );
  deepEqual(
    scenario.script.map((step) => step.kind),
    ["ingest", "tick", "read", "model", "tick", "read"],
  );

  const ingest = scenario.script[0];
  equal(ingest?.kind, "ingest");
  if (ingest?.kind === "ingest") {
    deepEqual(ingest.time, { at: "0m" });
    equal(ingest.event, "bootstrap");
    equal(ingest.source_id, "incident-channel");
  }

  const model = scenario.script[3];
  equal(model?.kind, "model");
  if (model?.kind === "model") {
    deepEqual(model.time, { at: "6h" });
    equal(model.request_kind, "judge");
    equal(model.prompt, "review-static-world");
  }

  deepEqual(
    scenario.expect.relationships.map((relationship) => relationship.relationship),
    [
      "static-surprise-zero",
      "hands-free-replay",
      "tokens-flat-after-bootstrap",
      "every-token-has-surprise-cause",
    ],
  );
  deepEqual(scenario.expect.relationships[2]?.fields, { fresh: 0 });
  deepEqual(scenario.expect.relationships[3]?.fields, { required: true });
});

test("parseScenarioV0 accepts colon-list fields without treating them as Language syntax", () => {
  const scenario = parseScenarioV0(
    [
      "scenario: colon-style",
      "world: static",
      "initial: 2026-05-18T12:00:00Z",
      "cassette: ./cassettes/colon.replay.json",
      "sources:",
      "  - id: source-a kind: synthetic",
      "script:",
      "  - at: 0m ingest: bootstrap source: source-a",
      "expect:",
      "  - static-surprise-zero",
    ].join("\n"),
  );

  equal(scenario.id, "colon-style");
  deepEqual(scenario.script[0]?.time, { at: "0m" });
  deepEqual(scenario.expect.relationships, [
    {
      relationship: "static-surprise-zero",
      fields: {},
    },
  ]);
});

test("parseScenarioV0 preserves forecast tick recheck kind shorthand", () => {
  const scenario = parseScenarioV0(
    [
      "scenario: forecast-shorthand",
      "world: static",
      "initial: 2026-05-18T12:00:00Z",
      "cassette: ./cassettes/forecast.replay.json",
      "sources:",
      "  - id=source-a",
      "script:",
      "  - at=15m tick=evidence-age",
      "  - at=6h tick=plan-age",
      "  - at=24h tick=forecast",
    ].join("\n"),
  );

  const [evidenceAge, planAge, forecast] = scenario.script;
  equal(evidenceAge?.kind, "tick");
  equal(planAge?.kind, "tick");
  equal(forecast?.kind, "tick");
  if (
    evidenceAge?.kind !== "tick" ||
    planAge?.kind !== "tick" ||
    forecast?.kind !== "tick"
  ) {
    throw new Error("expected tick steps");
  }

  equal(evidenceAge.recheck_kind, "evidence-age");
  equal(planAge.recheck_kind, "plan-age");
  equal(forecast.recheck_kind, undefined);
});

test("parseScenarioV0 preserves bounded periodic world config", () => {
  const scenario = parseScenarioV0(
    [
      "scenario: periodic-event-change",
      "world: periodic-surprise every_events=2",
      "initial: 2026-05-18T12:00:00Z",
      "cassette: ./cassettes/periodic.replay.json",
      "sources:",
      "  - id=incident-feed",
      "script:",
      "  - at=0m ingest=bootstrap source=incident-feed",
    ].join("\n"),
  );

  deepEqual(scenario.world, {
    profile: "periodic-surprise",
    every_events: 2,
  });
});

test("parseScenarioV0 fails closed on OpenProse Language-looking top-level keys", () => {
  throws(
    () =>
      parseScenarioV0(
        [
          "kind: responsibility",
          "scenario: not-language",
          "world: static",
          "initial: 2026-05-18T12:00:00Z",
          "cassette: ./cassettes/not-language.replay.json",
          "sources:",
          "  - id=source-a",
          "script:",
          "  - at=0m tick",
        ].join("\n"),
      ),
    /unexpected top-level key kind/,
  );
});

test("parseScenarioV0 validates required static-run fields", () => {
  throws(
    () =>
      parseScenarioV0(
        [
          "scenario: missing-cassette",
          "world: static",
          "initial: 2026-05-18T12:00:00Z",
          "sources:",
          "  - id=source-a",
          "script:",
          "  - at=0m tick",
        ].join("\n"),
      ),
    /missing required field\(s\): cassette/,
  );

  throws(
    () =>
      parseScenarioV0(
        [
          "scenario: bad-world",
          "world: burst",
          "initial: 2026-05-18T12:00:00Z",
          "cassette: ./cassettes/bad.replay.json",
          "sources:",
          "  - id=source-a",
          "script:",
          "  - at=0m tick",
        ].join("\n"),
      ),
    /world must be one of static/,
  );

  throws(
    () =>
      parseScenarioV0(
        [
          "scenario: bad-world-config",
          "world: periodic-surprise every_events=0",
          "initial: 2026-05-18T12:00:00Z",
          "cassette: ./cassettes/bad.replay.json",
          "sources:",
          "  - id=source-a",
          "script:",
          "  - at=0m tick",
        ].join("\n"),
      ),
    /world every_events must be a positive safe integer/,
  );
});
