import type { ReactorEventSinkAdapterV0, ReactorSdkEventV0 } from "../../sdk";
import { cloneAdapterJsonValueV0 } from "../json";

export interface MemoryEventSinkAdapterV0 extends ReactorEventSinkAdapterV0 {
  readonly events: () => readonly ReactorSdkEventV0[];
  readonly clear: () => void;
}

export interface MemoryEventSinkAdapterInputV0 {
  readonly onEmit?: (event: ReactorSdkEventV0) => void;
}

export function createMemoryEventSinkAdapterV0(
  input: MemoryEventSinkAdapterInputV0 = {},
): MemoryEventSinkAdapterV0 {
  const events: ReactorSdkEventV0[] = [];

  return {
    emit(event: ReactorSdkEventV0): void {
      const eventCopy = cloneAdapterJsonValueV0(event);
      events.push(eventCopy);
      input.onEmit?.(eventCopy);
    },
    events(): readonly ReactorSdkEventV0[] {
      return events.map((event) => cloneAdapterJsonValueV0(event));
    },
    clear(): void {
      events.length = 0;
    },
  };
}
