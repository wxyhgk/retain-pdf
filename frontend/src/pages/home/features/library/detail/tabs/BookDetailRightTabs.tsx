// Vỏ chuyển đổi Tab cột phải chi tiết: biểu tượng + văn bản ngắn; chọn có nền đen chữ trắng.
// Kiểu dáng xem library-shell.css (.book-detail-right-tab.is-active).

import { useEffect, useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function IconBook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="13" height="13" aria-hidden="true" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTranslate(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="13" height="13" aria-hidden="true" {...props}>
      <path d="m5 8 6 6" strokeLinecap="round" />
      <path d="m4 14 6-6 2-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 5h12" strokeLinecap="round" />
      <path d="M7 2h1" strokeLinecap="round" />
      <path d="m22 22-5-10-5 10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 18h6" strokeLinecap="round" />
    </svg>
  );
}
function IconMore(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="13" height="13" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
      <circle cx="5" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

// shortLabel dùng để hiển thị trên nút, tránh chiếm chỗ nút đóng; title đầy đủ cho hover/truy cập
export const BOOK_DETAIL_TABS = Object.freeze([
  { id: "overview", label: "Giới thiệu", title: "Giới thiệu sách", Icon: IconBook },
  { id: "translate", label: "Dịch", title: "Dịch", Icon: IconTranslate },
  { id: "more", label: "Khác", title: "Thao tác khác", Icon: IconMore },
]);

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} [props.resetKey]
 * @param {string} [props.defaultTab]
 * @param {import("react").ReactNode | ((ctx: { activeTab: string }) => import("react").ReactNode)} props.overviewTab
 * @param {import("react").ReactNode | ((ctx: { activeTab: string }) => import("react").ReactNode)} props.translateTab
 * @param {import("react").ReactNode | ((ctx: { activeTab: string }) => import("react").ReactNode)} props.moreTab
 * @param {(tab: string) => void} [props.onTabChange]
 */
export function BookDetailRightTabs({
  open,
  resetKey = "",
  defaultTab = "overview",
  overviewTab,
  translateTab,
  moreTab,
  onTabChange,
}: any) {
  const [activeTab, setActiveTab] = useState(defaultTab || "overview");

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab || "overview");
    }
  }, [open, resetKey, defaultTab]);

  function handleTabChange(next) {
    setActiveTab(next);
    onTabChange?.(next);
  }

  const tabCtx = { activeTab };
  const overviewNode = typeof overviewTab === "function" ? overviewTab(tabCtx) : overviewTab;
  const translateNode = typeof translateTab === "function" ? translateTab(tabCtx) : translateTab;
  const moreNode = typeof moreTab === "function" ? moreTab(tabCtx) : moreTab;

  return (
    <TabsPrimitive.Root
      className="book-detail-right-tabs flex min-h-0 flex-col gap-4"
      value={activeTab}
      onValueChange={handleTabChange}
    >
      <TabsPrimitive.List
        className="book-detail-right-tabs-list"
        aria-label="Phân vùng chi tiết sách"
      >
        {BOOK_DETAIL_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.Icon;
          return (
            <TabsPrimitive.Trigger
              key={tab.id}
              value={tab.id}
              id={`book-detail-tab-${tab.id}`}
              title={tab.title}
              aria-label={tab.title}
              className={cn("book-detail-right-tab", isActive && "is-active")}
              data-active={isActive ? "true" : "false"}
            >
              <Icon className="book-detail-right-tab-icon" />
              <span className="book-detail-right-tab-label">{tab.label}</span>
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      {/* forceMount: bảng luôn trong DOM (ẩn bằng CSS), thuận tiện cho kiểm thử định vị + giữ trạng thái biểu mẫu */}
      <TabsPrimitive.Content
        value="overview"
        forceMount
        id="book-detail-panel-overview"
        className="book-detail-right-panel outline-none data-[state=inactive]:hidden"
      >
        {overviewNode}
      </TabsPrimitive.Content>

      <TabsPrimitive.Content
        value="translate"
        forceMount
        id="book-detail-panel-translate"
        className="book-detail-right-panel outline-none data-[state=inactive]:hidden"
      >
        {translateNode}
      </TabsPrimitive.Content>

      <TabsPrimitive.Content
        value="more"
        forceMount
        id="book-detail-panel-more"
        className="book-detail-right-panel outline-none data-[state=inactive]:hidden"
      >
        {moreNode}
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  );
}
