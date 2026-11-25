/** 阅读页提问的浮动窗口（单独一块，打开时才加载）。
 *
 * - 窗口：react-rnd，标题栏拖动、边角调大小，不出屏幕；Esc / ✕ 关。
 * - 对话：assistant-ui（LocalRuntime + 我们的 ACP 适配，acp-adapter.ts）；回答用 streamdown 渲染（流式 Markdown + KaTeX 公式）。
 * - 思考折叠、工具调用小卡片（要许可时出「允许 / 拒绝」）、计划、子 agent、底下一行用量 / 缓存命中 / 速度 / 用时。
 * 方案：docs/ops/planning/reader-ask/20261125-阅读页提问.md。
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { Rnd } from "react-rnd";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type DataMessagePartProps,
  type ReasoningMessagePartProps,
  type TextMessagePartProps,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { Streamdown } from "streamdown";
import { createMathPlugin } from "@streamdown/math";
import { ArrowUp, Copy, Square, Trash2, X } from "lucide-react";
import { Button, Select } from "@retainpdf/ui";

import type { ReaderAskAgent, ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import { toInitialMessages, toStoredMessages } from "./thread-messages.js";
import { resolveKatexStylesheetUrl } from "../external.js";
import { copyReaderText } from "../pdf/ReaderTextHoverLayer.js";
import { PermissionStore, createAcpChatAdapter } from "./acp-adapter.js";
import { normalizeMathDelimiters } from "./math-delimiters.js";
import { ReasoningContent, ReasoningRoot, ReasoningText, ReasoningTrigger } from "./ui/reasoning.js";
import { ToolFallback } from "./ui/tool-fallback.js";
import { TodoList, type TodoItem } from "./ui/todo-list.js";
import { AgentStatus, type AgentState } from "./ui/agent-status.js";
import { turnFooter, type AskSubagent, type AskToolCall, type AskTurn } from "./acp-parts.js";

const MATH = createMathPlugin({ singleDollarTextMath: true });
const KATEX_LINK_ID = "retainpdf-katex-css";

function useKatexStylesheet() {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(KATEX_LINK_ID)) return;
    const href = resolveKatexStylesheetUrl();
    if (!href) return;
    const link = document.createElement("link");
    link.id = KATEX_LINK_ID;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, []);
}

const PermissionContext = createContext<PermissionStore | null>(null);

function AnswerText({ text, status }: TextMessagePartProps): ReactElement {
  return (
    <Streamdown
      className="reader-ask-md"
      mode="streaming"
      isAnimating={status?.type === "running"}
      plugins={{ math: MATH }}
      controls={false}
    >
      {normalizeMathDelimiters(text)}
    </Streamdown>
  );
}

/** 思考：assistant-ui 官方的 Reasoning（折叠条，思考中标题有流光、写完写用了几秒，展开收起有动画，内容上下渐隐）。 */
function Thought({ text, status }: ReasoningMessagePartProps): ReactElement {
  const running = status?.type === "running";
  const started = useRef<number | null>(null);
  const [seconds, setSeconds] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (running && started.current === null) started.current = Date.now();
    if (!running && started.current !== null) {
      setSeconds(Math.max(1, Math.round((Date.now() - started.current) / 1000)));
      started.current = null;
    }
  }, [running]);
  return (
    <ReasoningRoot streaming={running} variant="ghost" className="reader-ask-reasoning">
      <ReasoningTrigger active={running} duration={seconds} label={running ? "思考中" : "思考"} />
      <ReasoningContent aria-busy={running}>
        <ReasoningText>
          <div className="reader-ask-thought-body">{text}</div>
        </ReasoningText>
      </ReasoningContent>
    </ReasoningRoot>
  );
}

const ACP_TO_AUI_KIND: Record<string, string> = {
  allow_once: "allow-once",
  allow_always: "allow-always",
  reject_once: "reject-once",
  reject_always: "reject-always",
};

/**
 * 工具调用：assistant-ui 官方的 ToolFallback（状态图标和流光、用时、展开看参数和结果、许可界面）。
 * ACP 的状态、等许可换成它认的写法；用户点了许可，回给 agent（PermissionStore）。
 */
