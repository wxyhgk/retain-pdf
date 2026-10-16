import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { MOLECULE_LANGUAGES } from '../science/parsers/molecule-block.ts';
import { gfmOptions } from './markdown-gfm.mjs';
import rehypeArticleHtml from './rehype-article-html.mjs';
import rehypeKatexMhchem from './rehype-katex-mhchem.mjs';
import remarkCodeFiles from './remark-code-files.mjs';
import remarkFigures from './remark-figures.mjs';
import remarkMathBrackets from './remark-math-brackets.mjs';

/**
 * How an article's Markdown becomes its page: the build uses these plugins
 * (astro.config.mjs), and the Studio's check before publishing runs them
 * too, so what they report there is what the page would show.
 */

/** Fences drawn as molecules in the page: the formats the molecule parser knows. */
export const chemistryLanguages = MOLECULE_LANGUAGES;

/**
 * GitHub's Markdown with our options, formulas, code files and figures.
 * @type {import('@astrojs/markdown-remark').RemarkPlugins}
 */
export const remarkPlugins = [[remarkGfm, gfmOptions], remarkMath, remarkMathBrackets, [remarkCodeFiles, { skip: chemistryLanguages }], remarkFigures];

/**
 * Raw HTML in an article becomes elements, without scripts, event handlers or javascript: links; then the formulas.
 * @type {import('@astrojs/markdown-remark').RehypePlugins}
 */
export const rehypePlugins = [rehypeArticleHtml, rehypeKatexMhchem];
