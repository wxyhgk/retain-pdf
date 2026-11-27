/** 提问窗的模型和思考强度：ACP 的 configOptions 归一化、新会话把用户选过的值再设一次、agent 推来的变化交给窗口、提前开会话。 */
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeConfigOptions, pendingConfig } from "../../../packages/ask/src/acp/config.ts";
import { PermissionStore, createAcpChatAdapter } from "../../../packages/ask/src/acp/adapter.ts";
import { EffortRow, currentEffort, currentModelBrand, effortColor, isThinkingSwitch, levelName, splitConfig, toModelOptions } from "../../../packages/ask/src/window/AskModelPicker.tsx";
import { JSDOM } from "jsdom";

/** 本机 Claude Code 适配器（claude-agent-acp）session/new 真给的样子（2026-11-26 本机握手抄的，选项删短了）。 */
const CLAUDE_CODE = [
  { id: "model", name: "Model", category: "model", type: "select", currentValue: "opus", options: [{ value: "default", name: "Default" }, { value: "opus", name: "Opus" }, { value: "haiku", name: "Haiku" }] },
  { id: "effort", name: "Effort", category: "thought_level", type: "select", currentValue: "high", options: [{ value: "low", name: "Low" }, { value: "high", name: "High" }, { value: "max", name: "Max" }] },
  { id: "fast", name: "Fast", category: "speed", type: "select", currentValue: "off", options: [{ value: "off", name: "Off" }, { value: "on", name: "On" }] },
  { id: "mode", name: "Mode", category: "mode", type: "select", currentValue: "auto", options: [{ group: "g", name: "Modes", options: [{ value: "auto", name: "Auto" }, { value: "plan", name: "Plan", description: "先出计划" }] }] },
  { id: "flag", name: "Flag", type: "boolean", currentValue: true },
  { name: "没有 id 的跳过" },
];

test("ACP 的设置项归一化：分组的可选值摊平记组名，boolean 照样认，没有 id 的跳过", () => {
  const options = normalizeConfigOptions(CLAUDE_CODE);
  assert.deepEqual(options.map((option) => option.id), ["model", "effort", "fast", "mode", "flag"]);
  assert.deepEqual(options[3].options, [{ value: "auto", name: "Auto", group: "Modes" }, { value: "plan", name: "Plan", description: "先出计划", group: "Modes" }]);
  assert.deepEqual(options[4], { id: "flag", name: "Flag", type: "boolean", currentValue: true, options: [] });
  assert.deepEqual(normalizeConfigOptions(null), []);
});

test("用户选过的值：只设和现在不一样、agent 又认的", () => {
  const options = normalizeConfigOptions(CLAUDE_CODE);
  assert.deepEqual(pendingConfig(options, { model: "haiku", effort: "high", mode: "nope", gone: "x", flag: false }), [["model", "haiku"], ["flag", false]]);
});

test("选择器：模型、思考强度分出来，别的进「更多」；每个模型带同一份思考档位，档位和名字都照 agent 给的", () => {
  const { model, thought, rest } = splitConfig(normalizeConfigOptions(CLAUDE_CODE));
  assert.equal(model.id, "model");
  assert.equal(thought.id, "effort");
  assert.deepEqual(rest.map((option) => option.id), ["fast", "mode", "flag"]);
  const models = toModelOptions(model, thought);
  const { icon, ...opus } = models[1];
  assert.ok(icon, "模型带厂商图标");
  assert.deepEqual(opus, { id: "opus", name: "Opus", efforts: [{ id: "low", name: "Low" }, { id: "high", name: "High" }, { id: "max", name: "Max" }] });
});

test("思考强度的颜色只看档位在 agent 列表里的位置：第一档灰，往后绿 → 橙 → 红，几档都行", () => {
  assert.equal(effortColor(0, 5), "var(--muted)");
  assert.equal(effortColor(1, 5), "color-mix(in srgb, var(--warn) 50%, var(--ok))");
  assert.equal(effortColor(2, 5), "color-mix(in srgb, var(--warn) 100%, var(--ok))");
  assert.equal(effortColor(4, 5), "color-mix(in srgb, var(--danger) 100%, var(--warn))");
  assert.equal(effortColor(1, 2), "var(--warn)", "只有开 / 关：开着是橙色，不是最强的红（2026-11-27）");
  assert.equal(effortColor(-1, 3), "var(--muted)", "当前值不在列表里");
});

