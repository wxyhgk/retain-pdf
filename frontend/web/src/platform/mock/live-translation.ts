// mock 模式下「翻译中看实时译文」的样例：一份 4 页的英文原文 PDF，
// 加上对得上位置的版面和中文译文，按 0 → 2 → 1 → 3 的顺序一页一页「译好」。
// 页不按顺序出来是有意的：真实翻译是并发的，「跳到最新」要跳最近译好的那一页，不是页码最大的。
// 只给 ?mock= 用，不连后端；截说明书的图、看阅读页的样子都靠它。

import type {
  ReaderLiveTranslationCommitEvent,
  ReaderLiveTranslationLayout,
  ReaderLiveTranslationPageSnapshot,
  ReaderLiveTranslationPort,
} from "@retainpdf/reader/contracts";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 72;
const LINE_CHARS = 82;
const BODY_SIZE = 11;
const BODY_LEADING = 15;
const TITLE_SIZE = 18;
const COMMIT_ORDER = [0, 2, 1, 3];
const FIRST_COMMIT_MS = 1500;
const COMMIT_GAP_MS = 2500;

type SampleBlock = { kind: "title" | "text"; source: string; translated: string };

const SAMPLE_PAGES: readonly (readonly SampleBlock[])[] = [
  [
    { kind: "title", source: "1 Reading Documents Across Languages", translated: "1 跨语言阅读文档" },
    {
      kind: "text",
      source: "Scientific papers are written in a small number of languages, yet they are read all over the world. A reader who meets an unfamiliar language has to choose between a slow, careful reading and a fast machine translation that often loses the layout of the page.",
      translated: "科学论文只用少数几种语言写成，却在世界各地被阅读。遇到不熟悉的语言时，读者只能在缓慢细读和快速机器翻译之间二选一，而后者往往会丢掉页面原本的版式。",
    },
    {
      kind: "text",
      source: "This sample shows a translation that keeps every paragraph in its original place. Formulas, figures and page numbers stay where the author put them, so the translated page can be compared with the source line by line.",
      translated: "这个样例展示的译文让每一段都留在原来的位置。公式、图和页码都在作者放的地方，所以译文页可以和原文逐行对照。",
    },
    {
      kind: "text",
      source: "While the book is still being translated, finished pages appear one at a time on top of the source, and the reader can start reading long before the whole document is done.",
      translated: "书还在翻译时，译好的页会一页一页叠到原文上，读者不用等整份文档完成就可以开始读。",
    },
  ],
  [
    { kind: "title", source: "2 How the Pages Are Processed", translated: "2 页面是怎样处理的" },
    {
      kind: "text",
      source: "Each page is first recognised into blocks of text, titles, tables and formulas. The blocks keep their positions on the page, which is what allows the translation to be placed back exactly where the source text was.",
      translated: "每一页先被识别成正文、标题、表格和公式这些块。块保留着在页面上的位置，译文才能准确地放回原文所在的地方。",
    },
    {
      kind: "text",
      source: "Pages are translated in parallel, so they do not always finish in order. A later page may be ready before an earlier one, and the reader shows each page as soon as its translation is committed.",
      translated: "各页是并行翻译的，不一定按顺序完成。后面的页可能比前面的先好，阅读页在每一页译文提交后马上显示。",
    },
    {
      kind: "text",
      source: "If a page has not been translated yet, the source stays visible and a short note says that the translation will appear there automatically.",
      translated: "还没翻到的页继续显示原文，页上有一句提示，说明译文好了会自动出现。",
    },
  ],
  [
    { kind: "title", source: "3 Checking the Result", translated: "3 检查结果" },
    {
      kind: "text",
      source: "When the whole book is finished, the final translated PDF replaces the live overlay. The reader can then switch to the side-by-side view and compare the source with the finished translation.",
      translated: "整本书翻完后，最终的译文 PDF 会取代实时叠加。这时可以切到左右对照，把原文和完成的译文放在一起看。",
    },
    {
      kind: "text",
      source: "Terms that appear many times are kept consistent across the book. A glossary can be supplied in advance, and the translator follows it for names, units and technical words.",
      translated: "反复出现的术语在全书保持一致。可以事先提供术语表，翻译时人名、单位和专业词都按它来。",
    },
  ],
  [
    { kind: "title", source: "4 Limitations", translated: "4 局限" },
    {
      kind: "text",
      source: "Scanned pages with poor contrast are harder to recognise, and complex tables may need to be checked by hand. Very long formulas are kept in their original form when they cannot be translated safely.",
      translated: "对比度差的扫描页更难识别，复杂的表格可能要人工检查。很长的公式在没法安全翻译时保留原样。",
    },
    {
      kind: "text",
      source: "None of these steps change the source file. The original PDF is always available next to the translation, and every page can be read in either language at any time.",
      translated: "这些步骤都不会改动源文件。原始 PDF 一直在译文旁边，每一页随时都可以用两种语言读。",
    },
  ],
];

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type PlacedBlock = SampleBlock & { itemId: string; lines: string[]; size: number; top: number; bottom: number };

