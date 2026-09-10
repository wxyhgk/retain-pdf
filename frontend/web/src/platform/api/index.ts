// composition/external/api — canonical barrel, re-exports from @retainpdf/api
// Source of truth for ALL API clients is now @retainpdf/api; this barrel keeps
// the public import surface (pages/home/* stays `from "@/platform/api/index.js"`), but
// delegates to @retainpdf/api. Mock adapters remain here so mock mode stays identical;

// http primitives — canonical (no mock branching)
export {
  buildApiEndpoint,
  buildJobDetailEndpoint,
} from "@retainpdf/api/http";
export {
  fetchAgentRuntimeConfig,
  updateAgentRuntimeConfig,
} from "@retainpdf/api/agent-runtime-settings";
export type {
  AgentRuntimeConfigUpdate,
  AgentRuntimeConfigView,
  AgentRuntimeMode,
} from "@retainpdf/api/agent-runtime-settings";
export {
  createCredential,
  deleteCredential,
  listCredentials,
  updateCredential,
} from "@retainpdf/api/credentials";
export type {
  CredentialListView,
  CredentialMetadata,
  CredentialMutationView,
} from "@retainpdf/api/credentials";
import { isMockMode } from "@/platform/config/runtime.js";
import { fetchMockProtected } from "@/platform/mock/index.js";
import { fetchProtected as _canonFetchProtected, submitJson as _canonSubmitJson, submitUploadRequest as _canonSubmitUploadRequest } from "@retainpdf/api/http";
import { submitJson as _legacySubmitJson, submitUploadRequest as _legacySubmitUploadRequest } from "@/platform/api/legacy/http.js";

/**
 * mock 模式走 mockImpl，否则直接调 canonical 实现。
 *
 * 取代逐个函数手写两路分发。那种写法要求包装签名退化成 `(...args: any[])`，
 * 于是每个调用点都得 `as any` 才能把 any[] 展开进有类型的 canonical 签名——
 * 本文件曾因此累积 116 处 as any（占当时全前端 332 处的三分之一）。
 * 这里把强转收敛到一处，对外可见的参数类型仍取自 canonical 签名，
 * 返回类型沿用既有的 Promise<any>，不改变任何调用方的类型契约。
 */
type AnyApiFn = (...args: any[]) => any;
function mockable<F extends AnyApiFn>(
  canonical: F,
  mockImpl: AnyApiFn,
): (...args: Parameters<F>) => Promise<any> {
  return async (...args: Parameters<F>) => (
    isMockMode() ? mockImpl(...args) : canonical(...args)
  );
}

// Wrap mock-aware http helpers so mock:// and mock job submissions still work in tests
export const fetchProtected = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (isMockMode() && `${url || ""}`.startsWith("mock://")) return fetchMockProtected(url);
  return _canonFetchProtected(url, options);
};
export const submitJson = async (url: string, payload: unknown): Promise<any> => {
  if (isMockMode()) return _legacySubmitJson(url, payload);
  return _canonSubmitJson(url, payload);
};
export const submitUploadRequest = (url: string, form: FormData, onProgress?: (a:number,b:number)=>void): Promise<any> => {
  if (isMockMode()) return _legacySubmitUploadRequest(url, form, onProgress);
  return _canonSubmitUploadRequest(url, form, onProgress);
};
export const submitUploadRequestHttp = submitUploadRequest;

// jobs + library-books — with mock adapters
import { getMockJobList, getMockJobPayload } from "@/platform/mock/index.js";
import { countMockFavoritesByJob } from "@/platform/mock/documents.js";
import { fetchJobList as _fetchJobList, fetchJobPayload as _fetchJobPayload } from "@retainpdf/api/jobs";
import { fetchLibraryBookList as _fetchLibraryBookList, deleteLibraryBook as _deleteLibraryBook } from "@retainpdf/api/library-books";
import { stripOcrSuffix } from "@retainpdf/api/utils/strip-ocr";

