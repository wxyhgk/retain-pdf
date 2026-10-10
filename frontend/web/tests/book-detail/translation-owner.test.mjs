/** 重新处理要发给真正持有译文的任务。
 *
 * 事故：一本书的原始翻译任务做过一次就地精修（之后类型被记成「渲染」），又连着重新渲染了
 * 三次（每次 create_new_job=true，source_artifact_job_id 指向上一次）。前端「找最近一个不是
 * 渲染的翻译任务」一个都找不到，退回链尾那次重新渲染，拿它去查阶段动作；后端回一句英文
 * 「refine writes revisions back into this job's own <job_root>/translated … refine the source
 * job instead」，原样显示在「精修译文」那一行上。 */
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { makeDom } from "../helpers/dom.mjs";
import { resolveTranslationOwnerId } from "../../src/features/book-detail/domain/translation-owner.js";
import { stageDisabledReasonText } from "../../src/features/book-detail/domain/stage-disabled-reason.js";

// 取自真实数据（Theorems of Molecular Quantum 那本书）。
const JOBS = {
  "20261006133813-41a078": { workflow: "render", source_artifact_job_id: "20261006133813-41a078" }, // 原始任务，就地精修过
  "20261006134509-690603": { workflow: "render", source_artifact_job_id: "20261006133813-41a078" },
  "20261006134628-96126f": { workflow: "render", source_artifact_job_id: "20261006134509-690603" },
  "20261009063545-26a88a": { workflow: "render", source_artifact_job_id: "20261006134628-96126f" },
  "book-1": { workflow: "book", source_artifact_job_id: "ocr-1" }, // 复用 OCR 的翻译任务：来源指向 OCR，但译文是它自己的
};
const readJob = async (id) => JOBS[id] || null;

test("沿着重新渲染的链找到持有译文的原始任务（就地精修过、类型已是渲染）", async () => {
  assert.equal(await resolveTranslationOwnerId("20261009063545-26a88a", readJob), "20261006133813-41a078");
});

test("翻译任务自己就是持有者，哪怕它的来源指向复用的 OCR 任务", async () => {
  assert.equal(await resolveTranslationOwnerId("book-1", readJob), "book-1");
});

test("来源成环或读不到时停下，不死循环", async () => {
  const loop = { a: { workflow: "render", source_artifact_job_id: "b" }, b: { workflow: "render", source_artifact_job_id: "a" } };
  assert.ok(["a", "b"].includes(await resolveTranslationOwnerId("a", async (id) => loop[id])));
  assert.equal(await resolveTranslationOwnerId("x", async () => null), "x");
});

test("阶段动作和精修都发给持有者，不是链尾的重新渲染任务", async () => {
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div></body></html>" });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useBookDetailStageActions } = await import("../../src/features/book-detail/ui/use-book-detail-stage-actions.js");
  const asked = [];
  const retried = [];
  let api = null;
  const loadingHistory = [];
  function Probe() {
    api = useBookDetailStageActions({
      open: true,
      job: { job_id: "20261009063545-26a88a", workflow: "render", status: "succeeded", document_id: "doc-1" },
      actions: {
        getJobStageActions: async (id) => {
          asked.push(id);
          return { job_id: id, stages: [{ stage: "refine", label: "精修译文", can_retry: true, action: { body: { stage: "refine" } } }] };
        },
        retryJobStage: async (...args) => { retried.push(args); return { job_id: args[0], workflow: "render" }; },
      },
      readJob,
    });
    loadingHistory.push(api.loading);
    return null;
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  try {
    root.render(React.createElement(Probe));
    await waitFor(() => api?.stageActions?.some((action) => action.stage === "refine"), "读到精修能力");
    assert.equal(loadingHistory[0], true, "找持有者期间要显示加载中，不能先闪出一句不可用原因");
    // 测试里 actions 每次渲染都是新对象，会多查几次；要紧的是每次查的都是持有者。
    assert.ok(asked.length > 0 && asked.every((id) => id === "20261006133813-41a078"), `阶段动作查的不是持有者：${asked}`);
    await api.retry("refine");
    assert.equal(retried[0][0], "20261006133813-41a078", "精修发给了链尾的重新渲染任务");
    assert.equal(retried[0][2].document_id, "doc-1");
  } finally {
    root.unmount();
    dom.window.close();
  }
});

test("后端的英文不可用原因翻成中文；认不得的不把英文甩给用户", () => {
  assert.match(
    stageDisabledReasonText("refine writes revisions back into this job's own <job_root>/translated, but this job renders translations owned by another job (created with create_new_job=true); refine the source job instead"),
    /更早的翻译任务/,
  );
  assert.match(stageDisabledReasonText("job is queued or running; cancel it before retrying a stage"), /先取消/);
  assert.equal(stageDisabledReasonText("some brand new backend reason"), "暂时不可用。");
  assert.equal(stageDisabledReasonText("正在确认可用性"), "正在确认可用性");
});
