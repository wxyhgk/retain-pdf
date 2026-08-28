import {
  createStore,
  type BoundStoreActions,
  type Store,
  type StoreListener,
} from "../../app-framework/store.js";

export interface UploadState {
  uploadId: string;
  uploadedFileName: string;
  uploadedPageCount: number;
  uploadedBytes: number;
  appliedPageRange: string;
  submitBusy: boolean;
}

export type UploadPayload = Partial<Pick<
  UploadState,
  "uploadId" | "uploadedFileName" | "uploadedPageCount" | "uploadedBytes"
>>;

export interface UploadResetOptions {
  includePageRange?: boolean;
}

export type UploadActions = {
  reset(currentState: UploadState, options?: UploadResetOptions): UploadState;
  setUpload(currentState: UploadState, payload?: UploadPayload): UploadState;
  setAppliedPageRange(currentState: UploadState, value?: string): UploadState;
  clearAppliedPageRange(currentState: UploadState): UploadState;
  setSubmitBusy(currentState: UploadState, busy?: boolean): UploadState;
};

export type UploadStore = Store<UploadState, UploadActions>;

export interface UploadStatePort {
  clearAppliedPageRange(): UploadState;
  getSnapshot(): UploadState;
  reset(options?: UploadResetOptions): UploadState;
  setAppliedPageRange(value?: string): UploadState;
  setSubmitBusy(busy?: boolean): UploadState;
  setUpload(payload?: UploadPayload): UploadState;
  subscribe(listener: StoreListener<UploadState>): () => void;
  store: UploadStore;
}

function createUploadState(): UploadState {
  return {
    uploadId: "",
    uploadedFileName: "",
    uploadedPageCount: 0,
    uploadedBytes: 0,
    appliedPageRange: "",
    submitBusy: false,
  };
}

function readUploadState(target: Partial<UploadState> = {}): Partial<UploadState> {
  return {
    uploadId: target.uploadId,
    uploadedFileName: target.uploadedFileName,
    uploadedPageCount: target.uploadedPageCount,
    uploadedBytes: target.uploadedBytes,
    appliedPageRange: target.appliedPageRange,
    submitBusy: target.submitBusy,
  };
}

function resetUploadSnapshot(
  currentState: UploadState,
  { includePageRange = true }: UploadResetOptions = {},
): UploadState {
  const next = createUploadState();
  if (!includePageRange) {
    next.appliedPageRange = currentState.appliedPageRange;
  }
  return next;
}

function setUploadSnapshot(
  currentState: UploadState,
  {
    uploadId = "",
    uploadedFileName = "",
    uploadedPageCount = 0,
    uploadedBytes = 0,
  }: UploadPayload = {},
): UploadState {
  return {
    ...currentState,
    uploadId,
    uploadedFileName,
    uploadedPageCount,
    uploadedBytes,
  };
}

function setAppliedPageRangeSnapshot(currentState: UploadState, value = ""): UploadState {
  return {
    ...currentState,
    appliedPageRange: `${value || ""}`.trim(),
  };
}

export function createUploadStore(initialState: Partial<UploadState> = {}): UploadStore {
  const legacySnapshot = readUploadState(initialState);
  const initialUploadState: UploadState = {
    ...createUploadState(),
    ...Object.fromEntries(
      Object.entries(legacySnapshot).filter(([, value]) => value !== undefined),
    ),
  };
  return createStore<UploadState, UploadActions>({
    name: "upload",
    initialState: initialUploadState,
    actions: {
      reset(currentState, options = {}) {
        return resetUploadSnapshot(currentState, options);
      },
      setUpload(currentState, payload = {}) {
        return setUploadSnapshot(currentState, payload);
      },
      setAppliedPageRange(currentState, value = "") {
        return setAppliedPageRangeSnapshot(currentState, value);
      },
      clearAppliedPageRange(currentState) {
        return setAppliedPageRangeSnapshot(currentState, "");
      },
      setSubmitBusy(currentState, busy = false) {
        return {
          ...currentState,
          submitBusy: !!busy,
        };
      },
    },
  });
}

export function createUploadStatePort(targetState: Partial<UploadState> = {}): UploadStatePort {
  const store = createUploadStore(targetState);
  const actions: BoundStoreActions<UploadState, UploadActions> = store.actions;

  function getSnapshot(): UploadState {
    return store.getSnapshot();
  }

  function reset(options: UploadResetOptions = {}): UploadState {
    return actions.reset(options);
  }

  function setUpload(payload: UploadPayload = {}): UploadState {
    return actions.setUpload(payload);
  }

  function setAppliedPageRange(value = ""): UploadState {
    return actions.setAppliedPageRange(value);
  }

  function clearAppliedPageRange(): UploadState {
    return actions.clearAppliedPageRange();
  }

  function setSubmitBusy(busy = false): UploadState {
    return actions.setSubmitBusy(busy);
  }

  return {
    clearAppliedPageRange,
    getSnapshot,
    reset,
    setAppliedPageRange,
    setSubmitBusy,
    setUpload,
    subscribe: store.subscribe,
    store,
  };
}

let defaultUploadStatePort: UploadStatePort | null = null;

// Phiên bản mặc định duy nhất:Nhiều điểm gắn kết chia sẻ cùng một trạng thái tải lên(Thay thế toàn cục cũ state Vai trò của điểm hẹn)
export function getUploadStatePort(): UploadStatePort {
  return getDefaultUploadStatePort();
}

function getDefaultUploadStatePort(): UploadStatePort {
  if (!defaultUploadStatePort) {
    defaultUploadStatePort = createUploadStatePort();
  }
  return defaultUploadStatePort;
}

export function getUploadState(): UploadState {
  return getDefaultUploadStatePort().getSnapshot();
}

export function resetUploadState(options: UploadResetOptions = {}): UploadState {
  return getDefaultUploadStatePort().reset(options);
}

export function setUploadState(payload: UploadPayload = {}): UploadState {
  return getDefaultUploadStatePort().setUpload(payload);
}

export function setAppliedPageRange(value = ""): UploadState {
  return getDefaultUploadStatePort().setAppliedPageRange(value);
}

export function clearAppliedPageRange(): UploadState {
  return getDefaultUploadStatePort().clearAppliedPageRange();
}

export function setUploadSubmitBusy(busy = false): UploadState {
  return getDefaultUploadStatePort().setSubmitBusy(busy);
}
