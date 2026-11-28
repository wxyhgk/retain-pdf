/** 阅读页这一侧的提问：右键 / ? 拼出处、书上的位置 → 提问窗的上下文、接线、问答记录（书页上的「?」）。
 * 提问窗本身（ACP、回答怎么画）的测试在 tests/ask/。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAskAnchor, nearestRegion, sectionForPage } from "../../../packages/reader/src/ask/anchor.ts";
import { anchorPreamble, bindAskPort, toAskContext } from "../../../packages/reader/src/ask/ask-context.ts";
import { normalizeReaderMetadata, normalizeReaderRegions } from "../../../packages/reader/src/shared/data/reader-regions.ts";

const ANCHOR = { pane: "translated", page: 56, itemId: "p056-b0003", selection: "", sourceText: "H = -Σ ∇²/2", translatedText: "哈密顿量", section: "2.1 电子问题", point: { x: 0.2, y: 0.4 } };

test("改这段译文（11-27）：出处两种写法都认出块；别的书、没块不算；建议的译文先取回答里选着的（截断的不算），再取 ```译文 代码块", async () => {
  const { contextBlock, contextSelection, suggestedTranslation } = await import("../../../packages/reader/src/ask/conversation-messages.ts");
  const stored = { page: 56, label: "第 56 页", data: { page: 56, document_id: "doc-1", item_ids: ["p056-b0003"] } };
  const fresh = { page: 56, label: "第 56 页", data: { retainpdf: { selection: { page: 56, document_id: "doc-1", item_ids: ["p056-b0003"] } } } };
  assert.equal(contextSelection(fresh).page, 56, "这次刚问的（_meta）也认，标签点了能跳");
  assert.equal(contextBlock(stored, "doc-1"), "p056-b0003");
  assert.equal(contextBlock(fresh, "doc-1"), "p056-b0003");
  assert.equal(contextBlock(stored, "doc-2"), null, "别的书");
  assert.equal(contextBlock({ page: 3, label: "第 3 页", data: { page: 3, item_ids: [] } }, "doc-1"), null, "没认出块");
  assert.equal(contextBlock({ label: "x" }, "doc-1"), null);
  const text = "这样改更好：\n\n```译文\n哈密顿量作用在波函数上。\n```\n\n或者：\n\n```zh\n第二版。\n```";
  assert.equal(suggestedTranslation({ text, selection: "" }), "第二版。", "最后一个代码块");
  assert.equal(suggestedTranslation({ text, selection: "  选的这句。 " }), "选的这句。", "选着的优先");
  assert.equal(suggestedTranslation({ text, selection: "截断的…" }), "第二版。", "截断的选区不填");
  assert.equal(suggestedTranslation({ text: "```python\nx = 1\n```", selection: "" }), null, "别的代码块不算");
  const panel = readFileSync(new URL("../../../packages/reader/src/ask/ReaderAskPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /const selection = contextSelection\(target\);/, "问题标签跳回去也用它");
  const wiring = readFileSync(new URL("../../../packages/reader/src/ask/use-reader-ask.tsx", import.meta.url), "utf8");
  assert.match(wiring, /editBlock\(itemId, draft \?\? undefined\);\n    requestAnimationFrame\(\(\) => jumpToBlock\(itemId, "translated"\)\);/);
  const editing = readFileSync(new URL("../../../packages/reader/src/app/use-reader-block-editing.ts", import.meta.url), "utf8");
  assert.match(editing, /if \(draft\?\.trim\(\)\) drafts\.set\(itemId, draft\);\n    selectBlock\(itemId\);/, "建议先放进草稿，编辑框打开就是它");
});

test("出处：第一句前面带第几页、哪一节、原文译文、任务号和块号；没认出字就说可能是扫描页", () => {
  const preamble = anchorPreamble(ANCHOR, "job-1", "现代量子化学");
  assert.match(preamble, /我在读《现代量子化学》，第 56 页，「2\.1 电子问题」（译文栏）/);
  assert.match(preamble, /这一块的原文：\nH = -Σ/);
  assert.match(preamble, /任务 job-1，块 p056-b0003，第 56 页/);
  assert.match(anchorPreamble({ ...ANCHOR, itemId: null, sourceText: "", translatedText: "" }, "job-1"), /没有认出文字/);
});

test("书上的位置 → 提问窗的上下文：页码、悬停写全的位置、引用（先给看问的那一栏）、出处；端口开会话时绑上任务号", async () => {
  const context = toAskContext(ANCHOR, "job-1", "现代量子化学");
  assert.equal(context.page, 56);
  assert.equal(context.label, "第 56 页 · 2.1 电子问题");
  assert.deepEqual(context.quote, { selection: undefined, source: "H = -Σ ∇²/2", translated: "哈密顿量", prefer: "translated" });
  assert.equal(context.preamble, anchorPreamble(ANCHOR, "job-1", "现代量子化学"));
  const seen = [];
  const port = bindAskPort({ listAgents: async () => [{ id: "a", name: "A" }], openSession: async (options) => { seen.push(options); return {}; } }, "job-1");
  assert.deepEqual(await port.listAgents(), [{ id: "a", name: "A" }]);
  await port.openSession({ agentId: "a" }, {});
  assert.deepEqual(seen, [{ agentId: "a", jobId: "job-1" }]);
});

test("拼出处：页、栏、页内位置、悬停认出的块、章节（书签优先，没有就前面最近的标题）", () => {
  const regions = [
    { itemId: "h1", headingLevel: 1, source: { page: 50, text: "第 2 章 多电子" }, translated: { text: "" }, markdown: "" },
    { itemId: "p056-b0003", source: { page: 56, text: "原文" }, translated: { text: "译文" }, markdown: "", translatedBlockText: "整块译文" },
  ];
  const pageElement = {
    getAttribute: (name) => ({ "data-reader-page": "56", "data-reader-pane": "source" })[name] ?? null,
    getBoundingClientRect: () => ({ left: 100, top: 0, width: 400, height: 600 }),
  };
  const anchor = buildAskAnchor({ pageElement, clientX: 200, clientY: 150, itemId: "p056-b0003", selection: "选的字", regions, bookmarks: [] });
  assert.deepEqual(anchor, { pane: "source", page: 56, itemId: "p056-b0003", selection: "选的字", sourceText: "原文", translatedText: "整块译文", section: "第 2 章 多电子", point: { x: 0.25, y: 0.25 } });
  const bookmarks = [{ id: "0", title: "Chapter 2", page: 40, level: 1, children: [] }];
  assert.equal(sectionForPage(bookmarks, regions, 56), "Chapter 2");
  assert.equal(buildAskAnchor({ pageElement: null, clientX: 0, clientY: 0, itemId: null, selection: "", regions, bookmarks }), null);
});

test("接线：宿主不给端口就没有提问入口；? 只在选着书页上的字时拦（不然照旧是快捷键帮助）；提问窗单独一块、用到才加载", async () => {
  // 2026-11-27 起提问是贡献表里的内置扩展：阅读页只画表（右键菜单项、每页一层、浮层），不再直接接提问。
  const app = readFileSync(new URL("../../../packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url), "utf8");
  assert.match(app, /actions=\{menuItems\}/);
  assert.match(app, /<ReaderExtensionOutlets extensions=\{BUILTIN_READER_EXTENSIONS\} \/>/);
  assert.doesNotMatch(app, /useReaderAsk|readerAsk\./, "阅读页不再直接接提问");
  const { BUILTIN_READER_EXTENSIONS } = await import("../../../packages/reader/src/extensions/builtin.ts");
  assert.ok(BUILTIN_READER_EXTENSIONS.some((extension) => extension.id === "ask" && extension.title === "提问"), "提问不在内置扩展里");
  const extension = readFileSync(new URL("../../../packages/reader/src/ask/ReaderAskExtension.tsx", import.meta.url), "utf8");
  assert.match(extension, /const contribution = useMemo<ReaderContribution>\(\(\) => \(enabled \? \{/, "没端口就什么都不登记");
  // 11-27：小球里有「提问」，不带出处地开 / 关这本书的主对话（新书还没问过时也找得到入口）。
  assert.match(extension, /toolbarItems: \[\{\n      key: "ask",\n      label: "提问",[\s\S]*?pressed: showing,\n      onClick: toggle,/);
  const wiring = readFileSync(new URL("../../../packages/reader/src/ask/use-reader-ask.tsx", import.meta.url), "utf8");
  assert.match(wiring, /if \(!picked\.text \|\| !picked\.element \|\| !picked\.rect\) return null;/);
  assert.match(wiring, /window\.addEventListener\("keydown", onKey, true\)/);
  assert.match(wiring, /lazy\(\(\) => import\("\.\/ReaderAskPanel\.js"\)\)/);
  assert.match(wiring, /const panel: ReactElement \| null = port && \(\(ask\.visible && ready\) \|\| legacy\)/);
  assert.match(wiring, /const ready = !ask\.persistent \|\| Boolean\(ask\.view\.conversation\) \|\| Boolean\(ask\.error\);/, "主对话读回来才画窗口（不白开一个会话）");
  assert.match(wiring, /if \(showing\) \{\n      setLegacy\(null\);\n      closeAsk\(\);\n      return;\n    \}\n    void ask\.openMain\(\);/, "小球的提问：开着关、关着开主对话");
  assert.match(wiring, /const menuItems = useCallback\(\(context: ReaderMenuContext\): ReaderMenuItem\[\] => \{\n    if \(!port\) return \[\];/);
  const host = readFileSync(new URL("../../src/features/reader/domain/ask-port.ts", import.meta.url), "utf8");
  assert.match(host, /if \(isMockMode\(\)\) return mockAskPort;/, "演示模式给假 agent");
  assert.match(host, /if \(isLanSharedPage\(\)\) return null;/, "局域网共享的页面不给（网关拦了 \/api\/v1\/ai）");
  const vite = readFileSync(new URL("../../../packages/reader/vite.config.ts", import.meta.url), "utf8");
  assert.match(vite, /@retainpdf\\\/ask/, "提问窗的包不打进阅读器 dist");
});

test("主对话接线：打开取主对话、读最近一页；每答完一轮追加（该压了就压）；结束了的副对话接着问先再开；书页上选字不再悄悄带进提问", () => {
  const hook = readFileSync(new URL("../../../packages/reader/src/ask/use-ask-conversation.ts", import.meta.url), "utf8");
  assert.match(hook, /const main = await conversations\.main\(bookRef\.current\.documentId \|\| undefined\);/, "主对话按书取（11-27）");
  assert.match(hook, /if \(shownBook\.current === book\.documentId\) return;/, "换书清掉上一本的对话");
  assert.match(hook, /conversations\.messages\(conversation\.conversation_id, \{ limit: PAGE/);
  assert.match(hook, /conversations\.append\(conversation\.conversation_id, input\)/);
  assert.match(hook, /if \(result\.compaction_due && conversation\.kind === "main"\) void conversations\.compact/);
  assert.match(hook, /ask_conversation_not_open/);
  const wiring = readFileSync(new URL("../../../packages/reader/src/ask/use-reader-ask.tsx", import.meta.url), "utf8");
  // 11-27 起窗口开着时选字会带进下一问（带着一处时问「换成这段 / 再加一段」）；2026-11-28 用户：「取消开着 AI 时
  // selectionchange 自动偷塞出处」——要问点选字浮条的「提问」、右键「问这段」或按 ?（reader-selection.test.mjs）。
  assert.doesNotMatch(wiring.replace(/\/\/[^\n]*/g, ""), /selectionchange/, "又在听选字");
  const marks = readFileSync(new URL("../../../packages/reader/src/ask/use-ask-marks.ts", import.meta.url), "utf8");
  assert.match(marks, /port\.threads\?\.list\(documentId\)/, "以前按书存的照旧画");
  assert.match(marks, /port\.conversations\?\.bookMessages\(documentId\)/);
  const panel = readFileSync(new URL("../../../packages/reader/src/ask/ReaderMemoryPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /port\.setEnabled\(next\)/, "「让 AI 使用记忆」存在后端，不在浏览器设置里");
  assert.match(panel, /AI 现在用不到这些记忆/, "关着时说清楚");
  const entry = readFileSync(new URL("../../../packages/reader/styles/entry.css", import.meta.url), "utf8");
  assert.match(entry, /ui\/styles\/sheet\.css/, "阅读页引了抽屉的样式（记忆面板）");
});

