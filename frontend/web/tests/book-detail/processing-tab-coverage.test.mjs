/** 「进度」分区的翻译覆盖条、「历史」页签的任务记录：页签真的把 coverage 交给了面板。 */

import test from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../helpers/dom.mjs";
import { waitFor } from "../helpers/async.mjs";
import { idleOcr, idleTranslation, mountProcessingTab } from "./helpers/processing-tab-fixture.mjs";

// 失败的翻译任务会拉起 BookTranslateProgressPanel，它要 HomeShellProviders。
const services = {
  library: { actions: {} },
  statusCard: { store: { getSnapshot: () => ({ snapshot: {} }), subscribe: () => () => {} } },
  statusDetail: { controller: { openStatusDetailDialog: () => {} } },
  // 运行中的翻译会拉起嵌入状态卡（useStatusCardModel 要 reader）。
  reader: { openReader: () => {} },
};

const mountTab = (dom, props) => mountProcessingTab(dom, props, services);

// 任务记录搬到了「历史」页签。
async function mountHistory(dom, coverage) {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { BookDetailHistoryTab } = await import("../../src/features/book-detail/ui/tabs/BookDetailHistoryTab.jsx");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(BookDetailHistoryTab, { coverage, addedAt: "2026-09-30T08:00:00" }));
  await waitFor(() => host.querySelector("[data-book-detail-tab='history']"), "历史页签");
  return { root, host };
}

const COVERAGE = {
  page_count: 6,
  translated_pages: 4,
  contributing_jobs: 2,
  segments: [
    { first: 1, last: 2, job_id: "whole" },
    { first: 3, last: 4, job_id: "redo" },
    { first: 5, last: 6, job_id: null },
  ],
  jobs: [
    { job_id: "redo", workflow: "translate", status: "succeeded", created_at: "2026-10-04T09:00:00", finished_at: "2026-10-04T09:03:05", model: "glm-5.3-flash", pages: [3, 4], supplied_pages: 2, ocr_reused: true },
    { job_id: "whole", workflow: "book", status: "succeeded", created_at: "2026-10-01T08:00:00", finished_at: "2026-10-01T08:00:42", model: "deepseek-flash", pages: [1, 2, 3], supplied_pages: 2, ocr_reused: false },
  ],
};

test("有覆盖数据：显示覆盖条（每页一格）和任务记录", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: idleTranslation, coverage: COVERAGE });
  const headline = host.querySelector("[data-coverage-headline]");
  assert.equal(headline?.textContent, "已翻译 4 / 6 页 · 由 2 次翻译拼成");
  const cells = [...host.querySelectorAll(".book-detail-coverage-cell")];
  assert.deepEqual(cells.map((cell) => cell.getAttribute("data-shade")), ["2", "2", "1", "1", "0", "0"]);
  assert.equal(cells[4].getAttribute("title"), "第 5 页 · 未翻译");
  assert.equal(host.querySelector(".book-detail-job-history"), null, "任务记录不在「进度」页");
  root.unmount(); host.remove();

  const history = await mountHistory(dom, COVERAGE);
  const rows = [...history.host.querySelectorAll(".book-detail-job-history-row")];
  assert.deepEqual(rows.map((row) => row.getAttribute("data-job-id")), ["redo", "whole"]);
  assert.match(rows[1].textContent, /第 1-3 页/);
  assert.match(rows[1].textContent, /采用 2 页（其余被之后的翻译替换）/);
  assert.match(rows[0].textContent, /glm-5\.3-flash/);
  assert.equal(history.host.querySelector(".book-detail-job-history").open, true, "「历史」页签里默认展开");
  assert.match(history.host.textContent, /加入书库/);
  history.root.unmount(); history.host.remove();
});

