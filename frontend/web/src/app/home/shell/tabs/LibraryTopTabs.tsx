// 主页顶部"图书馆 / 合集 / 收藏 / AI 问答"分栏(裸 Tabs 原语,不经 src/components/ui/tabs.jsx
// 默认皮肤——同 StatusDetailDialog/SettingsHubDialog 的既有选择,用项目自有
// class,不接 shadcn 默认视觉)。
//
// 图标化:每个 tab 前置语义图标 + 短文字(纯图标伤 wayfinding)。
// 激活 tab 是纯页面级 UI 态(HomeApp useState),不持久化——刷新回到图书馆。

import { Tabs as TabsPrimitive } from "radix-ui";

// 图书馆:书脊排列在书架上
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
// 合集:多层叠书
function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}
// 收藏:书签(段落级摘录/笔记,与合集=文档分组区分)
function IconBookmark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
// AI 问答:星芒
function IconSparkles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      <path d="M19 15l.6 2.2L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.8L19 15z" />
    </svg>
  );
}

// 命名统一：UI tab key "categories" == Domain "collections" == 视图 "CategoriesView/CollectionsView" 三名一物。
// 契约：DOM id `library-top-tab-categories` 与 activeTab === "categories" 为历史契约（tests/home-app-component.test.mjs
// 断言该 id），不可改为 "collections" —— 功能等同于 collections。详见 `features/collections` 与
// `features/library/categories/CategoriesView.tsx`（已导出 CollectionsView 别名，逐步向 collections 收口）。
// 若后续全量重命名，需同步改：LibraryTopTabs key / HomeApp activeTab / home-return-state activeTab /
// categories-view DOM id / CSS .categories-*。
// "favorites" / "ask" 为后续入口。
export const COLLECTIONS_TAB_KEY = "categories"; // 领域名 collections，UI 契约名 categories
const TABS = [
  { key: "library", label: "图书馆", Icon: IconLibrary },
  { key: COLLECTIONS_TAB_KEY, label: "合集", Icon: IconLayers },
  { key: "favorites", label: "收藏", Icon: IconBookmark },
  { key: "ask", label: "AI 问答", Icon: IconSparkles },
];

export function LibraryTopTabs({ active, onChange }) {
  return (
    <TabsPrimitive.Root
      className="library-top-tabs-root"
      value={active}
      onValueChange={onChange}
    >
      <TabsPrimitive.List className="library-top-tabs" aria-label="图书馆视图">
        {TABS.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.key}
            value={tab.key}
            id={`library-top-tab-${tab.key}`}
            className={`library-top-tab ${active === tab.key ? "is-active" : ""}`.trim()}
          >
            <tab.Icon />
            <span>{tab.label}</span>
            {/* 装饰钩子：默认无样式零渲染，皮肤可在 CSS 里给 tab 贴图换装 */}
            <span className="library-top-tab-ornament" aria-hidden="true" />
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
