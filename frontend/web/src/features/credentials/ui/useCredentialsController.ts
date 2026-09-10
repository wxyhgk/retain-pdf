// CredentialsDialog 家族(CredentialsDialog/ProviderPanels 内 OCR 与翻译模型
// 面板)的唯一装配面——把 composition.js 的 credentials 域
// (services.credentials:{feature, view, dialogStore})折成一个 hook,组件
// 只订阅需要的切片,不各自重复 useStoreSnapshot/useDialogState 样板。
//
// handlers 来自 browser.js(kept 控制器)在 mount 时同步调用一次
// viewPort.bindEvents(...)捕获的处理函数(save/validateOcr/validateDeepSeek/
// changeProvider/resetXxxValidation 等)——见 credentials-view-store.js 头注释。

import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useCredentialsServices } from "./credentials-context.jsx";
import { useDialogState } from "@/ui/hooks/use-dialog-state.js";

export function useCredentialsController() {
  const { feature, view, dialogStore, credentialsStatePort } = useCredentialsServices();
  const dialogState = useDialogState(dialogStore);
  const viewState = useStoreSnapshot(view.store);
  const credentialsSnapshot = useStoreSnapshot(credentialsStatePort.store);

  return {
    open: Boolean(dialogState.open),
    view: viewState,
    credentials: credentialsSnapshot.credentials,
    runtime: credentialsSnapshot.runtime,
    feature,
    dialogStore,
    handlers: view.handlersRef.current,
    tokenInputRef: view.tokenInputRef,
    elementsRef: view.elementsRef,
  };
}
