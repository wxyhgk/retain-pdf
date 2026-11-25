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
import { ArrowUp, Brain, ChevronRight, CircleDot, Copy, Square, Trash2, Wrench, X } from "lucide-react";
import { Button, Select } from "@retainpdf/ui";

import type { ReaderAskAgent, ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import { toInitialMessages, toStoredMessages } from "./thread-messages.js";
import { resolveKatexStylesheetUrl } from "../external.js";
import { copyReaderText } from "../pdf/ReaderTextHoverLayer.js";
import { PermissionStore, createAcpChatAdapter } from "./acp-adapter.js";
import { normalizeMathDelimiters } from "./math-delimiters.js";
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

function Thought({ text, status }: ReasoningMessagePartProps): ReactElement {
  const running = status?.type === "running";
  return (
    <details className="reader-ask-thought" open={running || undefined}>
      <summary>
        <Brain size={13} aria-hidden /> {running ? "思考中…" : "思考过程"}
        <ChevronRight size={13} className="reader-ask-chevron" aria-hidden />
      </summary>
      <div className="reader-ask-thought-body">{text}</div>
    </details>
  );
}

const TOOL_STATUS: Record<string, string> = { pending: "等着", in_progress: "进行中", completed: "完成", failed: "失败" };

function ToolCard(props: ToolCallMessagePartProps): ReactElement {
  const artifact = (props.artifact || {}) as AskToolCall["artifact"];
  const store = useContext(PermissionContext);
  useSyncExternalStore(store?.subscribe ?? (() => () => {}), store?.snapshot ?? (() => 0));
  const pending = store?.get(props.toolCallId);
  return (
    <div className="reader-ask-tool" data-status={artifact.status || "pending"}>
      <div className="reader-ask-tool-head">
        <Wrench size={13} aria-hidden />
        <span className="reader-ask-tool-title" title={artifact.title || props.toolName}>{artifact.title || props.toolName}</span>
        <span className="reader-ask-tool-status">{TOOL_STATUS[artifact.status] || artifact.status}</span>
      </div>
      {artifact.locations?.length ? <div className="reader-ask-tool-where">{artifact.locations.join("、")}</div> : null}
      {artifact.output ? <pre className="reader-ask-tool-output">{artifact.output}</pre> : null}
      {pending ? (
        <div className="reader-ask-permission" role="group" aria-label="要你同意">
          <span>要你同意才继续：</span>
          {pending.request.options.map((option) => (
            <Button
              key={option.optionId}
              className="reader-ask-permission-option"
              data-kind={option.kind}
              onClick={() => pending.resolve({ outcome: { outcome: "selected", optionId: option.optionId } })}
            >
              {option.name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const PLAN_MARK: Record<string, string> = { pending: "○", in_progress: "◐", completed: "●" };

function PlanBlock({ data }: DataMessagePartProps<{ entries: { content: string; status: string }[] }>): ReactElement {
  return (
    <ol className="reader-ask-plan" aria-label="计划">
      {data.entries.map((entry, index) => (
        <li key={index} data-status={entry.status}>
          <span aria-hidden>{PLAN_MARK[entry.status] || "○"}</span> {entry.content}
        </li>
      ))}
    </ol>
  );
}

function SubagentBlock({ data }: DataMessagePartProps<AskSubagent>): ReactElement {
  return (
    <div className="reader-ask-subagent" data-state={data.state}>
      <CircleDot size={13} aria-hidden /> <strong>{data.title}</strong>
      {data.description ? <span> · {data.description}</span> : null}
      <span className="reader-ask-tool-status">{data.state === "running" ? "进行中" : data.state === "idle" ? "完成" : data.state}</span>
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
