// 凭据弹窗的元素访问端口。
//
// 原先 elements / syncOcrProviderControls 有指向旧世界 view.ts 的默认值，
// 但所有真实调用点都显式传入 React 侧的实现，默认值从不执行；view.ts 已删除，
// 这里改为必传，由调用方（composition 装配层）提供。
export function createCredentialDialogElementsPort({
  elements,
  syncOcrProviderControls,
  syncTranslationProvider = () => {},
}: any) {
  return {
    elements,
    syncOcrProviderControls,
    syncTranslationProvider,
  };
}
