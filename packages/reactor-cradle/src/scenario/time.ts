const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;

const DURATION_UNIT_MS = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export function canonicalScenarioInstant(
  instant: string,
  label: string,
): string {
  return new Date(parseScenarioInstantMs(instant, label)).toISOString();
}

export function parseScenarioInstantMs(
  instant: string,
  label: string,
): number {
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

export function parseScenarioDurationMs(
  duration: string,
  label: string,
): number {
  const match = DURATION_PATTERN.exec(duration);
  if (match === null) {
    throw new RangeError(`${label} must be a duration like 0m, 15m, 6h, or 1d`);
  }

  const amountText = match[1];
  const unit = match[2] as keyof typeof DURATION_UNIT_MS;
  const amount = Number(amountText);
  const ms = amount * DURATION_UNIT_MS[unit];

  if (!Number.isSafeInteger(ms)) {
    throw new RangeError(`${label} duration is outside safe integer range`);
  }

  return ms;
}
