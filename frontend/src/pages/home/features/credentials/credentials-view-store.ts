// Trạng thái thuần view của CredentialsDialog (kế hoạch kiến trúc §2: setupMode/tab/phản hồi xác thực/DeepSeek nạp
// nhắc nhở/trạng thái lưu) + kết nối với features/credentials/browser.js (giữ controller)
// điều khiển viewPort/elementsPort qua store.
//
// browser-view-port.js / dialog-elements-port.js / view.js / dialog-sync.js /
// validation-view.js cũ truy cập trực tiếp DOM (đã bỏ, không import); tại đây triển khai lại
// với cùng quy ước đặt tên, điểm đến của thao tác "ghi" chuyển từ DOM sang store, để component
// CredentialsDialog.jsx đăng ký render. browser.js (state.js/validation.js/deepseek-flow.js/
// ocr-readiness-flow.js/persistence.js/dialog-values.js các tầng logic điều phối)
// được tái sử dụng nguyên vẹn.

import type { DialogStore } from "../../state/dialog-store.js";
import type {
  CredentialsElementsRef,
  HandlersBag,
} from "../../composition/types.js";
import { createStore } from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

export type CredentialsMessage = {
  message: string;
  tone: string;
};

export type CredentialGateState = {
  desktopMode: boolean;
  show: boolean;
  uploadEnabled: boolean;
  uploadReady: boolean;
};

export type CredentialsViewState = {
  setupMode: boolean;
  activeTab: string;
  /** { [providerId]: { message, tone } } —— Phản hồi xác thực OCR token (paddle, v.v.) */
  validations: Record<string, CredentialsMessage>;
  deepSeek: CredentialsMessage;
  deepSeekTopUpVisible: boolean;
  dialogStatus: CredentialsMessage;
  /** Trạng thái chỉ đọc, cung cấp cho HeroUpload đăng ký quyết định khóa vùng tải lên / hiển thị credential-gate */
  credentialGate: CredentialGateState;
};

export type CredentialsViewActions = {
  setSetupMode(state: CredentialsViewState, setupMode?: boolean): CredentialsViewState;
  setActiveTab(state: CredentialsViewState, tabName?: string): CredentialsViewState;
  setValidation(
    state: CredentialsViewState,
    payload?: { providerId?: string; message?: string; tone?: string },
  ): CredentialsViewState;
  setDeepSeek(
    state: CredentialsViewState,
    payload?: { message?: string; tone?: string },
  ): CredentialsViewState;
  setDeepSeekTopUpVisible(state: CredentialsViewState, visible?: boolean): CredentialsViewState;
  setDialogStatus(
    state: CredentialsViewState,
    payload?: { message?: string; tone?: string },
  ): CredentialsViewState;
  setCredentialGate(
    state: CredentialsViewState,
    payload?: Partial<CredentialGateState>,
  ): CredentialsViewState;
};

export type CredentialsViewStore = Store<CredentialsViewState, CredentialsViewActions>;

