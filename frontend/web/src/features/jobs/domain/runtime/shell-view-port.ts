export function createJobRuntimeShellViewPort({
  closeDialogs = () => {},
  isReaderOpen = () => false,
  setCancelDisabled = () => {},
}: {
  closeDialogs?: () => void;
  isReaderOpen?: () => boolean;
  setCancelDisabled?: (disabled: boolean) => void;
} = {}) {
  return {
    closeDialogs,
    isReaderOpen,
    setCancelDisabled,
  };
}
