// 详情右栏的页签外壳：按页签表（BookDetailTab，见 ui/book-detail/book-detail-tab.ts）排序、画页签栏和内容，
// 不知道有哪些页签。表由 BookDetailDialog 列（书籍详情自己的页签 + 装配层传进来的别的功能的页签）。
// 2026-11-12 以前页签列表 BOOK_DETAIL_TABS 和一个页签一个参数都写在这里（功能登记表第二步）。
// 页签样式见同目录 BookDetailRightTabs.css（.book-detail-right-tab.is-active）。

import { useEffect, useMemo, useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/ui/lib/utils";
import { ErrorBoundary } from "@retainpdf/ui";
import { sortBookDetailTabs, type BookDetailTab, type BookDetailTabContext } from "@/ui/book-detail/book-detail-tab.js";

/** 打开详情时默认停留的页签。 */
const DEFAULT_TAB = "overview";

export type BookDetailRightTabsProps = {
  open: boolean;
  resetKey?: string;
  defaultTab?: string;
  /** 页签表。available 判定为 false 的不出现。 */
  tabs: readonly BookDetailTab[];
  /** 给每个页签的这本书的信息（activeTab、selectTab 由这里补上）。 */
  context: Omit<BookDetailTabContext, "activeTab" | "selectTab" | "open">;
  onTabChange?: (tab: string) => void;
};

export function BookDetailRightTabs({
  open,
  resetKey = "",
  defaultTab = DEFAULT_TAB,
  tabs: allTabs,
  context: bookContext,
  onTabChange,
}: BookDetailRightTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || DEFAULT_TAB);
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([defaultTab || DEFAULT_TAB]));

  // open/换文档时回到 defaultTab；同时跟随 defaultTab 变化（例如提交翻译后
  // 强制进处理 Tab）。用户手动切 Tab 不改 defaultTab，所以不会被拉回。
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab || DEFAULT_TAB);
      setVisited(new Set([defaultTab || DEFAULT_TAB]));
    }
  }, [open, resetKey, defaultTab]);

  function handleTabChange(next: string) {
    setActiveTab(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
    onTabChange?.(next);
  }

  const context: BookDetailTabContext = { ...bookContext, open, activeTab, selectTab: handleTabChange };
  const sorted = useMemo(() => sortBookDetailTabs(allTabs), [allTabs]);
  const tabs = sorted.filter((tab) => !tab.available || tab.available(context));

  return (
    <TabsPrimitive.Root
      className="book-detail-right-tabs"
      value={activeTab}
      onValueChange={handleTabChange}
    >
      <TabsPrimitive.List
        className="book-detail-right-tabs-list"
        aria-label="书籍详情分区"
      >
        {tabs.map((tab) => {
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
              <Icon className="book-detail-right-tab-icon h-3.5 w-3.5" />
              <span className="book-detail-right-tab-label">{tab.label}</span>
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      {/* forceMount 保留表单状态；副作用组件必须同时检查 activeTab。lazy 的页签没点开过就不挂内容。 */}
      {tabs.map((tab) => {
        const mounted = !tab.lazy || visited.has(tab.id) || activeTab === tab.id;
        return (
          <TabsPrimitive.Content
            key={tab.id}
            value={tab.id}
            forceMount
            id={`book-detail-panel-${tab.id}`}
            className="book-detail-right-panel outline-none data-[state=inactive]:hidden"
          >
            {/* 一个页签出错只坏这一页，别的页签和左栏照常用；换了一本书（resetKey）自动恢复。 */}
            {mounted ? (
              <ErrorBoundary scope="section" label={`「${tab.label}」页`} resetKeys={[resetKey]}>
                {tab.render(context)}
              </ErrorBoundary>
            ) : null}
          </TabsPrimitive.Content>
        );
      })}
    </TabsPrimitive.Root>
  );
}
