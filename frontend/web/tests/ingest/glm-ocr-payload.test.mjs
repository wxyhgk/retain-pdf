// GLM-OCR（智谱）：任务里没有专用的 key 字段，内联 key 放进 ocr.options.credential；
// 没填自己的 key、翻译又是智谱时用翻译的 key（只做 OCR 的任务后端借不到，所以前端显式带上）；别家的翻译 key 不带。
import test from "node:test";
import assert from "node:assert/strict";

import { buildOcrPayload } from "../../src/features/ingest/domain/workflow/payload.js";
import { createWorkflowPayloadAssembly } from "../../src/features/ingest/domain/workflow/payload-assembly.js";
import { hasCompleteCredentials } from "../../src/features/credentials/domain/state-selectors.js";
import { hasDesktopCredentials } from "../../src/features/credentials/domain/desktop-readiness.js";
import { OCR_PROVIDER_DEFINITIONS, isZhipuBaseUrl } from "../../src/platform/config/providers.js";

const constants = { DEFAULT_MODEL_VERSION: "v", DEFAULT_LANGUAGE: "ch", WORKFLOW_BOOK: "book", WORKFLOW_TRANSLATE: "translate" };
const ZHIPU = "https://open.bigmodel.cn/api/paas/v4";

test("GLM-OCR 在服务商列表里，排在 paddle、mineru 后面", () => {
  assert.deepEqual(OCR_PROVIDER_DEFINITIONS.map((item) => item.id), ["paddle", "mineru", "glm_ocr"]);
  assert.equal(isZhipuBaseUrl(ZHIPU), true);
  assert.equal(isZhipuBaseUrl("https://open.bigmodel.cn.evil.example/v1"), false);
  assert.equal(isZhipuBaseUrl("https://dashscope.aliyuncs.com/compatible-mode/v1"), false);
});

test("GLM-OCR 的内联 key 放进 options.credential，不造 glm 专用字段；没 key 就什么都不带", () => {
  const withKey = buildOcrPayload({ ocrProvider: "glm_ocr", ocrToken: "zhipu-key", pageRanges: "1-3", defaultPaddleApiUrl: () => "", constants });
  assert.equal(withKey.provider, "glm_ocr");
  assert.deepEqual(withKey.options, { credential: "zhipu-key" });
  assert.equal(withKey.paddle_token, undefined);
  assert.equal(withKey[""], undefined, "没有专用字段时不能写出一个空名字的字段");
  const withoutKey = buildOcrPayload({ ocrProvider: "glm_ocr", ocrToken: "", defaultPaddleApiUrl: () => "", constants });
  assert.equal(withoutKey.options, undefined);
  const withRef = buildOcrPayload({ ocrProvider: "glm_ocr", ocrCredentialRef: "cred_glm", defaultPaddleApiUrl: () => "", constants });
  assert.equal(withRef.credential_ref, "cred_glm");
  assert.equal(withRef.options, undefined);
});

function assembly(baseUrl, submitValues) {
  return createWorkflowPayloadAssembly({
    constants,
    developerConfigWithDefaults: () => ({ workflow: "book", baseUrl }),
    isOcrOnlyMode: () => false,
    currentPageRanges: () => "",
    getUploadState: () => ({}),
    workflowNeedsUpload: () => true,
    workflowUsesRenderStage: () => true,
    defaultPaddleApiUrl: () => "",
    defaultOcrProvider: () => "glm_ocr",
    defaultPaddleToken: () => "",
    defaultModelApiKey: () => "",
    readSubmitValues: () => submitValues,
  });
}

test("没填 GLM 的 key、翻译是智谱：用翻译的 key；翻译是别家：不带", () => {
  const values = { ocrProvider: "glm_ocr", ocrToken: "", modelApiKey: "zhipu-translation-key" };
  assert.deepEqual(assembly(ZHIPU, values).buildOcrPayload("").options, { credential: "zhipu-translation-key" });
  assert.equal(assembly("https://api.deepseek.com/v1", values).buildOcrPayload("").options, undefined, "别家的翻译 key 不能发给智谱");
  const own = { ...values, ocrToken: "own-glm-key" };
  assert.deepEqual(assembly(ZHIPU, own).buildOcrPayload("").options, { credential: "own-glm-key" }, "自己的 key 优先");
});

test("配好了没有：GLM-OCR 没有自己的 key 时，有翻译凭据就算配好；paddle 照旧要自己的 token", () => {
  assert.equal(hasCompleteCredentials({ ocrProvider: "glm_ocr", modelApiKey: "k" }), true);
  assert.equal(hasCompleteCredentials({ ocrProvider: "glm_ocr" }), false);
  assert.equal(hasCompleteCredentials({ ocrProvider: "paddle", modelApiKey: "k" }), false);
  assert.equal(hasDesktopCredentials({ ocrProvider: "glm_ocr", modelApiKey: "k" }), true);
  assert.equal(hasDesktopCredentials({ ocrProvider: "glm_ocr", glmOcrToken: "g" }), false, "翻译没配照样不行");
});
