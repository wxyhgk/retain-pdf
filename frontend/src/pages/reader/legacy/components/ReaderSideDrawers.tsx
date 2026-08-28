// Vỏ React của bốn ngăn bên (trích đoạn/chú thích/Markdown/AI), thay việc ghi
// is-open/inert của side-drawers.js cũ. Giữ nguyên ngữ nghĩa:
// - drawer store quyết định đóng/mở loại trừ lẫn nhau (một active);
// - ngăn favorites không bao giờ inert (ngoại lệ cũ: lớp trích đoạn ghim cần nó để tương tác);
// - ngăn AI không có nút đóng riêng (dùng tay cầm thu gọn cột phải hoặc nút trên thanh đầu);
// - container nội dung ngăn là phần mệnh lệnh độc lập: danh sách favorites
//   (drawer-renderer) và nội dung markdown (markdown-preview) tìm container theo id
//   để ghi; React không chạm vào sau commit đầu tiên;
//   bảng chú thích dùng trực tiếp mã nguồn component của islands/reader-annotations
//   (không dùng artifact biên dịch sẵn); luồng/composer/thanh phiên AI là React
//   (ReaderAiChat).

import { useMemo } from "react";
import { ReaderAnnotationsPanel } from "../../../../js/islands/reader-annotations/reader-annotations-app.jsx";
import { useDrawerActive } from "../state/use-drawer-active.js";
import { ReaderAiChat } from "./ReaderAiChat.jsx";

function drawerProps(active, key) {
  const open = active === key;
  return {
    className: `reader-side-drawer reader-${key}-drawer${open ? " is-open" : ""}`,
    // Ngoại lệ favorites giữ nguyên như triển khai cũ; các ngăn khác inert khi đóng
    // (không thể focus/tương tác).
    inert: key === "favorites" ? false : !open,
  };
}

export function ReaderFavoritesDrawer({ drawerStore }) {
  const active = useDrawerActive(drawerStore);
  return (
    <aside id="reader-favorites-drawer" aria-label="Mục yêu thích khi đọc" {...drawerProps(active, "favorites")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>Trích đoạn ảnh chụp</strong>
          <span>Nhấp đúp vùng chọn để đưa vào đây</span>
        </div>
        <button
          id="reader-favorites-close-btn"
          type="button"
          className="reader-side-drawer-close"
          aria-label="Đóng mục yêu thích"
          onClick={() => drawerStore.close("favorites")}
        >×</button>
      </div>
      {/* Danh sách do selection-favorites → favorites/drawer-renderer render mệnh lệnh (container là lá cố định). */}
      <div id="reader-favorites-list" className="reader-favorites-list"></div>
    </aside>
  );
}

export function ReaderAnnotationsDrawer({ drawerStore, ports }) {
  const active = useDrawerActive(drawerStore);
  const open = active === "annotations";
  // Port của bảng chú thích: boot cung cấp port dữ liệu; đăng ký đóng/mở được nối
  // với drawer store tại đây.
  const panelPorts = useMemo(() => {
    if (!ports) {
      return null;
    }
    return {
      ...ports,
      subscribeOpen(subscriber) {
        subscriber(drawerStore.getActive() === "annotations");
        return drawerStore.subscribe((current) => subscriber(current === "annotations"));
      },
    };
  }, [ports, drawerStore]);
  return (
    <aside id="reader-annotations-drawer" aria-label="Chú thích" {...drawerProps(active, "annotations")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>Chú thích</strong>
          <span>Chọn vùng bản gốc để tạo, hỗ trợ ghi chú và xuất</span>
        </div>
        <button
          id="reader-annotations-close-btn"
          type="button"
          className="reader-side-drawer-close"
          aria-label="Đóng chú thích"
          onClick={() => drawerStore.close("annotations")}
        >×</button>
      </div>
      <div id="reader-annotations-content" className="reader-annotations-body">
        {panelPorts ? <ReaderAnnotationsPanel ports={panelPorts} /> : null}
      </div>
    </aside>
  );
}

export function ReaderMarkdownDrawer({ drawerStore }) {
  const active = useDrawerActive(drawerStore);
  return (
    <aside id="reader-markdown-drawer" aria-label="Xem trước Markdown" {...drawerProps(active, "markdown")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>Xem trước Markdown</strong>
          <span>Văn bản Markdown do nhận dạng và dịch tạo ra</span>
        </div>
        <button
          id="reader-markdown-close-btn"
          type="button"
          className="reader-side-drawer-close"
          aria-label="Đóng xem trước Markdown"
          onClick={() => drawerStore.close("markdown")}
        >×</button>
      </div>
      {/* Dòng trạng thái và nội dung do markdown-preview.js điều khiển mệnh lệnh (container là lá cố định). */}
      <div className="reader-markdown-body">
        <div id="reader-markdown-status" className="reader-markdown-status">Chưa tải</div>
        <article id="reader-markdown-content" className="reader-markdown-content hidden"></article>
      </div>
    </aside>
  );
}

export function ReaderAiDrawer({ drawerStore, chatPorts }) {
  const active = useDrawerActive(drawerStore);
  return (
    <aside id="reader-ai-drawer" aria-label="Hỏi đáp khi đọc" {...drawerProps(active, "ai")}>
      <div className="reader-side-drawer-head">
        <div>
          <strong>Hỏi đáp khi đọc</strong>
          <span>Đặt câu hỏi dựa trên tài liệu hiện tại, có thể đổi phạm vi hỏi</span>
        </div>
      </div>
      <div className="reader-ai-body">
        {/* Nút đổi phạm vi và dòng ngữ cảnh do ai-context.js điều khiển mệnh lệnh
            (khung tĩnh, React không render lại). */}
        <div className="reader-ai-scope-block">
          <div className="reader-ai-scope" role="group" aria-label="Phạm vi hỏi">
            <button type="button" data-reader-ai-scope="document" className="is-active" aria-pressed="true">Toàn bộ tài liệu</button>
            <button type="button" data-reader-ai-scope="page" aria-pressed="false">Trang hiện tại</button>
            <button type="button" data-reader-ai-scope="selection" aria-pressed="false">Vùng chọn</button>
          </div>
          <div id="reader-ai-context" className="reader-ai-context">Phạm vi hiện tại: toàn bộ tài liệu</div>
        </div>
        <ReaderAiChat ports={chatPorts} />
      </div>
    </aside>
  );
}
