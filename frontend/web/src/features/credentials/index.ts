// credentials —— API 凭据：OCR 与翻译模型的密钥录入、校验、持久化与就绪门禁。
//
// 这是本功能对外的唯一出口。
// ui/     凭据工作台/弹窗/提供方面板/隐藏镜像输入、Agent 运行时设置卡、
//         功能自带的 React context（页面在挂载点提供值）
// domain/ 凭据状态与校验、DeepSeek/OCR 就绪流程、浏览器与桌面持久化、各类端口，
//         全部与 React 无关。非 React 调用方请从 ./domain.js 导入，不要走本文件——
//         本文件会拖入整棵 React 组件树，且容易与 reader 宿主形成循环 import。

export { CredentialsWorkbench } from "./ui/CredentialsWorkbench.jsx";
export { CredentialsDialog } from "./ui/CredentialsDialog.jsx";
export { HiddenCredentialInputs } from "./ui/HiddenCredentialInputs.jsx";
export { AgentRuntimeSettingsCard } from "./ui/AgentRuntimeSettingsCard.jsx";
export { CredentialsProvider, useCredentialsServices } from "./ui/credentials-context.jsx";
export type { CredentialsServices } from "./ui/credentials-context.jsx";
export { useCredentialsController } from "./ui/useCredentialsController.js";
export {
  APP_SETTINGS_DIALOG_DATASETS,
  APP_SETTINGS_DIALOG_IDS,
  CREDENTIAL_DOM_IDS,
} from "./ui/credentials-dom-ids.js";

// 非 React 出口统一在 domain.ts，这里整体转出，两处不会漂移。
export * from "./domain.js";
