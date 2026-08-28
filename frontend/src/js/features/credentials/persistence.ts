import {
  buildBrowserCredentialConfig,
  buildTaskOptionsFromDialogValues,
} from "./dialog-values.js";
import { createCredentialSetupModePort } from "./setup-mode-port.js";

export function persistBrowserCredentialsFromDialog({
  applyHiddenCredentialInputs,
  applyCredentialInputs = applyHiddenCredentialInputs,
  currentOcrProvider,
  defaultModelApiKey,
  defaultModelBaseUrl,
  readHiddenCredentialInputs: _readHiddenCredentialInputs,
  readCredentialInputs: _readCredentialInputs,
  saveTaskOptions,
  saveBrowserStoredConfig,
  values,
}: any) {
  // Trực tiếp duy trì kết quả biểu mẫu，Tránh sử dụng lại từ state/DOM Giá trị cũ khi đọc lại
  const next = buildBrowserCredentialConfig({
    values,
    currentOcrProvider,
    defaultModelApiKey,
  });
  applyCredentialInputs(next);
  saveBrowserStoredConfig?.(next);
  saveTaskOptions?.(buildTaskOptionsFromDialogValues({
    values,
    defaultModelBaseUrl,
  }));
  return next;
}

export async function persistDesktopCredentialsFromDialog({
  currentOcrProvider,
  defaultModelApiKey,
  defaultModelBaseUrl,
  saveTaskOptions,
  saveDesktopConfig,
  checkApiConnectivity,
  values,
  setupModePort = createCredentialSetupModePort(),
}: any) {
  const provider = currentOcrProvider();
  const paddleToken = values.paddleToken;
  // Phù hợp với trình duyệt：Chỉ lưu những gì người dùng điền vào trong cài đặt Key，Không phải từ runtime Đất đắp im lặng
  void defaultModelApiKey;
  const modelApiKey = `${values.modelApiKey || ""}`.trim();
  await saveDesktopConfig?.(
    {
      ocrProvider: provider,
      paddleToken,
      modelApiKey,
      markConfigured: setupModePort.currentSetupMode(),
    },
    async () => {
      await checkApiConnectivity?.();
    },
  );
  saveTaskOptions?.(buildTaskOptionsFromDialogValues({
    values,
    defaultModelBaseUrl,
  }));
}
