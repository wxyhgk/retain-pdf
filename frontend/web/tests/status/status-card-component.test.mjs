import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor } from "../helpers/async.mjs";
import { byId, clickWithMouseDown, makeDom } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";

// StatusCard(Phase 3b job-runtime 域)组件级测试。覆盖蓝图 §6 新增测试⑤⑥:
// ⑤ StatusCard 契约(stage flow/substage/retry/data-status/进度条 ids);
// ⑥ 阶段选择语义(点击早期阶段不被后续无关渲染重置)。
// 走真实 mountJobRuntimeFeature 轮询链路(?mock=translate),不 mock fetch——
// 直接验证 statusCardPresenter 在 startPolling 同步链内写 store(蓝图风险 6:
// 首帧 placeholder,否则打开时闪空卡)与 renderPatch 三 source 收敛是否真的
// 端到端工作。
//
// ── 已删除的用例:「StatusCard：DOM 契约 id 逐一存在(隐藏区 + ring + 阶段流)」──
// 删的是什么：它逐一断言那批**不带前缀**的主卡契约 id ——
//   #job-status-card / cancel-btn / status-detail-btn / status-ring-* /
//   status-progress-* / status-stage-* ，外加隐藏区
//   job-id / job-status / job-stage-detail / query-job-duration / job-finished-at。
// 为什么删：
//   1. 那套契约属于主页那张页面级状态卡 StatusCardMain。进度主场收敛到书籍详情
//      的「进度」Tab 后它零渲染点，组件文件已删除，契约随宿主一并作废——留着只会
//      测一段不存在的 UI。
//   2. 隐藏区那批 id 从来没有任何代码从 DOM 读回（setText 写的是
//      app/home/state/text-store.ts 那个 store，不碰 DOM），是遗留压舱物；
//      嵌入卡不渲染隐藏区，也就没有等价物可改指。
//   仍然活着的机制（ring/进度/阶段流渲染、阶段选择语义、重试、取消）由下面三条
//   用例覆盖，只是宿主换成嵌入卡 #book-detail-job-status-card（带 book-detail-
//   前缀的同名 id）。

// 嵌入卡 DOM id 前缀（createPrefixedStatusCardIds("book-detail-")）。
const BD = "book-detail-";
const CARD_ID = `${BD}job-status-card`;

// 书籍详情的 Tab 切换要 mousedown（Radix Tabs）；cancelable 沿用原写法。
const click = (dom, element) => clickWithMouseDown(dom, element, { cancelable: true });

// StatusCard 的唯一渲染点是书籍详情「进度」Tab 里的 TranslateProgress
// （#book-detail-job-status-card）。boot 时还没有任何任务，所以只把 HomeApp 挂起来，
// 宿主由各用例 startPolling 之后调 openProcessingTab 打开。
const bootHome = (dom) => bootHomeApp(dom, { readyId: "library-add-pdf-btn" });

function card(dom) {
  return byId(dom, CARD_ID);
}

function stageStep(dom, stageKey) {
  return card(dom)?.querySelector(`.status-stage-step[data-stage-key="${stageKey}"]`);
}

// 把嵌入卡的宿主打开：书籍详情弹窗的「进度」Tab。
// 做法照 tests/jobs/artifact-downloads-react.test.mjs 的同名 helper：走
// services.library.actions.openBookDetail(...)（RecentJobsLibraryGrid 卡片
// onOpenDetail 调的就是它，等价入口），程序化调用不依赖网格排序与渲染时序，
// 而且能精确打开「正在被轮询的这个 job 所属的那份文档」。
// 谓词只返回 Boolean，命中后要重新取一次那张卡。
async function openProcessingTab(dom, services, jobId) {
  const findCard = () => (services.library.recentJobsStore.getSnapshot?.().items || []).find(
    (row) => `${row?.job_id || ""}`.trim() === jobId,
  );
  await waitFor(() => Boolean(findCard()), "书架出现被轮询任务所属的文档卡");
  services.library.actions.openBookDetail(findCard());
  await waitFor(() => byId(dom, "book-detail-dialog"), "书籍详情弹窗打开");
  click(dom, byId(dom, "book-detail-tab-processing"));
  await waitFor(() => byId(dom, "book-detail-panel-processing")?.hidden === false, "切到「进度」Tab");
  await waitFor(() => card(dom), `嵌入状态卡 #${CARD_ID} 挂载`);
}

