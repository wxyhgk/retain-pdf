// 详情右栏 Tab 切换壳：简介 / 处理 / 文件。
// 页签样式见同目录 BookDetailRightTabs.css（.book-detail-right-tab.is-active）。

import { useEffect, useState, type ReactNode, type SVGProps } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/ui/lib/utils";

function IconBook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="13" height="13" aria-hidden="true" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconProcessing(props: SVGProps<SVGSVGElement>) {
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
function IconFile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="13" height="13" aria-hidden="true" {...props}>
      <path d="M6 2h8l4 4v16H6z" strokeLinejoin="round" />
      <path d="M14 2v5h5M9 12h6M9 16h6" strokeLinecap="round" />
    </svg>
  );
}
// shortLabel 用于按钮显示，避免挤占关闭钮；title 完整名称给悬停/无障碍
export const BOOK_DETAIL_TABS = Object.freeze([
  { id: "overview", label: "概览", title: "文档概览", Icon: IconBook },
  { id: "processing", label: "进度", title: "文档进度", Icon: IconProcessing },
  { id: "artifacts", label: "文件", title: "文件与产物", Icon: IconFile },
]);

type TabContext = { activeTab: string; selectTab: (tab: string) => void };
/** 页签内容：直接给节点，或给一个拿到当前页签上下文再渲染的函数。 */
type TabSlot = ReactNode | ((ctx: TabContext) => ReactNode);

export type BookDetailRightTabsProps = {
  open: boolean;
  resetKey?: string;
  defaultTab?: string;
  overviewTab: TabSlot;
  processingTab: TabSlot;
  artifactsTab: TabSlot;
  onTabChange?: (tab: string) => void;
};

export function BookDetailRightTabs({
  open,
  resetKey = "",
  defaultTab = "overview",
  overviewTab,
  processingTab,
  artifactsTab,
  onTabChange,
}: BookDetailRightTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || "overview");

  // open/换文档时回到 defaultTab；同时跟随 defaultTab 变化（例如提交翻译后
  // 强制进处理 Tab）。用户手动切 Tab 不改 defaultTab，所以不会被拉回。
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab || "overview");
    }
  }, [open, resetKey, defaultTab]);

  function handleTabChange(next: string) {
    setActiveTab(next);
    onTabChange?.(next);
  }

  const tabCtx = { activeTab, selectTab: handleTabChange };
  const overviewNode = typeof overviewTab === "function" ? overviewTab(tabCtx) : overviewTab;
  const processingNode = typeof processingTab === "function" ? processingTab(tabCtx) : processingTab;
  const artifactsNode = typeof artifactsTab === "function" ? artifactsTab(tabCtx) : artifactsTab;

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
              <Icon className="book-detail-right-tab-icon h-3.5 w-3.5" />
              <span className="book-detail-right-tab-label">{tab.label}</span>
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      {/* forceMount 保留表单状态；副作用组件必须同时检查 activeTab。 */}
      <TabsPrimitive.Content
        value="overview"
        forceMount
        id="book-detail-panel-overview"
        className="book-detail-right-panel outline-none data-[state=inactive]:hidden"
      >
        {overviewNode}
      </TabsPrimitive.Content>

      <TabsPrimitive.Content
        value="processing"
        forceMount
        id="book-detail-panel-processing"
        className="book-detail-right-panel outline-none data-[state=inactive]:hidden"
      >
        {processingNode}
      </TabsPrimitive.Content>

      <TabsPrimitive.Content
        value="artifacts"
        forceMount
        id="book-detail-panel-artifacts"
        className="book-detail-right-panel outline-none data-[state=inactive]:hidden"
      >
        {artifactsNode}
      </TabsPrimitive.Content>

    </TabsPrimitive.Root>
  );
}
