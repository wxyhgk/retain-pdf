/** 阅读页唯一的面板启动器。
 *
 * 顶栏托盘里一颗一颗的按钮（ReaderPanelToggles，一直在，开着时按下），开着时面板顶上再有 tab 条和关闭
 * （ReaderAssistantDock）。两处**同一份清单**，来自 readerDockTabs()，不在这里手抄。
 *
 * 2026-11-06 以前关着时是右侧竖条（rail）：只剩 Markdown 一颗，孤零零浮在书页旁边，还要给它在阅读区右边留 62px。
 *
 * ## 这里以前是「两个启动器各管一半」
 *
 * rail 只有 Markdown / AI / 阅读路径 / 画布 / 终端，批注 / AI 批注 / 摘录 和
 * 三路下载只能从可拖动的圆钮（FAB）进。而
 * `.is-assistant-open .reader-fab { opacity: 0; pointer-events: none }` 这一条
 * 让圆钮在任何 dock 面板开着时整个消失 —— 那 6 个功能当场变成不可达，键盘也
 * 没有入口。用户还得先记住「批注在圆钮、路径在竖条」这张哪儿都没写的表。
 *
 * ## 8 个 tab 放不下怎么办
 *
 * dock 最窄 30vw（reader-assistant-split-constraints.ts），1280 的屏上只有 384px，
 * 8 个中文 tab 一行肯定放不下。**降级在 CSS 里**（assistant-dock.css）：tab 条
 * 可横向滚动、min-width: 0 能被压缩、窄到一定程度只留图标（label 有 title 兜
 * 底）。不用 JS 量宽度 —— 量宽度要监听 resize、要处理首帧为 0，而这里没有任何
 * 需要 JS 才能表达的东西。
 */
import { X } from "lucide-react";
import type { ReactElement } from "react";
import { useReaderContext } from "./reader-context.js";
import { readerDockTabs, type ReaderDockTab } from "./reader-dock-tabs.js";
import type { ReaderAssistantPanel } from "./reader-assistant-types.js";

// 既有 import 兼容：类型真值已移至叶子文件。
export type { ReaderAssistantPanel } from "./reader-assistant-types.js";

/** 竖条 / tab 条上的一颗：dock 的一个面板。 */
type DockEntry = {
  key: string;
  label: string;
  short: string;
  Icon: ReaderDockTab["Icon"];
  disabled: boolean;
  selected: boolean;
  badge?: number;
  onClick: () => void;
};

export type ReaderAssistantDockProps = {
  active: ReaderAssistantPanel | null;
  /** 角标条数。0 / 缺省不画 —— 「0 条」比不画更让人以为坏了。
   *
   * 但**行本身永远在**：条数为 0 恰恰是最需要入口的时候（用户根本不知道有
   * AI 批注这回事）。tab 清单来自 readerDockTabs()，它连条数都拿不到，
   * 所以「按条数把 tab 藏掉」在这里写不出来。
   */
  badges?: Partial<Record<ReaderAssistantPanel, number>>;
  /** 无 job 时为 true；缺省从 reader context 取 controller.sourceOnly */
  sourceOnly?: boolean;
  /** 缺省时从 reader context 的 assistant actions 取 */
  onSelect?: (panel: ReaderAssistantPanel) => void;
  onClose?: () => void;
};

/** 顶栏托盘里的面板按钮（只有图标，名字在悬停里）：点了开、再点收；没有任务时禁用并说明原因。 */
export function ReaderPanelToggles(props: Pick<ReaderAssistantDockProps, "active" | "sourceOnly" | "onSelect" | "onClose">): ReactElement {
  const ctx = useReaderContext();
  const { active } = props;
  const sourceOnly = props.sourceOnly ?? ctx?.sourceOnly ?? false;
  const onSelect = props.onSelect ?? ctx?.assistant.select ?? (() => {});
  const onClose = props.onClose ?? ctx?.assistant.close ?? (() => {});
  return (
    <>
      {readerDockTabs().map(({ id, label, Icon, needsJob }) => {
        const open = active === id;
        const disabled = needsJob && sourceOnly;
        const name = open ? `收起${label}` : `打开${label}`;
        return (
          <button
            key={id}
            type="button"
            className="reader-panel-toggle"
            aria-label={name}
            aria-pressed={open}
            title={disabled ? `${label} 需打开任务阅读` : label}
            disabled={disabled}
            onClick={() => (open ? onClose() : onSelect(id))}
          >
            <Icon className="reader-close-home-icon" size={18} strokeWidth={2.25} aria-hidden />
          </button>
        );
      })}
    </>
  );
}

/** 面板开着时顶上的 tab 条和关闭；关着时什么都不画（按钮在顶栏托盘里，见 ReaderPanelToggles）。 */
export function ReaderAssistantDock(props: ReaderAssistantDockProps): ReactElement | null {
  const ctx = useReaderContext();
  const { active, badges } = props;
  const sourceOnly = props.sourceOnly ?? ctx?.sourceOnly ?? false;
  const onSelect = props.onSelect ?? ctx?.assistant.select ?? (() => {});
  const onClose = props.onClose ?? ctx?.assistant.close ?? (() => {});
  const entries: DockEntry[] = readerDockTabs().map(({ id, label, short, Icon, needsJob }) => ({
    key: id,
    label,
    short,
    Icon,
    disabled: needsJob && sourceOnly,
    selected: active === id,
    badge: badges?.[id],
    onClick: () => onSelect(id),
  }));

  if (!active) return null;

  return (
    <header className="reader-assistant-dock-header">
      <div className="reader-assistant-dock-tabs" role="tablist" aria-label="阅读辅助面板">
        {entries.map(({ key, label, Icon, disabled, selected, badge, onClick }) => {
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`reader-assistant-dock-tab${selected ? " is-active" : ""}`}
              // 窄 dock 上只剩图标（见 assistant-dock.css 的容器查询），
              // title 是那时候唯一还能说出「这是哪个面板」的东西。
              title={disabled ? `${label} 需打开任务阅读` : label}
              disabled={disabled}
              onClick={onClick}
            >
              <Icon size={15} strokeWidth={2.15} aria-hidden />
              <span className="reader-assistant-dock-tab-label">{label}</span>
              {badge ? <span className="reader-assistant-dock-badge">{badge}</span> : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="reader-assistant-dock-close"
        aria-label="关闭阅读辅助面板"
        title="关闭辅助面板"
        onClick={onClose}
      >
        <X size={16} strokeWidth={2.25} aria-hidden />
      </button>
    </header>
  );
}
