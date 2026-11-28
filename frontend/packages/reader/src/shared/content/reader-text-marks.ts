// 书页文字层的一段字 → HTML（2026-11-27 从交叉引用那份抽成通用的）：扩展标出几段（贡献表的 textMarks），这里包成 <mark>，
// 搜索词在每一段里照旧包 <mark class="reader-find-mark">，其余转义。
// 用 <mark> 不用 <span>：文字层的 span 都是绝对定位（每个 span 是一段字），套一层 span 会错位。
import { highlightFindTerm } from "./reader-find.js";

/** 一段要标出来的字：[start, end)、class、几个 data-* 属性（别的属性名不认，跳过）。 */
export type ReaderTextMark = { start: number; end: number; className: string; attrs?: Readonly<Record<string, string>> };

const ATTR_NAME = /^data-[a-z0-9-]+$/;

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** 按起点排；和前一段重叠的丢掉（先到的赢，起点一样按给的顺序，即扩展顺序）。 */
export function renderMarkedText(text: string, marks: readonly ReaderTextMark[], findTerm = ""): string {
  if (!marks.length) return highlightFindTerm(text, findTerm);
  const sorted = marks
    .filter((mark) => mark.end > mark.start && mark.start >= 0 && mark.end <= text.length)
    .map((mark, order) => ({ mark, order }))
    .sort((a, b) => a.mark.start - b.mark.start || a.order - b.order)
    .map(({ mark }) => mark);
  let out = "";
  let from = 0;
  for (const mark of sorted) {
    if (mark.start < from) continue;
    out += highlightFindTerm(text.slice(from, mark.start), findTerm);
    const attrs = Object.entries(mark.attrs ?? {})
      .filter(([name]) => ATTR_NAME.test(name))
      .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
      .join("");
    out += `<mark class="${escapeAttr(mark.className)}"${attrs}>${highlightFindTerm(text.slice(mark.start, mark.end), findTerm)}</mark>`;
    from = mark.end;
  }
  return out + highlightFindTerm(text.slice(from), findTerm);
}
