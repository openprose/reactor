import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import type { ModelGatewayCassetteV0 } from "../../../replay/model-gateway";
import { parseScenarioV0 } from "../../../scenario/parser";
import {
  NAIVE_LOOP_VARIANT_NAME_V0,
  measureNaiveLoopBaselineV0,
} from "..";

const FIXTURE_DIR = resolveFixtureDir();
const SCENARIO_FIXTURE = join(FIXTURE_DIR, "c2-static-zero.scenario");
const EVENT_CHANGING_SCENARIO_FIXTURE = join(
  FIXTURE_DIR,
  "c5-periodic-surprise.scenario",
);
const CASSETTE_FIXTURE = join(
  FIXTURE_DIR,
  "c2-static-zero.model-cassette.json",
);

test("measureNaiveLoopBaselineV0 emits the C5-ready static-world summary shape", () => {
  const summary = measureNaiveLoopBaselineV0({
    scenario: readStaticScenarioFixture(),
    cassette: readModelCassetteFixture(),
  });

  equal(summary.schema, "openprose.reactor-cradle.baseline.naive-loop.summary");
  equal(summary.v, 0);
  equal(summary.scenario_id, "incident-briefing-static-zero");
  equal(summary.world_profile, "static");
  equal(summary.variant, NAIVE_LOOP_VARIANT_NAME_V0);
  equal(summary.turn_count, 4);
  equal(summary.model_invocation_count, 4);
  deepEqual(summary.tokens, {
    fresh: 256,
    reused: 0,
  });
  equal(summary.ratio, "256:0");
  deepEqual(summary.per_invocation_tokens, {
    recorded: {
      fresh: 0,
      reused: 64,
    },
    charged: {
      fresh: 64,
      reused: 0,
    },
  });
  deepEqual(
    summary.review_turns.map((turn) => ({
      index: turn.index,
      step_kind: turn.step_kind,
      review_kind: turn.review_kind,
      as_of: turn.as_of,
      recheck_kind: turn.recheck_kind ?? null,
      source_ids: turn.source_ids,
    })),
    [
      {
        index: 1,
        step_kind: "ingest",
        review_kind: "real-input-review",
        as_of: "2026-05-18T12:00:00.000Z",
        recheck_kind: null,
        source_ids: ["incident-feed"],
      },
      {
        index: 2,
        step_kind: "tick",
        review_kind: "scheduled-review",
        as_of: "2026-05-18T12:15:00.000Z",
        recheck_kind: "evidence-age",
        source_ids: ["incident-feed"],
      },
      {
        index: 3,
        step_kind: "tick",
        review_kind: "scheduled-review",
        as_of: "2026-05-18T18:00:00.000Z",
        recheck_kind: "plan-age",
        source_ids: ["incident-feed"],
      },
      {
        index: 4,
        step_kind: "tick",
        review_kind: "scheduled-review",
        as_of: "2026-05-19T12:00:00.000Z",
        recheck_kind: "evidence-age",
        source_ids: ["incident-feed"],
      },
    ],
  );
  ok(
    summary.notes.some((note) =>
      note.includes("no receipts, memo keys, forecast policy"),
    ),
  );
  ok(
    summary.notes.some((note) =>
      note.includes("converted to fresh tokens"),
    ),
  );
  ok(
    summary.notes.some((note) =>
      note.includes("Cradle replay setup"),
    ),
  );
});

test("measureNaiveLoopBaselineV0 covers the event-changing C5 scenario with Reactor usage tokens", () => {
  const summary = measureNaiveLoopBaselineV0({
    scenario: readEventChangingScenarioFixture(),
    cassette: reactorUsageCassette({ fresh: 37, reused: 0 }),
  });

  equal(summary.scenario_id, "incident-briefing-periodic-surprise");
  equal(summary.world_profile, "periodic-surprise");
  equal(summary.variant, NAIVE_LOOP_VARIANT_NAME_V0);
  equal(summary.turn_count, 4);
  equal(summary.model_invocation_count, 4);
  deepEqual(summary.tokens, {
    fresh: 148,
    reused: 0,
  });
  equal(summary.ratio, "148:0");
  deepEqual(summary.per_invocation_tokens, {
    recorded: {
      fresh: 37,
      reused: 0,
    },
    charged: {
      fresh: 37,
      reused: 0,
    },
  });
  deepEqual(
    summary.review_turns.map((turn) => ({
      index: turn.index,
      step_kind: turn.step_kind,
      review_kind: turn.review_kind,
      as_of: turn.as_of,
      recheck_kind: turn.recheck_kind ?? null,
      source_ids: turn.source_ids,
    })),
    [
      {
        index: 0,
        step_kind: "ingest",
        review_kind: "real-input-review",
        as_of: "2026-05-18T12:00:00.000Z",
        recheck_kind: null,
        source_ids: ["incident-feed"],
      },
      {
        index: 1,
        step_kind: "tick",
        review_kind: "scheduled-review",
        as_of: "2026-05-18T12:15:00.000Z",
        recheck_kind: "evidence-age",
        source_ids: ["incident-feed"],
      },
      {
        index: 2,
        step_kind: "ingest",
        review_kind: "real-input-review",
        as_of: "2026-05-18T12:30:00.000Z",
        recheck_kind: null,
        source_ids: ["incident-feed"],
      },
      {
        index: 3,
        step_kind: "tick",
        review_kind: "scheduled-review",
        as_of: "2026-05-18T12:45:00.000Z",
        recheck_kind: "evidence-age",
        source_ids: ["incident-feed"],
      },
    ],
  );
  ok(
    summary.notes.some((note) =>
      note.includes("same cassette usage shape without claiming reuse"),
    ),
  );
});

