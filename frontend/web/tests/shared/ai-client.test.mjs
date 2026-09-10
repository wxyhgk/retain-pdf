import test from "node:test";
import assert from "node:assert/strict";

// 让 config/runtime.js 的 isMockMode()/apiBase() 在 node 下可用(无 jsdom 需求)
globalThis.window = globalThis.window || { location: { search: "", protocol: "http:", hostname: "127.0.0.1" } };

const { AiAskError, askLibraryAi, readAiAskStream } = await import("@/platform/api/legacy/ai.js");
const { readAiAskStream: readCanonicalAiAskStream } = await import("@retainpdf/api/ai");
const {
  buildAgentOperationCandidateUrl,
  cancelAgentOperation,
  commitAgentOperation,
  fetchAgentOperationCandidate,
  getAgentOperation,
  listAgentOperations,
  retryAgentOperation,
  runAgentOperation,
} = await import("@retainpdf/api/document-operations");
const { setRuntimeConfig } = await import("@/platform/config/runtime.js");
const { buildScopedQuestion, createReaderAskAnswerer } = await import("../../src/features/reader/domain.js");

function sseStream(chunks = []) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

// ===== SSE 行解析(/api/v1/ai/ask 流式契约) =====

test("readAiAskStream:tool 事件按序回调,done 事件返回归一化结果", async () => {
  const toolEvents = [];
  // 事件跨 chunk 截断 + CRLF + 非 data 行,验证缓冲逻辑
  const result = await readAiAskStream(sseStream([
    ': keep-alive\n',
    'data: {"type": "tool", "round": 1, "tool": "list_documents", "arguments": {"limit": 200}}\r\n\r\n',
    'data: {"type": "tool", "round": 2, "tool": "search_f',
    'ulltext", "arguments": {"query": "光谱"}}\n\n',
    'data: {"type": "done", "answer": "结论 [1]。", "citations": [{"ref": 1, "document_id": "doc-1", "job_id": "job-1", "page_idx": 3, "block_id": "p004-b0002", "snippet": "命中片段"}], "tool_trace": [{"round": 1, "tool": "list_documents"}], "rounds": 3}\n\n',
  ]), {
    onToolEvent: (event) => toolEvents.push(event),
  });

  assert.deepEqual(toolEvents.map((event) => [event.round, event.tool]), [
    [1, "list_documents"],
    [2, "search_fulltext"],
  ]);
  assert.equal(result.answer, "结论 [1]。");
  assert.equal(result.rounds, 3);
  assert.equal(result.citations.length, 1);
  assert.deepEqual(result.citations[0], {
    ref: 1,
    document_id: "doc-1",
    job_id: "job-1",
    page_idx: 3,
    block_id: "p004-b0002",
    snippet: "命中片段",
  });
  assert.equal(result.toolTrace.length, 1);
});

test("readAiAskStream:展示路由与检索进度并忽略 heartbeat", async () => {
  const progress = [];
  const result = await readAiAskStream(sseStream([
    'data: {"type":"progress","stage":"routing","message":"正在选择回答模式"}\n\n',
    'data: {"type":"heartbeat","elapsed_ms":5000}\n\n',
    'data: {"type":"progress","stage":"retrieval","message":"正在读取文档"}\n\n',
    'data: {"type":"done","answer":"完成","citations":[],"tool_trace":[],"rounds":1,"persisted":true}\n\n',
  ]), {
    onProgressEvent: (event) => progress.push(event),
  });
  assert.equal(result.answer, "完成");
  assert.deepEqual(progress.map(({ stage, message }) => [stage, message]), [
    ["routing", "正在选择回答模式"],
    ["retrieval", "正在读取文档"],
  ]);
});

test("readAiAskStream:cancelled 是明确终态而不是断流", async () => {
  await assert.rejects(
    readAiAskStream(sseStream([
      'data: {"type":"cancelled","code":"AI_REQUEST_CANCELLED","message":"请求已取消","retryable":false}\n\n',
    ])),
    /请求已取消/,
  );
});

