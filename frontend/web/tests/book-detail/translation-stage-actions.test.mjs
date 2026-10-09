import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom as makeDomWith } from "../helpers/dom.mjs";

// 组件直接挂进 #root，并且用到了 SVG 图标（SVGElement）。
const makeDom = () => makeDomWith("", {
  html: "<!doctype html><html><body><div id='root'></div></body></html>",
  keys: [
    "window", "document", "HTMLElement", "HTMLInputElement", "HTMLButtonElement", "Element",
    "SVGElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node",
    "MutationObserver", "NodeFilter",
  ],
});

const click = (dom, element) => clickWithMouseDown(dom, element, { cancelable: true });

test("不明确的翻译阶段必须二次确认重复调用风险", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { TranslationStageActions } = await import(
    "../../src/features/book-detail/ui/panels/translate/TranslationStageActions.jsx"
  );
  const calls = [];
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(TranslationStageActions, {
    actions: [{
      stage: "translation",
      label: "重试翻译",
      can_retry: true,
      danger: true,
      disabled_reason: "request outcome is ambiguous",
    }],
    onRetry: async (...args) => calls.push(args),
  }));

  const retryButton = await waitFor(
    () => dom.window.document.getElementById("book-detail-retry-translation-btn"),
    "重新翻译按钮",
  );
  click(dom, retryButton);
  await waitFor(
    () => dom.window.document.getElementById("book-detail-translation-risk-confirm"),
    "重复风险确认框",
  );
  assert.equal(calls.length, 0, "打开确认框不能直接提交");
  click(dom, dom.window.document.getElementById("book-detail-translation-risk-confirm-confirm"));
  await waitFor(() => calls.length === 1, "确认后提交");
  assert.deepEqual(calls[0], ["translation", { acceptDuplicateRisk: true }]);

  root.unmount();
  dom.window.close();
});

test("阶段能力读取期间固定展示重新翻译和重新渲染按钮", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { TranslationStageActions } = await import(
    "../../src/features/book-detail/ui/panels/translate/TranslationStageActions.jsx"
  );
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(TranslationStageActions, {
    actions: [],
    loading: true,
    onRetry: async () => {},
  }));

  const translation = await waitFor(
    () => dom.window.document.getElementById("book-detail-retry-translation-btn"),
    "加载态重新翻译按钮",
  );
  const render = dom.window.document.getElementById("book-detail-retry-render-btn");
  assert.ok(render, "加载态同时保留重新渲染按钮");
  assert.equal(translation.disabled, true);
  assert.equal(render.disabled, true);
  assert.equal(translation.textContent.trim(), "重新翻译");
  assert.equal(render.textContent.trim(), "重新渲染");
  assert.equal(
    dom.window.document.querySelector('[data-translation-stage-actions="true"]')?.getAttribute("aria-busy"),
    "true",
  );

  root.unmount();
  dom.window.close();
});

test("精修译文：先弹确认（说明会花钱、可退回），确认后按 refine 提交，不带重复风险标记", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { TranslationStageActions } = await import(
    "../../src/features/book-detail/ui/panels/translate/TranslationStageActions.jsx"
  );
  const calls = [];
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(TranslationStageActions, {
    actions: [
      { stage: "render", label: "重新渲染", can_retry: true },
      { stage: "refine", label: "精修译文", can_retry: true },
    ],
    onRetry: async (...args) => calls.push(args),
  }));

  const refineButton = await waitFor(
    () => dom.window.document.getElementById("book-detail-retry-refine-btn"),
    "精修按钮",
  );
  assert.equal(refineButton.textContent.trim(), "精修译文");
  click(dom, refineButton);
  const confirm = await waitFor(
    () => dom.window.document.getElementById("book-detail-translation-risk-confirm"),
    "精修确认框",
  );
  assert.match(confirm.textContent, /精修译文/);
  assert.match(confirm.textContent, /不会重新翻译整本/);
  assert.equal(calls.length, 0, "打开确认框不能直接提交");
  click(dom, dom.window.document.getElementById("book-detail-translation-risk-confirm-confirm"));
  await waitFor(() => calls.length === 1, "确认后提交");
  assert.deepEqual(calls[0], ["refine", undefined]);

  root.unmount();
  dom.window.close();
});

