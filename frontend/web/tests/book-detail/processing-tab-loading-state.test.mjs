// 书籍详情「进度」Tab 的加载态契约。
//
// 这条测试盯的毛病和 tests/status/translation-diagnostics-state.test.mjs 里那批
// 是同一类：**把「还不知道」渲染成「确定没有」**——不抛错、不报红，只骗人。
//
// 曾经的样子：BookDetailProcessingTab 里 loading 只控制一行
// 「正在读取文档任务…」的提示文案，它下面整张 .book-detail-processing-card
// （含 ProcessingPipelineRail 那条 OCR→翻译→渲染 的轨道、以及「开始 OCR」
// 按钮）是**无条件渲染**的。于是 GET /documents/:id/jobs 还在路上的那几百毫秒，
// 界面同时喊出两句互相矛盾的话：
//     正在读取文档任务…            （还不知道）
//     OCR 未执行 / 翻译 尚未翻译    （确定没有）
// 实测复现：一份 OCR 正在跑的文档，打开详情「进度」Tab，加载期间轨道显示
// 「未执行 / 尚未翻译」，而同一时刻页面另一处正显示这份文档的 OCR 进行中；
// 更糟的是「开始 OCR」此刻是可点的确定态，点下去就会并发出第二个任务。
//
// 修法的两半，缺一不可，所以下面两组用例必须一起在：
//   1) 首帧未知（loading 且一条任务数据都没有）→ 轨道进入「读取中」占位态，
//      不得出现「未执行 / 尚未翻译」，动作按钮不得可点；
//   2) 已有数据时的后台刷新（loading 又为真，但 ocr.job / 翻译 job 已在手）
//      → **不得退回占位态**。use-document-jobs 的 loading 在每次非静默 refresh
//      都会翻真，如果修法图省事写成 `if (loading) return <骨架/>`，正在盯进度的
//      用户会看到界面反复闪回骨架——那是把一个假消息换成了另一个。
//      所以判据必须是「有没有已知数据」，而不是 loading 本身。

import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor } from "../helpers/async.mjs";
import { makeDom } from "../helpers/dom.mjs";

const idleTranslation = {
  item: {},
  status: { label: "尚未翻译", tone: "muted" },
  isActive: false,
  canTranslate: true,
  rangeOn: false,
  startPage: "1",
  endPage: "",
  onRangeOnChange() {},
  onStartPageChange() {},
  onEndPageChange() {},
  onTranslate() {},
  onRetryStage: async () => {},
};

const idleOcr = {
  job: null,
  pending: false,
  cancelling: false,
  error: "",
  rangeOn: false,
  startPage: "1",
  endPage: "",
  onRangeOnChange() {},
  onStartPageChange() {},
  onEndPageChange() {},
  onOcr() {},
  onCancel() {},
};

async function mountTab(dom, props) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { BookDetailProcessingTab } = await import(
    "../../src/features/book-detail/ui/tabs/BookDetailProcessingTab.jsx"
  );
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const render = (next) => root.render(React.createElement(BookDetailProcessingTab, next));
  render(props);
  return { root, host, render };
}

const rail = (dom) => dom.window.document.querySelector("[data-translation-process='true']");
const stage = (dom, key) => dom.window.document.querySelector(`[data-stage-key='${key}']`);

// --- 1. 首帧未知：不得给出「确定没有」的结论 --------------------------------

test("进度 Tab：首次加载中不渲染「未执行 / 尚未翻译」这种确定结论", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, {
    loading: true,
    ocr: idleOcr,
    translation: idleTranslation,
  });

  await waitFor(() => rail(dom), "流水线轨道渲染");

  // 整块内容不能直接藏掉再突然出现（那会造成跳变）：卡片与轨道仍在 DOM 里，
  // 只是不给结论。
  assert.ok(
    dom.window.document.querySelector(".book-detail-processing-card"),
    "加载期间处理卡仍应占位，不能整块消失",
  );

  const text = host.textContent || "";
  assert.ok(
    !text.includes("未执行"),
    `首次加载中出现了「未执行」这种确定结论：${text}`,
  );
  assert.ok(
    !text.includes("尚未翻译"),
    `首次加载中出现了「尚未翻译」这种确定结论：${text}`,
  );

  // 轨道自身要能被认出是「读取中」而不是「确定停在 pending」。
  assert.equal(rail(dom).getAttribute("data-loading"), "true", "轨道应标记为读取中");
  assert.equal(
    stage(dom, "ocr").getAttribute("data-state"),
    "loading",
    "OCR 站在首帧未知时是 loading，而不是 pending（pending = 确定没跑过）",
  );
  assert.equal(
    stage(dom, "translate").getAttribute("data-state"),
    "loading",
    "翻译站同理",
  );

  // 动作按钮不得处于可点的确定态：数据没回来就点「开始 OCR」，
  // 很可能和正在跑的任务撞车。
  const startOcr = dom.window.document.getElementById("book-detail-start-ocr-btn");
  assert.ok(startOcr, "「开始 OCR」按钮仍应占位（避免按钮凭空出现的跳变）");
  assert.equal(startOcr.disabled, true, "首次加载中「开始 OCR」不得可点");
  const translateBtn = dom.window.document.getElementById("book-detail-translate-btn");
  assert.ok(
    !translateBtn || translateBtn.disabled,
    "首次加载中「翻译整本」同样不得处于可点的确定态",
  );

  root.unmount();
  host.remove();
});