/** 每页的块排在哪：PDF 和版面用同一份位置，叠层才对得上原文。 */
function placePage(pageIdx: number): PlacedBlock[] {
  let top = 80;
  return SAMPLE_PAGES[pageIdx].map((block, blockIdx) => {
    const size = block.kind === "title" ? TITLE_SIZE : BODY_SIZE;
    const leading = block.kind === "title" ? 24 : BODY_LEADING;
    const lines = block.kind === "title" ? [block.source] : wrap(block.source, LINE_CHARS);
    const placed = {
      ...block,
      itemId: `mock-live-p${pageIdx}-b${blockIdx}`,
      lines,
      size,
      top,
      bottom: top + lines.length * leading + 4,
    };
    top = placed.bottom + (block.kind === "title" ? 14 : 20);
    return placed;
  });
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** 4 页英文原文。偏移量算准了写进 xref，pdf.js 不用走修复路径。 */
export function mockLiveSourcePdfBytes(): Uint8Array<ArrayBuffer> {
  const objects: string[] = [];
  const pageIds: number[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let next = 4;
  SAMPLE_PAGES.forEach((_, pageIdx) => {
    const ops: string[] = ["BT"];
    for (const block of placePage(pageIdx)) {
      const leading = block.kind === "title" ? 24 : BODY_LEADING;
      block.lines.forEach((line, lineIdx) => {
        const baseline = PAGE_HEIGHT - (block.top + block.size + lineIdx * leading);
        ops.push(`/F1 ${block.size} Tf 1 0 0 1 ${MARGIN_X} ${baseline} Tm (${escapePdfText(line)}) Tj`);
      });
    }
    ops.push(`/F1 9 Tf 1 0 0 1 ${PAGE_WIDTH / 2 - 4} 40 Tm (${pageIdx + 1}) Tj`, "ET");
    const stream = ops.join("\n");
    const contentId = next++;
    const pageId = next++;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    pageIds.push(pageId);
  });
  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

export function mockLiveTranslationLayout(): ReaderLiveTranslationLayout {
  return {
    pages: SAMPLE_PAGES.map((_, pageIdx) => ({
      page_idx: pageIdx,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      blocks: placePage(pageIdx).map((block) => ({
        item_id: block.itemId,
        bbox: [MARGIN_X - 2, block.top, PAGE_WIDTH - MARGIN_X + 2, block.bottom] as [number, number, number, number],
        source_text: block.source,
        kind: block.kind,
        typography: { font_size_pt: block.size, leading_em: 1.45 },
      })),
    })),
  };
}

function snapshot(pageIdx: number): ReaderLiveTranslationPageSnapshot {
  return {
    attempt: 1,
    generation: 1,
    page_idx: pageIdx,
    page_hash: `mock-live-${pageIdx}`,
    items: placePage(pageIdx).map((block) => ({
      item_id: block.itemId,
      translated_text: block.translated,
      status: "translated",
    })),
  };
}

function wait(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false);
    const timer = setTimeout(() => resolve(true), ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve(false);
    }, { once: true });
  });
}

export const mockLiveTranslationPort: ReaderLiveTranslationPort = {
  fetchLayout: async () => mockLiveTranslationLayout(),
  fetchPage: async (_jobId, pageIdx) => {
    if (!SAMPLE_PAGES[pageIdx]) throw new Error(`mock live page ${pageIdx} does not exist`);
    return snapshot(pageIdx);
  },
  // 断线重连时带 afterSeq，从那之后接着发；全发完就一直挂着，像真的流一样等任务结束。
  streamEvents: async (_jobId, options) => {
    for (const [index, pageIdx] of COMMIT_ORDER.entries()) {
      const seq = index + 1;
      if (seq <= (options.afterSeq || 0)) continue;
      if (!await wait(index === 0 ? FIRST_COMMIT_MS : COMMIT_GAP_MS, options.signal)) return;
      const event: ReaderLiveTranslationCommitEvent = {
        event: "translation_units_committed",
        seq,
        attempt: 1,
        generation: 1,
        page_idx: pageIdx,
        page_hash: `mock-live-${pageIdx}`,
        changed_item_ids: placePage(pageIdx).map((block) => block.itemId),
      };
      await options.onEvent(event);
    }
    await new Promise<void>((resolve) => {
      if (options.signal?.aborted) return resolve();
      options.signal?.addEventListener("abort", () => resolve(), { once: true });
    });
  },
};
