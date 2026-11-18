// 混合页码（`1-5, 8, 12-14`）的解析和压缩：书详情「指定页码」的输入框和翻译覆盖的页码摘要用。
// 以前放在 features/library/domain/translation-ocr-reuse.ts，但书架自己不用，只有书详情用，挪到这里。

/** 扁平而不是判别联合：tsconfig 是 `strict: false`，布尔字面量判别在这个配置下
 *  不收窄（`if (!r.ok) r.error` 会报「属性不存在」）。所以字段总是存在。 */
export type PageSelection = { ok: boolean; pages: number[]; spec: string; error: string };

const fail = (error: string): PageSelection => ({ ok: false, pages: [], spec: "", error });

/** 解析混合页码，比如 `1-5, 8, 12-14`（打印对话框那种写法）。
 *
 * 返回**去重、升序、1 起**的文档页号，外加一份规范化后的字符串（`1-5,8,12-14`）——
 * 后者可以原样交给 `ocr.page_ranges`，MinerU 和 Rust 的 `parse_page_ranges` 都认这个格式。
 *
 * 容忍的写法：中英文逗号、顿号、空格分隔；`~` `—` `–` 当作连字符。这些都是从输入法里
 * 很容易敲出来的，拒掉它们只会让人困惑「我明明写对了」。
 *
 * 拒绝的写法都给出能照着改的提示，而不是一句「格式错误」：
 * 倒序区间（`5-3`）、0 或超出总页数、空串、非数字。
 */
export function parsePageSelection(raw: string, pageCount: number): PageSelection {
  const text = `${raw ?? ""}`
    .replace(/[，、；;]/g, ",")
    .replace(/[~～—–]/g, "-")
    .trim();
  if (!text) return fail("请填写要翻译的页码，比如 1-5, 8, 12-14");
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return fail("还不知道这本书有几页，稍后再试");
  }
  const pages = new Set<number>();
  for (const rawPart of text.split(/[,\s]+/)) {
    const part = rawPart.trim();
    if (!part) continue;
    const range = /^(\d+)-(\d+)$/.exec(part);
    const single = /^(\d+)$/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end) {
        return fail(`「${part}」起止颠倒了，应写成 ${end}-${start}`);
      }
      if (start < 1 || end > pageCount) {
        return fail(`「${part}」超出范围，这本书共 ${pageCount} 页`);
      }
      for (let page = start; page <= end; page += 1) pages.add(page);
    } else if (single) {
      const page = Number(single[1]);
      if (page < 1 || page > pageCount) {
        return fail(`第 ${page} 页不存在，这本书共 ${pageCount} 页`);
      }
      pages.add(page);
    } else {
      return fail(`看不懂「${part}」—— 页码写成 3 或 3-7，用逗号分开`);
    }
  }
  const sorted = [...pages].sort((a, b) => a - b);
  if (sorted.length === 0) return fail("请填写要翻译的页码，比如 1-5, 8, 12-14");
  return { ok: true, pages: sorted, spec: compactPageSpec(sorted), error: "" };
}

/** `[1,2,3,4,5,8,12,13,14]` → `"1-5,8,12-14"`。 */
export function compactPageSpec(pages: number[]): string {
  const out: string[] = [];
  let index = 0;
  while (index < pages.length) {
    const start = pages[index];
    let end = start;
    while (index + 1 < pages.length && pages[index + 1] === end + 1) {
      index += 1;
      end = pages[index];
    }
    out.push(start === end ? `${start}` : `${start}-${end}`);
    index += 1;
  }
  return out.join(",");
}