test("进度 Tab：加载结束且确实没有任务时，才说「未执行」", async () => {
  const dom = makeDom();
  const { root, host, render } = await mountTab(dom, {
    loading: true,
    ocr: idleOcr,
    translation: idleTranslation,
  });
  await waitFor(() => rail(dom), "流水线轨道渲染");

  // 数据回来了，确实一条任务都没有——这时「未执行」是结论，不是猜测。
  render({ loading: false, ocr: idleOcr, translation: idleTranslation });
  await waitFor(
    () => (host.textContent || "").includes("未执行"),
    "加载结束后应给出「未执行」结论",
  );
  assert.equal(rail(dom).getAttribute("data-loading"), null, "结论态不该再标 data-loading");
  assert.equal(stage(dom, "ocr").getAttribute("data-state"), "pending");
  assert.equal(
    dom.window.document.getElementById("book-detail-start-ocr-btn").disabled,
    false,
    "确定没有 OCR 任务后，「开始 OCR」恢复可点",
  );

  root.unmount();
  host.remove();
});

// --- 2. 有数据时的后台刷新：不得闪回占位态 ----------------------------------

test("进度 Tab：已有任务数据时的刷新不把界面打回「读取中」占位", async () => {
  const dom = makeDom();
  const runningOcrJob = {
    job_id: "job-ocr-run",
    workflow: "ocr",
    status: "running",
    progress: { current: 3, total: 10 },
  };
  const { root, host, render } = await mountTab(dom, {
    loading: false,
    ocr: { ...idleOcr, job: runningOcrJob },
    translation: idleTranslation,
  });

  await waitFor(
    () => stage(dom, "ocr")?.getAttribute("data-state") === "active",
    "OCR 运行中，轨道 OCR 站为 active",
  );

  // use-document-jobs 的 loading 在每次非静默 refresh 都会翻真。
  // 判据若写成 loading 本身，这里就会闪回占位——用户正盯着进度。
  render({ loading: true, ocr: { ...idleOcr, job: runningOcrJob }, translation: idleTranslation });
  await wait(30);

  assert.equal(
    rail(dom).getAttribute("data-loading"),
    null,
    "已有任务数据时刷新，不得退回读取中占位（会造成反复闪烁）",
  );
  assert.equal(
    stage(dom, "ocr").getAttribute("data-state"),
    "active",
    "刷新期间 OCR 站应保持 active，不能丢掉已知结论",
  );
  assert.ok(
    (host.textContent || "").includes("处理中"),
    "刷新期间仍应显示 OCR 处理中",
  );

  root.unmount();
  host.remove();
});

test("进度 Tab：已有翻译任务时的刷新同样不回占位", async () => {
  const dom = makeDom();
  // 用已完成的翻译任务（而不是运行中的）当夹具：运行中的会拉起
  // BookTranslateProgressPanel，那要 HomeShellProviders 上下文，与本契约无关。
  const translated = {
    ...idleTranslation,
    item: { job_id: "job-translate-1", status: "succeeded" },
    status: { label: "已完成", tone: "done" },
    isActive: false,
    canTranslate: false,
    readerAvailable: true,
  };
  const { root, host, render } = await mountTab(dom, {
    loading: false,
    ocr: idleOcr,
    translation: translated,
  });
  const headline = () => dom.window.document.querySelector("[data-processing-unified-status]")?.textContent;
  await waitFor(() => headline() === "已完成", "完成态摘要渲染");
  assert.equal(rail(dom), null, "翻译完成后三步进度收起");
  assert.ok(dom.window.document.getElementById("book-detail-reprocess-toggle"), "完成态有「重新处理」");

  render({ loading: true, ocr: idleOcr, translation: translated });
  await wait(30);

  assert.equal(headline(), "已完成", "翻译任务在手时刷新不回占位");
  assert.ok(dom.window.document.getElementById("book-detail-reprocess-toggle"), "刷新不应收掉「重新处理」");
  assert.ok(
    !(host.textContent || "").includes("读取中"),
    "已有数据的刷新不该出现「读取中」占位文案",
  );

  root.unmount();
  host.remove();
});
