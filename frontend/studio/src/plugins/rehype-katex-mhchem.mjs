import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toText } from 'hast-util-to-text';
import { createRequire } from 'node:module';
import { SKIP, visitParents } from 'unist-util-visit-parents';

import { katexOptions, lenientOptions } from '../science/rendering/katex-options.mjs';

const require = createRequire(import.meta.url);
const katex = require('katex');
require('katex/contrib/mhchem');

/**
 * Render remark-math nodes with the same KaTeX instance that owns mhchem,
 * with the options the Studio draws formulas with (`katex-options.mjs`).
 * Keeping both imports here avoids a second bundled KaTeX instance losing
 * the \ce and \pu macro registrations during Astro's content build.
 */
export default function rehypeKatexMhchem(options = {}) {
	return function transform(tree, file) {
		visitParents(tree, 'element', (element, parents) => {
			const classes = Array.isArray(element.properties?.className)
				? element.properties.className
				: [];
			const languageMath = classes.includes('language-math');
			const mathDisplay = classes.includes('math-display');
			const mathInline = classes.includes('math-inline');
			if (!languageMath && !mathDisplay && !mathInline) return;

			let parent = parents.at(-1);
			let scope = element;
			let displayMode = mathDisplay;

			if (languageMath && element.tagName === 'code' && parent?.tagName === 'pre') {
				scope = parent;
				parent = parents.at(-2);
				displayMode = true;
			}
			if (!parent || !Array.isArray(parent.children)) return;

			const value = toText(scope, { whitespace: 'pre' });
			let html;
			try {
				html = katex.renderToString(value, { ...katexOptions, ...options, displayMode });
			} catch (error) {
				file.message('Could not render math with KaTeX and mhchem', {
					ancestors: [...parents, element],
					cause: error,
					source: 'rehype-katex-mhchem',
				});
				html = katex.renderToString(value, { ...katexOptions, ...options, ...lenientOptions, displayMode });
			}

			const rendered = fromHtmlIsomorphic(html, { fragment: true }).children;
			const index = parent.children.indexOf(scope);
			parent.children.splice(index, 1, ...rendered);
			return SKIP;
		});
	};
}
