import test from "node:test";
import assert from "node:assert/strict";

const {
  resolveAgentRuntimeCredentialGate,
} = await import("../../src/features/ask/domain/agent-runtime-gate.js");

const base = {
  active_runtime: "python-retrieval-v1",
  configured_runtime: "python",
  llm_api_key_configured: false,
  fx_gateway_api_key_configured: false,
  restart_state: "active",
  restart_required: false,
  active_revision: 7,
  configured_revision: 7,
};

test("agent runtime gate: 普通问答接受后端安全保存的模型 Key", () => {
  const gate = resolveAgentRuntimeCredentialGate({
    config: { ...base, llm_api_key_configured: true },
    loading: false,
    legacyModelKeyConfigured: false,
  });
  assert.equal(gate.blocked, false);
  assert.equal(gate.mode, "python");
});

test("agent runtime gate: 普通问答迁移期仍兼容旧模型 Key", () => {
  const gate = resolveAgentRuntimeCredentialGate({
    config: base,
    loading: false,
    legacyModelKeyConfigured: true,
  });
  assert.equal(gate.blocked, false);
});

test("agent runtime gate: OpenAI 兼容 Agent 使用模型 Key 并保留独立模式", () => {
  const gate = resolveAgentRuntimeCredentialGate({
    config: {
      ...base,
      active_runtime: "openai-compatible-agent-v1",
      configured_runtime: "openai",
      llm_api_key_configured: true,
    },
    loading: false,
    legacyModelKeyConfigured: false,
  });
  assert.equal(gate.blocked, false);
  assert.equal(gate.mode, "openai");
});

test("agent runtime gate: OpenAI 兼容 Agent 接受网页本地模型 Key", () => {
  const gate = resolveAgentRuntimeCredentialGate({
    config: {
      ...base,
      active_runtime: "openai-compatible-agent-v1",
      configured_runtime: "openai",
    },
    loading: false,
    legacyModelKeyConfigured: true,
  });
  assert.equal(gate.blocked, false);
  assert.equal(gate.message, "");
});

test("agent runtime gate: OpenAI 兼容 Agent 在两处都缺模型 Key 时阻止发送", () => {
  const gate = resolveAgentRuntimeCredentialGate({
    config: {
      ...base,
      active_runtime: "openai-compatible-agent-v1",
      configured_runtime: "openai",
    },
    loading: false,
    legacyModelKeyConfigured: false,
  });
  assert.equal(gate.blocked, true);
  assert.match(gate.message, /模型 API Key/);
});

test("agent runtime gate: FX Agent 只检查 Gateway Key", () => {
  const gate = resolveAgentRuntimeCredentialGate({
    config: {
      ...base,
      active_runtime: "vercel-fx-acp-v1",
      configured_runtime: "fx",
      fx_gateway_api_key_configured: true,
    },
    loading: false,
    legacyModelKeyConfigured: false,
  });
  assert.equal(gate.blocked, false);
  assert.equal(gate.mode, "fx");
});

test("agent runtime gate: FX Agent 缺 Gateway Key 时给出专用提示", () => {
  const gate = resolveAgentRuntimeCredentialGate({
    config: {
      ...base,
      active_runtime: "vercel-fx-acp-v1",
      configured_runtime: "fx",
    },
    loading: false,
    legacyModelKeyConfigured: true,
  });
  assert.equal(gate.blocked, true);
  assert.match(gate.message, /Gateway Key/);
});

test("agent runtime gate: 配置读取和运行模式切换期间保持关闭", () => {
  const loading = resolveAgentRuntimeCredentialGate({
    config: null,
    loading: true,
    legacyModelKeyConfigured: true,
  });
  assert.equal(loading.blocked, true);

  const switching = resolveAgentRuntimeCredentialGate({
    config: { ...base, configured_runtime: "fx" },
    loading: false,
    legacyModelKeyConfigured: true,
  });
  assert.equal(switching.blocked, true);
  assert.match(switching.message, /正在切换到FX Gateway Agent/);

  const switchingToOpenAi = resolveAgentRuntimeCredentialGate({
    config: { ...base, configured_runtime: "openai" },
    loading: false,
    legacyModelKeyConfigured: true,
  });
  assert.equal(switchingToOpenAi.blocked, true);
  assert.match(switchingToOpenAi.message, /正在切换到OpenAI 兼容 Agent/);
});

test("agent runtime gate: restart_state pending 时阻止发送", () => {
  const gate = resolveAgentRuntimeCredentialGate({
    config: {
      ...base,
      llm_api_key_configured: true,
      restart_state: "pending",
    },
    loading: false,
    legacyModelKeyConfigured: false,
  });
  assert.equal(gate.blocked, true);
  assert.match(gate.message, /正在切换/);
});

test("agent runtime gate: revision 尚未激活时阻止发送", () => {
  const gate = resolveAgentRuntimeCredentialGate({
    config: {
      ...base,
      llm_api_key_configured: true,
      active_revision: 7,
      configured_revision: 8,
    },
    loading: false,
    legacyModelKeyConfigured: false,
  });
  assert.equal(gate.blocked, true);
  assert.match(gate.message, /正在切换/);
});
