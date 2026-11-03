// 上传控制的装配根。
//
// 关注点已拆到聚焦模块：
//   page-ranges.ts            页码区间的纯计算
//   page-range-controller.ts  页码区间的编排（落 viewPort / state）
//   session.ts                上传会话复位
//   execution.ts              选文件后的上传执行
//   batch-file-upload.ts      一次上传多本时传其中一本（不碰单文件的界面状态）
//   state-access.ts           upload state 读写成对封装
//   ports.ts                  端口/契约类型
// 本文件只做依赖注入与对外 API 汇总，导出名与签名保持不变。

import { getUploadStatePort } from "./state.js";
import { defaultUploadConfigPort } from "./config-port.js";
import { createUploadStateAccess } from "./state-access.js";
import { createPageRangeController } from "./page-range-controller.js";
import { createUploadSessionController } from "./session.js";
import { createFileUploadHandler } from "./execution.js";
import { createBatchFileUploader } from "./batch-file-upload.js";
import { normalizePageRangeValue } from "./page-ranges.js";
import type { MountUploadFeatureOptions } from "./ports.js";

export type {
  ConstrainPageRangesOptions,
  MountUploadFeatureOptions,
  UploadConfigPortLike,
  UploadResponsePayload,
  UploadViewPort,
} from "./ports.js";

export function mountUploadFeature({
  uploadStatePort,
  apiPrefix,
  frontMaxBytes,
  frontMaxPageCount,
  pageLimitHint,
  countPdfPages,
  defaultFileLabel,
  collectUploadFormData,
  submitUploadRequest,
  resetUploadedFile,
  resetUploadProgress,
  setUploadProgress,
  clearFileInputValue,
  setText,
  applyWorkflowMode,
  refreshSubmitControls,
  refreshDeepSeekBalance,
  workflowNeedsUpload,
  configPort = defaultUploadConfigPort,
  viewPort,
}: MountUploadFeatureOptions) {
  const uploadState = uploadStatePort || getUploadStatePort();
  const {
    readUploadState,
    updateUploadState,
    updateAppliedPageRange,
    resetAppliedPageRange,
  } = createUploadStateAccess(uploadState);

  const pageRange = createPageRangeController({
    viewPort,
    readUploadState,
    updateAppliedPageRange,
    resetAppliedPageRange,
    refreshSubmitControls,
    setText,
    frontMaxPageCount,
    workflowNeedsUpload,
  });

  const session = createUploadSessionController({
    uploadState,
    readUploadState,
    resetUploadedFile,
    resetUploadProgress,
    clearFileInputValue,
    viewPort,
    renderPageRangeSummary: pageRange.renderPageRangeSummary,
    refreshSubmitControls,
  });

  const uploader = createFileUploadHandler({
    viewPort,
    uploadState,
    updateUploadState,
    updateAppliedPageRange,
    renderPageRangeSummary: pageRange.renderPageRangeSummary,
    currentPageRanges: pageRange.currentPageRanges,
    resetUploadedFile,
    resetUploadProgress,
    clearFileInputValue,
    setText,
    applyWorkflowMode,
    refreshSubmitControls,
    refreshDeepSeekBalance,
    configPort,
    apiPrefix,
    frontMaxBytes,
    frontMaxPageCount,
    pageLimitHint,
    countPdfPages,
    defaultFileLabel,
    collectUploadFormData,
    submitUploadRequest,
    setUploadProgress,
  });

  const batchUploader = createBatchFileUploader({
    configPort,
    apiPrefix,
    frontMaxBytes,
    frontMaxPageCount,
    pageLimitHint,
    countPdfPages,
    collectUploadFormData,
    submitUploadRequest,
  });

  return {
    applyPageRanges: pageRange.applyPageRanges,
    clearPageRanges: pageRange.clearPageRanges,
    constrainPageRanges: pageRange.constrainPageRanges,
    currentPageRanges: pageRange.currentPageRanges,
    handleFileSelected: uploader.handleFileSelected,
    uploadFileForBatch: batchUploader.uploadFile,
    normalizePageRangeValue,
    openTranslationOptions: pageRange.openTranslationOptions,
    renderPageRangeSummary: pageRange.renderPageRangeSummary,
    resetUploadSession: session.resetUploadSession,
    validatePageRanges: pageRange.validatePageRanges,
  };
}
