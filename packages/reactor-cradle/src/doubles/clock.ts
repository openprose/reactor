import type { ReactorClockAdapterV0 } from "@openprose/reactor/sdk";

const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export class VirtualClock implements ReactorClockAdapterV0 {
  #epochMs: number;

  constructor(initialInstant: string) {
    this.#epochMs = parseReplayableInstant(initialInstant, "initialInstant");
  }

  now(): string {
    return new Date(this.#epochMs).toISOString();
  }

  advanceMs(ms: number): void {
    if (!Number.isSafeInteger(ms) || ms < 0) {
      throw new RangeError(
        "advanceMs requires a non-negative safe integer millisecond interval",
      );
    }

    const nextEpochMs = this.#epochMs + ms;
    if (
      !Number.isSafeInteger(nextEpochMs) ||
      !Number.isFinite(new Date(nextEpochMs).getTime())
    ) {
      throw new RangeError("advanceMs would move the clock outside Date range");
    }

    this.#epochMs = nextEpochMs;
  }

  set(instant: string): void {
    this.#epochMs = parseReplayableInstant(instant, "instant");
  }
}

function parseReplayableInstant(instant: string, label: string): number {
  if (!ISO_INSTANT_PATTERN.test(instant)) {
    throw new RangeError(`${label} must be an ISO-8601 UTC instant`);
  }

  const epochMs = Date.parse(instant);
  if (!Number.isFinite(epochMs)) {
    throw new RangeError(`${label} must be a valid ISO-8601 UTC instant`);
  }

  const canonical = new Date(epochMs).toISOString();
  if (instant !== canonical && instant !== canonical.replace(".000Z", "Z")) {
    throw new RangeError(`${label} must be a valid ISO-8601 UTC instant`);
  }

  return epochMs;
}
