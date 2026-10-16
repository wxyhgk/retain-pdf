import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toText } from 'hast-util-to-text';
import { createRequire } from 'node:module';
import { SKIP, visitParents } from 'unist-util-visit-parents';

import { numberEquations, prepareFormula, resolveReferences, unresolvedReferences } from '../science/rendering/equations.mjs';
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
 *
 * What the page shows wrong is reported on `file` (the Studio's check before
 * publishing lists it): a formula KaTeX rejects, drawn in red; a reference
 * no label gives, shown as (??); a label given twice.
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
		const { equations, labels, duplicates } = numberEquations(blocks.map((formula) => formula.value));
		blocks.forEach((formula, index) => Object.assign(formula, equations[index]));
		// A display formula's innermost element has no place in the source; the nearest one that has, does.
		const report = (message, formula, ruleId, cause) =>
			file.message(message, {
				ancestors: formula.ancestors,
				place: formula.ancestors.findLast((node) => node.position)?.position,
				cause,
				ruleId,
				source: 'rehype-katex-mhchem',
			});
		for (const { key, index } of duplicates) report(`公式标签 \\label{${key}} 用了不止一次，引用的是第一个`, blocks[index], 'duplicate-label');
		// One per article: a \gdef in one formula holds in the ones after it, as in LaTeX.
		const macros = macrosFor(file.data?.astro?.frontmatter?.macros);

		for (const formula of formulas) {
			const value = formula.block
				? resolveReferences(formula.source, labels)
				: prepareFormula(formula.value, labels);
			for (const key of unresolvedReferences(formula.value, labels)) {
				report(`找不到公式标签 ${key}：没有公式写 \\label{${key}}，这里显示为 (??)`, formula, 'missing-label');
			}
			const settings = { ...katexOptions, ...options, macros, displayMode: formula.displayMode };
			let html;
			try {
				html = katex.renderToString(value, settings);
			} catch (error) {
				const reason = error instanceof Error ? error.message.replace(/^KaTeX parse error:\s*/u, '') : '';
				report(`公式有错，会显示为红字${reason ? `：${reason}` : ''}`, formula, 'formula', error);
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
