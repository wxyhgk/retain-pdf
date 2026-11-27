/** 提问窗（@retainpdf/ask/window）：回答里的页码能点、引用原文里的公式、用量那一行的图标版、思考用时存回；
 * 最后一个测试在 jsdom 里真把窗口画出来，用假 agent 点一遍。 */
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { PAGE_HREF_PREFIX, pageFromHref, remarkPageCitations, splitPageRefs } from "../../../packages/ask/src/window/page-citations.ts";
import { compactNumber, emptyTurn, turnFooterItems } from "../../../packages/ask/src/acp/parts.ts";
import { toInitialMessages, toStoredMessages } from "../../../packages/ask/src/acp/messages.ts";
import { splitMath } from "../../../packages/ask/src/window/AskQuote.tsx";
import { shortAgentName } from "../../../packages/ask/src/window/AskHeader.tsx";
import { QUOTE_LIMIT, answerSelectionText, rangeText, splitQuote, withQuote } from "../../../packages/ask/src/window/answer-quote.tsx";
import { fitRect, pickAgent } from "../../../packages/ask/src/window/window-memory.ts";

const pages = (segments) => segments.filter((segment) => segment.type === "page").map((segment) => segment.page);

test("页码：「（第 12 页）」「第 56、58 页」「第 3–5 页」「p. 12」「pp. 4-6」里的数字认成页码，别的数不动", () => {
  assert.deepEqual(pages(splitPageRefs("见（第 12 页）。")), [12]);
  assert.deepEqual(pages(splitPageRefs("第 56、58 页都有")), [56, 58]);
  assert.deepEqual(pages(splitPageRefs("第3–5页")), [3, 5]);
  assert.deepEqual(pages(splitPageRefs("see p. 12 and pp. 4-6")), [12, 4, 6]);
  assert.deepEqual(pages(splitPageRefs("第 2 章有 3 个式子，式 (2.2)")), [], "不是页码");
  const segments = splitPageRefs("书里第 2、3 页");
  assert.equal(segments.map((segment) => segment.value).join(""), "书里第 2、3 页", "切开再拼回去一字不差");
  assert.deepEqual(pages(splitPageRefs("第 2、900 页", 481)), [2], "超出这本书的页数不算");
});

test("页码 remark 插件：正文里的页码换成页码链接，代码、公式、已有链接里的不动", () => {
  const tree = { type: "root", children: [
    { type: "paragraph", children: [{ type: "text", value: "看第 7 页" }, { type: "inlineCode", value: "第 8 页" }, { type: "inlineMath", value: "p. 9" }] },
    { type: "paragraph", children: [{ type: "link", url: "https://x", children: [{ type: "text", value: "第 10 页" }] }] },
  ] };
  remarkPageCitations()(tree);
  const [first, second] = tree.children;
  assert.deepEqual(first.children.map((node) => node.type), ["text", "link", "text", "inlineCode", "inlineMath"]);
  assert.equal(first.children[1].url, `${PAGE_HREF_PREFIX}7`);
  assert.equal(pageFromHref(first.children[1].url), 7);
  assert.equal(second.children[0].url, "https://x");
  assert.equal(pageFromHref("https://x"), null);
});

test("引用原文：OCR 的 $ M_{A} $、$$…$$、\\(…\\) 切出公式，别的照原样", () => {
  assert.deepEqual(splitMath("where $ M_{A} $ is the mass"), [
    { type: "text", value: "where " },
    { type: "math", value: "M_{A}" },
    { type: "text", value: " is the mass" },
  ]);
  assert.deepEqual(splitMath("$$a+b$$ 和 \\(c\\)").map((segment) => segment.type), ["math", "text", "math"]);
  assert.deepEqual(splitMath("没有公式"), [{ type: "text", value: "没有公式" }]);
});

test("用量那一行（图标版）：每项短字 + 悬停写全，数字缩写，没有的项不出", () => {
  const turn = { ...emptyTurn(0), firstTokenAt: 3100, lastTokenAt: 6000, chunks: 30, usage: { model: "claude-haiku-5-5", inputTokens: 3822, outputTokens: 636, cacheWriteTokens: 3818, contextUsed: 4000, contextSize: 200000 } };
  const items = turnFooterItems(turn, 6600, "RetainPDF 自带模型");
  assert.deepEqual(items.map((item) => item.key), ["model", "input", "output", "cacheWrite", "context", "speed", "firstToken", "elapsed"]);
  assert.equal(items[0].text, "claude-haiku-5-5");
  assert.equal(items[0].title, "RetainPDF 自带模型（claude-haiku-5-5）");
  assert.equal(items[1].text, "3.8k");
  assert.equal(items[1].title, "输入 3822 token");
  assert.equal(items[4].text, "2%");
  assert.equal(items.at(-1).text, "6.6s");
  assert.equal(compactNumber(999), "999");
  assert.equal(compactNumber(12345), "12k");
  assert.equal(compactNumber(1_234_567), "1.2M");
  assert.deepEqual(turnFooterItems(emptyTurn(0), null), []);
});

