// Họ GlossariesDialog (GlossariesDialog/GlossaryList/GlossaryEditor/
// GlossaryImportPanel) là bề mặt lắp ráp riêng (đối chiếu
// useCredentialsController.js), gom vùng glossaries của composition.js
// (services.glossaries:{feature, view, dialogStore}) thành một hook.
//
// Bộ kích hoạt mở: tab "Bảng thuật ngữ" của SettingsHubDialog và #glossary-btn
// gọi trực tiếp services.glossaries.dialogStore.open() (kế hoạch §0.4, điểm gọi
// giữ chỗ của composition có hiệu lực tại chỗ). Không dùng APP_EVENTS cho việc
// này — effect theo dõi trạng thái mở sẽ gọi lại controller.js open() (gồm
// openDialog() + reloadGlossaries()), tương đương ngữ nghĩa cũ "bấm nút Bảng
// thuật ngữ → open()" và không cần đổi điểm gọi giữ chỗ trong SettingsHubDialog.jsx.
//
// APP_EVENTS.refreshGlossaries (kế hoạch §0.6) dùng useAppEvent; gọi
// handlers.reload (hàm xử lý reload đã được bindEvents của controller.js thu
// lại, bên trong có try/catch → setStatus thông báo lỗi).

import { useEffect, useRef } from "react";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";
import { useAppEvent } from "../../../../shared/react/use-app-event.js";
import { APP_EVENTS } from "../../composition/external.js";

export function useGlossariesController() {
  const services = useHomeServices();
  const { feature, view, dialogStore } = services.glossaries;
  const dialogState = useDialogState(dialogStore);
  const viewState = useStoreSnapshot(view.store);
  const open = Boolean(dialogState.open);
  const handlers = view.handlersRef.current;

  useAppEvent(APP_EVENTS.refreshGlossaries, () => {
    handlers?.reload?.();
  });

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // open() của controller.js = openDialog() (dialogStore.open() idempotent) +
      // trạng thái "Đọc bảng thuật ngữ..." + reloadGlossaries() + xóa trạng thái
      // lỗi, tất cả thực hiện một lần trong composition; không lặp lại logic tương
      // đương ở đây.
      void feature?.open?.();
    }
    wasOpenRef.current = open;
  }, [open, feature]);

  return {
    open,
    view: viewState,
    store: view.store,
    feature,
    dialogStore,
    handlers,
  };
}