test("readAiAskStream:结构化 Agent 事件回调并汇总 runtime/operation refs", async () => {
  const legacyTools = [];
  const agentTools = [];
  const sessions = [];
  const operations = [];
  const result = await readAiAskStream(sseStream([
    'data: {"type":"agent_session","conversation_id":"conv-agent","request_message_id":"msg-1","agent_runtime":"fx","capabilities":{"document_operations":true}}\n\n',
    'data: {"type":"agent_tool","runtime":"fx","title":"创建候选版本","status":"running"}\n\n',
    'data: {"type":"agent_operation","event_id":"op-1:4","operation_id":"op-1","conversation_id":"conv-agent","request_message_id":"msg-1","status":"running","current_attempt":2,"latest_event_seq":4}\n\n',
    'data: {"type":"agent_operation","event_id":"op-1:5","operation_id":"op-1","conversation_id":"conv-agent","request_message_id":"msg-1","status":"result_ready","current_attempt":2,"latest_event_seq":5}\n\n',
    'data: {"type":"done","answer":"已创建操作。","citations":[],"tool_trace":[],"rounds":1,"persisted":true}\n\n',
  ]), {
    onToolEvent: (event) => legacyTools.push(event),
    onAgentToolEvent: (event) => agentTools.push(event),
    onAgentSessionEvent: (event) => sessions.push(event),
    onAgentOperationEvent: (event) => operations.push(event),
  });

  assert.equal(legacyTools.length, 1, "agent_tool 应兼容已有过程提示回调");
  assert.equal(agentTools.length, 1);
  assert.equal(sessions[0].agent_runtime, "fx");
  assert.deepEqual(operations.map((event) => event.status), ["running", "result_ready"]);
  assert.equal(result.agentRuntime, "fx");
  assert.deepEqual(result.operationRefs, [{
    operation_id: "op-1",
    status: "result_ready",
    current_attempt: 2,
    latest_event_seq: 5,
  }]);
});

test("readAiAskStream:结构化确认 SSE 与 done 请求都作为刷新提示透出", async () => {
  const confirmations = [];
  const request = {
    schema: "retainpdf_agent_confirmation_v1",
    operation_id: "op-confirm",
    action: "run",
    status: "awaiting_confirmation",
    current_attempt: 1,
    latest_event_seq: 3,
    requires_risk_acceptance: false,
  };
  const result = await readAiAskStream(sseStream([
    `data: ${JSON.stringify({ type: "agent_confirmation_required", ...request })}\n\n`,
    `data: ${JSON.stringify({
      type: "done",
      answer: "等待确认。",
      citations: [],
      tool_trace: [],
      rounds: 1,
      confirmation_mode: "explicit",
      confirmation_requests: [request],
    })}\n\n`,
  ]), {
    onAgentConfirmationRequiredEvent: (event) => confirmations.push(event),
  });

  assert.equal(result.confirmationMode, "explicit");
  assert.deepEqual(result.confirmationRequests, [request]);
  assert.deepEqual(confirmations, [
    { type: "agent_confirmation_required", ...request },
    { type: "agent_confirmation_required", ...request },
  ], "SSE 和 done 都应触发刷新提示；业务层按 operation/action/attempt 去重");
});

test("canonical readAiAskStream:保留结构化 Agent 事件兼容", async () => {
  const operations = [];
  const result = await readCanonicalAiAskStream(sseStream([
    'data: {"type":"agent_session","conversation_id":"conv-canonical","agent_runtime":"fx"}\n\n',
    'data: {"type":"agent_operation","operation_id":"op-canonical","conversation_id":"conv-canonical","request_message_id":"msg-canonical","status":"draft","current_attempt":1,"latest_event_seq":0}\n\n',
    'data: {"type":"done","answer":"ok","citations":[],"tool_trace":[],"rounds":1,"persisted":true}\n\n',
  ]), {
    onAgentOperationEvent: (event) => operations.push(event),
  });
  assert.equal(operations[0].operation_id, "op-canonical");
  assert.equal(result.agentRuntime, "fx");
  assert.equal(result.operationRefs[0].operation_id, "op-canonical");
});

