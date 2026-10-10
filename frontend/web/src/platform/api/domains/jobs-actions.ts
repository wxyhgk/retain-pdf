import * as MockJobsActions from "../mocks/jobs-actions.js";
import {
  cancelJob as _canonCancelJob,
  cancelOcrJob as _canonCancelOcrJob,
  fetchJobDiagnostics as _canonFetchJobDiagnostics,
  fetchJobStageActions as _canonFetchJobStageActions,
  fetchResumePlan as _canonFetchResumePlan,
  resolveOcrAmbiguity as _canonResolveOcrAmbiguity,
  resumeJob as _canonResumeJob,
  rerunJob as _canonRerunJob,
  retryJobStage as _canonRetryJobStage,
} from "@retainpdf/api/jobs-actions";
import { mockable } from "./_mockable.js";
import { API_PREFIX } from "../../config/api-constants.js";
import { createTranslationSecretInjector, jobIdFromActionUrl } from "../translation-secret.js";

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

export const fetchJobDiagnostics = mockable(_canonFetchJobDiagnostics, MockJobsActions.fetchJobDiagnostics);
export const fetchJobStageActions = mockable(_canonFetchJobStageActions, MockJobsActions.fetchJobStageActions);
export const fetchResumePlan = mockable(_canonFetchResumePlan, MockJobsActions.fetchResumePlan);
// 重跑类请求带上设置里当前的翻译密钥（换了 Key 之后不再沿用原任务那把），见 translation-secret.ts。
const injectTranslationSecret = createTranslationSecretInjector();

async function resumeJobWithCurrentKey(jobId: string, apiPrefix?: string, body: Record<string, unknown> = {}) {
  return _canonResumeJob(jobId, apiPrefix, await injectTranslationSecret(jobId, apiPrefix, body));
}

async function rerunJobWithCurrentKey(actionUrl: string, body: Record<string, unknown> = {}) {
  return _canonRerunJob(actionUrl, await injectTranslationSecret(jobIdFromActionUrl(actionUrl), API_PREFIX, body));
}

async function retryJobStageWithCurrentKey(
  jobId: string,
  apiPrefix: string | undefined,
  stage: string,
  payload: Record<string, unknown> = {},
) {
  return _canonRetryJobStage(jobId, apiPrefix, stage, await injectTranslationSecret(jobId, apiPrefix, payload));
}

export const resumeJob = mockable(resumeJobWithCurrentKey, MockJobsActions.resumeJob);
export const cancelJob = mockable(_canonCancelJob, MockJobsActions.cancelJob);
export const cancelOcrJob = mockable(_canonCancelOcrJob, MockJobsActions.cancelOcrJob);
export const resolveOcrAmbiguity = mockable(_canonResolveOcrAmbiguity, MockJobsActions.resolveOcrAmbiguity);
export const rerunJob = mockable(rerunJobWithCurrentKey, MockJobsActions.rerunJob);
export const retryJobStage = mockable(retryJobStageWithCurrentKey, MockJobsActions.retryJobStage);
