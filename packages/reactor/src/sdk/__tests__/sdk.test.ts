import { deepEqual, equal, match, ok } from "node:assert/strict";
import { test } from "node:test";

import * as sdk from "../index";
import {
  type ReactorAdaptersV0,
  type ReactorModelGatewayUsageV0,
  type ReactorRegistrySnapshotV0,
  type ReactorSdkEventV0,
  createNullSignerAdapterV0,
  createReactor,
} from "../index";
import { createForecastRecheckReceiptV0 } from "../../forecast";
import { createReceiptV0, type ReceiptV0 } from "../../receipt";

const CONTRACT_HASH =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const EVIDENCE_HASH =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const OTHER_HASH =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const POLICY_ARTIFACT_HASH =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

test("createReactor constructs through sdk with all adapters injected", () => {
  const emitted: ReactorSdkEventV0[] = [];
  const receipt = createForecastRecheckReceiptV0({
    responsibility_id: "responsibility.incident-briefing",
    contract_revision: CONTRACT_HASH,
    memo_key: "memo-static",
    evidence_input_ids: [EVIDENCE_HASH],
    as_of: "2026-05-18T12:00:00Z",
    recheck_kind: "plan-age",
  });
  const reactor = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: makeAdapters({ emitted, receipts: [receipt] }),
  });

  deepEqual(reactor.ingest({ kind: "tick" }), {
    accepted: false,
    responsibility_id: "responsibility.incident-briefing",
    as_of: "2026-05-18T12:00:00Z",
    outcome: "failed-before-write",
    errors: ["unsupported reactor ingest kind tick"],
  });
  deepEqual(emitted, [
    {
      type: "ingest",
      responsibility_id: "responsibility.incident-briefing",
      as_of: "2026-05-18T12:00:00Z",
      payload: { kind: "tick" },
    },
  ]);
  deepEqual(reactor.receipts(), [receipt]);
  deepEqual(reactor.registry(), {
    policy_artifact_namespace: "policy.static",
    policy_artifact_revision: "v1",
  });
  const defaultSigner = reactor.adapters.signer;
  deepEqual(defaultSigner, createNullSignerAdapterV0());
});

test("createReactor constructs without a signer adapter as explicit null signer state", () => {
  const reactor = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: omitSigner(makeAdapters()),
  });

  deepEqual(reactor.ingest({ kind: "tick" }), {
    accepted: false,
    responsibility_id: "responsibility.incident-briefing",
    as_of: "2026-05-18T12:00:00Z",
    outcome: "failed-before-write",
    errors: ["unsupported reactor ingest kind tick"],
  });
  deepEqual(reactor.adapters.signer, {
    scheme: "none",
    null_reason: "no-signer-adapter-configured",
  });
});

test("createReactor exposes a bounded scheduler tick surface", () => {
  const receipts: ReceiptV0[] = [];
  const reactor = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: makeAdapters({
      receipts,
      registry: makeRegistry(),
      now: () => {
        throw new Error("tick(as_of) must not consult clock.now");
      },
    }),
  });

  deepEqual(reactor.tick("2026-05-18T12:30:00Z"), {
    accepted: true,
    responsibility_id: "responsibility.incident-briefing",
    as_of: "2026-05-18T12:30:00Z",
    outcome: "no-work",
    receipts_appended: 0,
    receipt_hashes: [],
    next_due_at: "2026-05-19T12:00:00Z",
    due_rechecks: [],
  });
  deepEqual(receipts, []);
});

test("createReactor fails closed when an adapter slot is missing", () => {
  const { modelGateway: _modelGateway, ...adapters } = makeAdapters();

  let threw = false;
  try {
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: adapters as ReactorAdaptersV0,
    });
  } catch (error) {
    threw = true;
    ok(error instanceof Error);
    equal(error.message, "modelGateway.invoke adapter is required");
  }

  equal(threw, true);
});

