export function createTranslationWorkflowStatusAreaPort({
  isVisible = () => false,
  hide = () => {},
  returnHome = () => {},
}: {
  isVisible?: () => boolean;
  hide?: () => void;
  returnHome?: () => void;
} = {}) {
  return Object.freeze({
    hide,
    isVisible,
    returnHome,
  });
}
