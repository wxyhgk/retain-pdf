// 书页区左缘的目录（ReaderTocMinimap，2026-11-28 照原型 reader-prototype.html）用的数据：章 + 节两级。
// 来源两样：PDF 自带的书签（有就用它），没有就用 OCR 认出的标题（readerOutline）。这里都是纯函数，测试直接调。
import type { ReaderOutlineEntry } from "./reader-find.js";

/** PDF 书签的样子（和 pdf/pdf-outline.ts 的 PdfOutlineNode 一样；shared 不往上引 pdf/，这里只写用到的几项）。 */
export type ReaderTocSourceNode = {
  id: string;
  title: string;
  page: number | null;
  level: number;
  children: readonly ReaderTocSourceNode[];
};

function flatten(nodes: readonly ReaderTocSourceNode[], out: ReaderTocSourceNode[] = []): ReaderTocSourceNode[] {
  for (const node of nodes) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

export type ReaderTocNode = {
  id: string;
  title: string;
  /** 跳到第几页；书签的去处解析不出来时为 null（照样列出，点了不跳）。 */
  page: number | null;
  /** 按标题来的目录：跳到这一块（比只跳页准）。 */
  itemId?: string;
  /** 章是 1，节是 2；PDF 书签更深的层级摊进所在的章，深度照旧（卡片里多缩进一点）。 */
  depth: number;
};

export type ReaderTocChapter = ReaderTocNode & { children: ReaderTocNode[] };

/** 超过这么多条（章 + 节）时短横线只画「全部章 + 当前章的节」。 */
export const TOC_COMPACT_BARS = 24;
/** 短横线最多画这么多根（章本身就很多时隔几章画一根，当前章一定画）。 */
export const TOC_MAX_BARS = 28;
/** 超过这么多条时目录卡顶上出过滤框。 */
export const TOC_FILTER_MIN = 15;

export function tocSize(chapters: readonly ReaderTocChapter[]): number {
  return chapters.reduce((sum, chapter) => sum + 1 + chapter.children.length, 0);
}

/** 有 PDF 书签用书签，没有用认出的标题。书签只有一个根（整本书的书名）时拆开它，用它下面那一层当章。 */
export function readerToc(bookmarks: readonly ReaderTocSourceNode[], outline: readonly ReaderOutlineEntry[]): ReaderTocChapter[] {
  if (bookmarks.length) {
    const roots = bookmarks.length === 1 && bookmarks[0]!.children.length ? bookmarks[0]!.children : bookmarks;
    return roots.map((root) => ({
      id: root.id,
      title: root.title,
      page: root.page,
      depth: 1,
      children: flatten(root.children).map((node) => ({ id: node.id, title: node.title, page: node.page, depth: node.level - root.level + 1 })),
    }));
  }
  const chapters: ReaderTocChapter[] = [];
  for (const entry of outline) {
    const node = { id: entry.itemId, title: entry.text, page: entry.page, itemId: entry.itemId };
    const last = chapters[chapters.length - 1];
    if (entry.level > 1 && last) last.children.push({ ...node, depth: 2 });
    else chapters.push({ ...node, depth: 1, children: [] });
  }
  return chapters;
}

/**
 * 眼下这一页在哪一章、哪一节：页码不超过当前页、页码最大的那一条。同一页有好几条取第一条，
 * 只有章和它的节同页时标那一节（和 pdf-outline 的 currentBookmark 一个规矩：一串书签都指向目录页时不标最后那条）。
 */
export function tocCurrent(chapters: readonly ReaderTocChapter[], page: number): { chapterId: string | null; nodeId: string | null } {
  let chapterId: string | null = null;
  let found: ReaderTocNode | null = null;
  let foundIsChapter = false;
  for (const chapter of chapters) {
    const consider = (node: ReaderTocNode, isChapter: boolean) => {
      if (node.page === null || node.page > page) return;
      const sameChapterChild = !isChapter && foundIsChapter && found?.id === chapter.id;
      if (!found || node.page > (found.page ?? 0) || (node.page === found.page && sameChapterChild)) {
        found = node;
        foundIsChapter = isChapter;
        chapterId = chapter.id;
      }
    };
    consider(chapter, true);
    for (const child of chapter.children) consider(child, false);
  }
  return { chapterId, nodeId: (found as ReaderTocNode | null)?.id ?? null };
}

export type ReaderTocBar = { id: string; kind: "h1" | "h2"; state: "current" | "chapter" | "" };

/**
 * 左缘那排短横线：条目不多时章、节全画；多了（百页大书）只画全部章 + 当前章的节，不撑爆屏幕。
 * 章本身就多于 TOC_MAX_BARS 时隔几章画一根（当前章一定画）。
 */
export function tocBars(chapters: readonly ReaderTocChapter[], current: { chapterId: string | null; nodeId: string | null }): ReaderTocBar[] {
  const compact = tocSize(chapters) > TOC_COMPACT_BARS;
  const step = Math.max(1, Math.ceil(chapters.length / TOC_MAX_BARS));
  const bars: ReaderTocBar[] = [];
  chapters.forEach((chapter, index) => {
    const isChapter = chapter.id === current.chapterId;
    if (index % step !== 0 && !isChapter) return;
    bars.push({ id: chapter.id, kind: "h1", state: chapter.id === current.nodeId ? "current" : isChapter ? "chapter" : "" });
    if (compact && !isChapter) return;
    for (const child of chapter.children) {
      if (child.depth > 2 && !isChapter) continue;
      bars.push({ id: child.id, kind: "h2", state: child.id === current.nodeId ? "current" : "" });
    }
  });
  // 当前章的节太多也只留当前节附近的，总数不超过上限。
  if (bars.length <= TOC_MAX_BARS) return bars;
  const at = Math.max(0, bars.findIndex((bar) => bar.state === "current"));
  const start = Math.min(Math.max(0, at - Math.floor(TOC_MAX_BARS / 2)), bars.length - TOC_MAX_BARS);
  return bars.slice(start, start + TOC_MAX_BARS);
}

/** 目录卡的过滤：章名中了列整章；只有节中了，列这一章和中了的节。 */
export function filterToc(chapters: readonly ReaderTocChapter[], query: string): ReaderTocChapter[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...chapters];
  const out: ReaderTocChapter[] = [];
  for (const chapter of chapters) {
    const hit = chapter.title.toLowerCase().includes(q);
    const children = chapter.children.filter((child) => child.title.toLowerCase().includes(q));
    if (hit) out.push(chapter);
    else if (children.length) out.push({ ...chapter, children });
  }
  return out;
}
