import type {
  ReactorConnectorAdapterV0,
  ReactorConnectorRequestV0,
  ReactorConnectorResponseV0,
} from "../../sdk";
import { cloneAdapterJsonValueV0 } from "../json";

export interface StaticConnectorSourceV0 {
  readonly source_id: string;
  readonly payload: unknown;
}

export interface StaticConnectorAdapterV0 extends ReactorConnectorAdapterV0 {
  readonly writeSource: (source: StaticConnectorSourceV0) => void;
  readonly reads: () => readonly ReactorConnectorRequestV0[];
}

export function createStaticConnectorAdapterV0(
  sources: readonly StaticConnectorSourceV0[] = [],
): StaticConnectorAdapterV0 {
  const records = new Map<string, unknown>();
  const reads: ReactorConnectorRequestV0[] = [];

  for (const source of sources) {
    writeSource(records, source);
  }

  return {
    read(request: ReactorConnectorRequestV0): ReactorConnectorResponseV0 {
      const requestCopy = cloneAdapterJsonValueV0(request);
      reads.push(requestCopy);
      if (!records.has(request.source_id)) {
        throw new Error(`connector source not found: ${request.source_id}`);
      }

      return {
        payload: cloneAdapterJsonValueV0(records.get(request.source_id)),
      };
    },
    writeSource(source: StaticConnectorSourceV0): void {
      writeSource(records, source);
    },
    reads(): readonly ReactorConnectorRequestV0[] {
      return reads.map((read) => cloneAdapterJsonValueV0(read));
    },
  };
}

function writeSource(
  records: Map<string, unknown>,
  source: StaticConnectorSourceV0,
): void {
  if (source.source_id.length === 0) {
    throw new Error("connector source_id must be non-empty");
  }
  records.set(source.source_id, cloneAdapterJsonValueV0(source.payload));
}
