import type { ReactorClockAdapterV0 } from "../../sdk";

export interface FixedClockAdapterV0 extends ReactorClockAdapterV0 {
  readonly set: (instant: string) => void;
  readonly advanceByMs: (milliseconds: number) => string;
  readonly readings: () => readonly string[];
}

export function createSystemClockAdapterV0(): ReactorClockAdapterV0 {
  return {
    now: () => new Date().toISOString(),
  };
}

export function createFixedClockAdapterV0(initialInstant: string): FixedClockAdapterV0 {
  assertReplayableInstant(initialInstant, "initialInstant");

  let current = initialInstant;
  const emitted: string[] = [];

  return {
    now(): string {
      emitted.push(current);
      return current;
    },
    set(instant: string): void {
      assertReplayableInstant(instant, "instant");
      current = instant;
    },
    advanceByMs(milliseconds: number): string {
      if (!Number.isFinite(milliseconds)) {
        throw new Error("milliseconds must be finite");
      }
      current = new Date(Date.parse(current) + milliseconds).toISOString();
      return current;
    },
    readings(): readonly string[] {
      return [...emitted];
    },
  };
}

function assertReplayableInstant(value: string, name: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${name} must be a replayable instant`);
  }
}
