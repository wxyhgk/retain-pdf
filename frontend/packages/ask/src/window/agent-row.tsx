// 「谁来答」（2026-11-27 从标题栏挪进输入框那颗按钮的弹层）：用户心里「谁来答」是一件事——哪个 agent、什么模型、想不想——
// 以前 agent 在标题栏、模型和思考在输入框，分在两处。没装的本机 agent 也列在这里，点了给安装命令（以前是标题栏的插头图标）。
import { createContext, useState, type ReactElement } from "react";
import { Copy } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { AskAgent } from "../contract.js";
import { useCopyToClipboard } from "../ui/hooks/use-copy-to-clipboard.js";
import { AgentIcon } from "./BrandIcon.js";

/** 下拉里写短一点：「RetainPDF 自带模型」→「自带模型」。 */
export function shortAgentName(name: string): string {
  return name.replace(/^RetainPDF\s*/, "") || name;
}

export type AskAgentsState = {
  agents: readonly AskAgent[];
  agentId: string;
  onAgent: (id: string) => void;
};

export const AskAgentsContext = createContext<AskAgentsState | null>(null);

function InstallHint({ agent }: { agent: AskAgent }): ReactElement {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  if (!agent.install) return <p className="ask-answerer-install">{agent.reason || "这台电脑上还用不了。"}</p>;
  return (
    <p className="ask-answerer-install">
      <span>在终端里跑一次，装好后重开提问窗：</span>
      <code title={agent.install}>{agent.install}</code>
      <Button
        className="ask-icon"
        aria-label={`复制「${agent.name}」的安装命令`}
        title={isCopied ? "已复制" : "复制安装命令"}
        onClick={() => copyToClipboard(agent.install || "")}
      >
        <Copy size={13} aria-hidden />
      </Button>
    </p>
  );
}

/** 弹层最上面一排：能用的点了就换（换 agent 会开新会话，主对话照旧接着），没装的写「要先装」、点了看安装命令。只有一个 agent 时不画。 */
export function AgentRow({ agents, agentId, onAgent }: AskAgentsState): ReactElement | null {
  const [installing, setInstalling] = useState<string | null>(null);
  if (agents.length < 2) return null;
  const shown = installing ? agents.find((agent) => agent.id === installing) : undefined;
  return (
    <div className="ask-answerer">
      <p className="ask-answerer-title">谁来答</p>
      <div className="ask-answerer-agents" role="radiogroup" aria-label="谁来答">
        {agents.map((agent) => {
          const missing = agent.available === false;
          return (
            <Button
              key={agent.id}
              role="radio"
              aria-checked={agent.id === agentId}
              className="ask-answerer-agent"
              data-missing={missing ? "true" : undefined}
              title={missing ? `${agent.name}：${agent.reason || "要先装"}` : agent.description || agent.name}
              onClick={() => (missing ? setInstalling((current) => (current === agent.id ? null : agent.id)) : onAgent(agent.id))}
            >
              <AgentIcon id={agent.id} name={agent.name} size={14} />
              <span>{shortAgentName(agent.name)}</span>
              {missing ? <small>要先装</small> : null}
            </Button>
          );
        })}
      </div>
      {shown ? <InstallHint agent={shown} /> : null}
    </div>
  );
}
