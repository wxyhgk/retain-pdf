/** 任务失败时，「进度」页签真的画出失败卡片 —— 两段都要。
 *
 * 后端把 JobFailureBriefView 接到了 document jobs 列表上，卡片组件自己也有 13 条门禁，
 * 但「页签把列表项里的 failure 交给了卡片」这一环**一条测试都没有**
 * （`grep -rn failure tests/` 在 book-detail 下只命中卡片那个文件）。
 *
 * 这正是本仓库出过两次事故的那一类：
 *   - ReaderHostPanelShell 手抄 props 时漏了 onOpenBoard → 点产物条抛异常，两边单测全绿
 *   - parseBoardListing 按错的信封形状解析 → 列表恒空，而测试喂的是同样错的形状
 * 两次 tsc 都没报，因为 props 是 any。这里取值处还有 `as` 强转，更靠不住。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { wait } from "../helpers/async.mjs";
import { makeDom } from "../helpers/dom.mjs";
import { idleOcr, idleTranslation, mountProcessingTab } from "./helpers/processing-tab-fixture.mjs";

// 失败的翻译任务会拉起 BookTranslateProgressPanel，它要 HomeShellProviders。
const services = {
  library: { actions: {} },
  statusCard: { store: { getSnapshot: () => ({ snapshot: {} }), subscribe: () => () => {} } },
  statusDetail: { controller: { openStatusDetailDialog: () => {} } },
};

const mountTab = (dom, props) => mountProcessingTab(dom, props, services);

// 字段取自真实数据：一条 MinerU 解析失败 / 一条翻译失败。
const OCR_FAILURE = {
  category: "provider", stage: "ocr", retryable: true,
  summary: "任务失败，但暂未识别出明确根因",
  root_cause: "MinerU batch task failed: parsing failed, please try again later",
  suggestion: "查看 log_tail 和完整错误日志进一步排查", provider: "mineru",
};
const TRANSLATION_FAILURE = {
  category: "translation", stage: "translation", retryable: true,
  summary: "翻译阶段失败", root_cause: "DeepSeek 返回空译文", provider: "deepseek",
};

const failedOcrJob = (failure = OCR_FAILURE, extra = {}) => ({
  job_id: "job-ocr-1", workflow: "ocr", job_type: "ocr", status: "failed",
  created_at: "2026-10-01T00:00:00Z", failure, ...extra,
});
const failedTranslation = (failure = TRANSLATION_FAILURE) => ({
  ...idleTranslation,
  item: {
    job_id: "job-tr-1", workflow: "translate", status: "failed",
    created_at: "2026-10-02T00:00:00Z", failure,
  },
  status: { label: "失败", tone: "failed" },
});

const cards = (host) => [...host.querySelectorAll("[data-job-failure]")];
const translationRegion = (host) => host.querySelector('[data-processing-region="translation"]');

test("OCR 任务失败时，OCR 段真的出现失败卡片", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: { ...idleOcr, job: failedOcrJob() }, translation: idleTranslation,
  });
  const all = cards(host);
  assert.equal(all.length, 1, "失败卡片没出现 —— 用户又只能看到「失败」两个字");
  assert.ok(!translationRegion(host)?.contains(all[0]), "OCR 的失败卡片画到翻译段里去了");
  assert.match(host.textContent, /上游服务没能处理这份文件/, "分类建议没画出来 —— failure 没接上");
  assert.match(host.textContent, /MinerU batch task failed/, "后端给的根因没画出来");
  assert.match(host.textContent, /展开完整错误/, "loadDetail 没接上，traceback 永远取不回来");
  root.unmount(); host.remove();
});

test("OCR 失败卡片上的重试接到的是 ocr.onOcr", async () => {
  const dom = makeDom();
  let clicked = 0;
  const { root, host } = await mountTab(dom, {
    loading: false,
    ocr: { ...idleOcr, job: failedOcrJob(), onOcr() { clicked += 1; } },
    translation: idleTranslation,
  });
  const retry = host.querySelector("#book-detail-retry-failed-btn");
  assert.ok(retry, "失败了却没有重试入口");
  retry.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await wait(50);
  assert.equal(clicked, 1, "点了重试什么都没发生 —— onRetry 接空了");
  root.unmount(); host.remove();
});

const resumeState = (plan, extra = {}) => ({
  plan, loading: false, pending: false, error: "", resume: async () => {}, ...extra,
});
const RENDER_PLAN = {
  can_resume: true, from_stage: "render", reuses_artifacts: ["translations_dir"], reruns_stages: ["rendering"],
};
const click = (dom, node) => node.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

test("翻译任务失败时，翻译段出现失败卡片；主按钮按续跑计划「从渲染继续」，不是整本重翻", async () => {
  const dom = makeDom();
  let resumed = 0;
  let translated = 0;
  const translation = failedTranslation();
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: idleOcr,
    translation: {
      ...translation,
      onTranslate() { translated += 1; },
      resume: resumeState(RENDER_PLAN, { resume: async () => { resumed += 1; } }),
    },
  });
  const all = cards(host);
  assert.equal(all.length, 1, "翻译失败没有卡片 —— 一半的失败仍然只有「失败」两个字");
  assert.ok(translationRegion(host)?.contains(all[0]), "翻译的失败卡片没画在翻译段里");
  assert.match(host.textContent, /DeepSeek 返回空译文/, "翻译失败的根因没画出来");
  const button = host.querySelector("#book-detail-retry-failed-btn");
  assert.match(button.textContent, /从渲染继续/);
  assert.match(host.textContent, /不调用模型/, "要说清这一下花不花钱");
  click(dom, button);
  await wait(50);
  assert.equal(resumed, 1, "主按钮没接到续跑");
  assert.equal(translated, 0, "主按钮又接到了「翻译整本」—— 渲染失败会白花一整本的费用");
  root.unmount(); host.remove();
});

test("续跑计划还在读时，主按钮转圈占位、点不了", async () => {
  const dom = makeDom();
  let translated = 0;
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: idleOcr,
    translation: { ...failedTranslation(), onTranslate() { translated += 1; }, resume: resumeState(null, { loading: true }) },
  });
  const button = host.querySelector("#book-detail-retry-failed-btn");
  assert.ok(button?.disabled, "计划没读到就能点，点下去不知道会发生什么");
  click(dom, button);
  await wait(30);
  assert.equal(translated, 0);
  root.unmount(); host.remove();
});

test("OCR 都没成功时，主按钮是「从 OCR 重新开始」，接到重新提交整本", async () => {
  const dom = makeDom();
  let translated = 0;
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: idleOcr,
    translation: {
      ...failedTranslation(OCR_FAILURE),
      onTranslate() { translated += 1; },
      resume: resumeState({ can_resume: false, from_stage: null, reason: "no ocr artifacts" }),
    },
  });
  const button = host.querySelector("#book-detail-retry-failed-btn");
  assert.match(button.textContent, /从 OCR 重新开始/);
  assert.match(host.textContent, /费用重新计算/, "从头再来要先说会重新付费");
  click(dom, button);
  await wait(50);
  assert.equal(translated, 1);
  root.unmount(); host.remove();
});

test("有重复计费风险、不能续跑时，不给主按钮，说明原因", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: idleOcr,
    translation: {
      ...failedTranslation(),
      resume: resumeState({ can_resume: false, from_stage: "translate", reason: "translation recovery is blocked; consult supported retry policies" }),
    },
  });
  assert.equal(host.querySelector("#book-detail-retry-failed-btn"), null);
  assert.match(host.textContent, /可能重复计费/);
  root.unmount(); host.remove();
});

test("同一次运行的 OCR 失败只说一遍：翻译任务的 -ocr 子任务不再单独出一张卡", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, {
    loading: false,
    ocr: { ...idleOcr, job: failedOcrJob(OCR_FAILURE, { job_id: "job-tr-1-ocr" }) },
    translation: { ...failedTranslation(null), resume: resumeState(null) },
  });
  assert.equal(cards(host).length, 1, "同一件事说了两遍");
  assert.match(host.textContent, /MinerU batch task failed/, "翻译任务没有简报时要用 OCR 那份补上");
  root.unmount(); host.remove();
});

test("取消的翻译任务：说明已取消、停在哪一步，给「从断点继续」", async () => {
  const dom = makeDom();
  let resumed = 0;
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: idleOcr,
    translation: {
      ...idleTranslation,
      item: { job_id: "job-tr-2", workflow: "translate", status: "canceled", stage: "translate", created_at: "2026-10-02T00:00:00Z" },
      status: { label: "已取消", tone: "muted" },
      resume: resumeState({ can_resume: true, from_stage: "translate", reuses_artifacts: ["translation_checkpoint_json"] }, {
        resume: async () => { resumed += 1; },
      }),
    },
  });
  const card = host.querySelector("[data-job-cancelled]");
  assert.ok(card, "取消之后什么都不说");
  assert.match(card.textContent, /任务已取消/);
  assert.match(card.textContent, /已经翻好的部分/, "要说清续跑会沿用已翻好的部分");
  click(dom, host.querySelector("#book-detail-resume-cancelled-btn"));
  await wait(50);
  assert.equal(resumed, 1);
  root.unmount(); host.remove();
});

test("OCR 失败时，没开始的翻译站写「未开始」，不写「失败」", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: idleOcr,
    translation: {
      ...failedTranslation(OCR_FAILURE),
      item: { ...failedTranslation(OCR_FAILURE).item, stages: { ocr: { state: "failed" } } },
      resume: resumeState(null),
    },
  });
  const label = (key) => host.querySelector(`[data-stage-key="${key}"] .book-detail-status`)?.textContent || "";
  assert.equal(label("ocr"), "失败");
  assert.equal(label("translate"), "未开始");
  root.unmount(); host.remove();
});

test("渲染失败时，失败标在渲染站，前面两站打勾", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: idleOcr,
    translation: {
      ...failedTranslation({ ...TRANSLATION_FAILURE, stage: "render", category: "render" }),
      resume: resumeState(RENDER_PLAN),
    },
  });
  const state = (key) => host.querySelector(`[data-stage-key="${key}"]`)?.getAttribute("data-state");
  assert.equal(state("ocr"), "done");
  assert.equal(state("translate"), "done");
  assert.equal(state("render"), "failed", "渲染失败却没标在渲染站");
  root.unmount(); host.remove();
});

test("两段各自失败时两张卡片都在", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, {
    loading: false, ocr: { ...idleOcr, job: failedOcrJob() }, translation: failedTranslation(),
  });
  assert.equal(cards(host).length, 2, "只画了一边 —— 另一半的失败没有说法");
  root.unmount(); host.remove();
});

test("没有 failure 的任务不画卡片 —— 否则成功的任务也会被说成失败", async () => {
  const dom = makeDom();
  const { root, host } = await mountTab(dom, {
    loading: false,
    ocr: { ...idleOcr, job: { job_id: "job-ocr-ok", workflow: "ocr", status: "succeeded" } },
    translation: {
      ...idleTranslation, item: { job_id: "job-tr-ok", status: "succeeded" },
      status: { label: "已完成", tone: "done" }, canTranslate: false,
    },
  });
  assert.equal(cards(host).length, 0, "成功的任务也画出了失败卡片");
  root.unmount(); host.remove();
});

test("合成的 OCR 任务不在 OCR 段重复画同一个失败", async () => {
  // ocr_status_derived 的那条「OCR 任务」其实指向翻译任务，它的 failure 属于翻译段。
  const dom = makeDom();
  const { root, host } = await mountTab(dom, {
    loading: false,
    ocr: { ...idleOcr, job: failedOcrJob(TRANSLATION_FAILURE, { job_id: "job-tr-1", ocr_status_derived: true }) },
    translation: failedTranslation(),
  });
  const all = cards(host);
  assert.equal(all.length, 1, "同一个任务的失败被画了两遍");
  assert.ok(translationRegion(host)?.contains(all[0]), "留下的那张不在翻译段");
  root.unmount(); host.remove();
});
