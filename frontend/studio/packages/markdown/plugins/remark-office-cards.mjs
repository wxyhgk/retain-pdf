import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { visit } from 'unist-util-visit';

import { articlePath, officeFileOf } from '../articles/article-references.mjs';
import { PUBLISHED_FOLDERS } from '../articles/rules.mjs';
import { t } from '@blog/i18n/index.mjs';
import { officeKind } from '@blog/office/kinds.mjs';
import { fileKind, fileKindName, fileSize } from '../files/file-kinds.mjs';

/**
 * The article's files, linked as the page has them, and its office files
 * as cards (src/office/office-card.ts).
 *
 * A link to a file in the article's img/ or assets/ (`./assets/组会.pptx`)
 * points where the build publishes it, `/article-assets/<slug>/…`
 * (article-assets.mjs). A paragraph that is only such a link to a Word,
 * PowerPoint or Excel file becomes the card's markup, its size read here;
 * the page's script (OfficeCards.astro) draws the file's start into it.
 * A paragraph that is only a link to another file (a PDF, a script, data)
 * becomes a file card (files/file-cards.css): its kind's icon, its name to
 * download it by, what it is and how large; a file linked in a sentence is
 * marked by its kind's icon. A linked file that is not there is reported
 * (ruleId `missing-file`).
 */

/** The link alone in a paragraph, spaces around it aside; null when the paragraph holds more. */
function onlyLink(paragraph) {
	const children = paragraph.children.filter((child) => !(child.type === 'text' && !child.value.trim()));
	return children.length === 1 && children[0].type === 'link' ? children[0] : null;
}

/** Where a card can stand. */
const CARD_PARENTS = new Set(['root', 'blockquote']);

const textOf = (node) => (node.type === 'text' || node.type === 'inlineCode' ? node.value : (node.children ?? []).map(textOf).join(''));

const element = (tagName, properties, children = []) => ({ type: 'officeCardPart', data: { hName: tagName, hProperties: properties }, children });

export default function remarkOfficeCards() {
	return (tree, file) => {
		const article = file.path ? dirname(file.path) : null;
		const slug = article ? basename(article) : '';
		const published = (path) => `/article-assets/${encodeURIComponent(slug)}/${path.split('/').map(encodeURIComponent).join('/')}`;
		const located = (path) => {
			const target = article ? join(article, ...path.split('/')) : null;
			return target && existsSync(target) && statSync(target).isFile() ? target : null;
		};

		visit(tree, 'paragraph', (paragraph, _index, parent) => {
			// In the body or a quote, as the Studio makes them; a list item's link stays a link.
			if (!CARD_PARENTS.has(parent?.type)) return;
			const link = onlyLink(paragraph);
			const path = link ? officeFileOf(link.url) : null;
			if (!link || !path || !article) return;
			const kind = officeKind(path);
			const target = located(path);
			const name = textOf(link).trim() || path.split('/').pop();
			paragraph.data = {
				hName: 'div',
				hProperties: { className: ['office-card'], dataOfficeKind: kind, ...(target ? { dataOfficeSize: String(statSync(target).size) } : {}) },
			};
			paragraph.children = [
				element('div', { className: ['office-card-thumb'] }),
				element('div', { className: ['office-card-info'] }, [
					element('a', { className: ['office-card-name'], href: published(path) }, [{ type: 'text', value: name }]),
					element('span', { className: ['office-card-meta'] }),
				]),
			];
			if (!target) file.message(t('找不到文件 ./{path}', { path }), { place: link.position, ruleId: 'missing-file', source: 'remark-office-cards' });
		});

		if (!article) return;
		// The other files alone on their line: cards to download them by.
		visit(tree, 'paragraph', (paragraph, _index, parent) => {
			if (!CARD_PARENTS.has(parent?.type) || paragraph.data?.hName) return;
			const link = onlyLink(paragraph);
			const path = link ? articlePath(link.url) : null;
			const [root, ...rest] = path?.split('/') ?? [];
			if (!link || !path || !PUBLISHED_FOLDERS.includes(root) || !rest.length) return;
			const kind = fileKind(path);
			const target = located(path);
			const name = textOf(link).trim() || path.split('/').pop();
			const meta = [fileKindName(kind), target ? fileSize(statSync(target).size) : ''].filter(Boolean).join(' · ');
			paragraph.data = { hName: 'div', hProperties: { className: ['file-card'], dataFileKind: kind } };
			paragraph.children = [
				element('div', { className: ['file-card-info'] }, [
					element('a', { className: ['file-card-name'], href: published(path), download: path.split('/').pop() }, [{ type: 'text', value: name }]),
					element('span', { className: ['file-card-meta'] }, [{ type: 'text', value: meta }]),
				]),
			];
			if (!target) file.message(t('找不到文件 ./{path}', { path }), { place: link.position, ruleId: 'missing-file', source: 'remark-office-cards' });
		});
		visit(tree, 'link', (link) => {
			const path = articlePath(link.url);
			const [root, ...rest] = path?.split('/') ?? [];
			if (!path || !PUBLISHED_FOLDERS.includes(root) || !rest.length) return;
			const anchor = /[?#].*$/su.exec(link.url)?.[0] ?? '';
			link.url = `${published(path)}${anchor}`;
			// In a sentence: marked by what it is (an office file's too).
			link.data = { ...link.data, hProperties: { ...link.data?.hProperties, className: ['file-link'], dataFileKind: fileKind(path) } };
			if (!located(path)) file.message(t('找不到文件 ./{path}', { path }), { place: link.position, ruleId: 'missing-file', source: 'remark-office-cards' });
		});
	};
}
