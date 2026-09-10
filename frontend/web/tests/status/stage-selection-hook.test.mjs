import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/index.html",
  });
  for (const key of ["window", "document", "HTMLElement", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

function wait(ms = 25) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("阶段选择对 null / undefined / 空串等价输入不追加状态更新", async () => {
  const dom = installDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useStageSelection } = await import(
    "../../src/features/jobs/ui/useStageSelection.js"
  );
  let renderCount = 0;

  function Harness({ jobId, currentStageKey }) {
    renderCount += 1;
    const selection = useStageSelection({ jobId, currentStageKey });
    return React.createElement("span", null, selection.currentStageKey || "idle");
  }

  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Harness, { jobId: null, currentStageKey: null }));
  await wait();
  const beforeEquivalentUpdate = renderCount;

  root.render(React.createElement(Harness, {
    jobId: undefined,
    currentStageKey: undefined,
  }));
  await wait();

  assert.equal(
    renderCount,
    beforeEquivalentUpdate + 1,
    "等价输入只能产生父级请求的一次 render，effect 不得再写一轮 state",
  );

  root.unmount();
});
