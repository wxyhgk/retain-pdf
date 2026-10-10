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

  // 接着精修：从上次没审到的那一页开始。
  await api.retry("refine", { refineStartPage: 24 });
  assert.deepEqual(calls[1][3], {
    stage: "refine", create_new_job: false, refine: { start_page: 24 }, document_id: "doc-1",
  });

  root.unmount();
  dom.window.close();
});

test("重新渲染：可选排版引擎，选了就带 overrides.render.engine；不选沿用原引擎；都不偷偷改走断点续跑", async () => {
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
  // 以前失败任务会先试断点续跑；续跑计划可能是「从翻译继续」，和「重新渲染」不是一回事。
  assert.deepEqual(calls[0], [
    "retry",
    "job-render-1",
    "render",
    { stage: "render", create_new_job: false, document_id: "doc-1" },
  ], "不选引擎：直接重新渲染，沿用原引擎");

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

test("上次精修的结果写在精修那一行下面；没审完时可以从没审到的那一页接着精修（先确认）", async () => {
  const { describeLastRefine, refineContinuePage } = await import("../../src/features/book-detail/domain/last-refine.js");
  const stopped = {
    status: "stopped", generated_at: "2026-10-09T05:25:54+00:00", finding_count: 4, applied: 2,
    reviewed_item_count: 300, candidate_item_count: 330, unreviewed_item_count: 30, next_page: 24,
    stopped_reason: "max_tokens",
  };
  assert.equal(describeLastRefine(stopped), "上次精修只审到第 24 页之前（达到用量上限，还有 30 块没审）：发现 4 处，改了 2 处。");
  assert.equal(refineContinuePage(stopped), 24);
  const done = { ...stopped, status: "completed", unreviewed_item_count: 0, next_page: null, stopped_reason: null };
  assert.equal(describeLastRefine(done), "上次精修审完了全书：发现 4 处，改了 2 处。");
  assert.equal(refineContinuePage(done), null);
  assert.equal(describeLastRefine(undefined), "");
  const editorial = {
    ...done, mode: "editorial", escalated_count: 2,
    escalated: [
      { item_id: "p014-b019", page_number: 14, reason: "达到修改次数上限，仍未解决" },
      { item_id: "p019-b017", page_number: 19, reason: "术语有争议，需要人定：Cartesian coordinates（现译「笛卡尔坐标」）" },
    ],
  };
  assert.equal(describeLastRefine(editorial), "上次精修审完了全书：发现 4 处，改了 2 处，2 处留给你确认。");

  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { TranslationStageActions } = await import(
    "../../src/features/book-detail/ui/panels/translate/TranslationStageActions.jsx"
  );
  const calls = [];
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(TranslationStageActions, {
    variant: "sheet",
    actions: [{ stage: "refine", label: "精修译文", can_retry: true, last_refine: stopped }],
    onRetry: async (...args) => calls.push(args),
  }));
  const resume = await waitFor(() => dom.window.document.querySelector("[data-refine-continue]"), "接着精修按钮");
  assert.equal(resume.textContent.trim(), "从第 24 页继续");
  assert.match(dom.window.document.querySelector("[data-last-refine]").textContent, /只审到第 24 页之前/);
  click(dom, resume);
  await waitFor(() => dom.window.document.getElementById("book-detail-translation-risk-confirm"), "确认框");
  assert.match(dom.window.document.body.textContent, /接着精修/);
  assert.equal(calls.length, 0, "打开确认框不能直接提交");
  click(dom, dom.window.document.getElementById("book-detail-translation-risk-confirm-confirm"));
  await waitFor(() => calls.length === 1, "确认后提交");
  assert.deepEqual(calls[0], ["refine", { refineStartPage: 24 }]);

  root.unmount();
  dom.window.close();
});

test("编辑部留给你确认的块列在精修那一行下面（页码 + 原因）", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { TranslationStageActions } = await import(
    "../../src/features/book-detail/ui/panels/translate/TranslationStageActions.jsx"
  );
  const last = {
    status: "completed", generated_at: "2026-10-09T18:00:00+00:00", finding_count: 9, applied: 5,
    reviewed_item_count: 330, candidate_item_count: 330, unreviewed_item_count: 0, next_page: null,
    stopped_reason: null, mode: "editorial", escalated_count: 3,
    escalated: [
      { item_id: "p014-b019", page_number: 14, reason: "达到修改次数上限，仍未解决" },
      { item_id: "p019-b017", page_number: 19, reason: "术语有争议，需要人定：Cartesian coordinates（现译「笛卡尔坐标」）" },
    ],
  };
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(TranslationStageActions, {
    variant: "sheet",
    actions: [{ stage: "refine", label: "精修译文", can_retry: true, last_refine: last }],
    onRetry: async () => {},
  }));
  const list = await waitFor(() => dom.window.document.querySelector("[data-refine-escalated]"), "待确认清单");
  assert.equal(list.getAttribute("data-refine-escalated"), "3");
  assert.equal(list.querySelector("summary").textContent, "查看留给你确认的 3 处");
  const rows = [...list.querySelectorAll("[data-escalated-item]")].map((row) => row.textContent);
  assert.deepEqual(rows, [
    "第 14 页达到修改次数上限，仍未解决",
    "第 19 页术语有争议，需要人定：Cartesian coordinates（现译「笛卡尔坐标」）",
  ]);
  assert.match(list.textContent, /只列出前 2 处/);
  root.unmount();
  dom.window.close();
});
