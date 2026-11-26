/** 提问窗往 assistant-ui 的 Thread 里塞的几块（AskWindow 用）：工具调用一行一个、工具分组的图标、计划、子 agent、
 * 「在想…」、回答底下的用量（图标）、空白时的几个常问。图标多、字少，细节放悬停提示。
 */
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ComponentType, type PropsWithChildren, type ReactElement } from "react";
import { SimpleImageAttachmentAdapter, useAuiState, type DataMessagePartProps, type ToolCallMessagePartProps } from "@assistant-ui/react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Clock,
  Coins,
  Cpu,
  DatabaseZap,
  Eye,
  Gauge,
  Globe,
  HardDriveUpload,
  Languages,
  Loader2,
  Pencil,
  PieChart,
  Search,
  Sigma,
  Sparkles,
  Terminal,
  Timer,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@retainpdf/ui";

import { turnFooterItems, type AskSubagent, type AskToolCall, type AskTurn, type FooterItem } from "../acp/parts.js";
import { AskPageText } from "./AskPageLink.js";
import { BrandIcon, brandFor } from "./BrandIcon.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/shadcn/popover.js";
import type { PermissionStore } from "../acp/adapter.js";
import { ToolFallback } from "../ui/elements/tool-fallback.aui.js";
import { ToolGroupContent, ToolGroupRoot, ToolGroupTrigger } from "../ui/elements/tool-group.aui.js";
import { TodoList, type TodoItem } from "../ui/elements/todo-list.js";
import { AgentStatus, type AgentState } from "../ui/elements/agent-status.js";
import type { ThreadGroupPart } from "../ui/elements/thread.aui.js";

export const PermissionContext = createContext<PermissionStore | null>(null);

const ACP_TO_AUI_KIND: Record<string, string> = {
  allow_once: "allow-once",
  allow_always: "allow-always",
  reject_once: "reject-once",
  reject_always: "reject-always",
};

type IconType = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

/** ACP 工具的 kind → 图标。自带 agent 的「看第 N 页的图」也是 fetch，看标题里有没有「页」。 */
export function toolIcon(kind: string, title: string): IconType {
  switch (kind) {
    case "read": return BookOpen;
    case "search": return Search;
    case "fetch": return /页/.test(title) ? Eye : Globe;
    case "edit": return Pencil;
    case "execute": return Terminal;
    case "think": return Sparkles;
    default: return Wrench;
  }
}

