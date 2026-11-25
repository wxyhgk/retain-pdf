/** 阅读页提问的宿主端口（features/reader/domain/ask-port.ts）：agent 列表、WebSocket 地址。 */
import test from "node:test";
import assert from "node:assert/strict";

import { BUILTIN_AGENT_ID, acpSocketUrl, toReaderAgents } from "../../src/features/reader/domain/ask-port.ts";

test("agent 列表：自带的缺模型配置或密钥引用时标成用不了、写明缺什么；本机 agent 照后端的 available / reason", () => {
  const rows = [
    { id: "retainpdf", name: "RetainPDF 自带模型", kind: "builtin", available: true, reason: "" },
    { id: "claude-code", name: "Claude Code", kind: "local", available: true, reason: "", launch: "claude-agent-acp" },
    { id: "codex", name: "Codex", kind: "local", available: false, reason: "没找到 codex-acp / codex 命令" },
    { name: "没有编号的不要" },
  ];
  const ok = toReaderAgents(rows, "");
  assert.deepEqual(ok.map((agent) => [agent.id, agent.available, agent.reason]), [
    ["retainpdf", true, ""],
    ["claude-code", true, ""],
    ["codex", false, "没找到 codex-acp / codex 命令"],
  ]);
  assert.equal(ok[0].acceptsImages, true);
  assert.equal(ok[1].description, "本机：claude-agent-acp");
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
