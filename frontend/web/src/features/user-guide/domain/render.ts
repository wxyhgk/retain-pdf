// 把说明书的一页 Markdown 画成 HTML：标题带锚点，页内链接换成 data-guide-page（点了在说明书里翻页），
// 外部链接新窗口打开，图片拼上说明书目录，icons/ 下的小图标排在文字里。<details> 这样的 HTML 原样留着（「更多说明」默认收起）。内容是跟着软件一起发的 guide/*.md，不是用户输入，所以不另做清洗。

import { Marked, type Tokens } from "marked";
import { headingSlug, resolveGuideAsset, resolveGuideLink } from "./guide-pages.js";

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 把一页 Markdown 画成 HTML。page 是这一页的名字（页内锚点链接要用），baseUrl 是说明书目录的地址。 */
export function renderGuidePage(markdown: string, page: string, baseUrl: string): string {
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        return `<h${token.depth} id="${escapeAttr(headingSlug(token.text))}">${inner}</h${token.depth}>\n`;
      },
      link(this: { parser: { parseInline: (tokens: Tokens.Generic[]) => string } }, token: Tokens.Link) {
        const inner = this.parser.parseInline(token.tokens);
        const target = resolveGuideLink(token.href, page);
        if (target) {
          const href = `#${target.anchor}`;
          return `<a href="${escapeAttr(href)}" data-guide-page="${escapeAttr(target.page)}" data-guide-anchor="${escapeAttr(target.anchor)}">${inner}</a>`;
        }
        return `<a href="${escapeAttr(token.href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
      },
      image(token: Tokens.Image) {
        const src = resolveGuideAsset(token.href, baseUrl);
        const alt = escapeAttr(token.text || "");
        // icons/ 下的是正文里的小图标（和软件界面同一套），跟着文字排在一行里。
        if (/^(\.\/)?icons\//.test(token.href)) return `<img class="guide-icon" src="${escapeAttr(src)}" alt="${alt}">`;
        return `<img src="${escapeAttr(src)}" alt="${alt}" loading="lazy">`;
      },
    },
  });
  return String(marked.parse(markdown, { async: false }));
}