test("适配层：提前开会话交出设置项并把用户选过的再设一次；agent 推来的变化也交出去；发问用同一个会话", async () => {
  const calls = [];
  let opened = 0;
  let handlers;
  const port = {
    listAgents: async () => [],
    openSession: async (_options, h) => {
      opened += 1;
      handlers = h;
      let config = normalizeConfigOptions(CLAUDE_CODE);
      return {
        configOptions: config,
        setConfigOption: async (id, value) => {
          calls.push([id, value]);
          config = config.map((option) => (option.id === id ? { ...option, currentValue: value } : option));
          return config;
        },
        prompt: async () => {
          handlers.onUpdate({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "好" } });
          return { stopReason: "end_turn" };
        },
        cancel() {},
        close() {},
      };
    },
  };
  const seen = [];
  const chat = createAcpChatAdapter({
    port,
    permissions: new PermissionStore(),
    getAgentId: () => "claude-code",
    getContext: () => null,
    onConfig: (options) => seen.push(options.map((option) => `${option.id}=${option.currentValue}`).join(",")),
    getDesiredConfig: () => ({ model: "haiku" }),
  });
  await Promise.all([chat.prepare(), chat.prepare()]);
  assert.equal(opened, 1, "同时提前开两次只开一个会话");
  assert.deepEqual(calls, [["model", "haiku"]], "用户选过的模型再设一次");
  assert.match(seen.at(-1), /model=haiku,effort=high/);

  assert.equal(await chat.setConfig("effort", "max"), true);
  assert.match(seen.at(-1), /effort=max/);

  handlers.onUpdate({ sessionUpdate: "config_option_update", configOptions: [{ id: "model", name: "Model", category: "model", type: "select", currentValue: "opus", options: [] }] });
  assert.equal(seen.at(-1), "model=opus", "agent 自己改了也交给窗口");

  for await (const _ of chat.adapter.run({ messages: [{ role: "user", content: [{ type: "text", text: "Q" }] }], abortSignal: new AbortController().signal })) { /* 收完 */ }
  assert.equal(opened, 1, "发问用提前开好的会话");
});

test("设置是开会话时定的（reopenOnConfigChange，自带 agent）：改了关掉会话，下一问带上新设置重开、之前几轮照样带", async () => {
  const opens = [];
  const prompts = [];
  const port = {
    listAgents: async () => [],
    openSession: async (options, handlers) => {
      opens.push(options.config);
      let config = [{ id: "model", name: "模型", category: "model", type: "select", currentValue: options.config?.model || "a", options: [{ value: "a", name: "A" }, { value: "b", name: "B" }] }];
      let closed = false;
      return {
        configOptions: config,
        reopenOnConfigChange: true,
        setConfigOption: async (id, value) => (config = config.map((option) => (option.id === id ? { ...option, currentValue: value } : option))),
        prompt: async (blocks) => {
          assert.equal(closed, false, "关掉的会话不该再用");
          prompts.push(blocks.map((block) => block.text).join("\n"));
          handlers.onUpdate({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "答" } });
          return { stopReason: "end_turn" };
        },
        cancel() {},
        close() {
          closed = true;
        },
      };
    },
  };
  let desired = {};
  const chat = createAcpChatAdapter({ port, permissions: new PermissionStore(), getAgentId: () => "retainpdf", getContext: () => ({ label: "x", preamble: "出处" }), getDesiredConfig: () => desired, onConfig: () => {} });
  const run = async (messages) => { for await (const _ of chat.adapter.run({ messages, abortSignal: new AbortController().signal })) { /* 收完 */ } };
  const u = (t) => ({ role: "user", content: [{ type: "text", text: t }] });
  const a = (t) => ({ role: "assistant", content: [{ type: "text", text: t }], metadata: { custom: {} } });
  await run([u("Q1")]);
  desired = { model: "b" };
  await chat.setConfig("model", "b");
  await run([u("Q1"), a("答"), u("Q2")]);
  assert.deepEqual(opens, [{}, { model: "b" }], "第二个会话按新设置开");
  assert.match(prompts[1], /我：Q1\n\n你：答[\s\S]*出处[\s\S]*Q2/, "新会话带之前几轮和这一问的出处");
});

