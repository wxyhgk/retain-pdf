// CredentialsDialog 的纯视图态(蓝图 §2:setupMode/tab/校验反馈/DeepSeek 充值
// 提示/保存态)+ 与 features/credentials/browser.js(kept 控制器)对接的
// store 驱动 viewPort/elementsPort。
//
// 旧世界 browser-view-port.js/dialog-elements-port.js/view.js/dialog-sync.js/
// validation-view.js 全部是 DOM 直写(死,不 import);这里用同名方法签名
// 重新实现,只是"写"的目的地从 DOM 换成 store,让 CredentialsDialog.jsx 系的
// 组件订阅渲染。browser.js(state.js/validation.js/deepseek-flow.js/
// ocr-readiness-flow.js/persistence.js/dialog-values.js 等 kept 逻辑层的编排者)
// 一行不改地复用。

import type { DialogStore } from "@/platform/store/dialog-store.js";
import { createStore } from "@/platform/store/store.js";
import type { Store } from "@/platform/store/store.js";
import { inferTranslationProvider } from "@/platform/config/providers.js";

/** 事件处理函数表（viewPort.bindEvents 写入 handlersRef）。 */
export type HandlersBag = {
  [key: string]: ((...args: unknown[]) => unknown) | undefined | null;
};

/** 凭据弹窗内受控输入的 ref 集合。 */
export type CredentialsElementsRef = {
  apiKeyInput: HTMLInputElement | null;
  modelBaseUrlInput: HTMLInputElement | null;
  modelNameInput: HTMLInputElement | null;
  translationWorkersInput: HTMLInputElement | null;
  mathModeSelect: HTMLSelectElement | null;
  tokenInputs: Record<string, HTMLInputElement | null | undefined>;
};

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
  /** { [providerId]: { message, tone } } —— OCR token 校验反馈(paddle 等) */
  validations: Record<string, CredentialsMessage>;
  deepSeek: CredentialsMessage;
  deepSeekTopUpVisible: boolean;
  translationProvider: string;
  dialogStatus: CredentialsMessage;
  /** 只读态,供 UploadTile 订阅决定上传瓦片锁定/credential-gate 可见性 */
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
  setTranslationProvider(state: CredentialsViewState, provider?: string): CredentialsViewState;
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
      translationProvider: "deepseek",
      dialogStatus: { message: "", tone: "" },
      // 只读态,供 UploadTile 订阅决定上传瓦片锁定/credential-gate 可见性
      // (蓝图 §2.2「upload 按钮锁定态移交 3a」——本域只写这份快照,不直接
      // 触碰 stores/upload-store)。
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
      setTranslationProvider(currentState, provider = "custom") {
        return { ...currentState, translationProvider: `${provider || "custom"}` };
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

  // 对话框内可见字段的非受控 DOM ref 收集点(镜像 stores/upload-store 的
  // domRefs 模式)。dialog-values.js/dialog-sync.js(kept)直接读写这些节点的
  // .value,不走 React 受控 value/onChange——避免两套写入源打架(蓝图风险 1
  // 的姊妹问题:可见字段虽不是"隐藏 input 桥接"那 4 个,但同样不该双写)。
  const elementsRef: CredentialsElementsRef = {
    apiKeyInput: null,
    modelBaseUrlInput: null,
    modelNameInput: null,
    translationWorkersInput: null,
    mathModeSelect: null,
    tokenInputs: {}, // { [providerId]: HTMLInputElement }
  };

  function elements() {
    return {
      paddleInput: elementsRef.tokenInputs.paddle || null,
      apiKeyInput: elementsRef.apiKeyInput,
      modelBaseUrlInput: elementsRef.modelBaseUrlInput,
      modelNameInput: elementsRef.modelNameInput,
      translationWorkersInput: elementsRef.translationWorkersInput,
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
    // OCR provider 面板可见性由 ProviderPanels 直接订阅
    // credentialsStatePort(credentials.ocrProvider)渲染;不需要
    // dialog-sync.js 原本那种命令式二次同步,no-op。
    syncOcrProviderControls: () => {},
    syncTranslationProvider: (baseUrl = "") => {
      store.actions.setTranslationProvider(inferTranslationProvider(baseUrl));
    },
  };

  // browser.js 在 mountBrowserCredentialsFeature() 内同步调用一次
  // viewPort.bindEvents(handlers),把 save/validateOcr/validateDeepSeek/
  // changeProvider/activateCredentialTab/open 等处理函数交给视图层——旧世界
  // 在这里挂原生 DOM 监听(view.js,死);React 世界没有等价步骤,改成把
  // handlers 存进 ref,JSX 按钮的 onClick 直接调用
  // (见 useCredentialsController.js)。
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
    setTranslationProvider: (provider = "custom") => store.actions.setTranslationProvider(provider),
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
      // no-op:credentialsStatePort.patchCredentials(default-state-port.js 单例)
      // 的 mirrorToDom 副作用已经同步写过隐藏 input(见 browser.js 的
      // changeProvider handler),这里重复写只是同一帧内两次相同赋值。
    },
    setOcrValidationMessage: (message = "", tone = "", providerId = "") => store.actions.setValidation({
      providerId,
      message,
      tone,
    }),
    syncOcrProviderControls: () => {
      // no-op(理由同 elementsPort.syncOcrProviderControls)。
    },
    updateCredentialGate: (payload: Partial<CredentialGateState> = {}) => {
      store.actions.setCredentialGate(payload);
      return true; // browser.js 依赖真值判断继续 refreshSubmitControls()
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