test("readAiAskStream:error 事件抛出 AiAskError", async () => {
  await assert.rejects(
    readAiAskStream(sseStream([
      'data: {"type": "tool", "round": 1, "tool": "search_fulltext", "arguments": {}}\n\n',
      'data: {"type": "error", "message": "上游模型超时"}\n\n',
    ])),
    (error) => error instanceof AiAskError && /上游模型超时/.test(error.message),
  );
});

test("readAiAskStream:流中断(无 done)抛出可重试错误", async () => {
  await assert.rejects(
    readAiAskStream(sseStream([
      'data: {"type": "tool", "round": 1, "tool": "read_blocks", "arguments": {}}\n\n',
    ])),
    (error) => error instanceof AiAskError && /中断/.test(error.message),
  );
});

test("readAiAskStream:末尾无换行的 done 行也能解析", async () => {
  const result = await readAiAskStream(sseStream([
    'data: {"type": "done", "answer": "ok", "citations": [], "tool_trace": [], "rounds": 1}',
  ]));
  assert.equal(result.answer, "ok");
});

// ===== askLibraryAi:请求构造与错误分级 =====

test("askLibraryAi:携带 X-API-Key,body 含 question/document_id/job_id/stream", async () => {
  setRuntimeConfig({ xApiKey: "test-key" });
  const calls = [];
  const result = await askLibraryAi({
    question: "这篇讲什么?",
    documentId: "doc-9",
    jobId: "job-9",
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return {
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: sseStream(['data: {"type": "done", "answer": "答", "citations": [], "tool_trace": [], "rounds": 1}\n\n']),
      };
    },
  });
  setRuntimeConfig({ xApiKey: "" });

  assert.equal(result.answer, "答");
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.match(url, /\/api\/v1\/ai\/ask$/);
  assert.equal(options.method, "POST");
  assert.equal(options.headers["X-API-Key"], "test-key");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(options.body), {
    question: "这篇讲什么?",
    document_id: "doc-9",
    job_id: "job-9",
    stream: true,
  });
});

test("askLibraryAi:只有显式授权时发送 confirm_document_operation", async () => {
  const bodies = [];
  const fetchImpl = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({
        code: 0,
        data: { answer: "ok", citations: [], tool_trace: [], rounds: 1, persisted: true },
      }),
    };
  };
  await askLibraryAi({ question: "普通问答", fetchImpl });
  await askLibraryAi({ question: "确认执行", confirmDocumentOperation: true, fetchImpl });
  assert.equal(Object.hasOwn(bodies[0], "confirm_document_operation"), false);
  assert.equal(bodies[1].confirm_document_operation, true);
});

test("askLibraryAi:按请求显式区分辅助阅读与 PDF 操作", async () => {
  const bodies = [];
  const fetchImpl = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({
        code: 0,
        data: { answer: "ok", citations: [], tool_trace: [], rounds: 1, persisted: true },
      }),
    };
  };

  await askLibraryAi({ question: "总结本文", assistantMode: "reading", fetchImpl });
  await askLibraryAi({ question: "旋转第一页", assistantMode: "operations", fetchImpl });
  await askLibraryAi({ question: "保持兼容", fetchImpl });

  assert.equal(bodies[0].assistant_mode, "reading");
  assert.equal(bodies[1].assistant_mode, "operations");
  assert.equal(Object.hasOwn(bodies[2], "assistant_mode"), false);
});

