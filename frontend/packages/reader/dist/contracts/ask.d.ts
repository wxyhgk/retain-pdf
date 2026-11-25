import type { ContentBlock, RequestPermissionRequest, RequestPermissionResponse, SessionUpdate, StopReason } from "@agentclientprotocol/sdk";
/** 能用的 agent（RetainPDF 自带的、本机装了的 Claude Code / Codex / Gemini …）。 */
export type ReaderAskAgent = {
    id: string;
    name: string;
    description?: string;
    /** 能不能收图片（扫描页没字时发那一块的图）。 */
    acceptsImages?: boolean;
    /** 现在能不能用（本机 agent 在服务器、Docker、局域网上用不了）；不能用时 reason 写原因。 */
    available?: boolean;
    reason?: string;
    /** 本机 agent 没装时的安装命令（在终端跑一次），比如 npm install -g @agentclientprotocol/claude-agent-acp。 */
    install?: string;
};
export type ReaderAskHandlers = {
    /** agent 发来的 session/update（思考、正文、工具调用、计划、用量……）。 */
    onUpdate: (update: SessionUpdate) => void;
    /** agent 要许可（session/request_permission）：等用户点，返回选了哪个，或取消。 */
    onPermission: (request: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
};
export type ReaderAskSession = {
    /** 发一轮（session/prompt），回答过程走 onUpdate，结束时给停的原因。 */
    /** 结束时给停的原因；有的 agent（Claude Code）在结果里带这一轮的 token 用量（usage / _meta），一并给。 */
    prompt: (blocks: ContentBlock[]) => Promise<{
        stopReason: StopReason;
        usage?: Record<string, unknown> | null;
        meta?: Record<string, unknown> | null;
    }>;
    /** 停（session/cancel）。 */
    cancel: () => void;
    /** 不用了（关窗、换 agent）。 */
    close: () => void;
};
export type ReaderAskPort = {
    listAgents: () => Promise<ReaderAskAgent[]>;
    /** 开一个会话（session/new）。jobId 给 agent 拿书的数据（retainpdf mcp）用。 */
    openSession: (options: {
        agentId: string;
        jobId: string;
    }, handlers: ReaderAskHandlers) => Promise<ReaderAskSession>;
    /** 问答记录（按书存，书页白边的「?」从这里读）。不给就只记在这次打开里。 */
    threads?: ReaderAskThreadsPort | null;
};
/** 存下来的一条问答：问题，或者回答（带思考和用量）。 */
export type ReaderAskMessage = {
    role: "user" | "assistant";
    text: string;
    thought?: string | null;
    usage?: Record<string, unknown> | null;
};
/** 一次提问：问的哪儿、哪个 agent、几条问答。 */
export type ReaderAskThread = {
    threadId: string;
    agentId: string;
    title: string;
    anchor: ReaderAskAnchor;
    messageCount: number;
    updatedAt: string;
    /** 只有 get 带。 */
    messages?: ReaderAskMessage[];
};
export type ReaderAskThreadsPort = {
    list: (documentId: string) => Promise<ReaderAskThread[]>;
    get: (documentId: string, threadId: string) => Promise<ReaderAskThread>;
    create: (documentId: string, input: {
        agentId: string;
        anchor: ReaderAskAnchor;
        messages: ReaderAskMessage[];
    }) => Promise<ReaderAskThread>;
    /** 整段问答一起换掉（每答完一轮写一次）。 */
    update: (documentId: string, threadId: string, input: {
        agentId?: string;
        messages: ReaderAskMessage[];
    }) => Promise<ReaderAskThread>;
    remove: (documentId: string, threadId: string) => Promise<void>;
};
/** 问的是哪儿：书页上的一个位置、一块、或选中的一段字。 */
export type ReaderAskAnchor = {
    pane: "source" | "translated";
    page: number;
    /** 鼠标下面那一块（认不出是 null：空白处、没有段落数据）。 */
    itemId: string | null;
    /** 选中的字（「问这段」）；没选是空的。 */
    selection: string;
    /** 这一块的原文、译文（拿得到才有）。 */
    sourceText: string;
    translatedText: string;
    /** 所在章节（书签或标题）。 */
    section: string;
    /** 页内位置（占整页的比例），画「?」用。 */
    point: {
        x: number;
        y: number;
    } | null;
};
//# sourceMappingURL=ask.d.ts.map