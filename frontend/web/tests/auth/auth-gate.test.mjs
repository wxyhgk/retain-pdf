// 启动时的登录检查 + 接口层的鉴权方式：单机照旧；多用户带 Cookie、不带部署密钥、401 回登录。
import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthGate, hiddenSettingsTabs, isAdmin } from "../../src/features/auth/domain/auth-gate.js";
import { authErrorText, passwordProblem } from "../../src/features/auth/domain/auth-errors.js";
import { apiFetch, buildApiHeaders, setApiAuthMode, setApiUnauthorizedHandler } from "../../../packages/api/src/internal/runtime.ts";
import { resolveAuthSession } from "../../../packages/api/src/auth.ts";

const multiUser = (user) => ({ mode: "multi", authenticated: Boolean(user), user });

test("登录检查：演示模式、单机、老后端（404）都直接放行；连不上给一句话", async () => {
  assert.equal((await resolveAuthGate({ mock: () => true })).kind, "ready");
  assert.equal((await resolveAuthGate({ mock: () => false, resolve: async () => ({ mode: "single", authenticated: true, user: null }) })).kind, "ready");
  const old = await resolveAuthGate({ mock: () => false, resolve: async () => { throw Object.assign(new Error("nf"), { status: 404 }); } });
  assert.equal(old.kind, "ready");
  const down = await resolveAuthGate({ mock: () => false, resolve: async () => { throw new TypeError("Failed to fetch"); } });
  assert.deepEqual(down, { kind: "error", message: "连不上服务器，请稍后刷新重试。" });
});

test("登录检查：多用户没登录 → 登录；初始密码 → 强制改密码；正常 → 进入", async () => {
  const opts = { mock: () => false, onUnauthorized: () => {} };
  assert.equal((await resolveAuthGate({ ...opts, resolve: async () => multiUser(null) })).kind, "login");
  assert.equal((await resolveAuthGate({ ...opts, resolve: async () => multiUser({ user_id: "u1", username: "li", role: "user", must_change_password: true }) })).kind, "change_password");
  const ready = await resolveAuthGate({ ...opts, resolve: async () => multiUser({ user_id: "u1", username: "li", role: "user", must_change_password: false }) });
  assert.equal(ready.kind, "ready");
  setApiUnauthorizedHandler(null);
});

test("设置分栏：单机不藏；多用户普通用户藏接口设置、同步、备份、更新；管理员只藏更新", () => {
  assert.deepEqual(hiddenSettingsTabs({ mode: "single", authenticated: true, user: null }), []);
  assert.deepEqual([...hiddenSettingsTabs(multiUser({ role: "user" }))], ["api", "sync", "backup", "update"]);
  assert.deepEqual([...hiddenSettingsTabs(multiUser({ role: "admin" }))], ["update"]);
  assert.equal(isAdmin({ mode: "single" }), true, "单机的本机用户就是管理员");
});

test("接口层：多用户带 Cookie、不带部署密钥；401 回登录（登录接口自己的 401 不算）", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.window = { __FRONT_RUNTIME_CONFIG__: { xApiKey: "deploy-key", apiBase: "http://api.test" }, location: { protocol: "http:", hostname: "x" } };
  const calls = [];
  let status = 200;
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: `${url}`, init }); return new Response("{}", { status }); };
  let unauthorized = 0;
  setApiUnauthorizedHandler(() => { unauthorized += 1; });
  try {
    setApiAuthMode("single");
    assert.equal(buildApiHeaders()["X-API-Key"], "deploy-key");
    await apiFetch("http://api.test/api/v1/jobs");
    assert.equal(calls.at(-1).init.credentials, undefined, "单机不带凭据");

    setApiAuthMode("multi");
    assert.equal(buildApiHeaders()["X-API-Key"], undefined, "多用户不带部署密钥");
    await apiFetch("http://api.test/api/v1/jobs");
    assert.equal(calls.at(-1).init.credentials, "include");

    status = 401;
    await apiFetch("http://api.test/api/v1/auth/login", { method: "POST" });
    assert.equal(unauthorized, 0, "登录失败不算登录过期");
    await apiFetch("http://api.test/api/v1/jobs");
    assert.equal(unauthorized, 1);
  } finally {
    setApiAuthMode("single");
    setApiUnauthorizedHandler(null);
    globalThis.fetch = originalFetch;
    delete globalThis.window;
  }
});

test("问会话：先不带凭据问模式，是多用户再带 Cookie 问一次", async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    seen.push(init.credentials || "none");
    const body = seen.length === 1 ? { mode: "multi", authenticated: false, user: null } : { mode: "multi", authenticated: true, user: { user_id: "u1", username: "li", role: "user", must_change_password: false } };
    return new Response(JSON.stringify({ code: 0, message: "ok", data: body }), { status: 200 });
  };
  try {
    const session = await resolveAuthSession("/api/v1");
    assert.deepEqual(seen, ["none", "include"]);
    assert.equal(session.user.username, "li");
  } finally {
    setApiAuthMode("single");
    globalThis.fetch = originalFetch;
  }
});

test("错误说成人话", () => {
  assert.equal(authErrorText({ code: "INVALID_CREDENTIALS" }), "用户名或密码不对。");
  assert.equal(authErrorText({ code: "ACCOUNT_DISABLED" }), "这个账号已停用，请联系管理员。");
  assert.equal(authErrorText({ code: "TOO_MANY_ATTEMPTS", details: { retry_after_secs: 290 } }), "尝试次数太多，请 5 分钟后再试。");
  assert.equal(authErrorText(new TypeError("Failed to fetch")), "连不上服务器，请稍后再试。");
  assert.equal(passwordProblem("short", "short"), "新密码至少 8 位。");
  assert.equal(passwordProblem("longenough1", "longenough2"), "两次输入的新密码不一样。");
  assert.equal(passwordProblem("longenough1", "longenough1"), "");
});
