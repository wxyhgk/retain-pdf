import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  __FRONT_RUNTIME_CONFIG__: { xApiKey: "test-key" },
};

const {
  fetchAgentRuntimeConfig,
  updateAgentRuntimeConfig,
} = await import("@retainpdf/api/agent-runtime-settings");

const view = {
  schema: "retainpdf_ai_runtime_config_view_v1",
  active_runtime: "python-retrieval-v1",
  configured_runtime: "python",
  agent_confirmation_mode: "explicit",
  configured_revision: 7,
  active_revision: 7,
  restart_state: "active",
  llm_base_url: "https://api.example/v1",
  llm_model: "model-a",
  llm_api_key_configured: true,
  llm_api_key_masked: "••••alue",
  fx_gateway_base_url: "",
  fx_gateway_mode: "official_default",
  fx_gateway_effective_base_url: "",
  fx_gateway_effective_chat_url: "",
  fx_gateway_api_key_configured: false,
  fx_gateway_api_key_masked: "",
  fx_model: "",
  restart_required: false,
};

test("agent runtime settings: GET 使用本地服务鉴权并解析安全视图", async () => {
  const calls = [];
  const result = await fetchAgentRuntimeConfig({
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return new Response(JSON.stringify({ code: 0, message: "ok", data: view }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  assert.equal(result.llm_api_key_masked, "••••alue");
  assert.match(calls[0][0], /\/api\/v1\/ai\/runtime-config$/);
  assert.equal(calls[0][1].method, "GET");
  assert.equal(calls[0][1].headers["X-API-Key"], "test-key");
});

test("agent runtime settings: PUT 只发送本次录入且不要求浏览器持久化", async () => {
  const calls = [];
  const result = await updateAgentRuntimeConfig(
    {
      expected_revision: 7,
      agent_runtime: "fx",
      agent_confirmation_mode: "green_light",
      fx_gateway_base_url: "http://127.0.0.1:43112",
      fx_gateway_api_key: "gateway-once",
      fx_model: "model-fx",
    },
    {
      fetchImpl: async (url, options) => {
        calls.push([url, options]);
        return new Response(JSON.stringify({ code: 0, message: "ok", data: {
            ...view,
            configured_runtime: "fx",
            fx_gateway_api_key_configured: true,
            fx_gateway_api_key_masked: "••••once",
            restart_required: true,
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  );
  assert.equal(result.configured_runtime, "fx");
  assert.equal(calls[0][1].method, "PUT");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    expected_revision: 7,
    agent_runtime: "fx",
    agent_confirmation_mode: "green_light",
    fx_gateway_base_url: "http://127.0.0.1:43112",
    fx_gateway_api_key: "gateway-once",
    fx_model: "model-fx",
  });
});

test("agent runtime settings: OpenAI Agent 复用自定义模型接口字段", async () => {
  const calls = [];
  await updateAgentRuntimeConfig(
    {
      agent_runtime: "openai",
      llm_base_url: "https://qwen.example/v1",
      llm_model: "qwen-agent",
      llm_api_key: "model-key-once",
    },
    {
      fetchImpl: async (url, options) => {
        calls.push([url, options]);
        return new Response(JSON.stringify({ code: 0, message: "ok", data: {
            ...view,
            active_runtime: "openai-compatible-agent-v1",
            configured_runtime: "openai",
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  );
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    agent_runtime: "openai",
    llm_base_url: "https://qwen.example/v1",
    llm_model: "qwen-agent",
    llm_api_key: "model-key-once",
  });
});
