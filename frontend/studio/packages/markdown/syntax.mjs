import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { gfmOptions } from './plugins/markdown-gfm.mjs';
import remarkMathBrackets from './plugins/remark-math-brackets.mjs';

/**
 * How an article's Markdown is read, wherever it is read: CommonMark with
 * GitHub's tables, task lists, footnotes, `~~strikethrough~~` and bare links,
 * and formulas (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`). The blog builds with it
 * (pipeline.mjs, then its own plugins), the Studio cuts and compares blocks
 * with it, and what looks for links, files and sections reads with it, so a
 * bare `https://…/blog/x/` is a link to them all and a `[x](y)` in a formula
 * is none. (The editor is Milkdown's own parser, given the same options:
 * src/studio/editor/studio-editor.ts.)
 */
export const articleSyntax = [[remarkGfm, gfmOptions], remarkMath, remarkMathBrackets];

export const articleParser = unified().use(remarkParse).use(articleSyntax).freeze();

/** An article's Markdown as a tree (mdast), read as the blog reads it. */
export function parseArticle(source) {
	return articleParser.runSync(articleParser.parse(source));
}
