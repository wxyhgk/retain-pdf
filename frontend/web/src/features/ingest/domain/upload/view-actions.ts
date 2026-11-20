// upload 视图 store 的动作组（纯 reducer：state -> 新 state）。
//
// 从 upload-store.ts 抽出。每个函数只碰自己负责的字段，语义逐条镜像旧世界
// tile-view.js / view.js / ui/job-actions-view.js。

import { DEFAULT_FILE_LABEL } from "@/platform/config/upload-constants.js";
import type {
  TranslationOptionsOpenOptions,
  UploadTileLockedOptions,
  UploadTileTextOptions,
  UploadViewState,
} from "./view-state.js";

export type UploadViewActions = {
  setTileLocked(
    currentState: UploadViewState,
    options?: UploadTileLockedOptions,
  ): UploadViewState;
  setTileText(
    currentState: UploadViewState,
    options?: UploadTileTextOptions,
  ): UploadViewState;
  setTileReady(
    currentState: UploadViewState,
    ready?: boolean,
  ): UploadViewState;
  setActionSlotVisible(
    currentState: UploadViewState,
    visible?: boolean,
  ): UploadViewState;
  setProgress(
    currentState: UploadViewState,
    payload?: { percent?: number; text?: string },
  ): UploadViewState;
  resetProgress(currentState: UploadViewState): UploadViewState;
  resetUploadedFileView(currentState: UploadViewState): UploadViewState;
  clearPageRanges(currentState: UploadViewState): UploadViewState;
  setPageRange(
    currentState: UploadViewState,
    payload?: { start?: string | number; end?: string | number },
  ): UploadViewState;
  openTranslationOptions(
    currentState: UploadViewState,
    options?: TranslationOptionsOpenOptions,
  ): UploadViewState;
  closeTranslationOptions(currentState: UploadViewState): UploadViewState;
  setUploadedPageCount(currentState: UploadViewState, count?: number): UploadViewState;
  setInlinePageRangeVisible(
    currentState: UploadViewState,
    visible?: boolean,
  ): UploadViewState;
  /** @deprecated 兼容旧调用方/装配层，新代码用细粒度 action */
  patch(
    currentState: UploadViewState,
    payload?: Partial<UploadViewState>,
  ): UploadViewState;
};

// 管卡片锁定态：上传中/禁用时锁住点击，只改 tileLocked + tileEnabled。
function setTileLocked(currentState: UploadViewState, options: UploadTileLockedOptions = {}) {
  const locked = Boolean(options.locked);
  const enabled = options.enabled ?? !locked;
  return { ...currentState, tileLocked: locked, tileEnabled: Boolean(enabled) };
}

// 管卡片文案：文件名/帮助/状态三行文本及其显隐，只写 label/help/status 系字段。
function setTileText(currentState: UploadViewState, options: UploadTileTextOptions = {}) {
  const {
    label = "",
    labelTitle = "",
    help = "",
    status = "",
    statusVisible = null,
    labelVisible = true,
    helpVisible = true,
  } = options;
  const next: Partial<UploadViewState> = {
    labelVisible: Boolean(labelVisible),
    helpVisible: Boolean(helpVisible),
  };
  if (label) {
    next.label = label;
    next.labelTitle = labelTitle;
  }
  if (help) {
    next.help = help;
  }
  if (status) {
    next.status = status;
  }
  next.statusVisible = Boolean(statusVisible ?? Boolean(status));
  return { ...currentState, ...next };
}

// 管就绪态：标记文件已可提交；置 ready 时顺手清掉进度条残留。
function setTileReady(currentState: UploadViewState, ready = false) {
  const isReady = Boolean(ready);
  return {
    ...currentState,
    ready: isReady,
    uploading: false,
    ...(isReady
      ? { progressVisible: false, progressPercent: 0, progressText: "上传中" }
      : {}),
  };
}

