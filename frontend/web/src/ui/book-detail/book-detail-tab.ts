// 书籍详情右栏的一个页签的登记格式（功能登记表第二步，docs/ops/planning/frontend-migration/20261112-功能登记表.md）。
//
// 页签外壳（features/book-detail 的 BookDetailRightTabs）只按表画：排序、懒挂载、每页各套一层出错兜底，
// 不知道有哪些页签。书籍详情自己的页签在 BookDetailDialog 里列表（概览、进度、文件、历史要用详情弹窗内部的
// 状态，就地拼；质量、术语只要这本书是哪本，写成独立的一项）；别的功能要加页签，在自己目录写一项、在装配层
// app/home/shell/book-detail-tabs.ts 的表里加一行，不用改书籍详情。
//
// 放在 ui 层：功能和装配层都能引，它只依赖 React 的类型。

import type { ComponentType, ReactNode } from "react";

/** 页签拿得到的关于这本书的东西。只放各页签普遍用得上的；要详情弹窗内部状态的页签由书籍详情自己拼。 */
export type BookDetailTabContext = {
  documentId: string;
  /** 这本书当前的任务（可能是空串：还没处理过）。 */
  jobId: string;
  title: string;
  /** 详情弹窗开着没有。 */
  open: boolean;
  /** 当前选中的页签 id。 */
  activeTab: string;
  selectTab: (id: string) => void;
  /** 打开阅读器并钉住这个任务（会关掉详情）。 */
  openPinnedJob: (jobId: string) => void;
  /** 打开设置弹窗的某一栏（叠在详情上）。取不到设置入口时不给。 */
  openSettings?: (tab: string) => void;
};

export type BookDetailTab = {
  /** 唯一。页签按钮的 id 是 book-detail-tab-<id>，内容是 book-detail-panel-<id>。 */
  id: string;
  /** 页签上的短字（不挤关闭钮）。 */
  label: string;
  /** 完整名字，给悬停和读屏。 */
  title: string;
  Icon: ComponentType<{ className?: string }>;
  /** 先后，小的在左。按十位留空隙。 */
  order: number;
  /** 第一次点开才挂内容（之后保留），里面的请求不会在打开详情时就全发出去。 */
  lazy?: boolean;
  /** 这本书有没有这一页（例如还没有任务就没有「质量」）。不给就总有。 */
  available?: (context: BookDetailTabContext) => boolean;
  render: (context: BookDetailTabContext) => ReactNode;
};

/** 按 order 排；order 相同按 id，结果稳定。 */
export function sortBookDetailTabs(tabs: readonly BookDetailTab[]): BookDetailTab[] {
  return [...tabs].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
