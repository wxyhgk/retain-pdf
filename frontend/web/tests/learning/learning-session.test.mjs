/** 学习区（@retainpdf/learning）的规则和界面：知识点状态只跟答题证据走，提示一级一级给，说「懂了」不算会。
 * 设计见 docs/ops/planning/learning-system/20261125-学习区界面.md。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  MAX_HINT_LEVEL,
  initialSession,
  sessionReducer,
  statusCounts,
  matchCanned,
  firstStuckPoint,
} from "../../../packages/learning/src/state/session.ts";
import { LearningPane, pointMarkers, contextPointId } from "../../../packages/learning/src/ui/LearningPane.tsx";
import { SZABO_CH3_COURSE as course, SZABO_JOB_ID } from "../../../packages/learning/src/demo/szabo-ch3.ts";
import { courseForReader } from "../../src/app/reader/learning-side-pane.tsx";

const run = (state, ...actions) => actions.reduce((current, action) => sessionReducer(course, current, action), state);
const today = "11/25";

test("演示数据：17 个知识点、每个都锚在书上；题和讲解都对得上", () => {
  assert.equal(course.points.length, 17);
  assert.deepEqual(statusCounts(initialSession(course)), { known: 4, stuck: 1, suspect: 1, untested: 11 });
  for (const point of course.points) {
    assert.ok(point.anchor.page >= 1 && /^p\d{3}-b\d{3}$/.test(point.anchor.itemId), `${point.id} 锚点`);
    for (const id of point.itemIds) assert.equal(course.items[id]?.pointId, point.id, `${point.id} 的题 ${id}`);
    for (const id of [point.scriptId, point.exampleScriptId].filter(Boolean)) assert.ok(course.scripts[id], `${point.id} 的讲解 ${id}`);
    for (const id of point.prereqs) assert.ok(course.points.some((other) => other.id === id), `${point.id} 的前置 ${id}`);
  }
  for (const item of Object.values(course.items)) {
    assert.ok(item.answer >= 0 && item.answer < item.options.length, `${item.id} 答案下标`);
    assert.ok(item.hints.length + 1 <= MAX_HINT_LEVEL, `${item.id} 提示不超过 5 级`);
  }
});

test("不看提示第一次答对 → 会了；看了提示才对 → 还不算会", () => {
  let state = run(initialSession(course), { type: "startQuiz", pointId: "roothaan" }, { type: "choose", choice: 0 }, { type: "submit", today });
  assert.equal(state.statuses.roothaan, "known");
  assert.equal(state.evidence.roothaan.at(-1).text, "新题首次答对");

  state = run(initialSession(course),
    { type: "startQuiz", pointId: "rhf" },
    { type: "choose", choice: 2 }, { type: "submit", today },
    { type: "hint", today },
    { type: "choose", choice: 1 }, { type: "submit", today });
  assert.equal(state.screen.result, "correct");
  assert.equal(state.statuses.rhf, "stuck", "提示后才对：没测过的记成卡住");
  assert.match(state.evidence.rhf.at(-1).text, /第 1 级提示后答对/);
});

test("诊断题信心 4、5 分答错 → 疑似误解；选「我不知道」只算卡住", () => {
  const sure = run(initialSession(course),
    { type: "startQuiz", pointId: "rhf" }, { type: "choose", choice: 0 }, { type: "confidence", value: 5 }, { type: "submit", today });
  assert.equal(sure.statuses.rhf, "suspect");
  const unsure = run(initialSession(course),
    { type: "startQuiz", pointId: "rhf" }, { type: "choose", choice: 0 }, { type: "confidence", value: 2 }, { type: "submit", today });
  assert.equal(unsure.statuses.rhf, "stuck");
  const dontKnow = run(initialSession(course),
    { type: "startQuiz", pointId: "rhf" }, { type: "choose", choice: 3 }, { type: "confidence", value: 5 }, { type: "submit", today });
  assert.equal(dontKnow.statuses.rhf, "stuck");
  assert.equal(dontKnow.evidence.rhf.at(-1).text, "选了「我不知道」");
});

test("提示一次只升一级；最后一级直接给答案，这题记为答错", () => {
  let state = run(initialSession(course), { type: "startQuiz", pointId: "fock" }, { type: "hint", today });
  assert.equal(state.screen.hintLevel, 1);
  state = run(state, { type: "hint", today }, { type: "hint", today });
  assert.equal(state.screen.hintLevel, 3);
  const hints = course.items["fock-1"].hints.length;
  for (let i = 0; i < 10; i += 1) state = run(state, { type: "hint", today });
  assert.equal(state.screen.hintLevel, hints + 1, "不会越过最后一级");
  assert.equal(state.screen.result, "wrong");
  assert.equal(state.screen.choice, course.items["fock-1"].answer, "答案标出来");
  assert.equal(state.statuses.fock, "stuck");
});

test("讲完说「懂了」不改状态，出下一道题验证；做完回到知识点", () => {
  let state = run(initialSession(course), { type: "startQuiz", pointId: "fock" }, { type: "choose", choice: 0 }, { type: "submit", today });
  const before = state.statuses.fock;
  state = run(state, { type: "explain", pointId: "fock" });
  assert.equal(state.screen.kind, "explain");
  assert.equal(state.screen.scriptId, "fock");
  state = run(state, { type: "understood" });
  assert.equal(state.statuses.fock, before, "说懂了不算会");
  assert.deepEqual([state.screen.kind, state.screen.itemIndex], ["quiz", 1], "换一道新题");
  state = run(state, { type: "startQuiz", pointId: "fock", itemIndex: 2 }, { type: "choose", choice: 0 }, { type: "submit", today }, { type: "nextItem" });
  assert.deepEqual([state.screen.kind, state.notice], ["point", "这个点的题做完了。"]);
});

test("没有题、没有讲解的点给一句说明，不报错", () => {
  const state = run(initialSession(course), { type: "startQuiz", pointId: "density" });
  assert.equal(state.screen.kind, "point");
  assert.match(state.notice, /还没有题/);
  assert.match(run(state, { type: "explain", pointId: "density" }).notice, /还没有讲解/);
});

test("提问：按关键词配写死的回答；配不上时说还没接模型，并带上页码和正在学的点", () => {
  assert.equal(matchCanned(course.canned, "为什么要自洽迭代？").pointId, "scf");
  let state = run(initialSession(course), { type: "ask", question: "为什么要自洽迭代？", currentPage: 160 });
  assert.equal(state.screen.kind, "ask");
  assert.equal(state.asked.scf, 1);
  state = run(initialSession(course), { type: "ask", question: "随便问问", contextPointId: "fock", currentPage: 129 });
  assert.match(state.screen.answer, /第 129 页.*Fock 算符/);
  assert.equal(run(initialSession(course), { type: "ask", question: "   ", currentPage: 1 }).screen.kind, "map", "空问题不算");
});

test("页边小圆点：颜色跟状态走；提问框的上下文优先正在看的点，否则是这一页上的点", () => {
  const state = initialSession(course);
  const markers = Object.fromEntries(pointMarkers(course, state.statuses).map((marker) => [marker.key, marker]));
  assert.deepEqual([markers.fock.tone, markers.koopmans.tone, markers.eigen.tone], ["danger", "warn", "ok"]);
  assert.equal(markers.scf.hollow, true);
  assert.equal(contextPointId(course, state, 151), "roothaan");
  assert.equal(contextPointId(course, run(state, { type: "openPoint", pointId: "fock" }), 151), "fock");
  assert.equal(firstStuckPoint(course, state).id, "fock");
});

test("学习区渲染：本章地图有每个知识点、计数和提问框", () => {
  const html = renderToStaticMarkup(createElement(LearningPane, {
    course,
    host: { currentPage: 129, navigate: () => "block", setMarkers: () => {} },
  }));
  assert.match(html, /data-lp-screen="map"/);
  assert.equal((html.match(/data-lp-point=/g) || []).length, 17);
  assert.match(html, /会了 4/);
  assert.match(html, /class="lp-point-row is-on-page"[^>]*data-lp-point="fock"/, "这一页上的点高亮");
  assert.match(html, /placeholder="随时问一句……"/);
});

test("web：演示模式里一直有「学习」页签；真书只在 Szabo 那本任务上有", () => {
  assert.equal(courseForReader({ documentId: "", jobId: "x" }, true)?.id, "szabo-ch3");
  assert.equal(courseForReader({ documentId: "", jobId: SZABO_JOB_ID }, false)?.id, "szabo-ch3");
  assert.equal(courseForReader({ documentId: "d", jobId: "other" }, false), null);
});
