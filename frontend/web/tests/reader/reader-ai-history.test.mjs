import test from "node:test";
import assert from "node:assert/strict";
import { createReaderAiHistoryStore } from "../../src/features/reader/domain.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, `${v}`),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test("聊天记录持久化:按 jobId 存取、截断、清空", () => {
  const storage = memoryStorage();
  const store = createReaderAiHistoryStore({ jobId: "job-1", storage });
  assert.equal(store.enabled, true);
  assert.deepEqual(store.load(), { messages: [], history: [] });

  store.save({
    messages: [
      { role: "user", text: "问题" },
      { role: "assistant", text: "**回答** [1]", citations: [{ ref: 1, block_id: "b-1" }] },
    ],
    history: [{ role: "user", content: "问题" }, { role: "assistant", content: "回答" }],
  });
  const loaded = store.load();
  assert.equal(loaded.messages.length, 2);
  assert.equal(loaded.messages[1].text, "**回答** [1]");
  assert.equal(loaded.messages[1].citations[0].block_id, "b-1");
  assert.equal(loaded.history.length, 2);

  // 不同 jobId 隔离
  const other = createReaderAiHistoryStore({ jobId: "job-2", storage });
  assert.deepEqual(other.load(), { messages: [], history: [] });

  store.clear();
  assert.deepEqual(store.load(), { messages: [], history: [] });
});

test("无 jobId 或无 storage 时禁用,静默不抛", () => {
  const noJob = createReaderAiHistoryStore({ jobId: "", storage: memoryStorage() });
  assert.equal(noJob.enabled, false);
  assert.deepEqual(noJob.load(), { messages: [], history: [] });
  assert.doesNotThrow(() => noJob.save({ messages: [{ role: "user", text: "x" }] }));

  const noStorage = createReaderAiHistoryStore({ jobId: "job-1", storage: null });
  assert.equal(noStorage.enabled, false);
  assert.doesNotThrow(() => noStorage.save({ messages: [] }));
});

test("截断:超过上限只保留最近若干轮", () => {
  const storage = memoryStorage();
  const store = createReaderAiHistoryStore({ jobId: "job-big", storage });
  const messages = Array.from({ length: 100 }, (_, i) => ({ role: "user", text: `q${i}` }));
  store.save({ messages, history: [] });
  const loaded = store.load();
  assert.ok(loaded.messages.length <= 40);
  assert.equal(loaded.messages.at(-1).text, "q99", "保留最近的");
});
