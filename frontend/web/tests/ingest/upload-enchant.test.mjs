/** 上传弹窗的附魔：页数短写（1 到最后一页算全部）、模型短名、叠了几层；普通 / Agent 对应翻译质量；选的模型只叠到上传提交上。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { pageRangeLabel, shortModelName } from "../../src/features/ingest/ui/components/upload/UploadEnchantControls.tsx";
import { EnchantedFile, enchantLevel } from "../../src/features/ingest/ui/components/upload/EnchantedFile.tsx";
import { isAgentTranslation, qualityForEngine } from "../../src/features/ingest/domain/workflow-preferences.ts";
import { createWorkflowPayloadAssembly } from "../../src/features/ingest/domain/workflow/payload-assembly.ts";

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