export const fetchJobPayload = async (jobId: string, options?: { apiPrefix?: string } | string): Promise<any> => {
  let normalizedJobId = jobId;
  let apiPrefix: string | undefined;
  if (typeof jobId === "string" && jobId.startsWith("/") && typeof options === "string" && options != null && !options.startsWith("/")) {
    console.warn("[deprecated] fetchJobPayload(apiPrefix, jobId) is deprecated, use fetchJobPayload(jobId, { apiPrefix })");
    apiPrefix = jobId;
    normalizedJobId = options;
  } else if (typeof options === "string") {
    console.warn("[deprecated] fetchJobPayload(jobId, apiPrefix) string form is deprecated, use fetchJobPayload(jobId, { apiPrefix })");
    apiPrefix = options;
  } else if (options && typeof options === "object") {
    apiPrefix = (options as { apiPrefix?: string }).apiPrefix;
  }
  if (isMockMode()) { void apiPrefix; return getMockJobPayload(normalizedJobId); }
  return (_fetchJobPayload as any)(normalizedJobId, apiPrefix ? { apiPrefix } : undefined);
};

export const fetchJobList = async (apiPrefix: string, opts: any = {}): Promise<any> => {
  if (isMockMode()) { void apiPrefix; void opts; return getMockJobList(); }
  return (_fetchJobList as any)(apiPrefix, opts);
};

export const fetchLibraryBookList = async (apiPrefix: string, opts: any = {}): Promise<any> => {
  if (isMockMode()) { const jobIds = Array.isArray(opts?.jobIds) ? opts.jobIds : []; return getMockJobList({ jobIds }); }
  return (_fetchLibraryBookList as any)(apiPrefix, opts);
};

export const deleteLibraryBook = async (apiPrefix: string, jobId: string, opts: any = {}): Promise<any> => {
  const normalizedJobId = stripOcrSuffix(`${jobId || ""}`);
  if (!normalizedJobId) throw new Error("删除失败: 缺少 job_id");
  if (isMockMode()) {
    const referenced = countMockFavoritesByJob(normalizedJobId);
    if (referenced > 0 && !opts?.force) {
      const conflict = new Error(`该 job 被 ${referenced} 条收藏引用(409)`) as Error & { status?: number };
      (conflict as any).status = 409;
      throw conflict;
    }
    return { job_id: normalizedJobId };
  }
  return (_deleteLibraryBook as any)(apiPrefix, jobId, opts);
};

// --- Remaining API groups: mock-aware wrappers delegating to @retainpdf/api for real network ---
// Import legacy (mock-aware) and canonical (pure) side-by-side; wrapper picks based on isMockMode.
import * as LegacyJobsEvents from "@/platform/api/legacy/jobs-events.js";
import { fetchJobEvents as _canonFetchJobEvents } from "@retainpdf/api/jobs-events";
export const fetchJobEvents = mockable(_canonFetchJobEvents, LegacyJobsEvents.fetchJobEvents);

import * as LegacyJobsArtifacts from "@/platform/api/legacy/jobs-artifacts.js";
import { fetchJobArtifacts as _canonFetchJobArtifacts, fetchJobArtifactsManifest as _canonFetchJobArtifactsManifest, fetchJobMarkdown as _canonFetchJobMarkdown, fetchJobMarkdownDocument as _canonFetchJobMarkdownDocument } from "@retainpdf/api/jobs-artifacts";
export type { JobArtifactLinks } from "@retainpdf/api/jobs-artifacts";
// Mock manifests already carry the complete artifact set; avoid a second
// network-shaped projection that the mock backend does not expose.
export const fetchJobArtifacts = mockable(_canonFetchJobArtifacts, () => null);
export const fetchJobArtifactsManifest = mockable(_canonFetchJobArtifactsManifest, LegacyJobsArtifacts.fetchJobArtifactsManifest);
export const fetchJobMarkdown = mockable(_canonFetchJobMarkdown, LegacyJobsArtifacts.fetchJobMarkdown);
export const fetchJobMarkdownDocument = mockable(_canonFetchJobMarkdownDocument, LegacyJobsArtifacts.fetchJobMarkdownDocument);

