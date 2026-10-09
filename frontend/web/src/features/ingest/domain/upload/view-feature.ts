// upload 域的 React viewPort 工厂。
//
// React 世界里 mountUploadFeature(纯逻辑控制器)拿到的是本文件生成的 viewPort：
// 所有"写视图"落到 store，由 UploadTile 订阅渲染；"读视图"(selectedFile/
// readPageRanges)从 domRefs / store 取。各方法语义逐条镜像 tile-view.js /
// view.js / ui/job-actions-view.js。
//
// 注意:File 对象不进 store(store 会 structuredClone 深拷贝)，
// 文件本体始终从 domRefs.fileInput(React ref 回填)读取。

import { createUploadViewStore, type UploadViewStore } from "./view-store.js";
import type {
  TranslationOptionsOpenOptions,
  UploadDomRefs,
  UploadFileLabelSource,
  UploadPageRangesWrite,
  UploadTileLockedOptions,
  UploadTileTextOptions,
  UploadViewState,
} from "./view-state.js";
import { resolveFileLabel, resolveUploadProgress } from "./view-derivations.js";

export function createUploadViewFeature({
  store = createUploadViewStore(),
}: {
  store?: UploadViewStore;
} = {}) {
  // React ref 回填点:UploadTile 挂载 #file 后写入
  const domRefs: UploadDomRefs = { fileInput: null };

  /** @deprecated 兼容装配层/旧测试，新代码用细粒度 action */
  const patch = (payload: Partial<UploadViewState> = {}) => store.actions.patch(payload);

  // ---- tile-view.js 镜像(workflow viewPort 经 uploadTilePort 也走这组) ----

  function setUploadTileLocked({
    locked = false,
    enabled = !locked,
  }: UploadTileLockedOptions = {}) {
    store.actions.setTileLocked({ locked, enabled });
  }

  function setUploadTileText({
    label = "",
    labelTitle = "",
    help = "",
    status = "",
    statusVisible = null,
    labelVisible = true,
    helpVisible = true,
  }: UploadTileTextOptions = {}) {
    store.actions.setTileText({
      label,
      labelTitle,
      help,
      status,
      statusVisible,
      labelVisible,
      helpVisible,
    });
  }

  function setUploadTileReady(ready: boolean) {
    store.actions.setTileReady(ready);
  }

  function setUploadActionSlotVisible(visible?: boolean) {
    store.actions.setActionSlotVisible(visible);
  }

  // ---- ui/job-actions-view.js 镜像(上传进度/复位链) ----

  function setUploadProgress(loaded: number, total: number) {
    store.actions.setProgress(resolveUploadProgress(loaded, total));
  }

  function resetUploadProgress() {
    store.actions.resetProgress();
  }

  function clearFileInputValue() {
    if (domRefs.fileInput) {
      domRefs.fileInput.value = "";
    }
  }

  // 视图侧复位(resetUploadedFileView 口径);上传状态归零由 composition 补上
  function resetUploadedFileView() {
    clearFileInputValue();
    store.actions.resetUploadedFileView();
  }

  function setPageRange(payload: { start?: string | number; end?: string | number } = {}) {
    store.actions.setPageRange(payload);
  }

  function openTranslationOptions(options: TranslationOptionsOpenOptions = {}) {
    store.actions.openTranslationOptions(options);
  }

  function closeTranslationOptions() {
    store.actions.closeTranslationOptions();
  }

  function setInlinePageRangeVisible(visible: boolean) {
    store.actions.setInlinePageRangeVisible(visible);
  }

  function clearPageRanges() {
    store.actions.clearPageRanges();
  }

  // ---- features/upload/view.js 镜像(mountUploadFeature 的 viewPort 契约) ----

  const viewPort = {
    clearPageRanges: () => store.actions.clearPageRanges(),
    closeTranslationOptions: () => store.actions.closeTranslationOptions(),
    markUploadReady: (ready: boolean) => setUploadTileReady(ready),
    openTranslationOptions: ({ maxPage = 0 }: TranslationOptionsOpenOptions = {}) =>
      store.actions.openTranslationOptions({ maxPage }),
    readPageRanges: () => {
      const snapshot = store.getSnapshot();
      return { start: snapshot.pageRangeStart || "", end: snapshot.pageRangeEnd || "" };
    },
    selectedFile: (): File | null => domRefs.fileInput?.files?.[0] || null,
    setFileLabel: (file: UploadFileLabelSource, defaultFileLabel: string) =>
      setUploadTileText(resolveFileLabel(file, defaultFileLabel)),
    setInlinePageRangeVisible: (visible: boolean) =>
      store.actions.setInlinePageRangeVisible(visible),
    showUploadStatus: (message: string) =>
      setUploadTileText({ status: message, statusVisible: true }),
    writePageRanges: ({ start = "", end = "" }: UploadPageRangesWrite = {}) =>
      store.actions.setPageRange({ start: `${start}`, end: `${end}` }),
  };

  const uploadTilePort = {
    setUploadActionSlotVisible,
    setUploadTileLocked,
    setUploadTileText,
  };

  return {
    clearFileInputValue,
    clearPageRanges,
    closeTranslationOptions,
    domRefs,
    openTranslationOptions,
    patch,
    resetUploadProgress,
    resetUploadedFileView,
    setInlinePageRangeVisible,
    setPageRange,
    setUploadProgress,
    store,
    uploadTilePort,
    viewPort,
  };
}
