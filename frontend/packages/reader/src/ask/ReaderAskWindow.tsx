/** 阅读页提问的窗口（单独一块，打开时才加载）。
 *
 * - 窗口：react-rnd。三种摆法：浮动（标题栏拖动、边角调大小）、贴右边（占满右侧，左边框拖宽窄）、放大；双击标题栏放大 / 还原。
 *   Esc / ✕ 关。标题栏见 AskHeader.tsx（图标为主），顶上引的那段见 AskQuote.tsx（公式渲染、展开、原文 / 译文）。
 * - 对话：整套照搬 assistant-ui 官方的 Thread（./ui/elements/thread.aui.tsx：复制、重新回答、改问题、版本切换、回到最下面、
 *   Markdown + KaTeX、思考、工具调用分组、许可），runtime 是 LocalRuntime + 我们的 ACP 适配（acp-adapter.ts）。
 * - 我们往里塞的几块在 ask-blocks.tsx：工具调用一行一个、工具分组的图标、计划 / 子 agent、「在想…」、用量（图标）、常问。
 * - 回答和工具调用里的页码能点（page-citations.ts、AskPageLink.tsx），点了阅读页跳过去。
 * 方案：docs/ops/planning/reader-ask/20261125-阅读页提问.md；说明：docs/core/frontend/reader-ask.md。
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Rnd } from "react-rnd";
import { AssistantRuntimeProvider, makeAssistantDataUI, useLocalRuntime } from "@assistant-ui/react";

import type { ReaderAskAgent, ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import { toInitialMessages, toStoredMessages } from "./thread-messages.js";
import { resolveKatexStylesheetUrl } from "../external.js";
import { PermissionStore, createAcpChatAdapter } from "./acp-adapter.js";
import { Thread } from "./ui/elements/thread.aui.js";
import {
  AskImageAttachmentAdapter,
  AskToolGroup,
  PermissionContext,
  PlanBlock,
  SubagentBlock,
  ToolCard,
  Waiting,
  makeMessageFooter,
  makeWelcome,
} from "./ask-blocks.js";
import { AskHeader, type AskWindowMode } from "./AskHeader.js";
import { AskQuote } from "./AskQuote.js";
import { AskPageContext, type AskPageJump } from "./AskPageLink.js";

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

// 计划、子 agent 是 data 部件：按 assistant-ui 的办法注册渲染（挂在 runtime 里面才生效）。
const PlanDataUI = makeAssistantDataUI({ name: "plan", render: PlanBlock });
const SubagentDataUI = makeAssistantDataUI({ name: "subagent", render: SubagentBlock });

// 测试和别处照旧从这里取。
export { ASK_IMAGE_MAX_BYTES, ASK_IMAGE_TYPES, ASK_SLOW_HINT_MS } from "./ask-blocks.js";

/** 贴右边时顶上让出阅读页的顶栏。 */
const DOCK_TOP = 64;
const DOCK_WIDTH = 440;

type Rect = { x: number; y: number; width: number; height: number };

function viewport() {
  return { width: globalThis.innerWidth || 1200, height: globalThis.innerHeight || 800 };
}

function floatRect(): Rect {
  const { width: vw, height: vh } = viewport();
  const width = Math.min(500, vw - 32);
  const height = Math.min(640, vh - 120);
  return { x: Math.max(16, vw - width - 24), y: 72, width, height };
}

/** 三种摆法的位置：浮动用自己记的；贴右边占满右侧（宽可以拖）；放大差不多占满屏。 */
function layoutFor(mode: AskWindowMode, float: Rect, dockWidth: number): Rect {
  const { width: vw, height: vh } = viewport();
  if (mode === "dock") {
    const width = Math.min(dockWidth, vw - 16);
    return { x: vw - width, y: DOCK_TOP, width, height: vh - DOCK_TOP };
  }
  if (mode === "full") return { x: 16, y: 16, width: vw - 32, height: vh - 32 };
  return float;
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
  /** 回答里的页码点了跳到那一页。不给页码就不能点。 */
  onJumpToPage?: (page: number) => void;
  /** 这本书有几页（越界的数字不当页码）；0 是不知道。 */
  pageCount?: number;
};