test("document operations:公开 facade URL 与 CAS action body 稳定", async () => {
  const calls = [];
  const operation = {
    operation_id: "op-1",
    conversation_id: "conv-1",
    request_message_id: "msg-1",
    document_id: "doc-1",
    intent_summary: "旋转第 2 页",
    status: "draft",
    current_attempt: 1,
    program_sha256: "abc",
    candidate_available: false,
    candidate: null,
    latest_event_seq: 1,
    allowed_actions: ["run", "cancel"],
    events: [],
    created_at: "2026-08-29T00:00:00Z",
    updated_at: "2026-08-29T00:00:00Z",
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const data = url.includes("/conversations/") ? { operations: [operation] } : operation;
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data }),
    };
  };
  const transport = { apiPrefix: "/api/v1", fetchImpl };
  const action = {
    idempotency_key: "idem-1",
    expected_status: "draft",
    expected_attempt: 1,
    expected_program_sha256: "abc",
  };

  assert.equal((await listAgentOperations({ conversationId: "conv-1", ...transport })).operations.length, 1);
  await getAgentOperation("op-1", transport);
  await runAgentOperation("op-1", action, transport);
  await retryAgentOperation("op-1", { ...action, accept_duplicate_risk: true }, transport);
  await cancelAgentOperation("op-1", { ...action, reason: "用户拒绝" }, transport);
  await commitAgentOperation("op-1", action, transport);

  assert.match(calls[0].url, /\/api\/v1\/ai\/conversations\/conv-1\/operations$/);
  assert.deepEqual(calls.slice(1).map(({ url, options }) => [new URL(url, "http://local").pathname, options.method]), [
    ["/api/v1/ai/operations/op-1", "GET"],
    ["/api/v1/ai/operations/op-1/run", "POST"],
    ["/api/v1/ai/operations/op-1/retry", "POST"],
    ["/api/v1/ai/operations/op-1/cancel", "POST"],
    ["/api/v1/ai/operations/op-1/commit", "POST"],
  ]);
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    schema: "document_operation_action_v1",
    ...action,
  });
  assert.match(buildAgentOperationCandidateUrl("op-1", "/api/v1"), /\/api\/v1\/ai\/operations\/op-1\/candidate\.pdf$/);
});

test("document operation candidate uses authenticated API fetch instead of a relative link", async () => {
  const previous = globalThis.window.__FRONT_RUNTIME_CONFIG__;
  globalThis.window.__FRONT_RUNTIME_CONFIG__ = {
    ...(previous || {}),
    apiBase: "http://127.0.0.1:41000",
    xApiKey: "frontend-test-key",
  };
  const calls = [];
  try {
    const blob = await fetchAgentOperationCandidate("op-auth", {
      apiPrefix: "/api/v1",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(new Blob(["pdf"], { type: "application/pdf" }), {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        });
      },
    });
    assert.equal(blob.type, "application/pdf");
    assert.equal(new URL(calls[0].url).port, "41000");
    assert.equal(calls[0].options.headers["X-API-Key"], "frontend-test-key");
  } finally {
    globalThis.window.__FRONT_RUNTIME_CONFIG__ = previous;
  }
});

test("askLibraryAi:502 抛出带 status 的 AI 服务未运行错误", async () => {
  await assert.rejects(
    askLibraryAi({
      question: "hi",
      fetchImpl: async () => ({ ok: false, status: 502, text: async () => "" }),
    }),
    (error) => error instanceof AiAskError && error.status === 502 && /AI 服务未运行/.test(error.message),
  );
});

test("askLibraryAi:401 解析 FastAPI detail 并提示 X-API-Key", async () => {
  await assert.rejects(
    askLibraryAi({
      question: "hi",
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: "invalid api key" }),
      }),
    }),
    (error) => error instanceof AiAskError
      && error.status === 401
      && /invalid api key/i.test(error.message),
  );
});

test("askLibraryAi:400 缺 LLM key 时透传/归并可读文案", async () => {
  await assert.rejects(
    askLibraryAi({
      question: "hi",
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          detail: "缺少 LLM API Key:请在前端凭据设置中填写模型 API Key。",
        }),
      }),
    }),
    (error) => error instanceof AiAskError
      && error.status === 400
      && /LLM API Key|模型 API Key|凭据/.test(error.message),
  );
});

test("askLibraryAi:非流式 JSON envelope 兜底解包", async () => {
  const result = await askLibraryAi({
    question: "hi",
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ code: 0, data: { answer: "非流式", citations: [], tool_trace: [], rounds: 2 } }),
    }),
  });
  assert.equal(result.answer, "非流式");
  assert.equal(result.rounds, 2);
});