test("createReactor fails closed when an optional signer pretends v0.1 signing support", () => {
  for (const scenario of [
    {
      name: "non-null scheme with sign function",
      signer: {
        scheme: "detached-test-signer",
        sign: () => "signature",
      },
      expected: /honestly deferred/,
    },
    {
      name: "null scheme with sign function",
      signer: {
        scheme: "none",
        null_reason: "no-signer-adapter-configured",
        sign: () => "signature",
      },
      expected: /honestly deferred/,
    },
    {
      name: "wrong null reason",
      signer: {
        scheme: "none",
        null_reason: "fixture-only",
      },
      expected: /honestly deferred/,
    },
  ]) {
    let threw = false;
    try {
      createReactor({
        responsibility_id: "responsibility.incident-briefing",
        adapters: makeAdapters({ signer: scenario.signer }),
      });
    } catch (error) {
      threw = true;
      ok(error instanceof Error, scenario.name);
      match(error.message, scenario.expected, scenario.name);
    }

    equal(threw, true, scenario.name);
  }
});

test("sdk handle uses injected adapters rather than hidden defaults", () => {
  let nowCalls = 0;
  let registryReads = 0;
  const adapters = makeAdapters({
    now: () => {
      nowCalls += 1;
      return "2026-05-18T15:00:00Z";
    },
    readRegistry: () => {
      registryReads += 1;
      return {
        policy_artifact_namespace: "policy.injected",
        policy_artifact_revision: "v-test",
      };
    },
  });
  const reactor = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters,
  });

  deepEqual(reactor.ingest({ kind: "event" }), {
    accepted: false,
    responsibility_id: "responsibility.incident-briefing",
    as_of: "2026-05-18T15:00:00Z",
    outcome: "failed-before-write",
    errors: ["unsupported reactor ingest kind event"],
  });
  deepEqual(reactor.registry(), {
    policy_artifact_namespace: "policy.injected",
    policy_artifact_revision: "v-test",
  });
  equal(nowCalls, 1);
  equal(registryReads, 2);
});

test("reactor export emits the minimum exit bundle scope", () => {
  const receipt = makeBlockedReceipt();
  const reactor = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: makeAdapters({
      receipts: [receipt],
      readRegistry: () => makeRegistry(),
    }),
  });

  const bundle = exportBundle(reactor);
  const receiptLog = asRecord(bundle["receipt_log"], "bundle.receipt_log");
  const policyArtifact = asRecord(
    bundle["policy_artifact"],
    "bundle.policy_artifact",
  );
  const runtimeRegistry = asRecord(
    bundle["runtime_registry"],
    "bundle.runtime_registry",
  );
  const manifest = asRecord(bundle["manifest"], "bundle.manifest");
  const memoNamespace = asRecord(
    bundle["memo_namespace"],
    "bundle.memo_namespace",
  );

  equal(bundle["contract_revision"], CONTRACT_HASH);
  equal(policyArtifact["identity"], "policy.incident-briefing");
  equal(policyArtifact["revision"], "policy-revision-1");
  equal(policyArtifact["validation_state"], "validated");
  deepEqual(asArray(bundle["dependency_receipt_pins"], "dependency pins"), []);
  equal(bundle["as_of"], "2026-05-18T12:00:00Z");
  equal(runtimeRegistry["contract_revision"], CONTRACT_HASH);
  equal(runtimeRegistry["policy_artifact_identity"], "policy.incident-briefing");
  equal(runtimeRegistry["policy_artifact_namespace"], "policy.static");
  deepEqual(runtimeRegistry["compiled_evidence_plan"], makeCompiledEvidencePlan());
  deepEqual(runtimeRegistry["forecast_schedule"], makeForecastSchedule());

  deepEqual(
    asContentHashArray(receiptLog["member_hashes"], "receipt log member hashes"),
    [receipt.content_hash],
  );
  equal(asContentHash(receiptLog["head"], "receipt log head"), receipt.content_hash);
  deepEqual(asArray(receiptLog["entries"], "receipt log entries"), [receipt]);

  match(asContentHash(manifest["content_hash"], "manifest content hash"), CONTENT_HASH_PATTERN);
  equal(manifest["runtime_registry_content_hash"], runtimeRegistry["content_hash"]);
  equal(manifest["receipt_log_head"], receiptLog["head"]);
  deepEqual(manifest["receipt_member_hashes"], receiptLog["member_hashes"]);
  equal(manifest["as_of"], bundle["as_of"]);
  deepEqual(manifest["memo_namespace"], memoNamespace);

  deepEqual(memoNamespace, {
    policy_artifact_namespace: "policy.static",
    policy_artifact_revision: "policy-revision-1",
  });
  expectOkResult(verifyBundle(bundle), "exit bundle verification");
});

