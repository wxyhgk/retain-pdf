// 最近任务运行时补丁：新旧快照谁赢、重试换 job_id、created 卡片何时插入 / 保留。
// 从原 recent-jobs.test.mjs 拆出，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import { createRecentJobsStatePort } from "../../src/features/library/domain/recent-jobs/state.js";
import {
  recentJobProgressPercent,
  isRecentJobActive,
  stageKeyForRecentJobLabel,
  recentJobStageLabel,
} from "../../src/features/library/domain/recent-jobs/card-presenter.js";
import { mergeLibraryJobItem } from "../../src/features/library/domain/recent-jobs/runtime-item.js";
import { createRecentJobsRuntimePatches } from "../../src/features/library/domain/recent-jobs/runtime-patches.js";
import { adaptJobStageSnapshot } from "@retainpdf/domain/job-status";

const recentJobsStageAdapterPort = { adaptJobStageSnapshot };

test("recent jobs runtime patches keep newer event progress over older poll snapshots", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-monotonic-card",
        status: "running",
        display_stage: "translation",
        substage: "translation_batches",
        progress: { unit: "batch", current: 1, total: 10, percent: 10 },
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-monotonic-card",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { unit: "batch", current: 8, total: 10, percent: 80 },
    stage_snapshot: {
      stageKey: "translate",
      publicStage: "translation",
      source: "display-state",
      lane: "main",
      substage: "translation_batches",
      detail: "正在翻译正文内容",
      progress: { unit: "batch", current: 8, total: 10, percent: 80 },
    },
  });
  patches.update({
    job_id: "job-monotonic-card",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { unit: "batch", current: 5, total: 10, percent: 50 },
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.progress.current, 8);
  assert.equal(item.progress.percent, 80);
  assert.equal(item.runtime_status.progress.current, 8);
  assert.equal(item.runtime_status.progress.percent, 80);
});

test("recent jobs runtime patches keep newer progress while accepting newer substage text", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-monotonic-text",
        status: "running",
        display_stage: "translation",
        substage: "translation_batches",
        progress: { unit: "batch", current: 8, total: 10, percent: 80 },
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-monotonic-text",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { unit: "batch", current: 8, total: 10, percent: 80 },
    stage_snapshot: {
      stageKey: "translate",
      publicStage: "translation",
      source: "display-state",
      lane: "main",
      substage: "translation_batches",
      detail: "正在翻译正文内容",
      progress: { unit: "batch", current: 8, total: 10, percent: 80 },
    },
  });
  patches.update({
    job_id: "job-monotonic-text",
    status: "running",
    display_stage: "translation",
    substage: "garbled_repair",
    stage_detail: "正在修复翻译结果",
    progress: { unit: "batch", current: 5, total: 10, percent: 50 },
    stage_snapshot: {
      stageKey: "translate",
      publicStage: "translation",
      source: "display-state",
      lane: "main",
      substage: "garbled_repair",
      detail: "正在修复翻译结果",
      progress: { unit: "batch", current: 5, total: 10, percent: 50 },
    },
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.progress.current, 8);
  assert.equal(item.progress.percent, 80);
  assert.equal(item.runtime_status.substage, "garbled_repair");
  assert.equal(item.runtime_status.detail, "正在修复乱码候选段");
  assert.equal(item.runtime_status.progress.current, 8);
  assert.equal(item.runtime_status.progress.percent, 80);
});

test("recent jobs runtime patches keep terminal state over stale running snapshots", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-terminal-card",
        status: "running",
        display_stage: "translation",
        progress: { unit: "batch", current: 9, total: 10, percent: 90 },
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-terminal-card",
    status: "succeeded",
    display_stage: "done",
    progress: { unit: "batch", current: 10, total: 10, percent: 100 },
  });
  patches.update({
    job_id: "job-terminal-card",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { unit: "batch", current: 9, total: 10, percent: 90 },
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.status, "succeeded");
  assert.equal(item.display_stage, "done");
  assert.equal(item.progress.percent, 100);
  assert.equal(item.runtime_status.stageKey, "done");
});

