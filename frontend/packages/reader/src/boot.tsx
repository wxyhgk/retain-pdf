// @retainpdf/reader/boot — explicit MPA startup API (react-pdf only).
import { createRoot, type Root } from "react-dom/client";
import { ReaderApp } from "./ReaderApp.js";
import {
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
} from "./external.js";
import { bootTheme } from "./shared/theme/theme.js";

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
  clearReaderAiNavigationLock();
  installReaderWindowOpenGuard();
  syncReaderBodyClasses(body);
  if (options.purgeLegacyMarkup !== false) {
    purgeLegacyMarkup(body, host);
  }

  const root = createRoot(host);
  root.render(<ReaderApp />);
  return root;
}
