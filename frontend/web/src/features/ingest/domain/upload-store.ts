import { createStore } from "@/platform/store/store.js";
import { DEFAULT_FILE_LABEL } from "@/platform/config/upload-constants.js";
import type { Store } from "@/platform/store/store.js";

// upload 域视图 store + React viewPort（已归入 workflow 域）。
//
// 旧世界 features/upload/upload-view-port.js + tile-view.js 直接写 DOM;
// React 世界里 mountUploadFeature(纯逻辑控制器,原样复用)拿到的是本文件
// 生成的 viewPort:所有"写视图"落到 store,由 UploadTile 订阅渲染;
// "读视图"(selectedFile/readPageRanges)从 domRefs / store 取。
// 各方法语义逐条镜像 tile-view.js / view.js / ui/job-actions-view.js。
//
// 注意:File 对象不进 store(store 会 structuredClone 深拷贝),
// 文件本体始终从 domRefs.fileInput(React ref 回填)读取。

export type UploadViewState = {
  tileLocked: boolean;
  tileEnabled: boolean;
  ready: boolean;
  uploading: boolean;
  label: string;
  labelTitle: string;
  labelVisible: boolean;
  help: string;
  helpVisible: boolean;
  status: string;
  statusVisible: boolean;
  progressVisible: boolean;
  progressPercent: number;
  progressText: string;
  actionSlotVisible: boolean;
  inlinePageRangeVisible: boolean;
  pageRangeStart: string;
  pageRangeEnd: string;
  pageRangeMax: number;
  pageRangeDialogOpen: boolean;
  credentialGateVisible: boolean;
};

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
  openPageRangeDialog(
    currentState: UploadViewState,
    options?: UploadPageRangeDialogOptions,
  ): UploadViewState;
  closePageRangeDialog(currentState: UploadViewState): UploadViewState;
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

export type UploadViewStore = Store<UploadViewState, UploadViewActions>;

export type UploadTileLockedOptions = {
  locked?: boolean;
  enabled?: boolean;
};

export type UploadTileTextOptions = {
  label?: string;
  labelTitle?: string;
  help?: string;
  status?: string;
  statusVisible?: boolean | null;
  labelVisible?: boolean;
  helpVisible?: boolean;
};

export type UploadPageRangeDialogOptions = {
  maxPage?: number;
};

export type UploadPageRangesWrite = {
  start?: string | number;
  end?: string | number;
};

export type UploadFileLabelSource = {
  name?: string;
} | null | undefined;

export type UploadDomRefs = {
  fileInput: HTMLInputElement | null;
};