test("思考用时存进问答记录，重新打开放回思考那一段（标题照样写用时）", () => {
  const stored = toStoredMessages([
    { role: "user", content: [{ type: "text", text: "Q" }] },
    { role: "assistant", content: [{ type: "reasoning", text: "想", timing: { startedAt: 1000, completedAt: 1800 } }, { type: "text", text: "A" }], metadata: { custom: {} } },
  ]);
  assert.equal(stored[1].usage.thoughtMs, 800);
  const [, assistant] = toInitialMessages(stored);
  assert.deepEqual(assistant.content[0].timing, { startedAt: 0, completedAt: 800 });
});

test("名字短写：「RetainPDF 自带模型」→「自带模型」，别的不动", () => {
  assert.equal(shortAgentName("RetainPDF 自带模型"), "自带模型");
  assert.equal(shortAgentName("Claude Code"), "Claude Code");
});

test("回答里选字引用回复：引用写成「> 」放在问题前面、拆得回来；公式换回 TeX；只认回答里的选区；超长截断", () => {
  const sent = withQuote("第一行\n第二行", "这句什么意思？");
  assert.equal(sent, "> 第一行\n> 第二行\n\n这句什么意思？");
  assert.deepEqual(splitQuote(sent), { quote: "第一行\n第二行", rest: "这句什么意思？" });
  assert.equal(withQuote("引的", "  "), "  ", "问题是空的不加（发不出去）");
  assert.equal(withQuote("", "问"), "问");
  assert.equal(splitQuote("> 只是一行大于号开头的问题"), null, "后面没空行不算引用");
  assert.equal(splitQuote("普通的问"), null);

  const dom = new JSDOM(`<div id="win"><div data-role="assistant"><p>质能 <span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">E=mc^2</annotation></semantics></math></span><span class="katex-html">E=mc2</span></span> 是</p><p>第二段</p></div><div data-role="user"><p>我的问</p></div></div>`);
  const doc = dom.window.document;
  const win = doc.getElementById("win");
  const [first, second] = doc.querySelectorAll('[data-role="assistant"] p');
  const range = doc.createRange();
  range.setStart(first.firstChild, 0);
  range.setEnd(second.firstChild, 3);
  assert.equal(rangeText(range, doc), "质能 $E=mc^2$ 是\n第二段", "公式不重复、段落换行");
  const selection = dom.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  assert.equal(answerSelectionText(win, selection), "质能 $E=mc^2$ 是\n第二段");
  const mine = doc.createRange();
  mine.selectNodeContents(doc.querySelector('[data-role="user"] p'));
  selection.removeAllRanges();
  selection.addRange(mine);
  assert.equal(answerSelectionText(win, selection), "", "选在自己的问题上不算");
  assert.equal(answerSelectionText(null, selection), "");
  first.textContent = "字".repeat(QUOTE_LIMIT + 20);
  const long = doc.createRange();
  long.selectNodeContents(first);
  assert.equal([...rangeText(long, doc)].length, QUOTE_LIMIT + 1, "截断加「…」");
});

test("窗口记忆（11-27）：默认 agent 是上次用的（还能用才算）；记的浮动位置挪回屏幕里", () => {
  const agents = [{ id: "a", available: true }, { id: "pi", available: true }, { id: "codex", available: false }];
  assert.equal(pickAgent(agents, "pi"), "pi", "上次用的");
  assert.equal(pickAgent(agents, "codex"), "a", "上次用的没装了：第一个能用的");
  assert.equal(pickAgent(agents, undefined), "a");
  assert.equal(pickAgent([], "pi"), "");
  assert.deepEqual(fitRect({ x: 1800, y: 900, width: 500, height: 640 }, { width: 1200, height: 800 }), { x: 700, y: 160, width: 500, height: 640 }, "换了小屏：挪回来");
  assert.deepEqual(fitRect({ x: 10, y: 10, width: 2000, height: 100 }, { width: 1200, height: 800 }), { x: 10, y: 10, width: 1184, height: 280 }, "太宽缩回、太矮撑到最小");
});

