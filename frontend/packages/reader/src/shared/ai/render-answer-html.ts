// 共享真值（原 frontend/web/src/js/reader/ai/render-answer-html.ts），已抽离为 standalone
// 已改为依赖 frontend/packages/reader 内共享的 markdown-math，不再直连 frontend/web/js/reader/markdown-math

import { Marked } from "marked";
import { parseMarkdownWithMath } from "../content/markdown-math.js";

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

/** 抽出 [1] [2]…，避免 marked 当成 reference link。 */
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

/** 流式预览：轻量转义 + 换行，保留 [n] 字面量。 */
export function renderStreamingPreviewHtml(text: string): string {
  const escaped = escapeHtml(text || "");
  return escaped
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

/** marked v18 renderer.html 的入参兼容（token 对象或字符串） */
function rawHtmlText(input: unknown): string {
  if (typeof input === "string") return input;
  const token = input as { raw?: string; text?: string } | null;
  return `${(token as any)?.raw ?? (token as any)?.text ?? ""}`;
}

// 独立实例：renderer.html 全转义 = 第一层防御；不污染全局 marked 配置
const answerMarked = new Marked();
answerMarked.setOptions({ gfm: true, breaks: true });
answerMarked.use({
  renderer: {
    html: (input: unknown) => escapeHtml(rawHtmlText(input)),
  },
});

const DANGEROUS_URL_RE = /^\s*(?:javascript|vbscript|data:text\/html)/i;

function sanitizeHtml(html: string): string {
  const doc = (globalThis as any).document;
  if (!doc) {
    // 无 DOM 环境（理论上不发生：本函数只在浏览器渲染路径调用）——
    // 宁可全转义显示源码，不可原样放行
    return escapeHtml(html);
  }
  const template = doc.createElement("template");
  template.innerHTML = html;
  const content = template.content;
  // 第二层防御：即便 renderer.html 漏网也移除脚本类节点
  content
    .querySelectorAll("script, iframe, object, embed, base, link, meta, form")
    .forEach((node: Element) => node.remove());
  content.querySelectorAll("*").forEach((node: Element) => {
    for (const attribute of [...(node as Element).attributes]) {
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
      // 去掉 target=_blank：桌面 Electron 会把它当成 window.open → openExternal
      if (name === "target") {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return template.innerHTML;
}

/** 分支换会话会换 message id 但正文相同；缓存避免 remount 时闪「pending→最终」。 */
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
 * 最终答案 HTML：保护引用 → 保护公式 → marked → MathJax → 还原引用。
 */
export async function renderFinalAnswerHtml(text: string): Promise<string> {
  const src = `${text || ""}`;
  if (!src.trim()) return "";

  const cached = FINAL_HTML_CACHE.get(src);
  if (cached != null) return cached;

  const { text: withoutCites, refs } = protectNumericCitations(src);

  const html = await parseMarkdownWithMath(withoutCites, (markdown) => {
    const raw = String((answerMarked as any).parse(markdown, { async: false } as { async: boolean }));
    return sanitizeHtml(raw);
  });

  const out = restoreNumericCitations(html, refs);
  putFinalAnswerHtmlCache(src, out);
  return out;
}
