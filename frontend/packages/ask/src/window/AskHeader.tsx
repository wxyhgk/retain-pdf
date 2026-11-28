// 提问窗的标题栏（2026-11-27 按「对话」收拾）：左边是这是哪个对话（宿主画，阅读页是「主对话 ▾」那个对话菜单），
// 右边只留不常用的「···」和窗口怎么摆（贴右边 / 放大 / 关）。以前一行十个图标（选 agent、插头、记忆、历史、归档……）：
// 选 agent 和没装的 agent 挪进输入框那颗「谁来答」（agent-row.tsx），历史、归档进对话菜单，记忆进「···」。字都放悬停提示里。
import type { ReactElement, ReactNode } from "react";
import { Maximize2, MessageCircleQuestion, Minimize2, PanelRight, PanelRightClose, Trash2, X } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { AskAgent } from "../contract.js";
import type { ModelOption } from "../ui/utils/model-selection.js";
import { AgentIcon } from "./BrandIcon.js";
import { shortAgentName } from "./agent-row.js";
import { AskMoreMenu, type AskHeaderMenuItem } from "./head-menu.js";

export { shortAgentName } from "./agent-row.js";

export type AskWindowMode = "float" | "dock" | "full";

/** agent 列表换成 ModelSelector 的选项（没装的灰着）；留给宿主自己摆选择器用。 */
export function agentOptions(agents: readonly AskAgent[]): ModelOption[] {
  return agents.map((agent) => ({
    id: agent.id,
    name: shortAgentName(agent.name),
    ...(agent.available === false ? { description: agent.reason || "没装" } : agent.description ? { description: agent.description } : {}),
    disabled: agent.available === false,
    keywords: [agent.name],
    icon: <AgentIcon id={agent.id} name={agent.name} />,
  }));
}

export type AskHeaderProps = {
  /** 左边的标题（阅读页：对话菜单）。 */
  title?: ReactNode;
  /** 右边多放的按钮（旧写法，宿主还能用；常用的不多，尽量放进 menu）。 */
  actions?: ReactNode;
  /** 「···」里的项（不常用的：记忆……）。 */
  menu?: readonly AskHeaderMenuItem[];
  mode: AskWindowMode;
  onMode: (mode: AskWindowMode) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export function AskHeader({ title, actions, menu = [], mode, onMode, onDelete, onClose }: AskHeaderProps): ReactElement {
  return (
    <header className="ask-head" onDoubleClick={(event) => {
      if ((event.target as HTMLElement).closest("button, select, summary, .ui-select, .ask-head-menu-body")) return;
      onMode(mode === "full" ? "float" : "full");
    }}>
      <MessageCircleQuestion size={15} className="ask-logo" aria-label="提问" />
      {title ? <div className="ask-title">{title}</div> : null}
      <span className="ask-head-gap" />
      {actions}
      <AskMoreMenu items={menu} />
      <Button
        className="ask-icon"
        aria-label={mode === "dock" ? "改回浮动" : "贴到右边"}
        title={mode === "dock" ? "改回浮动" : "贴到右边"}
        onClick={() => onMode(mode === "dock" ? "float" : "dock")}
      >
        {mode === "dock" ? <PanelRightClose size={14} aria-hidden /> : <PanelRight size={14} aria-hidden />}
      </Button>
      <Button
        className="ask-icon"
        aria-label={mode === "full" ? "还原" : "放大"}
        title={mode === "full" ? "还原（双击标题栏）" : "放大（双击标题栏）"}
        onClick={() => onMode(mode === "full" ? "float" : "full")}
      >
        {mode === "full" ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
      </Button>
      {onDelete ? (
        <Button className="ask-icon" aria-label="删掉" title="删掉" onClick={onDelete}>
          <Trash2 size={14} aria-hidden />
        </Button>
      ) : null}
      <Button className="ask-icon" aria-label="关掉" title="关掉（Esc）" onClick={onClose}>
        <X size={15} aria-hidden />
      </Button>
    </header>
  );
}