test("reactor export manifest hash is deterministic for identical inputs", () => {
  const receipt = makeBlockedReceipt();
  const first = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [receipt],
        readRegistry: () => makeRegistry(),
      }),
    }),
  );
  const second = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [receipt],
        readRegistry: () => makeRegistry(),
      }),
    }),
  );

  const firstManifest = asRecord(first["manifest"], "first manifest");
  const secondManifest = asRecord(second["manifest"], "second manifest");

  deepEqual(firstManifest, secondManifest);
  equal(firstManifest["content_hash"], secondManifest["content_hash"]);
  expectOkResult(verifyBundle(first), "first bundle verification");
  expectOkResult(verifyBundle(second), "second bundle verification");
});

test("reactor export preserves dependency pins with explicit null-signer set", () => {
  const receipt = makeReceiptWithDependencyPin();
  const bundle = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [receipt],
        readRegistry: () => makeRegistry(),
      }),
    }),
  );

  deepEqual(asArray(bundle["dependency_receipt_pins"], "dependency pins"), [
    {
      upstream_content_hash: OTHER_HASH,
      contract_revision: CONTRACT_HASH,
      acceptable_signer_set: ["none"],
    },
  ]);
  expectOkResult(verifyBundle(bundle), "dependency-pin bundle verification");
});

test("reactor export/import keeps null-signer receipts explicit when no signer is configured", () => {
  const receipt = makeBlockedReceipt();
  const source = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: omitSigner(
      makeAdapters({
        receipts: [receipt],
        readRegistry: () => makeRegistry(),
      }),
    ),
  });

  const bundle = exportBundle(source);
  const receiptLog = asRecord(bundle["receipt_log"], "bundle.receipt_log");
  const exportedEntries = asArray(receiptLog["entries"], "receipt log entries");

  deepEqual(source.adapters.signer, createNullSignerAdapterV0());
  deepEqual(exportedEntries.map((entry) => receiptSig(entry)), [
    createNullSignerAdapterV0(),
  ]);

  const importedReceipts: ReceiptV0[] = [];
  const fresh = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: omitSigner(
      makeAdapters({
        receipts: importedReceipts,
        readRegistry: () => makeRegistry(),
      }),
    ),
  });

  expectOkResult(importBundle(fresh, bundle), "exit bundle import");
  deepEqual(fresh.adapters.signer, createNullSignerAdapterV0());
  deepEqual(fresh.receipts().map((imported) => imported.sig), [
    createNullSignerAdapterV0(),
  ]);
});

test("exit bundle verification fails typed when manifest-covered fields are tampered", () => {
  const receipt = makeBlockedReceipt();
  const bundle = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [receipt],
        readRegistry: () => makeRegistry(),
      }),
    }),
  );

  const receiptLog = asRecord(bundle["receipt_log"], "bundle.receipt_log");
  const runtimeRegistry = asRecord(
    bundle["runtime_registry"],
    "bundle.runtime_registry",
  );
  const forecastSchedule = asRecord(
    runtimeRegistry["forecast_schedule"],
    "bundle.runtime_registry.forecast_schedule",
  );

  for (const scenario of [
    {
      name: "receipt member set",
      bundle: {
        ...bundle,
        receipt_log: {
          ...receiptLog,
          member_hashes: [receipt.content_hash, OTHER_HASH],
        },
      },
      expectedKind: /manifest|receipt[-_ ]?member|receipt[-_ ]?log/,
    },
    {
      name: "receipt log head",
      bundle: {
        ...bundle,
        receipt_log: {
          ...receiptLog,
          head: OTHER_HASH,
        },
      },
      expectedKind: /manifest|receipt[-_ ]?head|receipt[-_ ]?log/,
    },
    {
      name: "as_of baseline",
      bundle: {
        ...bundle,
        as_of: "2026-05-18T12:05:00Z",
      },
      expectedKind: /manifest|as[-_ ]?of|baseline/,
    },
    {
      name: "memo namespace",
      bundle: {
        ...bundle,
        memo_namespace: {
          policy_artifact_namespace: "policy.tampered",
          policy_artifact_revision: "policy-revision-1",
        },
      },
      expectedKind: /manifest|memo[-_ ]?namespace|namespace/,
    },
    {
      name: "runtime registry forecast schedule",
      bundle: {
        ...bundle,
        runtime_registry: {
          ...runtimeRegistry,
          forecast_schedule: {
            ...forecastSchedule,
            next_plan_recheck: "2026-05-26T12:00:00Z",
          },
        },
      },
      expectedKind: /manifest|runtime[-_ ]?registry/,
    },
  ]) {
    expectTypedFailure(
      verifyBundle(scenario.bundle),
      scenario.expectedKind,
      scenario.name,
    );
  }
});

