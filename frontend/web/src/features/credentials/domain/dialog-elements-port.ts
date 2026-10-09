// 凭据弹窗的元素访问端口。
//
import type { CredentialDialogElementsLike } from "./dialog-values.js";

// 原先 elements / syncOcrProviderControls 有指向旧世界 view.ts 的默认值，
// 但所有真实调用点都显式传入 React 侧的实现，默认值从不执行；view.ts 已删除，
// 这里改为必传，由调用方（composition 装配层）提供。
// E 保留调用方的元素类型（如 HTMLInputElement），只要求含凭据弹窗用到的 value 字段。
export function createCredentialDialogElementsPort<E extends CredentialDialogElementsLike>({
  elements,
  syncOcrProviderControls,
  syncTranslationProvider = () => {},
}: {
  elements: () => E;
  syncOcrProviderControls: (providerId?: string) => void;
  syncTranslationProvider?: (baseUrl?: string) => void;
}) {
  return {
    elements,
    syncOcrProviderControls,
    syncTranslationProvider,
  };
}
