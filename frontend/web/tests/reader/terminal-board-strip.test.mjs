/** agent 写进 board/ 的东西要出现在终端上方，点一下在左边打开。
 *
 * 既有测试守的是两头：`parseBoardListing` / `openableBoardItems`（纯函数，喂真实信封）
 * 和 `ReaderHostPanelShell`（壳把 onOpenBoard 传下去了）。**中间这一段没有** ——
 * 产物条自己去不去列目录、带不带 X-API-Key、解析结果有没有接到渲染、点击把哪个名字
 * 交出去、面板关着要不要轮询。
 *
 * 上一次这条链路交付时「死点有两个而测试全绿」，死的正是这一段的两头。而且取不到时是
 * **完全静默**的（`if (!response.ok) return;` + 空 catch），坏了也没人知道。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor } from "../helpers/async.mjs";
import { makeDom as makeDomWith, READER_PANEL_DOM_KEYS } from "../helpers/dom.mjs";

// 产物条走 API 层（apiFetch），地址和 key 取页面的运行时配置。
const makeDom = () => {
  const dom = makeDomWith("", { url: "http://localhost/reader.html", keys: READER_PANEL_DOM_KEYS });
  dom.window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "http://localhost:8000", xApiKey: "k" };
  return dom;
};

/** 端点真正返回的形状：`ApiResponse::ok(...)` 包成 {code, message, data}。 */
const envelope = (items) => ({
  code: 0, message: "ok",
  data: { schema: "retainpdf_ai_board_v1", items, skipped: 0 },
});

async function mountStrip(dom, props) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { TerminalBoardStrip } = await import("../../src/features/reader/ui/terminal-chrome.js");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(TerminalBoardStrip, props));
  await wait(80);
  return { root, host };
}

const items = (host) => [...host.querySelectorAll(".reader-terminal-board-item")];

test("agent 写进 board/ 的 HTML 会出现在终端上方的产物条里", async () => {
  const dom = makeDom();
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: `${url}`, key: init?.headers?.["X-API-Key"] });
    return { ok: true, json: async () => envelope([
      { name: "chart.html", kind: "html", content_type: "text/html; charset=utf-8", size: 10, modified_ms: 2 },
      { name: "fig.png", kind: "image", content_type: "image/png", size: 10, modified_ms: 1 },
    ]) };
  };
  const { root, host } = await mountStrip(dom, {
    jobId: "job 1", open: true, onOpen() {},
  });
  await waitFor(() => seen.length, "去列了一次 board/");
  assert.equal(seen[0].url, "http://localhost:8000/api/v1/jobs/job%201/ai/board",
    "列目录打的不是那个端点（或 job id 没转义）");
  assert.equal(seen[0].key, "k", "没带 X-API-Key，端点会 401，而失败是静默的");
  await waitFor(() => items(host).length, "产物条出现");
  assert.deepEqual(items(host).map((b) => b.textContent.trim()), ["chart.html"],
    "产物条画的不是「列表里那些能打开的 HTML」");
  root.unmount(); host.remove();
});

test("点产物条把文件名交给 onOpen —— 这是「在左边打开」的唯一入口", async () => {
  const dom = makeDom();
  globalThis.fetch = async () => ({ ok: true, json: async () => envelope([
    { name: "a.html", kind: "html", modified_ms: 1 },
    { name: "b.html", kind: "html", modified_ms: 2 },
  ]) });
  const opened = [];
  const { root, host } = await mountStrip(dom, {
    jobId: "job-1", open: true,
    onOpen(name) { opened.push(name); },
  });
  await waitFor(() => items(host).length, "产物条出现");
  const buttons = items(host);
  assert.equal(buttons.length, 2, `列表里两个 HTML 只画出了 ${buttons.length} 个`);
  buttons[1].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await wait(30);
  assert.deepEqual(opened, [buttons[1].textContent.trim()], "点了产物条没把名字交出去（或交错了那一个）");
  root.unmount(); host.remove();
});

test("面板没开时不去轮询 —— 这条 4 秒一次，关着也跑等于白烧请求", async () => {
  const dom = makeDom();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: true, json: async () => envelope([]) }; };
  const { root, host } = await mountStrip(dom, {
    jobId: "job-1", open: false, onOpen() {},
  });
  assert.equal(calls, 0, "面板关着也在列 board/");
  assert.equal(items(host).length, 0);
  root.unmount(); host.remove();
});

test("端点返回的形状不对时，产物条不清空也不报错", async () => {
  // 轮询间隔是 4000ms（terminal-chrome.tsx 里的 setInterval），所以这条**必须真的等到
  // 第二轮**。第一版我只等了 80ms，第二轮永远不发生 —— 那个 round===2 的 stub 是死代码，
  // 这条测试当时在空转（反证时 ④「解析失败就清空列表」没能让它红，就是这么发现的）。
  const dom = makeDom();
  let round = 0;
  globalThis.fetch = async () => {
    round += 1;
    if (round === 1) {
      return { ok: true, json: async () => envelope([{ name: "x.html", kind: "html", modified_ms: 1 }]) };
    }
    return { ok: true, json: async () => ({ code: 0, message: "ok", data: {} }) };
  };
  const { root, host } = await mountStrip(dom, {
    jobId: "job-1", open: true, onOpen() {},
  });
  await waitFor(() => items(host).length, "产物条出现");
  await waitFor(() => round >= 2, () => `第二轮轮询发生（4 秒一次），实际只轮了 ${round} 次`);
  await wait(60);
  assert.ok(round >= 2, "没等到第二轮，这条在空转");
  assert.deepEqual(items(host).map((b) => b.textContent.trim()), ["x.html"],
    "第二轮拿到的形状不对，产物条被清空了 —— 用户眼里是「刚才还在，怎么没了」");
  root.unmount(); host.remove();
});
