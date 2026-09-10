// 给三页 HTML 里引用的 CSS / *.bundle.js 打上内容哈希的 ?v= 缓存串。
//
// CSS 已按页拆分：
//   index  → dist/css/home.css
//   detail → dist/css/detail.css
//   reader → dist/css/reader.css
// （styles.css 仅为 home 兼容副本，一般不再被 HTML 引用。）
//
// 正解:构建产物后,按每个资源的内容哈希写 ?v=<hash>——内容不变 → URL 不变
// (正常命中缓存),内容一变 → URL 变(强制回源)。

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// 每页 HTML 引用的资源(相对 frontend 根),stamp 会把这些 href/src 上的 ?v=
// 改写成对应文件的内容哈希。
const PAGES = [
  { html: "index.html", assets: ["dist/css/home.css", "dist/app.bundle.js"] },
  { html: "detail.html", assets: ["dist/css/detail.css", "dist/detail.bundle.js"] },
  { html: "reader.html", assets: ["dist/css/reader.css", "dist/reader.bundle.js"] },
];

function contentHash(absPath) {
  const buf = readFileSync(absPath);
  return createHash("sha256").update(buf).digest("hex").slice(0, 10);
}

// 把 html 里对某个 asset 的引用(href/src="./asset" 或 "./asset?v=旧值")统一
// 改写成 "./asset?v=<hash>"。asset 里的 . 和 / 需要转义进正则。
function stampAssetRef(htmlText, asset, hash) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(["']\\.\\/${escaped})(\\?v=[^"']*)?(["'])`, "g");
  return htmlText.replace(pattern, `$1?v=${hash}$3`);
}

let changed = 0;
for (const page of PAGES) {
  const htmlPath = join(FRONTEND_ROOT, page.html);
  if (!existsSync(htmlPath)) {
    continue;
  }
  let htmlText = readFileSync(htmlPath, "utf8");
  const before = htmlText;
  for (const asset of page.assets) {
    const assetPath = join(FRONTEND_ROOT, asset);
    if (!existsSync(assetPath)) {
      continue;
    }
    htmlText = stampAssetRef(htmlText, asset, contentHash(assetPath));
  }
  if (htmlText !== before) {
    writeFileSync(htmlPath, htmlText);
    changed += 1;
  }
}

console.log(`[stamp-cache-version] 已更新 ${changed} 个 HTML 的资源缓存串`);
