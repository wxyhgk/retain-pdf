/** RetainPDF host bindings for the package-owned Reader AI runtime. */
import { resolveResourceUrl } from "@retainpdf/domain/job";
import * as readerAi from "@retainpdf/reader/runtime/ai";
import { askLibraryAi } from "@/platform/api/index.js";
import { fetchDocumentByJobId } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  defaultModelBaseUrl,
  defaultModelName,
} from "@/platform/config/runtime.js";
import {
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
} from "@/platform/config/persisted-config.js";
import { defaultCredentialsStatePort } from "@/features/credentials/domain.js";
import { fetchProtected } from "./data.js";

readerAi.setReaderAiConfigAdapters({
  credentialsPort: defaultCredentialsStatePort as any,
  loadBrowserStoredConfig: loadBrowserStoredConfig as any,
  loadDeveloperStoredConfig: loadDeveloperStoredConfig as any,
  defaultModelBaseUrl: defaultModelBaseUrl as any,
  defaultModelName: defaultModelName as any,
});
readerAi.setAnswerEnhanceAdapters({
  fetchProtected: fetchProtected as any,
  resolveResourceUrl: resolveResourceUrl as any,
});

export * from "@retainpdf/reader/runtime/ai";

export const createReaderAskAnswerer = (options: any = {}) =>
  readerAi.createReaderAskAnswerer({
    apiPrefix: API_PREFIX,
    ask: askLibraryAi as any,
    documentByJobId: fetchDocumentByJobId as any,
    llmConfig: readerAi.resolveReaderAiConfig as any,
    ...options,
  });
