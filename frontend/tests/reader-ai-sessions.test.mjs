import test from "node:test";
import assert from "node:assert/strict";
import { createReaderAiHistoryStore } from "../src/js/reader/ai/chat-history-store.js";
import {
  deriveSessionTitle,
  summarizeSessions,
  trimSessions,
} from "../src/js/reader/ai/chat-sessions-view-model.js";

function memoryStorage(seed) {
  const map = new Map(seed ? Object.entries(seed) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, `${v}`),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const KEY = "retainpdf-ai-chat-v1:job-1";

// ===== view-model logic thuần =====

test("会话标题:取首条用户消息并裁剪,空则占位", () => {
  assert.equal(deriveSessionTitle({ messages: [] }), "Hội thoại mới");
  assert.equal(
    deriveSessionTitle({ messages: [{ role: "assistant", text: "先回答" }, { role: "user", text: "  卤素锂交换是什么  " }] }),
    "卤素锂交换是什么",
  );
  const long = deriveSessionTitle({ messages: [{ role: "user", text: "一二三四五六七八九十一二三四五六七八九十" }] });
  assert.ok(long.endsWith("…") && long.length <= 19);
});

test("会话摘要:按 updatedAt 倒序并标记 active", () => {
  const summaries = summarizeSessions({
    activeId: "s-b",
    sessions: [
      { id: "s-a", updatedAt: 100, messages: [{ role: "user", text: "旧" }] },
      { id: "s-b", updatedAt: 200, messages: [] },
    ],
  });
  assert.deepEqual(summaries.map((s) => s.id), ["s-b", "s-a"]);
  assert.equal(summaries[0].active, true);
  assert.equal(summaries[0].messageCount, 0);
  assert.equal(summaries[1].title, "旧");
});

test("会话上限截断:超过上限保留最近更新的,且保留 active", () => {
  const sessions = Array.from({ length: 25 }, (_, i) => ({ id: `s-${i}`, updatedAt: i }));
  const kept = trimSessions({ sessions, activeId: "s-0" }, 20);
  assert.equal(kept.length, 20);
  assert.ok(kept.some((s) => s.id === "s-0"), "最旧但 active 的会话被保留");
});

// ===== store: tương thích ngược session đơn =====

test("单会话层:save/load/clear 作用于当前会话", () => {
  const storage = memoryStorage();
  const store = createReaderAiHistoryStore({ jobId: "job-1", storage });
  assert.deepEqual(store.load(), { messages: [], history: [] });
  store.save({
    messages: [{ role: "user", text: "问题" }, { role: "assistant", text: "**答**", citations: [{ ref: 1, block_id: "b-1" }] }],
    history: [{ role: "user", content: "问题" }],
  });
  const loaded = store.load();
  assert.equal(loaded.messages.length, 2);
  assert.equal(loaded.messages[1].citations[0].block_id, "b-1");
  store.clear();
  assert.deepEqual(store.load(), { messages: [], history: [] });
});

// ===== store: nhiều session =====

test("多会话:新建/切换/删除与 active 迁移", () => {
  const storage = memoryStorage();
  const store = createReaderAiHistoryStore({ jobId: "job-1", storage });
  store.save({ messages: [{ role: "user", text: "会话A" }], history: [] });
  const idA = store.activeSessionId();

  const idB = store.newSession();
  assert.notEqual(idA, idB);
  assert.equal(store.activeSessionId(), idB, "新建后 active 指向新会话");
  assert.deepEqual(store.load(), { messages: [], history: [] }, "新会话是空的");
  store.save({ messages: [{ role: "user", text: "会话B" }], history: [] });

  assert.equal(store.listSessions().length, 2);

  // Quay lại A
  const backToA = store.switchSession(idA);
  assert.equal(backToA.messages[0].text, "会话A");
  assert.equal(store.activeSessionId(), idA);

  // Xóa A → active chuyển sang B
  const afterDelete = store.deleteSession(idA);
  assert.equal(store.listSessions().length, 1);
  assert.equal(afterDelete.messages[0].text, "会话B");
  assert.equal(store.activeSessionId(), idB);
});

test("删除最后一条会话:补一条空会话而非留空", () => {
  const storage = memoryStorage();
  const store = createReaderAiHistoryStore({ jobId: "job-1", storage });
  store.save({ messages: [{ role: "user", text: "唯一" }], history: [] });
  const only = store.activeSessionId();
  const after = store.deleteSession(only);
  assert.deepEqual(after, { messages: [], history: [] });
  assert.ok(store.activeSessionId(), "仍有一条空会话作为 active");
  assert.equal(store.listSessions().length, 1);
});

test("兼容旧版单会话格式:首次读取自动迁移为一条会话", () => {
  const storage = memoryStorage({
    [KEY]: JSON.stringify({ messages: [{ role: "user", text: "旧数据" }], history: [{ role: "user", content: "旧数据" }] }),
  });
  const store = createReaderAiHistoryStore({ jobId: "job-1", storage });
  const loaded = store.load();
  assert.equal(loaded.messages[0].text, "旧数据");
  assert.equal(loaded.history[0].content, "旧数据");
  assert.equal(store.listSessions().length, 1, "旧数据迁移为单条会话");
});

test("无 jobId / 无 storage:多会话接口静默降级不抛", () => {
  const noJob = createReaderAiHistoryStore({ jobId: "", storage: memoryStorage() });
  assert.equal(noJob.enabled, false);
  assert.deepEqual(noJob.listSessions(), []);
  assert.equal(noJob.newSession(), "");
  assert.doesNotThrow(() => noJob.deleteSession("x"));
  assert.deepEqual(noJob.switchSession("x"), { messages: [], history: [] });
});