import * as LegacyJobsActions from "@/platform/api/legacy/jobs-actions.js";
import { cancelJob as _canonCancelJob, cancelOcrJob as _canonCancelOcrJob, fetchJobDiagnostics as _canonFetchJobDiagnostics, fetchJobStageActions as _canonFetchJobStageActions, fetchResumePlan as _canonFetchResumePlan, resolveOcrAmbiguity as _canonResolveOcrAmbiguity, resumeJob as _canonResumeJob, rerunJob as _canonRerunJob, retryJobStage as _canonRetryJobStage } from "@retainpdf/api/jobs-actions";
export type {
  JobRetryStage,
  JobStageActionsView,
  JobStageRetryActionView,
  JobDiagnosticsView,
  OcrAmbiguityReceiptField,
  OcrAmbiguityResolutionKind,
  OcrAmbiguityResolutionRequest,
  OcrAmbiguityResolutionView,
  OcrAmbiguityView,
} from "@retainpdf/api/jobs-actions";
export const fetchJobDiagnostics = mockable(_canonFetchJobDiagnostics, LegacyJobsActions.fetchJobDiagnostics);
export const fetchJobStageActions = mockable(_canonFetchJobStageActions, LegacyJobsActions.fetchJobStageActions);
export const fetchResumePlan = mockable(_canonFetchResumePlan, LegacyJobsActions.fetchResumePlan);
export const resumeJob = mockable(_canonResumeJob, LegacyJobsActions.resumeJob);
export const cancelJob = mockable(_canonCancelJob, LegacyJobsActions.cancelJob);
export const cancelOcrJob = mockable(_canonCancelOcrJob, LegacyJobsActions.cancelOcrJob);
export const resolveOcrAmbiguity = mockable(_canonResolveOcrAmbiguity, LegacyJobsActions.resolveOcrAmbiguity);
export const rerunJob = mockable(_canonRerunJob, LegacyJobsActions.rerunJob);
export const retryJobStage = mockable(_canonRetryJobStage, LegacyJobsActions.retryJobStage);

import * as LegacyJobsSubmit from "@/platform/api/legacy/jobs-submit.js";
import { submitJobRequest as _canonSubmitJobRequest } from "@retainpdf/api/jobs-submit";
export const submitJobRequest = mockable(_canonSubmitJobRequest, LegacyJobsSubmit.submitJobRequest);

import * as LegacyDocuments from "@/platform/api/legacy/documents.js";
import { fetchDocumentList as _canonFetchDocumentList, fetchDocument as _canonFetchDocument, fetchDocumentByJobId as _canonFetchDocumentByJobId, fetchDocumentJobs as _canonFetchDocumentJobs, ocrDocument as _canonOcrDocument, translateDocument as _canonTranslateDocument, deleteDocument as _canonDeleteDocument, patchDocument as _canonPatchDocument, createDocumentMetadataSuggestion as _canonCreateDocumentMetadataSuggestion, fetchDocumentMetadataSuggestions as _canonFetchDocumentMetadataSuggestions } from "@retainpdf/api/documents";
export const fetchDocumentList = mockable(_canonFetchDocumentList, LegacyDocuments.fetchDocumentList);
export const fetchDocumentByJobId = mockable(_canonFetchDocumentByJobId, LegacyDocuments.fetchDocumentByJobId);
export const fetchDocument = mockable(_canonFetchDocument, LegacyDocuments.fetchDocument);
export const translateDocument = mockable(_canonTranslateDocument, LegacyDocuments.translateDocument);
export const ocrDocument = mockable(_canonOcrDocument, LegacyDocuments.ocrDocument);
export const fetchDocumentJobs = mockable(_canonFetchDocumentJobs, LegacyDocuments.fetchDocumentJobs);
export const deleteDocument = mockable(_canonDeleteDocument, LegacyDocuments.deleteDocument);
export const patchDocument = mockable(_canonPatchDocument, LegacyDocuments.patchDocument);
export const createDocumentMetadataSuggestion = mockable(_canonCreateDocumentMetadataSuggestion, () => null);
export const fetchDocumentMetadataSuggestions = mockable(_canonFetchDocumentMetadataSuggestions, () => []);

