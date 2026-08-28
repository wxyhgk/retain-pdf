import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

// View store phạm vi workflow + React viewPort.
//
// viewPort của mountWorkflowFeature (controller thuần logic, tái sử dụng nguyên trạng)
// đổ xuống store tại đây, do WorkflowPanel/HeroUpload/PageRangeDialog đăng ký render.
// applyMockUpload/applyWorkflowUpload/setSubmitControls/renderBudgetNote lần lượt ánh
// theo ngữ nghĩa của features/workflow/view.js (file đó thuộc view DOM cũ, cấm import).
//
// Hộp thoại cài đặt dành cho nhà phát triển (developer-settings-dialog) thuộc phạm vi
// hỗn hợp 3b: setDeveloperDialog/readDeveloperDialog vòng qua giá trị store trước
// (chưa nối form DOM), khi 3b React hóa hộp thoại này thay thế hai phương thức đó là
// controller hoàn toàn không cảm nhận.

/** Tùy chọn bảng thuật ngữ trong cài đặt nhà phát triển (đã chuẩn hóa) */
export type WorkflowGlossaryOption = {
  glossaryId: string;
  name: string;
  entryCount: number | null;
};

/** Mục thô trong danh sách API (đầu vào của setDeveloperGlossaryOptions) */
export type WorkflowGlossarySource = {
  glossary_id?: string;
  name?: string;
  entry_count?: string | number | null;
  [key: string]: unknown;
};

export type WorkflowBudgetNote = {
  visible: boolean;
  tone: string;
  message: string;
  blocking: boolean;
  topUpUrl: string;
};

/** Trường bền vững của hộp thoại nhà phát triển (hình dạng do controller ghi, đọc theo nhu cầu) */
export type WorkflowDeveloperDialog = {
  workflow?: string;
  renderSourceJobId?: string;
  model?: unknown;
  baseUrl?: unknown;
  glossaryId?: string;
  workers?: unknown;
  batchSize?: unknown;
  classifyBatchSize?: unknown;
  compileWorkers?: unknown;
  timeoutSeconds?: unknown;
  [key: string]: unknown;
};

export type WorkflowViewState = {
  submitLabel: string;
  submitDisabled: boolean;
  submitBusy: boolean;
  pageRangeButtonVisible: boolean;
  budget: WorkflowBudgetNote;
  jobWarningVisible: boolean;
  glossaries: WorkflowGlossaryOption[];
  selectedGlossaryId: string;
  developerDialog: WorkflowDeveloperDialog;
  developerFormState: Record<string, unknown>;
};

export type WorkflowViewActions = {
  patch(
    currentState: WorkflowViewState,
    payload?: Partial<WorkflowViewState>,
  ): WorkflowViewState;
};

export type WorkflowViewStore = Store<WorkflowViewState, WorkflowViewActions>;

/** Cổng tile workflow → upload (uploadTilePort của upload-view-store) */
export type WorkflowUploadTilePort = {
  setUploadActionSlotVisible?: (visible?: boolean) => void;
  setUploadTileLocked?: (options?: { locked?: boolean; enabled?: boolean }) => void;
  setUploadTileText?: (options?: {
    label?: string;
    labelTitle?: string;
    help?: string;
    status?: string;
    statusVisible?: boolean | null;
    labelVisible?: boolean;
    helpVisible?: boolean;
  }) => void;
};

export function createWorkflowViewStore(): WorkflowViewStore {
  return createStore<WorkflowViewState, WorkflowViewActions>({
    name: "homeWorkflowView",
    initialState: {
      submitLabel: "Dịch ngay",
      submitDisabled: true,
      submitBusy: false,
      pageRangeButtonVisible: true,
      budget: {
        visible: false,
        tone: "",
        message: "",
        blocking: false,
        topUpUrl: "",
      },
      jobWarningVisible: false,
      glossaries: [],
      selectedGlossaryId: "",
      developerDialog: {},
      developerFormState: {},
    },
    actions: {
      patch(currentState, payload = {}) {
        return { ...currentState, ...payload };
      },
    },
  });
}