test("exit bundle import fails typed when the fresh SDK namespace differs", () => {
  const receipt = makeBlockedReceipt();
  const bundle = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [receipt],
        readRegistry: () => makeRegistry(),
      }),
    }),
  );
  const importedReceipts: ReceiptV0[] = [];
  const fresh = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: makeAdapters({
      receipts: importedReceipts,
      readRegistry: () => makeRegistry({ namespace: "policy.fresh-different" }),
    }),
  });

  const result = importBundle(fresh, bundle);

  expectTypedFailure(result, /memo[-_ ]?namespace|namespace/, "namespace import");
  deepEqual(fresh.receipts(), []);
});

test("exit bundle import hydrates a fresh registry before appending receipts", () => {
  const receipt = makeBlockedReceipt();
  const bundle = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [receipt],
        registry: makeRegistry(),
      }),
    }),
  );
  const importedReceipts: ReceiptV0[] = [];
  const importOrder: string[] = [];
  const fresh = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: makeAdapters({
      receipts: importedReceipts,
      registry: makeUninitializedRegistry(),
      onAppend: () => {
        importOrder.push("appendReceipt");
      },
      onWriteRegistry: () => {
        importOrder.push("writeRegistry");
      },
    }),
  });

  const result = expectOkResult(importBundle(fresh, bundle), "fresh import");

  equal(result["receipts_appended"], 1);
  deepEqual(importOrder, ["writeRegistry", "appendReceipt"]);
  deepEqual(fresh.receipts(), [receipt]);
  deepEqual(fresh.registry(), makeRegistry());
});

test("exit bundle import fails before append when registry hydration is unavailable", () => {
  const receipt = makeBlockedReceipt();
  const bundle = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [receipt],
        registry: makeRegistry(),
      }),
    }),
  );
  const importedReceipts: ReceiptV0[] = [];
  const fresh = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: makeAdapters({
      receipts: importedReceipts,
      registry: makeUninitializedRegistry(),
      withoutWriteRegistry: true,
    }),
  });

  expectTypedFailure(
    importBundle(fresh, bundle),
    /policy|artifact/,
    "writeRegistry import",
  );
  deepEqual(fresh.receipts(), []);
});

test("exit bundle import fails before append when policy and memo namespace diverge", () => {
  const receipt = makeBlockedReceipt();
  const bundle = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [receipt],
        registry: makeRegistry(),
      }),
    }),
  );
  const policyArtifact = asRecord(
    bundle["policy_artifact"],
    "bundle.policy_artifact",
  );
  const inconsistentBundle = {
    ...bundle,
    policy_artifact: {
      ...policyArtifact,
      namespace: "policy.memo-diverged",
    },
  };
  const importedReceipts: ReceiptV0[] = [];
  const fresh = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: makeAdapters({
      receipts: importedReceipts,
      registry: makeUninitializedRegistry(),
    }),
  });

  expectTypedFailure(
    importBundle(fresh, inconsistentBundle),
    /manifest|memo[-_ ]?namespace|namespace/,
    "inconsistent namespace import",
  );
  deepEqual(fresh.receipts(), []);
});

