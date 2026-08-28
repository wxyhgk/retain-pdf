// AppUpdateBanner (React port của nút cập nhật ứng dụng + dialog thông báo tình trạng, kế hoạch xây dựng §5).
//
// Vấn đề thế giới cũ "hai vị trí DOM thuộc hai chủ khác nhau" (nút trong khuôn app-settings-dialog,
// dialog thông báo tại app-shell-header.js) được hợp nhất tại đây: toàn bộ module này được mount
// tại tab "Cập nhật" bên dưới panel trong SettingsHubDialog.jsx (panel này dùng thuộc tính hidden để toggle,
// không unmount - xem cùng đoạn xử lý trong tiêu đề SettingsHubDialog.jsx), nút và dialog đều là con của component này.
// Dialog chỉ mở khi người dùng click vào nút riêng của component (lúc này tab "Cập nhật"
// phải được active, tổ tiên không hidden), tránh tình huống "mở dialog khi parent bị ẩn".
//
// Dialog Lớp kết xuất(Giai  C,shadcn sửa đổi):tình hình rõ ràng dialog Từ người bản xứ <dialog>+
// showModal/close đổi thành radix-ui của Dialog Nguyên thủy,Vô ý src/components/ui/dialog.jsx
// Ngoại Trang Mặc Định(className Tiếp tục với desktop-dialog/desktop-shell/app-update-* bộ này
// bespoke CSS)。open Được kiểm soát tại địa phương useAppUpdateDialogOpen(thuần UI Tạm thời,Không có mục nhập
// store——Quyết định hiện tại này vẫn không thay đổi),onOpenChange Tại địa điểm: next===false Gọi thống nhất khi
// setDialogOpen(false),Escape/Nhấp vào bảng điều khiển/Nút đóng Tất cả ba đường dẫn thực hiện một cuộc gọi lại này。
// không forceMount(cùng CredentialsDialog.jsx Kết luận bình luận tiêu đề,tránh cho hideOthers vĩnh cửu
// Thiếu khả năng tiếp cận chủ động)——Chi tiết này dialog Tất cả nội dung ở chế độ chỉ đọc(Bản sao trạng thái/nói rõ/
// liên tiếp),Không có đầu vào biểu mẫu,Gỡ cài đặt khi đóng mà không mất bất kỳ dữ liệu nào。
//
// AppShellHeader.jsx Không còn nữa app-update-dialog Bộ xương mẫu(3a di truyền,Đã xóa,
// tránh cho id Vi phạm đường cơ sở trực quan nhiều lần/gác cổng)。

import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { APP_UPDATE_IDS } from "./app-update-contract.js";
import { useAppUpdateDialogOpen } from "./useAppUpdateDialogOpen.js";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size được suy ra là bắt buộc trong các tệp nguồn không được chú thích;unstyled Không được sử dụng khi đường dẫn được chạy size。
const Button = ButtonBase as any;

// Đã sao chép từ src/js/features/app-update/view.js:47-60(formatReleaseNotes)——Chức năng thuần túy,
// Bảo quản từng ký tự,Sao chép vào thành phần này(kế hoạch xây dựng §5:AppUpdateBanner agent Scope)。
function formatReleaseNotes(markdown = "") {
  return `${markdown || ""}`
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\s*[-*]\s+/, "• ")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .trimEnd())
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n")
    .trim();
}

export function AppUpdateBanner() {
  const services = useHomeServices();
  const { view, handlersRef } = services.appUpdate;
  const state = useStoreSnapshot(view.store);
  const [dialogOpen, setDialogOpen] = useAppUpdateDialogOpen();
  const { onCloseAutoFocus } = useDialogReturnFocus(dialogOpen);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      setDialogOpen(false);
    }
  }

  const hasUpdate = Boolean(state.hasUpdate);
  const panel = state.panel;
  const notesText = formatReleaseNotes(panel.body) || "Chưa có ghi chú phát hành.";
  const versionText = panel.latestVersion
    ? `Hiện tại ${panel.currentVersion} · Mới nhất ${panel.latestVersion}`
    : `Hiện tại ${panel.currentVersion}`;
  const statusText = `${state.statusText || ""}`;

  return (
    <>
      <Button
        id={APP_UPDATE_IDS.button}
        className={`app-settings-action app-update-btn${hasUpdate ? " has-update" : ""}`}
        aria-label="Kiểm tra cập nhật"
        title={state.buttonTitle}
        data-update-state={state.buttonState}
        onClick={() => setDialogOpen(true)}
      >
         Kiểm tra cập nhật
        <span className="app-update-dot" aria-hidden="true"></span>
      </Button>
      <DialogPrimitive.Root open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="desktop-dialog-overlay app-update-overlay" />
          <DialogPrimitive.Content
            id={APP_UPDATE_IDS.dialog}
            className="desktop-dialog app-update-dialog"
            onCloseAutoFocus={onCloseAutoFocus}
          >
            <div className="desktop-shell app-update-shell">
              <div className="app-update-head">
                <div>
                  <DialogPrimitive.Title asChild>
                    <h2>{panel.title}</h2>
                  </DialogPrimitive.Title>
                  <p>{versionText}</p>
                </div>
                <DialogPrimitive.Close asChild>
                  <Button className="desktop-close app-update-close" aria-label="Đóng">×</Button>
                </DialogPrimitive.Close>
              </div>
              <div className="app-update-body">
                <div id={APP_UPDATE_IDS.status} className={`app-update-status${statusText ? "" : " hidden"}`}>{statusText}</div>
                <div className="app-update-notes">{notesText}</div>
              </div>
              <div className="app-update-foot">
                <Button
                  id={APP_UPDATE_IDS.checkButton}
                  className="home-action-btn secondary"
                  onClick={() => handlersRef.current?.onCheck?.()}
                >
                   Kiểm tra lại
                </Button>
                <a
                  className={`app-update-link${panel.htmlUrl ? "" : " hidden"}`}
                  href={panel.htmlUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                   Mở Release
                </a>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
