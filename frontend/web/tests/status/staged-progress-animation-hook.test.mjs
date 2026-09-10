import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function wait(ms = 80) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("进度输入对象每次重建时不会触发 React #185", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/index.html",
  });
  for (const key of ["window", "document", "HTMLElement", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      configurable: true,
      writable: true,
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useStagedProgressAnimation } = await import(
    "../../src/features/jobs/ui/useStagedProgressAnimation.js"
  );
  let renderCount = 0;

  function Harness() {
    renderCount += 1;
    const options = useStagedProgressAnimation({
      selected: "translate",
      selectedIsCurrent: true,
      // 模拟详情卡每次 render 重新组装的两个对象。
      snapshot: {
        status: "failed",
        progressPercent: new Number(100),
        progressFallbackText: new String("任务失败"),
      },
      selectedProgress: {
        current: new Number(100),
        total: new Number(100),
        progressUnit: new String("percent"),
        displayPercent: new Number(100),
        progressText: new String("100%"),
        indeterminate: false,
      },
      jobId: "job-react-185",
    });
    return React.createElement("output", null, options?.progressText || "loading");
  }

  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Harness));
  await wait();

  assert.equal(dom.window.document.querySelector("output")?.textContent, "100%");
  assert.ok(renderCount <= 3, `稳定输入不应持续重渲染，实际 ${renderCount} 次`);

  root.unmount();
  dom.window.close();
});