test("悬停还没认出块（鼠标刚移过来、点在两段之间）：按位置找同一页最近的块，太远（超过页高 15%）不算", () => {
  const box = (bbox) => ({ page: 5, bbox, text: "t" });
  const regions = normalizeReaderRegions({ items: [
    { item_id: "top", source: box([50, 100, 550, 200]), translated: box([50, 100, 550, 200]) },
    { item_id: "mid", source: box([50, 400, 550, 500]), translated: box([50, 400, 550, 500]) },
    { item_id: "other-page", source: { page: 6, bbox: [50, 400, 550, 500], text: "x" }, translated: { page: 6, bbox: [50, 400, 550, 500], text: "x" } },
  ] });
  const doc = { pages: [5, 6].map((page) => ({ page, width: 600, height: 1000 })) };
  const metadata = normalizeReaderMetadata({ source: doc, translated: doc });
  assert.equal(nearestRegion(regions, metadata, "source", 5, { x: 0.5, y: 0.45 })?.itemId, "mid", "点在块里");
  assert.equal(nearestRegion(regions, metadata, "source", 5, { x: 0.5, y: 0.3 })?.itemId, "top", "两段之间取近的");
  assert.equal(nearestRegion(regions, metadata, "source", 5, { x: 0.5, y: 0.9 }), null, "离最近的块也太远");
  const pageElement = { getAttribute: (name) => ({ "data-reader-page": "5", "data-reader-pane": "translated" })[name] ?? null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 1000 }) };
  const anchor = buildAskAnchor({ pageElement, clientX: 300, clientY: 300, itemId: null, selection: "", regions, bookmarks: [], metadata });
  assert.equal(anchor.itemId, "top");
  assert.equal(anchor.sourceText, "t");
});

