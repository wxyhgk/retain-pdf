/** 书架列表请求挂住时不能永远停在「正在加载最近任务…」。
 *
 * 事故：开发栈重启期间，书架的列表请求连上了但迟迟没有回应。以前没有超时，页面一直显示
 * 「正在加载最近任务…」；而且 loader 的加载锁不释放，之后所有刷新都只能排队，后端恢复了也
 * 不会再请求，只能手动刷新页面。连接直接被拒时则显示浏览器原话「Failed to fetch」。 */
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createRecentJobsStatePort } from "../../src/features/library/domain/recent-jobs/state.js";
import { RECENT_JOBS_LOADING_STATES } from "../../src/features/library/domain/recent-jobs/loading-state-contract.js";
import {
  createRecentJobsLoader,
  RECENT_JOBS_LOAD_TIMEOUT_MS,
  RECENT_JOBS_RETRY_DELAYS_MS,
  recentJobsLoadErrorText,
} from "../../src/features/library/domain/recent-jobs/loader.js";

const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

function harness(load) {
  const states = [];
  const statePort = createRecentJobsStatePort({});
  let resets = 0;
  const loader = createRecentJobsLoader({
    apiPrefix: "/api/v1",
    getQuery: () => "",
    recentJobActions: {},
    runtimePatches: { apply: (items) => items, applyExisting: (items) => items },
    activeRefreshLoop: () => ({ schedule() {}, stop() {} }),
    scheduleAutoLoadIfNeeded() {},
    homeStatePort: { setRecentJobsLoadingState: (state, message) => states.push([state, message || ""]) },
    recentJobsStatePort: statePort,
    libraryBooksResource: { load, reset: () => { resets += 1; } },
    viewPort: { renderLoading() {}, setLoadMoreLoading() {} },
  });
  return { loader, states, statePort, resets: () => resets };
}

const page = (ids) => ({
  status: "success",
  data: { collected: ids.map((id) => ({ job_id: id, document_id: `doc-${id}`, status: "succeeded" })), hasMore: false, latestInvocationSummary: null, nextOffset: ids.length },
});

test("请求挂住：超时后转成中文报错、丢掉挂住的请求，随后自动重试并恢复", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let calls = 0;
    const { loader, states, statePort, resets } = harness(() => {
      calls += 1;
      return calls === 1 ? new Promise(() => {}) : Promise.resolve(page(["a", "b"]));
    });
    void loader.load({ reset: true });
    await flush();
    assert.equal(loader.isLoading(), true);
    mock.timers.tick(RECENT_JOBS_LOAD_TIMEOUT_MS);
    await flush();
    assert.equal(loader.isLoading(), false, "超时后加载锁要释放，否则之后的刷新都只能排队");
    assert.equal(resets(), 1, "挂住的在途请求要丢掉，不然重试拿到的还是它");
    assert.match(states.at(-1)[1], /迟迟没有响应.*自动重试/);
    mock.timers.tick(RECENT_JOBS_RETRY_DELAYS_MS[0]);
    await flush();
    assert.equal(calls, 2, "没有自动重试");
    assert.deepEqual(statePort.getSnapshot().items.map((item) => item.job_id), ["a", "b"]);
    assert.equal(states.at(-1)[0], RECENT_JOBS_LOADING_STATES.READY, "恢复后应回到就绪，不能还停在报错");
  } finally {
    mock.timers.reset();
  }
});

test("连续失败时重试间隔逐步拉长；dispose 后不再重试", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let calls = 0;
    const { loader } = harness(() => { calls += 1; return Promise.reject(new TypeError("Failed to fetch")); });
    void loader.load({ reset: true });
    await flush();
    assert.equal(calls, 1);
    mock.timers.tick(RECENT_JOBS_RETRY_DELAYS_MS[0] - 1);
    await flush();
    assert.equal(calls, 1, "还没到第一次重试时间");
    mock.timers.tick(1);
    await flush();
    assert.equal(calls, 2);
    mock.timers.tick(RECENT_JOBS_RETRY_DELAYS_MS[1]);
    await flush();
    assert.equal(calls, 3, "第二次重试要等更久的间隔");
    loader.dispose();
    mock.timers.tick(60_000);
    await flush();
    assert.equal(calls, 3, "dispose 之后不应再请求");
  } finally {
    mock.timers.reset();
  }
});

test("浏览器的网络错误说中文，其它错误保留原话并说明在重试", () => {
  assert.equal(recentJobsLoadErrorText(new TypeError("Failed to fetch")), "连不上后端服务，正在自动重试…");
  assert.equal(recentJobsLoadErrorText(new TypeError("Load failed")), "连不上后端服务，正在自动重试…");
  assert.match(recentJobsLoadErrorText(new Error("读取失败 (401)")), /401.*正在自动重试/);
});
