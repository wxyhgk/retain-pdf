/** 任务跑完的提醒：盯任务列表、判断哪些刚跑完，以及页面在前台 / 后台时各怎么提醒。
 *
 * 计时器换成手动的：每次 runNext() 跑一拍，等这一拍的请求都回来再断言。
 */
import test from "node:test";
import assert from "node:assert/strict";

const { createJobFinishWatcher, JOB_FINISH_ACTIVE_INTERVAL_MS, JOB_FINISH_IDLE_INTERVAL_MS } = await import(
  "../../src/features/notify/domain/job-finish-watcher.ts"
);
const { createFinishDelivery, stripFinishMark } = await import("../../src/features/notify/domain/deliver.ts");
const { jobFinishedTitle, readJobFinishNotifyEnabled, titleWithFinishMark, writeJobFinishNotifyEnabled } = await import(
  "../../src/features/notify/domain/notify-prefs.ts"
);

function job(id, status, created_at = "2026-10-25T08:00:00Z", extra = {}) {
  return { job_id: id, display_name: `书 ${id}`, workflow: "book", status, created_at, ...extra };
}

function harness({ recent = [], byIds = {} } = {}) {
  const state = { recent, byIds, recentCalls: 0, byIdsCalls: [], failNext: false };
  const timers = [];
  const finished = [];
  const watcher = createJobFinishWatcher({
    listRecent: async () => {
      state.recentCalls += 1;
      if (state.failNext) {
        state.failNext = false;
        throw new Error("后端连不上");
      }
      return state.recent;
    },
    listByIds: async (ids) => {
      state.byIdsCalls.push(ids);
      return ids.map((id) => state.byIds[id]).filter(Boolean);
    },
    onFinished: (item) => finished.push(item),
    setTimer: (callback, ms) => {
      const timer = { callback, ms };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      const index = timers.indexOf(timer);
      if (index >= 0) timers.splice(index, 1);
    },
  });
  async function runNext() {
    const timer = timers.shift();
    assert.ok(timer, "应该排着下一拍");
    timer.callback();
    // 这一拍里的两次请求都是 await，多让几轮微任务。
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    return timer.ms;
  }
  return { state, timers, finished, watcher, runNext };
}

test("第一拍只记现状：开始盯以前就跑完的不报", async () => {
  const h = harness({ recent: [job("a", "succeeded"), job("b", "failed")] });
  h.watcher.start();
  await h.runNext();
  await h.runNext();
  assert.deepEqual(h.finished, []);
});

test("见过在跑、后来成功了：报一次，之后不再报", async () => {
  const h = harness({ recent: [job("a", "running")] });
  h.watcher.start();
  await h.runNext();
  h.state.recent = [job("a", "succeeded", undefined, { completion_note: "有 2 块保留原文" })];
  await h.runNext();
  await h.runNext();
  assert.deepEqual(h.finished, [{ jobId: "a", title: "书 a", workflow: "book", status: "succeeded", note: "有 2 块保留原文" }]);
});

test("开始盯以后才建、一拍之内就跑完的小任务也报；以前的老任务被顶上来不报", async () => {
  const h = harness({ recent: [job("old", "succeeded", "2026-10-25T08:00:00Z")] });
  h.watcher.start();
  await h.runNext();
  h.state.recent = [
    job("quick", "succeeded", "2026-10-25T09:00:00Z"),
    job("old", "succeeded", "2026-10-25T08:00:00Z"),
    // 删了别的任务以后，更早的这个才出现在这一页里。
    job("older", "failed", "2026-10-24T08:00:00Z"),
  ];
  await h.runNext();
  assert.deepEqual(h.finished.map((item) => item.jobId), ["quick"]);
});

test("在跑的任务被挤出这一页：按编号补查，失败时带上那句原因", async () => {
  const h = harness({ recent: [job("a", "running")] });
  h.watcher.start();
  await h.runNext();
  h.state.recent = [];
  h.state.byIds = { a: job("a", "failed", undefined, { failure: { summary: "模型接口 401，检查 API Key" } }) };
  await h.runNext();
  assert.deepEqual(h.state.byIdsCalls, [["a"]]);
  assert.equal(h.finished.length, 1);
  assert.equal(h.finished[0].status, "failed");
  assert.equal(h.finished[0].note, "模型接口 401，检查 API Key");
});

