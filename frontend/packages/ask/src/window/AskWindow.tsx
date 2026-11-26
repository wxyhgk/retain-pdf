/** 提问窗（@retainpdf/ask/window；宿主懒加载这一块）。
 *
 * - 窗口：react-rnd。三种摆法：浮动（标题栏拖动、边角调大小）、贴右边（占满右侧，左边框拖宽窄）、放大；双击标题栏放大 / 还原。
 *   Esc / ✕ 关。标题栏见 AskHeader.tsx（图标为主），顶上引的那段见 AskQuote.tsx（公式渲染、展开、原文 / 译文）。
 * - 对话：整套照搬 assistant-ui 官方的 Thread（../ui/elements/thread.aui.tsx：复制、重新回答、改问题、版本切换、回到最下面、
 *   Markdown + KaTeX、思考、工具调用分组、许可），runtime 是 LocalRuntime + 我们的 ACP 适配（../acp/adapter.ts）。
 * - 我们往里塞的几块在 blocks.tsx：工具调用一行一个、工具分组的图标、计划 / 子 agent、「在想…」、用量（图标）、常问。
 * - 回答和工具调用里的页码能点（page-citations.ts、AskPageLink.tsx），点了交给宿主跳页。
 * 宿主给什么、能改什么：见包的 README.md。
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Rnd } from "react-rnd";
import { AssistantRuntimeProvider, makeAssistantDataUI, useLocalRuntime } from "@assistant-ui/react";

import type { AskAgent, AskConfigOption, AskContext, AskMessage, AskPort } from "../contract.js";
import { toInitialMessages, toStoredMessages } from "../acp/messages.js";
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
import { AskQuote } from "./AskQuote.js";
import { AskPageContext, type AskPageJump } from "./AskPageLink.js";
import { AskSendContext } from "./ask-send.js";
import { AskAgentSettings, AskConfigContext, type AskConfigState } from "./AskModelPicker.js";
import { loadDesiredConfig, saveDesiredConfig } from "./config-memory.js";

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
  /** 问的是哪儿（标题栏页码、顶上引的那段、发给 agent 的出处）。 */
  context: AskContext;
  onClose: () => void;
  /** 点标题栏的页码：回到问的那一处。 */
  onShowContext?: () => void;
  /** 这一处之前的问答（宿主存的），接着显示。 */
  initialMessages?: readonly AskMessage[];
  /** 每答完一轮：整段问答交出去存。 */
  onTurnDone?: (messages: AskMessage[], agentId: string) => void;
  /** 删掉这次提问。不给就没有删除按钮。 */
  onDelete?: () => void;
  /** 回答里的页码点了跳到那一页。不给页码就不能点。 */
  onJumpToPage?: (page: number) => void;
  /** 一共几页（越界的数字不当页码）；0 是不知道。 */
  pageCount?: number;
  /** KaTeX 样式表的地址（宿主自己托管字体）；不给就不插，公式靠宿主页面已有的样式。 */
  katexStylesheetUrl?: string;
};

export default function AskWindow({ port, context, onClose, onShowContext, initialMessages, onTurnDone, onDelete, onJumpToPage, pageCount = 0, katexStylesheetUrl }: AskWindowProps): ReactElement {
  useKatexStylesheet(katexStylesheetUrl);
  const [agents, setAgents] = useState<AskAgent[] | null>(null);
  const [agentId, setAgentId] = useState("");
  const [loadError, setLoadError] = useState("");
  const live = useRef({ agentId, context });
  live.current = { agentId, context };

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
      getPreamble: () => live.current.context.preamble || "",
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
  // 替用户发一句：常问、互动块里的 @ToAssistant、「让它修」。
  const send = useMemo(() => (text: string) => runtime.thread.append({ role: "user", content: [{ type: "text", text }] }), [runtime]);
  // Thread 要的几样（引用不变，免得它整个重画）。
  const threadComponents = useMemo(
    () => ({ ToolFallback: ToolCard, ToolGroup: AskToolGroup, Indicator: Waiting, ComposerExtra: AskAgentSettings, Welcome: makeWelcome(send), MessageFooter: makeMessageFooter(agentName) }),
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
      <section className="ask-panel" role="dialog" aria-label="提问" data-mode={mode}>
        <AskHeader
          context={context}
          agents={agents}
          agentId={agentId}
          onAgent={setAgentId}
          mode={mode}
          onMode={setMode}
          onShowContext={onShowContext}
          onDelete={onDelete}
          onClose={onClose}
        />
        <AskPageContext.Provider value={pages}>
          <AskQuote quote={context.quote} />
          {loadError ? <p className="ask-error">列不出能用的 agent：{loadError}</p> : null}
          <PermissionContext.Provider value={permissions}>
            <AskSendContext.Provider value={send}>
            <AskConfigContext.Provider value={configState}>
            <AssistantRuntimeProvider runtime={runtime}>
              <PlanDataUI />
              <SubagentDataUI />
              <div className="ask-thread">
                <Thread components={threadComponents} autoFocus />
              </div>
            </AssistantRuntimeProvider>
            </AskConfigContext.Provider>
            </AskSendContext.Provider>
          </PermissionContext.Provider>
        </AskPageContext.Provider>
      </section>
    </Rnd>
  );
}
