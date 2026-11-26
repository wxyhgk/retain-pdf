// 阅读页提问的端口：提问窗本身在 @retainpdf/ask（只说 ACP），这里是阅读页这一侧——宿主给的端口、问的是书上哪儿、问答记录。
// 宿主不给这个端口时，阅读页没有提问入口。方案见 docs/ops/planning/reader-ask/；提问窗说明见 frontend/packages/ask/README.md。

import type { AskAgent, AskHandlers, AskMessage, AskSession } from "@retainpdf/ask";

/** 能用的 agent。和提问窗的 AskAgent 是同一个东西。 */
export type ReaderAskAgent = AskAgent;
export type ReaderAskHandlers = AskHandlers;
export type ReaderAskSession = AskSession;

export type ReaderAskPort = {
  listAgents: () => Promise<ReaderAskAgent[]>;
  /** 开一个会话（session/new）。jobId 给 agent 拿书的数据（retainpdf mcp）用。 */
  /** config：用户选过的设置（模型、思考强度……），见 @retainpdf/ask 的 AskPort。 */
  openSession: (options: { agentId: string; jobId: string; config?: Readonly<Record<string, string | boolean>> }, handlers: ReaderAskHandlers) => Promise<ReaderAskSession>;
  /** 问答记录（按书存，书页白边的「?」从这里读）。不给就只记在这次打开里。 */
  threads?: ReaderAskThreadsPort | null;
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
  create: (documentId: string, input: { agentId: string; anchor: ReaderAskAnchor; messages: ReaderAskMessage[] }) => Promise<ReaderAskThread>;
  /** 整段问答一起换掉（每答完一轮写一次）。 */
  update: (documentId: string, threadId: string, input: { agentId?: string; messages: ReaderAskMessage[] }) => Promise<ReaderAskThread>;
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
  point: { x: number; y: number } | null;
};