test("recent jobs runtime patches accept new job_id retry after terminal (home card leaves 已翻译)", () => {
  // 回归：完成后再「重新 OCR」换了 job_id 时，旧终态补丁不得盖住新 running，
  // 否则主页卡一直显示「已翻译」、封面不转圈。
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-done",
        document_id: "doc-attention",
        title: "Attention Is All You Need",
        cover_url: "mock://document-cover.png",
        status: "succeeded",
        display_stage: "done",
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-done",
    document_id: "doc-attention",
    title: "Attention Is All You Need",
    cover_url: "mock://document-cover.png",
    status: "succeeded",
    display_stage: "done",
  });
  patches.update({
    job_id: "job-retry-ocr",
    source_job_id: "job-done",
    document_id: "doc-attention",
    title: "Attention Is All You Need",
    cover_url: "mock://document-cover.png",
    status: "running",
    display_stage: "ocr",
    stage: "ocr_processing",
  });

  const items = statePort.getSnapshot().items;
  assert.equal(items.length, 1, "must update in place, not insert a second card");
  const item = items[0];
  assert.equal(item.job_id, "job-retry-ocr");
  assert.equal(item.document_id, "doc-attention");
  assert.equal(item.status, "running");
  assert.equal(item.display_stage, "ocr");
  assert.equal(item.title, "Attention Is All You Need");
  assert.equal(item.cover_url, "mock://document-cover.png");
});

test("recent jobs runtime patches do not prepend retry job_id shell after soft refresh", () => {
  // 回归（真实后端）：「重新渲染」换新 job_id，payload 常只有 job_id 当标题；
  // soft refresh 不得再 prepend 一张「job_id + PDF 占位」空壳（原书还在）。
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "20260717220928-50d025",
        document_id: "doc-multipole",
        title: "multipole-expansion-of-atomic.pdf",
        cover_url: "http://example/cover.jpg",
        page_count: 14,
        status: "succeeded",
        display_stage: "done",
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "20260717220928-50d025",
    status: "succeeded",
    display_stage: "done",
  });
  // 真实重试首帧：无 document_id、title=新 job_id
  patches.update({
    job_id: "20260717235341-af4675",
    source_job_id: "20260717220928-50d025",
    title: "20260717235341-af4675",
    status: "running",
    display_stage: "render",
  });

  assert.equal(statePort.getSnapshot().items.length, 1);
  assert.equal(statePort.getSnapshot().items[0].job_id, "20260717235341-af4675");
  assert.equal(statePort.getSnapshot().items[0].title, "multipole-expansion-of-atomic.pdf");
  assert.equal(statePort.getSnapshot().items[0].status, "running");

  const afterRefresh = patches.apply([
    {
      job_id: "20260717220928-50d025",
      document_id: "doc-multipole",
      title: "multipole-expansion-of-atomic.pdf",
      cover_url: "http://example/cover.jpg",
      page_count: 14,
      status: "succeeded",
      display_stage: "done",
    },
  ]);
  assert.equal(afterRefresh.length, 1, "must not prepend orphan shell");
  assert.equal(afterRefresh[0].title, "multipole-expansion-of-atomic.pdf");
  assert.notEqual(afterRefresh[0].title, afterRefresh[0].job_id);
});

test("recent jobs runtime patches keep job-only submit frames out of the document library", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "doc:doc-quindics",
        document_id: "doc-quindics",
        title: "ijsrp-p3679",
        status: "succeeded",
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  // `/jobs` 创建首帧没有 document_id/title，不能在书架生成 job_id 空壳卡。
  patches.insert({
    job_id: "20260901234509-3a4c2d",
    status: "running",
    display_stage: "translation",
  });
  assert.deepEqual(statePort.getSnapshot().items.map((item) => item.title), ["ijsrp-p3679"]);

  // `/documents` 随后的权威投影会带 active job，缓存补丁在原书卡上继续显示进度。
  const refreshed = patches.apply([
    {
      job_id: "20260901234509-3a4c2d",
      active_job_id: "20260901234509-3a4c2d",
      document_id: "doc-quindics",
      title: "ijsrp-p3679",
      status: "running",
      display_stage: "translation",
    },
  ]);
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].document_id, "doc-quindics");
  assert.equal(refreshed[0].title, "ijsrp-p3679");
  assert.equal(refreshed[0].job_id, "20260901234509-3a4c2d");
  assert.equal(refreshed[0].status, "running");
});

