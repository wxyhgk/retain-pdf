import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// 多会话对话管理(React 组件版):旧版驱动 src/js/reader/ai/chat.js 的 DOM 控制器,
// Phase 2b 起 AI 问答 UI 迁入 React(src/pages/reader/legacy/components/ReaderAiChat.jsx)。
// 断言语义与旧版一致:气泡类名(.reader-ai-message-body-el)、会话下拉选项、
// historyStore 会话数。另收编旧 reader.test.mjs 的两条 chat 语义:
// 提交状态流转、502 回退本地检索。
//
// 驱动方式:首个挂载用真实 DOM 事件(表单提交/按钮点击,验 React 布线);
// 后续测试经 controllerRef 直接调编排句柄(等价旧测试调 chat.submit())——
// node:test 环境下换 key 重挂组件后 React 根事件委托停摆(环境问题,浏览器无此现象),
// 组件渲染与 flushSync 不受影响,断言仍全部落在真实 DOM 上。

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const k of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, writable: true, configurable: true });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
// Radix Presence/Tabs(阶段 B 引入)在 jsdom 下需要 cancelAnimationFrame
// (TabsContent 的 mount 动画计时器清理)和 getComputedStyle(Presence 读取
// animation-name 判断退场动画是否结束)——jsdom 的 window 上有实现,只是没有
// 像 requestAnimationFrame 一样被复制到裸 global 上,这里一并补上。
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { ReaderAiChat } = await import("../src/pages/reader/legacy/components/ReaderAiChat.jsx");
const { createReaderAiHistoryStore } = await import("../src/js/reader/ai/chat-history-store.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`等待超时:${description}`);
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, `${v}`),
    removeItem: (k) => map.delete(k),
  };
}

// 单一 root 全文件复用:node:test 环境下测试内新建的第二个 createRoot
// 不会被调度冲刷(与 reader-drawers.test.mjs 同一坑),改为换 key 重挂组件。
const documentRef = dom.window.document;
const chatHost = documentRef.createElement("div");
documentRef.body.appendChild(chatHost);
const chatRoot = createRoot(chatHost);
let mountSeq = 0;

async function makeChat({ answer, remoteAnswerer = null, fallbackAnswerer = null } = {}) {
  const historyStore = createReaderAiHistoryStore({ jobId: "job-conv", storage: memoryStorage() });
  const controllerRef = { current: null };
  mountSeq += 1;
  chatRoot.render(React.createElement(ReaderAiChat, {
    key: `chat-${mountSeq}`,
    controllerRef,
    ports: {
      jobId: "job-conv",
      historyStore,
      fallbackAnswerer,
      remoteAnswerer: remoteAnswerer || {
        ensureLoaded: async () => true,
        answer: answer || (async ({ question }) => ({ answer: `回答:${question}`, citations: [], scope: "document" })),
      },
    },
  }));
  // 等挂载 + 启动流程(restore→prepare)收尾
  await waitFor(
    () => controllerRef.current && !statusText().includes("正在"),
    "chat 挂载并就绪",
  );
  return { controller: () => controllerRef.current, historyStore };
}

const bubbleTexts = () =>
  [...documentRef.querySelectorAll(".reader-ai-message .reader-ai-message-body-el")].map((el) => el.textContent);
const selectOptions = () =>
  [...documentRef.getElementById("reader-ai-session-select").options].map((o) => o.textContent);
const statusText = () => documentRef.getElementById("reader-ai-status")?.textContent || "";

test("Kết nối DOM: gửi biểu mẫu tạo bong bóng hỏi đáp, nút hội thoại mới xóa luồng", async () => {
  const { historyStore } = await makeChat();
  // 首个挂载:React 根事件委托可用,走真实 DOM 事件验布线
  const input = documentRef.getElementById("reader-ai-input");
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(input, "会话A问题");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  documentRef.querySelector("[data-reader-ai-composer]")
    .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(
    () => bubbleTexts().some((t) => t.includes("回答:会话A问题")),
    "Gửi DOM tạo bong bóng trả lời",
  );
  assert.ok(bubbleTexts().some((t) => t.includes("会话A问题")));

  documentRef.getElementById("reader-ai-new-btn")
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => bubbleTexts().length === 0, "Luồng hội thoại mới trống");
  assert.equal(historyStore.listSessions().length, 2);
});

test("Chuyển hội thoại: tải lại bong bóng của hội thoại đích", async () => {
  const { controller, historyStore } = await makeChat();
  await controller().submit("第一段问题");
  const idA = historyStore.activeSessionId();
  assert.ok(idA, "Sau lần gửi đầu tiên phải có hội thoại active");

  await controller().newConversation();
  assert.equal(bubbleTexts().length, 0, "Luồng hội thoại mới trống");
  await controller().submit("第二段问题");
  assert.ok(bubbleTexts().some((t) => t.includes("第二段问题")));
  assert.ok(!bubbleTexts().some((t) => t.includes("第一段问题")));

  await controller().switchConversation(idA);
  assert.ok(bubbleTexts().some((t) => t.includes("第一段问题")), "Bong bóng của A được khôi phục sau khi quay lại");
  assert.ok(!bubbleTexts().some((t) => t.includes("第二段问题")));
});

test("Xóa hội thoại hiện tại: loại bỏ và chuyển sang hội thoại còn lại", async () => {
  const { controller, historyStore } = await makeChat();
  await controller().submit("留存问题");
  await controller().newConversation();
  await controller().submit("待删问题");
  assert.equal(historyStore.listSessions().length, 2);

  await controller().deleteConversation();
  assert.equal(historyStore.listSessions().length, 1);
  assert.ok(bubbleTexts().some((t) => t.includes("留存问题")), "Sau khi xóa sẽ chuyển sang hội thoại được giữ lại");
});

test("Thanh chuyển hội thoại: sau khi gửi, danh sách xuất hiện tùy chọn có tiêu đề", async () => {
  const { controller } = await makeChat();
  await controller().submit("给会话取名的问题");
  await waitFor(
    () => selectOptions().some((t) => t.includes("给会话取名的问题")),
    "Danh sách xuất hiện tiêu đề hội thoại",
  );
});

test("提交状态流转:完成后状态为「可以继续提问」,输入框清空", async () => {
  const { controller } = await makeChat();
  await controller().submit("状态流转问题");
  await waitFor(() => statusText() === "可以继续提问", "终态状态落定");
  assert.equal(documentRef.getElementById("reader-ai-input").value, "");
  const texts = bubbleTexts();
  assert.equal(texts.length, 2);
  assert.equal(texts[0], "状态流转问题");
  assert.equal(texts[1], "回答:状态流转问题");
});

test("后端 502 时回退本地检索:状态与气泡注记", async () => {
  const { controller } = await makeChat({
    fallbackAnswerer: {
      ensureLoaded: async () => true,
      answer: async () => ({
        answer: "Local fallback",
        citations: [{ title: "Fallback", page: 2, snippet: "local snippet" }],
      }),
    },
    remoteAnswerer: {
      ensureLoaded: async () => true,
      answer: async () => {
        throw new Error("502 provider failed");
      },
    },
  });
  await controller().submit("Explain fallback");

  await waitFor(() => statusText() === "已用本地检索回答", "回退状态落定");
  const assistantText = bubbleTexts().at(-1);
  assert.match(assistantText, /Local fallback/);
  assert.match(assistantText, /引用/);
  assert.match(assistantText, /502 provider failed/);
});
