import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { MOLECULE_LANGUAGES } from '@blog/science/parsers/molecule-block.ts';
import { gfmOptions } from './plugins/markdown-gfm.mjs';
import rehypeArticleHtml from './plugins/rehype-article-html.mjs';
import rehypeKatexMhchem from './plugins/rehype-katex-mhchem.mjs';
import remarkCallouts from './plugins/remark-callouts.mjs';
import remarkCitations from './plugins/remark-citations.mjs';
import remarkCodeFiles from './plugins/remark-code-files.mjs';
import remarkFigures from './plugins/remark-figures.mjs';
import remarkMathBrackets from './plugins/remark-math-brackets.mjs';
import remarkOfficeCards from './plugins/remark-office-cards.mjs';
import remarkWidgets from './plugins/remark-widgets.mjs';
import remarkBlocks from './plugins/remark-blocks.mjs';
import rehypeWidgets from './plugins/rehype-widgets.mjs';
import { WIDGET_LANGUAGE } from './widgets/widgets.mjs';

/**
 * How an article's Markdown becomes its page: the blog's build, and the
 * Studio's check before publishing, run these plugins, so what they report
 * there is what the page would show.
 */

/** Fences drawn as molecules in the page: the formats the molecule parser knows. */
export const chemistryLanguages = MOLECULE_LANGUAGES;

/**
 * The plugins, for unified or Astro: GitHub's Markdown with our options,
 * formulas, widgets, the blocks plugins claim (`blocks`, @blog/kernel), code
 * files, figures, office cards and file links, callouts and citations; then raw HTML made safe (no scripts, event
 * handlers or javascript: links), the widgets' pages put in their frames,
 * and the formulas drawn, with the macros `macrosFor` gives an article
 * (the site's, then its own `macros:`).
 * @param {{ macrosFor?: (articleMacros: unknown) => Record<string, string>, blocks?: { get(fence: string): any } | null }} [options]
 * @returns {{ remarkPlugins: import('@astrojs/markdown-remark').RemarkPlugins, rehypePlugins: import('@astrojs/markdown-remark').RehypePlugins }}
 */
export function markdownPlugins({ macrosFor, blocks = null } = {}) {
	return {
		remarkPlugins: [[remarkGfm, gfmOptions], remarkMath, remarkMathBrackets, remarkWidgets, [remarkBlocks, { blocks }], [remarkCodeFiles, { skip: [...chemistryLanguages, WIDGET_LANGUAGE] }], remarkFigures, remarkOfficeCards, remarkCallouts, remarkCitations],
		rehypePlugins: [rehypeArticleHtml, rehypeWidgets, [rehypeKatexMhchem, { macrosFor }]],
	};
}
