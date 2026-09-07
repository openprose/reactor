import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  asFacet,
  asFingerprint,
  asNodeId,
  ATOMIC_FACET,
  type ContentAddress,
  type TopologyWorldModel,
  type Wake,
} from "../../shapes";
import {
  createReconciler,
  type ReconcilerPorts,
  type ReconcilerTopology,
  type RenderOutcome,
  type RenderRequest,
} from "../index";
import {
  externalWake,
  inputWake,
  mergeWakes,
  selfWake,
} from "../../sdk/wake";
import { createInMemoryWorldModelStore } from "../../world-model";

// --------------------------------------------------------------------------
// 1. mergeWakes unit tests
// --------------------------------------------------------------------------

test("mergeWakes: identity short-circuit", () => {
  const w = inputWake("sha256:1111" as ContentAddress);
  equal(mergeWakes(w, w), w);
});

test("mergeWakes: source precedence is external > input > self", () => {
  const ext = externalWake("sha256:ext" as ContentAddress);
  const inp = inputWake("sha256:inp" as ContentAddress);
  const slf = selfWake("sha256:slf" as ContentAddress);

  equal(mergeWakes(ext, inp).source, "external");
  equal(mergeWakes(inp, ext).source, "external");
  equal(mergeWakes(inp, slf).source, "input");
  equal(mergeWakes(slf, inp).source, "input");
  equal(mergeWakes(slf, slf).source, "self");
});

test("mergeWakes: unions refs, preserves order, and deduplicates", () => {
  const r1 = "sha256:1111" as ContentAddress;
  const r2 = "sha256:2222" as ContentAddress;
  const r3 = "sha256:3333" as ContentAddress;

  const w1 = inputWake(r1, r2);
  const w2 = inputWake(r2, r3);

  const merged = mergeWakes(w1, w2);
  deepEqual(merged.refs, [r1, r2, r3]);
  ok(Object.isFrozen(merged.refs), "refs must be frozen");
  ok(Object.isFrozen(merged), "wake must be frozen");
});

// --------------------------------------------------------------------------
// 2. Multi-producer fan-in in reconciler.drain
// --------------------------------------------------------------------------

test("drain: multi-producer fan-in preserves all upstream receipt refs in downstream wake", () => {
  // Topology: P1 -> S, P2 -> S (fan-in / join)
  const topology: TopologyWorldModel = {
    entry_points: [asNodeId("P1"), asNodeId("P2")],
    nodes: [],
    edges: [
      { producer: asNodeId("P1"), subscriber: asNodeId("S"), facet: asFacet("@atomic") },
      { producer: asNodeId("P2"), subscriber: asNodeId("S"), facet: asFacet("@atomic") },
    ],
    acyclic: true,
  };

  const contractFp = asFingerprint("sha256:" + "c".repeat(64));
  const reconcilerTopology: ReconcilerTopology = {
    topology,
    contract_fingerprints: {
      P1: contractFp,
      P2: contractFp,
      S: contractFp,
    },
  };

  const store = createInMemoryWorldModelStore();
  const receipts: any[] = [];
  const byNode: Record<string, any[]> = {};
  const ledger = {
    append(receipt: any) {
      const hash = `sha256:${receipt.node}-${receipts.length + 1}`;
      const stamped = { ...receipt, content_hash: hash };
      receipts.push(stamped);
      (byNode[receipt.node] ??= []).push(stamped);
      return hash as ContentAddress;
    },
    lastReceipt(node: string) {
      const list = byNode[node];
      return list && list.length > 0 ? list[list.length - 1] : null;
    },
    addressOf(receipt: any) {
      return receipt.content_hash as ContentAddress;
    },
    all() {
      return [...receipts];
    },
  };

  let tick = 0;
  const ports: ReconcilerPorts = {
    ledger,
    worldModel: {
      publishedRef: (node) => store.ref(node),
    },
    resolveInputFingerprints: (node, edges) => {
      return edges.map((e) => {
        const last = ledger.lastReceipt(String(e.producer));
        return last
          ? (last.fingerprints[String(e.facet)] ?? last.fingerprints[ATOMIC_FACET])
          : asFingerprint("cold");
      });
    },
    spawnRender: (req: RenderRequest): RenderOutcome => {
      tick++;
      const token = `token-${req.node}-${tick}`;
      const commit = store.commitPublished(
        req.node,
        { "state.txt": Buffer.from(token) },
        () => ({ [ATOMIC_FACET]: asFingerprint(token) }),
      );
      return {
        status: "rendered",
        commit,
        semantic_diff: {},
        cost: {
          provider: "test",
          model: "test-model",
          tokens: { fresh: 10, reused: 0 },
          surprise_cause: req.wake.source,
        },
      };
    },
  };

  const reconciler = createReconciler(ports, reconcilerTopology);

  // Both P1 and P2 are seeded and move in the same drain
  const results = reconciler.drain([
    { node: "P1", wake: externalWake() },
    { node: "P2", wake: externalWake() },
  ]);

  equal(results.length, 3, "P1, P2, and S should all render");

  const p1Receipt = ledger.lastReceipt("P1");
  const p2Receipt = ledger.lastReceipt("P2");
  const sReceipt = ledger.lastReceipt("S");

  ok(p1Receipt, "P1 must have committed a receipt");
  ok(p2Receipt, "P2 must have committed a receipt");
  ok(sReceipt, "S must have committed a receipt");

  const p1Address = ledger.addressOf(p1Receipt);
  const p2Address = ledger.addressOf(p2Receipt);

  // The critical invariant: S was woken by both P1 and P2, so S's receipt must contain BOTH refs!
  equal(sReceipt.wake.source, "input");
  equal(sReceipt.wake.refs.length, 2, "S receipt must record receipts of both waking producers");
  ok(sReceipt.wake.refs.includes(p1Address), "S wake.refs must include P1 receipt ref");
  ok(sReceipt.wake.refs.includes(p2Address), "S wake.refs must include P2 receipt ref");
});

