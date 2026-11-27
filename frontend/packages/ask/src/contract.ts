// @retainpdf/ask 的接口：宿主给什么、窗口回什么。只有类型，引它不会带进任何运行时代码。
// 提问窗只说 ACP（Agent Client Protocol）；不认识「书」「阅读页」——问的是哪儿由宿主写成 AskContext 交进来。

import type {
  ContentBlock,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionUpdate,
  StopReason,
} from "@agentclientprotocol/sdk";

/** 能用的 agent（RetainPDF 自带的、本机装了的 Claude Code / Codex / pi …）。 */
export type AskAgent = {
  id: string;
  name: string;
  description?: string;
  /** 能不能收图片（输入框能贴图）。 */
  acceptsImages?: boolean;
  /** 现在能不能用；不能用时 reason 写原因（下拉里灰掉）。 */
  available?: boolean;
  reason?: string;
  /** 没装时的安装命令（标题栏插头图标里列出来，能复制）。 */
  install?: string;
};

export type AskHandlers = {
  /** agent 发来的 session/update（思考、正文、工具调用、计划、子 agent、用量……）。 */
  onUpdate: (update: SessionUpdate) => void;
  /** agent 要许可（session/request_permission）：等用户点，返回选了哪个，或取消。 */
  onPermission: (request: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
};

export type AskPromptResult = {
  stopReason: StopReason;
  /** 有的 agent（Claude Code）在 session/prompt 的结果里带这一轮的 token 用量。 */
  usage?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

/** agent 的一个设置项（ACP 的 session config option）：模型、思考强度、模式…… */
export type AskConfigChoice = { value: string; name: string; description?: string; group?: string };

export type AskConfigOption = {
  id: string;
  name: string;
  description?: string;
  /** ACP 的分类：model（模型）、thought_level（思考强度）、mode（模式），别的照原样。 */
  category?: string;
  type: "select" | "boolean";
  currentValue: string | boolean;
  /** select 的可选值（分组的已经摊平，group 记组名）。 */
  options: AskConfigChoice[];
};

/**
 * agent 在 initialize 里报的 RetainPDF 能力（agentCapabilities._meta.retainpdf，自带 agent 才有）：
 * selection —— 认 session/prompt 的 _meta 里的结构化出处，问题前面可以不写那段字；
 * conversation —— 握手带了对话编号，开会话时自己取前文（记忆 + 最近几轮），窗口不再把前几轮拼成字带过去；
 * memory —— 有记忆工具（记下的在工具卡片的 _meta 里，窗口画「已记住（撤销）」）。
 */
export type AskAgentCapabilities = { selection?: boolean; conversation?: boolean; memory?: boolean };

/** 一个 ACP 会话（session/new 开出来的）。 */
export type AskSession = {
  /** ACP session/new 回的 sessionId。宿主存问答记录时带上（后端删问答、删书时按它清 agent 自己存的会话文件）。 */
  sessionId?: string;
  /** agent 报的 RetainPDF 能力（见 AskAgentCapabilities）；本机 agent 没有。 */
  capabilities?: AskAgentCapabilities;
  /** 开会话时 agent 给的设置项（没有就是没有，窗口不画选择器）。 */
  configOptions?: AskConfigOption[];
  /** 改一个设置项（session/set_config_option），返回改完的整份设置项。agent 不支持就不给这个方法。 */
  setConfigOption?: (configId: string, value: string | boolean) => Promise<AskConfigOption[]>;
  /**
   * 哪些设置是开会话时定的（宿主拼进握手参数，比如 RetainPDF 自带 agent 的模型——换模型要换密钥和地址）：
   * 改了这些就关掉会话，下一问用 openSession 的 config 重开，之前几轮照样带过去。true 是所有设置都这样；不给是都能直接改。
   */
  reopenOnConfigChange?: boolean | ((configId: string) => boolean);
  /** 发一轮（session/prompt），回答过程走 onUpdate。meta 放进 session/prompt 的 _meta（这一问的结构化出处）。 */
  prompt: (blocks: ContentBlock[], meta?: Record<string, unknown>) => Promise<AskPromptResult>;
  /** 停（session/cancel）。 */
  cancel: () => void;
  /** 不用了（关窗、换 agent、重新回答）。 */
  close: () => void;
};

/** 宿主给窗口的端口：列 agent、开会话。会话要带的东西（书的任务号、模型配置）由宿主自己绑进去。 */
export type AskPort = {
  listAgents: () => Promise<AskAgent[]>;
  /** config 是用户选过的设置（模型、思考强度……，按设置项 id）：开会话时就要定的，宿主拼进握手参数；ACP 能改的，窗口开了会话再设。 */
  openSession: (options: { agentId: string; config?: Readonly<Record<string, string | boolean>> }, handlers: AskHandlers) => Promise<AskSession>;
  /**
   * 新会话的第一问前面带的「之前聊过什么」（宿主拼好的一段字，比如后端上下文接口的 text：记忆 + 摘要 + 最近几轮）。
   * agent 自己会取前文（capabilities.conversation）时不调。不给就用窗口里看得到的前几轮拼。
   */
  conversationPreamble?: () => Promise<string>;
};

/** 问题上方的小标签：这一问问的是哪儿（点了回到那一处）。 */
export type AskMessageContext = {
  page?: number;
  label: string;
  /** 宿主自己认的东西（比如结构化出处），点标签时原样交回。 */
  data?: unknown;
};

/**
 * 回答底下宿主加的一个动作（阅读页：「改这段译文」），只出在问题带着出处、available 认这处的回答下面。
 * 点了交回问的那一处、这条回答的全文、窗口里正选着的回答里的字（没有是 ""），宿主自己挑要用的那段。
 */
export type AskAnswerAction = {
  label: string;
  title: string;
  available: (context: AskMessageContext) => boolean;
  run: (context: AskMessageContext, answer: { text: string; selection: string }) => void;
};

/** 存下来的一条问答：问题，或者回答（带思考和用量）。宿主拿去存、下次原样交回来。 */
export type AskMessage = {
  role: "user" | "assistant";
  text: string;
  thought?: string | null;
  usage?: Record<string, unknown> | null;
  /** 宿主那边的编号（比如后端的 message_id）；「深挖」时交回。 */
  id?: string;
  /** 问题问的是哪儿（只有问题有）。 */
  context?: AskMessageContext | null;
  /**
   * side_summary：副对话结束时回到主对话的结论卡片（画成卡片，能展开看副对话）；
   * compacted：这条之前的都压缩成了摘要（这条后面画一条分隔线）。
   */
  marks?: {
    sideSummary?: { sideId: string | null; title?: string };
    compactedBefore?: boolean;
    /** 这一问是改过的（以前的问答作废了，原文留着）：问题上面画「改过」，点开看原来的。 */
    rewrote?: { question: string; answer?: string };
  };
};

/** 答完的一轮：问题和回答、问的时候带的出处、谁答的、这一轮记下的记忆编号。宿主拿去追加。 */
export type AskTurnRecord = {
  question: AskMessage;
  answer: AskMessage;
  /** 发问时用的出处（AskContext）；没带是 null。 */
  context: AskContext | null;
  agentId: string;
  sessionId?: string;
  /** 这一轮「已记住」的记忆编号（工具卡片 _meta 里的，created 为真的）。 */
  memoryIds: string[];
  /** 这一轮开始的时刻（毫秒时间戳）：agent 不在 _meta 里报记忆时，宿主按它去查这一轮新记的。 */
  startedAt?: number;
  /** 回答在窗口里的消息编号：宿主查到的记忆按它交回（AskWindow 的 memories）。 */
  answerId?: string;
  /** 问题在窗口里的消息编号（宿主记下它在库里是哪条，之后改这一问时认得）。 */
  questionId?: string;
  /** 这一问改自哪条（窗口里的编号；重新回答时就是它自己）：宿主追加时带 edited_from。 */
  editedFrom?: string;
};

/** 「已记住」：agent 记下一条记忆（自带 agent 在 remember 工具卡片完成时的 _meta.retainpdf.memory）。 */
export type AskMemoryNotice = {
  id: string;
  scope: string;
  text: string;
  category?: string;
  documentId?: string | null;
  /** 假的是早就记过一模一样的（没有新记，不画撤销）。 */
  created: boolean;
};

/** 顶上引的那段。有原文也有译文、又没选字时能切换。 */
export type AskQuote = {
  selection?: string;
  source?: string;
  translated?: string;
  /** 先给看哪一边（默认原文）。 */
  prefer?: "source" | "translated";
};

/** 问的是哪儿（宿主写好）。 */
export type AskContext = {
  /** 标题栏小标签上的页码；没有就不显示页码。 */
  page?: number;
  /** 悬停写全的位置，比如「第 56 页 · 2.1.1 Atomic Units」。 */
  label: string;
  quote?: AskQuote;
  /** 这一问前面带给 agent 的出处（一段字）。agent 认结构化出处（capabilities.selection）时不带。 */
  preamble?: string;
  /** 放进这一问 session/prompt 的 _meta（宿主的结构化出处，比如 {retainpdf: {selection}}）。 */
  meta?: Record<string, unknown>;
};
