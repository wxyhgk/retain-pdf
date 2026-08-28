import test from "node:test";
import assert from "node:assert/strict";
import {
  clearThreadBranchSnapshot,
  loadThreadBranchSnapshot,
  saveThreadBranchSnapshot,
  threadBranchStorageKey,
  visiblePathFromSnapshot,
} from "../src/js/reader/ai/thread-branch-store.ts";

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

test("threadBranchStorageKey scopes by job", () => {
  assert.equal(
    threadBranchStorageKey("job-1"),
    "retainpdf.reader.ai.thread-branch.v1:job:job-1",
  );
  assert.equal(
    threadBranchStorageKey(""),
    "retainpdf.reader.ai.thread-branch.v1:job:anonymous",
  );
});

test("save/load/clear branch tree with siblings + headId", () => {
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  const jobId = "job-branch";
  clearThreadBranchSnapshot(jobId);

  const snapshot = {
    version: 1,
    headId: "a2",
    items: [
      { parentId: null, message: { id: "u1", role: "user", content: "Hỏi gì?" } },
      {
        parentId: "u1",
        message: {
          id: "a1",
          role: "assistant",
          content: "Trả lời A",
          citations: [{ ref: 1, block_id: "p001-b0001" }],
          status: { type: "complete", reason: "stop" },
        },
      },
      {
        parentId: "u1",
        message: {
          id: "a2",
          role: "assistant",
          content: "Trả lời B",
          status: { type: "complete", reason: "stop" },
        },
      },
    ],
  };

  saveThreadBranchSnapshot(jobId, snapshot);
  const loaded = loadThreadBranchSnapshot(jobId);
  assert.ok(loaded);
  assert.equal(loaded.headId, "a2");
  assert.equal(loaded.items.length, 3);
  assert.equal(loaded.items[1].message.citations[0].block_id, "p001-b0001");

  const path = visiblePathFromSnapshot(loaded);
  assert.deepEqual(
    path.map((m) => m.id),
    ["u1", "a2"],
  );

  clearThreadBranchSnapshot(jobId);
  assert.equal(loadThreadBranchSnapshot(jobId), null);
});

test("load normalizes running status to cancelled", () => {
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  const jobId = "job-running";
  mem.setItem(
    threadBranchStorageKey(jobId),
    JSON.stringify({
      version: 1,
      headId: "a1",
      items: [
        { parentId: null, message: { id: "u1", role: "user", content: "q" } },
        {
          parentId: "u1",
          message: {
            id: "a1",
            role: "assistant",
            content: "Nửa chừng",
            status: { type: "running" },
          },
        },
      ],
    }),
  );
  const loaded = loadThreadBranchSnapshot(jobId);
  assert.equal(loaded.items[1].message.status.type, "incomplete");
  assert.equal(loaded.items[1].message.status.reason, "cancelled");
});

// Khóa hồi quy kiểm toán P2-10: snapshot job cũ fallback không được đẩy nội dung phiên A vào phiên B
test("legacy job-key fallback only serves the job's sticky conversation", async () => {
  const { saveStoredConversationId } = await import("../src/js/reader/ai/conversation-store.ts");
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  const jobId = "job-stale";
  const snapshot = {
    version: 1,
    headId: "a1",
    items: [
      { parentId: null, message: { id: "u1", role: "user", content: "Câu hỏi của phiên A" } },
      { parentId: "u1", message: { id: "a1", role: "assistant", content: "Trả lời của phiên A" } },
    ],
  };
  // Sinh một bản snapshot cũ thực sự không con dấu (chỉ khóa job)
  saveThreadBranchSnapshot(jobId, snapshot, "");
  // Phiên dính = conv-A
  saveStoredConversationId({ jobId }, "conv-A");

  assert.ok(loadThreadBranchSnapshot(jobId, "conv-A"), "Phiên dính dùng được snapshot cũ"),
  assert.equal(loadThreadBranchSnapshot(jobId, "conv-B"), null, "Phiên khác không được ăn snapshot cũ");
});

test("conversation stamp rejects cross-conversation snapshots", () => {
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  const jobId = "job-stamp";
  const snapshot = {
    version: 1,
    headId: "a1",
    items: [{ parentId: null, message: { id: "a1", role: "assistant", content: "Nội dung" } }],
  };
  saveThreadBranchSnapshot(jobId, snapshot, "conv-A");
  const loaded = loadThreadBranchSnapshot(jobId, "conv-A");
assert.equal(loaded?.conversationId, "conv-A", "Snapshot mới mang con dấu thuộc về");
  // Lấy snapshot của A và nhét vào key của B (mô phỏng mọi dạng sai lệch), con dấu không khớp phải từ chối
  globalThis.localStorage.setItem(
    threadBranchStorageKey(jobId, "conv-B"),
    globalThis.localStorage.getItem(threadBranchStorageKey(jobId, "conv-A")),
  );
  assert.equal(loadThreadBranchSnapshot(jobId, "conv-B"), null, "Con dấu không khớp từ chối hydrate");
});
