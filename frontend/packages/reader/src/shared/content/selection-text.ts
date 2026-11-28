// 书页上选中的字（2026-11-28 用户：「对选区 copy 和提问取值做 PDF 断行 / 连字符清洗」「尤其是行内公式的选择显示得做好」）。
// 纯函数，不碰 DOM；用的地方：复制（copy 事件、浮条「复制」）、提问取出处（ask/anchor.ts）、收藏。
//
// PDF 文字层（pdf.js）拿到的字是一行一行的：行尾一个 "\n"，英文排版的断词连字符留在行尾，公式里的字母是
// 数学字母区的码位（𝑚 = U+1D45A），「⊈」是「̸」和「⊆」两个字中间还夹个空格。这里把它们收拾成人读的样子。

/** 数学字母区（𝐀 𝑚 𝔽 𝟙 ……）和连字（ﬁ ﬂ）：逐字 NFKC 还原成普通字母；别的字不动（全角、中文标点不能跟着 NFKC 变）。 */
const COMPAT_CHARS = /[\u{1D400}-\u{1D7FF}ﬀ-ﬆ]/gu;

/** 汉字、假名、谚文和中日韩标点：这几种字的两行接起来不加空格。 */
const CJK = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/u;

/**
 * 把 PDF 文字层选出来的一段字收拾好：
 * - 行尾断词的连字符接回去（"compu-\ntation" → "computation"，只在连字符前是字母、下一行小写开头时；大写开头的留着连字符）；
 * - 其余的换行接成一个空格，中日韩字两边不加空格；空一行的地方（段落）留一个换行；
 * - 去掉软连字符；数学字母、连字还原成普通字母；「̸ ⊆」这种拆开的否定号合回「⊈」；
 * - 连着的空白收成一个，头尾去掉。
 */