import * as LegacyCollections from "@/platform/api/legacy/collections.js";
import { listCollections as _canonListCollections, createCollection as _canonCreateCollection, patchCollection as _canonPatchCollection, deleteCollection as _canonDeleteCollection, addDocumentsToCollection as _canonAddDocumentsToCollection, removeDocumentFromCollection as _canonRemoveDocumentFromCollection } from "@retainpdf/api/collections";
export const listCollections = mockable(_canonListCollections, LegacyCollections.listCollections);
export const createCollection = mockable(_canonCreateCollection, LegacyCollections.createCollection);
export const patchCollection = mockable(_canonPatchCollection, LegacyCollections.patchCollection);
export const deleteCollection = mockable(_canonDeleteCollection, LegacyCollections.deleteCollection);
export const addDocumentsToCollection = mockable(_canonAddDocumentsToCollection, LegacyCollections.addDocumentsToCollection);
export const removeDocumentFromCollection = mockable(_canonRemoveDocumentFromCollection, LegacyCollections.removeDocumentFromCollection);

import * as LegacyFavorites from "@/platform/api/legacy/favorites.js";
import { fetchFavorites as _canonFetchFavorites, createFavorite as _canonCreateFavorite, deleteFavorite as _canonDeleteFavorite } from "@retainpdf/api/favorites";
export const fetchFavorites = mockable(_canonFetchFavorites, LegacyFavorites.fetchFavorites);
export const createFavorite = mockable(_canonCreateFavorite, LegacyFavorites.createFavorite);
export const deleteFavorite = mockable(_canonDeleteFavorite, LegacyFavorites.deleteFavorite);

import * as LegacyProviders from "@/platform/api/legacy/providers.js";
import { validateDeepSeekToken as _canonValidateDeepSeekToken, queryDeepSeekBalance as _canonQueryDeepSeekBalance, validatePaddleToken as _canonValidatePaddleToken } from "@retainpdf/api/providers";
export const validateDeepSeekToken = mockable(_canonValidateDeepSeekToken, LegacyProviders.validateDeepSeekToken);
export const queryDeepSeekBalance = mockable(_canonQueryDeepSeekBalance, LegacyProviders.queryDeepSeekBalance);
export const validatePaddleToken = mockable(_canonValidatePaddleToken, LegacyProviders.validatePaddleToken);

import * as LegacyGlossaries from "@/platform/api/legacy/glossaries.js";
import { fetchGlossaries as _canonFetchGlossaries, fetchGlossary as _canonFetchGlossary, createGlossary as _canonCreateGlossary, updateGlossary as _canonUpdateGlossary, deleteGlossary as _canonDeleteGlossary, exportGlossaryCsv as _canonExportGlossaryCsv, parseGlossaryCsv as _canonParseGlossaryCsv } from "@retainpdf/api/glossaries";
export const fetchGlossariesApi = mockable(_canonFetchGlossaries, LegacyGlossaries.fetchGlossaries);
export const fetchGlossaryApi = mockable(_canonFetchGlossary, LegacyGlossaries.fetchGlossary);
export const createGlossaryApi = mockable(_canonCreateGlossary, LegacyGlossaries.createGlossary);
export const updateGlossaryApi = mockable(_canonUpdateGlossary, LegacyGlossaries.updateGlossary);
export const deleteGlossaryApi = mockable(_canonDeleteGlossary, LegacyGlossaries.deleteGlossary);
export const exportGlossaryCsvApi = mockable(_canonExportGlossaryCsv, LegacyGlossaries.exportGlossaryCsv);
export const parseGlossaryCsvApi = mockable(_canonParseGlossaryCsv, LegacyGlossaries.parseGlossaryCsv);

import * as LegacyTranslationDebug from "@/platform/api/legacy/translation-debug.js";
import { fetchTranslationDiagnostics as _canonFetchTranslationDiagnostics, fetchTranslationItems as _canonFetchTranslationItems, fetchTranslationItem as _canonFetchTranslationItem, replayTranslationItem as _canonReplayTranslationItem } from "@retainpdf/api/translation-debug";
export const fetchTranslationDiagnostics = mockable(_canonFetchTranslationDiagnostics, LegacyTranslationDebug.fetchTranslationDiagnostics);
export const fetchTranslationItems = mockable(_canonFetchTranslationItems, LegacyTranslationDebug.fetchTranslationItems);
export const fetchTranslationItem = mockable(_canonFetchTranslationItem, LegacyTranslationDebug.fetchTranslationItem);
export const replayTranslationItem = mockable(_canonReplayTranslationItem, LegacyTranslationDebug.replayTranslationItem);

