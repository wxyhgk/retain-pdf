// Các tab đầu trang "Thư viện / Bộ sưu tập / Yêu thích / AI Hỏi đáp" (nguyên
// thủy Tabs, không qua src/components/ui/tabs.jsx mặc định — giống lựa chọn
// hiện có của StatusDetailDialog/SettingsHubDialog, dùng class riêng thay vì
// giao diện shadcn mặc định).
//
// Dùng biểu tượng: mỗi tab có biểu tượng ngữ nghĩa + chữ ngắn (chỉ biểu tượng
// làm giảm khả năng định hướng).
// Tab đang chọn chỉ là trạng thái UI cấp trang (HomeApp useState), không lưu —
// tải lại sẽ trở về thư viện.

import { Tabs as TabsPrimitive } from "radix-ui";

// Thư viện: các gáy sách xếp trên giá
function IconLibrary() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </svg>
  );
}
// Bộ sưu tập: nhiều lớp sách chồng lên nhau
function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}
// Yêu thích: dấu trang (trích đoạn/ghi chú cấp đoạn, phân biệt với bộ sưu tập
// là nhóm tài liệu)
function IconBookmark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
// AI Hỏi đáp: tia sáng
function IconSparkles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      <path d="M19 15l.6 2.2L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.8L19 15z" />
    </svg>
  );
}

// Giữ key "categories" (hợp đồng id library-top-tab-categories / tham chiếu
// trong test không đổi). "favorites" / "ask" là các lối vào tiếp theo.
const TABS = [
  { key: "library", label: "Thư viện", Icon: IconLibrary },
  { key: "categories", label: "Bộ sưu tập", Icon: IconLayers },
  { key: "favorites", label: "Yêu thích", Icon: IconBookmark },
  { key: "ask", label: "AI Hỏi đáp", Icon: IconSparkles },
];

export function LibraryTopTabs({ active, onChange }) {
  return (
    <TabsPrimitive.Root
      className="library-top-tabs-root"
      value={active}
      onValueChange={onChange}
    >
      <TabsPrimitive.List className="library-top-tabs" aria-label="Chế độ xem thư viện">
        {TABS.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.key}
            value={tab.key}
            id={`library-top-tab-${tab.key}`}
            className={`library-top-tab ${active === tab.key ? "is-active" : ""}`.trim()}
          >
            <tab.Icon />
            <span>{tab.label}</span>
            {/* Móc trang trí: mặc định không kiểu và không render; giao diện có thể
                dùng CSS để thay hình cho tab. */}
            <span className="library-top-tab-ornament" aria-hidden="true" />
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
