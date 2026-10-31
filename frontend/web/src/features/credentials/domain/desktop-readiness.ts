import { getOcrProviderDefinition, normalizeOcrProvider, ocrKeyBorrowable } from "@/platform/config/providers.js";

/** desktop-config.json 里与凭据有关的那几个字段（见 desktop-persistence 的 savePayload）。 */
export interface DesktopCredentialSnapshot {
  ocrProvider?: string;
  ocrCredentialRef?: string;
  translationCredentialRef?: string;
  paddleToken?: string;
  mineruToken?: string;
  glmOcrToken?: string;
  modelApiKey?: string;
}

function filled(value: unknown): boolean {
  return `${value ?? ""}`.trim().length > 0;
}

/**
 * 桌面端的凭据是否已经齐全到可以跑一轮。
 *
 * 首配门原先只看 `firstRunCompleted`，而那个布尔只在「setupMode 下保存」时才写
 * （persistence.ts 的 markConfigured）。从设置中心保存不会写它，配置文件被重建
 * 也会丢它——于是出现「输入框里 Key 都在，却每次启动还被拦一道」。
 *
 * 判据沿用 credential-vault 已有的那条（OCR + 翻译两边都要有凭据），只是同时接受
 * 明文 token：早于凭据库的快照里只有 token 没有 ref，它们同样是配好了的。
 *
 * OCR provider 都是在线服务、都需要 token（见 OCR_PROVIDER_DEFINITIONS）；只有 GLM-OCR 可以不填自己的，
 * 借智谱翻译的 key（保存设置时已经核过翻译是智谱）。
 */
export function hasDesktopCredentials(snapshot?: DesktopCredentialSnapshot | null): boolean {
  const config = (snapshot && typeof snapshot === "object" ? snapshot : {}) as Record<string, unknown>;
  const definition = getOcrProviderDefinition(normalizeOcrProvider(config.ocrProvider));
  const translationReady = filled(config.translationCredentialRef) || filled(config.modelApiKey);
  const ocrReady = filled(config.ocrCredentialRef) || filled(config[definition.runtimeConfigKey])
    || (ocrKeyBorrowable(definition.id) && translationReady);
  return ocrReady && translationReady;
}