test("没有覆盖数据（接口失败 / mock）：两块都不出现，其余照常", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: idleTranslation, coverage: null });
  assert.equal(host.querySelector(".book-detail-coverage"), null);
  assert.equal(host.querySelector(".book-detail-job-history"), null);
  assert.ok(host.querySelector(".book-detail-processing-card"), "处理卡不该受影响");
  root.unmount(); host.remove();
});

const DONE_TRANSLATION = {
  ...idleTranslation,
  item: { job_id: "redo", workflow: "translate", status: "succeeded", created_at: "2026-10-04T09:00:00Z" },
  status: { label: "已完成", tone: "done" },
  canTranslate: false,
};

test("完成且有保留原文：标题是状态、HUD 进度环写翻了几页、给出提醒；流水线五站全勾", async () => {
  const dom = makeDom();
  const coverage = { ...COVERAGE, jobs: [{ ...COVERAGE.jobs[0], kept_origin_blocks: 16 }, COVERAGE.jobs[1]] };
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: DONE_TRANSLATION, coverage });
  assert.equal(host.querySelector("[data-processing-unified-status]")?.textContent, "已完成");
  assert.equal(host.querySelector(".book-detail-processing-head")?.getAttribute("data-tone"), "warn");
  const gauge = host.querySelector("[data-hud='gauge']");
  assert.equal(gauge?.getAttribute("title"), "已翻译 4 / 6 页");
  assert.match(gauge?.textContent || "", /4\/6/);
  assert.equal(host.querySelector("[data-processing-hud]")?.dataset.tone, "warn");
  assert.match(host.querySelector(".book-detail-processing-warning")?.textContent || "", /16 个内容块没能翻译出来/);
  assert.ok(host.querySelector("[data-translation-process='true']"), "完成后流水线照样画，每站写用时");
  assert.equal(host.querySelector("[data-stage-key='done']")?.getAttribute("data-state"), "done");
  assert.equal(host.querySelector("#book-detail-reprocess-toggle"), null, "卡片头不再有「重新处理」，动作挂在各站上");
  assert.equal(host.textContent.includes("左侧可直接对照阅读"), false, "这句填充文案去掉了");
  root.unmount(); host.remove();
});

test("完成且全部翻出来：没有提醒，图标是完成色", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: DONE_TRANSLATION, coverage: COVERAGE });
  assert.equal(host.querySelector(".book-detail-processing-head")?.getAttribute("data-tone"), "done");
  assert.equal(host.querySelector(".book-detail-processing-warning"), null);
  root.unmount(); host.remove();
});

test("还没开始：按钮都在状态行上；「指定页码」一个开关，翻译和只做 OCR 共用一份页码", async () => {
  const dom = makeDom();
  const calls = [];
  const ocr = { ...idleOcr, onRangeOnChange: (v) => calls.push(["ocr-on", v]), onPageSpecChange: (v) => calls.push(["ocr-spec", v]) };
  const translation = {
    ...idleTranslation, pageSpec: "1-3",
    onRangeOnChange: (v) => calls.push(["tr-on", v]), onPageSpecChange: (v) => calls.push(["tr-spec", v]),
  };
  const { root, host } = await mountTab(dom, { loading: false, ocr, translation, coverage: null });
  const tools = host.querySelector(".book-detail-processing-tools");
  assert.ok(tools?.querySelector("#book-detail-translate-btn"), "翻译整本在状态行上");
  assert.ok(tools?.querySelector("#book-detail-start-ocr-btn"), "只做 OCR 在状态行上");
  assert.equal(tools.querySelector("#book-detail-start-ocr-btn").getAttribute("aria-label"), "只做 OCR");
  const toggle = tools.querySelector("#book-detail-page-range-toggle");
  assert.equal(toggle?.getAttribute("aria-pressed"), "false");
  assert.equal(host.querySelector("#book-detail-translate-pages"), null, "没打开时不占一行");
  toggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  assert.deepEqual(calls, [["tr-on", true], ["ocr-on", true], ["ocr-spec", "1-3"]], "一个开关同时打开翻译和 OCR 的指定页码");
  root.unmount(); host.remove();

  const opened = await mountTab(makeDom(), { loading: false, ocr, translation: { ...translation, rangeOn: true }, coverage: null });
  assert.ok(opened.host.querySelector(".book-detail-processing-range #book-detail-translate-pages"), "打开后状态行下面一行页码");
  assert.match(opened.host.querySelector("#book-detail-translate-btn").textContent, /翻译选定页码/);
  opened.root.unmount(); opened.host.remove();
});

