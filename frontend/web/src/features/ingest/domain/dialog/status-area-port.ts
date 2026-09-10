export function createTranslationWorkflowStatusAreaPort({
  isVisible = () => false,
  hide = () => {},
  returnHome = () => {},
}: any = {}) {
  return Object.freeze({
    hide,
    isVisible,
    returnHome,
  });
}
