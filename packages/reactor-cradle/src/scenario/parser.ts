import {
  REACTOR_SCENARIO_SCHEMA_V0,
  REACTOR_SCENARIO_VERSION_V0,
  type ReactorScenarioV0,
  type ScenarioExpectedRelationshipV0,
  type ScenarioFieldValueV0,
  type ScenarioFieldsV0,
  type ScenarioWorldConfigV0,
  type ScenarioScriptStepV0,
  type ScenarioSourceV0,
  type ScenarioStepTimeV0,
  type ScenarioWorldProfileV0,
} from "./types";
import {
  canonicalScenarioInstant,
  parseScenarioDurationMs,
} from "./time";

export interface ParseScenarioOptionsV0 {
  readonly sourceName?: string;
}

type ScenarioBlockNameV0 = "sources" | "script" | "expect";

interface ScenarioDraftV0 {
  id?: string;
  world?: ScenarioWorldConfigV0;
  initialInstant?: string;
  cassette?: string;
  sources: ScenarioSourceV0[];
  script: ScenarioScriptStepV0[];
  relationships: ScenarioExpectedRelationshipV0[];
}

const TOP_LEVEL_KEYS = new Set(["scenario", "world", "initial", "initial_instant", "cassette"]);
const BLOCK_KEYS = new Set<ScenarioBlockNameV0>(["sources", "script", "expect"]);
const WORLD_PROFILES = new Set<ScenarioWorldProfileV0>([
  "static",
  "periodic-surprise",
  "adversarial-silent",
]);
const MODEL_REQUEST_KINDS = new Set(["judge", "policy-compile", "spike"]);

export class ScenarioParseError extends Error {
  constructor(
    readonly sourceName: string,
    readonly line: number,
    message: string,
  ) {
    super(`${sourceName}:${line}: ${message}`);
    this.name = "ScenarioParseError";
  }
}

export function parseScenarioV0(
  text: string,
  options: ParseScenarioOptionsV0 = {},
): ReactorScenarioV0 {
  const sourceName = options.sourceName ?? "<scenario>";
  const draft: ScenarioDraftV0 = {
    sources: [],
    script: [],
    relationships: [],
  };
  let currentBlock: ScenarioBlockNameV0 | undefined;

  for (const [zeroIndex, rawLine] of text.split(/\r?\n/).entries()) {
    const lineNumber = zeroIndex + 1;
    const line = stripComment(rawLine).trim();
    if (line.length === 0) {
      continue;
    }

    if (line.startsWith("-")) {
      if (currentBlock === undefined) {
        throw parseError(sourceName, lineNumber, "list item is not inside a block");
      }
      parseListItem(draft, currentBlock, line.slice(1).trim(), sourceName, lineNumber);
      continue;
    }

    const topLevel = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (topLevel === null) {
      throw parseError(sourceName, lineNumber, "expected a top-level key or list item");
    }

    const key = topLevel[1];
    const value = topLevel[2];
    if (key === undefined || value === undefined) {
      throw parseError(sourceName, lineNumber, "malformed top-level key");
    }

    if (BLOCK_KEYS.has(key as ScenarioBlockNameV0) && value.length === 0) {
      currentBlock = key as ScenarioBlockNameV0;
      continue;
    }

    currentBlock = undefined;
    if (!TOP_LEVEL_KEYS.has(key)) {
      throw parseError(sourceName, lineNumber, `unexpected top-level key ${key}`);
    }
    if (value.length === 0) {
      throw parseError(sourceName, lineNumber, `${key} must have a value`);
    }
    setTopLevel(draft, key, parseInlineScalar(value), sourceName, lineNumber);
  }

  return finalizeScenario(draft, sourceName);
}

function parseListItem(
  draft: ScenarioDraftV0,
  block: ScenarioBlockNameV0,
  text: string,
  sourceName: string,
  lineNumber: number,
): void {
  if (text.length === 0) {
    throw parseError(sourceName, lineNumber, "list item must not be empty");
  }

  const fields = parseFields(text, sourceName, lineNumber);
  switch (block) {
    case "sources":
      draft.sources.push(parseSource(fields, sourceName, lineNumber));
      return;
    case "script":
      draft.script.push(parseScriptStep(fields, sourceName, lineNumber));
      return;
    case "expect":
      draft.relationships.push(parseRelationship(fields, sourceName, lineNumber));
      return;
  }
}

