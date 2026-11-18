// 功能之间谁能引用谁（功能登记表第三步，docs/ops/planning/frontend-migration/20261112-功能登记表.md）。
//
// layer-boundaries 管「跨功能只经出口」，不管「该不该引用」。功能一多，互相引用会越织越密：书籍详情现在就直接
// 依赖 6 个功能，书库和合集互相引用，拿掉哪个都牵一片。这条门禁把现状登记成名单，只许减不许增：
//   - 新功能默认不依赖任何别的功能（只用 ui、platform）。要依赖，在 ALLOWED 里加一条并写理由。
//   - 名单里登记了、代码里已经没有的依赖，必须删掉（拧紧）。
//   - 不许出现新的互相引用（环）。现有的环登记在 KNOWN_CYCLES，只许消掉。
// 扫的是 src/features/<功能>/ 下 .ts/.tsx 里的 `@/features/<别的功能>`（静态 import、re-export、动态 import()）。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "./helpers/source-scan.mjs";

const FEATURES_ROOT = join(PROJECT_ROOT, "src/features");

/** 现状（2026-11-12）。值是允许引用的功能；新增一条要在旁边写为什么。 */
const ALLOWED = {
  admin: ["auth"], // 改密码、页数账本、邀请链接的校验和展示（auth 的出口）
  "book-detail": ["collections", "editorial-room", "jobs", "library", "reader", "usage"], // 详情页直接拼各功能的展示（状态卡、用量、编辑部、合集），待拆
  collections: ["library"], // 合集里画书卡、取书单（BookCard、fetchAllDocuments 等）
  credentials: ["settings"], // 转出设置弹窗的 DOM id 契约（credentials-dom-ids.ts）
  ingest: ["library"], // 提交后打开书籍详情（useLibraryServices().actions.openBookDetail）
  "job-detail": ["artifacts"], // 下载按钮的忙碌状态（useArtifactDownloadBusy）
  jobs: ["artifacts", "ingest"], // 下载按钮的忙碌状态；工作流弹窗的状态区端口
  reader: ["jobs"], // 阅读页宿主读当前任务和产物清单
};

/** 现有的互相引用，只许消掉。书架 ↔ 合集的环 2026-11-18 拆掉：书架批量「加入合集」按形状接合集控制器
 *  （CollectionTargetsPort），合集的记录类型直接从 @retainpdf/contracts 取。 */
const KNOWN_CYCLES = [];

/** 「书 + 它的任务」的数据类型在 platform/contracts/library-payloads.ts，别的功能直接从那里取，
 *  不经书架转手（经书架取会让书详情、合集为了类型都依赖书架）。书架自己的 re-export 留着给书架内部用。 */
const DOCUMENT_TYPES = ["LibraryCardItem", "DocumentJobSummary", "JobSubmissionView", "TranslateDocumentPayload", "OcrDocumentPayload"];

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

function currentGraph() {
  const graph = {};
  for (const feature of readdirSync(FEATURES_ROOT)) {
    const dir = join(FEATURES_ROOT, feature);
    if (!statSync(dir).isDirectory()) continue;
    const deps = new Set();
    for (const file of sourceFiles(dir)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/(?:from\s+|import\(\s*)["']@\/features\/([a-z-]+)/g)) {
        if (m[1] !== feature) deps.add(m[1]);
      }
    }
    graph[feature] = [...deps].sort();
  }
  return graph;
}

/** 有向图里的环（强连通分量里多于一个点的），每个按名字排序。 */
function cycles(graph) {
  let index = 0;
  const stack = [];
  const on = new Set();
  const idx = new Map();
  const low = new Map();
  const result = [];
  const visit = (v) => {
    idx.set(v, index); low.set(v, index); index += 1;
    stack.push(v); on.add(v);
    for (const w of graph[v] || []) {
      if (!idx.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const component = [];
      let w;
      do { w = stack.pop(); on.delete(w); component.push(w); } while (w !== v);
      if (component.length > 1) result.push(component.sort());
    }
  };
  for (const v of Object.keys(graph)) if (!idx.has(v)) visit(v);
  return result.map((c) => c.join(" ↔ ")).sort();
}

test("扫得到功能目录（门禁没在空转）", () => {
  const graph = currentGraph();
  assert.ok(Object.keys(graph).length >= 15, `只扫到 ${Object.keys(graph).length} 个功能，扫描路径不对`);
  assert.ok(graph["book-detail"].includes("library"), "已知的依赖 book-detail → library 没扫到，扫描规则失效");
});

test("功能之间的依赖不超出登记的名单（新依赖要登记理由）", () => {
  const graph = currentGraph();
  const extra = [];
  for (const [feature, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (!(ALLOWED[feature] || []).includes(dep)) extra.push(`${feature} → ${dep}`);
    }
  }
  assert.deepEqual(extra, [], `新出现的跨功能依赖（能不能改成经 ui / platform、或由装配层接？非要不可就在 ALLOWED 里登记理由）：\n${extra.join("\n")}`);
});

test("名单里登记了、代码里已经没有的依赖要删掉（只减不增）", () => {
  const graph = currentGraph();
  const stale = [];
  for (const [feature, deps] of Object.entries(ALLOWED)) {
    for (const dep of deps) {
      if (!(graph[feature] || []).includes(dep)) stale.push(`${feature} → ${dep}`);
    }
  }
  assert.deepEqual(stale, [], `这些依赖已经没了，从 ALLOWED 里删掉：\n${stale.join("\n")}`);
});

test("不许出现新的互相引用", () => {
  const found = cycles(currentGraph());
  const known = KNOWN_CYCLES.map((c) => [...c].sort().join(" ↔ ")).sort();
  assert.deepEqual(found, known, `功能之间的环和登记的不一致（新环要拆开；消掉的环从 KNOWN_CYCLES 删掉）：${found.join("; ")}`);
});

test("书和任务的数据类型不经书架转手", () => {
  const offenders = [];
  for (const feature of readdirSync(FEATURES_ROOT)) {
    const dir = join(FEATURES_ROOT, feature);
    if (feature === "library" || !statSync(dir).isDirectory()) continue;
    for (const file of sourceFiles(dir)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@\/features\/library\/[^"']+["']/g)) {
        const names = m[1].split(",").map((name) => name.replace(/^\s*type\s+/, "").split(/\s+as\s+/)[0].trim()).filter(Boolean);
        for (const name of names) {
          if (DOCUMENT_TYPES.includes(name)) offenders.push(`${file.slice(FEATURES_ROOT.length + 1)}: ${name}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `改成从 @/platform/contracts/library-payloads.js 取：\n${offenders.join("\n")}`);
});
