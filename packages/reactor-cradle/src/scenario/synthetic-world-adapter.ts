import type { ReactorConnectorRequestV0 } from "@openprose/reactor/sdk";

import type {
  SyntheticWorldAdvanceInputV0,
  SyntheticWorldAdvanceRecordV0,
  SyntheticWorldConnectorV0,
  SyntheticWorldJsonValueV0,
  SyntheticWorldSurpriseProfileKindV0,
  SyntheticWorldSurpriseReportV0,
} from "../world";
import type {
  ScenarioFieldsV0,
  ScenarioWorldAdapterV0,
  ScenarioWorldAdvanceInputV0,
  ScenarioWorldAdvanceResultV0,
  ScenarioWorldEventInputV0,
  ScenarioWorldEventResultV0,
  ScenarioWorldReadResponseV0,
  ScenarioWorldSurpriseV0,
} from "./types";

export function adaptSyntheticWorldForScenarioV0(
  world: SyntheticWorldConnectorV0,
): ScenarioWorldAdapterV0 {
  return {
    read(request: ReactorConnectorRequestV0): ScenarioWorldReadResponseV0 {
      const response = world.read(request);
      const surprise = readSurpriseFromPayload(response.payload);

      return {
        payload: response.payload,
        ...(surprise === undefined ? {} : { surprise }),
      };
    },
    applyEvent(event: ScenarioWorldEventInputV0): ScenarioWorldEventResultV0 {
      if (event.source_id === undefined) {
        return {
          payload: { event: event.event },
          surprise: zeroScenarioSurprise(event.profile),
        };
      }

      const payload = payloadFromScenarioFields(event.fields);
      const record = advanceWorld(world, {
        kind: "source-event",
        as_of: event.as_of,
        source_id: event.source_id,
        event_id: event.event,
        ...(payload === undefined ? {} : { payload }),
      });

      return {
        payload: record,
        surprise: convertSyntheticSurprise(record.surprise),
      };
    },
    advanceTo(input: ScenarioWorldAdvanceInputV0): ScenarioWorldAdvanceResultV0 {
      const record = advanceWorld(world, {
        kind: "time",
        as_of: input.as_of,
      });

      return {
        payload: record,
        surprise: convertSyntheticSurprise(record.surprise),
      };
    },
  };
}

function advanceWorld(
  world: SyntheticWorldConnectorV0,
  input: SyntheticWorldAdvanceInputV0,
): SyntheticWorldAdvanceRecordV0 {
  return world.advance(input);
}

function payloadFromScenarioFields(
  fields: ScenarioFieldsV0,
): SyntheticWorldJsonValueV0 | undefined {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return undefined;
  }

  const payload: Record<string, SyntheticWorldJsonValueV0> = {};
  for (const [key, value] of entries) {
    payload[key] = value;
  }

  return payload;
}

function readSurpriseFromPayload(
  payload: unknown,
): ScenarioWorldSurpriseV0 | undefined {
  if (!isRecord(payload) || !isRecord(payload["surprise"])) {
    return undefined;
  }

  return convertSyntheticSurprise(
    payload["surprise"] as unknown as SyntheticWorldSurpriseReportV0,
  );
}

function convertSyntheticSurprise(
  report: SyntheticWorldSurpriseReportV0,
): ScenarioWorldSurpriseV0 {
  return {
    profile: report.profile,
    count: report.surprise_count,
    causes: report.surprise_events.map((event) => event.kind),
  };
}

function zeroScenarioSurprise(
  profile: SyntheticWorldSurpriseProfileKindV0,
): ScenarioWorldSurpriseV0 {
  return {
    profile,
    count: 0,
    causes: [],
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
