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
import { ArrowUp, Brain, ChevronRight, CircleDot, Square, Wrench, X } from "lucide-react";
import { Button, Select } from "@retainpdf/ui";

import type { ReaderAskAgent, ReaderAskAnchor, ReaderAskPort } from "../contracts/ask.js";
import { resolveKatexStylesheetUrl } from "../external.js";
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
        <span className="reader-ask-tool-title">{artifact.title || props.toolName}</span>
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

export type ReaderAskWindowProps = {
  port: ReaderAskPort;
  jobId: string;
  bookTitle?: string;
  anchor: ReaderAskAnchor;
  onClose: () => void;
  /** 点出处：跳回问的那一处。 */
  onShowAnchor?: () => void;
  /** 这一处上次问过的对话（assistant-ui 导出的），再打开时接着显示；关窗时用 onSave 存回去。 */
  saved?: unknown;
  onSave?: (repository: unknown) => void;
};

function anchorLabel(anchor: ReaderAskAnchor): string {
  return [`第 ${anchor.page} 页`, anchor.section].filter(Boolean).join(" · ");
}

export default function ReaderAskWindow({ port, jobId, bookTitle, anchor, onClose, onShowAnchor, saved, onSave }: ReaderAskWindowProps): ReactElement {
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
  const runtime = useLocalRuntime(chat.adapter as never);
  // 再打开同一处：把上次的对话导回来（agent 那边是新会话，出处会再带一次）；关窗时导出存回去。
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useEffect(() => {
    if (saved) {
      try {
        runtime.thread.import(saved as never);
      } catch {
        // 导不回来就当新的一次
      }
    }
    return () => {
      try {
        saveRef.current?.(runtime.thread.export());
      } catch {
        // 存不了就算了，下次重新问
      }
    };
    // 只在打开、关掉时各做一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <Button className="reader-ask-close" aria-label="关掉" title="关掉（Esc）" onClick={onClose}>
            <X size={15} aria-hidden />
          </Button>
        </header>
        {quote ? <blockquote className="reader-ask-quote">{quote}</blockquote> : null}
        {loadError ? <p className="reader-ask-error">列不出能用的 agent：{loadError}</p> : null}
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
