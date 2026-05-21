import type { ReactorSandboxAdapterV0, ReactorSandboxResponseV0 } from "../../sdk";

export function createNullSandboxAdapterV0(
  response: ReactorSandboxResponseV0 = { exit_code: 0, stdout: "", stderr: "" },
): ReactorSandboxAdapterV0 {
  return {
    run: () => ({ ...response }),
  };
}
