// 浏览器凭据保存流程。
//
// perform 负责输入值回落、校验、任务选项组装与（浏览器 + 桌面）持久化；
// handle 在外层加"保存中"并发门，保证同一时刻只有一次保存。
// 所有外部依赖显式注入，便于单测。

import {
  getOcrProviderDefinition,
  inferTranslationProvider,
  TRANSLATION_PROVIDER_DEFINITION,
} from "@/platform/config/providers.js";
import { savePersistedBrowserStoredConfig } from "@/platform/config/persisted-config.js";
import { notifyCredentialsChanged } from "@/platform/contracts/credentials-contract.js";
import {
  buildTaskOptionsFromDialogValues,
  ocrTokenFromDialogValues,
  readCredentialDialogValues,
} from "./dialog-values.js";
import {
  translationConfigError,
  translationWorkersError,
} from "./translation-profile.js";
import {
  persistDesktopCredentialsFromDialog as persistDesktopCredentials,
} from "./persistence.js";
import type { CredentialDialogElementsLike } from "./dialog-values.js";
import type { CredentialsFields } from "./state.js";

/** HH:MM:SS。刻意不走 toLocaleTimeString——它随环境 locale 变，测试会飘。 */
function formatClockTime(date: Date): string {
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

type SaveFlowViewPort = {
  setOcrValidationMessage: (message?: string, tone?: string, providerId?: string) => void;
  setDeepSeekValidationMessage: (message?: string, tone?: string) => void;
  setDialogStatus: (message?: string, tone?: string) => void;
  closeDialog: () => void;
};

type CredentialAccess = {
  readCurrentCredentials: () => CredentialsFields;
  currentOcrProvider: () => string;
};

type TranslationProfileManager = {
  captureCurrent: () => void;
  recordCurrentProfile: (profile: Record<string, unknown>) => void;
  persistable: () => Record<string, unknown>;
  getCurrentProvider: () => string;
  defaultWorkers: () => number;
};

export function createBrowserCredentialSaveFlow({
  viewPort,
  credentialsStatePort,
  access,
  translation,
  getTaskOptions,
  defaultModelBaseUrl,
  defaultModelApiKey,
  saveTaskOptions,
  saveDesktopConfig,
  checkApiConnectivity,
  setupModePort,
  onCredentialStateChange,
  dialogElementsPort,
  syncBrowserDialogFromCredentialState,
  runtimeEnv,
  now = () => new Date(),
}: {
  viewPort: SaveFlowViewPort;
  credentialsStatePort: {
    setCredentials?: (payload?: Record<string, unknown>) => unknown;
  };
  access: CredentialAccess;
  translation: TranslationProfileManager;
  getTaskOptions?: () => Record<string, unknown> | unknown;
  defaultModelBaseUrl?: () => string;
  defaultModelApiKey?: () => string;
  saveTaskOptions?: (options?: Record<string, unknown> | unknown) => unknown;
  saveDesktopConfig?: (
    browserConfig?: Record<string, unknown> | unknown,
    afterSave?: () => unknown,
  ) => Promise<unknown> | unknown;
  checkApiConnectivity?: () => Promise<unknown> | unknown;
  setupModePort: { currentSetupMode: () => boolean };
  onCredentialStateChange?: () => void;
  dialogElementsPort: { elements: () => CredentialDialogElementsLike };
  syncBrowserDialogFromCredentialState: () => void;
  runtimeEnv: { isDesktopMode: () => boolean };
  /** 注入时钟，保持本模块可预测；UI 用它区分"这次刚存"与"上次的残留"。 */
  now?: () => Date;
}) {
  let credentialSaveInFlight = false;

  async function performSave() {
    const definition = getOcrProviderDefinition(access.currentOcrProvider());
    const existing = access.readCurrentCredentials();
    translation.captureCurrent();
    const raw = readCredentialDialogValues({ elementsPort: dialogElementsPort });
    const existingTaskOptions = (getTaskOptions?.() || {}) as Record<string, unknown>;
    const sameTranslationProvider = translation.getCurrentProvider() === (
      existingTaskOptions.translationProvider || inferTranslationProvider(`${existingTaskOptions.baseUrl || defaultModelBaseUrl?.() || ""}`)
    ) && (translation.getCurrentProvider() !== "custom"
      || !raw.modelBaseUrl || raw.modelBaseUrl === existingTaskOptions.baseUrl);
    // 输入框留空时沿用当前值，避免保存其他设置时误删凭据。
    const values = {
      ...raw,
      paddleToken: `${raw.paddleToken || ""}`.trim() || `${existing.paddleToken || ""}`.trim(),
      mineruToken: `${raw.mineruToken || ""}`.trim() || `${existing.mineruToken || ""}`.trim(),
      modelApiKey: `${raw.modelApiKey || ""}`.trim() || (sameTranslationProvider ? `${existing.modelApiKey || ""}`.trim() : ""),
      modelBaseUrl: `${raw.modelBaseUrl || ""}`.trim()
        || `${existingTaskOptions.baseUrl || ""}`.trim()
        || `${defaultModelBaseUrl?.() || ""}`.trim(),
      modelName: `${raw.modelName || ""}`.trim()
        || `${existingTaskOptions.model || ""}`.trim(),
      translationWorkers: `${raw.translationWorkers || ""}`.trim()
        || `${existingTaskOptions.workers || translation.defaultWorkers() || 5}`,
    };
    const ocrToken = ocrTokenFromDialogValues(values, definition.id);
    const modelApiKey = `${values.modelApiKey || ""}`.trim();
    const existingOcrCredentialRef = `${existing.ocrCredentialRef || ""}`.trim();
    const existingTranslationCredentialRef = sameTranslationProvider ? `${existing.translationCredentialRef || ""}`.trim() : "";
    const translationError = translationConfigError(values.modelBaseUrl, values.modelName);
    const workersError = translationWorkersError(values.translationWorkers, translation.getCurrentProvider());
    if ((!ocrToken && !existingOcrCredentialRef)
      || (!modelApiKey && !existingTranslationCredentialRef)
      || translationError
      || workersError) {
      if (!ocrToken && !existingOcrCredentialRef) {
        viewPort.setOcrValidationMessage(definition.validationMissingMessage, "error", definition.id);
      }
      if (!modelApiKey && !existingTranslationCredentialRef) {
        viewPort.setDeepSeekValidationMessage(TRANSLATION_PROVIDER_DEFINITION.validationMissingMessage, "error");
      } else if (translationError || workersError) {
        viewPort.setDeepSeekValidationMessage(translationError || workersError, "error");
      }
      viewPort.setDialogStatus(
        translationError || workersError || "请填写尚未保存的 OCR Token 或翻译 API Key",
        "error",
      );
      return;
    }

    translation.recordCurrentProfile({
      apiKey: values.modelApiKey,
      baseUrl: values.modelBaseUrl,
      model: values.modelName,
      workers: values.translationWorkers,
    });
    const nextTaskOptions = {
      ...buildTaskOptionsFromDialogValues({
        values,
        defaultModelBaseUrl,
      }),
      translationProvider: translation.getCurrentProvider(),
      translationProfiles: translation.persistable(),
    };

    // 保存只做落盘；联网校验留给「检测」按钮。
    // 必须 await 完整持久化（含桌面 snapshot），再通知 AI 门禁刷新。
    try {
      // New keys are ordinary local settings. References only support older configs.
      const ocrCredentialRef = ocrToken ? "" : existingOcrCredentialRef;
      const translationCredentialRef = modelApiKey ? "" : existingTranslationCredentialRef;
      const nextCredentials = {
        ocrProvider: definition.id,
        ocrCredentialRef,
        paddleToken: definition.id === "paddle" ? ocrToken : existing.paddleToken || "",
        mineruToken: definition.id === "mineru" ? ocrToken : existing.mineruToken || "",
        translationCredentialRef,
        modelApiKey,
      };
      credentialsStatePort.setCredentials?.(nextCredentials);
      // 统一走 savePersisted*：localStorage + 桌面 snapshot/IPC 一次写齐
      await savePersistedBrowserStoredConfig(nextCredentials);
      // 兼容旧注入（桌面 markConfigured / 任务选项）
      if (runtimeEnv.isDesktopMode() && saveDesktopConfig) {
        await persistDesktopCredentials({
          currentOcrProvider: () => definition.id,
          defaultModelApiKey,
          defaultModelBaseUrl,
          saveTaskOptions: undefined,
          saveDesktopConfig,
          checkApiConnectivity: async () => {
            try {
              await checkApiConnectivity?.();
            } catch {
              /* ignore connectivity on save */
            }
          },
          values: {
            ...values,
            ocrCredentialRef,
            paddleToken: nextCredentials.paddleToken,
            mineruToken: nextCredentials.mineruToken,
            modelApiKey,
            translationCredentialRef,
          },
          setupModePort,
        });
      }
      // 与上面的凭据落盘同等对待：本行注释里"必须 await 完整持久化"说的就是
      // 这里，漏掉 await 会让任务选项(模型名/URL/并发/profile)写盘失去保障。
      await saveTaskOptions?.(nextTaskOptions);
      // 再次保证内存态与刚写入的 next 一致
      credentialsStatePort.setCredentials?.(nextCredentials);
    } catch (error) {
      const message = (error as { message?: string })?.message || String(error);
      viewPort.setDialogStatus(message, "error");
      viewPort.setDeepSeekValidationMessage(message, "error");
      return;
    }
    // 写回可见输入，避免保存后输入框仍显示空
    syncBrowserDialogFromCredentialState();
    onCredentialStateChange?.();
    notifyCredentialsChanged();
    // 带上时刻：否则连续保存的状态是"已保存"→"已保存"，屏幕零变化，
    // 用户无法判断这次到底存没存，只能反复点。时刻也让 UI 能识别出
    // "这是一次新的保存"，从而重新播放成功反馈。
    viewPort.setDialogStatus(`已保存 ${formatClockTime(now())}`, "valid");
    // 首次配置弹窗保存后关闭；设置中心内嵌时保持打开以便继续改任务选项
    if (setupModePort.currentSetupMode()) {
      viewPort.closeDialog();
    }
  }

  async function handleSave() {
    if (credentialSaveInFlight) return;
    credentialSaveInFlight = true;
    viewPort.setDialogStatus("正在保存…", "pending");
    try {
      await performSave();
    } finally {
      credentialSaveInFlight = false;
    }
  }

  return { performSave, handleSave, isSaving: () => credentialSaveInFlight };
}
