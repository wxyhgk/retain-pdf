// 「精翻」= 翻译 agent（translation.engine=agent）。2026-11-18 起去掉了单独的「翻译引擎」下拉和现有流程上的
// 编辑部精翻（preparation=editorial、refine=editorial）。agent 自带通读和审校，所以发 agent 时不带
// preparation / refine（带了后端会照跑一遍，重复花钱）；三种接口协议都能用。

import test from "node:test";
import assert from "node:assert/strict";

import { buildTranslationPayload, translationQualityFields } from "../../src/features/ingest/domain/workflow/payload.js";
import { summarizeTranslationEngine } from "../../src/features/job-detail/domain/page/summary.js";
import { waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom } from "../helpers/dom.mjs";
import { bootHomeApp, createTestHomeComposition } from "../helpers/home-app.mjs";

const constants = { DEFAULT_MODE: "full", DEFAULT_RULE_PROFILE: "retain-layout" };
const base = (apiProtocol) => ({
  developerConfig: { model: "claude-haiku-5-5", baseUrl: "https://api.anthropic.com/v1", apiProtocol },
  translationCredentialRef: "cred_translation",
  selectedGlossaryId: "",
  constants,
});

test("普通、统一术语不发 engine；精翻发 engine=agent，哪种协议都一样，不带 preparation / refine", () => {
  const standard = buildTranslationPayload(base("anthropic"));
  assert.equal("engine" in standard, false);
  assert.equal(buildTranslationPayload({ ...base("openai"), preferences: { translationQuality: "terms" } }).engine, undefined);
  assert.deepEqual(translationQualityFields("bogus"), {});
  for (const protocol of ["anthropic", "openai", "openai_responses"]) {
    const refined = buildTranslationPayload({ ...base(protocol), preferences: { translationQuality: "refined" } });
    assert.equal(refined.engine, "agent", `${protocol} 下精翻发 agent`);
    assert.equal("preparation" in refined, false);
    assert.equal("refine" in refined, false);
  }
  // 以前存过的「翻译引擎」偏好不再起作用。
  assert.equal("engine" in buildTranslationPayload({ ...base("anthropic"), preferences: { translationEngine: "agent" } }), false);
});

test("任务详情：旧任务算现有流程，不翻译的任务显示 -", () => {
  assert.equal(summarizeTranslationEngine({ request_payload: { translation: { engine: "agent" } } }), "翻译 agent");
  assert.equal(summarizeTranslationEngine({ request_payload: { translation: { model: "m" } } }), "现有流程");
  assert.equal(summarizeTranslationEngine({ request_payload: { ocr: {} } }), "-");
  assert.equal(summarizeTranslationEngine({}), "-");
});

async function openOptions(apiProtocol) {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const services = await createTestHomeComposition({ loadPersistedDeveloperConfig: () => ({ apiProtocol }) });
  const app = await bootHomeApp(dom, { services });
  clickWithMouseDown(dom, byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "添加对话框打开");
  app.services.stores.uploadView.actions.patch({ ready: true, actionSlotVisible: true });
  await waitFor(() => byId("page-range-btn"), "翻译选项开关按钮出现");
  clickWithMouseDown(dom, byId("page-range-btn"));
  await waitFor(() => byId("job-translation-quality"), "翻译质量下拉出现");
  const close = () => {
    app.root.unmount();
    app.services.dispose();
    app.host.remove();
  };
  return { ...app, byId, close };
}

test("翻译选项：没有单独的「翻译引擎」下拉；选精翻提示是翻译 agent，提交带 engine=agent", async () => {
  const { services, byId, close } = await openOptions("openai_responses");
  try {
    assert.equal(byId("job-translation-engine"), null, "翻译引擎下拉去掉了");
    const quality = byId("job-translation-quality");
    assert.equal(quality.disabled, false);
    assert.match(quality.querySelector('option[value="refined"]').textContent, /翻译 agent/);
    services.workflowView.setPreference("translationQuality", "refined");
    await waitFor(() => byId("job-translation-quality").value === "refined", "下拉显示精翻");
    assert.match(byId("job-translation-quality-hint").textContent, /翻译 agent/);
    const payload = services.features.workflowFeature.collectRunPayload();
    assert.equal(payload.translation?.engine, "agent");
    assert.equal("preparation" in (payload.translation || {}), false);
  } finally {
    services.workflowView.setPreference("translationQuality", "standard");
    close();
  }
});
