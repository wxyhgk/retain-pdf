import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { visit } from 'unist-util-visit';

import { sanitizeHastElement } from './article-html-policy.mjs';

/**
 * Turn raw HTML islands in Markdown into real elements.
 * Script tags and inline event handlers are removed; the source file is unchanged.
 */
export default function rehypeArticleHtml() {
	return function transform(tree) {
		visit(tree, (node) => {
			if (!node || typeof node !== 'object' || !Array.isArray(node.children)) return;
			let changed = false;
			const next = [];
			for (const child of node.children) {
				if (child?.type !== 'raw') {
					next.push(child);
					continue;
				}
				changed = true;
				const fragment = fromHtmlIsomorphic(String(child.value ?? ''), { fragment: true });
				sanitizeHastElement({ type: 'element', tagName: 'div', properties: {}, children: fragment.children });
				next.push(...fragment.children);
			}
			if (changed) node.children = next;
		});
	};
}