test("失败任务在任务记录里写原因，原始错误收在展开里", async () => {
  const dom = makeDom();
  const coverage = {
    ...COVERAGE,
    jobs: [
      { job_id: "bad", workflow: "ocr", status: "failed", created_at: "2026-10-05T09:00:00", finished_at: "2026-10-05T09:05:00", model: "", pages: [], supplied_pages: 0, ocr_reused: false, failure_summary: "外部服务请求超时", error_head: "failed to upload file" },
      ...COVERAGE.jobs,
    ],
  };
  const { root, host } = await mountHistory(dom, coverage);
  const row = host.querySelector(".book-detail-job-history-row[data-job-id='bad']");
  assert.match(row?.querySelector("[data-job-failure]")?.textContent || "", /外部服务请求超时/);
  const details = row?.querySelector("details");
  assert.ok(details && !details.open, "原始错误默认收起");
  assert.match(details.textContent, /failed to upload file/);
  root.unmount(); host.remove();
});

test("翻译任务跑在 OCR 阶段：进度只出现一次；OCR 站写实时说明，翻译站「等待中」，不摆旧结果", async () => {
  const dom = makeDom();
  const running = {
    ...idleTranslation,
    canTranslate: false,
    isActive: true,
    item: {
      job_id: "job-live", workflow: "book", status: "running", created_at: "2026-10-06T02:28:11Z",
      stage_snapshot: {
        display_stage: "ocr",
        stage_detail: "OCR provider 已返回 done，bundle 尚未就绪，12s 后重试（第 2/8 次）",
        progress: { current: 32, total: 48, unit: "page" },
      },
    },
    status: { label: "处理中", tone: "active" },
  };
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: idleOcr, translation: running,
    coverage: { ...COVERAGE, jobs: [{ ...COVERAGE.jobs[0], kept_origin_blocks: 16 }, COVERAGE.jobs[1]] },
  });
  assert.equal(host.querySelector("[data-processing-unified-status]")?.textContent, "翻译中");
  // 进度只在 HUD 的进度环上说一次：环跟百分比，下面写第几页。
  const gauge = host.querySelector("[data-hud='gauge']");
  assert.match(gauge?.textContent || "", /32 \/ 48 页/);
  assert.match(gauge?.querySelector(".book-detail-hud-ring-fill")?.getAttribute("style") || "", /stroke-dasharray/);
  assert.equal(host.querySelectorAll("[data-hud='gauge']").length, 1, "进度只出现一次");
  assert.equal(host.querySelector("[data-hud='tokens']"), null, "在跑时 token 还在涨，不摆");
  assert.equal(
    host.querySelector("[data-stage-meta='ocr']")?.textContent,
    "OCR provider 已返回 done，bundle 尚未就绪，12s 后重试（第 2/8 次）",
  );
  assert.equal(host.querySelector("[data-stage-meta='translate']"), null, "跑新任务时不摆上一次的翻译结果");
  assert.equal(host.querySelector("[data-stage-warning='translate']"), null, "跑新任务时也不挂上一次的「N 块保留原文」");
  const translateStage = host.querySelector("[data-translation-process] [data-stage-key='translate']");
  assert.equal(translateStage?.getAttribute("data-state"), "pending");
  assert.equal(translateStage?.querySelector(".book-detail-status")?.textContent, "等待中");
  root.unmount(); host.remove();
});