test("recent jobs runtime patch rewrites the item in the store (the list re-renders from the store)", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 10,
    recentJobsHasMore: true,
    recentJobsItems: [
      {
        job_id: "job-rerender-miss",
        status: "running",
        stage: "ocr",
        stage_detail: "OCR 中",
        progress: { current: 1, total: 10, percent: 10, unit: "page" },
      },
    ],
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.update({
    job_id: "job-rerender-miss",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { current: 4, total: 20, unit: "batch" },
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.stage, "translate");
  assert.deepEqual(item.progress, {
    current: 4,
    total: 20,
    percent: 20,
    unit: "batch",
  });
});

test("recent jobs runtime patches keep active created jobs across reset refreshes", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.insert({
    job_id: "job-created-active",
    document_id: "doc-created-active",
    title: "created-active.pdf",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, unit: "page" },
  });

  const refreshedItems = patches.apply([
    { job_id: "job-existing", status: "succeeded", display_stage: "done" },
  ]);

  assert.deepEqual(refreshedItems.map((item) => item.job_id), [
    "job-created-active",
    "job-existing",
  ]);
  assert.equal(refreshedItems[0].stage, "ocr");
  assert.equal(refreshedItems[0].status, "running");
});

test("recent jobs runtime patches keep translation card state over background render prewarm", () => {
  const previous = mergeLibraryJobItem({
    job_id: "job-parallel-recent",
    title: "parallel.pdf",
    display_name: "parallel.pdf",
    status: "running",
    stage: "translate",
    display_stage: "translation",
    lane: "main",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 120,
      total: 900,
      percent: 13.3333333333,
    },
  }, {
    job_id: "job-parallel-recent",
    status: "running",
    display_stage: "translation",
    lane: "main",
    substage: "translation_batches",
    progress: {
      unit: "batch",
      current: 120,
      total: 900,
      percent: 13.3333333333,
    },
  }, { stageAdapterPort: { adaptJobStageSnapshot } });

  const merged = mergeLibraryJobItem(previous, {
    job_id: "job-parallel-recent",
    status: "running",
    lane: "background",
    display_stage: "render",
    stage: "render_preprocess",
    substage: "render_prewarm",
    progress: {
      unit: "step",
      current: 2,
      total: 3,
      percent: 66.6666666667,
    },
  }, { stageAdapterPort: { adaptJobStageSnapshot } });

  assert.equal(stageKeyForRecentJobLabel(merged), "translate");
  assert.equal(recentJobStageLabel(merged), "翻译中");
  assert.equal(merged.display_stage, "translation");
  assert.equal(merged.lane, "main");
  assert.equal(merged.substage, "translation_batches");
  assert.equal(merged.runtime_status.stageKey, "translate");
  assert.equal(merged.runtime_status.lane, "main");
  assert.equal(merged.progress.unit, "batch");
  assert.equal(merged.progress.current, 120);
  assert.equal(merged.progress.total, 900);
  assert.equal(merged.background_stages.length, 1);
  assert.equal(merged.background_stages[0].display_stage, "render");
  assert.equal(merged.background_stages[0].substage, "render_prewarm");
  assert.equal(merged.background_stages[0].progress.current, 2);
});

test("recent jobs runtime patches keep completed created jobs until backend list catches up", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.insert({
    job_id: "job-created-fast-complete",
    document_id: "doc-created-fast-complete",
    title: "created-fast-complete.pdf",
    status: "running",
    display_stage: "translation",
    progress: { current: 9, total: 10, unit: "batch" },
  });
  patches.update({
    job_id: "job-created-fast-complete",
    status: "succeeded",
    display_stage: "done",
    progress: { current: 10, total: 10, unit: "batch", percent: 100 },
  });

  const refreshedItems = patches.apply([
    { job_id: "job-existing", status: "succeeded", display_stage: "done" },
  ]);

  assert.deepEqual(refreshedItems.map((item) => item.job_id), [
    "job-created-fast-complete",
    "job-existing",
  ]);
  assert.equal(refreshedItems[0].status, "succeeded");
  assert.equal(refreshedItems[0].display_stage, "done");
  assert.equal(refreshedItems[0].progress.percent, 100);
});

