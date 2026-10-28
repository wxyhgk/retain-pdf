/** 终端的作用域切换：这本书 / 某个文件夹。
 *
 * 起因：agent 的工作区此前只有单本书一种,于是「这几篇里哪些互相矛盾」这类问题
 * **在结构上问不出来**。后端已经能物化文件夹工作区,这里是把它接到人手上。
 *
 * 守四件事,每一件反过来都是安静的错：
 * - 会话键前缀**两种语言一致**（不一致 = 终端静默落回私有目录）
 * - 切之前必须先物化（不物化 = books/ 空着,没有任何报错）
 * - 空文件夹不给选（切过去 agent 什么也看不到,它会当成"这文件夹是空的"）
 * - 没有文件夹的人看到的终端和以前一样
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  COLLECTION_SESSION_PREFIX,
  ensureCollectionWorkspace,
  loadCollectionOptions,
  scopeLabel,
  sessionKeyForScope,
} from "../../src/features/reader/domain/terminal-scope.ts";

const read = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const PANEL = read("../../src/features/reader/ui/terminal.tsx");
// 标签条 / 作用域条 / 提示 chip 拆到了外壳文件（terminal.tsx 撞上体量棘轮）。
const CHROME = read("../../src/features/reader/ui/terminal-chrome.tsx");

// ---------------------------------------------------------------- 跨语言对账

test("会话键前缀和 Python 侧一致", () => {
  // 不一致的表现：终端开起来了,但 Python 认不出这是文件夹会话,退回私有目录 ——
  // 用户看到一个空的 ~,没有任何报错,而两边代码看起来都没错。
  const py = read("../../../../backend/ai/retainpdf_ai/fx_workspace.py");
  const declared = /_COLLECTION_PREFIX = "([^"]+)"/.exec(py);
  assert.ok(declared, "Python 侧没有声明前缀");
  assert.equal(COLLECTION_SESSION_PREFIX, declared[1]);
});

test("会话键的形状", () => {
  assert.equal(sessionKeyForScope({ kind: "job", jobId: "20260921092508-fe8d63" }),
    "20260921092508-fe8d63");
  assert.equal(
    sessionKeyForScope({ kind: "collection", collectionId: "col-1", name: "化学", documentCount: 4 }),
    "collection:col-1",
  );
});

// ---------------------------------------------------------------- 选项

test("空文件夹不给选", () => {
  // 切过去只会得到 books/ 为空的工作区,而 agent 无从判断这是「文件夹是空的」
  // 还是「出错了」——它会照着空目录下结论。
  return loadCollectionOptions(async () => ({
    collections: [
      { collection_id: "col-1", name: "化学", document_count: 4 },
      { collection_id: "col-2", name: "空的", document_count: 0 },
      { collection_id: "", name: "没 id", document_count: 3 },
    ],
  })).then((options) => {
    assert.deepEqual(options.map((o) => o.collectionId), ["col-1"]);
    assert.equal(options[0].documentCount, 4);
  });
});

test("取不到文件夹列表不抛 —— 这只是个可选入口", async () => {
  // 抛出去会让整个终端面板坏掉,而终端本身跟文件夹没关系。
  assert.deepEqual(await loadCollectionOptions(async () => { throw new Error("boom"); }), []);
  assert.deepEqual(await loadCollectionOptions(async () => null), []);
  assert.deepEqual(await loadCollectionOptions(async () => ({})), []);
});

test("标签带本数 —— 「化学」看不出范围", () => {
  assert.equal(
    scopeLabel({ kind: "collection", collectionId: "c", name: "化学", documentCount: 4 }),
    "化学 · 4 本",
  );
  assert.equal(scopeLabel({ kind: "job", jobId: "j" }), "这本书");
});

// ---------------------------------------------------------------- 物化

test("物化成功返回 null，失败返回能看懂的原因", async () => {
  assert.equal(
    await ensureCollectionWorkspace(async () => ({ books: [{}, {}] }), "col-1"),
    null,
  );
  // 一本都没物化出来 = 全都还没翻译完。切过去 agent 什么也看不到。
  assert.match(
    await ensureCollectionWorkspace(async () => ({ books: [] }), "col-1"),
    /还没有翻译好的书/,
  );
  assert.match(
    await ensureCollectionWorkspace(async () => ({}), "col-1"),
    /格式不对/,
  );
  assert.ok(await ensureCollectionWorkspace(async () => { throw new Error("HTTP 500"); }, "col-1"));
  // 文件夹已经被删了：后端 404，说人话。
  assert.equal(
    await ensureCollectionWorkspace(
      async () => { throw Object.assign(new Error("HTTP 404"), { status: 404 }); },
      "col-1",
    ),
    "这个文件夹已经不存在了",
  );
});

test("物化交给传进来的函数，传的是原样的文件夹编号", async () => {
  // 地址、POST、转义归 API 层的 materializeCollectionWorkspace（api-client-codegen.test.mjs 守）。
  const seen = [];
  await ensureCollectionWorkspace(async (collectionId) => {
    seen.push(collectionId);
    return { books: [{}] };
  }, "col-20261019120000-abc123");
  assert.deepEqual(seen, ["col-20261019120000-abc123"]);
  // 面板里接的是 API 层的函数，不再自己拼地址、带 key。
  const block = CHROME.slice(CHROME.indexOf("export function TerminalScopeBar"), CHROME.indexOf("if (options.length === 0)"));
  assert.match(block, /materializeCollectionWorkspace\(API_PREFIX, collectionId\)/);
  assert.match(block, /listCollections\(API_PREFIX\)/);
  assert.doesNotMatch(block, /fetch\(|X-API-Key/);
});

// ---------------------------------------------------------------- 面板接线

test("切之前必须先物化", () => {
  // 不物化就切的表现：终端开起来了,books/ 是空的或指着上一次的 active_job,
  // 没有任何报错。
  const block = CHROME.slice(CHROME.indexOf("const select ="), CHROME.indexOf("if (options.length === 0)"));
  const ensureAt = block.indexOf("ensureCollectionWorkspace");
  const changeAt = block.indexOf('onChange(target, { kind: "collection"');
  assert.ok(ensureAt > 0 && changeAt > ensureAt, "onChange 跑在物化之前了");
  assert.match(block, /if \(reason\) \{[\s\S]{0,60}setFailure\(\{ tabId: target, text: reason \}\);[\s\S]{0,20}return;/,
    "物化失败了还照切");
});

test("没有文件夹的人看到的终端和以前一样", () => {
  // 给一个点了只会说「没有文件夹」的控件,比没有更糟。
  assert.match(CHROME, /if \(options\.length === 0\) return null;/);
});

test("换作用域要换 fx 会话", () => {
  // 两个作用域的对话不该串 —— 单本书那边的上下文里没有 books/。
  // 每条终端各自算自己的会话键 —— 作用域现在是每条标签各自的。
  assert.match(PANEL, /sessionKeyForScope\(tab\.scope\)/);
  // 原来查的是 TerminalInstance 里 useMemo 的依赖数组 `[baseUrl, apiKey, sessionKey]`。
  // session 已经提到面板里按 tab 缓存（为了让「问 AI」能按 activeId 现查现用），
  // 那个 useMemo 没了。守同一个不变式的现在是缓存键的比较。
  const forFn = PANEL.slice(PANEL.indexOf("const sessionFor = useCallback"),
    PANEL.indexOf("const sendToActive"));
  assert.ok(forFn.length > 0, "sessionFor 不见了，这条门禁守错了地方");
  assert.match(forFn, /cached\.key === key/, "作用域变了不换 session，两边对话会串");
  assert.match(forFn, /websocketTerminalSession\(\{ baseUrl, apiKey, session: key \}\)/);
});

test("当前作用域要看得出来", () => {
  // 切错了范围而不自知,得到的结论是错的。
  assert.match(CHROME, /aria-pressed=\{scope\.kind === "job"\}/);
  assert.match(CHROME, /aria-pressed=\{active\}/);
  const css = read("../../src/features/reader/ui/terminal-chrome.css");
  assert.match(css, /\.reader-terminal-scope-option\[aria-pressed="true"\]/);
});
