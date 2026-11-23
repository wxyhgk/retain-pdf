// 设置弹窗的一个分栏（左边导航一项 + 右边一块）的登记格式。
//
// 设置弹窗（features/settings 的 SettingsDialog）只是外壳：收一张分栏表，按 order 排、画导航和内容，
// 不知道有哪些分栏。各功能在自己目录里写好自己的那一项、从出口导出；要主页服务才拼得出的（接口设置、
// 术语表、更新、账户）在装配层 app/home/shell/settings-sections.tsx 里拼。加一个分栏 = 功能目录里写一项
// + 那张表里加一行。方案见 docs/ops/planning/frontend-migration/20261112-功能登记表.md。
//
// 放在 ui 层：功能和装配层都能引，它自己只依赖 React 的类型。

import type { ComponentType, ReactNode, SVGProps } from "react";

export type SettingsSectionRenderContext = {
  /** 这一栏是不是正选中。lazy 的分栏只在选中时才被画。 */
  active: boolean;
  /** 这次打开是不是首次配置门（只有接口设置用得上）。 */
  setupMode: boolean;
};

export type SettingsSection = {
  /** 唯一。同时是 data-settings-tab / data-settings-panel 的值，也是 dialogStore.open({ tab }) 认的名字。 */
  id: string;
  /** 左边导航上的字。 */
  label: string;
  /**
   * 使用说明书里讲这一栏的那一页：写登记这一栏的功能模块名（features/<模块>），对应 frontend/web/guide/<模块>.md，
   * 标题旁的「?」就在软件里打开那一页。说明书按模块分页，这里不另外维护链接表；没有说明页的（只有已停的多用户版才有的分栏）写 null。
   * tests/architecture/user-guide-coverage.test.mjs 查每个值都有对应的说明页。
   */
  guide: string | null;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** 导航里的先后，小的在上。按十位留空隙，插新的不用挪别人。 */
  order: number;
  /** 右边标题，不给就用 label。 */
  title?: string;
  /** 标题下一句说明。 */
  description?: string;
  /** 标题下额外的一行（例如首次配置门的引导）。 */
  subtitle?: (context: SettingsSectionRenderContext) => ReactNode;
  /** 内容。 */
  render: (context: SettingsSectionRenderContext) => ReactNode;
  /**
   * 只在选中时才画内容（默认 true）：面板自己会取数的（同步、备份、用量）不该一打开设置就全去取。
   * 要一直挂着的写 false：接口设置的表单要先挂上才能回填，外观、术语表入口是静态的。
   */
  lazy?: boolean;
  /** 每次切到这一栏（含打开时就停在这一栏）时调一次，下一帧再调一次（接口设置用它回填表单）。 */
  onShow?: (context: { setupMode: boolean }) => void;
};

/** 按 order 排好；order 相同按 id，结果稳定。 */
export function sortSettingsSections(sections: readonly SettingsSection[]): SettingsSection[] {
  return [...sections].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