test("exit bundle import rejects tampered runtime registry before partial append", () => {
  const receipt = makeBlockedReceipt();
  const bundle = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [receipt],
        registry: makeRegistry(),
      }),
    }),
  );
  const runtimeRegistry = asRecord(
    bundle["runtime_registry"],
    "bundle.runtime_registry",
  );
  const compiledEvidencePlan = asRecord(
    runtimeRegistry["compiled_evidence_plan"],
    "bundle.runtime_registry.compiled_evidence_plan",
  );
  const importedReceipts: ReceiptV0[] = [];
  const fresh = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: makeAdapters({
      receipts: importedReceipts,
      registry: makeUninitializedRegistry(),
    }),
  });

  expectTypedFailure(
    importBundle(fresh, {
      ...bundle,
      runtime_registry: {
        ...runtimeRegistry,
        compiled_evidence_plan: {
          ...compiledEvidencePlan,
          plan_revision: "tampered-plan",
        },
      },
    }),
    /manifest|runtime[-_ ]?registry/,
    "tampered runtime registry import",
  );
  deepEqual(fresh.receipts(), []);
  deepEqual(fresh.registry(), makeUninitializedRegistry());
});

test("exit bundle import carries blocked receipt state without silent upgrade", () => {
  const blockedReceipt = makeBlockedReceipt();
  const bundle = exportBundle(
    createReactor({
      responsibility_id: "responsibility.incident-briefing",
      adapters: makeAdapters({
        receipts: [blockedReceipt],
        readRegistry: () => makeRegistry(),
      }),
    }),
  );
  const importedReceipts: ReceiptV0[] = [];
  const fresh = createReactor({
    responsibility_id: "responsibility.incident-briefing",
    adapters: makeAdapters({
      receipts: importedReceipts,
      readRegistry: () => makeRegistry(),
    }),
  });

  expectOkResult(importBundle(fresh, bundle), "exit bundle import");

  const importedBlockedReceipt = fresh
    .receipts()
    .find((receipt) => receipt.content_hash === blockedReceipt.content_hash);

  ok(importedBlockedReceipt, "blocked receipt remains visible after import");
  equal(importedBlockedReceipt.verdict.status, "blocked");
  deepEqual(importedBlockedReceipt.verdict.blocked, blockedReceipt.verdict.blocked);
});

test("runtime-produced log import round-trips the next deterministic ingest", () => {
  const originalReceipts: ReceiptV0[] = [];
  const importedReceipts: ReceiptV0[] = [];
  let originalNow = "2026-05-18T12:00:00Z";
  let freshNow = "2026-05-18T12:10:00Z";
  const original = createReactor({
    responsibility_id: "responsibility.round-trip",
    adapters: omitSigner(
      makeAdapters({
        receipts: originalReceipts,
        now: () => originalNow,
        registry: makeRuntimeRegistry(),
        modelPayload: makeRuntimeModelPayload(),
        modelUsage: makeRuntimeModelUsage(),
      }),
    ),
  });

  const firstResult = original.ingest(makeRuntimeEvent());

  equal(firstResult.accepted, true);
  equal(firstResult.outcome, "fresh-judge-receipt");
  equal(original.receipts().length, 1);
  deepEqual(original.adapters.signer, createNullSignerAdapterV0());
  deepEqual(original.receipts()[0]?.sig, createNullSignerAdapterV0());

  const bundle = exportBundle(original);
  const fresh = createReactor({
    responsibility_id: "responsibility.round-trip",
    adapters: omitSigner(
      makeAdapters({
        receipts: importedReceipts,
        now: () => freshNow,
        registry: makeUninitializedRegistry(),
        modelPayload: makeRuntimeModelPayload(),
        modelUsage: makeRuntimeModelUsage(),
      }),
    ),
  });

  expectOkResult(importBundle(fresh, bundle), "runtime log import");
  deepEqual(fresh.adapters.signer, createNullSignerAdapterV0());
  deepEqual(fresh.receipts(), original.receipts());
  deepEqual(fresh.receipts()[0]?.sig, createNullSignerAdapterV0());

  originalNow = freshNow;
  const originalNext = original.ingest(makeRuntimeEvent());
  const freshNext = fresh.ingest(makeRuntimeEvent());

  equal(originalNext.accepted, true);
  equal(freshNext.accepted, true);
  equal(originalNext.outcome, "memo-hit-receipt");
  equal(freshNext.outcome, "memo-hit-receipt");
  equal(freshNext.receipt_hash, originalNext.receipt_hash);
  deepEqual(fresh.receipts().at(-1), original.receipts().at(-1));
});

