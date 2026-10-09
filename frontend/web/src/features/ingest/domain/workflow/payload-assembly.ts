// 运行载荷组装：把当前工作流 + 开发者配置 + 凭据值拼成后端需要的
// ocr / translation / render 载荷，以及文档级 OCR/翻译复用配置。
//
// 纯组装，不读 DOM；所有可变输入经注入的 getter。

import {
  buildOcrPayload as buildOcrPayloadRequest,
  buildRenderPayload as buildRenderPayloadRequest,
  buildSourcePayload as buildSourcePayloadRequest,
  buildTranslationPayload as buildTranslationPayloadRequest,
  type WorkflowDeveloperConfig,
} from "./payload.js";
import type { WorkflowConstants, WorkflowRunPayload, WorkflowSubmitValues } from "./contracts.js";

export interface CreateWorkflowPayloadAssemblyOptions {
  constants: WorkflowConstants;
  developerConfigWithDefaults: () => WorkflowDeveloperConfig & { workflow: string };
  isOcrOnlyMode: () => boolean;
  currentPageRanges: () => string;
  getUploadState: () => { uploadId?: string; uploadedPageCount?: number };
  workflowNeedsUpload: (workflow?: string) => boolean;
  workflowUsesRenderStage: (workflow?: string) => boolean;
  defaultPaddleApiUrl: () => string;
  defaultOcrProvider: () => string;
  defaultPaddleToken: () => string;
  defaultModelApiKey: () => string;
  readSubmitValues?: (options?: {
    defaultOcrProvider?: string;
    defaultPaddleToken?: string;
    defaultModelApiKey?: string;
  }) => WorkflowSubmitValues;
}