export default function ReaderAskWindow({ port, jobId, bookTitle, anchor, onClose, onShowAnchor, initialMessages, onTurnDone, onDelete, onJumpToPage, pageCount = 0 }: ReaderAskWindowProps): ReactElement {
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
  // 输入框的「+」：贴图片（截图、扫描页、图表）一起问；发出去是 ACP 的 image 块（acp-adapter 的 imageBlocks）。
  const attachments = useMemo(() => new AskImageAttachmentAdapter(), []);
  const runtime = useLocalRuntime(chat.adapter as never, { initialMessages: initial as never, adapters: { attachments } });
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
  // 常问点一下直接发出去。
  const send = (text: string) => runtime.thread.append({ role: "user", content: [{ type: "text", text }] });
  // Thread 要的几样（引用不变，免得它整个重画）。
  const threadComponents = useMemo(
    () => ({ ToolFallback: ToolCard, ToolGroup: AskToolGroup, Indicator: Waiting, Welcome: makeWelcome(send), MessageFooter: makeMessageFooter(agentName) }),
    [agents, runtime], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const pages = useMemo<AskPageJump | null>(() => (onJumpToPage ? { pageCount, jump: onJumpToPage } : null), [onJumpToPage, pageCount]);

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

  // 摆法：浮动记自己的位置大小；贴右边记宽度；窗口大小变了重新排。
  const [mode, setMode] = useState<AskWindowMode>("float");
  const [float, setFloat] = useState<Rect>(floatRect);
  const [dockWidth, setDockWidth] = useState(DOCK_WIDTH);
  const [, setResized] = useState(0);
  useEffect(() => {
    const onResize = () => setResized((value) => value + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const rect = layoutFor(mode, float, dockWidth);

  return (
    <Rnd
      className="reader-ask-window"
      position={{ x: rect.x, y: rect.y }}
      size={{ width: rect.width, height: rect.height }}
      minWidth={320}
      minHeight={280}
      bounds="window"
      dragHandleClassName="reader-ask-head"
      cancel=".reader-ask-head button, .reader-ask-head select, .reader-ask-head summary, .reader-ask-head .ui-select, .reader-ask-install ul"
      disableDragging={mode !== "float"}
      enableResizing={mode === "full" ? false : mode === "dock" ? { left: true } : true}
      onDragStop={(_event, data) => setFloat((current) => ({ ...current, x: data.x, y: data.y }))}
      onResizeStop={(_event, _direction, element, _delta, position) => {
        if (mode === "dock") setDockWidth(element.offsetWidth);
        else setFloat({ x: position.x, y: position.y, width: element.offsetWidth, height: element.offsetHeight });
      }}
    >
      <section className="reader-ask" role="dialog" aria-label="提问" data-mode={mode}>
        <AskHeader
          anchor={anchor}
          agents={agents}
          agentId={agentId}
          onAgent={setAgentId}
          mode={mode}
          onMode={setMode}
          onShowAnchor={onShowAnchor}
          onDelete={onDelete}
          onClose={onClose}
        />
        <AskPageContext.Provider value={pages}>
          <AskQuote anchor={anchor} />
          {loadError ? <p className="reader-ask-error">列不出能用的 agent：{loadError}</p> : null}
          <PermissionContext.Provider value={permissions}>
            <AssistantRuntimeProvider runtime={runtime}>
              <PlanDataUI />
              <SubagentDataUI />
              <div className="reader-ask-thread">
                <Thread components={threadComponents} autoFocus />
              </div>
            </AssistantRuntimeProvider>
          </PermissionContext.Provider>
        </AskPageContext.Provider>
      </section>
    </Rnd>
  );
}
