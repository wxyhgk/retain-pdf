// 提问窗的标题栏：图标为主。问的那一处（页码，点了回去）、选 agent、没装的 agent（插头图标，点开看安装命令）、
// 浮动 / 贴右边 / 放大、删、关。字都放悬停提示里。
import { useState, type ReactElement } from "react";
import { Copy, Maximize2, MapPin, MessageCircleQuestion, Minimize2, PanelRight, PanelRightClose, Plug, Trash2, X } from "lucide-react";
import { Button, Select } from "@retainpdf/ui";

import type { ReaderAskAgent, ReaderAskAnchor } from "../contracts/ask.js";
import { copyReaderText } from "../pdf/ReaderTextHoverLayer.js";

export type AskWindowMode = "float" | "dock" | "full";

/** 下拉里写短一点：「RetainPDF 自带模型」→「自带模型」。 */
export function shortAgentName(name: string): string {
  return name.replace(/^RetainPDF\s*/, "") || name;
}

/** 没装的本机 agent：插头图标，点开写安装命令（在终端跑一次），可以复制。后端不再现场下载（下到一半会留坏缓存）。 */
function InstallMenu({ agents }: { agents: readonly ReaderAskAgent[] | null }): ReactElement | null {
  const missing = (agents || []).filter((agent) => agent.available === false && agent.install);
  const [copied, setCopied] = useState("");
  if (!missing.length) return null;
  return (
    <details className="reader-ask-install">
      <summary className="reader-ask-close" aria-label="还能接的本机 agent" title={`还能接本机的 ${missing.map((agent) => agent.name).join("、")}（要先装）`}>
        <Plug size={14} aria-hidden />
      </summary>
      <ul>
        {missing.map((agent) => (
          <li key={agent.id}>
            <span>{agent.name}</span>
            <code title={agent.install}>{agent.install}</code>
            <Button
              className="reader-ask-close"
              aria-label={`复制「${agent.name}」的安装命令`}
              title={copied === agent.id ? "已复制" : "复制安装命令，在终端里跑一次"}
              onClick={async () => {
                if (await copyReaderText(agent.install || "")) setCopied(agent.id);
              }}
            >
              <Copy size={13} aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export type AskHeaderProps = {
  anchor: ReaderAskAnchor;
  agents: readonly ReaderAskAgent[] | null;
  agentId: string;
  onAgent: (id: string) => void;
  mode: AskWindowMode;
  onMode: (mode: AskWindowMode) => void;
  onShowAnchor?: () => void;
  onDelete?: () => void;
  onClose: () => void;
};

export function AskHeader({ anchor, agents, agentId, onAgent, mode, onMode, onShowAnchor, onDelete, onClose }: AskHeaderProps): ReactElement {
  const where = [`第 ${anchor.page} 页`, anchor.section].filter(Boolean).join(" · ");
  return (
    <header className="reader-ask-head" onDoubleClick={(event) => {
      if ((event.target as HTMLElement).closest("button, select, summary, .ui-select")) return;
      onMode(mode === "full" ? "float" : "full");
    }}>
      <MessageCircleQuestion size={15} className="reader-ask-logo" aria-label="提问" />
      <Button className="reader-ask-where" title={`回到问的那一处：${where}`} onClick={onShowAnchor}>
        <MapPin size={11} aria-hidden />
        {anchor.page}
      </Button>
      <Select
        size="sm"
        className="reader-ask-agent"
        aria-label="用哪个 agent"
        title={agents?.find((agent) => agent.id === agentId)?.name || ""}
        value={agentId}
        onChange={(event) => onAgent(event.target.value)}
        disabled={!agents?.length}
      >
        {(agents || []).map((agent) => (
          <option key={agent.id} value={agent.id} disabled={agent.available === false} title={agent.reason || agent.description || ""}>
            {shortAgentName(agent.name)}{agent.available === false ? "（没装）" : ""}
          </option>
        ))}
      </Select>
      <InstallMenu agents={agents} />
      <span className="reader-ask-head-gap" />
      <Button
        className="reader-ask-close"
        aria-label={mode === "dock" ? "改回浮动" : "贴到右边"}
        title={mode === "dock" ? "改回浮动" : "贴到右边"}
        onClick={() => onMode(mode === "dock" ? "float" : "dock")}
      >
        {mode === "dock" ? <PanelRightClose size={14} aria-hidden /> : <PanelRight size={14} aria-hidden />}
      </Button>
      <Button
        className="reader-ask-close"
        aria-label={mode === "full" ? "还原" : "放大"}
        title={mode === "full" ? "还原（双击标题栏）" : "放大（双击标题栏）"}
        onClick={() => onMode(mode === "full" ? "float" : "full")}
      >
        {mode === "full" ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
      </Button>
      {onDelete ? (
        <Button className="reader-ask-close" aria-label="删掉这次提问" title="删掉这次提问（书页上的「?」也去掉）" onClick={onDelete}>
          <Trash2 size={14} aria-hidden />
        </Button>
      ) : null}
      <Button className="reader-ask-close" aria-label="关掉" title="关掉（Esc）" onClick={onClose}>
        <X size={15} aria-hidden />
      </Button>
    </header>
  );
}
