export function createJobRuntimeShellViewPort({
  closeDialogs = () => {},
  isReaderOpen = () => false,
  setCancelDisabled = () => {},
}: any = {}) {
  return {
    closeDialogs,
    isReaderOpen,
    setCancelDisabled,
  };
}
