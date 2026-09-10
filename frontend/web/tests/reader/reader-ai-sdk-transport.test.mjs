import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const requireFromReader = createRequire(
  new URL("../../../../frontend/packages/reader/package.json", import.meta.url),
);
const { Chat } = await import(requireFromReader.resolve("@ai-sdk/react"));

const {
  RetainPdfChatTransport,
  readerChatMessageText,
} = await import(
  "../../../../frontend/packages/reader/src/components/react-pdf/assistant/retainpdf-chat-transport.ts"
);

test("RetainPDF SSE adapter feeds AI SDK messages without changing the backend contract", async () => {
  const calls = [];
  const answerer = {
    async ensureLoaded(jobId) {
      assert.equal(jobId, "job-sdk");
    },
    async answer(options) {
      calls.push(options);
      options.onToolEvent({ tool: "search_markdown", event: "start" });
      options.onAnswerDelta("第一段", "第一段");
      options.onAnswerDelta("第一段第二段", "第二段");
      return {
        answer: "第一段第二段",
        citations: [{ ref: 1, page_idx: 2, block_id: "p003-b0001" }],
        persisted: true,
      };
    },
  };
  const chat = new Chat({
    id: "chat-sdk",
    transport: new RetainPdfChatTransport({
      jobId: "job-sdk",
      getRemoteAnswerer: () => answerer,
      getLocalAnswerer: () => null,
    }),
  });

  await chat.sendMessage(
    { id: "u-sdk", role: "user", parts: [{ type: "text", text: "核心结论？" }] },
    {
      body: {
        assistantMessageId: "a-sdk",
        parentId: "a-before",
        userMessageId: "u-sdk",
        scope: "selection",
        context: {
          page: 2,
          pane: "source",
          kind: "text",
          block_id: "p002-b0001",
          quoteText: "selected source text",
        },
      },
    },
  );

  assert.equal(chat.status, "ready");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].question, "核心结论？");
  assert.equal(calls[0].assistantMode, "reading");
  assert.equal(calls[0].parentId, "a-before");
  assert.equal(calls[0].assistantMessageId, "a-sdk");
  assert.equal(calls[0].scope, "selection");
  assert.equal(calls[0].context.block_id, "p002-b0001");
  assert.equal(calls[0].context.quoteText, "selected source text");
  assert.equal(chat.messages.at(-1).id, "a-sdk");
  assert.equal(readerChatMessageText(chat.messages.at(-1)), "第一段第二段");
  assert.equal(chat.messages.at(-1).metadata.status, "complete");
  assert.equal(chat.messages.at(-1).metadata.citations[0].page_idx, 2);
});

test("AI SDK stop aborts the existing RetainPDF request and keeps partial text", async () => {
  let requestSignal;
  let startedResolve;
  const started = new Promise((resolve) => { startedResolve = resolve; });
  const answerer = {
    async answer(options) {
      requestSignal = options.signal;
      options.onAnswerDelta("已经生成", "已经生成");
      startedResolve();
      await new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
      return { answer: "不应完成", citations: [] };
    },
  };
  const chat = new Chat({
    id: "chat-cancel",
    transport: new RetainPdfChatTransport({
      jobId: "job-cancel",
      getRemoteAnswerer: () => answerer,
    }),
  });

  const sending = chat.sendMessage({
    id: "u-cancel",
    role: "user",
    parts: [{ type: "text", text: "停止测试" }],
  }, { body: { assistantMessageId: "a-cancel" } });
  await started;
  await new Promise((resolve) => setTimeout(resolve, 10));
  await chat.stop();
  await sending;

  assert.equal(requestSignal.aborted, true);
  assert.equal(chat.status, "ready");
  assert.equal(readerChatMessageText(chat.messages.at(-1)), "已经生成");
});

test("Reader transport forwards operation hints and green-light mode to the operation controller", async () => {
  const signals = [];
  const modes = [];
  const answerer = {
    async answer(options) {
      options.onAgentSessionEvent({
        type: "agent_session",
        capabilities: { document_operation_confirmation_mode: "green_light" },
      });
      options.onAgentOperationEvent({
        type: "agent_operation",
        operation_id: "op-stream",
        conversation_id: "conv-reader",
        status: "running",
      });
      return {
        answer: "正在处理 PDF",
        citations: [],
        conversationId: "conv-reader",
        confirmationMode: "green_light",
        operationRefs: [{ operation_id: "op-done" }],
        confirmationRequests: [{ operation_id: "op-confirm" }],
      };
    },
  };
  const chat = new Chat({
    id: "chat-agent-operations",
    transport: new RetainPdfChatTransport({
      jobId: "job-agent-operations",
      getRemoteAnswerer: () => answerer,
      onAgentOperationSignal: (signal) => signals.push(signal),
      onConfirmationMode: (mode) => modes.push(mode),
    }),
  });

  await chat.sendMessage({
    id: "u-agent-operations",
    role: "user",
    parts: [{ type: "text", text: "旋转第四页" }],
  }, { body: { assistantMessageId: "a-agent-operations" } });

  assert.deepEqual(new Set(signals.map((signal) => signal.operationId)), new Set([
    "op-stream",
    "op-done",
    "op-confirm",
  ]));
  assert.equal(signals.find((signal) => signal.operationId === "op-stream").conversationId, "conv-reader");
  assert.equal(signals.find((signal) => signal.operationId === "op-done").confirmationMode, "green_light");
  assert.deepEqual(modes, ["green_light", "green_light"]);
});

test("Reader transport freezes mode, scope, and selection before async loading", async () => {
  let currentMode = "reading";
  let releaseLoading;
  const loading = new Promise((resolve) => { releaseLoading = resolve; });
  const calls = [];
  const answerer = {
    async ensureLoaded() {
      await loading;
    },
    async answer(options) {
      calls.push(options);
      return { answer: "done", citations: [] };
    },
  };
  const chat = new Chat({
    id: "chat-frozen-request",
    transport: new RetainPdfChatTransport({
      jobId: "job-frozen-request",
      getRemoteAnswerer: () => answerer,
      getAssistantMode: () => currentMode,
    }),
  });

  const context = {
    page: 4,
    pane: "translated",
    kind: "text",
    quoteText: "original selection",
  };
  const sending = chat.sendMessage({
    id: "u-frozen-request",
    role: "user",
    parts: [{ type: "text", text: "retry this request" }],
  }, {
    body: {
      assistantMessageId: "a-frozen-request",
      assistantMode: "operations",
      scope: "selection",
      context,
    },
  });

  // Mutating the visible controls and caller object after submission must not
  // reroute the request that is already waiting for its document payload.
  currentMode = "reading";
  context.quoteText = "mutated selection";
  releaseLoading();
  await sending;

  assert.equal(calls.length, 1);
  assert.equal(calls[0].assistantMode, "operations");
  assert.equal(calls[0].scope, "selection");
  assert.equal(calls[0].context.quoteText, "original selection");
});