// --------------------------------------------------------------------------
// 3. Multi-wake coalescing during single-flight in reconcileAsync
// --------------------------------------------------------------------------

test("reconcileAsync: multiple mid-render wakes merge all causal refs into the follow-up render", async () => {
  const store = createInMemoryWorldModelStore();
  const receipts: any[] = [];
  const ledger = {
    append(receipt: any) {
      const hash = `sha256:n-${receipts.length + 1}`;
      const stamped = { ...receipt, content_hash: hash };
      receipts.push(stamped);
      return hash as ContentAddress;
    },
    lastReceipt(_node: string) {
      return receipts.length > 0 ? receipts[receipts.length - 1] : null;
    },
    addressOf(receipt: any) {
      return receipt.content_hash as ContentAddress;
    },
    all() {
      return [...receipts];
    },
  };

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  const gate = deferred<void>();
  let renderCount = 0;
  let currentInputs = [asFingerprint("inp-1")];

  const ports: ReconcilerPorts = {
    ledger,
    worldModel: {
      publishedRef: (node) => store.ref(node),
    },
    resolveInputFingerprints: () => currentInputs,
    spawnRender: () => {
      throw new Error("sync spawn not used");
    },
    spawnRenderAsync: async (req) => {
      renderCount++;
      if (renderCount === 1) {
        await gate.promise;
      }
      const token = `token-${renderCount}`;
      const commit = store.commitPublished(
        req.node,
        { "file.txt": Buffer.from(token) },
        () => ({ [ATOMIC_FACET]: asFingerprint(token) }),
      );
      return {
        status: "rendered",
        commit,
        semantic_diff: {},
        cost: {
          provider: "test",
          model: "test-model",
          tokens: { fresh: 10, reused: 0 },
          surprise_cause: req.wake.source,
        },
      };
    },
  };

  const topology: TopologyWorldModel = {
    entry_points: [asNodeId("n")],
    nodes: [],
    edges: [],
    acyclic: true,
  };

  const reconciler = createReconciler(ports, {
    topology,
    contract_fingerprints: { n: asFingerprint("sha256:" + "1".repeat(64)) },
  });

  const ref1 = "sha256:wake-1" as ContentAddress;
  const ref2 = "sha256:wake-2" as ContentAddress;
  const ref3 = "sha256:wake-3" as ContentAddress;

  // 1. Start first render (suspended at gate)
  const p1 = reconciler.reconcileAsync({ node: "n", wake: inputWake(ref1) });
  await Promise.resolve();
  await Promise.resolve();

  // 2. Deliver mid-render wake A and mid-render wake B concurrently
  currentInputs = [asFingerprint("inp-2")];
  const p2 = reconciler.reconcileAsync({ node: "n", wake: inputWake(ref2) });
  const p3 = reconciler.reconcileAsync({ node: "n", wake: inputWake(ref3) });

  const r2 = await p2;
  const r3 = await p3;
  equal(r2.disposition, "coalesced");
  equal(r3.disposition, "coalesced");

  // 3. Release gate
  gate.resolve();
  const r1 = await p1;
  equal(r1.disposition, "rendered");

  equal(renderCount, 2, "exactly 1 initial + 1 coalesced follow-up render");

  // The follow-up render's receipt must have merged refs from BOTH mid-render wakes (ref2 and ref3)
  const followUpReceipt = receipts[1];
  ok(followUpReceipt, "follow-up receipt must exist");
  deepEqual(followUpReceipt.wake.refs, [ref2, ref3], "follow-up must carry both coalesced wake refs");
});