function makeAdapters(
  overrides: {
    readonly emitted?: ReactorSdkEventV0[];
    readonly receipts?: ReceiptV0[];
    readonly now?: () => string;
    readonly registry?: ReactorRegistrySnapshotV0;
    readonly readRegistry?: ReactorAdaptersV0["storage"]["readRegistry"];
    readonly onAppend?: () => void;
    readonly onWriteRegistry?: (registry: ReactorRegistrySnapshotV0) => void;
    readonly withoutWriteRegistry?: boolean;
    readonly signer?: unknown;
    readonly modelPayload?: unknown;
    readonly modelUsage?: ReactorModelGatewayUsageV0;
  } = {},
): ReactorAdaptersV0 {
  const emitted = overrides.emitted ?? [];
  const receipts = overrides.receipts ?? [];
  let registry =
    overrides.registry ??
    ({
      policy_artifact_namespace: "policy.static",
      policy_artifact_revision: "v1",
    } satisfies ReactorRegistrySnapshotV0);
  const signer = Object.hasOwn(overrides, "signer")
    ? overrides.signer
    : createNullSignerAdapterV0();

  return {
    clock: {
      now: overrides.now ?? (() => "2026-05-18T12:00:00Z"),
    },
    storage: {
      appendReceipt: (receipt) => {
        overrides.onAppend?.();
        receipts.push(receipt);
      },
      listReceipts: () => receipts,
      readRegistry: overrides.readRegistry ?? (() => registry),
      ...(overrides.withoutWriteRegistry
        ? {}
        : {
            writeRegistry: (nextRegistry: ReactorRegistrySnapshotV0) => {
              registry = nextRegistry;
              overrides.onWriteRegistry?.(nextRegistry);
            },
          }),
    },
    modelGateway: {
      invoke: (request) => ({
        payload: overrides.modelPayload ?? request.payload,
        ...(overrides.modelUsage === undefined
          ? {}
          : { usage: overrides.modelUsage }),
      }),
    },
    agentSdk: {
      launch: (request) => ({ payload: request.payload }),
    },
    sandbox: {
      run: () => ({ exit_code: 0, stdout: "", stderr: "" }),
    },
    signer,
    connectors: {
      read: (request) => ({ payload: request }),
    },
    eventSink: {
      emit: (event) => {
        emitted.push(event);
      },
    },
  } as ReactorAdaptersV0;
}

function makeUninitializedRegistry(): ReactorRegistrySnapshotV0 {
  return {
    policy_artifact_namespace: "policy.uninitialized",
    policy_artifact_revision: "0",
  };
}

interface PolicyRegistryFixture extends ReactorRegistrySnapshotV0 {
  readonly contract_revision: typeof CONTRACT_HASH;
  readonly policy_artifact_id: string;
  readonly policy_artifact_identity: string;
  readonly policy_artifact_validation_state: "validated";
  readonly validation_state: "validated";
  readonly policy_artifact_content_hash: typeof POLICY_ARTIFACT_HASH;
  readonly compiled_evidence_plan: Record<string, unknown>;
  readonly forecast_schedule: Record<string, unknown>;
}

function makeRegistry(
  overrides: {
    readonly namespace?: string;
    readonly revision?: string;
  } = {},
): PolicyRegistryFixture {
  const namespace = overrides.namespace ?? "policy.static";
  const revision = overrides.revision ?? "policy-revision-1";

  return {
    contract_revision: CONTRACT_HASH,
    policy_artifact_id: "policy.incident-briefing.registry-row",
    policy_artifact_identity: "policy.incident-briefing",
    policy_artifact_namespace: namespace,
    policy_artifact_revision: revision,
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_content_hash: POLICY_ARTIFACT_HASH,
    compiled_evidence_plan: makeCompiledEvidencePlan({
      namespace,
      revision,
    }),
    forecast_schedule: makeForecastSchedule(),
  };
}