export function createCredentialsViewFeature({
  dialogStore,
}: {
  dialogStore: DialogStore;
}) {
  const store = createStore<CredentialsViewState, CredentialsViewActions>({
    name: "credentialsView",
    initialState: {
      setupMode: false,
      activeTab: "api",
      validations: {},
      deepSeek: { message: "", tone: "" },
      deepSeekTopUpVisible: false,
      dialogStatus: { message: "", tone: "" },
      // Trạng thái chỉ đọc, cung cấp cho 3a HeroUpload đăng ký quyết định khóa vùng tải lên / hiển thị credential-gate
      // (kế hoạch kiến trúc §2.2 "upload bàn giao trạng thái khóa nút 3a" — domain này chỉ ghi snapshot này, không trực tiếp
      // can thiệp upload-view-store.js / HeroUpload.jsx).
      credentialGate: {
        desktopMode: false,
        show: false,
        uploadEnabled: true,
        uploadReady: false,
      },
    },
    actions: {
      setSetupMode(currentState, setupMode = false) {
        return { ...currentState, setupMode: Boolean(setupMode) };
      },
      setActiveTab(currentState, tabName = "api") {
        return { ...currentState, activeTab: `${tabName || "api"}`.trim() || "api" };
      },
      setValidation(currentState, { providerId = "", message = "", tone = "" } = {}) {
        const id = `${providerId || ""}`.trim();
        if (!id) {
          return currentState;
        }
        return {
          ...currentState,
          validations: { ...currentState.validations, [id]: { message, tone } },
        };
      },
      setDeepSeek(currentState, { message = "", tone = "" } = {}) {
        return { ...currentState, deepSeek: { message, tone } };
      },
      setDeepSeekTopUpVisible(currentState, visible = false) {
        return { ...currentState, deepSeekTopUpVisible: Boolean(visible) };
      },
      setDialogStatus(currentState, { message = "", tone = "" } = {}) {
        return { ...currentState, dialogStatus: { message, tone } };
      },
      setCredentialGate(currentState, payload = {}) {
        return {
          ...currentState,
          credentialGate: { ...currentState.credentialGate, ...payload },
        };
      },
    },
  });

  // Tập hợp DOM ref không kiểm soát cho các trường hiển thị trong dialog (phản chiếu pattern
  // domRefs trong upload-view-store.js). dialog-values.js / dialog-sync.js (kept) đọc ghi trực tiếp .value
  // của các node này, không đi qua React controlled value/onChange — tránh tranh chấp hai nguồn ghi (Rủi ro 1
  // trong kế hoạch: các trường hiển thị không phải 4 input ẩn kết nối, nhưng cũng không nên bị ghi đè hai lần).
  const elementsRef: CredentialsElementsRef = {
    apiKeyInput: null,
    modelBaseUrlInput: null,
    modelNameInput: null,
    mathModeSelect: null,
    tokenInputs: {}, // { [providerId]: HTMLInputElement }
  };

  function elements() {
    return {
      paddleInput: elementsRef.tokenInputs.paddle || null,
      apiKeyInput: elementsRef.apiKeyInput,
      modelBaseUrlInput: elementsRef.modelBaseUrlInput,
      modelNameInput: elementsRef.modelNameInput,
      mathModeSelect: elementsRef.mathModeSelect,
    };
  }

  function tokenInputRef(providerId: string) {
    return (node: HTMLInputElement | null) => {
      elementsRef.tokenInputs[providerId] = node || null;
    };
  }

  const elementsPort = {
    elements,
    // Độ hiển thị của OCR provider panel do OcrProviderPanels.jsx trực tiếp đăng ký
    // credentialsStatePort (credentials.ocrProvider) để render; không cần đồng bộ
    // cưỡng bức cấp 2 của dialog-sync.js ban đầu, đây là no-op.
    syncOcrProviderControls: () => {},
  };

  // browser.js: mountBrowserCredentialsFeature() gọi bất đồng bộ một lần
  // viewPort.bindEvents(handlers), chuyển giao các hàm xử lý save/validateOcr/validateDeepSeek/
  // changeProvider/activateCredentialTab/open cho tầng view — code cũ
  // lắng nghe sự kiện native DOM tại đây (view.js); trong React chuyển sang lưu
  // handlers vào ref, các nút JSX gọi trực tiếp qua onClick (xem useCredentialsController.js).
  const handlersRef: { current: HandlersBag | null } = { current: null };

  const viewPort = {
    activateTab: (tabName = "api") => store.actions.setActiveTab(tabName),
    bindEvents: (handlers: HandlersBag) => {
      handlersRef.current = handlers;
    },
    closeDialog: () => dialogStore.close(),
    dialogElements: () => ({ dialog: true, ...elements() }),
    openDialog: () => dialogStore.open(),
    setDeepSeekTopUpVisible: (visible = false) => store.actions.setDeepSeekTopUpVisible(visible),
    setDeepSeekValidationMessage: (message = "", tone = "") => store.actions.setDeepSeek({ message, tone }),
    setDialogMode: ({
      setupMode = false,
      activateCredentialTab,
    }: {
      setupMode?: boolean;
      activateCredentialTab?: (tab: string) => void;
    } = {}) => {
      store.actions.setSetupMode(setupMode);
      if (setupMode) {
        activateCredentialTab?.("api");
      }
    },
    setDialogStatus: (message = "", tone = "") => store.actions.setDialogStatus({ message, tone }),
    setHiddenOcrProvider: () => {
      // no-op: side effect mirrorToDom của credentialsStatePort.patchCredentials (singleton default-state-port.js)
      // đã ghi đồng bộ vào input ẩn (xem handler changeProvider trong browser.js),
      // ghi lại ở đây chỉ là lặp lại thao tác trong cùng một frame.
    },
    setOcrValidationMessage: (message = "", tone = "", providerId = "") => store.actions.setValidation({
      providerId,
      message,
      tone,
    }),
    syncOcrProviderControls: () => {
      // no-op (lý do tương tự elementsPort.syncOcrProviderControls).
    },
    updateCredentialGate: (payload: Partial<CredentialGateState> = {}) => {
      store.actions.setCredentialGate(payload);
      return true; // browser.js dựa vào giá trị truthy để tiếp tục refreshSubmitControls()
    },
  };

  return {
    store,
    elementsPort,
    elementsRef,
    handlersRef,
    tokenInputRef,
    viewPort,
  };
}