function setTopLevel(
  draft: ScenarioDraftV0,
  key: string,
  value: string,
  sourceName: string,
  lineNumber: number,
): void {
  switch (key) {
    case "scenario":
      draft.id = requireIdentifier(value, "scenario", sourceName, lineNumber);
      return;
    case "world":
      draft.world = parseWorldConfig(value, sourceName, lineNumber);
      return;
    case "initial":
    case "initial_instant":
      draft.initialInstant = canonicalScenarioInstant(value, key);
      return;
    case "cassette":
      draft.cassette = requireNonEmpty(value, "cassette", sourceName, lineNumber);
      return;
    default:
      throw parseError(sourceName, lineNumber, `unexpected top-level key ${key}`);
  }
}

function parseSource(
  fields: Map<string, ScenarioFieldValueV0>,
  sourceName: string,
  lineNumber: number,
): ScenarioSourceV0 {
  const idValue = readStringField(fields, "id") ?? readStringField(fields, "source");
  const id = requireIdentifier(idValue, "source id", sourceName, lineNumber);
  const kind = readStringField(fields, "kind");
  const fixtureRef = readStringField(fields, "fixture");
  const extra = omitFields(fields, ["id", "source", "kind", "fixture"]);

  return {
    id,
    ...(kind === undefined ? {} : { kind }),
    ...(fixtureRef === undefined ? {} : { fixture_ref: fixtureRef }),
    fields: freezeFields(extra),
  };
}

function parseScriptStep(
  fields: Map<string, ScenarioFieldValueV0>,
  sourceName: string,
  lineNumber: number,
): ScenarioScriptStepV0 {
  const time = parseStepTime(fields, sourceName, lineNumber);
  const label = readStringField(fields, "label");

  if (fields.has("ingest")) {
    const event = stringFieldValue(fields.get("ingest"), "ingest", sourceName, lineNumber);
    const sourceId = readStringField(fields, "source");
    const extra = omitFields(fields, ["at", "after", "label", "ingest", "source"]);

    return {
      kind: "ingest",
      time,
      event,
      ...(label === undefined ? {} : { label }),
      ...(sourceId === undefined ? {} : { source_id: sourceId }),
      fields: freezeFields(extra),
    };
  }

  if (fields.has("tick")) {
    const tickValue = fields.get("tick");
    const recheckKind = readTickRecheckKind(tickValue, sourceName, lineNumber);
    const extra = omitFields(fields, ["at", "after", "label", "tick"]);

    return {
      kind: "tick",
      time,
      ...(label === undefined ? {} : { label }),
      ...(recheckKind === undefined ? {} : { recheck_kind: recheckKind }),
      fields: freezeFields(extra),
    };
  }

  if (fields.has("read")) {
    const sourceId = stringFieldValue(fields.get("read"), "read", sourceName, lineNumber);
    const extra = omitFields(fields, ["at", "after", "label", "read"]);

    return {
      kind: "read",
      time,
      source_id: sourceId,
      ...(label === undefined ? {} : { label }),
      fields: freezeFields(extra),
    };
  }

  if (fields.has("model")) {
    const requestKind = stringFieldValue(fields.get("model"), "model", sourceName, lineNumber);
    if (!MODEL_REQUEST_KINDS.has(requestKind)) {
      throw parseError(sourceName, lineNumber, "model must be judge, policy-compile, or spike");
    }

    const prompt = readStringField(fields, "prompt");
    if (prompt === undefined) {
      throw parseError(sourceName, lineNumber, "model step requires prompt");
    }
    const extra = omitFields(fields, ["at", "after", "label", "model", "prompt"]);

    return {
      kind: "model",
      time,
      request_kind: requestKind as "judge" | "policy-compile" | "spike",
      prompt,
      ...(label === undefined ? {} : { label }),
      fields: freezeFields(extra),
    };
  }

  throw parseError(
    sourceName,
    lineNumber,
    "script item must declare ingest, tick, read, or model",
  );
}

function parseStepTime(
  fields: Map<string, ScenarioFieldValueV0>,
  sourceName: string,
  lineNumber: number,
): ScenarioStepTimeV0 {
  const at = readStringField(fields, "at");
  const after = readStringField(fields, "after");

  if (at !== undefined && after !== undefined) {
    throw parseError(sourceName, lineNumber, "script item cannot use both at and after");
  }
  if (at === undefined && after === undefined) {
    throw parseError(sourceName, lineNumber, "script item requires at or after");
  }

  if (at !== undefined) {
    parseScenarioDurationMs(at, "at");
    return { at };
  }

  if (after === undefined) {
    throw parseError(sourceName, lineNumber, "script item requires after");
  }
  parseScenarioDurationMs(after, "after");
  return { after };
}