function ToolCard(props: ToolCallMessagePartProps): ReactElement {
  const artifact = (props.artifact || {}) as AskToolCall["artifact"];
  const store = useContext(PermissionContext);
  useSyncExternalStore(store?.subscribe ?? (() => () => {}), store?.snapshot ?? (() => 0));
  const pending = store?.get(props.toolCallId);
  const status = pending
    ? ({ type: "requires-action", reason: "interrupt" } as const)
    : artifact.status === "failed"
      ? ({ type: "incomplete", reason: "error" } as const)
      : artifact.status === "completed"
        ? ({ type: "complete" } as const)
        : ({ type: "running" } as const);
  const approval = pending
    ? {
        id: props.toolCallId,
        prompt: artifact.title || props.toolName,
        options: pending.request.options.map((option) => ({ id: option.optionId, kind: ACP_TO_AUI_KIND[option.kind] || option.kind, label: option.name })),
      }
    : undefined;
  const respondToApproval = pending
    ? async (response: { optionId?: string; approved?: boolean }) => {
        const options = pending.request.options;
        const chosen = response.optionId
          ? options.find((option) => option.optionId === response.optionId)
          : options.find((option) => (response.approved ? option.kind.startsWith("allow") : option.kind.startsWith("reject")));
        pending.resolve(chosen ? { outcome: { outcome: "selected", optionId: chosen.optionId } } : { outcome: { outcome: "cancelled" } });
      }
    : undefined;
  const where = artifact.locations?.length ? `\n（${artifact.locations.join("、")}）` : "";
  return (
    <ToolFallback
      {...props}
      toolName={artifact.title || props.toolName}
      status={status as never}
      isError={artifact.status === "failed"}
      argsText={props.argsText && props.argsText !== "{}" ? props.argsText : ""}
      result={artifact.output ? `${artifact.output}${where}` : props.result}
      approval={approval as never}
      respondToApproval={respondToApproval as never}
    />
  );
}

const PLAN_STATUS: Record<string, TodoItem["status"]> = { pending: "pending", in_progress: "active", completed: "done" };

/** 计划（ACP plan，整份替换）：assistant-ui 官方的 TodoList（每项状态图标、进度「1/3」、新项进场动画）。 */
function PlanBlock({ data }: DataMessagePartProps<{ entries: { content: string; status: string }[] }>): ReactElement {
  const items: TodoItem[] = data.entries.map((entry, index) => ({ id: `${index}`, text: entry.content, status: PLAN_STATUS[entry.status] || "pending" }));
  return <TodoList className="reader-ask-plan" items={items} title="计划" maxVisible={6} />;
}

/** 子 agent（ACP subagent_update）：assistant-ui 官方的 AgentStatus（小胶囊：进行中 / 等着 / 完成 / 失败）。 */
function SubagentBlock({ data }: DataMessagePartProps<AskSubagent>): ReactElement {
  const state: AgentState = data.state === "idle" || data.state === "done" || data.state === "completed"
    ? "done"
    : data.state === "failed" || data.state === "error"
      ? "failed"
      : data.state === "waiting" || data.state === "paused"
        ? "waiting"
        : "working";
  return (
    <div className="reader-ask-subagent">
      <AgentStatus state={state} trailing={null} label={data.description ? `${data.title} · ${data.description}` : data.title} />
    </div>
  );
}

/** 第一段到之前等多久就补一句「还在等」（本机 agent 起进程、模型排队都可能慢），不说的话像卡住了。 */
export const ASK_SLOW_HINT_MS = 10_000;

