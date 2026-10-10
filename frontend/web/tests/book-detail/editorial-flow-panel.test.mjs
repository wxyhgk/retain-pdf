// 编辑部流程图组件：轮询事件流，画出当前这一步和第几轮；停用后不再拉。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { makeDom as makeDomWith } from "../helpers/dom.mjs";

const makeDom = () => makeDomWith("", {
  html: "<!doctype html><html><body><div id='root'></div></body></html>",
  keys: ["window", "document", "HTMLElement", "Element", "SVGElement", "Event", "Node", "MutationObserver"],
});

const observation = (phase, extra = {}) => ({
  substage: "refining",
  stage_detail: `${phase}`,
  payload: { observation: { refine_phase: phase, refine_mode: "editorial", refine_max_rounds: 2, ...extra } },
});

test("流程图随事件推进：挑错第几批 → 第 1 轮主编分流", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { EditorialFlowPanel } = await import("../../src/features/book-detail/ui/panels/processing/EditorialFlowPanel.jsx");
  const { useEditorialFlow } = await import("../../src/features/book-detail/ui/use-editorial-flow.js");

  let pages = [
    [observation("start"), observation("review", { batch_done: 4, batch_total: 55 })],
    [observation("start"), observation("review", { batch_done: 55, batch_total: 55 }), observation("chief", { refine_round: 1 })],
  ];
  const fetched = [];
  const fetchEvents = async (jobId) => {
    fetched.push(jobId);
    return { items: pages.length > 1 ? pages.shift() : pages[0] };
  };
  function Host({ enabled }) {
    const flow = useEditorialFlow("job-1", enabled, { fetchEvents, intervalMs: 20 });
    return React.createElement(EditorialFlowPanel, { flow });
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Host, { enabled: true }));
  const doc = dom.window.document;

  const review = await waitFor(() => doc.querySelector('[data-flow-node="review"][data-state="active"]'), "挑错进行中");
  assert.match(review.textContent, /4\/55 批/);
  await waitFor(() => doc.querySelector('[data-flow-node="chief"][data-state="active"]'), "进入第 1 轮主编分流");
  assert.match(doc.querySelector(".editorial-flow-loop-label").textContent, /第 1 \/ 2 轮/);
  assert.equal(doc.querySelector('[data-flow-node="review"]').dataset.state, "done");
  assert.equal(fetched[0], "job-1");

  root.render(React.createElement(Host, { enabled: false }));
  await waitFor(() => !doc.querySelector("[data-editorial-flow]"), "停用后不画");
  const count = fetched.length;
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(fetched.length, count, "停用后不再轮询");
  root.unmount();
});
