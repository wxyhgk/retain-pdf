// ask —— 主页 AI 问答：围绕文档提问，回答带页码与原文引用；
// 需要改 PDF 时可切到 PDF Agent，由 operations/ 承载操作候选、预览与确认。
//
// 这是本功能对外的唯一出口。
// ui/     问答视图、输入区、会话侧栏、消息线，以及 Agent 操作卡片与运行时 hook
// domain/ 会话与操作的状态机、文档选择、Agent 运行时门禁、请求配置，全部与 React 无关

export { HomeAskView } from "./ui/HomeAskView.jsx";
export type { HomeAskScope, HomeAskCitation, HomeAskMessage } from "./domain/types.js";