test("StatusCard：真实轮询(mock=translate)驱动 ring/进度/阶段流(首帧不闪空卡)", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHome(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");
  const jobId = getMockJobId();

  services.features.jobRuntimeFeature.startPolling(jobId);

  // 首帧不闪空卡(蓝图风险 6)：startPolling 同步链内就已 renderJob(placeholder)，
  // 不等待任何 await 就应该看到带非空文案的占位快照。旧写法读的是主页状态卡的
  // #status-ring-label（那张卡在 boot 时就已挂好），嵌入卡的宿主要等书架出现文档卡
  // 才能打开，所以同一机制改在它的真值来源 statusCard store 上同步验证，
  // 随后再验证卡挂出来的那一刻 ring 文案非空。
  const bootSnapshot = services.statusCard.store.getSnapshot().snapshot;
  assert.equal(`${bootSnapshot?.jobId || ""}`.trim(), jobId, "startPolling 应在同步链内把占位帧写进 store");
  assert.notEqual(`${bootSnapshot?.label || ""}`.trim(), "", "占位帧的 ring label 必须非空，否则卡会闪空");
  assert.notEqual(`${bootSnapshot?.value || ""}`.trim(), "", "占位帧的 ring value 必须非空，否则卡会闪空");

  await openProcessingTab(dom, services, jobId);
  assert.notEqual(byId(dom, `${BD}status-ring-label`).textContent.trim(), "");

  await waitFor(() => byId(dom, `${BD}status-ring-value`).textContent.trim() !== "准备中", "真实任务数据到达后 ring value 更新");
  await waitFor(() => {
    const activeStep = byId(dom, `${BD}status-stage-flow`).querySelector('.status-stage-step[data-stage-key="translate"]');
    return activeStep?.classList.contains("is-active");
  }, "translate 阶段在流程条上高亮");

  // 进度条不在这张卡上——它归 ProcessingPipelineRail 独有。
  //
  // 这条断言此前钉的是卡内的进度条。那条进度条和轨道画的是同一个百分比，于是
  // 「进度」Tab 里同一个任务出现两条进度和两套阶段，看上去像两个任务在跑。
  // 现在卡只负责「取消 / 详情 / 耗时 / 选阶段 / 重试」，进度只有轨道一处。
  //
  // 契约 id 仍在（保留成隐藏节点，setText 可能写），但必须是隐藏的——它要是又
  // 显示出来，就是重复回来了。
  const progressBar = byId(dom, `${BD}status-progress-bar`);
  assert.ok(progressBar, "契约 id 应保留");
  assert.equal(progressBar.classList.contains("hidden"), true, "卡内不得再画进度条，进度归流水线轨道");

  // 旧断言等的是隐藏区 #job-status 摘要更新（那批隐藏 id 无 DOM 读者，已随主卡
  // 下线）。同一份真值在嵌入卡根节点上就有：data-status 直接写 snapshot.status。
  await waitFor(() => {
    const status = `${card(dom)?.dataset.status || ""}`.trim();
    return status !== "" && status !== "idle";
  }, "卡根 data-status 反映真实任务状态");

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusCard：阶段选择语义 + 重试 + 取消", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHome(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");
  const jobId = getMockJobId();

  services.features.jobRuntimeFeature.startPolling(jobId);
  await openProcessingTab(dom, services, jobId);
  // 旧写法读卡根的 data-current-stage-key（主卡属性，嵌入卡不写）。等价的 DOM
  // 真值是流程条上的 is-active 步——StageFlow 的 is-active 就是 currentStageKey。
  await waitFor(() => stageStep(dom, "translate")?.classList.contains("is-active"), "翻译阶段就位");
  await wait(50);
  assert.equal(stageStep(dom, "translate").classList.contains("is-active"), true, "当前阶段应是 translate");

  // ---- 阶段选择:点击 ocr(index < translate,可选) → 选中态切换 ----
  const ocrStep = stageStep(dom, "ocr");
  assert.equal(ocrStep.disabled, false, "ocr 阶段已到达,应可选");
  click(dom, ocrStep);
  await waitFor(() => {
    const currentOcrStep = stageStep(dom, "ocr");
    return currentOcrStep?.getAttribute("aria-selected") === "true"
      && byId(dom, `${BD}status-ring-label`).textContent.trim() === "OCR";
  }, "点击 ocr 后当前状态卡选中态切换");
  assert.equal(
    byId(dom, `${BD}status-ring-label`).textContent.trim(),
    "OCR",
    JSON.stringify({
      // 嵌入卡不写 data-current-stage-key / data-manual-stage-selection，
      // 诊断信息改用它确实渲染的属性。
      activeStage: card(dom)?.querySelector(".status-stage-step.is-active")?.dataset.stageKey,
      selected: card(dom)?.dataset.selectedStage,
      visualStage: card(dom)?.dataset.visualStageKey,
    }),
  );
  assert.equal(card(dom).dataset.selectedStage, "ocr", "卡根 data-selected-stage 应跟随手动选择");

  // ---- 阶段选择语义:同一 job/同一 currentStageKey 下的无关渲染不应清掉手动选择 ----
  services.statusCard.store.actions.setCancelDisabled(false);
  await wait(30);
  assert.equal(ocrStep.getAttribute("aria-selected"), "true", "无关的 store 通知不应重置手动选择");

  // ---- 取消:先弹确认;确认后按钮应立即置灰(shellViewPort.setCancelDisabled 同步生效) ----
  const cancelButton = byId(dom, `${BD}cancel-btn`);
  assert.ok(cancelButton, "嵌入卡必须提供取消入口");
  assert.equal(cancelButton.getAttribute("aria-label"), "取消任务");
  if (!cancelButton.disabled) {
    click(dom, cancelButton);
    // 取消要重新跑才能补回来:点下去先问,不直接取消。
    const confirmButton = await waitFor(() => byId(dom, `${BD}cancel-confirm-confirm`), "点取消先弹确认框");
    assert.equal(cancelButton.disabled, false, "还没确认就已经在取消了");
    click(dom, confirmButton);
    await waitFor(() => cancelButton.disabled === true, "确认取消后按钮立即禁用");
    assert.match(cancelButton.textContent, /取消中/, "取消请求中必须反馈状态");
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusCard：重试按钮(mock stage-actions 数据到达后可点击并触发新一轮轮询)", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHome(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");
  const jobId = getMockJobId();

  services.features.jobRuntimeFeature.startPolling(jobId);
  await openProcessingTab(dom, services, jobId);
  // 嵌入卡把重试按钮渲染在进度文案行右侧（id=book-detail-status-stage-retry，
  // class=bd-job-status-retry-action），只针对当前选中阶段渲染一颗。
  await waitFor(() => {
    if (!stageStep(dom, "translate")?.classList.contains("is-active")) return false;
    const retryButton = card(dom)?.querySelector('.bd-job-status-retry-action[data-retry-stage="translation"]');
    return retryButton && !retryButton.disabled;
  }, "translate 阶段的重试按钮就位(mock fetchJobStageActions 恒返回 translation 可重试)");
  await wait(50);

  const retryButton = card(dom).querySelector('.bd-job-status-retry-action[data-retry-stage="translation"]');
  assert.ok(retryButton, "重试按钮应存在");
  assert.equal(retryButton.id, `${BD}status-stage-retry`, "重试按钮应占用 stageRetry 契约 id");
  assert.equal(retryButton.disabled, false);
  assert.equal(retryButton.dataset.retryStage, "translation");

  let retryEventSeen = false;
  dom.window.document.addEventListener(APP_EVENTS.retryStage, (event) => {
    retryEventSeen = event.detail?.stage === "translation";
  });

  const previousJobId = services.features.jobRuntimeFeature.currentJobId();
  click(dom, retryButton);
  await waitFor(() => retryEventSeen, "点击重试按钮 dispatch retryStage 事件(蓝图 §5 事件契约)");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() !== previousJobId,
    "job-runtime 引擎消费 retryStage 后切换到新 job(mock retryJobStage 返回新 job_id)",
  );

  root.unmount();
  services.dispose();
  host.remove();
});
