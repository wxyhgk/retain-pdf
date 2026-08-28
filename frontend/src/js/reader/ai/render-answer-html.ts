// Final AI answer rendering: protect [n] citations -> Markdown + math -> restore [n].
// Streaming uses a lightweight preview to avoid repeated MathJax/full innerHTML work.
//
// Security model (audit P0-1 fix, aligned with legacy markdown-render.ts two-layer defense):
// 1. Parse phase: a standalone Marked instance escapes all model-emitted raw HTML
//    through renderer.html, turning iframe srcdoc/object/embed vectors into literals.
// 2. DOM phase: after template parsing, remove script-like nodes, on* attributes,
//    and javascript: links as defense in depth for marked behavior changes and
//    anything outside MathJax.
// The answer body is ultimately injected through ReaderAssistantThread root.innerHTML.
// This file is the only sanitization gate, so changes must pass tests/render-answer-html.test.mjs vector locks.

import { Marked } from "marked";
import { parseMarkdownWithMath } from "../markdown-math.js";

const CITE_PREFIX = "\uE010CITE_";
const CITE_SUFFIX = "\uE011";

function escapeHtml(value: string): string {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Extract [1] [2]... so marked does not treat them as reference links. */
export function protectNumericCitations(source: string): {
  text: string;
  refs: string[];
} {
  const refs: string[] = [];
  const text = `${source ?? ""}`.replace(/\[(\d+)\]/g, (_m, n: string) => {
    const token = `${CITE_PREFIX}${refs.length}${CITE_SUFFIX}`;
    refs.push(n);
    return token;
  });
  return { text, refs };
}

export function restoreNumericCitations(html: string, refs: string[]): string {
  if (!refs.length) return html;
  return `${html ?? ""}`.replace(
    new RegExp(`${CITE_PREFIX}(\\d+)${CITE_SUFFIX}`, "g"),
    (_m, idx: string) => {
      const n = refs[Number(idx)];
      return n != null ? `[${n}]` : "";
    },
  );
}

/** Streaming preview: lightweight escaping plus line breaks, preserving literal [n]. */
export function renderStreamingPreviewHtml(text: string): string {
  const escaped = escapeHtml(text || "");
  return escaped
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

/** marked v18 renderer.html input compatibility, token object or string. */
function rawHtmlText(input: unknown): string {
  if (typeof input === "string") return input;
  const token = input as { raw?: string; text?: string } | null;
  return `${token?.raw ?? token?.text ?? ""}`;
}

// Standalone instance: renderer.html escapes everything as the first defense layer without mutating global marked config.
const answerMarked = new Marked();
answerMarked.setOptions({ gfm: true, breaks: true });
answerMarked.use({
  renderer: {
    html: (input: unknown) => escapeHtml(rawHtmlText(input)),
  },
});

const DANGEROUS_URL_RE = /^\s*(?:javascript|vbscript|data:text\/html)/i;

function sanitizeHtml(html: string): string {
  const doc = globalThis.document;
  if (!doc) {
    // No DOM environment, theoretically impossible because this function is only used in browser rendering.
    // Prefer fully escaped source display over passing raw HTML through.
    return escapeHtml(html);
  }
  const template = doc.createElement("template");
  template.innerHTML = html;
  const content = template.content;
  // Second defense layer: remove script-like nodes even if renderer.html misses something.
  content
    .querySelectorAll("script, iframe, object, embed, base, link, meta, form")
    .forEach((node) => node.remove());
  content.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") {
        node.removeAttribute(attribute.name);
        continue;
      }
      if (
        (name === "href" || name === "src" || name === "xlink:href")
        && DANGEROUS_URL_RE.test(attribute.value)
      ) {
        node.removeAttribute(attribute.name);
        continue;
      }
      // Remove target=_blank because desktop Electron treats it as window.open -> openExternal.
      if (name === "target") {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return template.innerHTML;
}

/** Branch/session switches change message ids but keep the same body; cache avoids a pending-to-final flash on remount. */
const FINAL_HTML_CACHE = new Map<string, string>();
const FINAL_HTML_CACHE_MAX = 48;

export function peekFinalAnswerHtmlCache(text: string): string | null {
  const key = `${text || ""}`.trim();
  if (!key) return null;
  return FINAL_HTML_CACHE.get(key) ?? null;
}

function putFinalAnswerHtmlCache(text: string, html: string): void {
  const key = `${text || ""}`.trim();
  if (!key) return;
  if (FINAL_HTML_CACHE.has(key)) FINAL_HTML_CACHE.delete(key);
  FINAL_HTML_CACHE.set(key, html);
  while (FINAL_HTML_CACHE.size > FINAL_HTML_CACHE_MAX) {
    const oldest = FINAL_HTML_CACHE.keys().next().value;
    if (oldest == null) break;
    FINAL_HTML_CACHE.delete(oldest);
  }
}

/**
 * Final answer HTML: protect citations -> protect math -> marked -> MathJax -> restore citations.
 */
export async function renderFinalAnswerHtml(text: string): Promise<string> {
  const src = `${text || ""}`;
  if (!src.trim()) return "";

  const cached = FINAL_HTML_CACHE.get(src);
  if (cached != null) return cached;

  const { text: withoutCites, refs } = protectNumericCitations(src);

  const html = await parseMarkdownWithMath(withoutCites, (markdown) => {
    const raw = String(answerMarked.parse(markdown, { async: false } as { async: boolean }));
    return sanitizeHtml(raw);
  });

  const out = restoreNumericCitations(html, refs);
  putFinalAnswerHtmlCache(src, out);
  return out;
}
