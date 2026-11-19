/** 包自己渲染的那几个面板的规格 —— dock 的 tab 从这里来。
 *
 * 和 reader-host-panels.ts 是同一套手法（见那份文件顶部那段为什么用 Record）：
 * `satisfies Record<ReaderBasePanelId, …>` 让 id 清单和规格表必须一一对应，
 * 清单里加了 id 而这里没写规格，**编译不过**。数组字面量给不了这个保证 ——
 * 少一项只是数组短了一个，而表现是「那个面板再也打不开」，不报错也不变红。
 *
 * 这份表以前不存在：Markdown / AI 的 tab 直接写在 ReaderAssistantDock 里，
 * 批注 / AI 批注 / 摘录 则根本不在 dock 里，只能从可拖动圆钮（FAB）进。
 * 圆钮被 `.is-assistant-open .reader-fab { opacity: 0 }` 一条 CSS 吃掉后，
 * 那三个面板在「dock 开着」时完全进不去 —— 所以现在只保留一个启动器。
 */
import { FileCode2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  READER_BASE_PANEL_IDS,
  type ReaderBasePanelId,
} from "../../shared/types/reader-assistant-panels.js";

export type ReaderBasePanelSpec = {
  id: ReaderBasePanelId;
  /** dock 展开时 tab 上的文字。 */
  label: string;
  /** dock 收起时侧边竖条上的缩写。 */
  short: string;
  Icon: LucideIcon;
  /** 没有任务（纯本地 PDF）时这个面板是空的，tab 禁用并说明原因。
   *
   * 这条行为原来只活在 FAB 的菜单行里（"需打开任务阅读"），dock 的 tab 没有。
   * 合并启动器时把更有信息量的那一份留下来 —— 点开一个空面板比点不动更糟。
   */
  needsJob: boolean;
};

const SPECS = {
  markdown: { label: "Markdown", short: "MD", Icon: FileCode2, needsJob: true },
} satisfies Record<ReaderBasePanelId, Omit<ReaderBasePanelSpec, "id">>;

/** 顺序来自 id 清单，不是这张表的字面量顺序 —— 清单才是真源。 */
export const READER_BASE_PANELS: readonly ReaderBasePanelSpec[] = READER_BASE_PANEL_IDS.map(
  (id) => ({ id, ...SPECS[id] }),
);
