import type {
  ReceiptRecheckKindV0,
  ReceiptV0,
} from "@openprose/reactor/receipt";
import type {
  ReactorConnectorRequestV0,
  ReactorConnectorResponseV0,
  ReactorIngestResultV0,
  ReactorModelGatewayRequestV0,
  ReactorModelGatewayResponseV0,
} from "@openprose/reactor/sdk";

export const REACTOR_SCENARIO_SCHEMA_V0 =
  "openprose.reactor-cradle.scenario" as const;
export const REACTOR_SCENARIO_VERSION_V0 = 0 as const;

export type ScenarioFieldValueV0 = string | number | boolean;
export type ScenarioFieldsV0 = Readonly<Record<string, ScenarioFieldValueV0>>;

export type ScenarioWorldProfileV0 =
  | "static"
  | "periodic-surprise"
  | "adversarial-silent";

export interface ReactorScenarioV0 {
  readonly schema: typeof REACTOR_SCENARIO_SCHEMA_V0;
  readonly v: typeof REACTOR_SCENARIO_VERSION_V0;
  readonly id: string;
  readonly world: ScenarioWorldConfigV0;
  readonly initial_instant: string;
  readonly cassette: ScenarioCassetteReferenceV0;
  readonly sources: readonly ScenarioSourceV0[];
  readonly script: readonly ScenarioScriptStepV0[];
  readonly expect: ScenarioExpectationsV0;
}

export interface ScenarioWorldConfigV0 {
  readonly profile: ScenarioWorldProfileV0;
  readonly every_events?: number;
}

export interface ScenarioCassetteReferenceV0 {
  readonly path: string;
}

export interface ScenarioSourceV0 {
  readonly id: string;
  readonly kind?: string;
  readonly fixture_ref?: string;
  readonly fields: ScenarioFieldsV0;
}

export type ScenarioStepTimeV0 =
  | {
      readonly at: string;
    }
  | {
      readonly after: string;
    };

interface ScenarioScriptStepBaseV0 {
  readonly time: ScenarioStepTimeV0;
  readonly label?: string;
  readonly fields: ScenarioFieldsV0;
}

export interface ScenarioIngestStepV0 extends ScenarioScriptStepBaseV0 {
  readonly kind: "ingest";
  readonly event: string;
  readonly source_id?: string;
}

export interface ScenarioTickStepV0 extends ScenarioScriptStepBaseV0 {
  readonly kind: "tick";
  readonly recheck_kind?: ReceiptRecheckKindV0;
}

export interface ScenarioReadStepV0 extends ScenarioScriptStepBaseV0 {
  readonly kind: "read";
  readonly source_id: string;
}

export interface ScenarioModelStepV0 extends ScenarioScriptStepBaseV0 {
  readonly kind: "model";
  readonly request_kind: ReactorModelGatewayRequestV0["kind"];
  readonly prompt: string;
}

export type ScenarioScriptStepV0 =
  | ScenarioIngestStepV0
  | ScenarioTickStepV0
  | ScenarioReadStepV0
  | ScenarioModelStepV0;

export interface ScenarioExpectationsV0 {
  readonly relationships: readonly ScenarioExpectedRelationshipV0[];
}

export interface ScenarioExpectedRelationshipV0 {
  readonly relationship: string;
  readonly fields: ScenarioFieldsV0;
}

export interface ScenarioClockAdapterV0 {
  readonly now: () => string;
  readonly advanceMs?: (ms: number) => void;
  readonly set?: (instant: string) => void;
}

export interface ScenarioWorldSurpriseV0 {
  readonly profile: ScenarioWorldProfileV0;
  readonly count: number;
  readonly causes: readonly string[];
}

export interface ScenarioWorldReadResponseV0
  extends ReactorConnectorResponseV0 {
  readonly surprise?: ScenarioWorldSurpriseV0;
}

export interface ScenarioWorldEventInputV0 {
  readonly scenario_id: string;
  readonly profile: ScenarioWorldProfileV0;
  readonly event: string;
  readonly source_id?: string;
  readonly as_of: string;
  readonly fields: ScenarioFieldsV0;
}

export interface ScenarioWorldEventResultV0 {
  readonly surprise?: ScenarioWorldSurpriseV0;
  readonly payload?: unknown;
}

export interface ScenarioWorldAdvanceInputV0 {
  readonly scenario_id: string;
  readonly profile: ScenarioWorldProfileV0;
  readonly as_of: string;
}

export interface ScenarioWorldAdvanceResultV0 {
  readonly surprise?: ScenarioWorldSurpriseV0;
  readonly payload?: unknown;
}

export interface ScenarioWorldAdapterV0 {
  readonly read: (
    request: ReactorConnectorRequestV0,
  ) => ScenarioWorldReadResponseV0;
  readonly applyEvent?: (
    event: ScenarioWorldEventInputV0,
  ) => ScenarioWorldEventResultV0;
  readonly advanceTo?: (
    input: ScenarioWorldAdvanceInputV0,
  ) => ScenarioWorldAdvanceResultV0;
}

export interface ScenarioRunnerStorageV0 {
  readonly listReceipts: () => readonly ReceiptV0[];
}

export interface ScenarioRunnerReactorV0 {
  readonly ingest: (event: unknown) => ReactorIngestResultV0;
  readonly receipts: () => readonly ReceiptV0[];
}

export interface ScenarioRunTraceEntryV0 {
  readonly index: number;
  readonly step: ScenarioScriptStepV0;
  readonly as_of: string;
  readonly world_advance?: ScenarioWorldAdvanceResultV0;
  readonly world_event?: ScenarioWorldEventResultV0;
  readonly world_reads: readonly ScenarioWorldObservationV0[];
  readonly model_request?: ReactorModelGatewayRequestV0;
  readonly model_response?: ReactorModelGatewayResponseV0;
  readonly reactor_ingest?: ReactorIngestResultV0;
  readonly reactor_ingests?: readonly ReactorIngestResultV0[];
}

export interface ScenarioWorldObservationV0 {
  readonly source_id: string;
  readonly as_of: string;
  readonly payload: unknown;
  readonly surprise?: ScenarioWorldSurpriseV0;
}

export interface ScenarioReceiptLogV0 {
  readonly entries: readonly ReceiptV0[];
  readonly content_hashes: readonly string[];
}

export interface ScenarioRunReceiptV0 {
  readonly scenario_id: string;
  readonly schema: typeof REACTOR_SCENARIO_SCHEMA_V0;
  readonly v: typeof REACTOR_SCENARIO_VERSION_V0;
  readonly world_profile: ScenarioWorldProfileV0;
  readonly cassette_path: string;
  readonly initial_instant: string;
  readonly final_instant: string;
  readonly trace: readonly ScenarioRunTraceEntryV0[];
  readonly receipt_log: ScenarioReceiptLogV0;
  readonly expected_relationships: readonly ScenarioExpectedRelationshipV0[];
}
