// React 根的出错回调：组件栈经桌面桥写进 desktop-main.log（排查 #185 这类只给一个数字的错误）。
import test from "node:test";
import assert from "node:assert/strict";

const {
  reactRootErrorOptions,
  rendererIssuePayload,
  reportRendererIssue,
} = await import("../../src/platform/desktop/renderer-issue.js");

test("上报内容：错误名 + 信息、调用栈、组件栈", () => {
  const error = new Error("Maximum update depth exceeded");
  const payload = rendererIssuePayload("react-caught", error, "\n    at SettingsDialog\n    at HomeApp");
  assert.equal(payload.type, "react-caught");
  assert.equal(payload.message, "Error: Maximum update depth exceeded");
  assert.match(payload.stack, /Maximum update depth exceeded/);
  assert.match(payload.componentStack, /at SettingsDialog/);
});

test("太长的栈截断，非 Error 也能报", () => {
  const payload = rendererIssuePayload("react-uncaught", "boom", "x".repeat(10000));
  assert.equal(payload.message, "boom");
  assert.equal(payload.stack, "");
  assert.ok(payload.componentStack.length <= 4001);
});

test("有桥才上报；桥自己出错不往外抛", () => {
  const sent = [];
  reportRendererIssue("react-caught", new Error("a"), "stack", { reportRendererIssue: (p) => sent.push(p) });
  assert.equal(sent.length, 1);
  assert.doesNotThrow(() => reportRendererIssue("react-caught", new Error("b"), "", undefined));
  assert.doesNotThrow(() => reportRendererIssue("react-caught", new Error("c"), "", {
    reportRendererIssue: () => { throw new Error("ipc down"); },
  }));
});

test("createRoot 回调：接住的打控制台并上报组件栈", () => {
  const sent = [];
  const previousBridge = globalThis.retainPdfDesktop;
  const previousError = console.error;
  const logged = [];
  globalThis.retainPdfDesktop = { reportRendererIssue: (p) => sent.push(p) };
  console.error = (...args) => logged.push(args);
  try {
    reactRootErrorOptions().onCaughtError(new Error("caught"), { componentStack: "\n    at Probe" });
  } finally {
    globalThis.retainPdfDesktop = previousBridge;
    console.error = previousError;
  }
  assert.equal(logged.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "react-caught");
  assert.match(sent[0].componentStack, /at Probe/);
});