test("术语记忆加进术语表（11-27）：一句话拆成原文和译法；只认术语类或这本书里写成「X 译为 Y」的；同一个原文换成新译法、别的字段留着", async () => {
  const { splitTermMemory } = await import("../../../packages/reader/src/ask/term-memory.ts");
  assert.deepEqual(splitTermMemory("Hamiltonian 定译为哈密顿量"), { source: "Hamiltonian", target: "哈密顿量" });
  assert.deepEqual(splitTermMemory("「Slater determinant」译作“斯莱特行列式”。"), { source: "Slater determinant", target: "斯莱特行列式" });
  assert.deepEqual(splitTermMemory("Fock operator → Fock 算符，不要译成福克算子"), { source: "Fock operator", target: "Fock 算符" });
  assert.deepEqual(splitTermMemory("exchange integral：交换积分"), { source: "exchange integral", target: "交换积分" });
  assert.deepEqual(splitTermMemory("读到第三章了"), { source: "读到第三章了", target: "" }, "认不出：整句放原文");
  const { isTermMemory } = await import("../../../packages/reader/src/ask/ReaderMemoryPanel.tsx");
  assert.equal(isTermMemory({ category: "term", scope: "book", text: "随便" }), true);
  assert.equal(isTermMemory({ category: "other", scope: "book", text: "spin 译为 自旋" }), true, "自己加的（记不了类别）");
  assert.equal(isTermMemory({ category: "other", scope: "user", text: "spin 译为 自旋" }), false, "关于你的不算");
  assert.equal(isTermMemory({ category: "progress", scope: "book", text: "读到第三章了" }), false);
  const { mergeGlossaryEntry } = await import("../../src/features/reader/domain/ask-glossary-port.ts");
  const entries = [{ source: "Spin", target: "旋", level: "canonical", match_mode: "exact" }, { source: "orbital", target: "轨道" }];
  const replaced = mergeGlossaryEntry(entries, { source: "spin ", target: "自旋", note: "阅读页提问时定的" });
  assert.equal(replaced.replaced, true);
  assert.deepEqual(replaced.entries[0], { source: "spin ", target: "自旋", level: "canonical", match_mode: "exact", note: "阅读页提问时定的" });
  assert.equal(replaced.entries.length, 2);
  const added = mergeGlossaryEntry(entries, { source: "Fock operator", target: "Fock 算符" });
  assert.equal(added.replaced, false);
  assert.deepEqual(added.entries.at(-1), { source: "Fock operator", target: "Fock 算符" });
  const host = readFileSync(new URL("../../src/features/reader/domain/ask-glossary-port.ts", import.meta.url), "utf8");
  assert.match(host, /expected_updated_at: current\.updated_at/, "整份保存带 updated_at，不盖掉别处的改动");
});

