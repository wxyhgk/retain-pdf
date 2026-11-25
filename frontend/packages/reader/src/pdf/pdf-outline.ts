// 读 PDF 自带的书签（目录）：pdf.js 的 getOutline 给的是一棵树，每条的去处是「命名目的地」或者「页的引用 + 位置」，
// 这里把它换成页码。读不出来（没有书签、坏了）就是空数组，目录退回按 OCR 认出的标题（reader-find.ts 的 readerOutline）。
//
// 用户 issue #146、#133：长书的目录要用原书自带的书签，多级、能折叠。

/** pdf.js PDFDocumentProxy 里用到的那几样（写成接口，测试用假的）。 */
export type PdfOutlineSource = {
  getOutline(): Promise<RawOutlineItem[] | null>;
  getDestination(name: string): Promise<unknown[] | null>;
  getPageIndex(ref: unknown): Promise<number>;
};

type RawOutlineItem = {
  title?: string;
  dest?: string | unknown[] | null;
  items?: RawOutlineItem[];
};

export type PdfOutlineNode = {
  /** 树里的位置（`0.2.1`），当 React key 和折叠状态用。 */
  id: string;
  title: string;
  /** 跳到第几页（从 1 数）；去处解析不出来时为 null（这一条照样显示，点了不跳）。 */
  page: number | null;
  /** 第几层，从 1 数。 */
  level: number;
  children: PdfOutlineNode[];
};

/** 太大的书签树（有的 PDF 每页一条）只读这么多条，免得卡。 */
export const OUTLINE_LIMIT = 3000;
const MAX_DEPTH = 8;

async function resolvePage(pdf: PdfOutlineSource, dest: RawOutlineItem["dest"]): Promise<number | null> {
  try {
    const explicit = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || !explicit.length) return null;
    const target = explicit[0];
    // 有的 PDF 直接写页序号（从 0 数），多数写页对象的引用 {num, gen}。
    const index = typeof target === "number" ? target : await pdf.getPageIndex(target);
    return Number.isInteger(index) && index >= 0 ? index + 1 : null;
  } catch {
    return null;
  }
}

function cleanTitle(title: unknown): string {
  return `${title ?? ""}`.replace(/\s+/gu, " ").trim();
}

export async function readPdfOutline(pdf: PdfOutlineSource): Promise<PdfOutlineNode[]> {
  let raw: RawOutlineItem[] | null;
  try {
    raw = await pdf.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(raw) || !raw.length) return [];
  // 先同步搭出树（数到上限就停），再并行把所有去处换成页码：几百条书签不用一条条等。
  let budget = OUTLINE_LIMIT;
  const pending: Array<{ node: PdfOutlineNode; dest: RawOutlineItem["dest"] }> = [];
  const build = (items: RawOutlineItem[], level: number, prefix: string): PdfOutlineNode[] => {
    const nodes: PdfOutlineNode[] = [];
    for (let index = 0; index < items.length && budget > 0; index += 1) {
      const item = items[index];
      const title = cleanTitle(item?.title);
      if (!title) continue;
      budget -= 1;
      const id = prefix ? `${prefix}.${index}` : `${index}`;
      const node: PdfOutlineNode = { id, title, page: null, level, children: [] };
      pending.push({ node, dest: item.dest });
      nodes.push(node);
      if (level < MAX_DEPTH && Array.isArray(item.items) && item.items.length) node.children = build(item.items, level + 1, id);
    }
    return nodes;
  };
  const tree = build(raw, 1, "");
  await Promise.all(pending.map(async ({ node, dest }) => {
    node.page = await resolvePage(pdf, dest);
  }));
  return tree;
}

/** 按树的顺序摊平（算「眼下在哪一节」、测试用）。 */
export function flattenOutline(nodes: readonly PdfOutlineNode[]): PdfOutlineNode[] {
  const out: PdfOutlineNode[] = [];
  const visit = (list: readonly PdfOutlineNode[]) => {
    for (const node of list) {
      out.push(node);
      visit(node.children);
    }
  };
  visit(nodes);
  return out;
}

/**
 * 眼下这一页落在哪一条书签下：页码不超过当前页、页码最大的那一条。
 * 同一页有好几条时取树里第一条；只有它的下级也在同一页时才往下走（一章和它的第一节同页 → 标那一节）。
 * 有的 PDF 一串书签都指向同一页（比如都指向目录页），不能标成最后那条。返回 id；在第一条之前是 null。
 */
export function currentBookmark(nodes: readonly PdfOutlineNode[], page: number): string | null {
  let found: PdfOutlineNode | null = null;
  for (const node of flattenOutline(nodes)) {
    if (node.page === null || node.page > page) continue;
    if (!found || node.page > (found.page ?? 0) || (node.page === found.page && node.id.startsWith(`${found.id}.`))) found = node;
  }
  return found?.id ?? null;
}

/** 一条书签的所有上级（id），打开目录时把眼下这一节的上级都展开。 */
export function ancestorIds(id: string | null): string[] {
  if (!id) return [];
  const parts = id.split(".");
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("."));
}
