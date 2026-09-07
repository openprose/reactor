import { deepEqual, equal, notEqual, ok } from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  asFingerprint,
  asNodeId,
  ATOMIC_FACET,
  type ContentAddress,
  type FingerprintMap,
} from "../../shapes";
import {
  createFileSystemWorldModelStore,
  createInMemoryWorldModelStore,
  jsonFile,
  readTextFile,
  type WorldModelFiles,
} from "../index";
import type { FileSystemWorldModelStore } from "../fs-store";

test("fs-store: readVersion resolves both raw artifact version and @atomic fingerprint alias", () => {
  const root = mkdtempSync(join(tmpdir(), "fs-store-alias-test-"));
  try {
    const store = createFileSystemWorldModelStore({ directory: root });
    const node = "monitor";

    // Custom canonicalizer where @atomic is computed over a structured projection
    // and does NOT equal contentAddressOf(bytes)
    const structuredCanonicalizer = (files: WorldModelFiles): FingerprintMap => {
      const data = JSON.parse(readTextFile(files["data.json"]!));
      return {
        [ATOMIC_FACET]: asFingerprint(`sha256:structured-${data.v}`),
      };
    };

    const files1: WorldModelFiles = {
      "data.json": jsonFile({ v: 1, extra: "noise" }),
    };

    const commit1 = store.commitPublished(node, files1, structuredCanonicalizer);
    const version1 = commit1.version;
    const atomic1 = commit1.fingerprints[ATOMIC_FACET] as ContentAddress;

    notEqual(version1, atomic1, "version and atomic fingerprint must differ in structured canonicalizer");

    // 1. readVersion by raw artifact version
    const readByVer = store.readVersion(node, version1);
    ok(readByVer, "must read by raw artifact version");
    deepEqual(JSON.parse(readTextFile(readByVer.files["data.json"]!)), { v: 1, extra: "noise" });

    // 2. readVersion by atomic fingerprint
    const readByAtomic = store.readVersion(node, atomic1);
    ok(readByAtomic, "must read by atomic fingerprint");
    deepEqual(JSON.parse(readTextFile(readByAtomic.files["data.json"]!)), { v: 1, extra: "noise" });

    // Commit a second version to verify history
    const files2: WorldModelFiles = {
      "data.json": jsonFile({ v: 2, extra: "noise-2" }),
    };
    const commit2 = store.commitPublished(node, files2, structuredCanonicalizer);
    const version2 = commit2.version;
    const atomic2 = commit2.fingerprints[ATOMIC_FACET] as ContentAddress;

    notEqual(version2, atomic2);
    notEqual(version1, version2);

    // Both historical versions must be readable by their respective atomic fingerprints
    const hist1 = store.readVersion(node, atomic1);
    const hist2 = store.readVersion(node, atomic2);
    ok(hist1, "historical version 1 must resolve by atomic fingerprint");
    ok(hist2, "historical version 2 must resolve by atomic fingerprint");

    deepEqual(JSON.parse(readTextFile(hist1.files["data.json"]!)), { v: 1, extra: "noise" });
    deepEqual(JSON.parse(readTextFile(hist2.files["data.json"]!)), { v: 2, extra: "noise-2" });

    // retainedVersions should only list the .bin artifact versions, not .alias files
    const retained = (store as FileSystemWorldModelStore).retainedVersions(node);
    equal(retained.length, 2, "retainedVersions must count only artifact files");
    ok(retained.includes(version1));
    ok(retained.includes(version2));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("in-memory-store: readVersion resolves both raw artifact version and @atomic fingerprint alias", () => {
  const store = createInMemoryWorldModelStore();
  const node = "analyzer";

  const structuredCanonicalizer = (files: WorldModelFiles): FingerprintMap => {
    const data = JSON.parse(readTextFile(files["data.json"]!));
    return {
      [ATOMIC_FACET]: asFingerprint(`sha256:structured-${data.v}`),
    };
  };

  const files1: WorldModelFiles = {
    "data.json": jsonFile({ v: 1, extra: "a" }),
  };
  const commit1 = store.commitPublished(node, files1, structuredCanonicalizer);
  const version1 = commit1.version;
  const atomic1 = commit1.fingerprints[ATOMIC_FACET] as ContentAddress;

  notEqual(version1, atomic1);

  const read1 = store.readVersion(node, version1);
  const readAtomic1 = store.readVersion(node, atomic1);
  ok(read1);
  ok(readAtomic1);
  deepEqual(JSON.parse(readTextFile(readAtomic1.files["data.json"]!)), { v: 1, extra: "a" });

  const files2: WorldModelFiles = {
    "data.json": jsonFile({ v: 2, extra: "b" }),
  };
  const commit2 = store.commitPublished(node, files2, structuredCanonicalizer);
  const atomic2 = commit2.fingerprints[ATOMIC_FACET] as ContentAddress;

  const readAtomic2 = store.readVersion(node, atomic2);
  ok(readAtomic2);
  deepEqual(JSON.parse(readTextFile(readAtomic2.files["data.json"]!)), { v: 2, extra: "b" });
});