// 管处理方式区显隐：文件就绪后露出 OCR/翻译/仅收藏按钮组。
function setActionSlotVisible(currentState: UploadViewState, visible = false) {
  return { ...currentState, actionSlotVisible: Boolean(visible) };
}

// 管上传进度：写进度条百分比+文案，同时切到 uploading、收起处理方式区。
function setProgress(
  currentState: UploadViewState,
  payload: { percent?: number; text?: string } = {},
) {
  const percent = Number(payload.percent ?? 0);
  const text = `${payload.text ?? "上传中"}`;
  return {
    ...currentState,
    progressVisible: true,
    uploading: true,
    ready: false,
    actionSlotVisible: false,
    progressPercent: percent,
    progressText: text,
  };
}

// 管进度复位：隐藏进度条并清 uploading，保留文件名与页码。
function resetProgress(currentState: UploadViewState) {
  return {
    ...currentState,
    progressVisible: false,
    uploading: false,
    progressPercent: 0,
    progressText: "上传中",
  };
}

// 管文件视图复位：回到"未上传文件"空态，文件名回默认、收起处理方式区。
function resetUploadedFileView(currentState: UploadViewState) {
  return {
    ...currentState,
    progressVisible: false,
    uploading: false,
    ready: false,
    progressPercent: 0,
    progressText: "上传中",
    actionSlotVisible: false,
    status: "未上传文件",
    statusVisible: false,
    label: DEFAULT_FILE_LABEL,
    labelTitle: "",
    labelVisible: true,
  };
}

// 管页码清空：对话框重开/空表单时清 start/end，不碰弹窗开关。
function clearPageRanges(currentState: UploadViewState) {
  return { ...currentState, pageRangeStart: "", pageRangeEnd: "" };
}

// 管页码写入：按需更新 start/end 单侧，输入统一转字符串。
function setPageRange(
  currentState: UploadViewState,
  payload: { start?: string | number; end?: string | number } = {},
) {
  const next: Partial<UploadViewState> = { ...currentState };
  if (payload.start !== undefined) next.pageRangeStart = `${payload.start}`;
  if (payload.end !== undefined) next.pageRangeEnd = `${payload.end}`;
  return next as UploadViewState;
}

// 翻译选项展开：立起 translationOptionsOpen 并记录最大页数供校验。
function openTranslationOptions(
  currentState: UploadViewState,
  options: TranslationOptionsOpenOptions = {},
) {
  const maxPage = Number(options.maxPage ?? 0);
  return {
    ...currentState,
    translationOptionsOpen: true,
    pageRangeMax: maxPage > 0 ? Math.floor(maxPage) : 0,
  };
}

// 传上去的 PDF 有几页。
function setUploadedPageCount(currentState: UploadViewState, count: number = 0) {
  const pages = Number(count);
  return { ...currentState, uploadedPageCount: Number.isFinite(pages) && pages > 0 ? Math.floor(pages) : 0 };
}

// 翻译选项收起：只落开关，保留已填页码以便下次回显。
function closeTranslationOptions(currentState: UploadViewState) {
  return { ...currentState, translationOptionsOpen: false };
}

// 管内联页码区显隐：旧内联表单开关，新 UI 默认关闭。
function setInlinePageRangeVisible(currentState: UploadViewState, visible = false) {
  return { ...currentState, inlinePageRangeVisible: Boolean(visible) };
}

/** @deprecated 兼容装配层/旧测试，新代码用细粒度 action */
function patch(currentState: UploadViewState, payload: Partial<UploadViewState> = {}) {
  return { ...currentState, ...payload };
}

export const uploadViewActions: UploadViewActions = {
  setTileLocked,
  setTileText,
  setTileReady,
  setActionSlotVisible,
  setProgress,
  resetProgress,
  resetUploadedFileView,
  clearPageRanges,
  setPageRange,
  setUploadedPageCount,
  openTranslationOptions,
  closeTranslationOptions,
  setInlinePageRangeVisible,
  patch,
};
