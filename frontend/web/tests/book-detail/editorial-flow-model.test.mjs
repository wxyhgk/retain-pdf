// 编辑部流程图：从事件流还原走到哪一步、第几轮、这一步第几批。
import test from "node:test";
import assert from "node:assert/strict";
import { editorialFlowModel } from "../../src/features/book-detail/domain/editorial-flow-model.js";

let seq = 0;
// 和接口返回的形状一致：流水线载荷在 payload.observation 里。
function ev(phase, text, extra = {}) {
  seq += 1;
  return {
    seq,
    substage: "refining",
    stage_detail: text,
    payload: { observation: { refine_phase: phase, refine_mode: "editorial", ...extra } },
  };
}
const R = { refine_max_rounds: 2 };
const states = (nodes) => Object.fromEntries(nodes.map((node) => [node.key, node.state]));

test("挑错进行中：前面打勾，挑错这一步写第几批，循环还没开始", () => {
  const flow = editorialFlowModel([
    ev("start", "编辑部开始处理译文"),
    ev("prepare", "编辑部：读取译文与质检结果", { ...R, refine_round: 0 }),
    ev("review", "编辑部：审校开始挑错（708 块）", { ...R, refine_round: 0 }),
    ev("review", "精修：挑错已完成 12/55 批", { ...R, refine_round: 0, batch_done: 12, batch_total: 55 }),
  ]);
  assert.deepEqual(states(flow.before), { prepare: "done", review: "active", terms: "pending" });
  assert.equal(flow.before[1].detail, "12/55 批");
  assert.deepEqual(states(flow.loop), { chief: "pending", revise: "pending", recheck: "pending" });
  assert.equal(flow.round, 0);
  assert.equal(flow.maxRounds, 2);
  assert.equal(flow.finished, false);
});

test("第 2 轮主编分流：第 1 轮的修改和复核回到等待，轮次写 2/2", () => {
  const flow = editorialFlowModel([
    ev("start", "编辑部开始处理译文"),
    ev("prepare", "读取", R),
    ev("review", "挑错已完成 55/55 批", { ...R, batch_done: 55, batch_total: 55 }),
    ev("chief", "编辑部：第 1 轮，主编分流 190 块", { ...R, refine_round: 1 }),
    ev("fix", "编辑部：第 1 轮局部修改 3/3 批", { ...R, refine_round: 1, batch_done: 3, batch_total: 3 }),
    ev("recheck", "编辑部：审校复核第 1 轮改过的 106 块", { ...R, refine_round: 1 }),
    ev("chief", "编辑部：第 2 轮，主编分流 103 块", { ...R, refine_round: 2 }),
  ]);
  assert.deepEqual(states(flow.before), { prepare: "done", review: "done", terms: "skipped" });
  assert.equal(flow.before[2].detail, "没有要统一的词");
  assert.deepEqual(states(flow.loop), { chief: "active", revise: "pending", recheck: "pending" });
  assert.equal(flow.loop[0].detail, "第 2 轮，主编分流 103 块");
  assert.equal(flow.round, 2);
});

test("旧任务的事件没有 refine_round：退回 observation.round，修改步沿用当前轮", () => {
  const flow = editorialFlowModel([
    ev("start", "编辑部开始处理译文"),
    ev("review", "编辑部：审校开始挑错（708 块）"),
    ev("terms", "编辑部：术语专员巡检 1/1 批"),
    ev("chief", "编辑部：第 1 轮，主编分流 190 块", { round: 1 }),
    ev("rewrite", "编辑部：第 1 轮整块重写 2/5 批"),
  ]);
  assert.equal(flow.round, 1);
  assert.equal(flow.maxRounds, 2, "没有 refine_max_rounds 时按 2 轮");
  assert.deepEqual(states(flow.loop), { chief: "done", revise: "active", recheck: "pending" });
  assert.equal(flow.before[2].state, "done");
});

test("精修完成：全部打勾，排版进行中，带后端总结", () => {
  const flow = editorialFlowModel([
    ev("start", "编辑部开始处理译文"),
    ev("review", "挑错", R),
    ev("chief", "第 1 轮", { ...R, refine_round: 1 }),
    ev("recheck", "复核", { ...R, refine_round: 1 }),
    ev("done", "精修完成：发现 41 处，改了 30 处"),
  ]);
  assert.equal(flow.finished, true);
  assert.deepEqual(states(flow.loop), { chief: "done", revise: "done", recheck: "done" });
  assert.equal(flow.after[0].state, "active");
  assert.equal(flow.summary, "精修完成：发现 41 处，改了 30 处");
});

test("只看最后一次精修；普通精修和没有精修事件时不画", () => {
  const rerun = editorialFlowModel([
    ev("start", "编辑部开始处理译文"),
    ev("done", "上一次精修完成"),
    ev("start", "编辑部开始处理译文"),
    ev("prepare", "读取", R),
  ]);
  assert.equal(rerun.finished, false);
  assert.equal(rerun.before[0].state, "active");

  const plain = editorialFlowModel([{ substage: "refining", payload: { observation: { refine_phase: "review", refine_mode: "review_and_fix" } } }]);
  assert.equal(plain, null);
  assert.equal(editorialFlowModel([{ substage: "render_prepare", payload: {} }]), null);
  assert.equal(editorialFlowModel(null), null);
});

test("任务停了（失败 / 取消）时当前这一步标成「已停下」，不再闪", () => {
  const flow = editorialFlowModel([
    ev("start", "编辑部开始处理译文"),
    ev("review", "挑错已完成 3/55 批", { ...R, batch_done: 3, batch_total: 55 }),
  ], { jobActive: false });
  assert.equal(flow.before[1].state, "stopped");
});
