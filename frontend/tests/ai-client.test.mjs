import test from "node:test";
import assert from "node:assert/strict";

// Cho phép isMockMode()/apiBase() của config/runtime.js hoạt động trong node (không cần jsdom)
globalThis.window = globalThis.window || { location: { search: "", protocol: "http:", hostname: "127.0.0.1" } };

const { AiAskError, askLibraryAi, readAiAskStream } = await import("../src/js/api/ai.js");
const { setRuntimeConfig } = await import("../src/js/config/runtime.js");
const { buildScopedQuestion, createReaderAskAnswerer } = await import("../src/js/reader/ai/ask-answerer.js");

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

// ===== Phân tích dòng SSE (hợp đồng luồng /api/v1/ai/ask) =====

test("readAiAskStream:sự kiện tool gọi lại theo thứ tự, sự kiện done trả về kết quả chuẩn hóa", async () => {
  const toolEvents = [];
  // Sự kiện cắt ngang chunk + CRLF + dòng không phải data, xác minh logic đệm
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

test("readAiAskStream:sự kiện error ném AiAskError", async () => {
  await assert.rejects(
    readAiAskStream(sseStream([
      'data: {"type": "tool", "round": 1, "tool": "search_fulltext", "arguments": {}}\n\n',
      'data: {"type": "error", "message": "上游模型超时"}\n\n',
    ])),
    (error) => error instanceof AiAskError && /上游模型超时/.test(error.message),
  );
});

test("readAiAskStream:luồng bị gián đoạn (không có done) ném lỗi có thể thử lại", async () => {
  await assert.rejects(
    readAiAskStream(sseStream([
      'data: {"type": "tool", "round": 1, "tool": "read_blocks", "arguments": {}}\n\n',
    ])),
    (error) => error instanceof AiAskError && /中断/.test(error.message),
  );
});

test("readAiAskStream:dòng done không có xuống dòng ở cuối cũng phân tích được", async () => {
  const result = await readAiAskStream(sseStream([
    'data: {"type": "done", "answer": "ok", "citations": [], "tool_trace": [], "rounds": 1}',
  ]));
  assert.equal(result.answer, "ok");
});

// ===== askLibraryAi:xây dựng yêu cầu và phân cấp lỗi =====

test("askLibraryAi:mang theo X-API-Key, body chứa question/document_id/job_id/stream", async () => {
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

test("askLibraryAi:502 ném lỗi dịch vụ AI chưa chạy kèm status", async () => {
  await assert.rejects(
    askLibraryAi({
      question: "hi",
      fetchImpl: async () => ({ ok: false, status: 502, text: async () => "" }),
    }),
    (error) => error instanceof AiAskError && error.status === 502 && /Dịch vụ AI chưa chạy/.test(error.message),
  );
});

test("askLibraryAi:401 phân tích chi tiết FastAPI và đề xuất X-API-Key", async () => {
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

test("askLibraryAi:400 thiếu LLM key thì truyền qua/đưa về văn bản có thể đọc", async () => {
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

test("askLibraryAi:bao bì JSON envelope phi luồng dự phòng giải nén", async () => {
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

// ===== ask-answerer:document_id tra ngược bộ nhớ cache và tiền tố scope =====

test("buildScopedQuestion:phạm vi trang/vùng chọn ghi vào văn bản question bằng tiền tố", () => {
  assert.equal(buildScopedQuestion({ question: "总结一下", scope: "document" }), "总结一下");
  assert.equal(
    buildScopedQuestion({ question: "总结一下", scope: "page", context: { page: 4 } }),
    "(Trang hiện tại 4) Tóm tắt",
  );
  assert.equal(
    buildScopedQuestion({
      question: "解释这段",
      scope: "selection",
      context: { page: 2, rect: {} },
      resolveQuote: () => ({ quoteText: "选中的  原文\n片段" }),
    }),
    "(Dành cho đoạn văn bản gốc đã chọn: «đoạn văn bản gốc đã chọn») Giải thích đoạn này",
  );
  assert.equal(
    buildScopedQuestion({ question: "解释这段", scope: "selection", context: { page: 2 }, resolveQuote: () => null }),
    "(Dành cho nội dung vùng chọn ở trang 2) Giải thích đoạn này",
  );
});

// ===== chat render:trích dẫn có thể nhấp, văn bản mô hình không tiêm HTML =====

test("chat:render trả lời agentic [n] trích dẫn có thể nhấp và chú thích, văn bản mô hình an toàn XSS", async () => {
  // Giai đoạn 2b:UI hỏi đáp AI chuyển vào React (ReaderAiChat), bài test này đổi sang render component,
  // điều khiển bằng DOM submit; ngữ nghĩa render assertion (tiến trình/XSS/nút trích dẫn/chú thích) giữ nguyên.
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
  // Radix Presence/Tabs (giới thiệu giai đoạn B) cần cancelAnimationFrame trong jsdom
  // (dọn dẹp bộ hẹn giờ mount animation của TabsContent) và getComputedStyle (Presence đọc
  // animation-name xác định animation thoát kết thúc) — jsdom window có implement, chỉ là không
  // được sao chép vào global như requestAnimationFrame, bù đắp ở đây.
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
  const { ReaderAiChat } = await import("../src/pages/reader/legacy/components/ReaderAiChat.jsx");
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
    assert.fail(`Hết thời gian chờ:${description}`);
  };
  await waitFor(() => documentRef.getElementById("reader-ai-input"), "mount composer");
  const input = documentRef.getElementById("reader-ai-input");
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(input, "Molassembler là gì?");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  documentRef.querySelector("[data-reader-ai-composer]")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(
    () => documentRef.querySelector(".reader-ai-citations .reader-ai-citation-item"),
    "trả lời finalize (chú thích xuất hiện)",
  );

  const assistant = documentRef.querySelector(".reader-ai-message-assistant");
  assert.deepEqual(progressTexts, ["Đang tìm kiếm nội dung tài liệu…"], "sự kiện tool nên render thành dòng tiến trình");
  assert.ok(!assistant.className.includes("reader-ai-message-progress"), "hoàn thành nên xóa trạng thái tiến trình");
  assert.ok(!assistant.innerHTML.includes("<img"), "văn bản mô hình phải chèn dạng plain text");
  assert.match(assistant.textContent, /<img src=x/);

  const refButton = assistant.querySelector("button.reader-ai-citation-ref");
  assert.equal(refButton.textContent, "[1]");
  refButton.click();
  const footerButtons = assistant.querySelectorAll(".reader-ai-citations .reader-ai-citation-item");
  assert.equal(footerButtons.length, 1);
  assert.match(footerButtons[0].textContent, /^\[1\] 命中片段文本 · 第 4 页$/);
  footerButtons[0].click();
  assert.deepEqual(jumps, [citation, citation], "đánh dấu văn bản và nhấp chú thích đều nhảy cùng trích dẫn");
});

test("ask answerer:tra job_id trực tiếp document_id và chỉ tra một lần", async () => {
  const listCalls = [];
  const askCalls = [];
  const answerer = createReaderAskAnswerer({
    jobId: "job-b",
    llmConfig: () => ({ apiKey: "sk-test", baseUrl: "", model: "" }),
    documentByJobId: async (apiPrefix, jobId) => {
      listCalls.push([apiPrefix, jobId]);
      // Tra ngược trực tiếp backend:lịch sử run cũng phân tích được tài liệu thuộc về
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
    question: "Câu hỏi một",
    scope: "document",
    onToolEvent: (event) => toolEvents.push(event),
  });
  await answerer.answer({ question: "问题二", scope: "page", context: { page: 3 } });

  assert.equal(first.answer, "回答");
  assert.equal(first.scope, "document");
  assert.equal(listCalls.length, 1, "kết quả tra document_id nên được cache");
  assert.deepEqual(listCalls[0][1], "job-b", "tra theo job_id");
  assert.equal(askCalls[0].documentId, "doc-b");
  assert.equal(askCalls[0].jobId, "job-b");
  assert.equal(askCalls[1].question, "(Trang hiện tại 3) Câu hỏi hai");
  assert.equal(toolEvents.length, 1);
});

test("ask answerer:tra ngược không thấy document thì fail closed, không im lặng toàn thư viện", async () => {
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
    /Không thể liên kết với tài liệu hiện tại/,
  );
  assert.equal(askCalls.length, 0);
});

test("ask answerer:không có model Key thì không tra tài liệu, không gửi ask", async () => {
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
      return { answer: "不应调用", citations: [], toolTrace: [], rounds: 0 };
    },
  });
  await assert.rejects(
    answerer.answer({ question: "hi", scope: "document" }),
    /Thiếu API Key của model/,
  );
  assert.equal(listCalls.length, 0, "thiếu Key không được tra tài liệu trước");
  assert.equal(askCalls.length, 0, "thiếu Key không được gửi ask");
});

test("askLibraryAi mang theo llm_api_key/base/model, chỉ trường không null vào payload", async () => {
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

test("askLibraryAi không có llm key thì payload không chứa trường llm_* (backend fallback env)", async () => {
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