test("截图带进提问（11-27）：拖出的一块换成占这一页的比例（夹在页内，太小不算）；文件名；右键多「截一块问」；输入框那一行「带上这一页」", async () => {
  const { dragRegion, regionImageName, FULL_PAGE } = await import("../../../packages/reader/src/pdf/region-image.ts");
  const page = { left: 100, top: 50, width: 400, height: 600 };
  assert.deepEqual(dragRegion(page, { x: 300, y: 350 }, { x: 140, y: 110 }), { left: 0.1, top: 0.1, width: 0.4, height: 0.4 }, "反着拖也行");
  const clipped = dragRegion(page, { x: 0, y: 0 }, { x: 300, y: 350 });
  assert.deepEqual([clipped.left, clipped.top], [0, 0], "拖出页外夹回来");
  assert.equal(dragRegion(page, { x: 200, y: 200 }, { x: 203, y: 204 }), null, "只是点了一下");
  assert.equal(regionImageName(12, FULL_PAGE), "第12页.png");
  assert.equal(regionImageName(12, { left: 0.1, top: 0.1, width: 0.2, height: 0.2 }), "第12页-截图.png");
  const wiring = readFileSync(new URL("../../../packages/reader/src/ask/use-reader-ask.tsx", import.meta.url), "utf8");
  assert.match(wiring, /key: "crop",\n      label: "截一块问",/);
  assert.match(wiring, /label: "带上这一页",/);
  assert.match(wiring, /blob = await renderRegionImage\(pdf, page, region\);/, "有 pdf.js 文档就重新画");
  const extension = readFileSync(new URL("../../../packages/reader/src/ask/ReaderAskExtension.tsx", import.meta.url), "utf8");
  assert.match(extension, /takesPointer: cropping,/, "截图时占着指针");
});

