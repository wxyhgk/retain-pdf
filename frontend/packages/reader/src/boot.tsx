// @retainpdf/reader/boot — explicit MPA startup API (react-pdf only).
import { createRoot, type Root } from "react-dom/client";
import { ErrorBoundary } from "@retainpdf/ui";
import { ReaderApp } from "./ReaderApp.js";
import { bootTheme } from "@retainpdf/ui/theme";

export type ReaderBootOptions = {
  body?: HTMLElement;
  root?: HTMLElement;
  purgeLegacyMarkup?: boolean;
};

export function syncReaderBodyClasses(body: HTMLElement = document.body): void {
  body.classList.add("reader-body", "reader-mode-compare");
  if (globalThis.window && window.self !== window.top) {
    body.classList.add("reader-embedded");
  }
}

/**
 * Removes any sibling markup that predates the Reader mount. Retained
 * intentionally as a defensive cleanup: a stale cached MPA shell (old HTML)
 * can still contain legacy markup, and this is the only guarantee that the
 * React root owns <body>. `bootReader` calls it unless the host explicitly
 * opts out via `purgeLegacyMarkup: false`.
 */
export function purgeLegacyMarkup(
  body: HTMLElement = document.body,
  preservedRoot?: HTMLElement,
): void {
  Array.from(body.children).forEach((element) => {
    if (
      element.tagName !== "SCRIPT"
      && element.id !== "reader-root"
      && element !== preservedRoot
    ) {
      element.remove();
    }
  });
}

export function resolveReaderRoot(body: HTMLElement = document.body): HTMLElement {
  let host = document.getElementById("reader-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "reader-root";
    body.appendChild(host);
  }
  return host;
}

export function bootReader(options: ReaderBootOptions = {}): Root {
  const body = options.body ?? document.body;
  const host = options.root ?? resolveReaderRoot(body);

  bootTheme();
  syncReaderBodyClasses(body);
  if (options.purgeLegacyMarkup !== false) {
    purgeLegacyMarkup(body, host);
  }

  const root = createRoot(host);
  // 整页出错兜底：阅读器组件渲染出错时不再白屏（见 @retainpdf/ui 的 ErrorBoundary）。
  root.render(<ErrorBoundary scope="page" label="阅读页"><ReaderApp /></ErrorBoundary>);
  return root;
}
