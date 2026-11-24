import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// 装饰位三处对账：白名单（ornaments.ts）、显示规则（packages/ui/styles/ornaments.css）、
// 组件里的钩子（<span class="theme-ornament" data-ornament="…">），再加注入计划的纯函数输出。

import { ORNAMENTS, ORNAMENT_HOVERS, getOrnament, isOrnamentId } from "../../src/ui/decor/ornaments.js";
import { planOrnaments } from "../../src/ui/decor/ornament-plan.js";
import { validateDecorManifest } from "../../src/ui/decor/contract.js";
import { applyOrnaments, clearOrnaments } from "../../src/ui/decor/ornament-runtime.js";

const WEB = process.cwd();
const FRONTEND = join(WEB, "..");
const CSS = readFileSync(join(FRONTEND, "packages/ui/styles/ornaments.css"), "utf8");

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.tsx$/.test(entry.name)) out.push(path);
  }
  return out;
}

test("白名单：id 唯一、尺寸合理、铺满型不带尺寸", () => {
  const ids = ORNAMENTS.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const o of ORNAMENTS) {
    assert.match(o.id, /^[a-z][a-z0-9-]*$/);
    if (o.size) assert.ok(o.size.width > 0 && o.size.height > 0);
    assert.ok(o.where && o.placement);
  }
  for (const id of [
    "library-title", "dialog-corner", "empty-state", "cover-placeholder",
    "bottom-add", "bottom-tasks", "bottom-guide", "bottom-settings",
    "top-tab-library", "top-tab-collections", "book-cover-tape",
    "reader-bar-left", "reader-bar-right",
  ]) {
    assert.ok(isOrnamentId(id), id);
  }
  assert.equal(getOrnament("nope"), undefined);
});

test("每个装饰位在 ornaments.css 里都有显示规则，建议尺寸和 CSS 默认值一致", () => {
  for (const o of ORNAMENTS) {
    assert.ok(
      CSS.includes(`html[data-ornaments~="${o.id}"] .theme-ornament[data-ornament="${o.id}"]`),
      `${o.id} 缺显示规则`,
    );
    if (o.size) {
      assert.ok(CSS.includes(`--orn-w: var(--ornament-${o.id}-w, ${o.size.width}px)`), `${o.id} 宽度默认值和白名单不一致`);
      assert.ok(CSS.includes(`--orn-h: var(--ornament-${o.id}-h, ${o.size.height}px)`), `${o.id} 高度默认值和白名单不一致`);
    }
    if (o.canHideIcon) {
      assert.ok(CSS.includes(`data-ornaments-hide~="${o.id}"`), `${o.id} 缺 hideIcon 规则`);
    }
    if (o.canHover) {
      assert.ok(CSS.includes(`--ornament-${o.id}-hover`), `${o.id} 缺 hover 变量`);
    }
  }
});

test("没有设图时钩子不显示、不占位；规则里没有字面颜色", () => {
  assert.match(CSS, /^\.theme-ornament\s*\{\s*display:\s*none;\s*\}/m);
  assert.doesNotMatch(CSS.replace(/\/\*[\s\S]*?\*\//g, ""), /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/);
  assert.ok(CSS.split("\n").length <= 400);
});

test("组件里放的钩子名字都在白名单里，白名单里的每个名字都有人放（书架那个除外）", () => {
  const used = new Set();
  const roots = [join(WEB, "src"), join(FRONTEND, "packages/ui/src"), join(FRONTEND, "packages/reader/src")];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/data-ornament=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
        if (m[1]) used.add(m[1]);
        else {
          // 模板字符串：top-tab-${…} 展开成两个页签
          if (m[2].startsWith("top-tab-")) {
            used.add("top-tab-library");
            used.add("top-tab-collections");
          }
        }
      }
    }
  }
  for (const id of used) assert.ok(isOrnamentId(id), `${id} 不在白名单`);
  // book-cover-tape 的元素由书架（BookCard）放，不在这里对账
  for (const o of ORNAMENTS) {
    if (o.id === "book-cover-tape") continue;
    assert.ok(used.has(o.id), `${o.id} 没有组件放钩子`);
  }
});