test("同一问带几处（11-27）：第一处进 _meta 和出处，另外几处写成一段字（认结构化出处的 agent 也带）；标签写「第 12 页 + 第 10 页」", async () => {
  const { toAskContext, extraPreamble } = await import("../../../packages/reader/src/ask/ask-context.ts");
  const second = { ...ANCHOR, page: 10, section: "", selection: "Fock operator", itemId: "p010-b0002" };
  const context = toAskContext(ANCHOR, "job-1", "", { page: 56, item_ids: ["p056-b0003"] }, [second]);
  assert.equal(context.label, "第 56 页 · 2.1 电子问题 + 第 10 页");
  assert.deepEqual(context.meta, { retainpdf: { selection: { page: 56, item_ids: ["p056-b0003"] } } }, "_meta 只放第一处");
  assert.match(context.extra, /^另外一处（2）：第 10 页（译文栏）。\n选中的这段：\nFock operator\n（块 p010-b0002）$/);
  assert.equal(toAskContext(ANCHOR, "job-1").extra, undefined, "只有一处就没有");
  assert.equal(toAskContext(ANCHOR, "job-1", "", undefined, [{ ...second, page: 56 }]).label, "第 56 页 · 2.1 电子问题 + 同页另一段");
  assert.equal(extraPreamble([]), "");
  const { MAX_EXTRAS } = await import("../../../packages/reader/src/ask/use-ask-conversation.ts");
  assert.equal(MAX_EXTRAS, 2, "一问最多三处");
});