export function createWorkflowPayloadAssembly({
  constants,
  developerConfigWithDefaults,
  isOcrOnlyMode,
  currentPageRanges,
  getUploadState,
  workflowNeedsUpload,
  workflowUsesRenderStage,
  defaultPaddleApiUrl,
  defaultOcrProvider,
  defaultPaddleToken,
  defaultModelApiKey,
  readSubmitValues,
}: CreateWorkflowPayloadAssemblyOptions) {
  const { WORKFLOW_BOOK, WORKFLOW_TRANSLATE } = constants;
  const WORKFLOW_OCR = (constants as { WORKFLOW_OCR?: string }).WORKFLOW_OCR || "ocr";

  function currentWorkflowSubmitValues(): WorkflowSubmitValues {
    return readSubmitValues?.({
      defaultOcrProvider: defaultOcrProvider(),
      defaultPaddleToken: defaultPaddleToken(),
      defaultModelApiKey: defaultModelApiKey(),
    }) || {};
  }

  function buildOcrPayload(
    pageRanges: string | undefined,
    submitValues: WorkflowSubmitValues = currentWorkflowSubmitValues(),
  ) {
    return buildOcrPayloadRequest({
      pageRanges,
      ocrProvider: submitValues.ocrProvider,
      ocrCredentialRef: submitValues.ocrCredentialRef,
      ocrToken: submitValues.ocrToken,
      defaultPaddleApiUrl,
      constants,
    });
  }

  function buildTranslationPayload(
    developerConfig: WorkflowDeveloperConfig,
    submitValues: WorkflowSubmitValues = currentWorkflowSubmitValues(),
  ) {
    return buildTranslationPayloadRequest({
      developerConfig,
      translationCredentialRef: submitValues.translationCredentialRef,
      modelApiKey: submitValues.modelApiKey,
      selectedGlossaryId: submitValues.selectedGlossaryId,
      preferences: submitValues.preferences,
      constants,
    });
  }

  function buildRenderPayload(
    developerConfig: WorkflowDeveloperConfig,
    submitValues: WorkflowSubmitValues = currentWorkflowSubmitValues(),
  ) {
    return buildRenderPayloadRequest({
      developerConfig,
      preferences: submitValues.preferences,
      constants,
    });
  }

  // 馆藏文档“翻译整本/选定页码”(F5)复用主流程的凭据组装:从当前已配置的
  // 凭据(credentialsStatePort,与对话框是否打开无关——readSubmitValues 读的是
  // 凭据 state 而非弹窗 DOM)拼出所选 OCR 提供商 + 翻译模型配置。
  // 不含 source——后端会从文档已存的 upload 注入 upload_id。pageRanges 缺省
  // 空串=整本。
  // 刻意不读 isOcrOnlyMode()：那是**上传弹窗**的 Tab 状态，而本函数服务的是
  // 详情页「翻译整本 / 翻译选定页码」。两者互不相干，调用方自己在
  // create-library-domain.ts 里选 buildTranslateConfig 还是 buildOcrConfig，
  // 要 OCR-only 的路径走下面的 buildOcrJobConfig。
  //
  // 此前这里有一个 isOcrOnlyMode() 分支会整段丢掉 translation：用户只要在
  // 「添加」弹窗点过 OCR Tab 再关掉弹窗（当时关闭与重开都不重置 ocrOnly；重开
  // 时的复位是后来才补上的，见 translation-workflow-dialog-runtime 的
  // processingChoicePort），之后任何一本书的「翻译整本」都会少发
  // model/base_url/api_key，被后端 job_validation.rs 以 "base_url is required"
  // 拒掉——而前端的凭据类错误文案正则匹配不到这串英文，用户看到的是
  // 「凭据已配好却说缺 base_url」，且毫无线索指向上一次的弹窗操作。
  function buildTranslateJobConfig(pageRanges = "") {
    const developerConfig = developerConfigWithDefaults();
    const submitValues = currentWorkflowSubmitValues();
    return {
      ocr: buildOcrPayload(pageRanges, submitValues),
      translation: buildTranslationPayload(developerConfig, submitValues),
    };
  }

  // 馆藏文档 OCR-only：只复用 OCR 凭据，不携带翻译模型配置。
  // source.upload_id 由文档级后端接口安全注入。
  function buildOcrJobConfig(pageRanges = "") {
    return {
      workflow: WORKFLOW_OCR,
      ocr: buildOcrPayload(pageRanges, currentWorkflowSubmitValues()),
    };
  }

  function collectRunPayload(): WorkflowRunPayload {
    const pageRanges = currentPageRanges();
    const developerConfig = developerConfigWithDefaults();
    const ocrOnly = isOcrOnlyMode();
    const workflow = ocrOnly ? WORKFLOW_OCR : developerConfig.workflow;
    const uploadState = getUploadState();
    const submitValues = currentWorkflowSubmitValues();
    const effectiveNeedsUpload = ocrOnly ? () => true : workflowNeedsUpload;
    const payload: WorkflowRunPayload = {
      workflow,
      source: buildSourcePayloadRequest({
        workflow,
        developerConfig,
        uploadId: uploadState.uploadId,
        workflowNeedsUpload: effectiveNeedsUpload,
      }),
      runtime: {
        job_id: "",
        timeout_seconds: developerConfig.timeoutSeconds,
        no_output_timeout_seconds: 0,
      },
    };
    if (ocrOnly) {
      payload.ocr = buildOcrPayload(pageRanges, submitValues);
      return payload;
    }
    if (workflow === WORKFLOW_BOOK || workflow === WORKFLOW_TRANSLATE) {
      payload.ocr = buildOcrPayload(pageRanges, submitValues);
      payload.translation = buildTranslationPayload(developerConfig, submitValues);
    }
    if (workflowUsesRenderStage(workflow)) {
      payload.render = buildRenderPayload(developerConfig, submitValues);
    }
    return payload;
  }

  return {
    currentWorkflowSubmitValues,
    buildOcrPayload,
    buildTranslationPayload,
    buildRenderPayload,
    buildTranslateJobConfig,
    buildOcrJobConfig,
    collectRunPayload,
  };
}