test("measureNaiveLoopBaselineV0 is deterministic", () => {
  const scenario = readStaticScenarioFixture();
  const cassette = readModelCassetteFixture();

  const first = measureNaiveLoopBaselineV0({ scenario, cassette });
  const second = measureNaiveLoopBaselineV0({ scenario, cassette });

  deepEqual(second, first);
});

test("measureNaiveLoopBaselineV0 never credits reused tokens", () => {
  const summary = measureNaiveLoopBaselineV0({
    scenario: readStaticScenarioFixture(),
    cassette: readModelCassetteFixture(),
  });

  equal(summary.tokens.reused, 0);
  equal(summary.per_invocation_tokens.charged.reused, 0);
  ok(summary.model_invocation_count > 0);
});

test("naive-loop fresh cost scales linearly with scheduled review turns", () => {
  const cassette = readModelCassetteFixture();
  const short = measureNaiveLoopBaselineV0({
    scenario: parseScenarioV0(staticScenarioWithTickCount(1)),
    cassette,
  });
  const longer = measureNaiveLoopBaselineV0({
    scenario: parseScenarioV0(staticScenarioWithTickCount(4)),
    cassette,
  });

  equal(short.turn_count, 2);
  equal(longer.turn_count, 5);
  equal(
    longer.tokens.fresh - short.tokens.fresh,
    (longer.turn_count - short.turn_count) *
      short.per_invocation_tokens.charged.fresh,
  );
  equal(longer.tokens.reused, 0);
  equal(longer.ratio, "320:0");
});

function readStaticScenarioFixture() {
  return parseScenarioV0(readFileSync(SCENARIO_FIXTURE, "utf8"), {
    sourceName: SCENARIO_FIXTURE,
  });
}

function readEventChangingScenarioFixture() {
  return parseScenarioV0(readFileSync(EVENT_CHANGING_SCENARIO_FIXTURE, "utf8"), {
    sourceName: EVENT_CHANGING_SCENARIO_FIXTURE,
  });
}

function readModelCassetteFixture(): ModelGatewayCassetteV0 {
  return JSON.parse(readFileSync(CASSETTE_FIXTURE, "utf8")) as ModelGatewayCassetteV0;
}

function reactorUsageCassette(tokens: {
  readonly fresh: number;
  readonly reused: number;
}): ModelGatewayCassetteV0 {
  return {
    schema: "openprose.reactor.model-gateway-cassette",
    v: 0,
    exchanges: [
      {
        request: {
          kind: "judge",
          payload: {
            prompt: "review-event-changing-world",
          },
        },
        request_canonical:
          '{"kind":"judge","payload":{"prompt":"review-event-changing-world"}}',
        request_hash:
          "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        response: {
          payload: {
            status: "up",
          },
          usage: {
            provider: "cradle-local",
            model: "c5-periodic-surprise-deterministic",
            tokens,
          },
        },
        response_canonical:
          '{"payload":{"status":"up"},"usage":{"model":"c5-periodic-surprise-deterministic","provider":"cradle-local","tokens":{"fresh":37,"reused":0}}}',
        response_hash:
          "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      },
    ],
  } as ModelGatewayCassetteV0;
}

function staticScenarioWithTickCount(tickCount: number): string {
  const ticks = Array.from({ length: tickCount }, (_value, index) => {
    const minute = (index + 1) * 15;

    return `  - at=${minute}m tick=evidence-age`;
  });

  return [
    "scenario: naive-loop-scale",
    "world: static",
    "initial_instant: 2026-05-18T12:00:00.000Z",
    "cassette: ./c2-static-zero.model-cassette.json",
    "sources:",
    "  - id=incident-feed",
    "script:",
    "  - at=0m model=judge prompt=review-static-world",
    "  - at=0m ingest=bootstrap source=incident-feed",
    ...ticks,
  ].join("\n");
}

function resolveFixtureDir(): string {
  const candidates = [
    join(process.cwd(), "src", "__tests__", "fixtures"),
    join(
      process.cwd(),
      "packages",
      "reactor-cradle",
      "src",
      "__tests__",
      "fixtures",
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "c2-static-zero.scenario"))) {
      return candidate;
    }
  }

  throw new Error("could not locate reactor-cradle scenario fixtures");
}
