import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { wait, waitFor } from "../helpers/async.mjs";

// ProcessingChoicePanel：提交按钮常显 + 禁用原因与下一步指引行。

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "DocumentFragment", "HTMLElement", "HTMLButtonElement", "HTMLFormElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { ProcessingChoicePanel } = await import("../../src/features/ingest/ui/components/upload/ProcessingChoicePanel.jsx");
const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

function baseProps(overrides = {}) {
  return {
    visible: true,
    uploadReady: false,
    submitBusy: false,
    submitDisabled: true,
    submitLabel: "直接翻译",
    ocrOnly: false,
    pageRangeButtonVisible: true,
    pageRangeOpen: false,
    onToggleTranslationOptions: () => {},
    onStoreOnly: () => {},
    translationOptionsSlot: null,
    ...overrides,
  };
}

async function renderPanel(props) {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(ProcessingChoicePanel, props));
  await waitFor(() => host.querySelector("#submit-btn") !== null, "提交按钮渲染");
  await wait(0);
  return { host, root };
}

test("缺文件：按钮禁用但可见，title 说明原因；不再额外出 hint 行（拖放区已说清）", async () => {
  const { host, root } = await renderPanel(baseProps());
  const submitBtn = host.querySelector("#submit-btn");
  assert.equal(submitBtn.disabled, true);
  assert.match(submitBtn.getAttribute("title") || "", /选择 PDF/);
  // 旧行为：底部再冒一行无样式的「请先选择 PDF 文件…再提交任务。选择文件」，
  // 和上方拖放区的「单个 PDF / 最大 512MB」同屏说两遍。
  // 注意别直接 assert.equal(element, null)：失败时 inspect 整个 JSDOM 节点会把进程撑爆。
  assert.equal(host.querySelector("#submit-hint")?.textContent ?? null, null);
  assert.equal(submitBtn.getAttribute("aria-describedby"), null);

  root.unmount();
  host.remove();
});

test("上传中（文件已选、未就绪）：同样不出 hint 行，进度在拖放区里", async () => {
  const { host, root } = await renderPanel(baseProps({ uploadReady: false, submitDisabled: true }));
  assert.equal(host.querySelector("#submit-hint")?.textContent ?? null, null);
  root.unmount();
  host.remove();
});

test("已上传被拦：hint 指引补凭据并可一键打开设置", async () => {
  const { host, root } = await renderPanel(baseProps({ uploadReady: true, submitDisabled: true }));
  const submitBtn = host.querySelector("#submit-btn");
  assert.equal(submitBtn.disabled, true);
  assert.match(submitBtn.getAttribute("title") || "", /接口设置/);

  const hint = host.querySelector("#submit-hint");
  assert.ok(hint);
  assert.match(hint.textContent, /接口设置/);
  assert.match(hint.textContent, /术语表/);

  let settingsOpened = 0;
  const onOpen = () => { settingsOpened += 1; };
  dom.window.document.addEventListener(APP_EVENTS.openBrowserCredentials, onOpen);
  hint.querySelector(".submit-hint-action").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true }),
  );
  await wait(0);
  dom.window.document.removeEventListener(APP_EVENTS.openBrowserCredentials, onOpen);
  assert.equal(settingsOpened, 1, "hint 动作把用户带到凭据设置");

  root.unmount();
  host.remove();
});

test("可提交时：无 hint，按钮文案与 title 保持原样", async () => {
  const { host, root } = await renderPanel(baseProps({ uploadReady: true, submitDisabled: false }));
  const submitBtn = host.querySelector("#submit-btn");
  assert.equal(submitBtn.disabled, false);
  assert.equal(submitBtn.getAttribute("aria-describedby"), null);
  assert.equal(host.querySelector("#submit-hint"), null);
  assert.match(submitBtn.textContent.trim(), /直接翻译/);

  root.unmount();
  host.remove();
});
