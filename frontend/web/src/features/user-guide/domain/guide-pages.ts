// 软件里的使用说明书：页面在 frontend/web/guide/<页>.md，跟着网页一起发，桌面版、局域网共享、Docker 网页版都能打开。
//
// 这里只管「有哪些页、链接指到哪」，不碰 DOM。目录不另写一份：读 README.md 里「按功能查」那张表，
// 表里列了谁，左边目录就有谁（user-guide-coverage 测试保证每页都在表里）。

/** 说明书的首页（快速上手 + 按功能查的表）。 */
export const GUIDE_HOME = "README";

export type GuidePage = {
  /** 文件名去掉 .md，也是模块名（install、README 除外）。 */
  page: string;
  title: string;
  /** 在软件里哪里（表的第二列），可能为空。 */
  where: string;
};

export type GuideTarget = { page: string; anchor: string };

/** 说明书文件所在目录的地址（相对当前页面，网页、桌面、局域网共享都在站点根下的 guide/）。 */
export function guideBaseUrl(baseUri: string): string {
  try {
    return new URL("guide/", baseUri).toString();
  } catch {
    // about:blank 之类拼不出相对地址的（测试里的空白文档），退到站点根下的 guide/。
    return "/guide/";
  }
}

/** 从 README 的「按功能查」表里取出目录：每行第一格是 [标题](页.md)。 */
export function parseGuideIndex(readme: string): GuidePage[] {
  const pages: GuidePage[] = [];
  const seen = new Set<string>();
  for (const line of readme.split("\n")) {
    const match = /^\|\s*\[([^\]]+)\]\(([\w-]+)\.md\)\s*\|\s*([^|]*)\|/.exec(line.trim());
    if (!match) continue;
    const [, title, page, where] = match;
    if (seen.has(page)) continue;
    seen.add(page);
    pages.push({ page, title: title.trim(), where: where.trim() });
  }
  return pages;
}

/**
 * 标题的锚点，和 GitHub 的规则一样（说明书里的 [x](book-detail.md#重新翻译) 在 GitHub 上也能跳）：
 * 转小写，去掉字母、数字、空格、连字符、下划线以外的字符，空格换成连字符。
 */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 说明书里的一个链接指到哪：
 * - 「页.md」「页.md#锚点」→ 说明书里的另一页；
 * - 「#锚点」→ 当前页的某个标题；
 * - 其余（http、mailto、别的相对路径）→ 外部，新窗口打开。
 */
export function resolveGuideLink(href: string, currentPage: string): GuideTarget | null {
  const raw = `${href || ""}`.trim();
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) return null;
  if (raw.startsWith("#")) return { page: currentPage, anchor: decode(raw.slice(1)) };
  const match = /^(?:\.\/)?([\w-]+)\.md(?:#(.*))?$/.exec(raw);
  if (!match) return null;
  return { page: match[1], anchor: decode(match[2] || "") };
}

/** 说明书里的图片写相对路径（images/<模块>/x.jpg），在软件里要拼上说明书目录。 */
export function resolveGuideAsset(src: string, baseUrl: string): string {
  const raw = `${src || ""}`.trim();
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("/")) return raw;
  // baseUrl 是 guideBaseUrl 给的、以 / 结尾；说明书里的图片都在 images/ 下，直接接上。
  return `${baseUrl}${raw.replace(/^\.\//, "")}`;
}
