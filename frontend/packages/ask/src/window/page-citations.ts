// 回答里的页码变成能点的：「（第 12 页）」「第 56、58 页」「p. 12」「pp. 12–14」里的数字点了跳到那一页。
// 自带 agent 的系统提示词要求引用写成「（第 12 页）」（backend/ask-agent/…/prompts/ask_system.txt）；别的 agent 常写 p. 12，一起认。
// 只认页码，不认块：块级定位要 agent 输出块编号，以后再说。

/** Markdown 里页码链接的地址前缀（remark 插件生成，markdown-text 的 a 组件认出来画成页码标签）。 */
export const PAGE_HREF_PREFIX = "#retainpdf-page=";

export type PageSegment = { type: "text"; value: string } | { type: "page"; page: number; value: string };

const JOIN = String.raw`\s*(?:[、,，/]|和|与|及|至|到|[-–—~]|and|to)\s*`;
const CHINESE = String.raw`第\s*\d{1,4}(?:${JOIN}\d{1,4})*\s*页`;
const ENGLISH = String.raw`\b(?:pp?\.|pages?)\s*\d{1,4}(?:${JOIN}\d{1,4})*`;
const PAGE_PHRASE = new RegExp(`${CHINESE}|${ENGLISH}`, "gi");

/** 一段字切成「字」和「页码」。pageCount 给了就只认 1…pageCount（超出的是正文里的别的数）。 */
export function splitPageRefs(text: string, pageCount = 0): PageSegment[] {
  const out: PageSegment[] = [];
  let last = 0;
  const push = (value: string) => {
    if (!value) return;
    const previous = out[out.length - 1];
    if (previous?.type === "text") previous.value += value;
    else out.push({ type: "text", value });
  };
  for (const match of text.matchAll(PAGE_PHRASE)) {
    const start = match.index ?? 0;
    push(text.slice(last, start));
    const phrase = match[0];
    let cursor = 0;
    for (const number of phrase.matchAll(/\d{1,4}/g)) {
      const at = number.index ?? 0;
      const page = Number(number[0]);
      push(phrase.slice(cursor, at));
      if (page >= 1 && (!pageCount || page <= pageCount)) out.push({ type: "page", page, value: number[0] });
      else push(number[0]);
      cursor = at + number[0].length;
    }
    push(phrase.slice(cursor));
    last = start + phrase.length;
  }
  push(text.slice(last));
  return out;
}

export function pageFromHref(href: string | undefined): number | null {
  if (!href?.startsWith(PAGE_HREF_PREFIX)) return null;
  const page = Number(href.slice(PAGE_HREF_PREFIX.length));
  return Number.isInteger(page) && page >= 1 ? page : null;
}

type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] };

// 这些节点里的字不动：链接、代码、公式、HTML。
const SKIP = new Set(["link", "linkReference", "definition", "inlineCode", "code", "inlineMath", "math", "html"]);

function linkify(node: MdNode): void {
  if (!node.children) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && child.value) {
      for (const segment of splitPageRefs(child.value)) {
        next.push(segment.type === "page"
          ? { type: "link", url: `${PAGE_HREF_PREFIX}${segment.page}`, children: [{ type: "text", value: segment.value }] }
          : { type: "text", value: segment.value });
      }
      continue;
    }
    if (!SKIP.has(child.type)) linkify(child);
    next.push(child);
  }
  node.children = next;
}

/** remark 插件：正文里的页码换成页码链接（不知道书有几页，越界的由页码标签自己当普通字显示）。 */
export function remarkPageCitations() {
  return (tree: MdNode) => linkify(tree);
}
