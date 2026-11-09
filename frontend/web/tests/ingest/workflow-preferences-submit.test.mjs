/** 用户偏好从「添加 PDF」弹窗一路到提交载荷：整张偏好表按表搬运，中间不逐个字段列。
 *
 * 以前一个选项要在 store、ui 窄口类型、app 两份类型、build-home-services、
 * create-workflow-upload、contracts、payload-assembly、payload 里各写一遍；
 * 漏一处，界面上能选、提交时却没带上，测试也不一定发现。这里从主页真实装配走一遍。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { makeDom, DOM_GLOBAL_KEYS } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";
import { waitFor } from "../helpers/async.mjs";
import { loadWorkflowPreferences } from "../../src/features/ingest/domain/workflow-preferences.js";

test("弹窗里改的偏好出现在提交载荷里", async () => {
  const dom = makeDom("?mock=parallel", { keys: [...DOM_GLOBAL_KEYS, "localStorage"] });
  const { services, root, host } = await bootHomeApp(dom);
  try {
    const workflowFeature = services.features.workflowFeature;
    assert.ok(workflowFeature?.collectRunPayload, "前提：主页装配出了工作流功能");

    services.workflowView.setPreference("translationQuality", "refined");
    services.workflowView.setPreference("renderEngine", "typst");
    services.workflowDialog.openUpload();
    services.stores.uploadView.actions.openTranslationOptions({ maxPage: 12 });
    const checkbox = await waitFor(() => document.getElementById("job-translate-tables"));
    assert.equal(checkbox.checked, false);
    checkbox.click();
    const payload = workflowFeature.collectRunPayload();
    assert.equal(payload.translation?.preparation, "editorial");
    assert.equal(payload.translation?.refine, "editorial");
    assert.equal(payload.render?.engine, "typst");
    assert.equal(payload.translation?.translate_tables, true);
    assert.equal(localStorage.getItem("retainpdf.translateTables"), "true");
    assert.equal(loadWorkflowPreferences().translateTables, true);
    checkbox.click();
    assert.equal(workflowFeature.collectRunPayload().translation?.translate_tables, false);

    services.workflowView.setPreference("renderEngine", "auto");
    assert.equal("engine" in (workflowFeature.collectRunPayload().render || {}), false, "默认不发 engine");
  } finally {
    root.unmount();
    services.dispose();
    host.remove();
  }
});
