/** 提问窗的模型和思考强度：ACP 的 configOptions 归一化、新会话把用户选过的值再设一次、agent 推来的变化交给窗口、提前开会话。 */
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeConfigOptions, pendingConfig } from "../../../packages/ask/src/acp/config.ts";
import { PermissionStore, createAcpChatAdapter } from "../../../packages/ask/src/acp/adapter.ts";
import { effortName, splitConfig, toModelOptions } from "../../../packages/ask/src/window/AskModelPicker.tsx";

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

test("选择器：模型、思考强度分出来，别的进「更多」；每个模型带同一份思考档位，名字换中文", () => {
  const { model, thought, rest } = splitConfig(normalizeConfigOptions(CLAUDE_CODE));
  assert.equal(model.id, "model");
  assert.equal(thought.id, "effort");
  assert.deepEqual(rest.map((option) => option.id), ["fast", "mode", "flag"]);
  const models = toModelOptions(model, thought);
  assert.deepEqual(models[1], { id: "opus", name: "Opus", efforts: [{ id: "low", name: "低" }, { id: "high", name: "高" }, { id: "max", name: "最高" }] });
  assert.equal(effortName("xhigh", "XHigh"), "很高");
  assert.equal(effortName("turbo", "Turbo"), "Turbo", "认不出的照 agent 给的名字");
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
    getPreamble: () => "",
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
  const chat = createAcpChatAdapter({ port, permissions: new PermissionStore(), getAgentId: () => "retainpdf", getPreamble: () => "出处", getDesiredConfig: () => desired, onConfig: () => {} });
  const run = async (messages) => { for await (const _ of chat.adapter.run({ messages, abortSignal: new AbortController().signal })) { /* 收完 */ } };
  const u = (t) => ({ role: "user", content: [{ type: "text", text: t }] });
  const a = (t) => ({ role: "assistant", content: [{ type: "text", text: t }], metadata: { custom: {} } });
  await run([u("Q1")]);
  desired = { model: "b" };
  await chat.setConfig("model", "b");
  await run([u("Q1"), a("答"), u("Q2")]);
  assert.deepEqual(opens, [{}, { model: "b" }], "第二个会话按新设置开");
  assert.match(prompts[1], /出处[\s\S]*我：Q1\n\n你：答[\s\S]*Q2/, "新会话带出处和之前几轮");
});
