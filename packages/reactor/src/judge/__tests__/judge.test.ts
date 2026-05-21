import { equal, throws } from "node:assert/strict";
import { test } from "node:test";

import { runShallowJudgeV0 } from "../index";

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

test('depth "ensemble" is declared but not implemented in v0.1', () => {
  let invoked = false;

  throws(
    () =>
      runShallowJudgeV0({
        responsibility_id: "responsibility.runtime-first-receipt",
        contract_revision: CONTRACT_HASH,
        policy_artifact_namespace: "policy.runtime",
        policy_artifact_revision: "1",
        evidence: [
          {
            source_id: "incident-briefing-state",
            content_hash: EVIDENCE_HASH,
          },
        ],
        as_of: "2026-05-18T12:00:00Z",
        event_cause: "real-input",
        depth: "ensemble",
        modelGateway: {
          invoke: () => {
            invoked = true;
            return { payload: {} };
          },
        },
      }),
    /not-implemented-in-v0\.1/,
  );
  equal(invoked, false);
});
