import type {
  ReactorAgentRequestV0,
  ReactorAgentResponseV0,
  ReactorAgentSdkAdapterV0,
} from "../../sdk";
import { cloneAdapterJsonValueV0 } from "../json";

export type ReactorAgentSdkLaunchHandlerV0 = (
  request: ReactorAgentRequestV0,
) => ReactorAgentResponseV0;

export interface RecordingAgentSdkAdapterV0 extends ReactorAgentSdkAdapterV0 {
  readonly launches: () => readonly ReactorAgentRequestV0[];
}

export function createPassthroughAgentSdkAdapterV0(
  handler: ReactorAgentSdkLaunchHandlerV0 = (request) => ({
    payload: request.payload,
  }),
): RecordingAgentSdkAdapterV0 {
  const launches: ReactorAgentRequestV0[] = [];

  return {
    launch(request: ReactorAgentRequestV0): ReactorAgentResponseV0 {
      const requestCopy = cloneAdapterJsonValueV0(request);
      launches.push(requestCopy);
      return cloneAdapterJsonValueV0(handler(requestCopy));
    },
    launches(): readonly ReactorAgentRequestV0[] {
      return launches.map((launch) => cloneAdapterJsonValueV0(launch));
    },
  };
}

export function createNullAgentSdkAdapterV0(
  payload: unknown = null,
): RecordingAgentSdkAdapterV0 {
  return createPassthroughAgentSdkAdapterV0(() => ({
    payload: cloneAdapterJsonValueV0(payload),
  }));
}
