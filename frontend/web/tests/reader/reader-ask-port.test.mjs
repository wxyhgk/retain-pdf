/** 阅读页提问的宿主端口（features/reader/domain/ask-port.ts）：agent 列表、WebSocket 地址。 */
import test from "node:test";
import assert from "node:assert/strict";

import { BUILTIN_AGENT_ID, acpSocketUrl, fromAnchorRecord, fromThreadRecord, toAnchorRecord, toReaderAgents } from "../../src/features/reader/domain/ask-port.ts";

test("agent 列表：自带的缺模型配置或密钥引用时标成用不了、写明缺什么；本机 agent 照后端的 available / reason", () => {
  const rows = [
    { id: "retainpdf", name: "RetainPDF 自带模型", kind: "builtin", available: true, reason: "" },
    { id: "claude-code", name: "Claude Code", kind: "local", available: true, reason: "", launch: "claude-agent-acp" },
    { id: "codex", name: "Codex", kind: "local", available: false, reason: "没装 codex-acp", install: "npm install -g @agentclientprotocol/codex-acp" },
    { name: "没有编号的不要" },
  ];
  const ok = toReaderAgents(rows, "");
  assert.deepEqual(ok.map((agent) => [agent.id, agent.available, agent.reason]), [
    ["retainpdf", true, ""],
    ["claude-code", true, ""],
    ["codex", false, "没装 codex-acp"],
  ]);
  assert.equal(ok[0].acceptsImages, true);
  assert.equal(ok[1].description, "本机：claude-agent-acp");
  assert.equal(ok[2].install, "npm install -g @agentclientprotocol/codex-acp", "没装的带安装命令");
  assert.equal(ok[1].install, undefined);
  const missing = toReaderAgents(rows, "设置里还没有配翻译模型");
  assert.deepEqual([missing[0].available, missing[0].reason], [false, "设置里还没有配翻译模型"]);
  assert.equal(missing[1].available, true, "本机 agent 不受影响");
  assert.equal(BUILTIN_AGENT_ID, "retainpdf");
});

test("WebSocket 地址：http → ws、https → wss；api_key 和模型配置进查询串，空的不带", () => {
  assert.equal(
    acpSocketUrl("http://127.0.0.1:41000", "retainpdf", "k1", { model: "claude-haiku-5-5", base_url: "https://api.anthropic.com", thinking: "" }),
    "ws://127.0.0.1:41000/api/v1/ai/agents/retainpdf/acp?api_key=k1&model=claude-haiku-5-5&base_url=https%3A%2F%2Fapi.anthropic.com",
  );
  assert.equal(acpSocketUrl("https://reader.example", "claude-code", ""), "wss://reader.example/api/v1/ai/agents/claude-code/acp");
});

test("问答记录：出处驼峰 ↔ 下划线来回不丢；空的写成 null；读回来缺的补默认", () => {
  const anchor = { pane: "source", page: 56, itemId: "p056-b0003", selection: "", sourceText: "原文", translatedText: "", section: "2.1", point: { x: 0.2, y: 0.4 } };
  const record = toAnchorRecord(anchor);
  assert.deepEqual(record, { pane: "source", page: 56, item_id: "p056-b0003", selection: null, source_text: "原文", translated_text: null, section: "2.1", point: { x: 0.2, y: 0.4 } });
  assert.deepEqual(fromAnchorRecord(record), anchor);
  assert.deepEqual(fromAnchorRecord({ pane: "translated", page: 3 }), { pane: "translated", page: 3, itemId: null, selection: "", sourceText: "", translatedText: "", section: "", point: null });
  const thread = fromThreadRecord({ thread_id: "t1", agent_id: "retainpdf", title: "这是什么", anchor: record, message_count: 2, updated_at: "2026-11-25T00:00:00Z", messages: [{ role: "user", text: "Q" }, { role: "assistant", text: "A", thought: "想", usage: { outputTokens: 3 } }] });
  assert.equal(thread.threadId, "t1");
  assert.deepEqual(thread.messages, [{ role: "user", text: "Q", thought: null, usage: null }, { role: "assistant", text: "A", thought: "想", usage: { outputTokens: 3 } }]);
  assert.equal("messages" in fromThreadRecord({ thread_id: "t2", agent_id: "a", title: "", anchor: record, message_count: 0, updated_at: "" }), false, "列表里的不带问答");
});

test("自带类 agent 按 kind 认（11-26 后端加了 retainpdf-pi）：缺配置照样标用不了；握手带模型配置也按 kind，不只认 retainpdf", async () => {
  const { isBuiltinAgentRow } = await import("../../src/features/reader/domain/ask-port.ts");
  const rows = [{ id: "retainpdf-pi", name: "RetainPDF · pi", kind: "builtin", available: true }];
  assert.equal(isBuiltinAgentRow(rows[0]), true);
  assert.equal(isBuiltinAgentRow({ id: "retainpdf" }), true, "没给 kind 的旧后端照旧认");
  assert.equal(isBuiltinAgentRow({ id: "claude-code", kind: "local" }), false);
  const [pi] = toReaderAgents(rows, "设置里还没有配翻译模型");
  assert.deepEqual([pi.available, pi.reason, pi.acceptsImages], [false, "设置里还没有配翻译模型", true]);
  const source = (await import("node:fs")).readFileSync(new URL("../../src/features/reader/domain/ask-port.ts", import.meta.url), "utf8");
  assert.match(source, /const builtin = builtinAgentIds\.has\(agentId\);/);
});