function seconds(timing: AskToolCall["timing"]): string {
  if (!timing || timing.completedAt === undefined) return "";
  const value = (timing.completedAt - timing.startedAt) / 1000;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}s`;
}

/**
 * 工具调用：一行——图标、标题（页码能点）、结果摘要、状态、用时；点开看结果全文和参数。
 * 等许可的还是用 assistant-ui 官方的 ToolFallback（它的许可界面），ACP 的选项换成它认的写法。
 */
export function ToolCard(props: ToolCallMessagePartProps): ReactElement {
  const artifact = (props.artifact || {}) as AskToolCall["artifact"];
  const timing = (props as unknown as { timing?: AskToolCall["timing"] }).timing;
  const store = useContext(PermissionContext);
  useSyncExternalStore(store?.subscribe ?? (() => () => {}), store?.snapshot ?? (() => 0));
  const pending = store?.get(props.toolCallId);
  const title = artifact.title || props.toolName;
  if (pending) {
    const approval = {
      id: props.toolCallId,
      prompt: title,
      options: pending.request.options.map((option) => ({ id: option.optionId, kind: ACP_TO_AUI_KIND[option.kind] || option.kind, label: option.name })),
    };
    const respondToApproval = async (response: { optionId?: string; approved?: boolean }) => {
      const options = pending.request.options;
      const chosen = response.optionId
        ? options.find((option) => option.optionId === response.optionId)
        : options.find((option) => (response.approved ? option.kind.startsWith("allow") : option.kind.startsWith("reject")));
      pending.resolve(chosen ? { outcome: { outcome: "selected", optionId: chosen.optionId } } : { outcome: { outcome: "cancelled" } });
    };
    return (
      <ToolFallback
        {...props}
        toolName={title}
        status={{ type: "requires-action", reason: "interrupt" } as never}
        argsText={props.argsText && props.argsText !== "{}" ? props.argsText : ""}
        approval={approval as never}
        respondToApproval={respondToApproval as never}
      />
    );
  }
  const Icon = toolIcon(artifact.kind || "", title);
  const status = artifact.status || "pending";
  const output = artifact.output || "";
  const summary = output.split("\n").find((line) => line.trim()) || "";
  const where = artifact.locations?.length ? artifact.locations.join("、") : "";
  const args = props.argsText && props.argsText !== "{}" ? props.argsText : "";
  const detail = [output, where, args].filter(Boolean).join("\n\n");
  return (
    <details className="ask-tool" data-status={status}>
      <summary title={title}>
        <Icon size={13} className="ask-tool-icon" aria-hidden />
        <span className="ask-tool-title"><AskPageText text={title} /></span>
        {summary && summary !== title ? <span className="ask-tool-sum"><AskPageText text={summary} /></span> : null}
        <span className="ask-tool-state" aria-label={status === "failed" ? "失败" : status === "completed" ? "完成" : "进行中"}>
          {status === "failed" ? <X size={12} aria-hidden /> : status === "completed" ? <Check size={12} aria-hidden /> : <Loader2 size={12} className="ask-spin" aria-hidden />}
        </span>
        {seconds(timing) ? <span className="ask-tool-time">{seconds(timing)}</span> : null}
      </summary>
      {detail ? <pre className="ask-tool-detail">{detail}</pre> : null}
    </details>
  );
}

/** 工具分组的标题：用到的几种工具的图标、次数；正在跑的写它的标题。 */
export function AskToolGroup({ group, children }: PropsWithChildren<{ group: ThreadGroupPart }>): ReactElement {
  const parts = useAuiState((state) => state.message.parts) as readonly { type: string; artifact?: AskToolCall["artifact"]; toolName?: string }[];
  const [open, setOpen] = useState(false);
  const tools = group.indices.map((index) => parts[index]).filter((part) => part?.type === "tool-call");
  const running = group.status.type === "running";
  const current = running ? tools.find((part) => part.artifact?.status !== "completed" && part.artifact?.status !== "failed") || tools[tools.length - 1] : null;
  const kinds = [...new Map(tools.map((part) => {
    const title = part.artifact?.title || part.toolName || "";
    const Icon = toolIcon(part.artifact?.kind || "", title);
    return [Icon, Icon] as const;
  })).values()].slice(0, 4);
  // 只有一个工具（子 agent、计划夹在中间时 assistant-ui 会把每个工具单独分一组）：直接画那一行，不套一层「用了 1 个工具」。
  if (tools.length <= 1) return <>{children}</>;
  const text = current?.artifact?.title || current?.toolName || "";
  const label = (
    <span className="ask-toolgroup" title={`用了 ${tools.length} 个工具`}>
      {kinds.map((Icon, index) => <Icon key={index} size={13} aria-hidden />)}
      {text ? <span className="ask-toolgroup-text">{text}</span> : null}
      {tools.length > 1 ? <span className="ask-toolgroup-count">×{tools.length}</span> : null}
    </span>
  );
  return (
    <ToolGroupRoot variant="ghost" open={open || group.counts.requiresAction > 0} onOpenChange={setOpen}>
      <ToolGroupTrigger count={tools.length} active={running} label={label} />
      <ToolGroupContent>{children}</ToolGroupContent>
    </ToolGroupRoot>
  );
}

const PLAN_STATUS: Record<string, TodoItem["status"]> = { pending: "pending", in_progress: "active", completed: "done" };

/** 计划（ACP plan，整份替换）：assistant-ui 官方的 TodoList（每项状态图标、进度「1/3」、新项进场动画）。 */
export function PlanBlock({ data }: DataMessagePartProps<{ entries: { content: string; status: string }[] }>): ReactElement {
  const items: TodoItem[] = data.entries.map((entry, index) => ({ id: `${index}`, text: entry.content, status: PLAN_STATUS[entry.status] || "pending" }));
  return <TodoList className="ask-plan" items={items} title="计划" maxVisible={6} />;
}

/** 子 agent（ACP subagent_update）：assistant-ui 官方的 AgentStatus（小胶囊：进行中 / 等着 / 完成 / 失败）。 */
export function SubagentBlock({ data }: DataMessagePartProps<AskSubagent>): ReactElement {
  const state: AgentState = data.state === "idle" || data.state === "done" || data.state === "completed"
    ? "done"
    : data.state === "failed" || data.state === "error"
      ? "failed"
      : data.state === "waiting" || data.state === "paused"
        ? "waiting"
        : "working";
  return (
    <div className="ask-subagent">
      <AgentStatus state={state} trailing={null} label={data.description ? `${data.title} · ${data.description}` : data.title} />
    </div>
  );
}

/** 第一段到之前等多久就补一句「还在等」（本机 agent 起进程、模型排队都可能慢），不说的话像卡住了。 */
export const ASK_SLOW_HINT_MS = 10_000;

/** Thread 的「正在回答」指示（还没有任何内容时它会画）：说一声在想；等久了再说一句。 */
export function Waiting(): ReactElement {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), ASK_SLOW_HINT_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="ask-waiting" role="status">
      <span className="ask-dot" aria-hidden />
      {slow ? "还在等 agent 回应……" : "在想…"}
    </div>
  );
}

/** 自带 agent 只认 png / jpeg / webp / gif，单张最好 4MB 以内（Anthropic 单张约 5MB 上限，一条 WebSocket 消息最大 32MB；后端 11-26 说的）。 */
export const ASK_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";
export const ASK_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export class AskImageAttachmentAdapter extends SimpleImageAttachmentAdapter {
  public override accept = ASK_IMAGE_TYPES;

  public override async add(state: { file: File }) {
    if (!ASK_IMAGE_TYPES.split(",").includes(state.file.type)) throw new Error("只能贴 PNG、JPEG、WebP、GIF 图片");
    if (state.file.size > ASK_IMAGE_MAX_BYTES) throw new Error("图片太大（超过 4MB），先压一下再贴");
    return super.add(state);
  }
}

const FOOTER_ICONS: Record<FooterItem["key"], IconType> = {
  model: Cpu,
  input: ArrowUp,
  output: ArrowDown,
  cacheRead: DatabaseZap,
  cacheWrite: HardDriveUpload,
  context: PieChart,
  cost: Coins,
  speed: Gauge,
  firstToken: Timer,
  elapsed: Clock,
};

/** 回答底下的用量（Thread 的 MessageFooter 插槽，和复制、重新回答在同一排）：只一个图标，点开看模型、token、缓存、速度、用时。Extra 跟在后面（深挖……）。 */
export function makeMessageFooter(agentName: () => string, Extra?: ComponentType) {
  return function MessageFooter(): ReactElement | null {
    const custom = useAuiState((state) => state.message.metadata?.custom) as { turn?: AskTurn; endedAt?: number } | undefined;
    const items = custom?.turn ? turnFooterItems(custom.turn, custom.endedAt ?? null, agentName()) : [];
    const extra = Extra ? <Extra /> : null;
    if (!items.length) return extra;
    const model = items.find((item) => item.key === "model");
    const elapsed = items.find((item) => item.key === "elapsed");
    return (
      <>
      <Popover>
        <PopoverTrigger className="ask-icon ask-usage-trigger" aria-label="这一轮的用量" title={["用量", elapsed?.title].filter(Boolean).join(" · ")}>
          {model ? <BrandIcon brand={brandFor(model.text, model.title)} size={13} title={model.title} /> : <Activity size={13} aria-hidden />}
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="ask-usage-panel">
          {items.map((item) => {
            const Icon = FOOTER_ICONS[item.key];
            return (
              <div key={item.key} className="ask-usage-row" data-key={item.key}>
                {item.key === "model" ? <BrandIcon brand={brandFor(item.text, item.title)} size={13} /> : <Icon size={13} aria-hidden />}
                <span>{item.title}</span>
              </div>
            );
          })}
        </PopoverContent>
      </Popover>
      {extra}
      </>
    );
  };
}

/** 空白时：几个常问，点一下直接问。 */
const STARTERS: { icon: IconType; text: string; prompt: string }[] = [
  { icon: BookOpen, text: "讲讲这段", prompt: "用中文讲讲这一段在说什么。" },
  { icon: Sigma, text: "式子怎么来的", prompt: "这里的式子是怎么推出来的？一步一步写。" },
  { icon: Languages, text: "译文准不准", prompt: "对照原文看看这段译文准不准，哪里要改。" },
];

export function makeWelcome(send: (text: string) => void) {
  return function Welcome(): ReactElement {
    return (
      <div className="ask-starters">
        {STARTERS.map(({ icon: Icon, text, prompt }) => (
          <Button key={text} className="ask-starter" title={prompt} onClick={() => send(prompt)}>
            <Icon size={13} aria-hidden />
            {text}
          </Button>
        ))}
      </div>
    );
  };
}
