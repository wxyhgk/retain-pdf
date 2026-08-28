// Hộp thoại quy trình dịch —— chỉ sử dụng cho mục tải lên "Thêm PDF".
//
// Tiến độ nhiệm vụ sách / khởi tạo dịch đã được chuyển đến tab "Dịch" trong chi tiết sách:
//   BookTranslationWorkflowPanel (#book-detail-status-section)
// Không đưa tiến độ của document đã có vào hộp thoại này nữa; selectJob khi có document_id sẽ mở chi tiết.
//
// Lớp render Dialog (giai đoạn C đợt 2, cải tiến shadcn): chuyển từ bespoke <div role="dialog">
// sang nguyên mẫu Dialog của radix-ui (DialogPrimitive.Root/Portal/Overlay/Content).
// So với đợt 1 giai đoạn C (CredentialsDialog và 4 hộp thoại khác, sử dụng factory dialog-store.js + ngữ nghĩa đóng đơn trạng thái),
// cấu trúc có ba điểm khác biệt, được giải thích lần lượt:
//
// 1. Nguồn trạng thái mở/đóng không phải là factory dialog-store.js, mà là dialogStatePort({open, mode})
//    được bọc bởi createStore tùy chỉnh —— ảnh chụp nhanh từ services.stores.dialog. Tệp này không thay đổi
//    lớp này (nguyên tắc bất di bất dịch), chỉ thay đổi lớp render.
//
// 2. Ngữ nghĩa hai trạng thái (dialog.mode: UPLOAD/STATUS) là trạng thái *bên trong* của hộp thoại,
//    không phải open/close của Radix —— mode chỉ ảnh hưởng đến văn bản tiêu đề và hai class statusMode/uploadMode,
//    không liên quan đến việc di chuyển lần này, giữ nguyên như cũ.
//
// 3. Đóng thống nhất chuyển hướng đến requestClose(): ba đường kích hoạt (Escape/nền/ nút đóng) đều phải đi qua
//    services.workflowDialog.requestClose() (xem translation-workflow-dialog-runtime.js),
//    không được bỏ qua và gọi trực tiếp dialogStatePort.close() —— việc tạm dừng/khôi phục làm mới thư viện 3b (bindings.js)
//    phụ thuộc vào sự kiện closeTranslationWorkflow hiển thị trên document, chỉ khi đi qua requestClose() mới dispatch sự kiện này.
//
//    requestClose() hiện tại là "đóng trực tiếp bằng một cú nhấp" (không còn là hai giai đoạn trước đây: khi trạng thái hiển thị thì
//    returnHome trước, hộp thoại không đóng). Hai giai đoạn bị người dùng đánh giá là không đáp ứng kỳ vọng (nhấp vào × của tiến độ nhiệm vụ
//    sẽ quay lại biểu mẫu tải lên trống, đồng thời stopPolling làm nhiệm vụ bị reset), đã được đổi thành × = đóng;
//    hủy nhiệm vụ do nút "Hủy nhiệm vụ" trên StatusCard đảm nhiệm.
//
//    Phím Escape vẫn cần xử lý bổ sung: hộp thoại này có một trình lắng nghe keydown cấp document riêng biệt
//    (bindEvents của runtime, hợp đồng sự kiện yêu cầu nó phải hiển thị trên document, không thể xóa), đã gọi requestClose().
//    Nếu đồng thời để onEscapeKeyDown của Radix Content thực hiện hành vi mặc định
//    (kích hoạt onOpenChange(false) → requestClose()), một lần nhấn Escape sẽ kích hoạt requestClose() hai lần,
//    hai sự kiện closeTranslationWorkflow sẽ khiến logic tạm dừng/khôi phục của bindings.js chạy lặp lại.
//    Ở đây, chúng ta rõ ràng đặt onEscapeKeyDown={(e)=>e.preventDefault()}
//    để giao hoàn toàn việc xử lý Escape cho trình lắng nghe document hiện có —— DismissableLayer của keydown
//    được gắn ở giai đoạn capture, bindEvents ở giai đoạn bubble, giai đoạn trước chạy và bị preventDefault(),
//    onDismiss của Radix bị bỏ qua, sau đó ở giai đoạn bubble bindEvents kích hoạt requestClose() bình thường,
//    cuối cùng cả ba đường dẫn đều gọi đúng một lần, không lặp lại.
//
// 4. Không forceMount Content (quyết định giống các hộp thoại khác, xem chú thích đầu tệp use-dialog-return-focus.js
//    —— forceMount sẽ khiến tác dụng phụ hideOthers() bên trong Content của Radix modal có hiệu lực vĩnh viễn khi ứng dụng khởi động).
//    WorkflowPanel (biểu mẫu tải lên) và #status-section (StatusCard 3b) do đó sẽ bị gỡ bỏ khi hộp thoại đóng.
//    openUpload() mỗi lần mở đều resetUploadSession() vô điều kiện, không có kỳ vọng giữ lại trạng thái tải lên khi mở/đóng;
//    công cụ polling job-runtime độc lập với vòng đời gắn kết React (được điều khiển bởi store, không phụ thuộc vào việc StatusCard có được gắn kết hay không),
//    việc gỡ bỏ StatusCard không ảnh hưởng đến việc polling ở chế độ nền —— khi nhiệm vụ đạt đến trạng thái cuối,
//    công cụ sẽ tự động stopPolling, việc đóng hộp thoại sẽ không bỏ lỡ polling thường trú.
//
// Hook kiểu CSS cấp <html> (rootOpen class) nằm ngoài gốc React, được đồng bộ bằng effect (dọn dẹp khi gỡ bỏ),
// giữ nguyên không thay đổi. Nút kích hoạt ("Thêm", trong LibraryBottomBar) và hộp thoại này nằm trên các cây con khác nhau,
// cơ chế trả lại tiêu điểm triggerRef mặc định của Radix không hoạt động, tái sử dụng use-dialog-return-focus.js (tương tự các ví dụ trước như CredentialsDialog).