test("窗口的颜色和水印：当前思考强度的颜色（第一档算没开），当前模型的厂商", () => {
  const options = normalizeConfigOptions(CLAUDE_CODE);
  assert.deepEqual(currentEffort(options), { color: effortColor(1, 3), on: true }, "high 在 low / high / max 里排第二");
  const off = options.map((option) => (option.id === "effort" ? { ...option, currentValue: "low" } : option));
  assert.deepEqual(currentEffort(off), { color: "var(--muted)", on: false });
  assert.equal(currentEffort(options.filter((option) => option.category !== "thought_level")), null);
  assert.equal(currentModelBrand(options), "claude", "opus → Claude 的标志");
  const qwen = [{ id: "model", name: "模型", category: "model", type: "select", currentValue: "qwen::qwen3.8-flash", options: [{ value: "qwen::qwen3.8-flash", name: "qwen3.8-flash", group: "通义千问" }] }];
  assert.equal(currentModelBrand(qwen), "qwen");
  assert.equal(currentModelBrand([]), "");
});

test("按设置项判断要不要重开：换模型重开，思考强度直接交给 agent 改；新会话把选过的思考强度再设一次", async () => {
  const opens = [];
  const sets = [];
  let closes = 0;
  const port = {
    listAgents: async () => [],
    openSession: async (options) => {
      opens.push(options.config);
      let config = normalizeConfigOptions([
        { id: "model", name: "模型", category: "model", type: "select", currentValue: options.config?.model || "a", options: [{ value: "a", name: "A" }, { value: "b", name: "B" }] },
        { id: "thought", name: "思考", category: "thought_level", type: "select", currentValue: "low", options: [{ value: "low", name: "low" }, { value: "high", name: "high" }] },
      ]);
      return {
        configOptions: config,
        reopenOnConfigChange: (id) => id === "model",
        setConfigOption: async (id, value) => {
          sets.push([id, value]);
          return (config = config.map((option) => (option.id === id ? { ...option, currentValue: value } : option)));
        },
        prompt: async () => ({ stopReason: "end_turn" }),
        cancel() {},
        close() { closes += 1; },
      };
    },
  };
  let desired = {};
  const chat = createAcpChatAdapter({ port, permissions: new PermissionStore(), getAgentId: () => "retainpdf", getContext: () => null, getDesiredConfig: () => desired, onConfig: () => {} });
  await chat.prepare();
  desired = { thought: "high" };
  await chat.setConfig("thought", "high");
  assert.equal(closes, 0, "改思考强度不重开");
  assert.deepEqual(sets, [["thought", "high"]]);
  desired = { thought: "high", model: "b" };
  await chat.setConfig("model", "b");
  assert.equal(closes, 1, "换模型重开");
  await chat.prepare();
  assert.deepEqual(opens.at(-1), { thought: "high", model: "b" }, "新会话按新模型开");
  assert.deepEqual(sets.at(-1), ["thought", "high"], "新会话把选过的思考强度再设一次（模型那项是握手定的，不再设）");
});

/** 自带 agent（backend/ask-agent）报的样子：档位名就是值；Qwen3、DeepSeek 只有 off / on（2026-11-27 用户截图：一个两格的滑块写着红的「on」）。 */
const BUILTIN_SWITCH = { id: "thought_level", name: "思考强度", category: "thought_level", type: "select", currentValue: "on", options: [{ value: "off", name: "off" }, { value: "on", name: "on" }] };
const BUILTIN_LEVELS = { id: "thought_level", name: "思考强度", category: "thought_level", type: "select", currentValue: "high", options: ["low", "medium", "high", "max"].map((value) => ({ value, name: value })) };

test("档位名：agent 起了名字照它，名字就是值时认得的换中文；只有两档的是开关，按钮上开着写「思考」、关着不写", () => {
  assert.equal(levelName({ value: "high", name: "High" }), "High", "agent 起了名字（Claude Code 的 High）照原样");
  assert.equal(levelName({ value: "xhigh", name: "xhigh" }), "很高");
  assert.equal(levelName({ value: "max", name: "" }), "最高");
  assert.equal(levelName({ value: "turbo", name: "turbo" }), "turbo", "认不得的照原样");
  assert.equal(isThinkingSwitch(BUILTIN_SWITCH), true);
  assert.equal(isThinkingSwitch(BUILTIN_LEVELS), false);
  const model = { id: "model", name: "模型", category: "model", type: "select", currentValue: "q", options: [{ value: "q", name: "Qwen3.8-27B" }] };
  assert.deepEqual(toModelOptions(model, BUILTIN_SWITCH)[0].efforts, [{ id: "off", name: "" }, { id: "on", name: "思考" }]);
  assert.deepEqual(toModelOptions(model, BUILTIN_LEVELS)[0].efforts.map((effort) => effort.name), ["低", "中", "高", "最高"]);
});

