// CredentialsDialog (bản React của <browser-credentials-dialog>, đối chiếu
// components/dialogs/browser-credentials-dialog.js theo dõi id phản chiếu + browser.js
// giữ controller mở/đóng/kiểm tra/lưu điều phối).
//
// Dialog lớp kết xuất (Giai đoạn C, cải tiến shadcn): từ <dialog> native + showModal/close đổi thành
// Dialog Primitive của radix-ui (DialogPrimitive.Root/Portal/Overlay/Content), không dùng
// giao diện mặc định của src/components/ui/dialog.jsx (className tiếp tục dùng
// bộ CSS bespoke desktop-dialog/desktop-shell hiện có). Trạng thái open do
// credentialsDialogStore (open của useCredentialsController) kiểm soát, onOpenChange
// xử lý: khi next===false gọi thống nhất dialogStore.close() — Escape, bấm vào backdrop
// (kiểm tra outside-click của DialogPrimitive.Overlay), nhấp nút Đóng
// (DialogPrimitive.Close). Cả ba đường dẫn đều gọi qua callback này, không còn lắng nghe thủ công
// handleBackdropClick/keydown nữa.
//
// Không forceMount Content/Overlay: Radix modal Content bên trong có một
// hideOthers(content) (aria-hidden các node anh em) có effect phụ thuộc vào vòng đời mount/unmount
// thực tế của component (deps=[]), forceMount sẽ khiến nó chạy vĩnh viễn ngay cả khi hộp thoại chưa từng mở
// — thay vào đó tạo ra lỗ hổng accessibility mới. Khi hộp thoại đóng (OCR/DeepSeek/Nhiệm vụ):
// các bản nháp tùy chọn chưa lưu sẽ mất (input không controlled, ref bị gỡ và reset component), nhưng
// không có yêu cầu ngữ nghĩa sản phẩm nào về "giữ bản nháp chưa lưu sau khi đóng"; điều này chấp nhận được
// và mang lại UX hộp thoại trực quan hơn (bản nháp không tồn tại liên tục cho đến khi được lưu).
//
// Điểm vào mở: APP_EVENTS.openBrowserCredentials
// - setupMode=true -> Cửa sổ bật lên này (định cấu hình lần đầu, độc lập "Cài đặt API")
// - Các trường hợp khác -> Khu vực API trong Settings Hub (điểm vào điền Key duy nhất, tránh cửa sổ kép)
// HeroUpload gate, banner thiếu Key AI, tất cả luồng submit đều đi đến cùng sự kiện.
//
// Triển khai Tabs (Giai đoạn B, cải tiến shadcn): cùng lựa chọn với SettingsHubDialog.jsx — sử dụng trực tiếp
// Tabs Primitive của radix-ui, không dùng trang phục mặc định src/components/ui/tabs.jsx (tránh xung đột
// với bộ CSS bespoke credential-tabs/credential-panel). activeTab được
// view.activeTab của useCredentialsController điều khiển (không phải useState riêng của component này),
// Radix chuyển sang chế độ controlled: value={activeTab} +
// onValueChange={feature.activateCredentialTab} — ban đầu gắn trên mỗi trigger vào
// onClick, nay hội tụ vào callback cấp Root, hành vi không đổi.
//
// TaskOptionsPanel mount cố định (không unmount theo tab, xem chú thích JSX bên dưới):
// Ràng buộc hiện có vẫn giữ: TabsPrimitive.Content dùng forceMount + ghi đè hidden rõ ràng (Radix
// nội bộ sẽ tính là một hidden, nhưng contentProps mở rộng theo thứ tự sau, chúng ta tự truyền lại
// giá trị hidden cuối cùng có hiệu lực), ngữ nghĩa khớp chính xác với hidden ban đầu — điều này
// chỉ có ý nghĩa khi component đang mount trong hộp thoại (khi hộp thoại đóng, Content unmount toàn bộ,
// không xét đến việc tab mount cố định).

import { Dialog as DialogPrimitive } from "radix-ui";
import { useAppEvent } from "../../../../shared/react/use-app-event.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { useHomeServices } from "../../home-services-context.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { CredentialsWorkbench } from "./CredentialsWorkbench.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";
import { APP_EVENTS } from "../../composition/external.js";

// Button.size được suy ra là bắt buộc trong các tệp nguồn không được chú thích; unstyled không dùng size khi chạy.
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

export function CredentialsDialog() {
  const { open, view, feature, dialogStore } = useCredentialsController();
  const services = useHomeServices();
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  useAppEvent(APP_EVENTS.openBrowserCredentials, (event) => {
    const detail = event?.detail || {};
    // Chung: Chỉ mở "Thiết lập -> Cài đặt API"; chỉ mở dialog độc lập khi là cấu hình lần đầu
    if (detail.setupMode) {
      feature?.openBrowserCredentialsDialog({ setupMode: true });
      return;
    }
    services.settingsHub?.dialogStore?.open?.({ tab: "api" });
  });

  // Esc / Nhấp vào backdrop / Nút đóng được ghi nhận qua callback này vào store (dialogStore.close()
  // là idempotent với trạng thái đã đóng no-op, và không xung đột với handlers.save()
  // gọi nội bộ viewPort.closeDialog()).
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  const setupMode = Boolean(view.setupMode);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id={CREDENTIAL_DOM_IDS.dialog}
          className="desktop-dialog"
          data-setup-mode={setupMode ? "1" : "0"}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell">
            <div className="desktop-head">
              <div className="credential-dialog-head">
                <DialogPrimitive.Title asChild>
                  <h2 id={BROWSER_IDS.title}>{setupMode ? "Cấu hình lần đầu" : "Cài đặt API"}</h2>
                </DialogPrimitive.Title>
                <p id={BROWSER_IDS.subtitle} className="muted hidden"></p>
              </div>
              <DialogPrimitive.Close asChild>
                <Button id={BROWSER_IDS.closeButton} className="dialog-close-btn" aria-label="Đóng">×</Button>
              </DialogPrimitive.Close>
            </div>
            {/* Phần nội dung form chuyển vào CredentialsWorkbench (dùng chung với API zone của SettingsHubDialog), hộp thoại này chỉ giữ lại cảnh đầu tiên (setupMode). */}
            <div className="desktop-body credential-dialog-body">
              <CredentialsWorkbench />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