test("用户取消的不报；查不到的（被删了）不再盯", async () => {
  const h = harness({ recent: [job("a", "running"), job("b", "queued")] });
  h.watcher.start();
  await h.runNext();
  h.state.recent = [job("a", "canceled")];
  await h.runNext();
  assert.deepEqual(h.finished, []);
  assert.deepEqual(h.state.byIdsCalls, [["b"]]);
  // b 查不到就不盯了：下一拍不再补查，也按空闲的间隔排。
  const ms = await h.runNext();
  assert.equal(ms, JOB_FINISH_IDLE_INTERVAL_MS);
  assert.deepEqual(h.state.byIdsCalls, [["b"]]);
});

test("同一个任务原地重跑又跑完，会再报一次", async () => {
  const h = harness({ recent: [job("a", "running")] });
  h.watcher.start();
  await h.runNext();
  h.state.recent = [job("a", "succeeded")];
  await h.runNext();
  h.state.recent = [job("a", "running")];
  await h.runNext();
  h.state.recent = [job("a", "succeeded")];
  await h.runNext();
  assert.equal(h.finished.length, 2);
});

test("有任务在跑看得勤、没有就看得慢；后端连不上不抛，下一拍接着看", async () => {
  const h = harness({ recent: [] });
  h.watcher.start();
  assert.equal(h.timers[0].ms, 0, "一开始马上看一次");
  await h.runNext();
  assert.equal(h.timers[0].ms, JOB_FINISH_IDLE_INTERVAL_MS);
  h.state.recent = [job("a", "running", "2026-10-25T09:00:00Z")];
  await h.runNext();
  assert.equal(h.timers[0].ms, JOB_FINISH_ACTIVE_INTERVAL_MS);
  h.state.failNext = true;
  await h.runNext();
  assert.equal(h.timers.length, 1, "出错以后照样排下一拍");
  h.state.recent = [job("a", "succeeded", "2026-10-25T09:00:00Z")];
  await h.runNext();
  assert.deepEqual(h.finished.map((item) => item.jobId), ["a"]);
});

test("交了任务就马上看一次；停了以后不再排", async () => {
  const h = harness({ recent: [] });
  h.watcher.start();
  await h.runNext();
  h.watcher.poke();
  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0].ms, 0);
  h.watcher.stop();
  assert.equal(h.timers.length, 0);
  h.watcher.poke();
  assert.equal(h.timers.length, 0);
});

function fakeDoc({ visible = true, focused = true, title = "RetainPDF" } = {}) {
  const listeners = {};
  return {
    visibilityState: visible ? "visible" : "hidden",
    focused,
    title,
    hasFocus() {
      return this.focused;
    },
    addEventListener(name, listener) {
      (listeners[name] ||= []).push(listener);
    },
    removeEventListener(name, listener) {
      listeners[name] = (listeners[name] || []).filter((item) => item !== listener);
    },
    fire(name) {
      for (const listener of listeners[name] || []) listener();
    },
    listenerCount(name) {
      return (listeners[name] || []).length;
    },
  };
}

function fakeNotificationApi(permission = "granted") {
  const created = [];
  class FakeNotification {
    static permission = permission;
    constructor(title, options) {
      this.title = title;
      this.options = options;
      this.onclick = null;
      this.closed = false;
      created.push(this);
    }
    close() {
      this.closed = true;
    }
  }
  return { api: FakeNotification, created };
}

function deliveryHarness({ doc = fakeDoc(), permission = "granted", enabled = true } = {}) {
  const { api, created } = fakeNotificationApi(permission);
  const calls = { success: [], error: [], focus: 0, opened: [] };
  const delivery = createFinishDelivery({
    doc,
    notificationApi: api,
    isEnabled: () => enabled,
    toastSuccess: (title, options) => calls.success.push({ title, ...options }),
    toastError: (title, options) => calls.error.push({ title, ...options }),
    focusWindow: () => {
      calls.focus += 1;
    },
    openJob: (item) => calls.opened.push(item.jobId),
  });
  return { doc, created, calls, delivery };
}

const done = { jobId: "a", title: "量子力学", workflow: "book", status: "succeeded", note: "" };
const broken = { jobId: "b", title: "线性代数", workflow: "ocr", status: "failed", note: "OCR 超时" };