test("真把窗口画出来：常问一点就问；回答里的页码点了交给宿主跳页；引用的公式画出来；贴右边 / 放大切换；Esc 关", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  const keys = ["window", "document", "navigator", "HTMLElement", "HTMLButtonElement", "HTMLTextAreaElement", "Element", "Node", "Event", "MouseEvent", "KeyboardEvent", "MutationObserver", "NodeFilter", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "addEventListener", "removeEventListener", "dispatchEvent", "innerWidth", "innerHeight", "localStorage"];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  for (const key of keys) {
    const value = typeof dom.window[key] === "function" && /^[a-z]/.test(key) ? dom.window[key].bind(dom.window) : dom.window[key];
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  dom.window.ResizeObserver ??= globalThis.ResizeObserver;
  dom.window.HTMLElement.prototype.scrollTo ??= function scrollTo() {};
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { default: AskWindow } = await import("../../../packages/ask/src/window/AskWindow.tsx");
    const prompts = [];
    const port = {
      listAgents: async () => [
        { id: "a", name: "RetainPDF 自带模型", available: true },
        { id: "codex", name: "Codex", available: false, install: "npm install -g codex-acp" },
      ],
      openSession: async ({ agentId }, handlers) => ({
        sessionId: "sess-1",
        prompt: async (blocks) => {
          prompts.push({ agentId, blocks });
          handlers.onUpdate({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "见第 12 页。" } });
          return { stopReason: "end_turn" };
        },
        cancel() {},
        close() {},
      }),
    };
    const jumps = [];
    let closed = 0;
    const turns = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (check, label) => {
      for (let index = 0; index < 100; index += 1) {
        if (check()) return;
        await settle(20);
      }
      assert.fail(`等不到：${label}`);
    };
    const records = [];
    const forks = [];
    const layouts = [];
    const actions = [];
    localStorage.setItem("retainpdf.ask.window.v1", JSON.stringify({ agentId: "gone" }));
    const CONTEXT = { page: 56, label: "第 56 页 · 2.1", quote: { source: "where $ M_{A} $ is the mass", translated: "其中质量" }, preamble: "我在读一本书，第 56 页。", meta: { retainpdf: { selection: { page: 56 } } } };
    // 宿主：下一问的出处发出去就清掉。
    function Host() {
      const [context, setContext] = React.useState(CONTEXT);
      return React.createElement(AskWindow, {
        port,
        context,
        onContextUsed: () => setContext(null),
        onContextClear: () => setContext(null),
        onClose: () => (closed += 1),
        onJumpToPage: (page) => jumps.push(page),
        onTurnDone: (messages, agentId, sessionId) => turns.push({ count: messages.length, agentId, sessionId }),
        onTurn: (turn) => records.push(turn),
        onFork: (message) => forks.push(message),
        onLayout: (layout) => layouts.push(layout),
        answerAction: { label: "改这段译文", title: "改", available: (target) => target.page === 56, run: (target, answer) => actions.push({ page: target.page, data: target.data, ...answer }) },
        pageCount: 100,
      });
    }
    root.render(React.createElement(Host));
    await until(() => document.querySelector(".ask-starter") && /RetainPDF 自带模型/.test(document.querySelector(".ask-agent-trigger")?.getAttribute("title") || ""), "常问按钮和 agent 列表");
    const panel = document.querySelector(".ask-panel");
    assert.equal(panel.getAttribute("data-mode"), "float");
    assert.equal(document.querySelector(".ask-pending-label")?.textContent, "第 56 页 · 2.1", "输入框上面是下一问带的出处");
    assert.equal(document.querySelector(".ask-quote"), null, "引的那段收着");
    document.querySelector(".ask-pending-label").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await until(() => document.querySelector(".ask-quote .katex"), "点开出处：引用里的公式画出来了");
    assert.ok(document.querySelector('.ask-install summary[aria-label="还能接的本机 agent"]'), "没装的 agent 收在插头图标里");
    // 11-27：带着出处时常问在输入框上面（不只是空对话时才有），空白处不再重复一排。
    assert.equal(document.querySelectorAll(".ask-starters").length, 1);
    assert.ok(document.querySelector(".ask-pending-starters .ask-starter"), "常问跟着出处");

    document.querySelector(".ask-starter").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await until(() => document.querySelector(".aui-md-p .ask-page"), "回答里的页码");
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0].blocks[0].text, "我在读一本书，第 56 页。", "这一问前面带宿主给的出处");
    await until(() => !document.querySelector(".ask-pending"), "发出去以后出处清掉");
    assert.equal(document.querySelector(".ask-pending-starters"), null, "出处用掉了，常问跟着收起");
    assert.equal(document.querySelector(".ask-question-where")?.textContent, "第 56 页 · 2.1", "问题上面写问的是哪儿");
    document.querySelector(".aui-md-p .ask-page").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(jumps, [12]);
    await until(() => turns.length, "答完一轮交出去存");
    assert.deepEqual(turns.at(-1), { count: 2, agentId: "a", sessionId: "sess-1" }, "存问答记录时带上答这一轮的 ACP 会话");
    await until(() => records.length, "这一轮交给宿主追加");
    const turn = records.at(-1);
    assert.equal(turn.question.role, "user");
    assert.equal(turn.answer.text, "见第 12 页。");
    assert.equal(turn.context.label, "第 56 页 · 2.1", "带着发问时用的出处");
    assert.deepEqual([turn.agentId, turn.sessionId, turn.memoryIds], ["a", "sess-1", []]);
    assert.ok(turn.answerId && turn.startedAt > 0, "交出回答的消息编号和开始时刻");
    document.querySelector(".ask-fork").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(forks, [{ id: undefined, text: "见第 12 页。" }], "回答底下的「深挖」");
    // 11-27：宿主加的动作（阅读页的「改这段译文」）：问题带着出处、宿主认这处才有；点了交回出处和回答。
    document.querySelector(".ask-answer-action").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(actions, [{ page: 56, data: { retainpdf: { selection: { page: 56 } } }, text: "见第 12 页。", selection: "" }]);

    // 回答里选字 → 输入框上面「引用回答」→ 打字发出去：问题前面带「> 」引用，气泡里画成引用框。
    const answerText = document.querySelector('[data-role="assistant"] .aui-md-p').firstChild;
    const picked = document.createRange();
    picked.setStart(answerText, 0);
    picked.setEnd(answerText, 1);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(picked);
    document.dispatchEvent(new dom.window.Event("selectionchange"));
    await until(() => document.querySelector(".ask-reply-quote .ask-pending-label"), "输入框上面出引用");
    assert.equal(document.querySelector(".ask-reply-quote .ask-pending-label").textContent, "引用回答 · 1 字");
    const input = document.querySelector(".aui-composer-input");
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(input, "为什么？");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await settle();
    document.querySelector(".aui-composer-send").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await until(() => prompts.length === 2, "第二问发出去");
    assert.equal(prompts[1].blocks.at(-1).text, "> 见\n\n为什么？", "引用放在问题前面");
    await until(() => document.querySelector(".ask-user-quote"), "问题气泡里的引用框");
    assert.equal(document.querySelector(".ask-user-quote").textContent, "见");
    assert.equal(document.querySelector(".ask-reply-quote"), null, "发出去以后引用清掉");
    document.dispatchEvent(new dom.window.Event("selectionchange"));
    await settle(300);
    assert.equal(document.querySelector(".ask-reply-quote"), null, "选区还在也不再冒出来");

    const button = (label) => [...document.querySelectorAll(".ask-head button")].find((element) => element.getAttribute("aria-label") === label);
    button("贴到右边").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await settle();
    assert.equal(document.querySelector(".ask-panel").getAttribute("data-mode"), "dock");
    assert.equal(layouts.at(-1).mode, "dock", "摆法交给宿主（书页让出右边）");
    assert.equal(JSON.parse(localStorage.getItem("retainpdf.ask.window.v1")).mode, "dock", "贴右边记在本机");
    button("放大").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await settle();
    assert.equal(document.querySelector(".ask-panel").getAttribute("data-mode"), "full");
    assert.equal(JSON.parse(localStorage.getItem("retainpdf.ask.window.v1")).mode, "dock", "放大不记");
    button("还原").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await settle();
    assert.equal(document.querySelector(".ask-panel").getAttribute("data-mode"), "dock", "还原回到放大前的贴右边");

    // 开着弹层时 Esc 只关弹层，不关窗。
    const popper = document.createElement("div");
    popper.setAttribute("data-radix-popper-content-wrapper", "");
    document.body.appendChild(popper);
    window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(closed, 0, "有弹层时不关窗");
    popper.remove();
    window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(closed, 1);
    root.unmount();
    await settle(100);
  } finally {
    for (const [key, value] of Object.entries(previous)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    dom.window.close();
  }
});