function makeCompiledEvidencePlan(
  overrides: {
    readonly responsibility_id?: string;
    readonly namespace?: string;
    readonly revision?: string;
    readonly plan_revision?: string;
    readonly as_of?: string;
  } = {},
): Record<string, unknown> {
  return {
    responsibility_id:
      overrides.responsibility_id ?? "responsibility.incident-briefing",
    contract_revision: CONTRACT_HASH,
    policy_artifact_namespace: overrides.namespace ?? "policy.static",
    policy_artifact_revision: overrides.revision ?? "policy-revision-1",
    plan_revision: overrides.plan_revision ?? "compiled-plan-1",
    as_of: overrides.as_of ?? "2026-05-18T12:00:00Z",
    evidence_order: "unordered",
    sources: [
      {
        id: "incident-briefing-state",
        kind: "adapter",
        required: true,
      },
    ],
  };
}

function makeForecastSchedule(
  overrides: {
    readonly responsibility_id?: string;
    readonly memo_key?: string;
    readonly next_evidence_recheck?: string;
    readonly next_plan_recheck?: string;
  } = {},
): Record<string, unknown> {
  return {
    responsibility_id:
      overrides.responsibility_id ?? "responsibility.incident-briefing",
    contract_revision: CONTRACT_HASH,
    memo_key: overrides.memo_key ?? "incident-briefing-registry-seed",
    evidence_input_ids: [EVIDENCE_HASH],
    next_evidence_recheck:
      overrides.next_evidence_recheck ?? "2026-05-19T12:00:00Z",
    next_plan_recheck:
      overrides.next_plan_recheck ?? "2026-05-25T12:00:00Z",
  };
}

function makeRuntimeRegistry(): ReactorRegistrySnapshotV0 {
  return {
    contract_revision: CONTRACT_HASH,
    policy_artifact_id: "policy.round-trip.registry-row",
    policy_artifact_identity: "policy.round-trip",
    policy_artifact_namespace: "policy.round-trip",
    policy_artifact_revision: "policy-revision-1",
    policy_artifact_validation_state: "validated",
    validation_state: "validated",
    policy_artifact_content_hash: POLICY_ARTIFACT_HASH,
    compiled_evidence_plan: makeCompiledEvidencePlan({
      responsibility_id: "responsibility.round-trip",
      namespace: "policy.round-trip",
      revision: "policy-revision-1",
      plan_revision: "round-trip-compiled-plan-1",
    }),
    forecast_schedule: makeForecastSchedule({
      responsibility_id: "responsibility.round-trip",
      memo_key: "round-trip-registry-seed",
      next_plan_recheck: "2026-05-19T12:00:00Z",
    }),
  };
}

function makeRuntimeEvent(): unknown {
  return {
    kind: "real-input",
    evidence: [
      {
        source_id: "incident-briefing-state",
        content_hash: EVIDENCE_HASH,
      },
    ],
  };
}

function makeRuntimeModelPayload(): unknown {
  return {
    status: "up",
    confidence: {
      value: 0.76,
      derivation_method: "fixture-shallow-judge",
      calibration_grade: "authored",
      label_source: "fixture-claims-anchor",
    },
    cost_tags: {
      tags: ["bootstrap"],
    },
  };
}

function makeRuntimeModelUsage(): ReactorModelGatewayUsageV0 {
  return {
    provider: "record-replay",
    model: "shallow-test-model",
    tokens: {
      fresh: 17,
      reused: 3,
    },
  };
}

function makeBlockedReceipt(): ReceiptV0 {
  return createForecastRecheckReceiptV0({
    responsibility_id: "responsibility.incident-briefing",
    contract_revision: CONTRACT_HASH,
    memo_key: "memo-static",
    evidence_input_ids: [EVIDENCE_HASH],
    as_of: "2026-05-18T12:00:00Z",
    recheck_kind: "plan-age",
  });
}

