import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SKIP, visit } from 'unist-util-visit';

import { BIBLIOGRAPHY_PATH, CITATION, numberRanges, parseBibtex, parseCitation, referencePieces } from '../references/bibtex.mjs';

/**
 * Citations (`[@becke1993]`, `[@a; @b, p. 12]`) numbered as they first
 * come, drawn as `[1]`, `[2,3]` above the line and linked to the list of
 * them, 参考文献, added at the end from the article's `assets/refs.bib`.
 * A key the file does not have shows `[?]`; it, and citations without the
 * file, are reported (ruleId `citation`) for the check before publishing.
 */

const SKIPPED_PARENTS = new Set(['link', 'linkReference', 'inlineCode', 'code', 'inlineMath', 'math', 'html']);

const text = (value) => ({ type: 'text', value });
const element = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });

/** A list entry's pieces (bibtex.mjs) as HTML. */
function referenceChildren(pieces) {
	return pieces.map((piece) => {
		if (typeof piece === 'string') return text(piece);
		if ('em' in piece) return element('em', {}, [text(piece.em)]);
		if ('strong' in piece) return element('strong', {}, [text(piece.strong)]);
		return element('a', { href: piece.link }, [text(piece.link)]);
	});
}

export default function remarkCitations() {
	return (tree, file) => {
		const article = file.path ? dirname(file.path) : null;
		const bibPath = article ? join(article, ...BIBLIOGRAPHY_PATH.split('/')) : null;
		let entries = null;
		const library = () => {
			if (entries) return entries;
			entries = bibPath && existsSync(bibPath) ? parseBibtex(readFileSync(bibPath, 'utf8')) : null;
			return entries;
		};
		/** Keys in the order they are first cited; a key's number is its place here, from 1. */
		const cited = [];
		const missing = new Set();
		let withoutLibrary = false;

		visit(tree, 'text', (node, index, parent) => {
			if (!parent || index === undefined || SKIPPED_PARENTS.has(parent.type) || !node.value.includes('[@')) return;
			const pieces = [];
			let last = 0;
			for (const match of node.value.matchAll(CITATION)) {
				const items = parseCitation(match[1]);
				if (!items) continue;
				if (match.index > last) pieces.push(text(node.value.slice(last, match.index)));
				last = match.index + match[0].length;
				const numbers = [];
				const titles = [];
				for (const { key, locator } of items) {
					const entry = library()?.get(key);
					if (!library()) withoutLibrary = true;
					else if (!entry && !missing.has(key)) {
						missing.add(key);
						file.message(`找不到文献 @${key}：${BIBLIOGRAPHY_PATH} 里没有这个 key`, { place: node.position, ruleId: 'citation', source: 'remark-citations' });
					}
					if (!entry) continue;
					if (!cited.includes(key)) cited.push(key);
					numbers.push(cited.indexOf(key) + 1);
					titles.push(locator ? `${key}, ${locator}` : key);
				}
				const label = numbers.length ? numberRanges(numbers) : '?';
				pieces.push({
					type: 'citation',
					data: {
						hName: 'sup',
						hProperties: { className: ['citation'] },
						hChildren: [
							numbers.length
								? element('a', { href: `#ref-${Math.min(...numbers)}`, title: titles.join('; ') }, [text(`[${label}]`)])
								: element('span', { className: ['citation-missing'], title: items.map((item) => `@${item.key}`).join('; ') }, [text('[?]')]),
						],
					},
				});
			}
			if (!pieces.length) return;
			if (last < node.value.length) pieces.push(text(node.value.slice(last)));
			parent.children.splice(index, 1, ...pieces);
			return [SKIP, index + pieces.length];
		});

		if (withoutLibrary) {
			file.message(`文章引用了文献，但没有 ${BIBLIOGRAPHY_PATH}`, { ruleId: 'citation', source: 'remark-citations' });
		}
		if (!cited.length) return;
		tree.children.push(
			{ type: 'heading', depth: 2, children: [text('参考文献')] },
			{
				type: 'references',
				data: {
					hName: 'ol',
					hProperties: { className: ['references'] },
					hChildren: cited.map((key, index) =>
						element('li', { id: `ref-${index + 1}` }, referenceChildren(referencePieces(library().get(key)))),
					),
				},
			},
		);
	};
}
