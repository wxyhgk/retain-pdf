import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDuration,
  formatTime,
  jobRows,
  processingFacts,
} from "../../src/features/book-detail/domain/translation-coverage.ts";

const NOW = new Date("2026-10-05T12:00:00");

// 先翻 1-3 页（whole），再专门重翻第 3 页并新翻第 4 页（redo）；另有一次 OCR、一次失败。
const VIEW = {
  page_count: 6,
  translated_pages: 4,
  contributing_jobs: 2,
  segments: [
    { first: 1, last: 2, job_id: "whole" },
    { first: 3, last: 4, job_id: "redo" },
    { first: 5, last: 6, job_id: null },
  ],
  jobs: [
    { job_id: "failed", workflow: "book", status: "failed", created_at: "2026-10-05T10:00:00", finished_at: "2026-10-05T10:01:00", model: "glm-5.3-flash", pages: [5], supplied_pages: 0, ocr_reused: true },
    { job_id: "redo", workflow: "translate", status: "succeeded", created_at: "2026-10-04T09:00:00", finished_at: "2026-10-04T09:03:05", model: "glm-5.3-flash", pages: [3, 4], supplied_pages: 2, ocr_reused: true },
    { job_id: "whole", workflow: "book", status: "succeeded", created_at: "2026-10-01T08:00:00", finished_at: "2026-10-01T08:00:42", model: "deepseek-flash", pages: [1, 2, 3], supplied_pages: 2, ocr_reused: false },
    { job_id: "ocr", workflow: "ocr", status: "succeeded", created_at: "2025-12-31T23:00:00", finished_at: "2026-01-01T00:02:00", model: "", pages: [1, 2, 3, 4, 5, 6], supplied_pages: 0, ocr_reused: false },
  ],
};

test("任务记录：类型、页码、时间、用时、模型、状态、采用了几页", () => {
  const rows = jobRows(VIEW, NOW);
  const [failed, redo, whole, ocr] = rows;
  assert.equal(redo.kind, "翻译");
  assert.equal(redo.pagesText, "第 3-4 页");
  assert.equal(redo.meta, "10月4日 09:00 · 用时 3 分 5 秒 · glm-5.3-flash · 复用 OCR");
  assert.equal(redo.statusLabel, "完成");
  assert.equal(redo.suppliedText, "采用 2 页");
  assert.equal(whole.suppliedText, "采用 2 页（其余被之后的翻译替换）", "第 3 页被 redo 替换了");
  assert.equal(whole.meta, "10月1日 08:00 · 用时 42 秒 · deepseek-flash");
  assert.equal(failed.statusLabel, "失败");
  assert.equal(failed.statusTone, "failed");
  assert.equal(failed.suppliedText, "", "失败的任务不谈采用");
  assert.equal(failed.meta.includes("用时"), false, "失败的任务不显示用时");
  assert.equal(ocr.kind, "OCR");
  assert.equal(ocr.pagesText, "全部 6 页");
  assert.equal(ocr.meta, "2025年12月31日 23:00 · 用时 1 小时 2 分", "跨年要写年份");
  assert.equal(ocr.suppliedText, "");
});

test("翻译成功但全部被之后的翻译替换", () => {
  const view = { ...VIEW, jobs: [{ ...VIEW.jobs[2], supplied_pages: 0 }] };
  assert.equal(jobRows(view, NOW)[0].suppliedText, "已被之后的翻译替换");
});

test("时间和用时的格式", () => {
  // 带 Z 的是 UTC，显示要换成本地时间（以前截字符串，显示的是 UTC）。期望值按本机时区算，
  // 测试在哪个时区跑都成立。
  const local = new Date("2026-10-05T07:23:11Z");
  const pad = (v) => `${v}`.padStart(2, "0");
  assert.equal(
    formatTime("2026-10-05T07:23:11Z", NOW),
    `${local.getMonth() + 1}月${local.getDate()}日 ${pad(local.getHours())}:${pad(local.getMinutes())}`,
  );
  assert.equal(formatTime("", NOW), "");
  assert.equal(formatDuration("2026-10-05T07:00:00", "2026-10-05T08:02:00"), "1 小时 2 分");
  assert.equal(formatDuration("2026-10-05T07:00:00", "2026-10-05T07:05:00"), "5 分");
  assert.equal(formatDuration("2026-10-05T07:00:00", null), "");
  assert.equal(formatDuration("2026-10-05T08:00:00", "2026-10-05T07:00:00"), "", "结束早于开始不显示");
});

test("任务记录：没翻全的成功任务写出保留原文块数；失败任务写原因、原始错误收起", () => {
  const view = {
    ...VIEW,
    jobs: [
      { ...VIEW.jobs[0], failure_summary: "外部服务请求超时", error_head: "failed to upload file /x/y.pdf" },
      { ...VIEW.jobs[1], kept_origin_blocks: 16 },
      { ...VIEW.jobs[2], kept_origin_blocks: 0 },
      VIEW.jobs[3],
    ],
  };
  const rows = jobRows(view, NOW);
  assert.equal(rows[0].failureText, "外部服务请求超时");
  assert.equal(rows[0].errorDetail, "failed to upload file /x/y.pdf");
  assert.equal(rows[1].warningText, "16 个内容块未能翻译");
  assert.equal(rows[2].warningText, "", "0 块不提示");
  assert.equal(rows[3].failureText, "", "成功任务没有失败原因");
  // 原始错误和一句话原因一样时不重复给。
  const same = jobRows({ ...view, jobs: [{ ...VIEW.jobs[0], failure_summary: "x", error_head: "x" }] }, NOW);
  assert.equal(same[0].errorDetail, "");
});

