/** 上传弹窗的「普通翻译 / Agent 翻译」：和选项里「翻译质量」同一个设置；选 Agent 出三项提示（质量、速度、token），主按钮跟着变。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { UploadEngineChoice, isAgentTranslation, qualityForEngine } from "../../src/features/ingest/ui/components/upload/UploadEngineChoice.tsx";
import { ProcessingChoicePanel } from "../../src/features/ingest/ui/components/upload/ProcessingChoicePanel.tsx";
import { UPLOAD_FLOW_STEPS } from "../../src/features/ingest/ui/components/upload/UploadFlowStrip.tsx";

test("点哪个 → 翻译质量：Agent = refined；点普通从 Agent 回到 standard，原来是「统一术语」就留着", () => {
  assert.equal(qualityForEngine("agent", "standard"), "refined");
  assert.equal(qualityForEngine("agent", "terms"), "refined");
  assert.equal(qualityForEngine("standard", "refined"), "standard");
  assert.equal(qualityForEngine("standard", "terms"), "terms");
  assert.equal(isAgentTranslation("refined"), true);
  assert.equal(isAgentTranslation("terms"), false);
});

test("选 Agent 才出提示：质量大幅提升、速度很慢、消耗大量 token", () => {
  const plain = renderToStaticMarkup(createElement(UploadEngineChoice, { quality: "standard", onChange() {} }));
  assert.match(plain, /普通翻译/);
  assert.match(plain, /Agent 翻译/);
  assert.doesNotMatch(plain, /upload-engine-notes/);
  const agent = renderToStaticMarkup(createElement(UploadEngineChoice, { quality: "refined", onChange() {} }));
  for (const text of ["质量大幅提升", "速度很慢", "消耗大量 token"]) assert.match(agent, new RegExp(text));
  assert.match(agent, /data-engine="agent"[^>]*data-state="active"|data-state="active"[^>]*data-engine="agent"/);
});

test("流程条和主按钮跟着 Agent 变；仅 OCR、渲染等别的工作流不变", () => {
  assert.deepEqual(UPLOAD_FLOW_STEPS.agent.map((step) => step.label), ["上传 PDF", "识别版面", "Agent 翻译", "译文 PDF"]);
  const props = {
    visible: true, uploadReady: true, submitBusy: false, submitDisabled: false, submitLabel: "直接翻译", ocrOnly: false,
    pageRangeButtonVisible: true, pageRangeOpen: false, onToggleTranslationOptions() {}, onStoreOnly() {}, translationOptionsSlot: null,
  };
  assert.match(renderToStaticMarkup(createElement(ProcessingChoicePanel, { ...props, agent: true })), /Agent 翻译/);
  assert.match(renderToStaticMarkup(createElement(ProcessingChoicePanel, { ...props, agent: false })), /直接翻译/);
  assert.match(renderToStaticMarkup(createElement(ProcessingChoicePanel, { ...props, agent: true, ocrOnly: true })), /开始 OCR/);
  assert.match(renderToStaticMarkup(createElement(ProcessingChoicePanel, { ...props, agent: true, submitLabel: "开始渲染" })), /开始渲染/);
});