/** 发出去以后、第一段思考或正文到之前（Claude 要两三秒）：说一声在想，不然像卡住了；等久了再说一句为什么。 */
function Waiting(): ReactElement | null {
  const waiting = useAuiState((state) => state.message.status?.type === "running" && state.message.parts.length === 0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!waiting) return undefined;
    const timer = window.setTimeout(() => setSlow(true), ASK_SLOW_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  if (!waiting) return null;
  return (
    <div className="reader-ask-waiting" role="status">
      <span className="reader-ask-dot" aria-hidden />
      {slow ? "还在等 agent 回应……" : "在想…"}
    </div>
  );
}

function AnswerFooter({ agentName }: { agentName: string }): ReactElement | null {
  const custom = useAuiState((state) => state.message.metadata?.custom) as { turn?: AskTurn; endedAt?: number } | undefined;
  if (!custom?.turn) return null;
  const line = turnFooter(custom.turn, custom.endedAt ?? null, agentName);
  return line ? <div className="reader-ask-footer">{line}</div> : null;
}

function UserMessage(): ReactElement {
  return (
    <MessagePrimitive.Root className="reader-ask-msg is-user">
      <MessagePrimitive.Parts />
    </MessagePrimitive.Root>
  );
}

function makeAssistantMessage(agentName: () => string) {
  return function AssistantMessage(): ReactElement {
    return (
      <MessagePrimitive.Root className="reader-ask-msg is-assistant">
        <Waiting />
        <MessagePrimitive.Parts
          components={{
            Text: AnswerText,
            Reasoning: Thought,
            tools: { Fallback: ToolCard },
            data: { by_name: { plan: PlanBlock, subagent: SubagentBlock } },
          }}
        />
        <AnswerFooter agentName={agentName()} />
      </MessagePrimitive.Root>
    );
  };
}

/** 没装的本机 agent：写安装命令（在终端跑一次），可以复制。后端不再现场下载（下到一半会留坏缓存）。 */
function InstallHints({ agents }: { agents: readonly ReaderAskAgent[] | null }): ReactElement | null {
  const missing = (agents || []).filter((agent) => agent.available === false && agent.install);
  const [copied, setCopied] = useState("");
  if (!missing.length) return null;
  return (
    <details className="reader-ask-install">
      <summary>还能接本机的 {missing.map((agent) => agent.name).join("、")}（要先装）</summary>
      <ul>
        {missing.map((agent) => (
          <li key={agent.id}>
            <span>{agent.name}</span>
            <code>{agent.install}</code>
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

export type ReaderAskWindowProps = {
  port: ReaderAskPort;
  jobId: string;
  bookTitle?: string;
  anchor: ReaderAskAnchor;
  onClose: () => void;
  /** 点出处：跳回问的那一处。 */
  onShowAnchor?: () => void;
  /** 这一处之前的问答（问答记录读回来的，或这次打开里问过的），接着显示。 */
  initialMessages?: readonly ReaderAskMessage[];
  /** 每答完一轮：整段问答交出去存（问答记录）。 */
  onTurnDone?: (messages: ReaderAskMessage[], agentId: string) => void;
  /** 删掉这次提问（书页上的「?」也去掉）。不给就没有删除按钮。 */
  onDelete?: () => void;
};

function anchorLabel(anchor: ReaderAskAnchor): string {
  return [`第 ${anchor.page} 页`, anchor.section].filter(Boolean).join(" · ");
}

export default function ReaderAskWindow({ port, jobId, bookTitle, anchor, onClose, onShowAnchor, initialMessages, onTurnDone, onDelete }: ReaderAskWindowProps): ReactElement {
  useKatexStylesheet();
  const [agents, setAgents] = useState<ReaderAskAgent[] | null>(null);
  const [agentId, setAgentId] = useState("");
  const [loadError, setLoadError] = useState("");
  const live = useRef({ agentId, anchor });
  live.current = { agentId, anchor };

  useEffect(() => {
    let cancelled = false;
    port.listAgents().then(
      (list) => {
        if (cancelled) return;
        setAgents(list);
        setAgentId((current) => current || list.find((agent) => agent.available !== false)?.id || "");
      },
      (error) => !cancelled && setLoadError(error instanceof Error ? error.message : String(error)),
    );
    return () => {
      cancelled = true;
    };
  }, [port]);

  const permissions = useMemo(() => new PermissionStore(), []);
  const chat = useMemo(
    () => createAcpChatAdapter({
      port,
      jobId,
      bookTitle,
      permissions,
      getAgentId: () => live.current.agentId,
      getAnchor: () => live.current.anchor,
    }),
    [port, jobId, bookTitle, permissions],
  );
  useEffect(() => () => chat.close(), [chat]);
  // 之前的问答接着显示（agent 那边是新会话：出处和之前几轮会跟着下一问带过去，见 acp-adapter）。
  const [initial] = useState(() => toInitialMessages(initialMessages || []));
  const runtime = useLocalRuntime(chat.adapter as never, { initialMessages: initial as never });
  // 每答完一轮（running → 停）把整段问答交出去存。
  const turnDoneRef = useRef(onTurnDone);
  turnDoneRef.current = onTurnDone;
  useEffect(() => {
    let wasRunning = false;
    return runtime.thread.subscribe(() => {
      const state = runtime.thread.getState();
      if (wasRunning && !state.isRunning) {
        const stored = toStoredMessages(state.messages as never);
        if (stored.length) turnDoneRef.current?.(stored, live.current.agentId);
      }
      wasRunning = state.isRunning;
    });
  }, [runtime]);
  const agentName = () => agents?.find((agent) => agent.id === live.current.agentId)?.name || "";
  const AssistantMessage = useMemo(() => makeAssistantMessage(agentName), [agents]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const typing = (event.target as HTMLElement | null)?.closest?.("textarea, input, select");
      if (typing && `${(typing as HTMLTextAreaElement).value || ""}`.trim()) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const width = Math.min(460, (globalThis.innerWidth || 1200) - 32);
  const height = Math.min(620, (globalThis.innerHeight || 800) - 120);
  const quote = anchor.selection || anchor.sourceText || anchor.translatedText;

  return (
    <Rnd
      className="reader-ask-window"
      default={{ x: Math.max(16, (globalThis.innerWidth || 1200) - width - 24), y: 72, width, height }}
      minWidth={320}
      minHeight={280}
      bounds="window"
      dragHandleClassName="reader-ask-head"
      cancel=".reader-ask-head button, .reader-ask-head select, .reader-ask-head .ui-select"
    >
      <section className="reader-ask" role="dialog" aria-label="提问">
        <header className="reader-ask-head">
          <span className="reader-ask-title">提问</span>
          <Button className="reader-ask-where" title="回到问的那一处" onClick={onShowAnchor}>
            {anchorLabel(anchor)}
          </Button>
          <Select
            size="sm"
            className="reader-ask-agent"
            aria-label="用哪个 agent"
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            disabled={!agents?.length}
          >
            {(agents || []).map((agent) => (
              <option key={agent.id} value={agent.id} disabled={agent.available === false} title={agent.reason || agent.description || ""}>
                {agent.name}{agent.available === false ? "（用不了）" : ""}
              </option>
            ))}
          </Select>
          {onDelete ? (
            <Button className="reader-ask-close" aria-label="删掉这次提问" title="删掉这次提问（书页上的「?」也去掉）" onClick={onDelete}>
              <Trash2 size={14} aria-hidden />
            </Button>
          ) : null}
          <Button className="reader-ask-close" aria-label="关掉" title="关掉（Esc）" onClick={onClose}>
            <X size={15} aria-hidden />
          </Button>
        </header>
        {quote ? <blockquote className="reader-ask-quote">{quote}</blockquote> : null}
        {loadError ? <p className="reader-ask-error">列不出能用的 agent：{loadError}</p> : null}
        <InstallHints agents={agents} />
        <PermissionContext.Provider value={permissions}>
          <AssistantRuntimeProvider runtime={runtime}>
            <ThreadPrimitive.Root className="reader-ask-thread">
              <ThreadPrimitive.Viewport className="reader-ask-viewport">
                <ThreadPrimitive.Empty>
                  <p className="reader-ask-empty">问这一处的问题：哪里看不懂、这个式子怎么来的、这个词什么意思……</p>
                </ThreadPrimitive.Empty>
                <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
              </ThreadPrimitive.Viewport>
              <ComposerPrimitive.Root className="reader-ask-composer">
                <ComposerPrimitive.Input
                  className="reader-ask-input"
                  placeholder={agentId ? "问点什么（Enter 发送，Shift+Enter 换行）" : "没有能用的 agent"}
                  autoFocus
                  rows={2}
                  disabled={!agentId}
                />
                <ThreadPrimitive.If running={false}>
                  <ComposerPrimitive.Send className="reader-ask-send" aria-label="发送" title="发送（Enter）">
                    <ArrowUp size={15} aria-hidden />
                  </ComposerPrimitive.Send>
                </ThreadPrimitive.If>
                <ThreadPrimitive.If running>
                  <ComposerPrimitive.Cancel className="reader-ask-send" aria-label="停下" title="停下">
                    <Square size={13} aria-hidden />
                  </ComposerPrimitive.Cancel>
                </ThreadPrimitive.If>
              </ComposerPrimitive.Root>
            </ThreadPrimitive.Root>
          </AssistantRuntimeProvider>
        </PermissionContext.Provider>
      </section>
    </Rnd>
  );
}
