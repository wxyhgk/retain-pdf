/** 提问窗（@retainpdf/ask/window；宿主懒加载这一块）。
 *
 * - 窗口：react-rnd。三种摆法：浮动（标题栏拖动、边角调大小）、贴右边（占满右侧，左边框拖宽窄）、放大；双击标题栏放大 / 还原。
 *   Esc / ✕ 关。标题栏见 AskHeader.tsx（图标为主）。
 * - 一直延续的对话（2026-11-26 主对话）：输入框上面是下一问带的出处、问题上面是问的哪儿、「深挖」、「已记住（撤销）」，见 conversation.tsx；
 *   每答完一轮交给宿主追加（use-turns.ts）。回答里选字，下一问引用那段（answer-quote.tsx）。
 * - 对话：整套照搬 assistant-ui 官方的 Thread（../ui/elements/thread.aui.tsx：复制、重新回答、改问题、版本切换、回到最下面、
 *   Markdown + KaTeX、思考、工具调用分组、许可），runtime 是 LocalRuntime + 我们的 ACP 适配（../acp/adapter.ts）。
 * - 我们往里塞的几块在 blocks.tsx：工具调用一行一个、工具分组的图标、计划 / 子 agent、「在想…」、用量（图标）、常问。
 * - 回答和工具调用里的页码能点（page-citations.ts、AskPageLink.tsx），点了交给宿主跳页。
 * 宿主给什么、能改什么：见包的 README.md。
 */
import { type ReactElement, type ReactNode } from "react";
import type { AskAnswerAction, AskAttachTool, AskContext, AskContextOffer, AskMemoryNotice, AskMessage, AskMessageContext, AskPort, AskTurnRecord } from "../contract.js";
import type { AskWindowMode } from "./AskHeader.js";
export { ASK_IMAGE_MAX_BYTES, ASK_IMAGE_TYPES, ASK_SLOW_HINT_MS } from "./blocks.js";
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
    earlier?: {
        loading: boolean;
        load: () => void;
    } | null;
    /** 每答完一轮：这一轮交出去追加（问题、回答、出处、记下的记忆）。 */
    onTurn?: (turn: AskTurnRecord) => void;
    /** 每答完一轮：整段问答交出去存（按书存问答记录的老用法）。sessionId 是答这一轮的 ACP 会话。 */
    onTurnDone?: (messages: AskMessage[], agentId: string, sessionId?: string) => void;
    /** 「深挖」：从这条回答开副对话。不给就没有这个按钮。 */
    onFork?: (message: {
        id?: string;
        text: string;
    }) => void;
    /** 结论卡片上的「看副对话」。 */
    onOpenSide?: (sideId: string) => void;
    /** 「已记住」的撤销。不给就不能撤销。 */
    onForgetMemory?: (memoryId: string) => Promise<void>;
    /** 改了一条已经发过的问 / 重新回答（窗口里的编号）：宿主先作废它和之后的，返回那一问原来的出处。不给就照旧只在窗口里分叉。 */
    onRewrite?: (questionId: string) => Promise<AskContext | null | void>;
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
    /** 已经带着出处时宿主那边又选了一处（书页上新选的字）：输入框上面问换成它还是再加上它。 */
    contextOffer?: AskContextOffer | null;
    /** 输入框那一行宿主加的「带上……」按钮（阅读页：带上这一页的截图）。 */
    attachTools?: readonly AskAttachTool[];
    /** 宿主从外面塞进来的附件（框选截图）：id 变了就加进输入框。 */
    attachRequest?: {
        id: number;
        files: readonly File[];
    } | null;
    /** 回答底下宿主加的动作（阅读页：「改这段译文」），只出在问题带着出处、宿主认这处的回答下面。 */
    answerAction?: AskAnswerAction;
    /** 窗口摆法变了（贴右边时宽多少）：宿主据此给书页让出右边（不盖字）。 */
    onLayout?: (layout: {
        mode: AskWindowMode;
        width: number;
    }) => void;
    /** 宿主右边停了别的东西（阅读页的 Markdown 面板）：变成 true 的那一下，贴右边的窗口变回浮动。 */
    dockTaken?: boolean;
};
export default function AskWindow(props: AskWindowProps): ReactElement;
