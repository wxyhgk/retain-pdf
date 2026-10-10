// 详情右栏 Tab 切换壳：概览 / 进度 / 文件 / 质量 / 术语 / 历史 / 用量。
// 页签样式见同目录 BookDetailRightTabs.css（.book-detail-right-tab.is-active）。

import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { Clock3, Coins, Languages, ShieldCheck } from "lucide-react";
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
// shortLabel 用于按钮显示，避免挤占关闭钮；title 完整名称给悬停/无障碍。
// lazy：第一次点开才挂载（之后保留），里面的请求不会在打开详情时就全发出去。
type TabMeta = {
  id: string;
  label: string;
  title: string;
  Icon: ComponentType<{ className?: string }>;
  lazy?: boolean;
};

export const BOOK_DETAIL_TABS: readonly TabMeta[] = Object.freeze([
  { id: "overview", label: "概览", title: "文档概览", Icon: IconBook },
  { id: "processing", label: "进度", title: "文档进度", Icon: IconProcessing },
  { id: "artifacts", label: "文件", title: "文件与产物", Icon: IconFile },
  { id: "quality", label: "质量", title: "译文质量", Icon: ShieldCheck, lazy: true },
  { id: "terms", label: "术语", title: "术语与风格", Icon: Languages, lazy: true },
  { id: "history", label: "历史", title: "任务记录", Icon: Clock3, lazy: true },
  { id: "usage", label: "用量", title: "模型 token 用量", Icon: Coins, lazy: true },
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
  /** 以下几个不给（null / undefined）就不出现这个页签。 */
  qualityTab?: TabSlot;
  termsTab?: TabSlot;
  historyTab?: TabSlot;
  usageTab?: TabSlot;
  onTabChange?: (tab: string) => void;
};

export function BookDetailRightTabs({
  open,
  resetKey = "",
  defaultTab = "overview",
  overviewTab,
  processingTab,
  artifactsTab,
  qualityTab = null,
  termsTab = null,
  historyTab = null,
  usageTab = null,
  onTabChange,
}: BookDetailRightTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || "overview");
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([defaultTab || "overview"]));

  // open/换文档时回到 defaultTab；同时跟随 defaultTab 变化（例如提交翻译后
  // 强制进处理 Tab）。用户手动切 Tab 不改 defaultTab，所以不会被拉回。
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab || "overview");
      setVisited(new Set([defaultTab || "overview"]));
    }
  }, [open, resetKey, defaultTab]);

  function handleTabChange(next: string) {
    setActiveTab(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
    onTabChange?.(next);
  }

  const tabCtx = { activeTab, selectTab: handleTabChange };
  const slots: Record<string, TabSlot> = {
    overview: overviewTab,
    processing: processingTab,
    artifacts: artifactsTab,
    quality: qualityTab,
    terms: termsTab,
    history: historyTab,
    usage: usageTab,
  };
  const tabs = BOOK_DETAIL_TABS.filter((tab) => slots[tab.id] !== null && slots[tab.id] !== undefined);

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
        const slot = slots[tab.id];
        const mounted = !tab.lazy || visited.has(tab.id) || activeTab === tab.id;
        return (
          <TabsPrimitive.Content
            key={tab.id}
            value={tab.id}
            forceMount
            id={`book-detail-panel-${tab.id}`}
            className="book-detail-right-panel outline-none data-[state=inactive]:hidden"
          >
            {mounted ? (typeof slot === "function" ? slot(tabCtx) : slot) : null}
          </TabsPrimitive.Content>
        );
      })}
    </TabsPrimitive.Root>
  );
}