export function cleanPdfSelectionText(raw: string): string {
  let text = `${raw || ""}`.replace(/\r\n?/g, "\n").replace(/­/g, "");
  if (!text.trim()) return "";
  text = text.replace(COMPAT_CHARS, (char) => char.normalize("NFKC"));
  // 否定斜线（U+0338）：排对了的（紧跟在符号后面）先按 NFC 合成（= + ̸ → ≠）；剩下的是 PDF 里排在符号前面、
  // 中间还隔个空格的（"VNP̸ ⊆"），挪到后面那个符号上再合成，前面那个字和它隔一个空格（"VNP ⊈"）。
  text = text.normalize("NFC");
  if (text.includes("̸")) {
    text = text
      .replace(/(\S)?̸[ \t]*(\S)/gu, (_match, before: string | undefined, symbol: string) => `${before ? `${before} ` : ""}${symbol}̸`)
      .normalize("NFC");
  }
  const paragraphs = text.split(/\n[ \t]*\n+/);
  return paragraphs
    .map((paragraph) => joinLines(paragraph.split("\n")))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function joinLines(lines: readonly string[]): string {
  let out = "";
  for (const raw of lines) {
    const line = raw.replace(/[ \t ]+/g, " ").trim();
    if (!line) continue;
    if (!out) {
      out = line;
      continue;
    }
    // 行尾断词：字母 + 连字符，下一行小写字母开头 → 去掉连字符接上；大写、数字开头的是本来就带连字符的词（"self-\nConsistent"），连字符留着、不加空格。
    if (/\p{L}-$/u.test(out) && /^\p{Ll}/u.test(line)) {
      out = out.slice(0, -1) + line;
      continue;
    }
    if (/\p{L}-$/u.test(out) && /^[\p{Lu}\p{N}]/u.test(line)) {
      out += line;
      continue;
    }
    const last = out.slice(-1);
    const first = line.charAt(0);
    out += CJK.test(last) || CJK.test(first) ? line : ` ${line}`;
  }
  return out;
}

// —— 行内公式（2026-11-28 用户：「类似这样可以真正的选中公式」）——
// 后端给阅读页的块只到段落一级，没有行内公式的位置；只能从文字层的一段段字认：
// 一行里连着的几段，至少有一段带数学符号（数学字母、希腊字母、运算符、上下标、组合符号），
// 中间夹着的短段（≤ 6 个字、没有三个以上小写字母连成的词，例如「VNP」「VP」「(」「 」）也算公式的一部分。
// 选区的头或尾落在这样一串里，就把它撑到整串（不会只选半个公式）。

/** 带数学符号：数学字母区、希腊字母、字母式符号、箭头、运算符、杂项数学符号、上下标、组合附加符号。 */
const MATH_CHAR = /[\u{1D400}-\u{1D7FF}Ͱ-Ͽ℀-⅏←-⋿⨀-⫿⟀-⟯⦀-⧿⁰-₟̀-ͯ√±×÷]/u;

export function hasMathChar(text: string): boolean {
  return MATH_CHAR.test(text);
}

/** 夹在公式中间也算公式的短段：空白、短的大写缩写 / 数字 / 括号；有成词的小写（≥ 3 个小写字母）就是正文。 */
export function isFormulaFiller(text: string): boolean {
  const value = `${text || ""}`;
  if (!value.trim()) return true;
  if ([...value.trim()].length > 6) return false;
  return !/\p{Ll}{3,}/u.test(value);
}

export type FormulaToken = { text: string; line: number };

/**
 * 第 index 段所在的公式串 [start, end]（含两头）；它不在公式里是 null。
 * tokens 是文字层里按顺序的一段段字和它们在第几行（同一行的段落 line 相同）。
 * 串两头的空白段不算进去。
 */
export function formulaRunAt(tokens: readonly FormulaToken[], index: number): [number, number] | null {
  const token = tokens[index];
  if (!token) return null;
  const inRun = (at: number) => {
    const entry = tokens[at];
    return Boolean(entry) && entry.line === token.line && (hasMathChar(entry.text) || isFormulaFiller(entry.text));
  };
  if (!inRun(index)) return null;
  let start = index;
  let end = index;
  while (inRun(start - 1)) start -= 1;
  while (inRun(end + 1)) end += 1;
  let math = false;
  for (let at = start; at <= end; at += 1) if (hasMathChar(tokens[at].text)) math = true;
  if (!math) return null;
  while (start < end && !tokens[start].text.trim()) start += 1;
  while (end > start && !tokens[end].text.trim()) end -= 1;
  return [start, end];
}

// —— 选区画成一条条整齐的色带（2026-11-28：浏览器按字画的选区在公式上高低不齐、上下标一截一截）——

export type SelectionRect = { left: number; top: number; right: number; bottom: number };

/**
 * 把一个个字的框收成每行一条色带：上下有一半以上重叠的算同一行；同一行里隔得太远（> 两个行高，双栏的栏缝）分开画。
 * 行高按这一行里够高的框（≥ 最高的 75%，上下标那种小框不算）定，色带上下一样齐。
 */
export function mergeSelectionRects(rects: readonly SelectionRect[]): SelectionRect[] {
  const usable = rects.filter((rect) => rect.right - rect.left > 0.5 && rect.bottom - rect.top > 0.5);
  if (!usable.length) return [];
  const sorted = [...usable].sort((a, b) => (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2);
  const lines: SelectionRect[][] = [];
  for (const rect of sorted) {
    const line = lines.at(-1);
    const band = line ? lineBand(line) : null;
    if (band && verticalOverlap(band, rect) >= 0.5 * Math.min(band.bottom - band.top, rect.bottom - rect.top)) line!.push(rect);
    else lines.push([rect]);
  }
  const out: SelectionRect[] = [];
  for (const line of lines) {
    const band = lineBand(line);
    const height = band.bottom - band.top;
    const byLeft = [...line].sort((a, b) => a.left - b.left);
    let current: SelectionRect | null = null;
    for (const rect of byLeft) {
      if (current && rect.left - current.right <= height * 2) {
        current.right = Math.max(current.right, rect.right);
      } else {
        if (current) out.push(current);
        current = { left: rect.left, top: band.top, right: rect.right, bottom: band.bottom };
      }
    }
    if (current) out.push(current);
  }
  return out;
}

function lineBand(line: readonly SelectionRect[]): { top: number; bottom: number } {
  const tallest = Math.max(...line.map((rect) => rect.bottom - rect.top));
  const main = line.filter((rect) => rect.bottom - rect.top >= tallest * 0.75);
  return { top: Math.min(...main.map((rect) => rect.top)), bottom: Math.max(...main.map((rect) => rect.bottom)) };
}

function verticalOverlap(a: { top: number; bottom: number }, b: { top: number; bottom: number }): number {
  return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
}
