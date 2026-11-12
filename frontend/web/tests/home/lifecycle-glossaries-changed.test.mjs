// 书的术语页「存为我的术语表」以后发 glossariesChanged：提交窗口的术语表下拉只读过一次列表，
// 主页 lifecycle 收到事件要让它强制重读，否则新表要刷新页面才出现在下拉里。dispose 以后不再响应。
import test from "node:test";
import assert from "node:assert/strict";

import { makeDom } from "../helpers/dom.mjs";

test("glossariesChanged → 提交窗口术语表下拉强制重读；dispose 后解绑", async () => {
  const dom = makeDom("");
  const { createLifecycle } = await import("../../src/app/home/composition/create-lifecycle.js");
  const { APP_EVENTS } = await import("../../src/platform/contracts/app-contract.js");
  const loads = [];
  const features = {
    workflowFeature: { loadGlossaryOptions: (options) => { loads.push(options); return Promise.resolve([]); } },
    jobRuntimeFeature: { startPolling() {}, stopPolling() {}, retryStage() {}, returnToHome() {} },
  };
  const lifecycle = createLifecycle({
    features,
    bridge: new Proxy({}, { get: () => () => {} }),
    documentRef: dom.window.document,
  });
  try {
    lifecycle.initialize();
    dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.glossariesChanged));
    assert.deepEqual(loads, [{ force: true }]);
    lifecycle.dispose();
    dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.glossariesChanged));
    assert.equal(loads.length, 1, "dispose 以后还在响应");
  } finally {
    dom.window.close();
  }
});
