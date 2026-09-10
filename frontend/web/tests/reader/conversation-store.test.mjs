import test from "node:test";
import assert from "node:assert/strict";
import {
  clearStoredConversationId,
  conversationStorageKey,
  loadStoredConversationId,
  saveStoredConversationId,
} from "../../src/features/reader/domain.ts";

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

test("conversationStorageKey prefers durable document identity over job snapshots", () => {
  assert.equal(
    conversationStorageKey({ jobId: "j1", documentId: "d1" }),
    "retainpdf.reader.ai.conversation.v1:doc:d1",
  );
  assert.equal(
    conversationStorageKey({ documentId: "d1" }),
    "retainpdf.reader.ai.conversation.v1:doc:d1",
  );
});

test("document-scoped conversation migrates the legacy job sticky id", () => {
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  mem.setItem("retainpdf.reader.ai.conversation.v1:job:job-old", "conv-old");
  const scope = { jobId: "job-old", documentId: "doc-stable" };
  assert.equal(loadStoredConversationId(scope), "conv-old");
  assert.equal(
    mem.getItem("retainpdf.reader.ai.conversation.v1:doc:doc-stable"),
    "conv-old",
  );
  clearStoredConversationId(scope);
  assert.equal(mem.getItem("retainpdf.reader.ai.conversation.v1:job:job-old"), null);
  assert.equal(mem.getItem("retainpdf.reader.ai.conversation.v1:doc:doc-stable"), null);
});

test("save/load/clear conversation id via localStorage", () => {
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  const scope = { jobId: "job-x" };
  clearStoredConversationId(scope);
  assert.equal(loadStoredConversationId(scope), "");
  saveStoredConversationId(scope, "conv-1");
  assert.equal(loadStoredConversationId(scope), "conv-1");
  clearStoredConversationId(scope);
  assert.equal(loadStoredConversationId(scope), "");
});
