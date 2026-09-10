import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

test("Reader AI 加载已有会话后快照稳定，composer 仍可输入", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/reader.html?job_id=job-input",
    pretendToBeVisual: true,
  });
  for (const key of [
    "window",
    "document",
    "localStorage",
    "location",
    "Element",
    "HTMLElement",
    "HTMLTextAreaElement",
    "Event",
    "MouseEvent",
    "Node",
    "NodeFilter",
    "MutationObserver",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      writable: true,
      configurable: true,
    });
  }
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.HTMLElement.prototype.scrollTo = function scrollTo(options) {
    this.scrollTop = typeof options === "number" ? options : Number(options?.top || 0);
  };
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const now = "2026-08-23T00:00:00Z";
  const conversation = {
    conversation_id: "conv-input",
    document_id: "doc-input",
    title: "已有问答",
    created_at: now,
    updated_at: now,
    message_count: 2,
    head_id: "a-input",
  };
  localStorage.setItem(
    "retainpdf.reader.ai.conversation.v1:job:job-input",
    "conv-input",
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = `${input}`;
    const payload = url.includes("/ai/conversations/conv-input")
      ? {
          ...conversation,
          messages: [
            {
              message_id: "u-input",
              conversation_id: "conv-input",
              seq: 1,
              role: "user",
              content: "旧问题",
              created_at: now,
              parent_id: "",
            },
            {
              message_id: "a-input",
              conversation_id: "conv-input",
              seq: 2,
              role: "assistant",
              content: "旧回答",
              created_at: now,
              parent_id: "u-input",
            },
          ],
        }
      : { conversations: [conversation] };
    return new Response(JSON.stringify({ code: 0, message: "ok", data: payload }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const { createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { setReaderAdapters } = await import("../../../../frontend/packages/reader/src/adapters.ts");
  const { ReaderAiPanel } = await import(
    "../../../../frontend/packages/reader/src/components/react-pdf/ReaderAiPanel.tsx"
  );
  setReaderAdapters({
    apiPrefix: "/api/v1",
    credentialsPort: {
      getCredentials: () => ({ modelApiKey: "test-model-key" }),
    },
    fetchDocumentByJobId: async () => ({ document_id: "doc-input" }),
    askDocumentAi: async () => ({ answer: "ok", citations: [] }),
  });

  const root = createRoot(document.getElementById("root"));
  try {
    root.render(createElement(ReaderAiPanel, {
      open: true,
      jobId: "job-input",
      onClose() {},
      onJumpCitation() {},
    }));
    await waitFor(() => document.body.textContent.includes("旧回答"), "加载已有回答");
    const input = document.querySelector("textarea.aui-input");
    assert.ok(input, "应渲染 AI composer");
    assert.equal(input.disabled, false);

    const valueSetter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLTextAreaElement.prototype,
      "value",
    ).set;
    valueSetter.call(input, "只根据 Markdown 回答");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await waitFor(
      () => document.querySelector("button[aria-label='发送']")?.disabled === false,
      "React 接收 composer 输入",
    );
    assert.equal(input.value, "只根据 Markdown 回答");
    assert.equal(document.body.textContent.includes("旧回答"), true);

    document.querySelector("button[aria-label='发送']").click();
    await waitFor(
      () => document.body.textContent.includes("只根据 Markdown 回答")
        && document.body.textContent.includes("ok"),
      "发送 Markdown 问答",
    );
  } finally {
    root.unmount();
    setReaderAdapters(null);
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
