/** 提问窗（@retainpdf/ask/window；宿主懒加载这一块）。
 *
 * - 窗口：react-rnd。三种摆法：浮动（标题栏拖动、边角调大小）、贴右边（占满右侧，左边框拖宽窄）、放大；双击标题栏放大 / 还原。
 *   Esc / ✕ 关。标题栏见 AskHeader.tsx（图标为主）。
 * - 一直延续的对话（2026-11-26 主对话）：输入框上面是下一问带的出处、问题上面是问的哪儿、「深挖」、「已记住（撤销）」，见 conversation.tsx；
 *   每答完一轮交给宿主追加（use-turns.ts）。
 * - 对话：整套照搬 assistant-ui 官方的 Thread（../ui/elements/thread.aui.tsx：复制、重新回答、改问题、版本切换、回到最下面、
 *   Markdown + KaTeX、思考、工具调用分组、许可），runtime 是 LocalRuntime + 我们的 ACP 适配（../acp/adapter.ts）。
 * - 我们往里塞的几块在 blocks.tsx：工具调用一行一个、工具分组的图标、计划 / 子 agent、「在想…」、用量（图标）、常问。
 * - 回答和工具调用里的页码能点（page-citations.ts、AskPageLink.tsx），点了交给宿主跳页。
 * 宿主给什么、能改什么：见包的 README.md。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { AssistantRuntimeProvider, makeAssistantDataUI, useLocalRuntime } from "@assistant-ui/react";

import type { AskAgent, AskConfigOption, AskContext, AskMemoryNotice, AskMessage, AskMessageContext, AskPort, AskTurnRecord } from "../contract.js";
import { toInitialMessages } from "../acp/messages.js";
import { PermissionStore, createAcpChatAdapter } from "../acp/adapter.js";
import { Thread } from "../ui/elements/thread.aui.js";
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
} from "./blocks.js";
import { AskHeader, type AskWindowMode } from "./AskHeader.js";
import { AskPageContext, type AskPageJump } from "./AskPageLink.js";
import { AskSendContext } from "./ask-send.js";
import { AskAgentSettings, AskConfigContext, currentEffort, currentModelBrand, type AskConfigState } from "./AskModelPicker.js";
import { BrandIcon, brandFor } from "./BrandIcon.js";
import { loadDesiredConfig, saveDesiredConfig } from "./config-memory.js";
import { AskConversationContext, ConversationFooter, EarlierHistory, MessageAfter, PendingContextBar, QuestionContextTag, type AskConversationUi } from "./conversation.js";
import { useTurns } from "./use-turns.js";

const KATEX_LINK_ID = "retainpdf-katex-css";

/** KaTeX 的样式表（字体）由宿主给地址（桌面版离线也能用），打开窗口时插一个 <link>。 */
function useKatexStylesheet(href: string | undefined) {
  useEffect(() => {
    if (typeof document === "undefined" || !href || document.getElementById(KATEX_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = KATEX_LINK_ID;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [href]);
}

// 计划、子 agent 是 data 部件：按 assistant-ui 的办法注册渲染（挂在 runtime 里面才生效）。
const PlanDataUI = makeAssistantDataUI({ name: "plan", render: PlanBlock });
const SubagentDataUI = makeAssistantDataUI({ name: "subagent", render: SubagentBlock });

// 测试和别处照旧从这里取。
export { ASK_IMAGE_MAX_BYTES, ASK_IMAGE_TYPES, ASK_SLOW_HINT_MS } from "./blocks.js";

/** 贴右边时顶上让出宿主页面的顶栏（RetainPDF 阅读页的顶栏约 64px）。 */
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

export type AskWindowProps = {
  port: AskPort;
  /**
   * 下一问带的出处（输入框上面的小标签、发给 agent 的那段字和 _meta）；没有是 null。
   * 发问那一刻读；发出去以后交 onContextUsed，宿主清掉（不然下一问还带）。
   */
  context: AskContext | null;
  onContextUsed?: (context: AskContext) => void;
  /** 小标签上的 ×：这一问不带出处。不给就没有 ×。 */
  onContextClear?: () => void;
  onClose: () => void;
  /** 标题栏左边（主对话 / 副对话的面包屑）。 */
  title?: ReactNode;
  /** 标题栏右边多放的按钮（记忆、归档……）。 */
  headerActions?: ReactNode;
  /** 对话下面、输入框外面多放的一条（副对话的「结束」）。 */
  footer?: ReactNode;
  /** 点问题上面的小标签：回到问的那一处。 */
  onShowContext?: (context: AskMessageContext) => void;
  /** 之前的问答（宿主存的），接着显示。 */
  initialMessages?: readonly AskMessage[];
  /** 「看更早的」：宿主再取一页、换掉 initialMessages 重开窗口。没有更早的给 null。 */
  earlier?: { loading: boolean; load: () => void } | null;
  /** 每答完一轮：这一轮交出去追加（问题、回答、出处、记下的记忆）。 */
  onTurn?: (turn: AskTurnRecord) => void;
  /** 每答完一轮：整段问答交出去存（按书存问答记录的老用法）。sessionId 是答这一轮的 ACP 会话。 */
  onTurnDone?: (messages: AskMessage[], agentId: string, sessionId?: string) => void;
  /** 「深挖」：从这条回答开副对话。不给就没有这个按钮。 */
  onFork?: (message: { id?: string; text: string }) => void;
  /** 结论卡片上的「看副对话」。 */
  onOpenSide?: (sideId: string) => void;
  /** 「已记住」的撤销。不给就不能撤销。 */
  onForgetMemory?: (memoryId: string) => Promise<void>;
  /** 宿主事后查到的「已记住」（按 onTurn 交出的 answerId）：agent 不在工具卡片 _meta 里报记忆时用。 */
  memories?: ReadonlyMap<string, readonly AskMemoryNotice[]>;
  /** 只能看（以前按书存的问答）：没有输入框。 */
  readOnly?: boolean;
  /** 删掉这次提问。不给就没有删除按钮。 */
  onDelete?: () => void;
  /** 回答里的页码点了跳到那一页。不给页码就不能点。 */
  onJumpToPage?: (page: number) => void;
  /** 一共几页（越界的数字不当页码）；0 是不知道。 */
  pageCount?: number;
  /** KaTeX 样式表的地址（宿主自己托管字体）；不给就不插，公式靠宿主页面已有的样式。 */
  katexStylesheetUrl?: string;
};

export default function AskWindow(props: AskWindowProps): ReactElement {
  const { port, context, onContextUsed, onContextClear, onClose, title, headerActions, footer, onShowContext, initialMessages, earlier, onTurn, onTurnDone, onFork, onOpenSide, onForgetMemory, memories, readOnly, onDelete, onJumpToPage, pageCount = 0, katexStylesheetUrl } = props;
  useKatexStylesheet(katexStylesheetUrl);
  const [agents, setAgents] = useState<AskAgent[] | null>(null);
  const [agentId, setAgentId] = useState("");
  const [loadError, setLoadError] = useState("");
  const live = useRef({ agentId, context, onContextUsed });
  live.current = { agentId, context, onContextUsed };
  // 发出去的问题问的是哪儿（按消息编号；画问题上面的小标签）。
  const [asked, setAsked] = useState<ReadonlyMap<string, AskMessageContext>>(() => new Map());

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
  // agent 的设置项（模型、思考强度……，ACP 的 configOptions）；用户选过的值按 agent 记在本机浏览器里，新会话再设一次。
  const [config, setConfig] = useState<AskConfigOption[]>([]);
  const chat = useMemo(
    () => createAcpChatAdapter({
      port,
      permissions,
      getAgentId: () => live.current.agentId,
      getContext: () => live.current.context,
      onAsked: (messageId, used) => {
        if (!used) return;
        setAsked((current) => new Map(current).set(messageId, { page: used.page, label: used.label, data: used.meta }));
        live.current.onContextUsed?.(used);
      },
      onConfig: setConfig,
      getDesiredConfig: () => loadDesiredConfig(live.current.agentId),
    }),
    [port, permissions],
  );
  useEffect(() => () => chat.close(), [chat]);
  // 选了 agent 就提前开会话：不用先问一句，就能看到它有哪些模型、思考强度。
  useEffect(() => {
    setConfig([]);
    if (agentId) void chat.prepare();
  }, [chat, agentId]);
  const configState = useMemo<AskConfigState>(() => ({
    options: config,
    set: (configId, value) => {
      saveDesiredConfig(live.current.agentId, configId, value);
      setConfig((current) => current.map((option) => (option.id === configId ? { ...option, currentValue: value } : option)));
      void chat.setConfig(configId, value).catch(() => {});
    },
  }), [config, chat]);
  // 之前的问答接着显示（agent 那边是新会话：出处和之前几轮会跟着下一问带过去，见 acp-adapter）。
  const [initial] = useState(() => toInitialMessages(initialMessages || []));
  // 输入框的「+」：贴图片（截图、扫描页、图表）一起问；发出去是 ACP 的 image 块（acp-adapter 的 imageBlocks）。
  const attachments = useMemo(() => new AskImageAttachmentAdapter(), []);
  const runtime = useLocalRuntime(chat.adapter as never, { initialMessages: initial as never, adapters: { attachments } });
  // 每答完一轮交给宿主（use-turns.ts）。
  const currentAgent = useCallback(() => live.current.agentId, []);
  useTurns({ thread: runtime.thread as never, agentId: currentAgent, run: chat.lastRun, sessionId: chat.sessionId, onTurn, onTurnDone });
  const conversationUi = useMemo<AskConversationUi>(() => ({
    pending: context,
    clearPending: onContextClear,
    contexts: asked,
    showContext: onShowContext,
    earlier,
    fork: onFork,
    openSide: onOpenSide,
    forget: onForgetMemory,
    memories,
  }), [context, onContextClear, asked, onShowContext, earlier, onFork, onOpenSide, onForgetMemory, memories]);
  const agentName = () => agents?.find((agent) => agent.id === live.current.agentId)?.name || "";
  // 替用户发一句：常问、互动块里的 @ToAssistant、「让它修」。
  const send = useMemo(() => (text: string) => runtime.thread.append({ role: "user", content: [{ type: "text", text }] }), [runtime]);
  // Thread 要的几样（引用不变，免得它整个重画）。
  const threadComponents = useMemo(
    () => ({
      ToolFallback: ToolCard,
      ToolGroup: AskToolGroup,
      Indicator: Waiting,
      ComposerExtra: AskAgentSettings,
      Welcome: makeWelcome(send),
      MessageFooter: makeMessageFooter(agentName, ConversationFooter),
      HistoryTop: EarlierHistory,
      ComposerTop: PendingContextBar,
      UserMessageTop: QuestionContextTag,
      MessageAfter,
    }),
    [agents, runtime], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const pages = useMemo<AskPageJump | null>(() => (onJumpToPage ? { pageCount, jump: onJumpToPage } : null), [onJumpToPage, pageCount]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // 开着弹层（选 agent、选模型、用量、更多设置）时 Esc 只关弹层，不关窗。
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
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
  // 思考强度染输入框和周围（ask.css 读 --ask-effort-color、data-effort）；当前模型厂商的标志做聊天背景的水印。
  const effort = currentEffort(config);
  const shownAgent = agents?.find((agent) => agent.id === agentId);
  const brand = currentModelBrand(config) || (shownAgent ? brandFor(shownAgent.id, shownAgent.name) : "");
  const tint = (effort ? { "--ask-effort-color": effort.color } : {}) as CSSProperties;

  return (
    <Rnd
      className="ask-window"
      position={{ x: rect.x, y: rect.y }}
      size={{ width: rect.width, height: rect.height }}
      minWidth={320}
      minHeight={280}
      bounds="window"
      dragHandleClassName="ask-head"
      cancel=".ask-head button, .ask-head select, .ask-head summary, .ask-head .ui-select, .ask-install ul"
      disableDragging={mode !== "float"}
      enableResizing={mode === "full" ? false : mode === "dock" ? { left: true } : true}
      onDragStop={(_event, data) => setFloat((current) => ({ ...current, x: data.x, y: data.y }))}
      onResizeStop={(_event, _direction, element, _delta, position) => {
        if (mode === "dock") setDockWidth(element.offsetWidth);
        else setFloat({ x: position.x, y: position.y, width: element.offsetWidth, height: element.offsetHeight });
      }}
    >
      <section className="ask-panel" role="dialog" aria-label="提问" data-mode={mode} data-readonly={readOnly ? "1" : undefined} data-effort={effort?.on ? "on" : "off"} style={tint}>
        <AskHeader
          title={title}
          actions={headerActions}
          agents={agents}
          agentId={agentId}
          onAgent={setAgentId}
          mode={mode}
          onMode={setMode}
          onDelete={onDelete}
          onClose={onClose}
        />
        <AskPageContext.Provider value={pages}>
          {loadError ? <p className="ask-error">列不出能用的 agent：{loadError}</p> : null}
          <AskConversationContext.Provider value={conversationUi}>
          <PermissionContext.Provider value={permissions}>
            <AskSendContext.Provider value={send}>
            <AskConfigContext.Provider value={configState}>
            <AssistantRuntimeProvider runtime={runtime}>
              <PlanDataUI />
              <SubagentDataUI />
              <div className="ask-thread">
                {brand ? (
                  <div className="ask-watermark" aria-hidden>
                    <BrandIcon brand={brand} size={200} />
                  </div>
                ) : null}
                <Thread components={threadComponents} autoFocus />
              </div>
            </AssistantRuntimeProvider>
            </AskConfigContext.Provider>
            </AskSendContext.Provider>
          </PermissionContext.Provider>
          </AskConversationContext.Provider>
          {footer}
        </AskPageContext.Provider>
      </section>
    </Rnd>
  );
}
