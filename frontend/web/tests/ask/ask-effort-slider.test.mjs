/** 思考强度的胶囊滑块（packages/ask/src/ui/elements/effort-slider.tsx，改自 zanwei/claude-model-selector）：
 * 档位照调用方给的、颜色按档位位置、键盘换档、点轨道落到最近一档、方向键不漏给外面的模型列表、外面改了跟着跳。 */
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

test("胶囊滑块：几档都行、键盘和点轨道换档、颜色按位置、方向键不往外传", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  const keys = ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "Element", "Node", "Event", "KeyboardEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "addEventListener", "removeEventListener"];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  for (const key of keys) {
    const value = typeof dom.window[key] === "function" && /^[a-z]/.test(key) ? dom.window[key].bind(dom.window) : dom.window[key];
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { EffortSlider } = await import("../../../packages/ask/src/ui/elements/effort-slider.tsx");
    const levels = [{ id: "off", name: "off" }, { id: "low", name: "low" }, { id: "high", name: "high" }, { id: "max", name: "max" }];
    const changes = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
    // 机器忙（整套测试并发跑）时 React 落地慢：等到条件成立，最多 2 秒。
    const until = async (check) => {
      for (let index = 0; index < 100 && !check(); index += 1) await settle();
    };
    const draw = (value, list = levels) => root.render(React.createElement(EffortSlider, { levels: list, value, onChange: (id) => changes.push(id), colorAt: (index, count) => `c${index}/${count}` }));

    const slider = () => document.querySelector("[data-slot=effort-slider]");
    const input = () => slider().querySelector("input[type=range]");
    draw("low");
    await until(() => slider()?.querySelector(".aui-effort-slider-in")?.textContent === "low");
    assert.equal(input().getAttribute("max"), "3", "agent 给四档就四档");
    assert.equal(input().getAttribute("aria-valuetext"), "low");
    assert.equal(slider().querySelector(".aui-effort-slider-in").textContent, "low", "名字照 agent 给的");
    assert.equal(slider().style.getPropertyValue("--effort-color"), "c1/4", "颜色按档位位置");
    assert.equal(slider().style.getPropertyValue("--effort-top-color"), "c3/4");
    assert.equal(slider().querySelectorAll(".aui-effort-slider-ticks > span").length, 4);

    let leaked = 0;
    document.addEventListener("keydown", () => (leaked += 1));
    input().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await until(() => changes.length === 1);
    assert.deepEqual(changes, ["high"], "→ 往强一档");
    assert.equal(leaked, 0, "方向键不传给外面（弹层里的模型列表也听方向键）");
    input().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await until(() => changes.length === 2);
    input().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await until(() => changes.length === 3);
    assert.deepEqual(changes, ["high", "max", "off"]);

    // 不是拖（读屏软件、点轨道没按住）：落到最近一档。
    changes.length = 0;
    draw("off");
    await until(() => input().getAttribute("aria-valuetext") === "off");
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
    setValue.call(input(), "1.7");
    input().dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await until(() => changes.length === 1);
    assert.deepEqual(changes, ["high"]);

    // 外面改了（agent 推来的）：跟着跳，不回调。
    changes.length = 0;
    draw("max");
    await until(() => input().getAttribute("aria-valuetext") === "max");
    assert.equal(input().getAttribute("aria-valuetext"), "max");
    assert.equal(slider().style.getPropertyValue("--effort-progress"), "1");
    assert.deepEqual(changes, []);

    // 两档（Qwen 的开 / 关）也行；只有一档没得选，不画。
    draw("on", [{ id: "off", name: "关" }, { id: "on", name: "开" }]);
    await until(() => input().getAttribute("aria-valuetext") === "开");
    assert.equal(input().getAttribute("max"), "1");
    assert.equal(input().getAttribute("aria-valuetext"), "开");
    draw("x", [{ id: "x", name: "x" }]);
    await until(() => slider() === null);
    assert.equal(slider(), null);
    root.unmount();
    await new Promise((resolve) => setTimeout(resolve, 100));
  } finally {
    for (const [key, value] of Object.entries(previous)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    dom.window.close();
  }
});
