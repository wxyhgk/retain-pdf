import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 壳 A10 冒烟:三页 HTML 挂载顺序 + 三 entry createRoot/无 StrictMode + 静态 200。
// 只读源码文本与 HTTP 状态,不改业务代码、不改构建、不依赖后端(后端可达才加断 API)。

const PROJECT_ROOT = process.cwd();
const FRONT_URL = "http://127.0.0.1:40001";
const BACKEND_URLS = ["http://127.0.0.1:41000/health", "http://127.0.0.1:41000/ready"];

// 三页壳:HTML 文件 ↔ bundle 产物 ↔ React 挂载入口。
// home/detail 经共享壳 src/app/shell-boot.ts 建根挂载；reader 经包内 boot 链。
const PAGES = [
  { html: "index.html", bundle: "dist/app.bundle.js", entry: "src/app/home/entry.tsx" },
  { html: "detail.html", bundle: "dist/detail.bundle.js", entry: "src/app/detail/entry.tsx" },
  {
    html: "reader.html",
    bundle: "dist/reader.bundle.js",
    entry: "src/app/reader/entry.tsx",
    bootChain: ["frontend/packages/reader/src/boot.tsx"],
  },
];
const SHARED_SHELL_BOOT = "src/app/shell-boot.ts";

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

async function probe(url, timeoutMs = 2000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    await res.arrayBuffer().catch(() => undefined);
    return { reachable: true, status: res.status };
  } catch {
    return { reachable: false, status: 0 };
  }
}

test("三HTML都挂对bundle且runtime-config在前", () => {
  for (const page of PAGES) {
    const html = readFileSync(join(PROJECT_ROOT, page.html), "utf8");
    // 只认 <script> 标签(注释里的 bundle 名不算),按文档顺序取 src。
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => ({
      tag: m[0],
      src: m[1],
    }));
    const at = (name) => tags.findIndex((t) => t.src.includes(name));
    const iBase = at("runtime-config.js");
    const iLocal = at("runtime-config.local.js");
    const iBundle = at(page.bundle);
    assert.ok(iBase !== -1, `${page.html} 缺 runtime-config.js`);
    assert.ok(iLocal !== -1, `${page.html} 缺 runtime-config.local.js`);
    assert.ok(iBundle !== -1, `${page.html} 缺 ${page.bundle}`);
    assert.ok(iBase < iLocal && iLocal < iBundle, `${page.html} 顺序错:runtime-config应在bundle前`);
    assert.ok(tags[iBundle].tag.includes('type="module"'), `${page.html} bundle应为type=module`);
  }
});

test("三entry都有createRoot且不开StrictMode", () => {
  const shellBoot = readFileSync(join(PROJECT_ROOT, SHARED_SHELL_BOOT), "utf8");
  for (const page of PAGES) {
    const entry = readFileSync(join(PROJECT_ROOT, page.entry), "utf8");
    const chain = [entry, shellBoot];
    for (const extra of page.bootChain ?? []) {
      chain.push(readFileSync(join(PROJECT_ROOT, "..", "..", extra), "utf8"));
    }
    const code = stripComments(chain.join("\n"));
    assert.ok(code.includes("createRoot"), `${page.entry} 链无createRoot`);
    assert.ok(!code.includes("StrictMode"), `${page.entry} 链开了StrictMode(约定不开)`);
  }
});

test("40001/index.html可200(41000可达才断言API)", async (t) => {
  let server = null;
  t.after(() => server?.kill());
  let res = await probe(`${FRONT_URL}/index.html`);
  if (!res.reachable || res.status !== 200) {
    server = spawn("python3", ["scripts/serve_static.py", "--host", "127.0.0.1", "--port", "40001", "--root", "."], {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
    });
    const deadline = Date.now() + 10000;
    do {
      await new Promise((r) => setTimeout(r, 300));
      res = await probe(`${FRONT_URL}/index.html`);
    } while (res.status !== 200 && Date.now() < deadline);
  }
  assert.equal(res.status, 200, "40001/index.html非200");

  for (const url of BACKEND_URLS) {
    const back = await probe(url);
    if (back.reachable && back.status >= 200 && back.status < 300) {
      assert.ok(true, `后端可达:${url}`);
      return;
    }
  }
  t.skip("后端41000不可达,仅断言静态");
});
