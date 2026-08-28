import {
  createStore,
  DEFAULT_FILE_LABEL,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// View store phạm vi upload + React viewPort.
//
// Trong thế giới cũ features/upload/upload-view-port.js + tile-view.js ghi thẳng DOM;
// trong thế giới React, mountUploadFeature (controller thuần logic, tái sử dụng nguyên
// trạng) nhận viewPort sinh ra từ file này: mọi thao tác "ghi view" đổ xuống store,
// do HeroUpload.jsx đăng ký render; "đọc view" (selectedFile/readPageRanges) lấy từ
// domRefs / store. Ngữ nghĩa từng phương thức lần lượt ánh theo tile-view.js / view.js /
// ui/job-actions-view.js.
//
// Lưu ý: đối tượng File không đi vào store (store structuredClone sao chép sâu), bản
// thân tệp luôn đọc từ domRefs.fileInput (React ref ghi ngược).

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

// Giá trị khởi tạo ánh theo khung tĩnh của partials/main-content.html (trạng thái
// trước khi hydrate)
export function createUploadViewStore(): UploadViewStore {
  return createStore<UploadViewState, UploadViewActions>({
    name: "homeUploadView",
    initialState: {
      tileLocked: false,
      tileEnabled: true,
      ready: false,
      uploading: false,
      label: "Thêm PDF",
      labelTitle: "",
      labelVisible: true,
      help: "Sau khi tải lên, tệp sẽ được kiểm tra trước khi bắt đầu xử lý.",
      helpVisible: true,
      status: "Chưa chọn tệp",
      statusVisible: false,
      progressVisible: false,
      progressPercent: 0,
      progressText: "Đang tải lên",
      actionSlotVisible: false,
      inlinePageRangeVisible: false,
      pageRangeStart: "",
      pageRangeEnd: "",
      pageRangeMax: 0,
      pageRangeDialogOpen: false,
      credentialGateVisible: false,
    },
    actions: {
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
  // Điểm React ref ghi ngược: HeroUpload.jsx ghi vào sau khi mount #file
  const domRefs: UploadDomRefs = { fileInput: null };

  const patch = (payload: Partial<UploadViewState> = {}) => store.actions.patch(payload);

  // ---- Ánh tile-view.js (workflow viewPort qua uploadTilePort cũng đi nhóm này) ----

  function setUploadTileLocked({
    locked = false,
    enabled = !locked,
  }: UploadTileLockedOptions = {}) {
    patch({ tileLocked: Boolean(locked), tileEnabled: Boolean(enabled) });
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
    patch(next);
  }

  function setUploadTileReady(ready: boolean) {
    patch({ ready: Boolean(ready), uploading: false });
  }

  function setUploadActionSlotVisible(visible: boolean) {
    patch({ actionSlotVisible: Boolean(visible) });
  }

  // ---- Ánh ui/job-actions-view.js (chuỗi tiến trình/đặt lại upload) ----

  function setUploadProgress(loaded: number, total: number) {
    const hasNumbers = Number.isFinite(loaded) && Number.isFinite(total) && total > 0;
    const percent = hasNumbers
      ? Math.max(0, Math.min(100, (loaded / total) * 100))
      : 18;
    patch({
      progressVisible: true,
      uploading: true,
      ready: false,
      actionSlotVisible: false,
      progressPercent: percent,
      progressText: hasNumbers ? `Đang tải lên ${percent.toFixed(0)}%` : "Đang tải lên",
    });
  }

  function resetUploadProgress() {
    patch({
      progressVisible: false,
      uploading: false,
      progressPercent: 0,
      progressText: "Đang tải lên",
    });
  }

  function clearFileInputValue() {
    if (domRefs.fileInput) {
      domRefs.fileInput.value = "";
    }
  }

  // Đặt lại phía view (quy cách resetUploadedFileView); trạng thái upload về 0 do
  // composition bù
  function resetUploadedFileView() {
    clearFileInputValue();
    patch({
      progressVisible: false,
      uploading: false,
      ready: false,
      progressPercent: 0,
      progressText: "Đang tải lên",
      actionSlotVisible: false,
      status: "Chưa tải tệp lên",
      statusVisible: false,
      label: DEFAULT_FILE_LABEL,
      labelTitle: "",
      labelVisible: true,
    });
  }

  // ---- Ánh features/upload/view.js (hợp đồng viewPort của mountUploadFeature) ----

  const viewPort = {
    clearPageRanges: () => patch({ pageRangeStart: "", pageRangeEnd: "" }),
    closePageRangeDialog: () => patch({ pageRangeDialogOpen: false }),
    markUploadReady: (ready: boolean) => setUploadTileReady(ready),
    openPageRangeDialog: ({ maxPage = 0 }: UploadPageRangeDialogOptions = {}) =>
      patch({
        pageRangeDialogOpen: true,
        pageRangeMax: Number(maxPage) > 0 ? Math.floor(Number(maxPage)) : 0,
      }),
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
      patch({ inlinePageRangeVisible: Boolean(visible) }),
    showUploadStatus: (message: string) =>
      setUploadTileText({ status: message, statusVisible: true }),
    writePageRanges: ({ start = "", end = "" }: UploadPageRangesWrite = {}) =>
      patch({
        pageRangeStart: `${start}`,
        pageRangeEnd: `${end}`,
      }),
  };

  const uploadTilePort = {
    setUploadActionSlotVisible,
    setUploadTileLocked,
    setUploadTileText,
  };

  return {
    clearFileInputValue,
    domRefs,
    patch,
    resetUploadProgress,
    resetUploadedFileView,
    setUploadProgress,
    store,
    uploadTilePort,
    viewPort,
  };
}