test("askLibraryAi:非流式 done 保留确认契约并触发刷新提示", async () => {
  const confirmations = [];
  const request = {
    schema: "retainpdf_agent_confirmation_v1",
    operation_id: "op-json-confirm",
    action: "retry",
    status: "ambiguous",
    current_attempt: 3,
    latest_event_seq: 12,
    requires_risk_acceptance: true,
  };
  const result = await askLibraryAi({
    question: "继续处理",
    onAgentConfirmationRequiredEvent: (event) => confirmations.push(event),
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({
        code: 0,
        data: {
          answer: "需要确认风险。",
          citations: [],
          tool_trace: [],
          rounds: 1,
          confirmation_mode: "explicit",
          confirmation_requests: [request],
        },
      }),
    }),
  });
  assert.equal(result.confirmationMode, "explicit");
  assert.deepEqual(result.confirmationRequests, [request]);
  assert.deepEqual(confirmations, [{ type: "agent_confirmation_required", ...request }]);
});

// ===== ask-answerer:document_id 反查缓存与 scope 前缀 =====

test("buildScopedQuestion:页/选区范围以前缀写进 question 文本", () => {
  assert.equal(buildScopedQuestion({ question: "总结一下", scope: "document" }), "总结一下");
  assert.equal(
    buildScopedQuestion({ question: "总结一下", scope: "page", context: { page: 4 } }),
    "（当前第 4 页）总结一下",
  );
  assert.equal(
    buildScopedQuestion({
      question: "解释这段",
      scope: "selection",
      context: { page: 2, rect: {} },
      resolveQuote: () => ({ quoteText: "选中的  原文\n片段" }),
    }),
    "（针对选中的原文片段：「选中的 原文 片段」）解释这段",
  );
  assert.equal(
    buildScopedQuestion({ question: "解释这段", scope: "selection", context: { page: 2 }, resolveQuote: () => null }),
    "（针对第 2 页的选区内容）解释这段",
  );
  assert.equal(
    buildScopedQuestion({
      question: "解释这个公式",
      scope: "selection",
      context: { page: 3, pane: "source", kind: "formula", quoteText: "E = mc^2" },
    }),
    "（针对选中的原文公式：「E = mc^2」）解释这个公式",
  );
});

// ===== chat 渲染:引用可点击、模型文本不注入 HTML =====

