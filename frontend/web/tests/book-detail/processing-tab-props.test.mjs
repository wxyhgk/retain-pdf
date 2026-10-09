/** 「进度」页参数拼装（buildProcessingTabProps）：以前写在弹窗 JSX 里、交给 any 类型的页签。 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildProcessingTabProps } from "../../src/features/book-detail/ui/processing-tab-props.js";

const noop = () => {};
function input(overrides = {}) {
  return {
    open: true,
    activeTab: "processing",
    item: { document_id: "doc-1", title: "书" },
    pageCount: 12,
    busy: "",
    error: "",
    documentJobs: { latestTranslation: null, ocrStatusJob: null, reusableOcr: null },
    ocrState: { rangeOn: false, pageSpec: "", pending: false, cancelling: false, error: "", setRangeOn: noop, setPageSpec: noop, handleOcr: noop, handleCancel: noop },
    translateState: { rangeOn: false, pageSpec: "", setRangeOn: noop, setPageSpec: noop, handleTranslate: async () => {} },
    stageActionState: { stageActions: [], loading: false, pendingStage: "", error: "", retry: async () => null },
    translationStatus: { label: "尚未翻译", tone: "muted" },
    translationActive: false,
    translationSucceeded: false,
    canTranslate: true,
    readerAvailable: false,
    documentJobIds: [],
    onOpenLiveReader: noop,
    ...overrides,
  };
}

test("还没翻译过：给一个没有 job_id 的空任务，可以翻译", () => {
  const { translation, ocr } = buildProcessingTabProps(input());
  assert.equal(translation.item.job_id, "");
  assert.equal(translation.item.library_only, true);
  assert.equal(translation.item.document_id, "doc-1", "保留书本身的字段");
  assert.equal(translation.canTranslate, true);
  assert.equal(translation.tabActive, true);
  assert.equal(ocr.pageCount, 12);
});

test("OCR 提交待定期间不能同时发起翻译", () => {
  const base = input();
  const { translation } = buildProcessingTabProps(input({ ocrState: { ...base.ocrState, pending: true } }));
  assert.equal(translation.canTranslate, false);
});

test("有翻译任务：任务字段盖在书上，复用的 OCR 只带 job_id", () => {
  const { translation } = buildProcessingTabProps(input({
    activeTab: "overview",
    documentJobs: {
      latestTranslation: { job_id: "job-t", status: "succeeded", workflow: "book" },
      ocrStatusJob: null,
      reusableOcr: { id: "job-ocr", status: "succeeded" },
    },
    translationSucceeded: true,
  }));
  assert.equal(translation.item.job_id, "job-t");
  assert.equal(translation.item.library_only, false);
  assert.deepEqual(translation.ocrReuse, { jobId: "job-ocr" });
  assert.equal(translation.readerAvailable, true);
  assert.equal(translation.tabActive, false);
});
