// SettingsHubDialog v2: Điều hướng trái + Vùng nội dung phải (bố cục pill ngang "dialog tiền sảnh" cũ đã ngừng sử dụng).
//
// Bố cục: Điều hướng dọc bên trái (icon + tên, Radix Tabs orientation=vertical, phím mũi tên khả dụng),
// Khung nội dung bên phải (mỗi vùng tự có dòng tiêu đề + nội dung chính, cuộn độc lập). Vùng giao diện được nâng lên thành
// sân khấu chính của lưới thẻ chủ đề; API/bảng từ vì biểu mẫu thực tế vẫn là các hộp thoại cấp cao độc lập (CredentialsDialog/
// GlossariesDialog, mỗi cái có controller/store/hợp đồng kiểm thử riêng), bảng này giữ vai trò "vùng khởi động"
// giữ nút lối vào — sau này nếu muốn nhúng bên trong, nơi thay đổi là hai feature đó, không phải ở đây.
//
// 【Hợp đồng kiểm thử, sửa đổi không được phá vỡ】(credentials/glossaries/app-update component tests):
// - #app-settings-dialog / #app-settings-close-btn
// - [data-settings-tab="api|glossary|appearance|update"] có thể nhấp
// - [data-settings-panel=…] forceMount + thuộc tính hidden chuyển đổi (kiểm thử assert .hidden)
// - #credentials-btn / #glossary-btn mở hộp thoại con tương ứng
// - Panel giao diện #theme-appearance-panel và #theme-option-<id>
//
// Trạng thái mở/đóng xuyên cây con đi qua settings-hub-dialog-store; chuyển đổi tab là trạng thái tạm thời trong cây con (useState).
// Không forceMount Content/Overlay của Dialog (Radix hideOthers phụ thuộc vào mount/unmount thực tế,
// xem chú thích đầu CredentialsDialog). Giải thích vòng đời mount của AppUpdateBanner
// xem kết luận chú thích đầu phiên bản cũ: việc tự kiểm tra ngầm do controller logic thuần của composition điều khiển,
// không liên quan đến việc component này có được mount hay không.

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { APP_SETTINGS_DIALOG_IDS } from "../credentials/credentials-dom-ids.js";
import { AppUpdateBanner } from "../app-update/AppUpdateBanner.jsx";
import { CredentialsWorkbench } from "../credentials/CredentialsWorkbench.jsx";
import { ThemeAppearancePanel } from "./ThemeAppearancePanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size trong file nguồn chưa chú thích kiểu bị suy luận là bắt buộc; đường dẫn unstyled lúc runtime không dùng size.
const Button = ButtonBase as any;

