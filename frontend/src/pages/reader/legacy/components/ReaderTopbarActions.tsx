// Nhóm thao tác thanh trên: bốn nút bật/tắt công cụ + menu tải xuống.
// Trạng thái bật/tắt đăng ký drawer store (thay ghi mệnh lệnh aria-expanded/is-active
// của side-drawers.js cũ cho nút); menu tải xuống là component React, context do boot
// tiêm sau khi manifest tải xong.

import { useDrawerActive } from "../state/use-drawer-active.js";
import { ReaderDownloadMenu } from "./ReaderDownloadMenu.jsx";

const TOOL_BUTTONS = [
  { key: "markdown", id: "reader-markdown-toggle-btn", controls: "reader-markdown-drawer", label: "Markdown" },
  { key: "favorites", id: "reader-favorites-toggle-btn", controls: "reader-favorites-drawer", label: "Trích đoạn" },
  { key: "annotations", id: "reader-annotations-toggle-btn", controls: "reader-annotations-drawer", label: "Chú thích" },
  { key: "ai", id: "reader-ai-toggle-btn", controls: "reader-ai-drawer", label: "Hỏi đáp AI" },
];

export function ReaderTopbarActions({ drawerStore, downloadContext }) {
  const active = useDrawerActive(drawerStore);
  return (
    <div className="reader-topbar-actions">
      {TOOL_BUTTONS.map(({ key, id, controls, label }) => {
        const open = active === key;
        return (
          <button
            key={key}
            id={id}
            type="button"
            className={open ? "reader-topbar-action-btn is-active" : "reader-topbar-action-btn"}
            aria-expanded={open ? "true" : "false"}
            aria-controls={controls}
            onClick={() => drawerStore.toggle(key)}
          >{label}</button>
        );
      })}
      <ReaderDownloadMenu context={downloadContext} />
    </div>
  );
}