test("翻译完成：重做的动作挂在流水线各站上，点哪站列哪站的；任务记录不在这一页", async () => {
  const dom = makeDom();
  const stageActions = [
    { stage: "translation", label: "重新翻译", can_retry: true },
    { stage: "refine", label: "精修译文", can_retry: true },
    { stage: "render", label: "重新渲染", can_retry: true },
  ];
  const { root, host } = await mountTab(dom, {
    loading: false,
    ocr: idleOcr,
    translation: { ...DONE_TRANSLATION, stageActions },
    coverage: COVERAGE,
  });
  const doc = dom.window.document;
  const station = (key) => host.querySelector(`[data-station-action='${key}']`);
  assert.deepEqual([...host.querySelectorAll("[data-station-action]")].map((node) => node.dataset.stationAction), ["ocr", "translate", "render"]);
  for (const id of ["book-detail-retry-render-btn", "book-detail-start-ocr-btn", "book-detail-render-engine"]) {
    assert.equal(doc.getElementById(id), null, `${id} 默认收起`);
  }
  assert.equal(host.querySelector(".book-detail-ocr-range"), null, "OCR 页码选项也收起");
  const rows = () => [...host.querySelectorAll("#book-detail-station-panel [data-reprocess-stage]")].map((row) => row.getAttribute("data-reprocess-stage"));
  const open = async (key) => {
    station(key).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await waitFor(() => host.querySelector(`[data-station-panel='${key}']`), `点开${key}站`);
  };

  await open("translate");
  assert.equal(station("translate").getAttribute("aria-expanded"), "true");
  assert.deepEqual(rows(), ["refine", "translation"], "翻译站：精修和重新翻译，按代价从小到大");
  await open("render");
  assert.equal(station("translate").getAttribute("aria-expanded"), "false", "一次只开一站");
  assert.deepEqual(rows(), ["render"]);
  const renderRow = host.querySelector("[data-reprocess-stage='render']");
  assert.ok(renderRow.querySelector("#book-detail-render-engine"), "引擎选择挨着重新渲染");
  assert.match(renderRow.textContent, /不产生费用/);
  await open("ocr");
  assert.deepEqual(rows(), ["ocr"]);
  const ocrRow = host.querySelector("[data-reprocess-stage='ocr']");
  assert.ok(ocrRow.querySelector("#book-detail-start-ocr-btn"));
  assert.ok(ocrRow.querySelector(".book-detail-ocr-range"), "OCR 页码挨着重新 OCR");
  station("ocr").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => !host.querySelector("#book-detail-station-panel"), "再点一下收起");

  assert.equal(host.querySelector(".book-detail-job-history"), null, "任务记录在「历史」页签，不占「进度」页");
  root.unmount(); host.remove();
});

test("全部翻完时不画覆盖条（100% 一排满格什么也没说）", async () => {
  const dom = makeDom();
  const full = { ...COVERAGE, translated_pages: 6, segments: [{ first: 1, last: 6, job_id: "whole" }] };
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: DONE_TRANSLATION, coverage: full });
  assert.equal(host.querySelector(".book-detail-coverage"), null);
  root.unmount(); host.remove();
  const history = await mountHistory(dom, full);
  assert.ok(history.host.querySelector(".book-detail-job-history"), "任务记录照常（在「历史」页签）");
  history.root.unmount(); history.host.remove();
});

