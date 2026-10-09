// 安全凭据保险箱操作：列出/解析引用、写入 OCR token 与翻译 API Key。
// 与挂载闭包解耦：状态（revision）内聚在本工厂，外部只注入读凭据/命名函数。

import {
  getOcrProviderDefinition,
  normalizeOcrProvider,
  OCR_PROVIDER_DEFINITIONS,
} from "@/platform/config/providers.js";
import { savePersistedBrowserStoredConfig } from "@/platform/config/persisted-config.js";
import type { CredentialsFields, CredentialsStatePort } from "./state.js";
import type {
  CredentialListView,
  CredentialMutationView,
  CreateCredentialInput,
  UpdateCredentialInput,
} from "@/platform/api/domains/credentials.js";

type RuntimeEnvPort = { isDesktopMode?: () => boolean };

export function createCredentialVault({
  apiPrefix,
  credentialsStatePort,
  runtimeEnv,
  readCurrentCredentials,
  currentOcrProvider,
  translationProvider,
  listCredentials,
  createCredential,
  updateCredential,
  saveDesktopConfig,
}: {
  apiPrefix: string;
  credentialsStatePort: CredentialsStatePort;
  runtimeEnv: RuntimeEnvPort;
  readCurrentCredentials: () => CredentialsFields;
  currentOcrProvider: () => string;
  translationProvider: (baseUrl?: string) => string;
  listCredentials?: (apiPrefix?: string) => Promise<CredentialListView>;
  createCredential?: (apiPrefix: string | undefined, payload: CreateCredentialInput) => Promise<CredentialMutationView>;
  updateCredential?: (
    apiPrefix: string | undefined,
    credentialRef: string,
    payload: UpdateCredentialInput,
  ) => Promise<CredentialMutationView>;
  saveDesktopConfig?: (
    browserConfig?: Record<string, unknown>,
    afterSave?: () => unknown,
  ) => Promise<unknown> | unknown;
}) {
  let credentialVaultRevision: number | undefined;
  let referenceRequest = 0;
  let ocrCredentials: Record<string, { credential_ref: string; revision?: number }> = {};
  let translationCredentialRevision: number | undefined;

  async function refreshCredentialReferences({ persist = true } = {}) {
    if (!listCredentials) return null;
    const request = ++referenceRequest;
    const provider = currentOcrProvider();
    const result = await listCredentials(apiPrefix);
    // Late results must not restore another provider or overwrite a newer save.
    if (request !== referenceRequest || provider !== currentOcrProvider()) return null;
    credentialVaultRevision = Number.isFinite(Number(result?.revision))
      ? Number(result.revision)
      : undefined;
    const items = Array.isArray(result?.credentials) ? result.credentials : [];
    const translationCandidates = items.filter(
      (item) => item?.kind === "translation_api_key" && item?.configured !== false,
    );
    const currentCredentials = readCurrentCredentials();
    const existingTranslationRef = `${currentCredentials?.translationCredentialRef || ""}`.trim();
    const selectedTranslation = translationCandidates.find((item) => item?.credential_ref === existingTranslationRef)
      || translationCandidates.sort((a, b) => `${b?.updated_at || ""}`.localeCompare(`${a?.updated_at || ""}`))[0]
      || null;
    const translationCredentialRef = `${selectedTranslation?.credential_ref || ""}`.trim();
    translationCredentialRevision = Number.isFinite(Number(selectedTranslation?.revision))
      ? Number(selectedTranslation.revision)
      : undefined;

    const existingOcrRef = `${currentCredentials?.ocrCredentialRef || ""}`.trim();
    const ocrCandidates = items.filter((item) => (
      item?.kind === "ocr_provider_token" && item?.configured !== false
    )).sort((a, b) => `${b?.updated_at || ""}`.localeCompare(`${a?.updated_at || ""}`));
    const nextOcrCredentials: typeof ocrCredentials = {};
    for (const definition of OCR_PROVIDER_DEFINITIONS) {
      const candidates = ocrCandidates.filter((item) => (
        `${item?.provider || ""}`.trim().toLowerCase() === definition.id
      ));
      const preferredRef = (definition.id === provider ? existingOcrRef : "")
        || ocrCredentials[definition.id]?.credential_ref;
      const selected = candidates.find((item) => item.credential_ref === preferredRef) || candidates[0];
      if (selected) nextOcrCredentials[definition.id] = selected;
    }
    ocrCredentials = nextOcrCredentials;
    const selectedOcr = ocrCredentials[provider] || null;
    const ocrCredentialRef = `${selectedOcr?.credential_ref || ""}`.trim();

    credentialsStatePort.patchCredentials?.({
      ocrCredentialRef,
      translationCredentialRef,
    });
    if (persist && (
      translationCredentialRef !== existingTranslationRef
      || ocrCredentialRef !== existingOcrRef
    )) {
      await savePersistedBrowserStoredConfig(readCurrentCredentials());
    }
    if (persist && request === referenceRequest && provider === currentOcrProvider()
      && ocrCredentialRef && translationCredentialRef && runtimeEnv.isDesktopMode?.() && saveDesktopConfig) {
      const restoredCredentials = readCurrentCredentials();
      await saveDesktopConfig({
        ocrProvider: provider,
        ocrCredentialRef,
        paddleToken: restoredCredentials.paddleToken || "",
        translationCredentialRef,
        modelApiKey: restoredCredentials.modelApiKey || "",
        markConfigured: true,
      });
    }
    return { ocr: selectedOcr, translation: selectedTranslation };
  }

  async function storeOcrCredential({ secret, provider }: { secret: string; provider: string }) {
    const normalizedSecret = `${secret || ""}`.trim();
    const normalizedProvider = normalizeOcrProvider(provider);
    if (!createCredential || !updateCredential || !listCredentials) {
      throw new Error("当前前端未接入安全凭据服务，请刷新后重试");
    }
    if (credentialVaultRevision === undefined) {
      await refreshCredentialReferences({ persist: false });
    }
    const existingCredential = ocrCredentials[normalizedProvider];
    const existingRef = `${existingCredential?.credential_ref || ""}`.trim();
    if (!normalizedSecret) {
      if (!existingRef) throw new Error(`未找到 ${getOcrProviderDefinition(normalizedProvider).label} 凭据，请重新填写 Token`);
      return existingRef;
    }
    ++referenceRequest;
    const ocrCredentialRevision = existingCredential?.revision;
    // 同一份载荷既可能走新建也可能走更新：expected_credential_revision 只在已有引用（更新）时才带。
    const payload: CreateCredentialInput & UpdateCredentialInput = {
      kind: "ocr_provider_token",
      provider: normalizedProvider,
      label: `${getOcrProviderDefinition(normalizedProvider).label} OCR`,
      secret: normalizedSecret,
      ...(credentialVaultRevision === undefined
        ? {}
        : { expected_revision: credentialVaultRevision }),
      ...(existingRef && ocrCredentialRevision !== undefined
        ? { expected_credential_revision: ocrCredentialRevision }
        : {}),
    };
    const result = existingRef
      ? await updateCredential(apiPrefix, existingRef, payload)
      : await createCredential(apiPrefix, payload);
    credentialVaultRevision = Number.isFinite(Number(result?.revision))
      ? Number(result.revision)
      : credentialVaultRevision;
    const credentialRef = `${result?.credential?.credential_ref || existingRef}`.trim();
    ocrCredentials[normalizedProvider] = {
      credential_ref: credentialRef,
      revision: Number.isFinite(Number(result?.credential?.revision))
        ? Number(result.credential.revision)
        : ocrCredentialRevision,
    };
    return credentialRef;
  }

  async function storeTranslationCredential({ secret, baseUrl }: { secret: string; baseUrl: string }) {
    const normalizedSecret = `${secret || ""}`.trim();
    let existingRef = `${readCurrentCredentials()?.translationCredentialRef || ""}`.trim();
    if (!normalizedSecret) return existingRef;
    if (!createCredential || !updateCredential || !listCredentials) {
      throw new Error("当前前端未接入安全凭据服务，请刷新后重试");
    }
    if (credentialVaultRevision === undefined) {
      await refreshCredentialReferences({ persist: false });
    }
    existingRef = `${readCurrentCredentials()?.translationCredentialRef || ""}`.trim();
    const payload: CreateCredentialInput & UpdateCredentialInput = {
      kind: "translation_api_key",
      provider: translationProvider(baseUrl),
      label: "翻译 API",
      secret: normalizedSecret,
      ...(credentialVaultRevision === undefined
        ? {}
        : { expected_revision: credentialVaultRevision }),
      ...(existingRef && translationCredentialRevision !== undefined
        ? { expected_credential_revision: translationCredentialRevision }
        : {}),
    };
    const result = existingRef
      ? await updateCredential(apiPrefix, existingRef, payload)
      : await createCredential(apiPrefix, payload);
    credentialVaultRevision = Number.isFinite(Number(result?.revision))
      ? Number(result.revision)
      : credentialVaultRevision;
    translationCredentialRevision = Number.isFinite(Number(result?.credential?.revision))
      ? Number(result.credential.revision)
      : translationCredentialRevision;
    return `${result?.credential?.credential_ref || existingRef}`.trim();
  }

  return { refreshCredentialReferences, storeOcrCredential, storeTranslationCredential };
}
