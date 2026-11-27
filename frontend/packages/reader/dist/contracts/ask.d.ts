import type { AskAgent, AskHandlers, AskMessage, AskSession } from "@retainpdf/ask";
import type { AppendAskMessagesView, AskConversationMessageInput, AskConversationMessageRecord, AskConversationRecord, AskMemoryCreatedView, AskMemoryRecord, AskMessagePageView, AskSettingsRecord, CloseAskConversationView, CreateAskMemoryInput, CreateAskSideConversationInput, ListAskMemoriesQuery, PatchAskMemoryInput, SupersedeAskMessagesView } from "@retainpdf/api/ai";
/** 能用的 agent。和提问窗的 AskAgent 是同一个东西。 */
export type ReaderAskAgent = AskAgent;
export type ReaderAskHandlers = AskHandlers;
export type ReaderAskSession = AskSession;
export type ReaderAskPort = {
    listAgents: () => Promise<ReaderAskAgent[]>;
    /** 开一个会话（session/new）。jobId 给 agent 拿书的数据（retainpdf mcp）用。 */
    /** config：用户选过的设置（模型、思考强度……），见 @retainpdf/ask 的 AskPort。 */
    /** conversationId：主对话或副对话的编号，自带 agent 握手带上（自己取前文、记忆出处记它）。 */
    openSession: (options: {
        agentId: string;
        jobId: string;
        conversationId?: string;
        config?: Readonly<Record<string, string | boolean>>;
    }, handlers: ReaderAskHandlers) => Promise<ReaderAskSession>;
    /** 以前按书存的问答记录（2026-11-26 起只读：书页上照旧画、能点开看，不再往里写）。 */
    threads?: ReaderAskThreadsPort | null;
    /** 全局主对话、副对话、记忆（2026-11-26，docs/api/16-AI/02-主对话和记忆.md）。不给就只记在这次打开里。 */
    conversations?: ReaderAskConversationsPort | null;
    /** 记忆面板、「让 AI 使用记忆」开关。不给就没有记忆面板。 */
    memories?: ReaderAskMemoriesPort | null;
    /** 用户的术语表：记忆面板里「这本书」的术语能加进去（2026-11-27）。不给就没有这个按钮。 */
    glossaries?: ReaderAskGlossaryPort | null;
};
/** 用户自己的术语表（契约 glossaries.v1）：翻译时选了这张表才用上。 */
export type ReaderAskGlossaryPort = {
    list: () => Promise<{
        id: string;
        name: string;
        entryCount: number;
    }[]>;
    /** 加一条；同一个原文（不分大小写）已经有了就换成这次的译法。into 给 id 是加进那张表，给 name 是新建一张。 */
    addEntry: (into: {
        id: string;
    } | {
        name: string;
    }, entry: {
        source: string;
        target: string;
        note?: string;
    }) => Promise<{
        id: string;
        name: string;
        replaced: boolean;
    }>;
};
/** 记忆（用户层、书层）和「让 AI 使用记忆」总开关（存在后端库里，不在浏览器设置里）。类型就是契约 ask-conversations.v1 的。 */
export type ReaderAskMemoriesPort = {
    list: (query: ListAskMemoriesQuery) => Promise<AskMemoryRecord[]>;
    /** 用户自己加（origin 不给就是 user）。 */
    create: (input: CreateAskMemoryInput) => Promise<AskMemoryCreatedView>;
    update: (memoryId: string, input: PatchAskMemoryInput) => Promise<AskMemoryRecord>;
    /** 删（被它替代的旧条恢复）。 */
    remove: (memoryId: string) => Promise<AskMemoryRecord>;
    settings: () => Promise<AskSettingsRecord>;
    setEnabled: (enabled: boolean) => Promise<AskSettingsRecord>;
};
/** 主对话、副对话（后端库是正本）。类型就是契约 ask-conversations.v1 的。 */
export type ReaderAskConversationsPort = {
    /** 取或建这本书的主对话（2026-11-27 起每本书一个）；没有书是全局那条。 */
    main: (documentId?: string) => Promise<AskConversationRecord>;
    get: (conversationId: string) => Promise<AskConversationRecord>;
    /** 消息分页（seq < beforeSeq 的最后 limit 条）。 */
    messages: (conversationId: string, page?: {
        beforeSeq?: number;
        limit?: number;
    }) => Promise<AskMessagePageView>;
    /** 改一条已发出的问（重新回答也是）：这条问和它之后的作废，之后追加改后的问带 edited_from。 */
    supersede: (conversationId: string, messageId: string) => Promise<SupersedeAskMessagesView>;
    /** 追加一轮（问和答一起）。返回 compaction_due 时宿主自己去压（compact）。 */
    append: (conversationId: string, messages: AskConversationMessageInput[]) => Promise<AppendAskMessagesView>;
    /** 新会话第一问前面带的前文（上下文接口拼好的 text：记忆 + 摘要 + 最近几轮）；给不认结构的本机 agent。 */
    contextText: (conversationId: string, documentId: string) => Promise<string>;
    /** 开副对话（「深挖」）。 */
    fork: (input: CreateAskSideConversationInput) => Promise<AskConversationRecord>;
    /** 结束副对话：不给 summary 时让后端用设置里的模型写结论（没配模型就只结束）。 */
    close: (conversationId: string, summary?: string) => Promise<CloseAskConversationView>;
    /** 再开结束了的副对话。 */
    reopen: (conversationId: string) => Promise<AskConversationRecord>;
    /** 归档主对话（之后再取主对话会建新的）。 */
    archive: (conversationId: string) => Promise<AskConversationRecord>;
    /** 主对话太长了：让后端用设置里的模型压缩（没配模型不压）。失败不用管，下次再试。 */
    compact: (conversationId: string) => Promise<void>;
    /** 这本书上问过的地方（书页上的「?」）。 */
    bookMessages: (documentId: string) => Promise<AskConversationMessageRecord[]>;
    /** 撤销「已记住」。 */
    forgetMemory: (memoryId: string) => Promise<void>;
};
/** 存下来的一条问答（问题，或者回答带思考和用量）。和提问窗的 AskMessage 是同一个东西。 */
export type ReaderAskMessage = AskMessage;
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
        sessionId?: string;
        anchor: ReaderAskAnchor;
        messages: ReaderAskMessage[];
    }) => Promise<ReaderAskThread>;
    /** 整段问答一起换掉（每答完一轮写一次）。 */
    update: (documentId: string, threadId: string, input: {
        agentId?: string;
        sessionId?: string;
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