function makeReceiptWithDependencyPin(): ReceiptV0 {
  const receipt = makeBlockedReceipt();

  return createReceiptV0({
    core: receipt.core,
    sig: receipt.sig,
    verdict: receipt.verdict,
    freshness: {
      ...receipt.freshness,
      transitive_freshness_policy_ref:
        "policy.sdk-test.transitive-freshness@v0",
      consumed_freshness_evaluated: [
        {
          receipt_hash: OTHER_HASH,
          next_forecast_recheck: receipt.freshness.next_forecast_recheck,
          staleness_outcome: "fresh",
        },
      ],
    },
    composition: {
      consumed_receipts: [
        {
          upstream_content_hash: OTHER_HASH,
          contract_revision: CONTRACT_HASH,
          acceptable_signer_set: ["none"],
        },
      ],
      cycle_checked: true,
    },
    cost: receipt.cost,
  });
}

function exportBundle(reactor: ReturnType<typeof createReactor>): ExitBundleRecord {
  const handle = reactor as ReturnType<typeof createReactor> & {
    readonly export?: unknown;
  };

  ok(typeof handle.export === "function", "reactor.export must be public SDK surface");

  return asExitBundle(handle.export());
}

function verifyBundle(bundle: unknown): unknown {
  return getSdkFunction("verifyReactorExitBundleV0")(bundle);
}

function importBundle(
  reactor: ReturnType<typeof createReactor>,
  bundle: unknown,
): unknown {
  return getSdkFunction("importReactorExitBundleV0")({
    adapters: reactor.adapters,
    bundle,
  });
}

function omitSigner(adapters: ReactorAdaptersV0): ReactorAdaptersV0 {
  const unsignedAdapters = { ...adapters } as Record<string, unknown>;

  delete unsignedAdapters["signer"];

  return unsignedAdapters as unknown as ReactorAdaptersV0;
}

function receiptSig(value: unknown): unknown {
  const receipt = asRecord(value, "receipt log entry");
  return asRecord(receipt["sig"], "receipt log entry sig");
}

function getSdkFunction(name: string): (input: unknown) => unknown {
  const exported = (sdk as Record<string, unknown>)[name];

  if (typeof exported !== "function") {
    throw new Error(`${name} must be exported by sdk`);
  }

  return exported as (input: unknown) => unknown;
}

interface ExitBundleRecord extends Readonly<Record<string, unknown>> {
  readonly contract_revision: unknown;
  readonly policy_artifact: unknown;
  readonly runtime_registry: unknown;
  readonly receipt_log: unknown;
  readonly dependency_receipt_pins: unknown;
  readonly manifest: unknown;
  readonly as_of: unknown;
  readonly memo_namespace: unknown;
}

function asExitBundle(value: unknown): ExitBundleRecord {
  const bundle = asRecord(value, "exit bundle");

  for (const key of [
    "contract_revision",
    "policy_artifact",
    "runtime_registry",
    "receipt_log",
    "dependency_receipt_pins",
    "manifest",
    "as_of",
    "memo_namespace",
  ] as const) {
    ok(key in bundle, `exit bundle must include ${key}`);
  }

  return bundle as ExitBundleRecord;
}

function expectOkResult(value: unknown, label: string): Readonly<Record<string, unknown>> {
  const result = asRecord(value, label);

  equal(result["ok"], true);

  return result;
}

function expectTypedFailure(value: unknown, expectedKind: RegExp, label: string): void {
  const result = asRecord(value, `${label} result`);

  equal(result["ok"], false);

  const failure = asRecord(
    result["failure"] ?? result["error"] ?? result,
    `${label} typed failure`,
  );
  const kind =
    failure["kind"] ?? failure["code"] ?? failure["type"] ?? failure["reason"];

  ok(typeof kind === "string", `${label} failure must expose a typed kind/code`);
  match(kind, expectedKind);
}

function asRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  return value;
}

function asContentHash(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a content hash string`);
  }

  match(value, CONTENT_HASH_PATTERN);

  return value;
}

function asContentHashArray(value: unknown, label: string): readonly string[] {
  return asArray(value, label).map((item, index) =>
    asContentHash(item, `${label}[${index}]`),
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
