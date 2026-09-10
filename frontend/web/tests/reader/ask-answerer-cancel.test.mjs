import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// 取消语义锁（审计 P0-2/P0-4 回归锁,ask-answerer 侧）：
// 1. answer() 把 AbortSignal 透传给 ask（askLibraryAi → fetch）——断流是真的
// 2. aborted 的旧流即便带回 conversation_id,也禁止回写会话粘性
//    （否则"生成中切会话"会被旧 done 拽回旧会话,下一问落错线程）

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { createReaderAskAnswerer, loadStoredConversationId } = await import(
  "../../src/features/reader/domain.ts"
);

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
    loadStoredConversationId({ jobId: "job-cancel-a", documentId: "doc-job-cancel-a" }),
    "conv-live",
    "正常完成回写 storage 粘性",
  );
});

test("aborted 的旧流禁止回写会话粘性(P0-4)", async () => {
  const answerer = makeAnswerer(async () => {
    // 模拟：abort 发生在流进行中,但 done 仍带回旧会话 id
    return { answer: "迟到的旧答案", citations: [], conversationId: "conv-stale" };
  }, "job-cancel-b");

  const controller = new AbortController();
  controller.abort();
  await answerer.answer({ question: "问", signal: controller.signal });
  assert.notEqual(answerer.getConversationId(), "conv-stale", "aborted 不得改内存粘性");
  assert.notEqual(
    loadStoredConversationId({ jobId: "job-cancel-b", documentId: "doc-job-cancel-b" }),
    "conv-stale",
    "aborted 不得写 storage 粘性",
  );
});
