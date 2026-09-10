import test from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

const {
  ReaderAgentOperationPanel,
  readerAgentOperationDismissalKey,
} = await import(
  "../../../../frontend/packages/reader/src/components/react-pdf/assistant/ReaderAgentOperationPanel.tsx"
);
const { shouldReplaceAgentOperation } = await import(
  "../../../../frontend/packages/reader/src/components/react-pdf/assistant/use-reader-agent-operations.ts"
);

function operation(status, overrides = {}) {
  return {
    schema: "retainpdf_agent_operation_view_v1",
    operation_id: `op-${status}`,
    conversation_id: "conv-reader-agent",
    request_message_id: "msg-reader-agent",
    document_id: "doc-reader-agent",
    intent_summary: "将第 4 页旋转 180°",
    plan_steps: [{ op: "rotate_pages", pages: [4], degrees: 180 }],
    affected_pages: [4],
    status,
    current_attempt: 1,
    program_sha256: "sha-test",
    candidate_available: status === "result_ready" || status === "committed",
    candidate: null,
    latest_event_seq: 1,
    allowed_actions: [],
    events: [],
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function renderPanel(status, confirmationMode) {
  return renderToStaticMarkup(createElement(ReaderAgentOperationPanel, {
    entries: [{ operation: operation(status) }],
    confirmationMode,
    runtimeRestarting: false,
    loadCandidate: async () => new Blob(["candidate"], { type: "application/pdf" }),
    onAction() {},
  }));
}

test("Reader explicit mode renders direct operation API actions instead of asking for confirmation text", () => {
  const html = renderPanel("draft", "explicit");
  assert.match(html, /需要确认 · 操作前等待授权/);
  assert.match(html, /确认执行/);
  assert.match(html, /拒绝/);
  assert.doesNotMatch(html, /请输入|回复.*确认/);
});

test("Reader green-light mode exposes automatic application state and keeps operation controls separate", () => {
  const running = renderPanel("running", "green_light");
  assert.match(running, /绿灯模式 · 自动执行并应用/);
  assert.match(running, /正在执行/);
  assert.match(running, /取消 PDF 操作/);

  const committed = renderPanel("committed", "green_light");
  assert.match(committed, /AI 已直接应用/);
  assert.doesNotMatch(committed, /确认执行/);
});

test("failed Reader operation can be acknowledged once and stays hidden after remount", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/reader.html",
    pretendToBeVisual: true,
  });
  const previous = Object.fromEntries([
    "window",
    "document",
    "localStorage",
    "HTMLElement",
    "Node",
    "Event",
    "MouseEvent",
  ].map((key) => [key, globalThis[key]]));
  for (const key of Object.keys(previous)) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
      writable: true,
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const props = {
    entries: [{ operation: operation("failed") }],
    confirmationMode: "explicit",
    runtimeRestarting: false,
    loadCandidate: async () => new Blob(["candidate"], { type: "application/pdf" }),
    onAction() {},
  };
  const container = document.getElementById("root");
  let root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(ReaderAgentOperationPanel, props));
    });
    const dismiss = document.querySelector("button[aria-label='隐藏这条失败提示']");
    assert.ok(dismiss, "失败卡应提供一次性隐藏入口");
    await act(async () => {
      dismiss.click();
    });
    assert.equal(document.querySelector(".reader-agent-operation-card"), null);

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(ReaderAgentOperationPanel, props));
    });
    assert.equal(document.querySelector(".reader-agent-operation-card"), null);
  } finally {
    await act(async () => root.unmount());
    for (const [key, value] of Object.entries(previous)) {
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  }
});

test("dismissal identity reopens a later retry attempt", () => {
  const failedAttemptOne = operation("failed", { current_attempt: 1 });
  const failedAttemptTwo = operation("failed", { current_attempt: 2 });
  assert.notEqual(
    readerAgentOperationDismissalKey(failedAttemptOne),
    readerAgentOperationDismissalKey(failedAttemptTwo),
  );
});

test("identical operation polls do not replace local pending or error state", () => {
  const current = operation("running");
  assert.equal(shouldReplaceAgentOperation(current, { ...current }), false);
  assert.equal(shouldReplaceAgentOperation(current, {
    ...current,
    latest_event_seq: 2,
  }), true);
});
