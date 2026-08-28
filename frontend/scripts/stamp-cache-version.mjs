// Đưa ra ba trang HTML được tham chiếu trong CSS / *.bundle.js đạt được hàm băm nội dung ?v= Chuỗi bộ nhớ cache。
//
// CSS Tách theo trang：
//   index  → dist/css/home.css
//   detail → dist/css/detail.css
//   reader → dist/css/reader.css
// （styles.css Chỉ dành cho home Bản sao tương thích，Nói chung không còn tồn tại HTML trích dẫn。）
//
// chính giải:Sau khi xây dựng sản phẩm,Viết theo hàm băm nội dung của từng tài nguyên ?v=<hash>——Nội dung không thay đổi → URL Không thay đổi
// (Bộ nhớ cache Lượt truy cập Bình thường),Nội dung đã thay đổi → URL biến(Buộc phải quay lại nguồn)。

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Mỗi trang HTML Tài liệu tham khảo(tương đối frontend Cột),stamp sẽ lấy những thứ này href/src vào ?v=
// Viết lại hàm băm nội dung của tệp tương ứng。
const PAGES = [
  { html: "index.html", assets: ["dist/css/home.css", "dist/app.bundle.js"] },
  { html: "detail.html", assets: ["dist/css/detail.css", "dist/detail.bundle.js"] },
  { html: "reader.html", assets: ["dist/css/reader.css", "dist/reader.bundle.js"] },
];

function contentHash(absPath) {
  const buf = readFileSync(absPath);
  return createHash("sha256").update(buf).digest("hex").slice(0, 10);
}

// cầm html Li so với ai đó asset tài liệu tham khảo(href/src="./asset" Hoặc "./asset?v=Giá trị cũ")thống nhất
// Viết lại cho "./asset?v=<hash>"。asset trong . Và / Cần phải thoát ra một cách đều đặn。
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
