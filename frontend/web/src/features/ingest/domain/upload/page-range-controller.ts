import type { PageCap } from "./ports.js";
// 页码区间的编排：把纯计算（page-ranges.ts）落到 viewPort 与 upload state。
//
// 负责 constrain / validate / open / clear / summary 这组交互，
// 读快照与写 applied 页码分别走注入的访问器。

import type { UploadState } from "./state.js";
import type { ConstrainPageRangesOptions, UploadViewPort } from "./ports.js";
import {
  constrainPageRangeValues,
  normalizePageRangeValue,
  resolvePageRangeLimit,
  validatePageRangeValues,
} from "./page-ranges.js";

export interface PageRangeControllerDeps {
  viewPort: UploadViewPort;
  readUploadState: () => UploadState;
  updateAppliedPageRange: (value?: string) => UploadState;
  resetAppliedPageRange: () => UploadState;
  refreshSubmitControls: () => void;
  setText: (id: string, value?: unknown) => void;
  frontMaxPageCount: PageCap;
  workflowNeedsUpload: (workflow?: string) => boolean;
}

export function createPageRangeController({
  viewPort,
  readUploadState,
  updateAppliedPageRange,
  resetAppliedPageRange,
  refreshSubmitControls,
  setText,
  frontMaxPageCount,
  workflowNeedsUpload,
}: PageRangeControllerDeps) {
  function pageRangeLimit(): number {
    return resolvePageRangeLimit(readUploadState().uploadedPageCount || 0, frontMaxPageCount);
  }

  function currentPageRanges(): string {
    const { start, end } = viewPort.readPageRanges();
    return normalizePageRangeValue(start, end);
  }

  function constrainPageRanges({ source = "" }: ConstrainPageRangesOptions = {}) {
    const { start: rawStart, end: rawEnd } = viewPort.readPageRanges();
    const maxPage = pageRangeLimit();
    const next = constrainPageRangeValues({ start: rawStart, end: rawEnd, maxPage, source });
    viewPort.writePageRanges({ start: next.start, end: next.end });
    updateAppliedPageRange(normalizePageRangeValue(next.start, next.end));
    refreshSubmitControls();
    return { start: next.start, end: next.end, maxPage: next.maxPage };
  }

  function validatePageRanges(): boolean {
    const { start: rawStart, end: rawEnd } = viewPort.readPageRanges();
    const maxPage = pageRangeLimit();
    const result = validatePageRangeValues({ start: rawStart, end: rawEnd, maxPage });
    if (!result.ok) {
      setText("error-box", result.message);
      return false;
    }
    updateAppliedPageRange(normalizePageRangeValue(rawStart.trim(), rawEnd.trim()));
    return true;
  }

  function renderPageRangeSummary(): void {
    const snapshot = readUploadState();
    viewPort.setInlinePageRangeVisible(workflowNeedsUpload() && Boolean(snapshot.uploadId));
  }

  function openTranslationOptions(): void {
    const snapshot = readUploadState();
    viewPort.openTranslationOptions({
      applied: snapshot.appliedPageRange || "",
      maxPage: pageRangeLimit(),
    });
  }

  function applyPageRanges(): void {
    viewPort.closeTranslationOptions();
  }

  function clearPageRanges(): void {
    viewPort.clearPageRanges();
    resetAppliedPageRange();
    renderPageRangeSummary();
    refreshSubmitControls();
    viewPort.closeTranslationOptions();
  }

  return {
    applyPageRanges,
    clearPageRanges,
    constrainPageRanges,
    currentPageRanges,
    openTranslationOptions,
    renderPageRangeSummary,
    validatePageRanges,
  };
}