// 初始值镜像 旧世界 HTML 骨架(已删除) 的静态骨架(水合前状态)
export function createUploadViewStore(): UploadViewStore {
  return createStore<UploadViewState, UploadViewActions>({
    name: "homeUploadView",
    initialState: {
      tileLocked: false,
      tileEnabled: true,
      ready: false,
      uploading: false,
      label: "添加 PDF",
      labelTitle: "",
      labelVisible: true,
      help: "上传后会先完成文件校验，再进入任务处理。",
      helpVisible: true,
      status: "尚未选择文件",
      statusVisible: false,
      progressVisible: false,
      progressPercent: 0,
      progressText: "上传中",
      actionSlotVisible: false,
      inlinePageRangeVisible: false,
      pageRangeStart: "",
      pageRangeEnd: "",
      pageRangeMax: 0,
      pageRangeDialogOpen: false,
      credentialGateVisible: false,
    },
    actions: {
      // 管卡片锁定态：上传中/禁用时锁住点击，只改 tileLocked + tileEnabled。
      setTileLocked(currentState, options = {}) {
        const locked = Boolean(options.locked);
        const enabled = options.enabled ?? !locked;
        return { ...currentState, tileLocked: locked, tileEnabled: Boolean(enabled) };
      },
      // 管卡片文案：文件名/帮助/状态三行文本及其显隐，只写 label/help/status 系字段。
      setTileText(currentState, options = {}) {
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
      },
      // 管就绪态：标记文件已可提交；置 ready 时顺手清掉进度条残留。
      setTileReady(currentState, ready = false) {
        const isReady = Boolean(ready);
        return {
          ...currentState,
          ready: isReady,
          uploading: false,
          ...(isReady
            ? { progressVisible: false, progressPercent: 0, progressText: "上传中" }
            : {}),
        };
      },
      // 管处理方式区显隐：文件就绪后露出 OCR/翻译/仅收藏按钮组。
      setActionSlotVisible(currentState, visible = false) {
        return { ...currentState, actionSlotVisible: Boolean(visible) };
      },
      // 管上传进度：写进度条百分比+文案，同时切到 uploading、收起处理方式区。
      setProgress(currentState, payload = {}) {
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
      },
      // 管进度复位：隐藏进度条并清 uploading，保留文件名与页码。
      resetProgress(currentState) {
        return {
          ...currentState,
          progressVisible: false,
          uploading: false,
          progressPercent: 0,
          progressText: "上传中",
        };
      },
      // 管文件视图复位：回到“未上传文件”空态，文件名回默认、收起处理方式区。
      resetUploadedFileView(currentState) {
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
      },
      // 管页码清空：对话框重开/空表单时清 start/end，不碰弹窗开关。
      clearPageRanges(currentState) {
        return { ...currentState, pageRangeStart: "", pageRangeEnd: "" };
      },
      // 管页码写入：按需更新 start/end 单侧，输入统一转字符串。
      setPageRange(currentState, payload = {}) {
        const next: Partial<UploadViewState> = { ...currentState };
        if (payload.start !== undefined) next.pageRangeStart = `${payload.start}`;
        if (payload.end !== undefined) next.pageRangeEnd = `${payload.end}`;
        return next as UploadViewState;
      },
      // 管选项弹窗打开：立起 pageRangeDialogOpen 并记录最大页数供校验。
      openPageRangeDialog(currentState, options = {}) {
        const maxPage = Number(options.maxPage ?? 0);
        return {
          ...currentState,
          pageRangeDialogOpen: true,
          pageRangeMax: maxPage > 0 ? Math.floor(maxPage) : 0,
        };
      },
      // 管选项弹窗关闭：只落开关，保留已填页码以便下次回显。
      closePageRangeDialog(currentState) {
        return { ...currentState, pageRangeDialogOpen: false };
      },
      // 管内联页码区显隐：旧内联表单开关，新 UI 默认关闭。
      setInlinePageRangeVisible(currentState, visible = false) {
        return { ...currentState, inlinePageRangeVisible: Boolean(visible) };
      },
      /** @deprecated 兼容装配层/旧测试，新代码用细粒度 action */
      patch(currentState, payload = {}) {
        return { ...currentState, ...payload };
      },
    },
  });
}

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

  function setUploadActionSlotVisible(visible: boolean) {
    store.actions.setActionSlotVisible(visible);
  }

  // ---- ui/job-actions-view.js 镜像(上传进度/复位链) ----

  function setUploadProgress(loaded: number, total: number) {
    const hasNumbers = Number.isFinite(loaded) && Number.isFinite(total) && total > 0;
    const percent = hasNumbers
      ? Math.max(0, Math.min(100, (loaded / total) * 100))
      : 18;
    store.actions.setProgress({
      percent,
      text: hasNumbers ? `上传中 ${percent.toFixed(0)}%` : "上传中",
    });
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

  function openPageRangeDialog(options: UploadPageRangeDialogOptions = {}) {
    store.actions.openPageRangeDialog(options);
  }

  function closePageRangeDialog() {
    store.actions.closePageRangeDialog();
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
    closePageRangeDialog: () => store.actions.closePageRangeDialog(),
    markUploadReady: (ready: boolean) => setUploadTileReady(ready),
    openPageRangeDialog: ({ maxPage = 0 }: UploadPageRangeDialogOptions = {}) =>
      store.actions.openPageRangeDialog({ maxPage }),
    readPageRanges: () => {
      const snapshot = store.getSnapshot();
      return { start: snapshot.pageRangeStart || "", end: snapshot.pageRangeEnd || "" };
    },
    selectedFile: (): File | null => domRefs.fileInput?.files?.[0] || null,
    setFileLabel: (file: UploadFileLabelSource, defaultFileLabel: string) => {
      const name = file?.name ? `${file.name}` : "";
      return setUploadTileText({
        label: name || defaultFileLabel,
        labelTitle: name,
      });
    },
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
    closePageRangeDialog,
    domRefs,
    openPageRangeDialog,
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