test("用量并进「进度」页：HUD 一块 token（合计、输入 / 输出比例，精确值在悬停），细节区多一页「用量」；没记录就都不出", async () => {
  const { usageViewModel } = await import("../../src/features/usage/domain/usage-view-model.ts");
  const bucket = (total) => ({
    input_tokens: total, output_tokens: 0, total_tokens: total, requests: 3, requests_without_usage: 0,
    cache_hit_tokens: 0, cache_reported_input_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0,
  });
  const view = {
    schema: "token-usage.v1", scope: "document", totals: bucket(875_000),
    by_stage: [{ stage: "translate", group: "translation", label: "翻译", ...bucket(875_000) }],
    by_model: [], by_month: [], jobs_counted: 1, jobs_estimated_from_reports: 0, first_at: null, last_at: null,
  };
  const usage = { model: usageViewModel(view), loading: false, error: "", reload() {} };
  const dom = makeDom();
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: DONE_TRANSLATION, coverage: COVERAGE, usage });
  const tile = host.querySelector("[data-hud='tokens']");
  assert.match(tile?.textContent || "", /87\.5 万/);
  assert.match(tile.getAttribute("title"), /875,000 token/);
  // 这里只有「用量」一页，细节区不画切换，直接是内容。
  assert.equal(host.querySelector("[data-processing-details]")?.dataset.processingDetails, "usage", "细节区有「用量」");
  assert.ok(host.querySelector("[data-usage-metric='total']"));
  root.unmount(); host.remove();

  const empty = await mountTab(makeDom(), {
    loading: false, ocr: idleOcr, translation: DONE_TRANSLATION, coverage: COVERAGE,
    usage: { model: usageViewModel(null), loading: false, error: "", reload() {} },
  });
  assert.equal(empty.host.querySelector("[data-hud='tokens']"), null);
  assert.equal(empty.host.querySelector("[data-processing-details]"), null, "没记录不占地方");
  empty.root.unmount(); empty.host.remove();
});

test("并行：标题「识别和翻译中」；OCR 站跟 OCR 子任务（20/34 页）、翻译站跟 ocr_stream，两站都亮、各写各的百分比", async () => {
  const dom = makeDom();
  const parallel = {
    ...idleTranslation,
    canTranslate: false,
    isActive: true,
    item: {
      job_id: "job-par", workflow: "book", status: "running", created_at: "2026-10-31T07:34:20Z",
      stage_snapshot: {
        stage: "translating", display_stage: "translate", substage: "ocr_stream", stage_detail: "跟着 OCR 翻译：已到 10/34 页",
        progress: { current: 10, total: 34, unit: "page" },
      },
    },
    status: { label: "处理中", tone: "active" },
  };
  const ocr = {
    ...idleOcr,
    job: {
      job_id: "job-par-ocr", workflow: "ocr", status: "running",
      stage_snapshot: { stage: "ocr_processing", substage: "glm_ocr", stage_detail: "GLM-OCR 已识别 20/34 页", progress: { current: 20, total: 34, unit: "page" } },
    },
  };
  const { root, host } = await mountTab(dom, { loading: false, ocr, translation: parallel, coverage: null });
  assert.equal(host.querySelector("[data-processing-unified-status]")?.textContent, "识别和翻译中");
  const stage = (key) => host.querySelector(`[data-translation-process] [data-stage-key='${key}']`);
  assert.equal(stage("ocr").getAttribute("data-state"), "active");
  assert.equal(stage("translate").getAttribute("data-state"), "active");
  assert.equal(host.querySelector("[data-stage-percent='ocr']")?.textContent, "59%", "OCR 站：20/34 页");
  assert.equal(host.querySelector("[data-stage-percent='translate']")?.textContent, "29%", "翻译站：能翻到 10/34 页");
  assert.match(host.querySelector("[data-stage-meta='ocr']")?.textContent || "", /GLM-OCR 已识别/);
  assert.match(host.querySelector("[data-stage-meta='translate']")?.textContent || "", /跟着 OCR 翻译/);
  assert.match(host.querySelector("[data-hud='gauge']")?.textContent || "", /10 \/ 34 页/, "整体进度看翻译跟到哪了");
  assert.equal(host.querySelector("#book-detail-cancel-ocr-btn"), null, "并行时不单独取消 OCR，取消翻译任务就够了");
  root.unmount(); host.remove();
});

