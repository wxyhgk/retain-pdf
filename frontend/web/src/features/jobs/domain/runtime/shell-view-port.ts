export function createJobRuntimeShellViewPort({
  closeDialogs = () => {},
  isReaderOpen = () => false,
  setCancelDisabled = () => {},
  setCancelError = () => {},
}: {
  closeDialogs?: () => void;
  isReaderOpen?: () => boolean;
  setCancelDisabled?: (disabled: boolean) => void;
  setCancelError?: (message: string) => void;
} = {}) {
  return {
    closeDialogs,
    isReaderOpen,
    setCancelDisabled,
    setCancelError,
  };
}
