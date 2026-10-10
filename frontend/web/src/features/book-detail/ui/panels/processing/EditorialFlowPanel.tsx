// 编辑部精修的流程图：几个角色接力到了哪一步、第几轮、这一步第几批。
// 读取 → 审校挑错 → 统一术语 → [主编分流 → 修改 → 审校复核]×最多两轮 → 排版。
// 数据见 domain/editorial-flow-model.ts；本组件只画。
import { Check, Minus, Repeat } from "lucide-react";

import type { EditorialFlow, EditorialFlowNode } from "../../../domain/editorial-flow-model.js";

const STATE_TEXT: Record<string, string> = {
  done: "已完成",
  active: "进行中",
  pending: "等待中",
  skipped: "跳过",
  stopped: "已停下",
};

function NodeMark({ state }: { state: string }) {
  if (state === "done") return <Check aria-hidden="true" />;
  if (state === "skipped") return <Minus aria-hidden="true" />;
  return <span className="editorial-flow-mark-idle" aria-hidden="true" />;
}

function FlowNode({ node }: { node: EditorialFlowNode }) {
  return (
    <li
      className={`editorial-flow-node is-${node.state}`}
      data-flow-node={node.key}
      data-state={node.state}
      {...(node.state === "active" ? { "aria-current": "step" as const } : {})}
    >
      <span className="editorial-flow-dot"><NodeMark state={node.state} /></span>
      <span className="editorial-flow-copy">
        <span className="editorial-flow-title">
          <strong>{node.label}</strong>
          <span className="editorial-flow-role">{node.role}</span>
        </span>
        <span className="editorial-flow-detail">
          {node.detail || STATE_TEXT[node.state]}
        </span>
      </span>
    </li>
  );
}

function headlineOf(flow: EditorialFlow): string {
  const stopped = [...flow.before, ...flow.loop].some((node) => node.state === "stopped");
  if (stopped) return "精修中途停下了";
  if (!flow.finished) return "几位编辑接力审改译文";
  return flow.after[0]?.state === "active" ? "精修完成，正在排版" : "精修完成";
}

export function EditorialFlowPanel({ flow }: { flow: EditorialFlow | null }) {
  if (!flow) return null;
  const loopLabel = flow.round
    ? `第 ${flow.round} / ${flow.maxRounds} 轮`
    : `最多 ${flow.maxRounds} 轮`;
  return (
    <section className="editorial-flow" aria-label="编辑部精修流程" data-editorial-flow="true">
      <header className="editorial-flow-header">
        <strong>编辑部精修</strong>
        <span>{headlineOf(flow)}</span>
      </header>
      <ol className="editorial-flow-track">
        {flow.before.map((node) => <FlowNode key={node.key} node={node} />)}
        <li className="editorial-flow-loop" data-flow-round={flow.round} data-flow-max-rounds={flow.maxRounds}>
          <div className="editorial-flow-loop-label">
            <Repeat aria-hidden="true" />
            <span>{loopLabel}</span>
            <span className="editorial-flow-loop-hint">改不好的块进入下一轮，最后仍未解决的留给你确认</span>
          </div>
          <ol className="editorial-flow-track">
            {flow.loop.map((node) => <FlowNode key={node.key} node={node} />)}
          </ol>
        </li>
        {flow.after.map((node) => <FlowNode key={node.key} node={node} />)}
      </ol>
      {flow.summary ? <p className="editorial-flow-summary">{flow.summary}</p> : null}
    </section>
  );
}
