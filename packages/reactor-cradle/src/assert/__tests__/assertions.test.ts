import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import type {
  ContentHashV0,
  ReceiptEventCauseV0,
  ReceiptRecheckKindV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";

import {
  assertFlatSpendUnderStaticV0,
  assertNoFixedIntervalWorkV0,
  assertStaticSurpriseZeroV0,
  assertSurpriseAttributionCompleteV0,
  evaluateExpectedCradleRelationshipsV0,
} from "../index";
import type {
  ScenarioRunReceiptV0,
  ScenarioRunTraceEntryV0,
  ScenarioWorldProfileV0,
  ScenarioWorldSurpriseV0,
} from "../../scenario/types";

test("static-surprise-zero passes with trace evidence and fails with trace paths", () => {
  const passing = assertStaticSurpriseZeroV0(
    makeRun({
      trace: [
        makeTickTrace(0, "2026-05-18T12:00:00.000Z", {
          world_advance: {
            payload: {},
            surprise: staticSurprise(),
          },
        }),
        makeReadTrace(1, "2026-05-18T12:15:00.000Z", staticSurprise()),
      ],
    }),
  );

  equal(passing.status, "pass");
  equal(passing.ok, true);
  equal(passing.relationship, "static-surprise-zero");
  equal(passing.evidence[0]?.path, "trace");

  const failing = assertStaticSurpriseZeroV0(
    makeRun({
      trace: [
        makeReadTrace(0, "2026-05-18T12:00:00.000Z", {
          profile: "static",
          count: 1,
          causes: ["fixture-change"],
        }),
      ],
    }),
  );

  equal(failing.status, "fail");
  deepEqual(
    failing.evidence.map((item) => item.path),
    [
      "trace[0].world_reads[0].surprise.count",
      "trace[0].world_reads[0].surprise.causes",
    ],
  );
});

test("surprise-attribution-complete checks token-bearing receipts and model payloads", () => {
  const receipt = makeReceipt({
    asOf: "2026-05-18T12:00:00.000Z",
    nextForecastRecheck: "2026-05-18T13:00:00.000Z",
    tokens: { fresh: 0, reused: 7 },
    eventCause: "real-input",
  });
  const passing = assertSurpriseAttributionCompleteV0(
    makeRun({
      receipts: [receipt],
      trace: [
        makeModelTrace(0, "2026-05-18T12:00:00.000Z", {
          tokens: { fresh: 0, reused: 11 },
          surprise_cause: "real-input",
        }),
      ],
    }),
  );

  equal(passing.status, "pass");
  deepEqual(passing.evidence[0]?.observed, {
    token_bearing_payloads: 2,
    token_payloads_seen: 2,
  });

  const failing = assertSurpriseAttributionCompleteV0(
    makeRun({
      trace: [
        makeModelTrace(0, "2026-05-18T12:00:00.000Z", {
          tokens: { fresh: 3, reused: 0 },
        }),
      ],
    }),
  );

  equal(failing.status, "fail");
  equal(
    failing.evidence[0]?.path,
    "trace[0].model_response.payload.surprise_cause",
  );
});

test("flat-spend-under-static is post-bootstrap and permits plan-audit floor", () => {
  const bootstrap = makeReceipt({
    asOf: "2026-05-18T12:00:00.000Z",
    nextForecastRecheck: "2026-05-18T18:00:00.000Z",
    tokens: { fresh: 41, reused: 0 },
    eventCause: "real-input",
  });
  const memoHit = makeReceipt({
    asOf: "2026-05-18T12:15:00.000Z",
    nextForecastRecheck: "2026-05-18T18:00:00.000Z",
    tokens: { fresh: 0, reused: 41 },
    eventCause: "forecast-recheck",
    recheckKind: "evidence-age",
  });
  const planAudit = makeReceipt({
    asOf: "2026-05-18T18:00:00.000Z",
    nextForecastRecheck: "2026-05-19T18:00:00.000Z",
    tokens: { fresh: 5, reused: 0 },
    eventCause: "forecast-recheck",
    recheckKind: "plan-age",
  });

  const passing = assertFlatSpendUnderStaticV0(
    makeRun({ receipts: [bootstrap, memoHit, planAudit] }),
  );

  equal(passing.status, "pass");
  deepEqual(passing.evidence[0]?.observed, {
    token_bearing_payloads: 3,
    bootstrap_receipt_count: 1,
    post_bootstrap_payloads: 2,
    plan_audit_floor_payloads: 1,
  });

  const unexpectedFresh = makeReceipt({
    asOf: "2026-05-18T12:30:00.000Z",
    nextForecastRecheck: "2026-05-18T18:00:00.000Z",
    tokens: { fresh: 2, reused: 0 },
    eventCause: "forecast-recheck",
    recheckKind: "evidence-age",
  });
  const failing = assertFlatSpendUnderStaticV0(
    makeRun({ receipts: [bootstrap, unexpectedFresh] }),
  );

  equal(failing.status, "fail");
  equal(
    failing.evidence[0]?.path,
    "receipt_log.entries[1].cost.tokens.fresh",
  );
});

test("no-fixed-interval-work fails on forecast token work before scheduled checks", () => {
  const scheduled = makeReceipt({
    asOf: "2026-05-18T12:00:00.000Z",
    nextForecastRecheck: "2026-05-18T18:00:00.000Z",
    tokens: { fresh: 0, reused: 13 },
    eventCause: "real-input",
  });
  const premature = makeReceipt({
    asOf: "2026-05-18T12:30:00.000Z",
    nextForecastRecheck: "2026-05-18T18:00:00.000Z",
    tokens: { fresh: 0, reused: 13 },
    eventCause: "forecast-recheck",
    recheckKind: "evidence-age",
  });
  const due = makeReceipt({
    asOf: "2026-05-18T18:00:00.000Z",
    nextForecastRecheck: "2026-05-19T18:00:00.000Z",
    tokens: { fresh: 0, reused: 13 },
    eventCause: "forecast-recheck",
    recheckKind: "evidence-age",
  });

  const passing = assertNoFixedIntervalWorkV0(
    makeRun({
      receipts: [scheduled, due],
      trace: [
        makeTickTrace(0, "2026-05-18T12:00:00.000Z"),
        makeTickTrace(1, "2026-05-18T18:00:00.000Z"),
      ],
    }),
  );
  equal(passing.status, "pass");
  ok(passing.evidence[0]?.path === "trace");

  const failing = assertNoFixedIntervalWorkV0(
    makeRun({
      receipts: [scheduled, premature],
      trace: [
        makeTickTrace(0, "2026-05-18T12:00:00.000Z"),
        makeTickTrace(1, "2026-05-18T12:30:00.000Z"),
      ],
    }),
  );

  equal(failing.status, "fail");
  equal(failing.evidence[0]?.path, "receipt_log.entries[1].cost");
});

test("expected relationship runner maps C2 aliases to C3 assertion families", () => {
  const receipt = makeReceipt({
    asOf: "2026-05-18T12:00:00.000Z",
    nextForecastRecheck: "2026-05-19T12:00:00.000Z",
    tokens: { fresh: 0, reused: 64 },
    eventCause: "forecast-recheck",
    recheckKind: "plan-age",
  });
  const suite = evaluateExpectedCradleRelationshipsV0(
    makeRun({
      receipts: [receipt],
      trace: [
        makeReadTrace(0, "2026-05-18T12:00:00.000Z", staticSurprise()),
        makeModelTrace(1, "2026-05-18T12:00:00.000Z", {
          tokens: { fresh: 0, reused: 64 },
          surprise_cause: "real-input",
        }),
      ],
      expectedRelationships: [
        { relationship: "static-surprise-zero", fields: {} },
        { relationship: "tokens-flat-after-bootstrap", fields: { fresh: 0 } },
        {
          relationship: "every-token-has-surprise-cause",
          fields: { required: true },
        },
      ],
    }),
  );

  equal(suite.status, "pass");
  deepEqual(
    suite.results.map((item) => item.family),
    [
      "static-surprise-zero",
      "flat-spend-under-static",
      "surprise-attribution-complete",
    ],
  );
});

function makeRun(input: {
  readonly receipts?: readonly ReceiptV0[];
  readonly trace?: readonly ScenarioRunTraceEntryV0[];
  readonly expectedRelationships?: ScenarioRunReceiptV0["expected_relationships"];
  readonly worldProfile?: ScenarioWorldProfileV0;
}): ScenarioRunReceiptV0 {
  const receipts = input.receipts ?? [];

  return {
    scenario_id: "assertion-test",
    schema: "openprose.reactor-cradle.scenario",
    v: 0,
    world_profile: input.worldProfile ?? "static",
    cassette_path: "./assertion-test.model-cassette.json",
    initial_instant: "2026-05-18T12:00:00.000Z",
    final_instant: "2026-05-19T12:00:00.000Z",
    trace: input.trace ?? [],
    receipt_log: {
      entries: receipts,
      content_hashes: receipts.map((receipt) => receipt.content_hash),
    },
    expected_relationships: input.expectedRelationships ?? [],
  };
}

function makeTickTrace(
  index: number,
  asOf: string,
  extra: Partial<ScenarioRunTraceEntryV0> = {},
): ScenarioRunTraceEntryV0 {
  return {
    index,
    step: {
      kind: "tick",
      time: { at: "0m" },
      fields: {},
    },
    as_of: asOf,
    world_reads: [],
    ...extra,
  };
}

function makeReadTrace(
  index: number,
  asOf: string,
  surprise: ScenarioWorldSurpriseV0,
): ScenarioRunTraceEntryV0 {
  return {
    index,
    step: {
      kind: "read",
      time: { at: "0m" },
      source_id: "incident-feed",
      fields: {},
    },
    as_of: asOf,
    world_reads: [
      {
        source_id: "incident-feed",
        as_of: asOf,
        payload: { state: "unchanged" },
        surprise,
      },
    ],
  };
}

function makeModelTrace(
  index: number,
  asOf: string,
  payload: unknown,
): ScenarioRunTraceEntryV0 {
  return {
    index,
    step: {
      kind: "model",
      time: { at: "0m" },
      fields: {},
      request_kind: "judge",
      prompt: "review-static-world",
    },
    as_of: asOf,
    world_reads: [],
    model_request: {
      kind: "judge",
      payload: {
        as_of: asOf,
      },
    },
    model_response: {
      payload,
    },
  };
}

function staticSurprise(): ScenarioWorldSurpriseV0 {
  return {
    profile: "static",
    count: 0,
    causes: [],
  };
}

function makeReceipt(input: {
  readonly asOf: string;
  readonly nextForecastRecheck: string;
  readonly tokens: { readonly fresh: number; readonly reused: number };
  readonly eventCause: ReceiptEventCauseV0;
  readonly recheckKind?: ReceiptRecheckKindV0;
}): ReceiptV0 {
  return {
    schema: "openprose.receipt",
    v: 0,
    hash_algorithm: "sha256",
    content_hash: hash("c"),
    core: {
      responsibility_id: "responsibility.assertion-test",
      contract_revision: hash("a"),
      event_cause: input.eventCause,
      ...(input.recheckKind === undefined
        ? {}
        : { recheck_kind: input.recheckKind }),
      memo_key: `memo-${input.asOf}-${input.eventCause}`,
      evidence_input_ids: [hash("b")],
      as_of: input.asOf,
      role: "judge",
    },
    sig: {
      scheme: "none",
      null_reason: "cradle assertion fixture",
    },
    verdict: {
      status: "up",
      confidence: {
        value: 1,
        derivation_method: "fixture",
        calibration_grade: "none",
        label_source: "fixture",
      },
    },
    freshness: {
      as_of: input.asOf,
      next_forecast_recheck: input.nextForecastRecheck,
    },
    composition: {
      consumed_receipts: [],
      cycle_checked: true,
    },
    cost: {
      provider: "fixture",
      model: "deterministic",
      role: "judge",
      tags: ["cradle-assertion"],
      responsibility_id: "responsibility.assertion-test",
      run_id: "assertion-test",
      as_of: input.asOf,
      tokens: input.tokens,
      surprise_cause: input.eventCause,
    },
  } satisfies ReceiptV0;
}

function hash(hex: string): ContentHashV0 {
  return `sha256:${hex.repeat(64)}` as ContentHashV0;
}