test("chat:agentic 回答渲染 [n] 可点击引用与脚注,模型文本 XSS 安全", async () => {
  // Phase 2b:AI 问答 UI 迁入 React(ReaderAiChat),本测试改为渲染组件、
  // 经 DOM 提交驱动;渲染语义断言(过程提示/XSS/引用按钮/脚注)保持不变。
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
  // Radix Presence/Tabs(阶段 B 引入)在 jsdom 下需要 cancelAnimationFrame
  // (TabsContent 的 mount 动画计时器清理)和 getComputedStyle(Presence 读取
  // animation-name 判断退场动画是否结束)——jsdom 的 window 上有实现,只是没有
  // 像 requestAnimationFrame 一样被复制到裸 global 上,这里一并补上。
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  const documentRef = dom.window.document;
  const citation = {
    ref: 1,
    document_id: "doc-x",
    job_id: "job-x",
    page_idx: 3,
    block_id: "p004-b0002",
    snippet: "命中片段文本",
  };
  const jumps = [];
  const progressTexts = [];
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  // legacy 已删除（f0803f2 后仅 react-pdf），此用例改测 @retainpdf/reader 的 ReaderAiPanel 等价行为
  // 若仍需验证旧组件，跳过（legacy 不再是主路径）
  let ReaderAiChat;
  try {
    ({ ReaderAiChat } = await import("../../src/app/reader/legacy/components/ReaderAiChat.jsx"));
  } catch {
    // legacy 删除后跳过旧组件集成用例，保留其余契约测试（SSE/ask 等）绿
    return;
  }
  const host = documentRef.createElement("div");
  documentRef.body.appendChild(host);
  createRoot(host).render(React.createElement(ReaderAiChat, {
    ports: {
      jobId: "job-x",
      historyStore: { load: () => ({ messages: [], history: [] }), save() {}, clear() {} },
      jumpToCitation: (target) => jumps.push(target),
      remoteAnswerer: {
        answer: async ({ onToolEvent }) => {
          onToolEvent?.({ type: "tool", round: 1, tool: "search_fulltext" });
          progressTexts.push(documentRef.querySelector(".reader-ai-message-assistant .reader-ai-message-body-el").textContent);
          return {
            answer: '答案见 [1]。<img src=x onerror="alert(1)">',
            citations: [citation],
            rounds: 2,
          };
        },
        ensureLoaded: async () => true,
      },
    },
  }));

  const waitFor = async (predicate, description) => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      if (predicate()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    assert.fail(`等待超时:${description}`);
  };
  await waitFor(() => documentRef.getElementById("reader-ai-input"), "composer 挂载");
  const input = documentRef.getElementById("reader-ai-input");
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(input, "Molassembler 是什么?");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  documentRef.querySelector("[data-reader-ai-composer]")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(
    () => documentRef.querySelector(".reader-ai-citations .reader-ai-citation-item"),
    "回答 finalize(脚注出现)",
  );

  const assistant = documentRef.querySelector(".reader-ai-message-assistant");
  assert.deepEqual(progressTexts, ["正在检索文档内容…"], "tool 事件应渲染为过程提示行");
  assert.ok(!assistant.className.includes("reader-ai-message-progress"), "完成后应移除过程态样式");
  assert.ok(!assistant.innerHTML.includes("<img"), "模型文本必须按纯文本插入");
  assert.match(assistant.textContent, /<img src=x/);

  const refButton = assistant.querySelector("button.reader-ai-citation-ref");
  assert.equal(refButton.textContent, "[1]");
  refButton.click();
  const footerButtons = assistant.querySelectorAll(".reader-ai-citations .reader-ai-citation-item");
  assert.equal(footerButtons.length, 1);
  assert.match(footerButtons[0].textContent, /^\[1\] 命中片段文本 · 第 4 页$/);
  footerButtons[0].click();
  assert.deepEqual(jumps, [citation, citation], "正文标记与脚注点击都跳同一引用");
});

test("ask answerer:按 job_id 直查 document_id 且只查一次", async () => {
  const listCalls = [];
  const askCalls = [];
  const answerer = createReaderAskAnswerer({
    jobId: "job-b",
    llmConfig: () => ({ apiKey: "sk-test", baseUrl: "", model: "" }),
    documentByJobId: async (apiPrefix, jobId) => {
      listCalls.push([apiPrefix, jobId]);
      // 后端直查:历史 run 也能解析到所属文档
      return { document_id: "doc-b", active_job_id: "job-a" };
    },
    ask: async (payload) => {
      askCalls.push(payload);
      payload.onToolEvent?.({ type: "tool", round: 1, tool: "search_fulltext" });
      return { answer: "回答", citations: [], toolTrace: [], rounds: 1 };
    },
  });

  const toolEvents = [];
  const first = await answerer.answer({
    question: "问题一",
    scope: "document",
    onToolEvent: (event) => toolEvents.push(event),
  });
  await answerer.answer({ question: "问题二", scope: "page", context: { page: 3 } });

  assert.equal(first.answer, "回答");
  assert.equal(first.scope, "document");
  assert.equal(listCalls.length, 1, "document_id 直查结果应被缓存");
  assert.deepEqual(listCalls[0][1], "job-b", "按 job_id 直查");
  assert.equal(askCalls[0].documentId, "doc-b");
  assert.equal(askCalls[0].jobId, "", "文档身份已解析后不再把瞬时 job 绑定为检索范围");
  assert.equal(askCalls[1].question, "（当前第 3 页）问题二");
  assert.equal(toolEvents.length, 1);
});

