import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toText } from 'hast-util-to-text';
import { createRequire } from 'node:module';
import { SKIP, visitParents } from 'unist-util-visit-parents';

import { numberEquations, prepareFormula, resolveReferences } from '../science/rendering/equations.mjs';
import { katexOptions, lenientOptions, macrosFor } from '../science/rendering/katex-options.mjs';

const require = createRequire(import.meta.url);
const katex = require('katex');
require('katex/contrib/mhchem');

/**
 * Render remark-math nodes with the same KaTeX instance that owns mhchem,
 * with the options the Studio draws formulas with (`katex-options.mjs`):
 * the site's macros and the article's own `macros:`, equations numbered in
 * order with `\label` / `\eqref` (`equations.mjs`). Only formulas that are
 * blocks of their own are numbered, as in the Studio.
 */
export default function rehypeKatexMhchem(options = {}) {
	return function transform(tree, file) {
		const formulas = [];
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
			let block = false;

			if (languageMath && element.tagName === 'code' && parent?.tagName === 'pre') {
				scope = parent;
				parent = parents.at(-2);
				block = true;
			}
			if (!parent || !Array.isArray(parent.children)) return;
			formulas.push({
				scope,
				parent,
				ancestors: [...parents, element],
				block,
				displayMode: block || mathDisplay,
				value: toText(scope, { whitespace: 'pre' }),
			});
			return SKIP;
		});
		if (!formulas.length) return;

		const blocks = formulas.filter((formula) => formula.block);
		const { equations, labels } = numberEquations(blocks.map((formula) => formula.value));
		blocks.forEach((formula, index) => Object.assign(formula, equations[index]));
		// One per article: a \gdef in one formula holds in the ones after it, as in LaTeX.
		const macros = macrosFor(file.data?.astro?.frontmatter?.macros);

		for (const formula of formulas) {
			const value = formula.block
				? resolveReferences(formula.source, labels)
				: prepareFormula(formula.value, labels);
			const settings = { ...katexOptions, ...options, macros, displayMode: formula.displayMode };
			let html;
			try {
				html = katex.renderToString(value, settings);
			} catch (error) {
				file.message('Could not render math with KaTeX and mhchem', {
					ancestors: formula.ancestors,
					cause: error,
					source: 'rehype-katex-mhchem',
				});
				html = katex.renderToString(value, { ...settings, ...lenientOptions });
			}

			const rendered = fromHtmlIsomorphic(html, { fragment: true }).children;
			// What \eqref links to.
			const anchors = (formula.anchors ?? []).map((id) => ({
				type: 'element',
				tagName: 'span',
				properties: { id, className: ['equation-anchor'] },
				children: [],
			}));
			const index = formula.parent.children.indexOf(formula.scope);
			formula.parent.children.splice(index, 1, ...anchors, ...rendered);
		}
	};
}
