// CredentialsDialog Gia đình(CredentialsDialog/OcrProviderPanels/DeepSeekPanel/
// TaskOptionsPanel)Bề mặt lắp ráp độc đáo——cầm composition.js của credentials vực
// (services.credentials:{feature, view, dialogStore})Gấp thành một hook,Mô đun
// Chỉ đăng ký những lát cắt bạn cần,Không lặp lại riêng lẻ useStoreSnapshot/useDialogState dạng bản。
//
// handlers đến từ browser.js(kept Kiểm soát viên)Tại địa điểm: mount Cuộc gọi đồng bộ một lần cùng một lúc
// viewPort.bindEvents(...)Trình xử lý bị bắt(save/validateOcr/validateDeepSeek/
// changeProvider/resetXxxValidation chờ)——thấy credentials-view-store.js Tiêu đề bình luận。

import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";

export function useCredentialsController() {
  const services = useHomeServices();
  const { feature, view, dialogStore } = services.credentials;
  const dialogState = useDialogState(dialogStore);
  const viewState = useStoreSnapshot(view.store);
  const credentialsSnapshot = useStoreSnapshot(services.ports.credentialsStatePort.store);

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