import { useEffect } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { WorkflowPanel } from "./WorkflowPanel.jsx";
import { StatusCard } from "../status/StatusCard.jsx";
import {
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../../composition/external.js";

export function TranslationWorkflowDialog() {
  const services = useHomeServices();
  const dialog = useStoreSnapshot(services.stores.dialog);
  const statusArea = useStoreSnapshot(services.stores.statusArea);

  const open = Boolean(dialog.open);
  const statusMode = dialog.mode === TRANSLATION_WORKFLOW_MODES.STATUS;
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Móc kiểu CSS cấp <html> nằm ngoài gốc React, đồng bộ bằng effect (dọn dẹp khi unmount)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen, open);
    return () => root.classList.remove(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen);
  }, [open]);

  const contentClasses = [
    "translation-workflow-dialog",
    statusMode
      ? TRANSLATION_WORKFLOW_DIALOG.classes.statusMode
      : TRANSLATION_WORKFLOW_DIALOG.classes.uploadMode,
  ].join(" ");

  // Escape (xem mục 3 ở chú thích đầu, ở đây chỉ preventDefault, việc đóng thực tế do trình lắng nghe document hiện có xử lý) /
  // nhấp vào nền (phát hiện outside-click của DismissableLayer) / nút đóng
  // (DialogPrimitive.Close) cuối cùng đều chuyển hướng thống nhất đến requestClose() để đánh giá đóng hai giai đoạn
  // (nếu trạng thái hiển thị thì returnHome trước, nếu không mới thực sự đóng), không gọi trực tiếp
  // close() của dialogStatePort/dialogStore.
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      services.workflowDialog.requestClose();
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="translation-workflow-overlay" />
        <DialogPrimitive.Content
          id={TRANSLATION_WORKFLOW_DIALOG.ids.dialog}
          className={contentClasses}
          data-open={TRANSLATION_WORKFLOW_DIALOG.datasetValues.open}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="desktop-shell translation-workflow-shell">
            <div className="translation-workflow-head">
              <div className="translation-workflow-head-copy">
                <DialogPrimitive.Title asChild>
                  <h2 id={TRANSLATION_WORKFLOW_DIALOG.ids.title}>
                    {statusMode
                      ? TRANSLATION_WORKFLOW_DIALOG.copy.statusTitle
                      : TRANSLATION_WORKFLOW_DIALOG.copy.uploadTitle}
                  </h2>
                </DialogPrimitive.Title>
                {!statusMode ? (
                  <DialogPrimitive.Description asChild>
                    <p id="translation-workflow-desc" className="translation-workflow-desc">
                      {TRANSLATION_WORKFLOW_DIALOG.copy.uploadDescription}
                    </p>
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  id={TRANSLATION_WORKFLOW_DIALOG.ids.closeButton}
                  type="button"
                  className="dialog-close-btn"
                  aria-label="Đóng"
                >
                  ×
                </button>
              </DialogPrimitive.Close>
            </div>
            <WorkflowPanel />
            <section
              id="status-section"
              className={`translation-status-panel${statusArea.visible ? "" : " hidden"}`}
              aria-label="Tiến độ nhiệm vụ"
            >
              {/* props phía status sẽ được siết chặt ở đợt khác; chỗ này bổ sung đủ phía gọi để khớp chữ ký hiện tại */}
              <StatusCard
                visible={statusArea.visible}
                showResultActions
                showHiddenContract
                rootId="job-status-card"
              />
            </section>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