function readTickRecheckKind(
  value: ScenarioFieldValueV0 | undefined,
  sourceName: string,
  lineNumber: number,
): "evidence-age" | "plan-age" | undefined {
  if (value === undefined || value === true || value === "forecast") {
    return undefined;
  }
  if (value === "evidence-age" || value === "plan-age") {
    return value;
  }
  if (typeof value === "string") {
    throw parseError(
      sourceName,
      lineNumber,
      "tick must be forecast, evidence-age, or plan-age when it carries a value",
    );
  }

  throw parseError(sourceName, lineNumber, "tick value must be a string");
}

function parseRelationship(
  fields: Map<string, ScenarioFieldValueV0>,
  sourceName: string,
  lineNumber: number,
): ScenarioExpectedRelationshipV0 {
  const relationship =
    readStringField(fields, "relationship") ??
    readStringField(fields, "assertion") ??
    readBareRelationship(fields);

  if (relationship === undefined) {
    throw parseError(sourceName, lineNumber, "expect item requires relationship");
  }

  return {
    relationship: requireIdentifier(relationship, "relationship", sourceName, lineNumber),
    fields: freezeFields(omitFields(fields, ["relationship", "assertion", relationship])),
  };
}

function readBareRelationship(
  fields: Map<string, ScenarioFieldValueV0>,
): string | undefined {
  if (fields.size !== 1) {
    return undefined;
  }

  const first = fields.entries().next().value as
    | readonly [string, ScenarioFieldValueV0]
    | undefined;
  if (first === undefined) {
    return undefined;
  }

  const [key, value] = first;
  return value === true ? key : undefined;
}

function finalizeScenario(
  draft: ScenarioDraftV0,
  sourceName: string,
): ReactorScenarioV0 {
  const missing: string[] = [];
  if (draft.id === undefined) {
    missing.push("scenario");
  }
  if (draft.world === undefined) {
    missing.push("world");
  }
  if (draft.initialInstant === undefined) {
    missing.push("initial");
  }
  if (draft.cassette === undefined) {
    missing.push("cassette");
  }
  if (draft.sources.length === 0) {
    missing.push("sources");
  }
  if (draft.script.length === 0) {
    missing.push("script");
  }

  if (missing.length > 0) {
    throw new ScenarioParseError(
      sourceName,
      0,
      `scenario is missing required field(s): ${missing.join(", ")}`,
    );
  }

  return {
    schema: REACTOR_SCENARIO_SCHEMA_V0,
    v: REACTOR_SCENARIO_VERSION_V0,
    id: draft.id,
    world: draft.world,
    initial_instant: draft.initialInstant,
    cassette: { path: draft.cassette },
    sources: Object.freeze([...draft.sources]),
    script: Object.freeze([...draft.script]),
    expect: {
      relationships: Object.freeze([...draft.relationships]),
    },
  } as ReactorScenarioV0;
}

function parseWorldConfig(
  value: string,
  sourceName: string,
  lineNumber: number,
): ScenarioWorldConfigV0 {
  const tokens = tokenize(value, sourceName, lineNumber);
  const profileToken = tokens[0];
  if (profileToken === undefined) {
    throw parseError(sourceName, lineNumber, "world must have a profile");
  }
  if (profileToken.includes("=") || profileToken.includes(":")) {
    throw parseError(
      sourceName,
      lineNumber,
      "world profile must be the first bare value",
    );
  }
  if (!WORLD_PROFILES.has(profileToken as ScenarioWorldProfileV0)) {
    throw parseError(
      sourceName,
      lineNumber,
      "world must be one of static, periodic-surprise, adversarial-silent",
    );
  }

  const fields = parseFields(tokens.slice(1).join(" "), sourceName, lineNumber);
  const everyEvents = fields.get("every_events");
  if (everyEvents !== undefined) {
    if (
      typeof everyEvents !== "number" ||
      !Number.isSafeInteger(everyEvents) ||
      everyEvents <= 0
    ) {
      throw parseError(
        sourceName,
        lineNumber,
        "world every_events must be a positive safe integer",
      );
    }
    if (profileToken !== "periodic-surprise") {
      throw parseError(
        sourceName,
        lineNumber,
        "world every_events only applies to periodic-surprise",
      );
    }
  }

  if (fields.size > (everyEvents === undefined ? 0 : 1)) {
    throw parseError(sourceName, lineNumber, "world has unsupported field(s)");
  }

  return everyEvents === undefined
    ? { profile: profileToken as ScenarioWorldProfileV0 }
    : {
        profile: profileToken as ScenarioWorldProfileV0,
        every_events: everyEvents,
      };
}

