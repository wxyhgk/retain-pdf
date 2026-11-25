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
};
export type ReaderAskHandlers = {
    /** agent 发来的 session/update（思考、正文、工具调用、计划、用量……）。 */
    onUpdate: (update: SessionUpdate) => void;
    /** agent 要许可（session/request_permission）：等用户点，返回选了哪个，或取消。 */
    onPermission: (request: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
};
export type ReaderAskSession = {
    /** 发一轮（session/prompt），回答过程走 onUpdate，结束时给停的原因。 */
    prompt: (blocks: ContentBlock[]) => Promise<{
        stopReason: StopReason;
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