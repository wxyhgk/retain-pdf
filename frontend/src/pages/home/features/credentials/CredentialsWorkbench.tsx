// CredentialsWorkbench：Hiệu trưởng Biểu mẫu Chứng thực（API/Tùy chọn tác vụ Gấp đôi tab + bảng + Lưu hàng），
// Từ CredentialsDialog Các thành phần máy chủ kép được trích xuất：
//   1. SettingsHubDialog của API Nhúng trong khu vực（Lối vào chung，Không có cửa sổ bật lên hai lớp）
//   2. CredentialsDialog（Chỉ còn lại cấu hình cửa lần đầu tiên setupMode Một Cảnh）
// Gắn kết độc quyền giữa hai chủ nhà（Đặt thành chế độ、Cửa sổ bật lên chỉ được kích hoạt từ bootstrap tải lên），BROWSER_IDS của
// DOM id Không lặp lại trên cùng một màn hình。Trạng thái/Lưu/Xác minh tất cả useCredentialsController của
// Ví dụ đơn lẻ store——Chủ nhà chỉ là vỏ bọc。
//
// TaskOptionsPanel Giá đỡ cư dân（Không theo dõi tab Dismount）Hạn chế duy trì CredentialsDialog
// Kết luận bình luận tiêu đề：các trường của nó ref Đọc thống nhất khi lưu，Việc gỡ cài đặt sẽ tái tạo"Cắt thành API Điểm bảng điều khiển
// Lưu，Tùy chọn tác vụ bị mất âm thầm"。

import { Tabs as TabsPrimitive } from "radix-ui";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { OcrProviderPanels } from "./OcrProviderPanels.jsx";
import { DeepSeekPanel } from "./DeepSeekPanel.jsx";
import { TaskOptionsPanel } from "./TaskOptionsPanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size được suy ra là bắt buộc trong các tệp nguồn không được chú thích;unstyled Không được sử dụng khi đường dẫn được chạy size。
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

const TABS = [
  { id: "api", label: "Cài đặt API" },
  { id: "task", label: "Tùy chọn tác vụ" },
];

export function CredentialsWorkbench() {
  const { view, feature, handlers } = useCredentialsController();

  const setupMode = Boolean(view.setupMode);
  const activeTab = view.activeTab || "api";
  const dialogStatus = view.dialogStatus || { message: "", tone: "" };
  const statusContent = `${dialogStatus.message || ""}`.trim();
  const statusClasses = [
    "upload-status",
    statusContent ? "" : "hidden",
    dialogStatus.tone === "valid" ? "is-valid" : "",
    dialogStatus.tone === "error" ? "is-error" : "",
  ].filter(Boolean).join(" ");

  return (
    <TabsPrimitive.Root
      className="contents"
      value={activeTab}
      onValueChange={(tab) => feature?.activateCredentialTab(tab)}
    >
      <div className="credential-workbench">
        <TabsPrimitive.List
          id={BROWSER_IDS.tabs}
          className={`developer-tabs credential-tabs${setupMode ? " hidden" : ""}`}
          aria-label="Cài đặt API"
        >
          {TABS.map((tab) => (
            <TabsPrimitive.Trigger
              key={tab.id}
              value={tab.id}
              id={tab.id === "api" ? BROWSER_IDS.tabApi : BROWSER_IDS.tabTask}
              className={`developer-tab credential-tab${activeTab === tab.id ? " is-active" : ""}`}
              data-credential-tab={tab.id}
            >
              {tab.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        <div className="credential-panels">
          <TabsPrimitive.Content
            value="api"
            forceMount
            hidden={activeTab !== "api"}
            className={`credential-panel${activeTab === "api" ? " is-active" : ""}`}
            data-credential-panel="api"
          >
            <div className="credential-card-grid credential-card-grid-compact credential-api-grid">
              <section className="credential-card">
                <div className="credential-card-head">
                  <h3>OCR</h3>
                </div>
                <OcrProviderPanels />
              </section>
              <DeepSeekPanel />
            </div>
          </TabsPrimitive.Content>
          {/* Lý do không bọc TabsPrimitive.Content: TaskOptionsPanel đã có role=tabpanel, bọc thêm sẽ trùng ngữ nghĩa */}
          <TaskOptionsPanel hidden={activeTab !== "task"} />
        </div>
        <div className="actions credential-dialog-actions">
          <span id={BROWSER_IDS.status} className={statusClasses}>{statusContent}</span>
          <Button
            id={BROWSER_IDS.saveButton}
            className="app-button"
            onClick={() => handlers?.save?.()}
          >
            {setupMode ? "Lưu và bắt đầu" : "Lưu"}
          </Button>
        </div>
      </div>
    </TabsPrimitive.Root>
  );
}