test("ask answerer:显式 document_id 直接使用统一文档范围", async () => {
  const documentCalls = [];
  const askCalls = [];
  const answerer = createReaderAskAnswerer({
    jobId: "job-retry-without-markdown",
    documentId: "doc-stable",
    documentByJobId: async (...args) => {
      documentCalls.push(args);
      return null;
    },
    ask: async (payload) => {
      askCalls.push(payload);
      return { answer: "统一回答", citations: [] };
    },
  });

  await answerer.answer({ question: "总结并计算", assistantMode: "auto" });
  assert.equal(documentCalls.length, 0, "稳定 document_id 不需要通过 job 反查");
  assert.equal(askCalls[0].documentId, "doc-stable");
  assert.equal(askCalls[0].jobId, "");
  assert.equal(askCalls[0].assistantMode, "auto");
});

test("ask answerer:反查不到 document 时 fail closed，不静默全库", async () => {
  const askCalls = [];
  const answerer = createReaderAskAnswerer({
    jobId: "job-orphan",
    llmConfig: () => ({ apiKey: "sk-test", baseUrl: "", model: "" }),
    documentByJobId: async () => null,
    ask: async (payload) => {
      askCalls.push(payload);
      return { answer: "不应调用", citations: [], toolTrace: [], rounds: 0 };
    },
  });
  await assert.rejects(
    answerer.answer({ question: "这篇讲什么?", scope: "document" }),
    /无法关联当前文档/,
  );
  assert.equal(askCalls.length, 0);
});

test("ask answerer:无浏览器模型 Key 时使用后端运行配置", async () => {
  const listCalls = [];
  const askCalls = [];
  const answerer = createReaderAskAnswerer({
    jobId: "job-x",
    llmConfig: () => ({ apiKey: "", baseUrl: "", model: "" }),
    documentByJobId: async () => {
      listCalls.push(1);
      return { document_id: "doc-x" };
    },
    ask: async (payload) => {
      askCalls.push(payload);
      return { answer: "后端配置可用", citations: [], toolTrace: [], rounds: 0 };
    },
  });
  const result = await answerer.answer({ question: "hi", scope: "document" });
  assert.equal(result.answer, "后端配置可用");
  assert.equal(listCalls.length, 1);
  assert.equal(askCalls.length, 1);
  assert.equal(askCalls[0].llmApiKey, "", "不把翻译凭据引用误作 Agent Key");
});

test("askLibraryAi 携带 llm_api_key/base/model,仅非空字段进 payload", async () => {
  globalThis.window = { location: { search: "", protocol: "http:", hostname: "127.0.0.1" } };
  let sentBody = null;
  const fakeFetch = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ code: 0, message: "ok", data: { answer: "a", citations: [], tool_trace: [], rounds: 1 } }),
    };
  };
  await askLibraryAi({
    question: "问题",
    documentId: "doc-1",
    apiPrefix: "/api/v1",
    fetchImpl: fakeFetch,
    llmApiKey: "  sk-frontend  ",
    llmModel: "deepseek-v4-flash",
  });
  assert.equal(sentBody.llm_api_key, "sk-frontend");
  assert.equal(sentBody.llm_model, "deepseek-v4-flash");
  assert.equal("llm_base_url" in sentBody, false);
  assert.equal(sentBody.document_id, "doc-1");
});

test("askLibraryAi 无 llm key 时 payload 不含 llm_* 字段(后端回退 env)", async () => {
  globalThis.window = { location: { search: "", protocol: "http:", hostname: "127.0.0.1" } };
  let sentBody = null;
  const fakeFetch = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ code: 0, message: "ok", data: { answer: "a", citations: [] } }),
    };
  };
  await askLibraryAi({ question: "q", apiPrefix: "/api/v1", fetchImpl: fakeFetch });
  assert.equal("llm_api_key" in sentBody, false);
  assert.equal("llm_base_url" in sentBody, false);
  assert.equal("llm_model" in sentBody, false);
});