import * as LegacyAi from "@/platform/api/legacy/ai.js";
import { askLibraryAi as _canonAskLibraryAi, readAiAskStream as _canonReadAiAskStream, AiAskError as _CanonAiAskError } from "@retainpdf/api/ai";
export const askLibraryAi = mockable(_canonAskLibraryAi, LegacyAi.askLibraryAi);
export const readAiAskStream = _canonReadAiAskStream;
export const AiAskError = _CanonAiAskError;

import {
  buildAgentOperationCandidateUrl as _canonBuildAgentOperationCandidateUrl,
  cancelAgentOperation as _canonCancelAgentOperation,
  commitAgentOperation as _canonCommitAgentOperation,
  fetchAgentOperationCandidate as _canonFetchAgentOperationCandidate,
  getAgentOperation as _canonGetAgentOperation,
  listAgentOperations as _canonListAgentOperations,
  retryAgentOperation as _canonRetryAgentOperation,
  runAgentOperation as _canonRunAgentOperation,
} from "@retainpdf/api/document-operations";

export const listAgentOperations = mockable(_canonListAgentOperations, () => ({ operations: [] }));
export const getAgentOperation = async (...args: Parameters<typeof _canonGetAgentOperation>): Promise<any> => (
  _canonGetAgentOperation(...args)
);
export const runAgentOperation = async (...args: Parameters<typeof _canonRunAgentOperation>): Promise<any> => (
  _canonRunAgentOperation(...args)
);
export const cancelAgentOperation = async (...args: Parameters<typeof _canonCancelAgentOperation>): Promise<any> => (
  _canonCancelAgentOperation(...args)
);
export const commitAgentOperation = async (...args: Parameters<typeof _canonCommitAgentOperation>): Promise<any> => (
  _canonCommitAgentOperation(...args)
);
export const retryAgentOperation = async (...args: Parameters<typeof _canonRetryAgentOperation>): Promise<any> => (
  _canonRetryAgentOperation(...args)
);
export const fetchAgentOperationCandidate = async (
  ...args: Parameters<typeof _canonFetchAgentOperationCandidate>
): Promise<Blob> => _canonFetchAgentOperationCandidate(...args);
export const buildAgentOperationCandidateUrl = _canonBuildAgentOperationCandidateUrl;

import * as LegacyConversations from "@/platform/api/legacy/conversations.js";
import { deleteConversation as _canonDeleteConversation, getConversation as _canonGetConversation, listConversations as _canonListConversations, patchConversation as _canonPatchConversation, createConversation as _canonCreateConversation, appendConversationMessage as _canonAppendConversationMessage, forkConversationFromPath as _canonForkConversationFromPath } from "@retainpdf/api/conversations";
export const deleteConversation = mockable(_canonDeleteConversation, LegacyConversations.deleteConversation);
export const getConversation = mockable(_canonGetConversation, LegacyConversations.getConversation);
export const listConversations = mockable(_canonListConversations, LegacyConversations.listConversations);
export const patchConversation = mockable(_canonPatchConversation, LegacyConversations.patchConversation);
export const createConversation = mockable(_canonCreateConversation, LegacyConversations.createConversation);
export const appendConversationMessage = mockable(_canonAppendConversationMessage, LegacyConversations.appendConversationMessage);
export const forkConversationFromPath = mockable(_canonForkConversationFromPath, LegacyConversations.forkConversationFromPath);
export { baseConversationTitle, nextForkConversationTitle, messagesToBranchItems } from "@retainpdf/api/conversations";
export type { ConversationRecord, MessageRecord, ConversationDetail } from "@retainpdf/api/conversations";
export type { DocumentRecord } from "@retainpdf/api/documents";

import * as LegacySearch from "@/platform/api/legacy/search.js";
import { searchLibrary as _canonSearchLibrary } from "@retainpdf/api/search";
export const searchLibrary = mockable(_canonSearchLibrary, LegacySearch.searchLibrary);
