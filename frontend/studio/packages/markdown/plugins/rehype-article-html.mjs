import { raw } from 'hast-util-raw';

import { sanitizeHastElement } from './article-html-policy.mjs';

function hasRaw(node) {
	if (node?.type === 'raw') return true;
	return Array.isArray(node?.children) && node.children.some(hasRaw);
}

/**
 * Turn raw HTML in Markdown into real elements, without scripts, event
 * handlers or javascript: links (article-html-policy.mjs). The whole tree is
 * parsed at once, so an inline tag that Markdown split into pieces
 * (`<sup>`, text, `</sup>`) closes around its text as written. An article
 * with no HTML is left exactly as it was. The source file is unchanged.
 */
export default function rehypeArticleHtml() {
	return function transform(tree, file) {
		if (!hasRaw(tree)) return tree;
		const parsed = raw(tree, { file });
		const wrapper = { type: 'element', tagName: 'div', properties: {}, children: parsed.children };
		sanitizeHastElement(wrapper);
		parsed.children = wrapper.children;
		return parsed;
	};
}