test("旧后端没有新字段：任务记录照常，不出提示", () => {
  const rows = jobRows(VIEW, NOW);
  assert.ok(rows.every((row) => !row.warningText && !row.failureText && !row.errorDetail));
});

test("摘要：页数、拼成次数、最近一次的时间 / 用时 / 模型，只算真实数据", () => {
  const view = { ...VIEW, jobs: [VIEW.jobs[0], { ...VIEW.jobs[1], kept_origin_blocks: 5 }, { ...VIEW.jobs[2], kept_origin_blocks: 2 }, VIEW.jobs[3]] };
  const facts = processingFacts(view, NOW);
  assert.deepEqual(facts.facts, [
    "已翻译 4 / 6 页",
    "由 2 次翻译拼成",
    "最近 10月4日 09:00",
    "用时 3 分 5 秒",
    "glm-5.3-flash",
  ]);
  assert.equal(facts.keptOriginBlocks, 7, "两次仍在提供页面的翻译加起来");
  // 最近一次翻译复用了 OCR：OCR 站就写复用，不去拿那次很久以前的 OCR 用时。
  assert.equal(facts.stageMeta.ocr, "复用已有 OCR");
  // 翻译站不写用时（整本任务的起止包含 OCR 和渲染）。
  assert.equal(facts.stageMeta.translate, "第 3-4 页 · glm-5.3-flash");
});

test("摘要：被之后的翻译完全替换的任务，保留原文不再计入", () => {
  const view = { ...VIEW, jobs: [{ ...VIEW.jobs[1], kept_origin_blocks: 3, supplied_pages: 0 }] };
  assert.equal(processingFacts(view, NOW).keptOriginBlocks, 0);
});

test("摘要：没复用 OCR 时 OCR 站写页数和用时；没有覆盖数据时什么都不给", () => {
  const view = { ...VIEW, jobs: [VIEW.jobs[2], VIEW.jobs[3]] };
  assert.equal(processingFacts(view, NOW).stageMeta.ocr, "全部 6 页 · 用时 1 小时 2 分");
  assert.deepEqual(processingFacts(null, NOW), { facts: [], keptOriginBlocks: 0, stageMeta: {} });
});

test("摘要不把「重新渲染」当翻译：用时、模型、复用 OCR 都取自真正的翻译任务", () => {
  const view = {
    page_count: 12, translated_pages: 12, contributing_jobs: 1,
    segments: [{ first: 1, last: 12, job_id: "book" }],
    jobs: [
      { job_id: "render", workflow: "render", status: "succeeded", created_at: "2026-10-05T12:00:00", finished_at: "2026-10-05T12:00:40", model: "m", pages: [], supplied_pages: 0, ocr_reused: true },
      { job_id: "book", workflow: "book", status: "succeeded", created_at: "2026-10-05T10:00:00", finished_at: "2026-10-05T10:05:00", model: "m", pages: Array.from({ length: 12 }, (_, i) => i + 1), supplied_pages: 12, ocr_reused: false },
      { job_id: "book-ocr", workflow: "ocr", status: "succeeded", created_at: "2026-10-05T10:00:00", finished_at: "2026-10-05T10:02:00", model: "", pages: Array.from({ length: 12 }, (_, i) => i + 1), supplied_pages: 0, ocr_reused: false },
    ],
  };
  const facts = processingFacts(view, NOW);
  assert.ok(facts.facts.includes("用时 5 分"), "用时是翻译任务的 5 分钟，不是渲染的 40 秒");
  assert.equal(facts.stageMeta.ocr, "全部 12 页 · 用时 2 分", "OCR 是那次整本任务自己做的，不是「复用已有 OCR」");
});

test("保留原文只算当前合并结果仍在用的页（后端 kept_origin_blocks_supplied）；旧后端退回整个任务", () => {
  const job = (extra) => ({ job_id: "a", workflow: "book", status: "succeeded", created_at: "2026-10-05T10:00:00", finished_at: "2026-10-05T10:05:00", model: "m", pages: [1, 2, 3], supplied_pages: 1, ocr_reused: false, ...extra });
  const view = (j) => ({ page_count: 3, translated_pages: 3, contributing_jobs: 1, segments: [], jobs: [j] });
  // 任务 A 有 16 块保留原文，但重翻之后只剩 1 页还在用、那页上 0 块 → 不该再提醒。
  assert.equal(processingFacts(view(job({ kept_origin_blocks: 16, kept_origin_blocks_supplied: 0 })), NOW).keptOriginBlocks, 0);
  assert.equal(processingFacts(view(job({ kept_origin_blocks: 16 })), NOW).keptOriginBlocks, 16, "旧后端没有新字段");
});
