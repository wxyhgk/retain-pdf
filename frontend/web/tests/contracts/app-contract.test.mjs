// 全局 retainpdf:* 事件名与对话框根 id 的集中登记（platform/contracts/app-contract）。
// 原在 library/recent-jobs.test.mjs 里，但它测的是跨页面的应用契约，归到 contracts/。

import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_DIALOG_BACKDROP_IDS,
  APP_DIALOG_IDS,
  APP_EVENTS,
  APP_SHELL_IDS,
} from "@/platform/contracts/app-contract.js";

test("app contract centralizes global retainpdf events and dialog roots", () => {
  assert.deepEqual(
    Object.values(APP_EVENTS).filter((value) => value.startsWith("retainpdf:")).sort(),
    [
      "retainpdf:close-translation-workflow",
      "retainpdf:library-job-created",
      "retainpdf:library-job-updated",
      "retainpdf:library-refresh-requested",
      "retainpdf:open-browser-credentials",
      "retainpdf:open-reader-requested",
      "retainpdf:open-translation-workflow",
      "retainpdf:retry-stage",
      "retainpdf:return-home",
      "retainpdf:status-area-visibility-changed",
    ],
  );
  assert.deepEqual(APP_DIALOG_BACKDROP_IDS, [
    APP_DIALOG_IDS.recentJobs,
    APP_DIALOG_IDS.developerAuth,
    APP_DIALOG_IDS.developerSettings,
    APP_DIALOG_IDS.glossaryManager,
    APP_DIALOG_IDS.browserCredentials,
    APP_DIALOG_IDS.professionalTranslation,
    APP_DIALOG_IDS.appSettings,
    APP_DIALOG_IDS.statusDetail,
    APP_DIALOG_IDS.reader,
  ]);
  assert.equal(APP_DIALOG_IDS.appSettings, "app-settings-dialog");
  assert.equal(APP_DIALOG_IDS.translationWorkflow, "translation-workflow-dialog");
  assert.equal(APP_SHELL_IDS.appSettingsButton, "app-settings-btn");
  assert.equal(APP_SHELL_IDS.libraryAddPdfButton, "library-add-pdf-btn");
});
