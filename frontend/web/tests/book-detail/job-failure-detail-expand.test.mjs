/** 「展开完整错误」是用户唯一能拿到 traceback 的路径。
 *
 * 列表每 2 秒轮询一次，所以 traceback 不进列表（后端只给精简版）。既有门禁只证明
 * 「没给 loadDetail 就不画按钮」和 pickFailureDetailText 这个纯函数，**证明不了点下去
 * 真的发生了什么** —— 有没有拿当前 jobId 去打详情端点、取回来有没有画出来、端点挂了
 * 卡片会不会跟着垮、反复点会不会反复发请求。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { click, makeDom as makeDomWith } from "../helpers/dom.mjs";

// 这张卡里没有表单，原来就只装这些全局。
const makeDom = () => makeDomWith("", {
  keys: [
    "window", "document", "DocumentFragment", "HTMLElement", "HTMLButtonElement",
    "CustomEvent", "Event", "MouseEvent", "Node", "MutationObserver", "NodeFilter",
  ],
});

const FAILURE = {
  category: "provider", stage: "ocr", retryable: true,
  summary: "任务失败，但暂未识别出明确根因",
  root_cause: "MinerU batch task failed: parsing failed, please try again later",
  provider: "mineru",
};

async function mountCard(dom, props) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { JobFailureCard } = await import(
    "../../src/features/book-detail/ui/panels/processing/JobFailureCard.js"
  );
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(JobFailureCard, props));
  await waitFor(() => host.querySelector("[data-job-failure]"), "卡片渲染");
  return { root, host };
}

const buttonWith = (host, label) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent.includes(label));

test("点「完整错误」才去打详情端点，拿回的 traceback 真的画出来", async () => {
  const dom = makeDom();
  const asked = [];
  const { root, host } = await mountCard(dom, {
    failure: FAILURE, jobId: "job-1",
    loadDetail: async (jobId) => {
      asked.push(jobId);
      return 'Traceback (most recent call last):\n  File "ocr.py", line 1';
    },
  });
  assert.equal(asked.length, 0, "还没点就打了详情端点 —— 2 秒一次的轮询会把它一起驮上");
  click(dom, buttonWith(host, "完整错误"));
  await waitFor(() => host.querySelector("[data-failure-detail]"), "完整错误展开");
  assert.deepEqual(asked, ["job-1"], "展开时没拿当前任务的 id 去取详情");
  assert.match(host.querySelector("[data-failure-detail]").textContent, /^Traceback/, "取回来的完整错误没画出来");
  assert.equal(buttonWith(host, "完整错误"), undefined, "展开之后按钮还在，再点一次又发一次请求");
  root.unmount(); host.remove();
});

test("详情端点挂了，卡片不能跟着垮 —— 上面那份简报本身就有用", async () => {
  const dom = makeDom();
  const { root, host } = await mountCard(dom, {
    failure: FAILURE, jobId: "job-1",
    loadDetail: async () => { throw new Error("读取完整错误失败：500"); },
  });
  click(dom, buttonWith(host, "完整错误"));
  await waitFor(() => host.querySelector(".book-detail-failure-detail-error"), "展开失败的提示");
  assert.match(host.querySelector(".book-detail-failure-detail-error").textContent, /500/, "没把取详情失败的原因说出来");
  assert.ok(host.querySelector("[data-job-failure]"), "取不到完整错误把整张卡片带崩了");
  assert.match(host.textContent, /MinerU batch task failed/, "简报里的根因也一起丢了");
  root.unmount(); host.remove();
});

test("服务端什么都没给时也要有话说，不能展开出一片空白", async () => {
  const dom = makeDom();
  const { root, host } = await mountCard(dom, {
    failure: FAILURE, jobId: "job-1", loadDetail: async () => "",
  });
  click(dom, buttonWith(host, "完整错误"));
  await waitFor(() => host.querySelector("[data-failure-detail]"), "展开");
  assert.match(host.querySelector("[data-failure-detail]").textContent, /\S/, "展开出来是一片空白");
  root.unmount(); host.remove();
});
