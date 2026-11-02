import rehypeArticleHtml from './plugins/rehype-article-html.mjs';
import rehypeKatexMhchem from './plugins/rehype-katex-mhchem.mjs';
import remarkCallouts from './plugins/remark-callouts.mjs';
import remarkCitations from './plugins/remark-citations.mjs';
import remarkCodeFiles from './plugins/remark-code-files.mjs';
import remarkFigures from './plugins/remark-figures.mjs';
import remarkOfficeCards from './plugins/remark-office-cards.mjs';
import remarkBlocks from './plugins/remark-blocks.mjs';
import remarkRetainpdfSources from './plugins/remark-retainpdf-sources.mjs';
import rehypeBlocks from './plugins/rehype-blocks.mjs';
import { articleSyntax } from './syntax.mjs';

/**
 * How an article's Markdown becomes its page: the blog's build, and the
 * Studio's check before publishing, run these plugins, so what they report
 * there is what the page would show.
 */

/**
 * The plugins, for unified or Astro: GitHub's Markdown with our options,
 * formulas, the blocks plugins claim (`blocks`, @blog/kernel: chemistry,
 * widgets, calculations…), code files, figures, office cards and file links,
 * callouts and citations, passages quoted from RetainPDF said where they are from; then raw HTML made safe (no scripts, event
 * handlers or javascript: links), the blocks finished (a widget's page put
 * in its frame), and the formulas drawn, with the macros `macrosFor` gives
 * an article (the site's, then its own `macros:`).
 * @param {{ macrosFor?: (articleMacros: unknown) => Record<string, string>, blocks?: { get(fence: string): any, list(): any[], fences(): string[] } | null }} [options]
 * @returns {{ remarkPlugins: import('@astrojs/markdown-remark').RemarkPlugins, rehypePlugins: import('@astrojs/markdown-remark').RehypePlugins }}
 */
export function markdownPlugins({ macrosFor, blocks = null } = {}) {
	return {
		// A fence a plugin claims is its own, even left as it is (a molecule drawn in the page): not a code file.
		remarkPlugins: [...articleSyntax, [remarkBlocks, { blocks }], [remarkCodeFiles, { skip: blocks?.fences() ?? [] }], remarkFigures, remarkOfficeCards, remarkCallouts, remarkCitations, remarkRetainpdfSources],
		rehypePlugins: [rehypeArticleHtml, [rehypeBlocks, { blocks }], [rehypeKatexMhchem, { macrosFor }]],
	};
}
