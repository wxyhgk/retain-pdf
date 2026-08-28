// Entry React của trang reader. Engine mặc định là react-pdf (ReaderAppReactPdf);
// ?engine=legacy fallback sang mount js/reader imperative (use-reader-boot).
// Bundle đầu ra dist/reader.bundle.js (scripts/build-js-bundle.mjs).

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import {
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
} from "./external.js";
import { ReaderApp } from "./ReaderApp.jsx";

bootTheme();
// Chỉ chặn nhầm chạm trong giai đoạn khóa đổi hội thoại AI; đồng thời dọn overlay pointer toàn màn có thể còn sót.
clearReaderAiNavigationLock();
installReaderWindowOpenGuard();

// Đồng bộ body class trước khi render: các rule CSS dựa trên :has()/body-class (reader-page.css) phụ thuộc vào chúng.
// Trang chủ đã chuyển sang điều hướng tới reader.html độc lập, không còn nhúng iframe.
// Nếu bookmark/test cũ vẫn mở bằng iframe, giữ class embedded để tương thích.
function syncReaderBodyClasses(body = document.body) {
  body.classList.add("reader-body", "reader-mode-compare");
  if (globalThis.window && window.self !== window.top) {
    body.classList.add("reader-embedded");
  }
}

// Fallback giai đoạn chuyển tiếp: khi probe verify, reader.html chỉ thay entry <script>, skeleton tĩnh cũ vẫn trong body.
// Dọn trước rồi mới mount cây React để tránh hai bộ DOM (id trùng/layer fixed) chồng lên nhau.
// Sau cutover (2b), body chỉ còn script và #reader-root nên bước này trở thành no-op.
function purgeLegacyMarkup(body = document.body) {
  Array.from(body.children).forEach((element) => {
    if (element.tagName !== "SCRIPT" && element.id !== "reader-root") {
      element.remove();
    }
  });
}

function resolveReaderRoot(body = document.body) {
  let host = document.getElementById("reader-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "reader-root";
    body.appendChild(host);
  }
  return host;
}

function resolveReaderEngine(search = globalThis.location?.search || "") {
  const engine = new URLSearchParams(search).get("engine")?.trim().toLowerCase() || "";
  if (engine === "legacy" || engine === "classic") {
    return "legacy";
  }
  return "react-pdf";
}

/**
 * Style legacy cho drawer/selection/AI đã tách sang dist/css/reader-legacy.css.
 * react-pdf mặc định không tải file này; chỉ inject khi ?engine=legacy.
 * Relative path khớp với link reader.css đã có trong reader.html (giữ cùng thư mục).
 */
function ensureLegacyReaderCss() {
  if (typeof document === "undefined") {
    return;
  }
  if (document.querySelector('link[data-reader-legacy-css]')) {
    return;
  }
  const main = document.querySelector(
    'link[rel="stylesheet"][href*="reader.css"]',
  ) as HTMLLinkElement | null;
  let href = "./dist/css/reader-legacy.css";
  if (main?.getAttribute("href")) {
    // ./dist/css/reader.css?v=abc -> ./dist/css/reader-legacy.css (bỏ hash bundle chính để tránh bind nhầm).
    href = main
      .getAttribute("href")!
      .replace(/reader\.css(\?v=[^"']*)?$/i, "reader-legacy.css");
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.readerLegacyCss = "1";
  document.head.appendChild(link);
}

syncReaderBodyClasses();
purgeLegacyMarkup();
if (resolveReaderEngine() === "legacy") {
  ensureLegacyReaderCss();
}
createRoot(resolveReaderRoot()).render(<ReaderApp />);