function parseFields(
  text: string,
  sourceName: string,
  lineNumber: number,
): Map<string, ScenarioFieldValueV0> {
  const fields = new Map<string, ScenarioFieldValueV0>();
  const tokens = tokenize(text, sourceName, lineNumber);
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined) {
      break;
    }

    const inline = splitInlineKeyValue(token);
    if (inline !== undefined) {
      setField(fields, inline.key, parseFieldValue(inline.value), sourceName, lineNumber);
      index += 1;
      continue;
    }

    if (token.endsWith(":") && token.length > 1) {
      const key = token.slice(0, -1);
      const next = tokens[index + 1];
      if (next === undefined || isKeyToken(next)) {
        setField(fields, key, true, sourceName, lineNumber);
        index += 1;
        continue;
      }
      setField(fields, key, parseFieldValue(next), sourceName, lineNumber);
      index += 2;
      continue;
    }

    setField(fields, token, true, sourceName, lineNumber);
    index += 1;
  }

  return fields;
}

function splitInlineKeyValue(
  token: string,
): { readonly key: string; readonly value: string } | undefined {
  const equalsIndex = token.indexOf("=");
  if (equalsIndex > 0) {
    return {
      key: token.slice(0, equalsIndex),
      value: token.slice(equalsIndex + 1),
    };
  }

  const colonIndex = token.indexOf(":");
  if (colonIndex > 0 && colonIndex < token.length - 1) {
    return {
      key: token.slice(0, colonIndex),
      value: token.slice(colonIndex + 1),
    };
  }

  return undefined;
}

function tokenize(
  text: string,
  sourceName: string,
  lineNumber: number,
): readonly string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | "\"" | undefined;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === undefined) {
      continue;
    }

    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote !== undefined) {
    throw parseError(sourceName, lineNumber, "unterminated quoted value");
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function stripComment(line: string): string {
  let quote: "'" | "\"" | undefined;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === undefined) {
      continue;
    }

    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }
    if (char === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

function isKeyToken(token: string): boolean {
  return token.endsWith(":") || /^[A-Za-z_][A-Za-z0-9_-]*(?:=|:).+$/.test(token);
}

function parseFieldValue(value: string): ScenarioFieldValueV0 {
  const scalar = parseInlineScalar(value);
  if (scalar === "true") {
    return true;
  }
  if (scalar === "false") {
    return false;
  }
  if (/^-?\d+$/.test(scalar)) {
    const parsed = Number(scalar);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  return scalar;
}

function parseInlineScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function setField(
  fields: Map<string, ScenarioFieldValueV0>,
  key: string,
  value: ScenarioFieldValueV0,
  sourceName: string,
  lineNumber: number,
): void {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) {
    throw parseError(sourceName, lineNumber, `invalid field key ${key}`);
  }
  if (fields.has(key)) {
    throw parseError(sourceName, lineNumber, `duplicate field key ${key}`);
  }

  fields.set(key, value);
}

function readStringField(
  fields: Map<string, ScenarioFieldValueV0>,
  key: string,
): string | undefined {
  const value = fields.get(key);
  return typeof value === "string" ? value : undefined;
}

function stringFieldValue(
  value: ScenarioFieldValueV0 | undefined,
  key: string,
  sourceName: string,
  lineNumber: number,
): string {
  if (typeof value !== "string") {
    throw parseError(sourceName, lineNumber, `${key} must be a string value`);
  }

  return requireNonEmpty(value, key, sourceName, lineNumber);
}

function omitFields(
  fields: Map<string, ScenarioFieldValueV0>,
  omitted: readonly string[],
): ScenarioFieldsV0 {
  const omittedKeys = new Set(omitted);
  const result: Record<string, ScenarioFieldValueV0> = {};

  for (const [key, value] of fields.entries()) {
    if (!omittedKeys.has(key)) {
      result[key] = value;
    }
  }

  return result;
}

function freezeFields(fields: ScenarioFieldsV0): ScenarioFieldsV0 {
  return Object.freeze({ ...fields });
}

function requireIdentifier(
  value: string | undefined,
  label: string,
  sourceName: string,
  lineNumber: number,
): string {
  const id = requireNonEmpty(value, label, sourceName, lineNumber);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
    throw parseError(
      sourceName,
      lineNumber,
      `${label} must use letters, numbers, dots, underscores, colons, or dashes`,
    );
  }

  return id;
}

function requireNonEmpty(
  value: string | undefined,
  label: string,
  sourceName: string,
  lineNumber: number,
): string {
  if (value === undefined || value.length === 0) {
    throw parseError(sourceName, lineNumber, `${label} must be non-empty`);
  }

  return value;
}

function parseError(
  sourceName: string,
  lineNumber: number,
  message: string,
): ScenarioParseError {
  return new ScenarioParseError(sourceName, lineNumber, message);
}
