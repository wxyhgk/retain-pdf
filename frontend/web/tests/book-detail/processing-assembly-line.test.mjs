/** 「进度」页的流水线画面：五站状态、每站运行时间（不做预计剩余）、最近活动、读任务详情的轮询。 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  assemblyStations,
  formatElapsed,
  recentActivity,
  stationOfStage,
  stationTimes,
  timelineFromJobPayload,
  totalElapsedMs,
} from "../../src/features/book-detail/domain/assembly-line-model.ts";
import { waitFor } from "../helpers/async.mjs";
import { makeDom } from "../helpers/dom.mjs";

const T0 = Date.parse("2026-10-30T14:25:29Z");
const iso = (seconds) => new Date(T0 + seconds * 1000).toISOString();

// 真实任务的 stage_history 形状（GET /jobs/:id 的 runtime）。
const payload = (history) => ({ runtime: { stage_history: history } });
const FINISHED = payload([
  { stage: "queued", detail: "任务排队中，等待可用执行槽位", enter_at: iso(0), exit_at: iso(0), duration_ms: 0 },
  { stage: "ocr_submitting", detail: "正在启动 OCR 子任务", enter_at: iso(0), exit_at: iso(41), duration_ms: 41_000 },
  { stage: "translating", detail: "OCR 完成，开始翻译", enter_at: iso(41), exit_at: iso(108), duration_ms: 67_000 },
  { stage: "rendering", detail: "翻译完成，开始渲染", enter_at: iso(108), exit_at: iso(113), duration_ms: 5_000 },
  { stage: "finished", detail: "任务完成", enter_at: iso(113), exit_at: iso(113), duration_ms: 0 },
]);
const RUNNING = payload([
  { stage: "queued", detail: "任务排队中", enter_at: iso(0), exit_at: iso(3), duration_ms: 3_000 },
  { stage: "ocr_processing", detail: "OCR 解析", enter_at: iso(3), exit_at: iso(48), duration_ms: 45_000 },
  { stage: "translating", detail: "OCR 完成，开始翻译", enter_at: iso(48), exit_at: null, duration_ms: null },
]);

test("阶段名归到五站；认不出的不计", () => {
  assert.equal(stationOfStage("queued"), "prepare");
  assert.equal(stationOfStage("ocr_submitting"), "ocr");
  assert.equal(stationOfStage("normalizing"), "ocr");
  assert.equal(stationOfStage("translating"), "translate");
  assert.equal(stationOfStage("rendering"), "render");
  assert.equal(stationOfStage("refine"), "render", "精修跑在渲染阶段里");
  assert.equal(stationOfStage("finished"), "done");
  assert.equal(stationOfStage("something_new"), "");
});

test("运行时间：做完的站按 duration_ms，正在跑的那站按现在算；不做预计剩余", () => {
  const done = timelineFromJobPayload(FINISHED, T0);
  const times = stationTimes(done, { now: T0 + 999_000, jobActive: false });
  assert.deepEqual(times.ocr, { ms: 41_000, running: false });
  assert.deepEqual(times.translate, { ms: 67_000, running: false });
  assert.equal(times.done, undefined, "完成站不单算时间");
  assert.equal(totalElapsedMs(done, { now: T0 + 999_000, jobActive: false }), 113_000, "跑完了按最后一段算，不跟着现在涨");

  const live = timelineFromJobPayload(RUNNING, T0);
  const now = T0 + 120_000;
  assert.deepEqual(stationTimes(live, { now, jobActive: true }).translate, { ms: 72_000, running: true });
  assert.equal(totalElapsedMs(live, { now, jobActive: true }), 120_000);
  assert.equal(stationTimes(live, { now, jobActive: false }).translate, undefined, "任务停了，没结束的那段不再往上算");
  assert.equal(timelineFromJobPayload({ runtime: {} }, T0), null);
});

test("时间写法", () => {
  assert.equal(formatElapsed(0), "不到 1 秒");
  assert.equal(formatElapsed(45_000), "45 秒");
  assert.equal(formatElapsed(68_000), "1 分 8 秒");
  assert.equal(formatElapsed(3_720_000), "1 小时 2 分");
});

test("最近活动：新的在上；此刻的一句话放最上面，和最新一条一样就不重复", () => {
  const live = timelineFromJobPayload(RUNNING, T0);
  const lines = recentActivity(live, { liveDetail: "正在翻译第 2 / 10 页" });
  assert.deepEqual(lines.map((line) => line.text), ["正在翻译第 2 / 10 页", "OCR 完成，开始翻译", "OCR 解析", "任务排队中"]);
  assert.equal(lines[0].at, "");
  assert.match(lines[1].at, /^\d\d:\d\d:\d\d$/);
  assert.equal(recentActivity(live, { liveDetail: "OCR 完成，开始翻译" }).length, 3);
});

test("五站状态：排队时文档准备在跑；开始 OCR 后文档准备打勾；成功后全部打勾", () => {
  const stateOf = (item, extra = {}) => Object.fromEntries(
    assemblyStations(item, { hasTranslationJob: true, ocrState: "pending", loading: false, ...extra })
      .stations.map((station) => [station.key, station.state]),
  );
  assert.deepEqual(stateOf({ status: "queued" }), { prepare: "active", ocr: "pending", translate: "pending", render: "pending", done: "pending" });
  const translating = stateOf({ status: "running", stage_snapshot: { display_stage: "translate" } });
  assert.equal(translating.prepare, "done");
  assert.equal(translating.ocr, "done");
  assert.equal(translating.translate, "active");
  assert.equal(translating.done, "pending");
  assert.ok(Object.values(stateOf({ status: "succeeded" })).every((state) => state === "done"));
  assert.ok(Object.values(stateOf({ status: "running" }, { loading: true })).every((state) => state === "pending"));
});

async function mountRail(props) {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ProcessingPipelineRail } = await import("../../src/features/book-detail/ui/panels/processing/ProcessingPipelineRail.tsx");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(ProcessingPipelineRail, props));
  await waitFor(() => host.querySelector("[data-translation-process]"), "流水线出现");
  return { dom, host, unmount: () => root.unmount() };
}

test("画面：传送带和五台机器；在跑的站写百分比和已运行时间，做完的写用时", async () => {
  const item = {
    job_id: "job-a", status: "running",
    stage_snapshot: { display_stage: "translate", stage_detail: "正在翻译第 2 / 10 页", progress: { current: 2, total: 10 } },
  };
  const { host, unmount } = await mountRail({
    item, hasTranslationJob: true, translationStatus: { label: "处理中", tone: "active" },
    timeline: timelineFromJobPayload(RUNNING, T0), now: T0 + 120_000,
  });
  try {
    assert.equal(host.querySelectorAll("[data-line-station]").length, 5);
    assert.equal(host.querySelector("[data-line-active]").dataset.lineActive, "translate");
    assert.ok(host.querySelector("[data-line-travel='translate']"), "稿纸从 OCR 往翻译走");
    assert.deepEqual([...host.querySelectorAll("[data-stage-key]")].map((node) => node.dataset.stageKey), ["prepare", "ocr", "translate", "render", "done"]);
    assert.equal(host.querySelector("[data-stage-percent='translate']").textContent, "20%");
    // 每站徽标下面一个钟表小标签写「1:12」；「已运行 1 分 12 秒」在悬停和读屏里。站名、状态也只在悬停和读屏里。
    const time = (key) => host.querySelector(`[data-stage-time='${key}']`);
    assert.equal(time("translate").getAttribute("title"), "已运行 1 分 12 秒");
    assert.equal(time("translate").querySelector("[aria-hidden='true']:not(svg)").textContent, "1:12");
    assert.equal(time("translate").querySelector(".sr-only").textContent, "已运行 1 分 12 秒");
    assert.equal(time("ocr").getAttribute("title"), "用时 45 秒");
    assert.match(host.querySelector("[data-stage-key='translate']").getAttribute("title"), /文本翻译 · 处理中 · 已运行 1 分 12 秒/);
    assert.ok(host.querySelector("[data-stage-key='translate'] .book-detail-pipeline-label").classList.contains("sr-only"), "站名不画在画面上");
    // 「等待中」这类状态字留给读屏，画面上只用图标说。
    const renderStatus = host.querySelector("[data-stage-key='render'] .book-detail-status");
    assert.equal(renderStatus.textContent, "等待中");
    assert.ok(renderStatus.classList.contains("sr-only"), "等待中不画成小标签");
    assert.equal(host.querySelector("[data-stage-time='render']"), null);
    assert.equal(host.querySelector("[data-line-activity]"), null, "最近活动挪到细节区，不在流水线里");
    assert.doesNotMatch(host.textContent, /预计|剩余/);
  } finally {
    unmount();
  }
});

test("画面：首帧未知时只占位，不写时间，不画走动的稿纸", async () => {
  const { host, unmount } = await mountRail({
    item: { status: "running" }, hasTranslationJob: true, loading: true,
    timeline: timelineFromJobPayload(RUNNING, T0), now: T0 + 120_000,
  });
  try {
    assert.equal(host.querySelector("[data-translation-process]").dataset.loading, "true");
    assert.equal(host.querySelector("[data-stage-time]"), null);
    assert.equal(host.querySelector("[data-line-travel]"), null);
  } finally {
    unmount();
  }
});

test("读计时：在跑时轮询，跑完读一次；读失败保留上一次", async () => {
  makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useJobTimeline } = await import("../../src/features/book-detail/ui/use-job-timeline.ts");
  let calls = 0;
  let fail = false;
  const fetchPayload = async () => {
    calls += 1;
    if (fail) throw new Error("down");
    return RUNNING;
  };
  let seen = null;
  function Harness({ poll }) {
    seen = useJobTimeline("job-a", { poll, fetchPayload, intervalMs: 20 });
    return null;
  }
  const host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(Harness, { poll: true }));
  try {
    await waitFor(() => calls >= 3, "在跑时一直轮询");
    assert.equal(seen.timeline.history.length, 3);
    fail = true;
    const failedAt = calls;
    await waitFor(() => calls >= failedAt + 2, "读失败也接着轮询");
    assert.equal(seen.timeline.history.length, 3, "读失败保留上一次");
    fail = false;
    root.render(React.createElement(Harness, { poll: false }));
    await waitFor(() => calls >= 1, "跑完读一次");
    const settledAt = calls;
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.ok(calls <= settledAt + 1, "不在跑时不再轮询");
  } finally {
    root.unmount();
  }
});

test("活动（细节区）：在跑的那一条是后端的实时说明；首帧未知时什么都不列", async () => {
  makeDom();
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ProcessingActivity } = await import("../../src/features/book-detail/ui/panels/processing/ProcessingActivity.tsx");
  const item = { job_id: "job-a", status: "running", stage_snapshot: { stage_detail: "正在翻译第 2 / 10 页" } };
  const timeline = timelineFromJobPayload(RUNNING, T0);
  const html = renderToStaticMarkup(React.createElement(ProcessingActivity, { item, timeline, jobActive: true }));
  assert.match(html, /data-line-activity/);
  assert.match(html, /正在翻译第 2 \/ 10 页/);
  assert.equal(renderToStaticMarkup(React.createElement(ProcessingActivity, { item, timeline, jobActive: true, loading: true })), "");
});
