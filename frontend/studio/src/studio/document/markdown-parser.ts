import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import remarkMathBrackets from '../../plugins/remark-math-brackets.mjs';

/**
 * Markdown as the blog reads it: CommonMark with GitHub's tables, task
 * lists, footnotes, strikethrough and bare links, and formulas. Blocks are
 * cut and compared with it, so a table is one block and `<https://x.y>`
 * means the same as `https://x.y`.
 */
export const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkMathBrackets);