test("recent jobs runtime patches drive active cover overlay from created job to completion", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const mutations = [];
  const unsubscribe = statePort.subscribe((snapshot, meta = {}) => {
    mutations.push({
      action: meta.action,
      items: snapshot.items.map((item) => ({
        job_id: item.job_id,
        active: isRecentJobActive(item),
        label: recentJobStageLabel(item),
        percent: recentJobProgressPercent(item),
      })),
    });
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.insert({
    job_id: "job-created-overlay",
    document_id: "doc-created-overlay",
    title: "created-overlay.pdf",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, percent: 10, unit: "page" },
  });
  let item = statePort.getSnapshot().items[0];
  assert.equal(item.job_id, "job-created-overlay");
  assert.equal(isRecentJobActive(item), true);
  assert.equal(recentJobStageLabel(item), "OCR 中");
  assert.equal(recentJobProgressPercent(item), 10);

  patches.update({
    job_id: "job-created-overlay",
    status: "running",
    display_stage: "translation",
    substage: "translation_batches",
    progress: { current: 4, total: 20, percent: 20, unit: "batch" },
  });
  item = statePort.getSnapshot().items[0];
  assert.equal(isRecentJobActive(item), true);
  assert.equal(recentJobStageLabel(item), "翻译中");
  assert.equal(recentJobProgressPercent(item), 20);

  patches.update({
    job_id: "job-created-overlay",
    status: "succeeded",
    display_stage: "done",
    progress: { current: 20, total: 20, percent: 100, unit: "batch" },
  });
  item = statePort.getSnapshot().items[0];
  assert.equal(item.status, "succeeded");
  assert.equal(item.display_stage, "done");
  assert.equal(isRecentJobActive(item), false);
  assert.equal(recentJobStageLabel(item), "已完成");
  assert.equal(recentJobProgressPercent(item), 100);
  unsubscribe();
  const cardMutations = mutations.filter((entry) => entry.action === "prependItem" || entry.action === "replaceItem");
  assert.deepEqual(cardMutations.map((entry) => [entry.action, entry.items[0]?.active, entry.items[0]?.label, entry.items[0]?.percent]), [
    ["prependItem", true, "OCR 中", 10],
    ["replaceItem", true, "翻译中", 20],
    ["replaceItem", false, "已完成", 100],
  ]);
});

test("recent jobs runtime patches ignore ocr child jobs when inserting created cards", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.insert({
    job_id: "job-parent-ocr",
    workflow: "ocr",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, percent: 10, unit: "page" },
  });

  assert.deepEqual(statePort.getSnapshot().items, []);
  assert.deepEqual(patches.apply([{ job_id: "job-parent", status: "running" }]).map((item) => item.job_id), [
    "job-parent",
  ]);
});

test("recent jobs runtime patches insert standalone ocr root jobs", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.insert({
    job_id: "job-ocr-root",
    document_id: "doc-ocr-root",
    workflow: "ocr",
    title: "OCR source.pdf",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, percent: 10, unit: "page" },
  });

  assert.equal(statePort.getSnapshot().items.length, 1);
  assert.equal(statePort.getSnapshot().items[0].job_id, "job-ocr-root");
  assert.equal(statePort.getSnapshot().items[0].workflow, "ocr");
});

test("recent jobs runtime patches do not let queued placeholders downgrade created running cards", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [],
    recentJobsHasMore: true,
  });
  const patches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  patches.insert({
    job_id: "job-created-placeholder",
    document_id: "doc-created-placeholder",
    title: "real-book.pdf",
    status: "running",
    display_stage: "translation",
    source_file_name: "real-book.pdf",
    progress: { current: 4, total: 20, percent: 20, unit: "batch" },
  });
  patches.update({
    job_id: "job-created-placeholder",
    status: "queued",
    display_stage: "ocr",
    stage_detail: "正在读取任务状态...",
  });

  const item = statePort.getSnapshot().items[0];
  assert.equal(item.status, "running");
  assert.equal(item.display_stage, "translation");
  assert.equal(item.source_file_name, "real-book.pdf");
  assert.equal(item.progress.current, 4);
  assert.equal(item.progress.percent, 20);
  assert.equal(isRecentJobActive(item), true);
  assert.equal(recentJobStageLabel(item), "翻译中");
});
