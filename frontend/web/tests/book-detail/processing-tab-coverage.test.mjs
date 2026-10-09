/** 「进度」分区的翻译覆盖条和任务记录：页签真的把 coverage 交给了两个面板。 */

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
  const rows = [...host.querySelectorAll(".book-detail-job-history-row")];
  assert.deepEqual(rows.map((row) => row.getAttribute("data-job-id")), ["redo", "whole"]);
  assert.match(rows[1].textContent, /第 1-3 页/);
  assert.match(rows[1].textContent, /采用 2 页（其余被之后的翻译替换）/);
  assert.match(rows[0].textContent, /glm-5\.3-flash/);
  root.unmount(); host.remove();
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

test("完成且有保留原文：标题是状态、摘要有数字、给出提醒；没有满格进度条、没有「完成」站", async () => {
  const dom = makeDom();
  const coverage = { ...COVERAGE, jobs: [{ ...COVERAGE.jobs[0], kept_origin_blocks: 16 }, COVERAGE.jobs[1]] };
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: DONE_TRANSLATION, coverage });
  assert.equal(host.querySelector("[data-processing-unified-status]")?.textContent, "已完成");
  assert.equal(host.querySelector(".book-detail-processing-head")?.getAttribute("data-tone"), "warn");
  assert.match(host.querySelector("[data-processing-facts]")?.textContent || "", /已翻译 4 \/ 6 页/);
  assert.doesNotMatch(host.querySelector("[data-processing-facts]")?.textContent || "", /保留原文/, "提醒条已经说了，摘要行不重复");
  assert.match(host.querySelector(".book-detail-processing-warning")?.textContent || "", /16 个内容块没能翻译出来/);
  assert.equal(host.querySelector(".book-detail-processing-progress"), null, "完成后不画进度条");
  assert.equal(host.querySelector("[data-stage-key='done']"), null);
  assert.equal(host.querySelector("[data-translation-process='true']"), null, "完成后三步进度收起，只留一行摘要");
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

test("OCR 指定页码和翻译的指定页码在同一个选项行；按钮都在同一个动作行", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: idleTranslation, coverage: null });
  const options = host.querySelector(".book-detail-processing-options");
  assert.ok(options?.querySelector(".book-detail-ocr-range"), "OCR 指定页码在选项行里");
  assert.ok(options?.querySelector(".book-detail-translate-range"), "翻译指定页码在选项行里");
  const actions = host.querySelectorAll("[data-processing-actions]");
  assert.equal(actions.length, 1, "只有一个动作行");
  assert.ok(actions[0].querySelector("#book-detail-start-ocr-btn"));
  assert.ok(actions[0].querySelector("#book-detail-translate-btn"));
  root.unmount(); host.remove();
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
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: DONE_TRANSLATION, coverage });
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
  assert.equal(host.querySelector("[data-processing-unified-status]")?.textContent, "翻译中 · 32/48 页 · 67%");
  assert.equal(host.querySelectorAll(".book-detail-processing-progress").length, 1, "进度条只有顶部一条");
  assert.equal(
    host.querySelector("[data-stage-meta='ocr']")?.textContent,
    "OCR provider 已返回 done，bundle 尚未就绪，12s 后重试（第 2/8 次）",
  );
  assert.equal(host.querySelector("[data-stage-meta='translate']"), null, "跑新任务时不摆上一次的翻译结果");
  assert.equal(host.querySelector("[data-stage-warning='translate']"), null, "跑新任务时也不挂上一次的「N 块保留原文」");
  const translateStage = host.querySelector("[data-stage-key='translate']");
  assert.equal(translateStage?.getAttribute("data-state"), "pending");
  assert.equal(translateStage?.querySelector(".book-detail-status")?.textContent, "等待中");
  root.unmount(); host.remove();
});

test("翻译完成：动作收进「重新处理」，点开是按代价排序的清单；任务记录默认收起", async () => {
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
  const toggle = doc.getElementById("book-detail-reprocess-toggle");
  assert.ok(toggle, "卡片头有「重新处理」");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  for (const id of ["book-detail-retry-render-btn", "book-detail-start-ocr-btn", "book-detail-render-engine"]) {
    assert.equal(doc.getElementById(id), null, `${id} 默认收起`);
  }
  assert.equal(host.querySelector(".book-detail-ocr-range"), null, "OCR 页码选项也收起");

  toggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => host.querySelector(".book-detail-reprocess-list"), "清单展开");
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  const order = [...host.querySelectorAll("[data-reprocess-stage]")].map((row) => row.getAttribute("data-reprocess-stage"));
  assert.deepEqual(order, ["render", "refine", "translation", "ocr"], "按代价从小到大");
  const renderRow = host.querySelector("[data-reprocess-stage='render']");
  assert.ok(renderRow.querySelector("#book-detail-render-engine"), "引擎选择挨着重新渲染");
  assert.match(renderRow.textContent, /不产生费用/);
  const ocrRow = host.querySelector("[data-reprocess-stage='ocr']");
  assert.ok(ocrRow.querySelector("#book-detail-start-ocr-btn"));
  assert.ok(ocrRow.querySelector(".book-detail-ocr-range"), "OCR 页码挨着重新 OCR");

  const history = host.querySelector(".book-detail-job-history");
  assert.equal(history?.tagName, "DETAILS");
  assert.equal(history.open, false, "任务记录默认收起");
  root.unmount(); host.remove();
});

test("全部翻完时不画覆盖条（100% 一排满格什么也没说）", async () => {
  const dom = makeDom();
  const full = { ...COVERAGE, translated_pages: 6, segments: [{ first: 1, last: 6, job_id: "whole" }] };
  const { root, host } = await mountTab(dom, { loading: false, ocr: idleOcr, translation: DONE_TRANSLATION, coverage: full });
  assert.equal(host.querySelector(".book-detail-coverage"), null);
  assert.ok(host.querySelector(".book-detail-job-history"), "任务记录照常");
  root.unmount(); host.remove();
});
