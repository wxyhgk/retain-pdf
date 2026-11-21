// 上传弹窗这一次选的模型、OCR（2026-11-20 模型，2026-11-21 OCR）：存在 workflow-view 的 store 里（uploadModel、uploadOcr），
// 只管这一次上传 —— 不记到本机，新开一次上传回到设置里的，书库的「翻译整本」「只做 OCR」也不读它们。
// 提交时 payload-assembly 的 collectRunPayload 用 uploadTranslationOverride / uploadOcrProvider 换掉设置里的。
import type { BrandLogo } from "@/platform/config/brand-logos.js";
import { normalizeOcrProvider, OCR_PROVIDER_DEFINITIONS } from "@/platform/config/providers.js";
import { connectionOverrides, connectionValue, savedTranslationConnections } from "@/platform/config/translation-connections.js";

/** 上传弹窗里能挑的一家 OCR。 */
export type UploadOcrChoice = {
  id: string;
  label: string;
  logo: BrandLogo | null;
  /** 本机设好了能用（没设好的灰掉，去设置里填）。 */
  ready: boolean;
  /** 设置里选的那家。 */
  isDefault: boolean;
};

type UploadChoiceState = { uploadModel: string; uploadOcr: string };

export function createUploadChoices({
  getState,
  patch,
  ocrReady,
  settingsOcrProvider,
}: {
  getState: () => UploadChoiceState;
  patch: (payload: Partial<UploadChoiceState>) => unknown;
  /** 这家 OCR 本机能不能用（组合根接凭据：credentialsStatePort.isOcrReady）。不给都当能用。 */
  ocrReady?: (providerId: string) => boolean;
  /** 设置里选的 OCR。 */
  settingsOcrProvider?: () => string;
}) {
  function setUploadModel(value: unknown = "") {
    patch({ uploadModel: `${value || ""}`.trim() });
  }

  /** 上传提交时把选的模型换成翻译字段；没选、连接没了是 null。 */
  function uploadTranslationOverride(): Record<string, string> | null {
    const value = getState().uploadModel;
    if (!value) return null;
    return connectionOverrides(savedTranslationConnections().find((connection) => connectionValue(connection) === value));
  }

  function setUploadOcr(value: unknown = "") {
    const text = `${value || ""}`.trim();
    patch({ uploadOcr: text ? normalizeOcrProvider(text) : "" });
  }

  /** 这次上传用哪家 OCR：弹窗里选了的（还能用）；没选是空串，照设置里的。 */
  function uploadOcrProvider(): string {
    const chosen = getState().uploadOcr;
    if (!chosen) return "";
    return !ocrReady || ocrReady(chosen) ? chosen : "";
  }

  function defaultOcr(): string {
    return normalizeOcrProvider(settingsOcrProvider?.() || "");
  }

  /** 弹窗里 OCR 那一栏的几家：照设置里的顺序，标出能不能用、哪家是默认。 */
  function uploadOcrChoices(): UploadOcrChoice[] {
    const fallback = defaultOcr();
    return OCR_PROVIDER_DEFINITIONS.map((definition) => ({
      id: definition.id,
      label: definition.label,
      logo: definition.logo || null,
      ready: !ocrReady || ocrReady(definition.id),
      isDefault: definition.id === fallback,
    }));
  }

  /** 新开一次上传：这次选的模型、OCR 回到设置里的。 */
  function resetUploadChoices() {
    patch({ uploadModel: "", uploadOcr: "" });
  }

  return {
    setUploadModel,
    uploadTranslationOverride,
    setUploadOcr,
    uploadOcrProvider,
    defaultOcr,
    uploadOcrChoices,
    resetUploadChoices,
  };
}