test("planOrnaments：变量、标记、悬停、偏移", () => {
  const plan = planOrnaments(
    {
      "bottom-add": { src: "gear-btn.webp", hideIcon: true, hover: "rotate" },
      "library-title": { src: "seal.png", width: 30, height: 32, offsetX: -3, offsetY: 4 },
      "bottom-settings": { src: "tools.webp", hover: "lift" },
    },
    { assetBase: "decor/mojia/" },
  );
  // 按白名单顺序输出
  assert.deepEqual(plan.names, ["library-title", "bottom-add", "bottom-settings"]);
  assert.deepEqual(plan.hideNames, ["bottom-add"]);
  assert.equal(plan.vars["--ornament-bottom-add"], 'url("decor/mojia/gear-btn.webp")');
  assert.equal(plan.vars["--ornament-bottom-add-hover"], ORNAMENT_HOVERS.rotate);
  assert.equal(plan.vars["--ornament-bottom-settings-hover"], "translateY(-2px)");
  assert.equal(plan.vars["--ornament-library-title-w"], "30px");
  assert.equal(plan.vars["--ornament-library-title-h"], "32px");
  assert.equal(plan.vars["--ornament-library-title-x"], "-3px");
  assert.equal(plan.vars["--ornament-library-title-y"], "4px");
  // 没写的不出变量（用 CSS 里的建议尺寸）
  assert.equal(plan.vars["--ornament-bottom-add-w"], undefined);
});

test("planOrnaments：没有 ornaments 时什么都不写；白名单外的键被滤掉", () => {
  assert.deepEqual(planOrnaments(undefined, { assetBase: "decor/x" }), { vars: {}, names: [], hideNames: [] });
  const plan = planOrnaments({ "made-up": { src: "a.webp" } }, { assetBase: "decor/x" });
  assert.deepEqual(plan.names, []);
});

test("planOrnaments：给了 baseHref 就写绝对地址", () => {
  const plan = planOrnaments(
    { "dialog-corner": { src: "c.webp" } },
    { assetBase: "decor/zhusha", baseHref: "http://127.0.0.1:8000/app/index.html?x=1" },
  );
  assert.equal(plan.vars["--ornament-dialog-corner"], 'url("http://127.0.0.1:8000/app/decor/zhusha/c.webp")');
});

test("随包发布的装饰包：manifest 通过校验，ornaments 引用的图都在包里", () => {
  for (const pack of readdirSync(join(WEB, "decor"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const manifest = JSON.parse(readFileSync(join(WEB, `decor/${pack}/manifest.json`), "utf8"));
    const result = validateDecorManifest(manifest);
    assert.deepEqual(result.errors, [], `${pack} manifest 不合法`);
    for (const [name, item] of Object.entries(manifest.ornaments || {})) {
      assert.ok(existsSync(join(WEB, `decor/${pack}/${item.src}`)), `${pack}.${name} 的图 ${item.src} 不存在`);
    }
  }
});

test("墨家的贴面已迁成 manifest 声明，样式里不再点名主题 id、不再内联 base64", () => {
  const manifest = JSON.parse(readFileSync(join(WEB, "decor/mojia/manifest.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.ornaments).sort(), ["bottom-add", "bottom-settings", "top-tab-collections", "top-tab-library"]);
  assert.equal(manifest.ornaments["bottom-add"].hover, "rotate");
  assert.equal(manifest.ornaments["bottom-settings"].hover, "lift");
  assert.ok(!existsSync(join(WEB, "src/styles/pages/home/mojia-ornaments.css")));
  assert.doesNotMatch(CSS, /data-theme|data:image/);
});

/** 最小的 <html> 替身：只实现 applyOrnaments 用到的接口 */
function fakeRoot() {
  const props = new Map();
  const attrs = new Map();
  return {
    props,
    attrs,
    style: {
      setProperty: (k, v) => props.set(k, v),
      removeProperty: (k) => props.delete(k),
    },
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k),
  };
}

test("applyOrnaments 写变量和 data-ornaments；换主题（再 apply / clear）时清掉旧的", () => {
  const root = fakeRoot();
  applyOrnaments(
    planOrnaments(
      { "bottom-add": { src: "gear.webp", hideIcon: true, hover: "rotate", width: 40 }, "dialog-corner": { src: "c.webp" } },
      { assetBase: "decor/mojia" },
    ),
    root,
  );
  assert.equal(root.attrs.get("data-ornaments"), "dialog-corner bottom-add");
  assert.equal(root.attrs.get("data-ornaments-hide"), "bottom-add");
  assert.equal(root.props.get("--ornament-bottom-add-w"), "40px");

  // 换成只有一个装饰位、没有 hideIcon 的包：旧的变量和标记一个不留
  applyOrnaments(planOrnaments({ "library-title": { src: "s.png" } }, { assetBase: "decor/zhusha" }), root);
  assert.equal(root.attrs.get("data-ornaments"), "library-title");
  assert.equal(root.attrs.has("data-ornaments-hide"), false);
  assert.deepEqual([...root.props.keys()], ["--ornament-library-title"]);

  clearOrnaments(root);
  assert.equal(root.props.size, 0);
  assert.equal(root.attrs.size, 0);
});
