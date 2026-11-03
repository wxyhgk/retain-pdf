// 多用户：某个接口回 401 不再直接整页刷新——先确认会话真掉了才回登录界面；设置的「接口设置」在多用户下
// 不挂 AI 助手运行设置卡（它读 /ai/runtime-config，对网站账号关闭）。以前管理员一点设置，弹窗就被刷掉。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { DOM_GLOBAL_KEYS, makeDom as makeDomWith } from "../helpers/dom.mjs";
import { createUnauthorizedHandler } from "../../src/features/auth/domain/auth-gate.ts";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("401：还登录着不刷新；真掉线才刷新；问的时候连不上不刷新；同一时间只问一次", async () => {
  let reloads = 0;
  let checks = 0;
  let answer = { mode: "multi", authenticated: true, user: { user_id: "u", username: "admin", role: "admin", must_change_password: false } };
  let release;
  const handler = createUnauthorizedHandler({
    check: () => { checks += 1; return new Promise((resolve, reject) => { release = () => (answer instanceof Error ? reject(answer) : resolve(answer)); }); },
    reload: () => { reloads += 1; },
  });

  handler();
  handler();
  assert.equal(checks, 1, "并发的 401 只问一次");
  release();
  await flush();
  assert.equal(reloads, 0, "还登录着：只是那个接口不让用，不刷新");

  answer = { mode: "multi", authenticated: false, user: null };
  handler();
  release();
  await flush();
  assert.equal(reloads, 1, "真掉线：刷新回登录界面");

  answer = new Error("failed to fetch");
  handler();
  release();
  await flush();
  assert.equal(reloads, 1, "连不上：不刷新");
  assert.equal(checks, 3);
});
