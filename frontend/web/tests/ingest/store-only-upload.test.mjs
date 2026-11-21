import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";

// 上传弹窗：先选择翻译 / 仅 OCR 模式，再上传并执行当前模式或仅收藏。

test("上传弹窗：恢复顶部模式切换 + 就绪后执行当前模式或仅收藏", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  clickWithMouseDown(dom, byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "添加对话框打开");
  assert.equal(byId("translation-workflow-title").textContent, "添加 PDF");
  assert.equal(byId("translation-workflow-title").classList.contains("sr-only"), true, "顶部只留 tab，标题只给读屏（2026-11-20）");
  assert.equal(byId("translation-workflow-desc"), null);
  assert.ok(byId("ocr-only-toggle"), "顶部模式切换存在");
  assert.equal(byId("file-label").textContent, "点击选择文件或拖到这里");

  // 模拟上传完成
  services.stores.uploadView.actions.patch({ ready: true, actionSlotVisible: true });
  await waitFor(() => !byId("store-only-btn").disabled, "仅收藏动作可用");
  await waitFor(() => dom.window.document.querySelector(".upload-tile.is-ready"), "上传区进入就绪态");
  assert.ok(byId("page-range-btn"), "文件就绪后显示翻译选项入口");
  assert.equal(byId("store-only-btn").textContent.trim(), "仅收藏");
  assert.match(byId("submit-btn").textContent.trim(), /翻译/);

  const ocrModeTab = dom.window.document.querySelector('[aria-label="仅 OCR 模式"]');
  assert.ok(ocrModeTab, "仅 OCR 模式入口存在");
  clickWithMouseDown(dom, ocrModeTab);
  await waitFor(() => byId("submit-btn").textContent.trim() === "开始 OCR", "切换为 OCR 主动作");

  // 对话框仍打开（不自动关）
  assert.ok(byId("translation-workflow-dialog"), "就绪后不自动关闭");

  root.unmount();
  services.dispose();
  host.remove();
});

test("仅收藏：关闭对话框且不提交翻译 job", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

  const opened = [];
  services.library.actions.openBookDetail = (item) => opened.push(item);

  clickWithMouseDown(dom, byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "添加对话框打开");

  let jobSubmitted = false;
  dom.window.document.addEventListener(APP_EVENTS.libraryJobCreated, () => { jobSubmitted = true; });

  services.stores.uploadView.actions.patch({ ready: true, actionSlotVisible: true });
  // 上传响应现在带 document_id（= 内容哈希），前端存入 upload session。
  services.ports.uploadStatePort.setUpload({ documentId: "doc-uploaded" });
  await waitFor(() => !byId("store-only-btn").disabled, "仅收藏可选择");
  clickWithMouseDown(dom, byId("store-only-btn"));

  await waitFor(() => byId("translation-workflow-dialog") === null, "仅收藏后关闭对话框");
  await wait(50);
  assert.equal(jobSubmitted, false, "仅收藏不提交翻译 job");
  await waitFor(() => opened.length === 1, "仅收藏后跳到该文档详情");
  assert.equal(opened[0].document_id, "doc-uploaded");

  root.unmount();
  services.dispose();
  host.remove();
});

test("提交任务：成功后关闭弹窗并跳到该文档详情（进度 Tab）", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  const opened = [];
  services.library.actions.openBookDetail = (item) => opened.push(item);
  services.bridge.submitForm = async () => ({ status: "submitted", payload: { job_id: "job-x" } });

  clickWithMouseDown(dom, byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "添加对话框打开");
  services.stores.uploadView.actions.patch({ ready: true, actionSlotVisible: true });
  services.ports.uploadStatePort.setUpload({ documentId: "doc-uploaded" });
  await waitFor(() => byId("job-form"), "上传表单就位");
  byId("job-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));

  await waitFor(() => opened.length === 1, "提交成功后跳到该文档详情");
  assert.equal(opened[0].document_id, "doc-uploaded");
  assert.equal(opened[0].job_id, "job-x");
  assert.equal(opened[0].prefer_translate_tab, true, "任务提交后落在进度 Tab");

  root.unmount();
  services.dispose();
  host.remove();
});
