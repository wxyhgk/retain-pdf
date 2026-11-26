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

/** 一个 ACP 会话（session/new 开出来的）。 */
export type AskSession = {
  /** 开会话时 agent 给的设置项（没有就是没有，窗口不画选择器）。 */
  configOptions?: AskConfigOption[];
  /** 改一个设置项（session/set_config_option），返回改完的整份设置项。agent 不支持就不给这个方法。 */
  setConfigOption?: (configId: string, value: string | boolean) => Promise<AskConfigOption[]>;
  /**
   * 设置是开会话时定的（宿主拼进握手参数，比如 RetainPDF 自带 agent 的模型和思考强度）：改了以后关掉这个会话，
   * 下一问用 openSession 的 config 重开，之前几轮照样带过去。
   */
  reopenOnConfigChange?: boolean;
  /** 发一轮（session/prompt），回答过程走 onUpdate。 */
  prompt: (blocks: ContentBlock[]) => Promise<AskPromptResult>;
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
};

/** 存下来的一条问答：问题，或者回答（带思考和用量）。宿主拿去存、下次原样交回来。 */
export type AskMessage = {
  role: "user" | "assistant";
  text: string;
  thought?: string | null;
  usage?: Record<string, unknown> | null;
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
  /** 新会话第一问前面带给 agent 的出处（一段字）。换 agent、重新回答、断线重连后会再带一次。 */
  preamble?: string;
};