function IconKey(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M14.5 9.5a4 4 0 1 1-1.2 2.86L5 20.65 3.35 19 11.6 10.7A4 4 0 0 1 14.5 9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
function IconBook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5.5 5.2A2.2 2.2 0 0 1 7.7 3H19v15.5H7.7a2.2 2.2 0 0 0-2.2 2.2V5.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.5 5.2A2.2 2.2 0 0 0 3.3 3H3v15.5h.3a2.2 2.2 0 0 1 2.2 2.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function IconPalette(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3a9 9 0 1 0 9 9c0-.5-.04-1-.12-1.48a5 5 0 0 1-6.4-6.4A9 9 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="8.5" cy="10" r="1.1" fill="currentColor" />
      <circle cx="11.5" cy="7.2" r="1.1" fill="currentColor" />
      <circle cx="15.2" cy="9" r="1.1" fill="currentColor" />
    </svg>
  );
}
function IconUpdate(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 5v2.1M12 16.9V19M5 12h2.1M16.9 12H19M7.05 7.05l1.5 1.5M15.45 15.45l1.5 1.5M16.95 7.05l-1.5 1.5M8.55 15.45l-1.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

const TABS = [
  { id: "api", label: "Cài đặt API", Icon: IconKey },
  { id: "glossary", label: "Bảng thuật ngữ", Icon: IconBook },
  { id: "appearance", label: "Giao diện", Icon: IconPalette },
  { id: "update", label: "Cập nhật", Icon: IconUpdate },
];

const PANE_HEADS = {
  api: { title: "Cài đặt API", desc: "Cấu hình OCR Token, DeepSeek Key, địa chỉ model và tùy chọn nhiệm vụ, lưu ngay lập tức có hiệu lực." },
  glossary: { title: "Bảng thuật ngữ", desc: "Duy trì cách dịch cố định, từ giữ nguyên và sở thích thuật ngữ chuyên ngành." },
  appearance: { title: "Giao diện", desc: "Chọn màu giao diện, có hiệu lực ngay và ghi nhớ lựa chọn trên máy này." },
  update: { title: "Cập nhật", desc: "Xem phiên bản hiện tại và kiểm tra lại cập nhật từ GitHub Releases." },
};

function PaneHead({ tab }: { tab: keyof typeof PANE_HEADS }) {
  const head = PANE_HEADS[tab];
  return (
    <header className="app-settings-pane-head">
      <h3>{head.title}</h3>
      <p>{head.desc}</p>
    </header>
  );
}

export function SettingsHubDialog() {
  const services = useHomeServices();
  const { dialogStore } = services.settingsHub;
  const dialogState = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);
  const [activeTab, setActiveTab] = useState(dialogState.payload?.tab || "api");

  useEffect(() => {
    if (open) {
      setActiveTab(dialogState.payload?.tab || "api");
    }
  }, [open]);

  // Khu API nhúng workbench thông tin xác thực: khi vào tab api, điền ngược biểu mẫu từ trạng
  // thái thông tin xác thực (không mở lớp hai). forceMount bảo đảm panel đã mount; bù
  // lại bằng rAF, tránh ref chưa gắn khiến ô mật khẩu trống, lưu đọc phải chuỗi rỗng.
  useEffect(() => {
    if (!open || activeTab !== "api") {
      return;
    }
    const prepare = () => services.credentials?.feature?.prepareCredentialsPanels?.();
    prepare();
    const raf = requestAnimationFrame(prepare);
    return () => cancelAnimationFrame(raf);
  }, [open, activeTab, services]);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  function openGlossaries() {
    services.glossaries.dialogStore.open();
  }

  function panelClass(tab: string) {
    // Nối literal thuần (kèm dấu cách ngăn), tránh bẫy template `x${y}` của máy quét v4
    return activeTab === tab ? "app-settings-panel is-current" : "app-settings-panel";
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id={APP_SETTINGS_DIALOG_IDS.dialog}
          className="desktop-dialog app-settings-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell app-settings-shell">
            <TabsPrimitive.Root
              className="app-settings-layout"
              orientation="vertical"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <aside className="app-settings-rail">
                <DialogPrimitive.Title asChild>
                  <h2>Cài đặt</h2>
                </DialogPrimitive.Title>
                <TabsPrimitive.List className="app-settings-nav" aria-label="Phân loại cài đặt">
                  {TABS.map(({ id, label, Icon }) => (
                    <TabsPrimitive.Trigger
                      key={id}
                      value={id}
                      className={activeTab === id ? "is-active" : ""}
                      data-settings-tab={id}
                    >
                      <Icon />
                      {label}
                    </TabsPrimitive.Trigger>
                  ))}
                </TabsPrimitive.List>
              </aside>

              <div className="app-settings-pane">
                <DialogPrimitive.Close asChild>
                  <Button
                    id={APP_SETTINGS_DIALOG_IDS.closeButton}
                    className="dialog-close-btn app-settings-close"
                    aria-label="Đóng"
                  >
                    ×
                  </Button>
                </DialogPrimitive.Close>

                <TabsPrimitive.Content
                  value="api"
                  forceMount
                  hidden={activeTab !== "api"}
                  className={panelClass("api")}
                  data-settings-panel="api"
                >
                  <PaneHead tab="api" />
                  {/* Nhúng trực tiếp workbench thông tin xác thực (không có hộp thoại
                      lớp hai); dùng chung CredentialsWorkbench với cổng cấu hình đầu tiên,
                      trạng thái cùng nguồn. */}
                  <CredentialsWorkbench />
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="glossary"
                  forceMount
                  hidden={activeTab !== "glossary"}
                  className={panelClass("glossary")}
                  data-settings-panel="glossary"
                >
                  <PaneHead tab="glossary" />
                  <div className="app-settings-launcher">
                    <p>
                      Bảng thuật ngữ quyết định cách dịch cố định và từ giữ nguyên. Có thể duy trì nhiều bảng và
                      bật theo nhu cầu, có hiệu lực khi bắt đầu nhiệm vụ dịch.
                    </p>
                    <Button id={APP_SETTINGS_DIALOG_IDS.glossaryButton} className="app-settings-action" onClick={openGlossaries}>
                      Mở bảng thuật ngữ
                    </Button>
                  </div>
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="appearance"
                  forceMount
                  hidden={activeTab !== "appearance"}
                  className={panelClass("appearance")}
                  data-settings-panel="appearance"
                >
                  <PaneHead tab="appearance" />
                  <ThemeAppearancePanel />
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="update"
                  forceMount
                  hidden={activeTab !== "update"}
                  className={panelClass("update")}
                  data-settings-panel="update"
                >
                  <PaneHead tab="update" />
                  {/* AppUpdateBanner: nút và hộp thoại chi tiết hợp nhất (bản thiết kế §5).
                      Xem chú thích đầu file về việc tách vòng đời mount khỏi tự kiểm tra nền. */}
                  <AppUpdateBanner />
                </TabsPrimitive.Content>
              </div>
            </TabsPrimitive.Root>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
