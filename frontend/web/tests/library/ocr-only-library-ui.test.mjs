import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  isOcrOnlyItem,
  resolveLibraryReadPresentation,
} from "../../src/features/library/domain/card/library-card-semantics.js";
import {
  isLibraryCardProcessing,
  libraryCardBadge,
} from "../../src/features/library/domain/card/library-card-badge.js";
import { buildReadBookCardAction } from "../../src/features/library/domain/actions/read.js";
import { BookCard, cardSignatureOf } from "../../src/features/library/ui/shell/BookCard.js";
import { BookListRow } from "../../src/features/library/ui/shell/BookListRow.js";
import {
  countLibraryStatusFilters,
  matchesLibraryFilter,
  STATUS_FILTERS,
} from "../../src/features/library/ui/page/LibraryFilterMenu.js";

const ocrDone = {
  job_id: "job-ocr",
  document_id: "doc-ocr",
  workflow: "ocr",
  status: "succeeded",
  display_stage: "ocr",
  substage: "ocr_result_ready",
  title: "OCR 文档",
  page_count: 8,
};
const translatedDone = {
  job_id: "job-book",
  document_id: "doc-book",
  workflow: "book",
  status: "succeeded",
  display_stage: "done",
  title: "翻译文档",
  page_count: 8,
};

const filterDependencies = {
  isLibraryOnly: (item) => item.library_only === true,
  isActive: (item) => ["queued", "running", "pending"].includes(`${item.status || ""}`),
};

test("OCR-only 徽标和阅读语义与翻译成功明确区分", () => {
  assert.equal(isOcrOnlyItem(ocrDone), true);
  assert.equal(isOcrOnlyItem({ ...ocrDone, workflow: "", job_type: "ocr" }), true);
  assert.deepEqual(libraryCardBadge(ocrDone), {
    label: "OCR 完成",
    icon: "scan-text",
    cls: "bg-secondary text-secondary-foreground",
  });
  assert.deepEqual(libraryCardBadge(translatedDone), {
    label: "已翻译",
    icon: "languages",
    cls: "bg-primary text-primary-foreground",
  });
  assert.equal(isLibraryCardProcessing(ocrDone), false, "OCR succeeded + stage=ocr 是真实终态");

  const translatedRetryDirtyState = {
    ...translatedDone,
    display_stage: "ocr",
    substage: "provider_processing",
  };
  assert.equal(
    isLibraryCardProcessing(translatedRetryDirtyState),
    true,
    "非 OCR succeeded + stage=ocr 仍按重试脏态显示处理中",
  );
  assert.equal(libraryCardBadge(translatedRetryDirtyState), null);

  assert.deepEqual(resolveLibraryReadPresentation(ocrDone), {
    label: "查看 OCR",
    target: "job",
    jobId: "job-ocr",
    documentId: "doc-ocr",
  });
  assert.equal(resolveLibraryReadPresentation(translatedDone).label, "对照阅读");
  assert.equal(resolveLibraryReadPresentation({ document_id: "doc-source" }).label, "读原文");
});

test("OCR-only 阅读动作保留 job 上下文，不降级为只读源文件", () => {
  const calls = [];
  const [action] = buildReadBookCardAction(ocrDone, {
    onReader: (jobId, documentId) => calls.push(["job", jobId, documentId]),
    onReadSource: (documentId) => calls.push(["source", documentId]),
  });
  assert.equal(action.label, "查看 OCR");
  action.onClick();
  assert.deepEqual(calls, [["job", "job-ocr", "doc-ocr"]]);
});

test("状态筛选将仅收藏、仅 OCR、已翻译和处理中分别计数", () => {
  assert.deepEqual(STATUS_FILTERS.map(({ value, label }) => [value, label]), [
    ["all", "全部"],
    ["untranslated", "仅收藏"],
    ["ocr", "仅 OCR"],
    ["done", "已翻译"],
    ["active", "处理中"],
    ["failed", "失败"],
  ]);

  const libraryOnly = { job_id: "doc:library", document_id: "library", library_only: true };
  const ocrRunning = { ...ocrDone, job_id: "job-ocr-running", status: "running" };
  const failed = { job_id: "job-failed", workflow: "book", status: "failed" };
  const items = [libraryOnly, ocrDone, translatedDone, ocrRunning, failed];

  assert.deepEqual(countLibraryStatusFilters(items, filterDependencies), {
    done: 1,
    untranslated: 1,
    ocr: 1,
    active: 1,
    failed: 1,
  });
  assert.equal(matchesLibraryFilter(ocrDone, "ocr", "", filterDependencies), true);
  assert.equal(matchesLibraryFilter(ocrDone, "done", "", filterDependencies), false);
  assert.equal(matchesLibraryFilter(translatedDone, "done", "", filterDependencies), true);
  assert.equal(matchesLibraryFilter(ocrRunning, "active", "", filterDependencies), true);
  assert.equal(matchesLibraryFilter(libraryOnly, "untranslated", "", filterDependencies), true);
});

test("网格与列表输出 OCR 完成和查看 OCR，memo 签名包含 workflow/job_type", () => {
  const gridMarkup = renderToStaticMarkup(React.createElement(BookCard, {
    item: ocrDone,
    onReader() {},
    onReadSource() {},
  }));
  const listMarkup = renderToStaticMarkup(React.createElement(BookListRow, {
    item: ocrDone,
    onReader() {},
    onReadSource() {},
  }));

  for (const markup of [gridMarkup, listMarkup]) {
    assert.match(markup, /data-badge-label="OCR 完成"/);
    assert.match(markup, /aria-label="查看 OCR"/);
    assert.doesNotMatch(markup, /已翻译|aria-label="对照阅读"/);
  }

  assert.notEqual(
    cardSignatureOf({ ...ocrDone, workflow: "ocr" }),
    cardSignatureOf({ ...ocrDone, workflow: "book" }),
  );
  assert.notEqual(
    cardSignatureOf({ ...ocrDone, workflow: "", job_type: "ocr" }),
    cardSignatureOf({ ...ocrDone, workflow: "", job_type: "book" }),
  );
});
