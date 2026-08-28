import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Khóa ngữ nghĩa hủy (khóa hồi quy audit P0-2/P0-4, phía ask-answerer):
// 1. answer() chuyển tiếp AbortSignal cho ask (askLibraryAi → fetch) — ngắt stream là thật
// 2. Stream đã hủy dù mang conversation_id về cũng cấm ghi lại session keo dính
//    (nếu không "đổi session khi đang sinh" sẽ bị done cũ kéo về session cũ, câu hỏi sau lọt nhầm thread)

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { createReaderAskAnswerer } = await import("../src/js/reader/ai/ask-answerer.ts");
const { loadStoredConversationId } = await import("../src/js/reader/ai/conversation-store.ts");

function makeAnswerer(fakeAsk, jobId) {
  return createReaderAskAnswerer({
    jobId,
    ask: fakeAsk,
    documentByJobId: async () => ({ document_id: `doc-${jobId}` }),
    llmConfig: () => ({ apiKey: "test-model-key" }),
  });
}

test("signal 透传到 ask,正常完成时回写会话粘性", async () => {
  const seen = {};
  const answerer = makeAnswerer(async (args) => {
    seen.signal = args.signal;
    return { answer: "答 [1]", citations: [], conversationId: "conv-live" };
  }, "job-cancel-a");

  const controller = new AbortController();
  const result = await answerer.answer({ question: "问", signal: controller.signal });
  assert.equal(seen.signal, controller.signal, "signal 必须透传给 ask");
  assert.equal(result.conversationId, "conv-live");
  assert.equal(answerer.getConversationId(), "conv-live", "正常完成回写内存粘性");
  assert.equal(
    loadStoredConversationId({ jobId: "job-cancel-a" }),
    "conv-live",
    "正常完成回写 storage 粘性",
  );
});

test("aborted 的旧流禁止回写会话粘性(P0-4)", async () => {
  const answerer = makeAnswerer(async () => {
    // Giả lập: abort xảy ra khi stream đang chạy, nhưng done vẫn mang session ID cũ
    return { answer: "迟到的旧答案", citations: [], conversationId: "conv-stale" };
  }, "job-cancel-b");

  const controller = new AbortController();
  controller.abort();
  await answerer.answer({ question: "问", signal: controller.signal });
  assert.notEqual(answerer.getConversationId(), "conv-stale", "aborted 不得改内存粘性");
  assert.notEqual(
    loadStoredConversationId({ jobId: "job-cancel-b" }),
    "conv-stale",
    "aborted 不得写 storage 粘性",
  );
});