export function createWorkflowViewFeature({
  store = createWorkflowViewStore(),
  uploadTilePort,
}: {
  store?: WorkflowViewStore;
  uploadTilePort?: WorkflowUploadTilePort | null;
} = {}) {
  const patch = (payload: Partial<WorkflowViewState> = {}) => store.actions.patch(payload);

  function setSubmitBusy(busy = false) {
    patch({ submitBusy: Boolean(busy) });
  }

  function setSubmitDisabled(disabled = true) {
    patch({ submitDisabled: Boolean(disabled) });
  }

  function selectedGlossaryId() {
    return `${store.getSnapshot().selectedGlossaryId || ""}`.trim();
  }

  function setSelectedGlossaryId(value = "") {
    patch({ selectedGlossaryId: `${value || ""}`.trim() });
  }

  function setJobWarningVisible(visible: boolean) {
    patch({ jobWarningVisible: Boolean(visible) });
  }

  // ---- Ánh theo features/workflow/view.js ----

  function setSubmitControls({
    disabled,
    label,
    actionVisible,
    pageRangeVisible,
  }: {
    disabled?: boolean;
    label?: string;
    actionVisible?: boolean;
    pageRangeVisible?: boolean;
  } = {}) {
    patch({
      submitDisabled: Boolean(disabled),
      submitLabel: `${label ?? ""}` || store.getSnapshot().submitLabel,
      pageRangeButtonVisible: Boolean(pageRangeVisible),
    });
    uploadTilePort?.setUploadActionSlotVisible(actionVisible);
  }

  function renderBudgetNote(budget?: Partial<WorkflowBudgetNote> | null) {
    patch({
      budget: {
        visible: Boolean(budget?.visible),
        tone: `${budget?.tone || ""}`,
        message: `${budget?.message || ""}`,
        blocking: Boolean(budget?.blocking),
        topUpUrl: `${budget?.topUpUrl || ""}`,
      },
    });
  }

  function applyMockUpload({
    mockScenario,
    submitLabel,
    showPageRangeButton,
  }: {
    mockScenario?: string;
    submitLabel?: string;
    showPageRangeButton?: boolean;
  } = {}) {
    uploadTilePort?.setUploadTileLocked({ locked: true, enabled: false });
    uploadTilePort?.setUploadTileText({
      label: "Chế độ mock",
      labelTitle: "",
      help: `Đang ở chế độ mock: ${mockScenario || "running"}. Không tải lên tệp, cũng không gọi backend thực.`,
      status: "Chế độ mock đã kích hoạt, có thể bắt đầu dịch ngay.",
      statusVisible: true,
    });
    setSubmitControls({
      disabled: false,
      label: submitLabel,
      actionVisible: true,
      pageRangeVisible: showPageRangeButton,
    });
  }

  function applyWorkflowUpload({
    needsUpload,
    uploadReady,
    defaultFileLabel,
    headline,
    renderSourceJobId,
  }: {
    needsUpload?: boolean;
    uploadReady?: boolean;
    defaultFileLabel?: string;
    headline?: string;
    renderSourceJobId?: string;
  } = {}) {
    uploadTilePort?.setUploadTileLocked({ locked: !needsUpload, enabled: needsUpload });
    uploadTilePort?.setUploadTileText({
      label: !uploadReady ? (needsUpload ? defaultFileLabel : "Tái sử dụng kết quả tác vụ") : "",
      labelTitle: "",
      help: headline,
      status: !needsUpload
        ? (renderSourceJobId
            ? `Đang tái sử dụng tác vụ: ${renderSourceJobId}`
            : "Vui lòng điền Render ID tác vụ nguồn trong cài đặt dành cho nhà phát triển.")
        : "",
      statusVisible: !needsUpload ? true : (!uploadReady ? false : null),
    });
  }

  function setDeveloperGlossaryOptions(
    glossaries: WorkflowGlossarySource[] = [],
    selectedId = "",
  ) {
    patch({
      glossaries: (Array.isArray(glossaries) ? glossaries : [])
        .map((glossary) => ({
          glossaryId: `${glossary?.glossary_id || ""}`.trim(),
          name: `${glossary?.name || glossary?.glossary_id || ""}`.trim(),
          entryCount: Number.isFinite(Number(glossary?.entry_count))
            ? Number(glossary.entry_count)
            : null,
        }))
        .filter((glossary) => glossary.glossaryId),
      selectedGlossaryId: `${selectedId || ""}`.trim(),
    });
  }

  // ---- Hộp thoại cài đặt nhà phát triển (điểm tiếp quản của 3b) ----

  function setDeveloperDialog(config: WorkflowDeveloperDialog = {}) {
    patch({ developerDialog: { ...config } });
  }

  function readDeveloperDialog(defaults: Partial<WorkflowDeveloperDialog> = {}) {
    const saved = store.getSnapshot().developerDialog || {};
    return {
      workflow: saved.workflow,
      renderSourceJobId: `${saved.renderSourceJobId || ""}`.trim(),
      model: saved.model || defaults.model,
      baseUrl: saved.baseUrl || defaults.baseUrl,
      glossaryId: selectedGlossaryId() || `${saved.glossaryId || ""}`.trim(),
      workers: saved.workers ?? defaults.workers,
      batchSize: saved.batchSize ?? defaults.batchSize,
      classifyBatchSize: saved.classifyBatchSize ?? defaults.classifyBatchSize,
      compileWorkers: saved.compileWorkers ?? defaults.compileWorkers,
      timeoutSeconds: saved.timeoutSeconds ?? defaults.timeoutSeconds,
    };
  }

  function readDeveloperWorkflow() {
    return store.getSnapshot().developerDialog?.workflow;
  }

  function setDeveloperWorkflowFormState(payload: Record<string, unknown> = {}) {
    patch({ developerFormState: { ...payload } });
  }

  const viewPort = {
    applyMockUpload,
    applyWorkflowUpload,
    closeDeveloperDialog: () => {},
    readDeveloperDialog,
    readDeveloperWorkflow,
    renderBudgetNote,
    setDeveloperDialog,
    setDeveloperGlossaryOptions,
    setDeveloperWorkflowFormState,
    setSubmitControls,
  };

  return {
    patch,
    selectedGlossaryId,
    setJobWarningVisible,
    setSelectedGlossaryId,
    setSubmitBusy,
    setSubmitDisabled,
    store,
    viewPort,
  };
}
