import type {
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayUsageV0,
} from "../../sdk";
import { cloneAdapterJsonValueV0, renderAdapterJsonV0 } from "../json";
import {
  assertModelGatewayUsageV0,
  cloneModelGatewayUsageV0,
  type ReactorModelGatewayResponseWithUsageV0,
  type ReactorModelGatewayRuntimeAdapterV0,
} from "../types";

export interface RecordReplayModelGatewayRecordV0 {
  readonly id: string;
  readonly request: ReactorModelGatewayRequestV0;
  readonly response: {
    readonly payload: unknown;
    readonly usage: ReactorModelGatewayUsageV0;
  };
}

export interface RecordReplayModelGatewayCallV0 {
  readonly record_id: string;
  readonly request: ReactorModelGatewayRequestV0;
  readonly usage: ReactorModelGatewayUsageV0;
}

export interface RecordReplayModelGatewayAdapterV0
  extends ReactorModelGatewayRuntimeAdapterV0 {
  readonly calls: () => readonly RecordReplayModelGatewayCallV0[];
  readonly remaining: () => number;
}

export interface RecordReplayModelGatewayInputV0 {
  readonly records: readonly RecordReplayModelGatewayRecordV0[];
}

export function createRecordReplayModelGatewayAdapterV0(
  input: RecordReplayModelGatewayInputV0,
): RecordReplayModelGatewayAdapterV0 {
  const records = input.records.map((record) => normalizeRecord(record));
  const calls: RecordReplayModelGatewayCallV0[] = [];
  let cursor = 0;

  return {
    invoke(request: ReactorModelGatewayRequestV0): ReactorModelGatewayResponseWithUsageV0 {
      const requestCopy = cloneAdapterJsonValueV0(request);
      const record = records[cursor];
      if (record === undefined) {
        throw new Error("record-replay model gateway has no remaining records");
      }

      const expected = renderAdapterJsonV0(record.request);
      const actual = renderAdapterJsonV0(requestCopy);
      if (actual !== expected) {
        throw new Error(
          `record-replay model gateway request mismatch at record ${record.id}`,
        );
      }

      cursor += 1;
      const usage = cloneModelGatewayUsageV0(record.response.usage);
      calls.push({
        record_id: record.id,
        request: requestCopy,
        usage,
      });

      return {
        payload: cloneAdapterJsonValueV0(record.response.payload),
        usage,
      };
    },
    calls(): readonly RecordReplayModelGatewayCallV0[] {
      return calls.map((call) => cloneAdapterJsonValueV0(call));
    },
    remaining(): number {
      return records.length - cursor;
    },
  };
}

function normalizeRecord(
  record: RecordReplayModelGatewayRecordV0,
): RecordReplayModelGatewayRecordV0 {
  if (record.id.length === 0) {
    throw new Error("record-replay model gateway record id must be non-empty");
  }

  assertModelGatewayUsageV0(record.response.usage);

  return {
    id: record.id,
    request: cloneAdapterJsonValueV0(record.request),
    response: {
      payload: cloneAdapterJsonValueV0(record.response.payload),
      usage: cloneModelGatewayUsageV0(record.response.usage),
    },
  };
}
