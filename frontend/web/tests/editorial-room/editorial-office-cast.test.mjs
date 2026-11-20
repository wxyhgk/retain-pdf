/** 2.5D 编辑部拆开以后各层的约定：状态 → 工位样子是纯函数；角色只认角色和样子；工位表每行都有样子可用。 */
import test from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../helpers/dom.mjs";

import { buildDemoEditorialRun } from "../../src/features/editorial-room/domain/demo-run.ts";
import { roomStateAt } from "../../src/features/editorial-room/domain/room-state.ts";
import { officeModel } from "../../src/features/editorial-room/ui/office/station-model.ts";

const events = buildDemoEditorialRun();
const stateAfter = (predicate) => roomStateAt(events, events.findIndex(predicate) + 1);

test("工位样子：第 1 页在审、第 2 页刚开翻时，译者和审校忙、在动，牌子和悬停写页码；通读员、修订闲着", () => {
  const model = officeModel(stateAfter((e) => e.type === "translate_call" && e.page === 2));
  const { translator, reviewer, reader, reviser, dispatcher } = model.stations;
  assert.deepEqual([translator.busy, translator.moving, translator.tag, translator.holding], [true, true, "翻译第 2 页", "2"]);
  assert.match(translator.hint, /第 2 页，第 1 次 · 8 块/);
  assert.deepEqual([reviewer.busy, reviewer.tag], [true, "审第 1 页"]);
  assert.deepEqual([reader.busy, reader.tag, reviser.busy, reviser.tag], [false, "", false, ""]);
  assert.equal(dispatcher.busy, true, "还有页没派");
  assert.equal(model.running, true);
});

test("工位样子：停下以后有活的定格（忙但不动）；跑完都闲着、档案柜 6 页", () => {
  const stopped = roomStateAt(buildDemoEditorialRun({ stopAfterPage: 4 }), Infinity);
  const quiet = officeModel({ ...stopped, pages: stopped.pages.map((card) => (card.page === 5 ? { ...card, stage: "translating" } : card)) });
  assert.deepEqual([quiet.stations.translator.busy, quiet.stations.translator.moving], [true, false]);
  const done = officeModel(roomStateAt(events, events.length));
  assert.ok(Object.values(done.stations).every((view) => !view.busy && !view.tag));
  assert.equal(done.done.length, 6);
  assert.equal(done.gate, "off");
});

test("质检灯：退回重翻那一刻亮红，有警告亮黄", () => {
  assert.equal(officeModel(stateAfter((e) => e.type === "check_result" && e.error > 0)).gate, "error");
  assert.equal(officeModel(stateAfter((e) => e.type === "check_result" && e.warn > 0)).gate, "warn");
});

test("角色只认角色和样子：三种样子各打标记，闲着闭眼、有活睁眼；不读编辑部状态", async () => {
  makeDom();
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Person } = await import("../../src/features/editorial-room/ui/office/cast/Person.tsx");
  const { Robot } = await import("../../src/features/editorial-room/ui/office/cast/Robot.tsx");
  for (const role of ["reader", "translator", "reviewer"]) {
    for (const pose of ["idle", "busy", "moving"]) {
      const html = renderToStaticMarkup(React.createElement("svg", null, React.createElement(Person, { role, pose })));
      assert.match(html, new RegExp(`class="office-cast is-person is-${role} is-${pose}"`));
      assert.match(html, /office-cast-eye-shut/, "闭眼的线一直在，靠 CSS 按样子显示");
    }
  }
  const reader = renderToStaticMarkup(React.createElement("svg", null, React.createElement(Person, { role: "reader", pose: "moving" })));
  assert.match(reader, /office-cast-page/, "通读员捧书、书页能翻");
  const translator = renderToStaticMarkup(React.createElement("svg", null, React.createElement(Person, { role: "translator", pose: "moving" })));
  assert.match(translator, /office-cast-phones/);
  assert.equal((translator.match(/office-cast-tap/g) || []).length, 2, "两只手轮流敲");
  const dispatcher = renderToStaticMarkup(React.createElement("svg", null, React.createElement(Robot, { role: "dispatcher", pose: "busy" })));
  assert.match(dispatcher, /office-cast-board/, "调度举着夹板");
  const reviser = renderToStaticMarkup(React.createElement("svg", null, React.createElement(Robot, { role: "reviser", pose: "idle" })));
  assert.match(reviser, /office-cast-pen/);
  assert.doesNotMatch(reviser, /office-cast-board/);
});

test("工位表：每行在工位样子里都有；人有椅子和木桌，桌上的东西都认得", async () => {
  makeDom();
  const { STATIONS } = await import("../../src/features/editorial-room/ui/office/stations.tsx");
  const model = officeModel(roomStateAt(events, 0));
  for (const spec of STATIONS) {
    assert.ok(model.stations[spec.id], `${spec.id} 有样子`);
    if (spec.actor.kind === "person") {
      assert.equal(spec.chair, true);
      assert.equal(spec.desk.tone, "wood");
    }
    for (const item of spec.items || []) assert.match(item.kind, /^(laptop|monitor|books|mug|lamp|papers|marked-papers)$/);
  }
  assert.deepEqual(STATIONS.map((spec) => spec.id).sort(), ["dispatcher", "reader", "reviewer", "reviser", "translator"]);
});
