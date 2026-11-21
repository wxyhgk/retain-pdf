/** 上传弹窗的附魔：页数短写（1 到最后一页算全部）、模型短名、叠了几层；普通 / Agent 对应翻译质量；选的模型只叠到上传提交上。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { modelLogo, pageRangeLabel, shortModelName } from "../../src/features/ingest/ui/components/upload/UploadEnchantControls.tsx";
import { EnchantedFile, enchantLevel } from "../../src/features/ingest/ui/components/upload/EnchantedFile.tsx";
import { isAgentTranslation, qualityForEngine } from "../../src/features/ingest/domain/workflow-preferences.ts";
import { createWorkflowPayloadAssembly } from "../../src/features/ingest/domain/workflow/payload-assembly.ts";
import { createWorkflowViewFeature } from "../../src/features/ingest/domain/workflow-view-store.ts";
import { ocrReadyFor } from "../../src/features/credentials/domain/state-selectors.ts";

test("页数短写：没填、或 1 到最后一页都算全部页；其余写成 1–10 页 / 第 3 页 / 12 页起", () => {
  assert.equal(pageRangeLabel("", ""), "");
  assert.equal(pageRangeLabel("1", "24", 24), "", "上传完自动填的 1–24 算全部");
  assert.equal(pageRangeLabel("1", "10", 24), "1–10 页");
  assert.equal(pageRangeLabel("3", "3", 24), "第 3 页");
  assert.equal(pageRangeLabel("12", "", 24), "12 页起");
  assert.equal(pageRangeLabel("1", "10", 0), "1–10 页", "还不知道总页数时照写");
  assert.equal(shortModelName("anthropic/claude-haiku-5-5"), "claude-haiku-5-5");
});

test("普通 / Agent：Agent = refined；点普通回 standard，原来是统一术语就留着", () => {
  assert.equal(qualityForEngine("agent", "terms"), "refined");
  assert.equal(qualityForEngine("standard", "refined"), "standard");
  assert.equal(qualityForEngine("standard", "terms"), "terms");
  assert.equal(isAgentTranslation("refined"), true);
});

test("文件卡片：只写文件名；每选一项叠一层（模型印记、Agent 光环、页数书签），叠了几层写在 data-level", () => {
  assert.equal(enchantLevel({}), 0);
  assert.equal(enchantLevel({ model: "claude-haiku-5-5", agent: true, pages: "1–10 页" }), 3);
  const bare = renderToStaticMarkup(createElement(EnchantedFile, { name: "a.pdf", enchants: {} }));
  assert.match(bare, /data-level="0"/);
  assert.doesNotMatch(bare, /upload-file-(aura|sigil|ribbon|sheets)/);
  const full = renderToStaticMarkup(createElement(EnchantedFile, { name: "a.pdf", enchants: { model: "claude-haiku-5-5", agent: true, pages: "1–10 页" } }));
  for (const layer of ["upload-file-aura", "upload-file-sigil", "upload-file-ribbon", "upload-file-sheets", "upload-file-agent", "upload-file-flash"]) {
    assert.match(full, new RegExp(layer), layer);
  }
  assert.match(full, /data-level="3"/);
  assert.match(full, />claude-haiku-5-5</);
  assert.match(full, /1–10 页/);
});

test("选的模型只叠到上传提交（collectRunPayload）上：整套换掉、带了 key 就不带 credential_ref；书库翻译整本不受影响", () => {
  const constants = { WORKFLOW_BOOK: "book", WORKFLOW_TRANSLATE: "translate", WORKFLOW_RENDER: "render", DEFAULT_MODE: "sci", DEFAULT_RULE_PROFILE: "general_sci", DEFAULT_MODEL_VERSION: "v", DEFAULT_TIMEOUT_SECONDS: 1 };
  const assembly = (override) => createWorkflowPayloadAssembly({
    constants,
    developerConfigWithDefaults: () => ({ workflow: "book", model: "qwen3.8-flash", baseUrl: "https://qwen", apiProtocol: "openai_responses", thinking: "off", mathMode: "direct_typst" }),
    isOcrOnlyMode: () => false,
    currentPageRanges: () => "1-10",
    getUploadState: () => ({ uploadId: "u1" }),
    workflowNeedsUpload: () => true,
    workflowUsesRenderStage: () => false,
    defaultPaddleApiUrl: () => "",
    defaultOcrProvider: () => "paddle",
    defaultPaddleToken: () => "",
    defaultModelApiKey: () => "",
    readSubmitValues: () => ({ translationCredentialRef: "cred-1", preferences: { translationQuality: "standard", renderEngine: "auto" } }),
    uploadTranslationOverride: override,
  });
  const plain = assembly(() => null).collectRunPayload();
  assert.equal(plain.translation.model, "qwen3.8-flash");
  assert.equal(plain.translation.credential_ref, "cred-1");
  const chosen = assembly(() => ({ base_url: "https://anthropic", model: "claude-haiku-5-5", api_key: "k", api_protocol: "anthropic_messages", thinking: "off" }));
  const run = chosen.collectRunPayload();
  assert.equal(run.translation.model, "claude-haiku-5-5");
  assert.equal(run.translation.base_url, "https://anthropic");
  assert.equal(run.translation.api_key, "k");
  assert.equal("credential_ref" in run.translation, false);
  assert.equal(chosen.buildTranslateJobConfig("").translation.model, "qwen3.8-flash", "书库「翻译整本」照旧用设置里的");
});

test("OCR 也是一项附魔：文件图标角上嵌那家的徽章、扫描线；四项都选 data-level=4", () => {
  const ocr = { label: "MinerU", logo: { src: "src/assets/providers/mineru.svg", mono: true, name: "MinerU" } };
  assert.equal(enchantLevel({ model: "m", agent: true, ocr, pages: "1–10 页" }), 4);
  const html = renderToStaticMarkup(createElement(EnchantedFile, { name: "a.pdf", enchants: { ocr } }));
  assert.match(html, /data-ocr="true"/);
  assert.match(html, /upload-file-ocr/);
  assert.match(html, /OCR：MinerU/);
  assert.match(html, /mineru\.svg/);
  const model = renderToStaticMarkup(createElement(EnchantedFile, {
    name: "a.pdf",
    enchants: { model: "claude-haiku-5-5", modelLogo: modelLogo("claude-haiku-5-5") },
  }));
  assert.match(model, /upload-file-sigil-logo/, "模型印记带标志");
});

test("模型标志：先认模型家族，认不出按接口地址认厂商，都不认得是 null", () => {
  assert.match(modelLogo("claude-haiku-5-5")?.src || "", /claude/);
  assert.match(modelLogo("qwen3.8-flash")?.src || "", /qwen/);
  assert.match(modelLogo("my-model", "https://api.deepseek.com/v1")?.src || "", /deepseek/);
  assert.equal(modelLogo("my-model", "https://example.com"), null);
});

test("这次选的 OCR：没设好的灰掉、不会被用上；选回默认那家不算；新开一次上传回到设置里的", () => {
  const ready = new Set(["paddle", "mineru"]);
  const view = createWorkflowViewFeature({ ocrReady: (id) => ready.has(id), settingsOcrProvider: () => "paddle" });
  const choices = view.uploadOcrChoices();
  assert.deepEqual(choices.map((choice) => [choice.id, choice.ready, choice.isDefault]), [
    ["paddle", true, true],
    ["mineru", true, false],
    ["glm_ocr", false, false],
  ]);
  assert.ok(choices.every((choice) => choice.logo), "三家都有标志");
  assert.equal(view.uploadOcrProvider(), "");
  view.setUploadOcr("MinerU");
  assert.equal(view.store.getSnapshot().uploadOcr, "mineru");
  assert.equal(view.uploadOcrProvider(), "mineru");
  assert.equal(view.viewPort.uploadOcrProvider(), "mineru");
  view.setUploadOcr("glm_ocr");
  assert.equal(view.uploadOcrProvider(), "", "没设好的那家不用");
  view.setUploadModel("anthropic::claude-haiku-5-5");
  view.setUploadOcr("mineru");
  view.resetUploadChoices();
  assert.equal(view.store.getSnapshot().uploadModel, "");
  assert.equal(view.store.getSnapshot().uploadOcr, "");
});

test("OCR 能不能用：有自己的 Token；或是设置里那家、存的凭据库引用；或 GLM-OCR 借翻译的 key", () => {
  const base = { ocrProvider: "paddle", paddleToken: "", mineruToken: "", glmOcrToken: "", ocrCredentialRef: "", modelApiKey: "", translationCredentialRef: "" };
  assert.equal(ocrReadyFor({ ...base, mineruToken: "m" }, { providerId: "mineru" }), true);
  assert.equal(ocrReadyFor(base, { providerId: "mineru" }), false);
  assert.equal(ocrReadyFor({ ...base, ocrCredentialRef: "ref" }, { providerId: "paddle" }), true);
  assert.equal(ocrReadyFor({ ...base, ocrCredentialRef: "ref" }, { providerId: "mineru" }), false, "引用只属于设置里那家");
  assert.equal(ocrReadyFor(base, { providerId: "paddle", defaultPaddleToken: () => "env" }), true);
  assert.equal(ocrReadyFor({ ...base, modelApiKey: "k" }, { providerId: "glm_ocr" }), true);
  assert.equal(ocrReadyFor(base, { providerId: "glm_ocr" }), false);
});

test("选的 OCR 只给上传提交：collectRunPayload 换成那家和它的 Token；书库「翻译整本」「只做 OCR」照设置里的", () => {
  const constants = { WORKFLOW_BOOK: "book", WORKFLOW_TRANSLATE: "translate", WORKFLOW_RENDER: "render", DEFAULT_MODE: "sci", DEFAULT_RULE_PROFILE: "general_sci", DEFAULT_MODEL_VERSION: "v", DEFAULT_TIMEOUT_SECONDS: 1 };
  const tokens = { paddle: "p-token", mineru: "m-token" };
  const assembly = createWorkflowPayloadAssembly({
    constants,
    developerConfigWithDefaults: () => ({ workflow: "book", model: "qwen3.8-flash", baseUrl: "https://qwen", apiProtocol: "openai_responses", thinking: "off", mathMode: "direct_typst" }),
    isOcrOnlyMode: () => false,
    currentPageRanges: () => "",
    getUploadState: () => ({ uploadId: "u1" }),
    workflowNeedsUpload: () => true,
    workflowUsesRenderStage: () => false,
    defaultPaddleApiUrl: () => "",
    defaultOcrProvider: () => "paddle",
    defaultPaddleToken: () => "",
    defaultModelApiKey: () => "",
    readSubmitValues: ({ ocrProvider } = {}) => {
      const provider = ocrProvider || "paddle";
      return { ocrProvider: provider, ocrToken: tokens[provider], translationCredentialRef: "cred-1", preferences: { translationQuality: "standard", renderEngine: "auto" } };
    },
    uploadOcrProvider: () => "mineru",
  });
  const run = assembly.collectRunPayload();
  assert.equal(run.ocr.provider, "mineru");
  assert.equal(run.ocr.mineru_token, "m-token");
  assert.equal(assembly.buildTranslateJobConfig("").ocr.provider, "paddle");
  assert.equal(assembly.buildOcrJobConfig("").ocr.provider, "paddle");
});