test("只有开 / 关的思考画成开关：点一下在两个值之间换，不画滑块", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
  const keys = ["window", "document", "HTMLElement", "Element", "Node", "Event", "MouseEvent"];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  for (const key of keys) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const React = await import("react");
    const { act } = React;
    const { createRoot } = await import("react-dom/client");
    const calls = [];
    const root = createRoot(document.getElementById("root"));
    await act(async () => root.render(React.createElement(EffortRow, { thought: BUILTIN_SWITCH, set: (id, value) => calls.push([id, value]) })));
    const toggle = document.querySelector('.ask-effort-switch-toggle[role="switch"]');
    assert.ok(toggle, "是开关");
    assert.equal(document.querySelector(".aui-effort-slider"), null, "没有滑块");
    assert.equal(toggle.getAttribute("aria-checked"), "true");
    assert.match(document.querySelector(".ask-effort-switch").textContent, /深度思考/);
    await act(async () => toggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    assert.deepEqual(calls, [["thought_level", "off"]]);
    await act(async () => root.render(React.createElement(EffortRow, { thought: { ...BUILTIN_SWITCH, currentValue: "off" }, set: (id, value) => calls.push([id, value]) })));
    await act(async () => document.querySelector(".ask-effort-switch-toggle").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    assert.deepEqual(calls.at(-1), ["thought_level", "on"]);
    await act(async () => root.unmount());
  } finally {
    for (const [key, value] of Object.entries(previous)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    dom.window.close();
  }
});

test("后端 2026-11-27 的思考提示：_meta.retainpdf.usage.thinking 读进用量（notice 去空白，没有不带）；开关、滑块下面写档位说明和这一项的说明", async () => {
  const { usageFromMeta } = await import("../../../packages/ask/src/acp/parts.ts");
  assert.deepEqual(usageFromMeta({ retainpdf: { usage: { thinking: { level: "on", thought: false, notice: " 选了思考，但这一问模型没有思考。 " } } } }).thinking,
    { level: "on", thought: false, notice: "选了思考，但这一问模型没有思考。" });
  assert.deepEqual(usageFromMeta({ retainpdf: { usage: { thinking: { level: "high", thought: true } } } }).thinking, { level: "high", thought: true });
  assert.equal(usageFromMeta({ retainpdf: { usage: { thinking: { level: "on" } } } }).thinking, undefined, "没有 thought 不认");
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  // 滑块的弹簧动画用 requestAnimationFrame。
  const keys = ["window", "document", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "requestAnimationFrame", "cancelAnimationFrame"];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  for (const key of keys) Object.defineProperty(globalThis, key, { value: typeof dom.window[key] === "function" && /^[a-z]/.test(key) ? dom.window[key].bind(dom.window) : dom.window[key], configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const React = await import("react");
    const { act } = React;
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(document.getElementById("root"));
    const guessed = { ...BUILTIN_SWITCH, description: "这个模型认不出来，开关不一定起作用；回答完会告诉你它有没有真的思考", options: [{ value: "off", name: "不思考", description: "直接答，最快、最省" }, { value: "on", name: "思考", description: "先想再答，慢一些、多花 token" }] };
    await act(async () => root.render(React.createElement(EffortRow, { thought: guessed, set: () => {} })));
    assert.match(document.querySelector(".ask-effort-switch-hint").textContent, /先想再答，慢一些、多花 token/, "开关下面用后端给的档位说明");
    assert.match(document.querySelector(".ask-effort-note").textContent, /不一定起作用/, "这一项的说明写出来，不只在悬停里");
    const levels = { ...BUILTIN_LEVELS, options: BUILTIN_LEVELS.options.map((choice) => ({ ...choice, description: `${choice.value} 的说明` })) };
    await act(async () => root.render(React.createElement(EffortRow, { thought: levels, set: () => {} })));
    assert.equal(document.querySelector(".ask-effort-hint").textContent, "high 的说明", "滑块下面写当前那档的说明");
    assert.equal(document.querySelector(".ask-effort-note"), null, "这一项没说明就不画");
    await act(async () => root.unmount());
  } finally {
    for (const [key, value] of Object.entries(previous)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    dom.window.close();
  }
});