test("正看着页面：只在页面里提示，不弹系统通知、不改标题", () => {
  const h = deliveryHarness();
  h.delivery.deliver(done);
  assert.equal(h.created.length, 0);
  assert.equal(h.doc.title, "RetainPDF");
  assert.equal(h.calls.success.length, 1);
  assert.equal(h.calls.success[0].title, "翻译完成");
  h.calls.success[0].action.onClick();
  assert.deepEqual(h.calls.opened, ["a"]);
});

test("页面在后台：弹系统通知、标题加记号，页面提示等回来再弹；点通知拿到前面并打开", () => {
  const h = deliveryHarness({ doc: fakeDoc({ visible: false, focused: false }) });
  h.delivery.deliver(done);
  h.delivery.deliver(broken);
  assert.equal(h.doc.title, "(✓ ✗) RetainPDF");
  assert.deepEqual(h.created.map((item) => [item.title, item.options.body, item.options.tag]), [
    ["翻译完成", "量子力学", "retainpdf-job-a"],
    ["识别失败", "线性代数\nOCR 超时", "retainpdf-job-b"],
  ]);
  assert.equal(h.calls.success.length + h.calls.error.length, 0, "在后台时不弹页面提示（会一直盖着底栏）");
  h.created[1].onclick();
  assert.equal(h.calls.focus, 1);
  assert.deepEqual(h.calls.opened, ["b"]);
  assert.equal(h.created[1].closed, true);
  // 回到页面：没点过的那条补弹，点过通知的那条不再弹。
  h.doc.visibilityState = "visible";
  h.doc.focused = true;
  h.doc.fire("visibilitychange");
  assert.deepEqual(h.calls.success.map((item) => item.description), ["量子力学"]);
  assert.equal(h.calls.error.length, 0);
  h.doc.fire("visibilitychange");
  assert.equal(h.calls.success.length, 1, "只补弹一次");
});

test("回到页面：标题记号去掉；别处改过的标题保留", () => {
  const h = deliveryHarness({ doc: fakeDoc({ visible: false, focused: false }) });
  h.delivery.deliver(done);
  h.delivery.deliver(done);
  assert.equal(h.doc.title, "(✓2) RetainPDF");
  // 阅读器打开时会把标题换成书名。
  h.doc.title = "(✓2) 量子力学 - RetainPDF";
  h.doc.visibilityState = "visible";
  h.doc.focused = true;
  h.doc.fire("visibilitychange");
  assert.equal(h.doc.title, "量子力学 - RetainPDF");
  h.delivery.dispose();
  assert.equal(h.doc.listenerCount("visibilitychange"), 0);
});

test("关了开关或者没授权：不弹系统通知，标题记号照样有", () => {
  for (const options of [{ enabled: false }, { permission: "default" }, { permission: "denied" }]) {
    const h = deliveryHarness({ doc: fakeDoc({ visible: true, focused: false }), ...options });
    h.delivery.deliver(done);
    assert.equal(h.created.length, 0, JSON.stringify(options));
    assert.equal(h.doc.title, "(✓) RetainPDF", JSON.stringify(options));
  }
});

test("标题记号、通知标题、开关的读写", () => {
  assert.equal(titleWithFinishMark("RetainPDF", { succeeded: 0, failed: 0 }), "RetainPDF");
  assert.equal(titleWithFinishMark("RetainPDF", { succeeded: 3, failed: 1 }), "(✓3 ✗) RetainPDF");
  assert.equal(stripFinishMark("(✓3 ✗) RetainPDF"), "RetainPDF");
  assert.equal(stripFinishMark("(第 2 版) 讲义"), "(第 2 版) 讲义", "不是我们加的括号不动");
  assert.equal(jobFinishedTitle({ ...done, workflow: "render" }), "排版完成");

  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  assert.equal(readJobFinishNotifyEnabled(storage), true, "默认开着");
  writeJobFinishNotifyEnabled(false, storage);
  assert.equal(readJobFinishNotifyEnabled(storage), false);
  const throwing = { getItem: () => { throw new Error("隐私模式"); }, setItem: () => { throw new Error("隐私模式"); } };
  assert.equal(readJobFinishNotifyEnabled(throwing), true);
  writeJobFinishNotifyEnabled(true, throwing);
});