test("精修：失败任务也不走断点恢复，直接 retry-stage(refine) 原地执行", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useBookDetailStageActions } = await import(
    "../../src/features/book-detail/ui/use-book-detail-stage-actions.js"
  );
  const calls = [];
  const submitted = [];
  let api = null;
  function Probe() {
    api = useBookDetailStageActions({
      open: true,
      job: { job_id: "job-refine-1", status: "failed", document_id: "doc-1" },
      actions: {
        getJobStageActions: async () => ({
          job_id: "job-refine-1",
          stages: [{ stage: "refine", label: "精修译文", can_retry: true, action: { body: { stage: "refine" } } }],
        }),
        retryJobStage: async (...args) => {
          calls.push(["retry", ...args]);
          return { job_id: "job-refine-1", workflow: "render" };
        },
        resumeJob: async (...args) => {
          calls.push(["resume", ...args]);
          return { job_id: "job-resumed" };
        },
      },
      onJobSubmitted: (job) => submitted.push(job),
    });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Probe));
  await waitFor(() => api?.stageActions?.some((action) => action.stage === "refine"), "读到精修能力");
  await api.retry("refine");
  assert.deepEqual(calls, [[
    "retry",
    "job-refine-1",
    "refine",
    { stage: "refine", create_new_job: false, document_id: "doc-1" },
  ]]);
  assert.equal(submitted[0].workflow, "render");

  root.unmount();
  dom.window.close();
});

test("重新渲染：可选排版引擎，选了就带 overrides.render.engine 且不走断点恢复；不选沿用原引擎", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useBookDetailStageActions } = await import(
    "../../src/features/book-detail/ui/use-book-detail-stage-actions.js"
  );
  const { TranslationStageActions } = await import(
    "../../src/features/book-detail/ui/panels/translate/TranslationStageActions.jsx"
  );
  const calls = [];
  function Probe() {
    const api = useBookDetailStageActions({
      open: true,
      job: { job_id: "job-render-1", status: "failed", document_id: "doc-1" },
      actions: {
        getJobStageActions: async () => ({
          job_id: "job-render-1",
          stages: [{ stage: "render", label: "重新渲染", can_retry: true, action: { body: { stage: "render", create_new_job: false } } }],
        }),
        retryJobStage: async (...args) => {
          calls.push(["retry", ...args]);
          return { job_id: "job-render-1", workflow: "render" };
        },
        resumeJob: async (...args) => {
          calls.push(["resume", ...args]);
          return { job_id: "job-render-1" };
        },
      },
    });
    return React.createElement(TranslationStageActions, {
      actions: api.stageActions,
      loading: api.loading,
      pendingStage: api.pendingStage,
      error: api.error,
      onRetry: api.retry,
    });
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Probe));
  const select = await waitFor(() => dom.window.document.getElementById("book-detail-render-engine"), "引擎下拉");
  const button = dom.window.document.getElementById("book-detail-retry-render-btn");

  click(dom, button);
  await waitFor(() => calls.length === 1, "不选引擎时提交");
  assert.equal(calls[0][0], "resume", "不选引擎：照旧先断点恢复，沿用原引擎");

  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set;
  setter.call(select, "typst");
  select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await waitFor(() => select.value === "typst", "选中 Typst");
  await waitFor(() => !button.disabled, "按钮恢复可点");
  click(dom, button);
  await waitFor(() => calls.length === 2, "选了引擎后提交");
  assert.deepEqual(calls[1], [
    "retry",
    "job-render-1",
    "render",
    { stage: "render", create_new_job: false, overrides: { render: { engine: "typst" } }, document_id: "doc-1" },
  ]);

  root.unmount();
  dom.window.close();
});
