import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// 已有书再翻译链(B4):selectJob 有 document_id 时只开详情不开上传框;
// 详情翻译提交后进度接在 #book-detail-status-section,网格静默不闪 loading。
//
// 风格沿用 book-detail-dialog-component.test.mjs:每条用例一份全新 JSDOM
// (同一 jsdom 第二次 createRoot 会停摆),click 补 mousedown 贴近 Radix。

function makeDom(search = "") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
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
  return dom;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) {
      return value;
    }
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

test("有 document_id 点卡开详情,不开上传框", async () => {
  const dom = makeDom();
  const { createLibraryController } = await import(
    "../../src/features/library/domain/controller.js"
  );
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

  const dispatched = [];
  const card = {
    job_id: "job-42",
    active_job_id: "job-42",
    document_id: "doc-42",
    title: "已有书",
    status: "succeeded",
    library_only: false,
  };
  const controller = createLibraryController({
    documentRef: {
      dispatchEvent: (event) => {
        dispatched.push(event?.type);
        return true;
      },
    },
    libraryEventPort: { publishJobUpdated: () => {} },
    reloadRecentJobs: () => {},
    startPolling: () => {},
    hideStatusArea: () => {},
    recentJobsStatePort: { getSnapshot: () => ({ items: [card] }) },
  });

  controller.selectJob("job-42");

  const state = controller.bookDetailStore.getState();
  assert.equal(state.open, true, "selectJob 应打开书籍详情");
  assert.equal(state.payload?.document_id, "doc-42", "详情应绑定原文档");
  assert.equal(state.payload?.prefer_translate_tab, true, "网格选中应进详情处理 Tab");
  assert.ok(
    !dispatched.includes(APP_EVENTS.openTranslationWorkflow),
    "有 document_id 不得 dispatch openTranslationWorkflow(不弹上传框)",
  );
  assert.equal(
    dom.window.document.getElementById("translation-workflow-dialog"),
    null,
    "详情链路不得挂载上传对话框",
  );

  // 网格暂时找不到行:仍开详情壳 + 静默轮询,一样不弹旧窗。
  const before = dispatched.length;
  controller.selectJobForDetail("job-missing", {});
  const missing = controller.bookDetailStore.getState();
  assert.equal(missing.open, true);
  assert.equal(missing.payload?.job_id, "job-missing");
  assert.equal(dispatched.length, before, "兜底路径同样不得弹上传框");
});

test("详情翻译提交接进度:静默 attach + 状态区占位,不弹上传框", async () => {
  const dom = makeDom();
  const { createLibraryController } = await import(
    "../../src/features/library/domain/controller.js"
  );

  // —— 提交即静默接进度:只写 statusCardStore,不抬工作流区,不整页 reload ——
  const polls = [];
  let reloadCalls = 0;
  const controller = createLibraryController({
    documentRef: { dispatchEvent: () => true },
    libraryEventPort: { publishJobUpdated: () => {} },
    reloadRecentJobs: () => { reloadCalls += 1; },
    startPolling: (jobId, options) => polls.push([jobId, options]),
    hideStatusArea: () => {},
    recentJobsStatePort: { getSnapshot: () => ({ items: [] }) },
  });
  controller.attachJobProgress("job-new");
  assert.deepEqual(polls, [[
    "job-new",
    { silent: true, showWorkflow: false, publishLibrary: false, recovering: false },
  ]]);
  assert.equal(reloadCalls, 0, "attach 不得触发整页 reload(网格不闪 loading)");

  // —— 提交中状态区先行占位:busy=translate 即挂载详情状态区 ——
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { HomeServicesProvider } = await import(
    "../../src/app/home/home-services-context.js"
  );
  const { BookTranslationWorkflowPanel } = await import(
    "../../src/features/book-detail/ui/panels/translate/WorkflowPanel.jsx"
  );

  const fakeServices = {
    library: { actions: {} },
    statusCard: {
      store: { getSnapshot: () => ({ snapshot: {} }), subscribe: () => () => {} },
    },
    statusArea: { isVisible: () => false, setVisible: () => {} },
    statusDetail: { controller: { openStatusDetailDialog: () => {} } },
  };
  const noop = () => {};
  const baseProps = {
    item: {},
    status: { label: "未翻译", tone: "muted" },
    canTranslate: true,
    isActive: false,
    tabActive: true,
    dialogOpen: true,
    rangeOn: false,
    startPage: "",
    endPage: "",
    busy: "translate",
    error: "",
    stageActions: [],
    onRangeOnChange: noop,
    onStartPageChange: noop,
    onEndPageChange: noop,
    onTranslate: noop,
    onRetryStage: async () => {},
  };

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    React.createElement(
      HomeServicesProvider,
      { value: fakeServices },
      React.createElement(BookTranslationWorkflowPanel, baseProps),
    ),
  );
  await waitFor(
    () => dom.window.document.getElementById("book-detail-status-section"),
    "提交中详情状态区占位",
  );
  assert.equal(
    dom.window.document.getElementById("translation-workflow-dialog"),
    null,
    "进度在详情,不弹上传框",
  );
  root.unmount();
  host.remove();

  // —— 空闲对照:无 job 且非提交中不占状态区 ——
  const idleHost = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(idleHost);
  const idleRoot = createRoot(idleHost);
  idleRoot.render(
    React.createElement(
      HomeServicesProvider,
      { value: fakeServices },
      React.createElement(BookTranslationWorkflowPanel, { ...baseProps, busy: "" }),
    ),
  );
  await wait(50);
  assert.equal(
    dom.window.document.getElementById("book-detail-status-section"),
    null,
    "空闲态不占用进度区域",
  );
  idleRoot.unmount();
  idleHost.remove();
});
