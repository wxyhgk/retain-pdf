export function createJobRuntimeShellViewPort({
  closeDialogs = () => {},
  isReaderOpen = () => false,
  resetEvents = () => {},
  setCancelDisabled = () => {},
}: any = {}) {
  return {
    closeDialogs,
    isReaderOpen,
    resetEvents,
    setCancelDisabled,
  };
}
