// 「翻译引擎」选项（translation.engine）：现有流程 / 翻译 agent。
//
// 两条后端规矩决定了这里的写法：
//   1. agent 只认 anthropic 协议，别的协议发 engine=agent 会被 400 拒；
//   2. agent 自带通读和审校，同一个请求里再发 preparation / refine，后端会照跑一遍，重复花钱。
// 所以 agent 只在 anthropic 协议下发，发的时候不带翻译质量的字段；现有流程一个新字段都不发。

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTranslationPayload,
  translationEngineFields,
} from "../../src/features/ingest/domain/workflow/payload.js";
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

test("现有流程不发 engine，请求和以前逐字相同", () => {
  const legacy = buildTranslationPayload(base("anthropic"));
  assert.equal("engine" in legacy, false);
  assert.deepEqual(buildTranslationPayload({ ...base("anthropic"), preferences: { translationEngine: "legacy" } }), legacy);
  assert.deepEqual(translationEngineFields("bogus", "anthropic"), {});
});

test("agent 只在 anthropic 协议下发，并且不带翻译质量的字段", () => {
  const agent = buildTranslationPayload({
    ...base("anthropic"),
    preferences: { translationEngine: "agent", translationQuality: "refined" },
  });
  assert.equal(agent.engine, "agent");
  assert.equal("preparation" in agent, false, "agent 自带通读，不再发 preparation");
  assert.equal("refine" in agent, false, "agent 自带审校，不再发 refine");

  // 偏好存的是 agent，但协议换成了 openai：按现有流程发，翻译质量照常生效。
  const fallback = buildTranslationPayload({
    ...base("openai"),
    preferences: { translationEngine: "agent", translationQuality: "refined" },
  });
  assert.equal("engine" in fallback, false);
  assert.equal(fallback.preparation, "editorial");
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
  await waitFor(() => byId("job-translation-engine"), "翻译引擎下拉出现");
  const close = () => {
    app.root.unmount();
    app.services.dispose();
    app.host.remove();
  };
  return { ...app, byId, close };
}

test("协议不是 anthropic：agent 选项灰掉，提示去换协议", async () => {
  const { byId, close } = await openOptions("openai");
  try {
    const select = byId("job-translation-engine");
    assert.equal(select.value, "legacy");
    assert.equal(select.querySelector('option[value="agent"]').disabled, true);
    assert.match(byId("job-translation-engine-hint").textContent, /Anthropic/);
    assert.equal(byId("job-translation-quality").disabled, false);
  } finally {
    close();
  }
});

test("anthropic 协议选 agent：翻译质量灰掉，提交载荷带 engine=agent", async () => {
  const { services, byId, close } = await openOptions("anthropic");
  try {
    services.workflowView.setPreference("translationQuality", "terms");
    services.workflowView.setPreference("translationEngine", "agent");
    await waitFor(() => byId("job-translation-engine").value === "agent", "下拉显示翻译 agent");
    assert.equal(byId("job-translation-quality").disabled, true);
    assert.match(byId("job-translation-quality-hint").textContent, /自带通读和审校/);

    const payload = services.features.workflowFeature.collectRunPayload();
    assert.equal(payload.translation?.engine, "agent");
    assert.equal("preparation" in (payload.translation || {}), false);
  } finally {
    services.workflowView.setPreference("translationEngine", "legacy");
    services.workflowView.setPreference("translationQuality", "standard");
    close();
  }
});