test("归档（11-27）：先确认；「以前的对话」列这本书归档了的主对话，点了只读地看，「主对话」回到现在这条", async () => {
  const { mockAskConversations } = await import("../../src/platform/mock/ask-conversations.ts");
  const first = await mockAskConversations.main("doc-archive-test");
  await mockAskConversations.archive(first.conversation_id);
  const second = await mockAskConversations.main("doc-archive-test");
  assert.notEqual(second.conversation_id, first.conversation_id, "归档以后再取是新的");
  const archived = await mockAskConversations.archived("doc-archive-test");
  assert.deepEqual(archived.map((record) => record.conversation_id), [first.conversation_id]);
  assert.deepEqual(await mockAskConversations.archived("doc-other"), [], "别的书的不列");
  const panel = readFileSync(new URL("../../../packages/reader/src/ask/ReaderAskPanel.tsx", import.meta.url), "utf8");
  // 2026-11-27 起「归档」「以前的对话」收进标题栏左边的对话菜单（ReaderAskConversationMenu，下面一条测试真画出来）。
  assert.match(panel, /<ReaderAskConversationMenu ask=\{ask\} canArchive=\{main\}/);
  assert.match(panel, /readOnly=\{archived\}/, "归档了的只能看");
  const hook = readFileSync(new URL("../../../packages/reader/src/ask/use-ask-conversation.ts", import.meta.url), "utf8");
  assert.match(hook, /await load\(record, viewRef\.current\.main\);/, "看归档的时，面包屑的「主对话」还是现在这条");
  assert.match(hook, /if \(!conversations \|\| \(shown\?\.kind === "main" && shown\.status !== "archived"\)\) return;/, "看着归档的时候再问：回到现在的主对话");
  const host = readFileSync(new URL("../../src/features/reader/domain/ask-conversations-port.ts", import.meta.url), "utf8");
  assert.match(host, /listAskConversations\(API_PREFIX, \{ kind: "main", status: "archived"/);
});

test("对话菜单（2026-11-27）：「主对话 ▾」里开个新对话（先问一句）、列以前的对话（点了只读看）；看着以前的 / 副对话时有「回主对话」", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
  const keys = ["window", "document", "navigator", "HTMLElement", "HTMLDetailsElement", "Element", "Node", "Event", "MouseEvent", "KeyboardEvent", "PointerEvent"];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  for (const key of keys) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const React = await import("react");
    const { act } = React;
    const { createRoot } = await import("react-dom/client");
    const { ReaderAskConversationMenu, conversationLabel } = await import("../../../packages/reader/src/ask/ReaderAskConversationMenu.tsx");
    const calls = [];
    const old = { conversation_id: "c-old", kind: "main", status: "archived", title: "主对话", updated_at: "2026-11-20T10:00:00Z", message_count: 12 };
    const ask = (conversation) => ({
      persistent: true,
      view: { conversation },
      listArchived: async () => [old],
      viewArchived: async (record) => calls.push(["view", record.conversation_id]),
      archiveMain: async () => { calls.push(["archive"]); },
      backToMain: async () => calls.push(["back"]),
    });
    assert.equal(conversationLabel({ kind: "main", status: "open" }), "主对话");
    assert.equal(conversationLabel({ kind: "side", status: "open", title: "Fock 算符" }), "副对话 · Fock 算符");
    assert.equal(conversationLabel(old), "以前的对话 · 2026-11-20");
    const root = createRoot(document.getElementById("root"));
    await act(async () => root.render(React.createElement(ReaderAskConversationMenu, { ask: ask({ conversation_id: "c-now", kind: "main", status: "open" }), canArchive: true, canList: true })));
    const details = document.querySelector(".reader-ask-conversations");
    assert.match(details.querySelector("summary").textContent, /主对话/);
    await act(async () => { details.open = true; details.dispatchEvent(new dom.window.Event("toggle")); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const body = document.querySelector(".ask-head-menu-body");
    assert.match(body.textContent, /开个新对话/);
    assert.match(body.textContent, /2026-11-20.*12 条/, "以前的对话列出来");
    assert.doesNotMatch(body.textContent, /回主对话/, "在主对话里不出「回主对话」");
    const newButton = [...body.querySelectorAll("button")].find((button) => /开个新对话/.test(button.textContent));
    await act(async () => newButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    assert.deepEqual(calls, [], "先问一句，不直接开");
    assert.match(document.querySelector(".reader-ask-confirm").textContent, /现在这段收起来，开个新的？/);
    await act(async () => document.querySelector(".reader-ask-confirm-yes").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    assert.deepEqual(calls, [["archive"]]);
    await act(async () => root.render(React.createElement(ReaderAskConversationMenu, { ask: ask(old), canArchive: false, canList: true })));
    await act(async () => { details.open = true; details.dispatchEvent(new dom.window.Event("toggle")); });
    assert.match(document.querySelector(".reader-ask-conversations summary").textContent, /以前的对话 · 2026-11-20/);
    const back = [...document.querySelectorAll(".ask-head-menu-body button")].find((button) => /回主对话/.test(button.textContent));
    assert.ok(back, "看着以前的对话：有「回主对话」");
    assert.doesNotMatch(document.querySelector(".ask-head-menu-body").textContent, /开个新对话/);
    await act(async () => back.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    assert.deepEqual(calls.at(-1), ["back"]);
    await act(async () => root.unmount());
  } finally {
    for (const [key, value] of Object.entries(previous)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    dom.window.close();
  }
});
