import { mergeMacros } from '@blog/science/rendering/katex-options.mjs';
import siteMacros from './katex-macros.json' with { type: 'json' };

/**
 * The macros an article's formulas use, in the blog and in the Studio: the
 * site's (`katex-macros.json`), then the article's own `macros:`, which win.
 */
export function macrosFor(articleMacros) {
	return mergeMacros(siteMacros, articleMacros);
}
