import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReaderRequestSnapshot,
  LEGACY_REQUEST_SNAPSHOT,
  loadReaderRequestSnapshot,
  loadRetryRequestSnapshot,
  normalizeRequestSnapshot,
  requestSnapshotScopeKey,
  saveReaderRequestSnapshot,
} from "../../../../frontend/packages/reader/src/components/react-pdf/assistant/reader-request-snapshots.ts";

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

test("reading keeps the live selection; operations are always document-scoped", () => {
  const selection = { kind: "text", quoteText: "引文" };
  assert.deepEqual(
    buildReaderRequestSnapshot({ assistantMode: "reading", selectionContext: selection }),
    { assistantMode: "reading", scope: "selection", context: { ...selection } },
  );
  assert.deepEqual(
    buildReaderRequestSnapshot({ assistantMode: "reading", selectionContext: null }),
    { assistantMode: "reading", scope: "document", context: null },
  );
  // An operation can never inherit a quote even when a selection is visible.
  assert.deepEqual(
    buildReaderRequestSnapshot({ assistantMode: "operations", selectionContext: selection }),
    { assistantMode: "operations", scope: "document", context: null },
  );
});

test("normalize rejects malformed snapshots", () => {
  assert.equal(normalizeRequestSnapshot(null), null);
  assert.equal(normalizeRequestSnapshot({ assistantMode: "reading" }), null);
  assert.equal(normalizeRequestSnapshot({ assistantMode: "agent", scope: "document" }), null);
  assert.deepEqual(
    normalizeRequestSnapshot({ assistantMode: "operations", scope: "page", context: { a: 1 } }),
    { assistantMode: "operations", scope: "page", context: { a: 1 } },
  );
});

test("retry prefers the scope key, falls back to job id, then legacy reading", () => {
  globalThis.localStorage = new MemoryStorage();
  saveReaderRequestSnapshot("scope-doc", "a-new", {
    assistantMode: "operations",
    scope: "document",
    context: null,
  });
  saveReaderRequestSnapshot("job-1", "a-old", {
    assistantMode: "reading",
    scope: "selection",
    context: { quoteText: "旧选区" },
  });

  assert.deepEqual(
    loadRetryRequestSnapshot({ scopeKey: "scope-doc", jobId: "job-1", assistantMessageId: "a-new" }),
    { assistantMode: "operations", scope: "document", context: null },
  );
  // Same message id stored under the job id is found when the scope key moved.
  assert.deepEqual(
    loadRetryRequestSnapshot({ scopeKey: "scope-moved", jobId: "job-1", assistantMessageId: "a-old" }),
    { assistantMode: "reading", scope: "selection", context: { quoteText: "旧选区" } },
  );
  assert.deepEqual(
    loadRetryRequestSnapshot({ scopeKey: "scope-moved", jobId: "job-1", assistantMessageId: "a-missing" }),
    LEGACY_REQUEST_SNAPSHOT,
  );
  assert.equal(loadReaderRequestSnapshot("job-1", ""), null);
});

test("scope key prefers stable document identity", () => {
  assert.equal(
    requestSnapshotScopeKey({ documentId: "doc-1", jobId: "job-1" }),
    "doc-1",
  );
  assert.equal(
    requestSnapshotScopeKey({ documentIdRef: "doc-2", jobId: "job-1" }),
    "doc-2",
  );
  assert.equal(requestSnapshotScopeKey({ jobId: "job-1" }), "job-1");
});
