import type { Node as ProseNode } from '@milkdown/prose/model';
import { NodeSelection, Selection, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';

import type { StudioBlock } from '@blog/kernel/studio.ts';
import { t } from '@blog/i18n/index.mjs';

/**
 * Links as Notion takes them: what a plugin's block makes of an address
 * (`links` of its StudioBlock: a video's player, a bookmark's card). An
 * address pasted alone on its line offers them in a small menu under it, the
 * first chosen with ↩; a line that is only a link, and those blocks, turn
 * into one another from the block menu (转换成).
 */

export type LinkTarget = NonNullable<StudioBlock['links']>;

/** Markdown read as the editor's blocks (Milkdown's parser). */
export type ParseMarkdown = (markdown: string) => ProseNode | null;

/** The plugins' links, those only some sites' addresses are (a video) before those of any page (a bookmark). */
export function linkTargets(blocks: readonly StudioBlock[]): LinkTarget[] {
	const targets = blocks.flatMap((block) => (block.links ? [block.links] : []));
	return [...targets.filter((target) => target.specific), ...targets.filter((target) => !target.specific)];
}

/** What an address may become. */
export function targetsFor(url: string, targets: readonly LinkTarget[]): LinkTarget[] {
	return targets.filter((target) => {
		try {
			return target.matches(url);
		} catch {
			return false;
		}
	});
}

/** The address a paragraph holds, when it holds nothing else: one link (its text anything), or an address as text. */
export function onlyLink(node: ProseNode): string | null {
	if (node.type.name !== 'paragraph' || node.childCount === 0) return null;
	let href: string | null = null;
	let alone = true;
	node.forEach((child) => {
		const link = child.marks.find((mark) => mark.type.name === 'link');
		const here = link ? String(link.attrs.href) : child.isText && /^https?:\/\/\S+$/u.test(child.text!.trim()) ? child.text!.trim() : null;
		if (!here || (href !== null && here !== href)) alone = false;
		href = here ?? href;
	});
	return alone && href && /^https?:\/\//iu.test(href) ? href : null;
}

/** The address on the first line of a block a link became (a video's, a bookmark's). */
export function blockAddress(node: ProseNode): string | null {
	const first = node.textContent.split('\n', 1)[0]!.trim();
	return /^https?:\/\/\S+$/iu.test(first) ? first : null;
}

/** Puts `markdown`'s blocks in place of the block at `pos`; one drawn whole (a card, a player) is selected. */
export function replaceBlock(view: EditorView, pos: number, markdown: string, parse: ParseMarkdown): boolean {
	const node = view.state.doc.nodeAt(pos);
	const parsed = parse(markdown);
	if (!node || !parsed || parsed.childCount === 0) return false;
	const tr = view.state.tr.replaceWith(pos, pos + node.nodeSize, parsed.content);
	const first = tr.doc.nodeAt(pos);
	tr.setSelection(first && NodeSelection.isSelectable(first) && first.isAtom ? NodeSelection.create(tr.doc, pos) : Selection.near(tr.doc.resolve(pos + 1)));
	view.dispatch(tr.scrollIntoView());
	view.focus();
	return true;
}

/** A block a link became, turned back into the link alone on its line. */
export function blockToLink(view: EditorView, pos: number, url: string): boolean {
	const node = view.state.doc.nodeAt(pos);
	const { paragraph } = view.state.schema.nodes;
	const link = view.state.schema.marks.link;
	if (!node || !paragraph || !link) return false;
	const line = paragraph.create(null, view.state.schema.text(url, [link.create({ href: url, title: null })]));
	const tr = view.state.tr.replaceWith(pos, pos + node.nodeSize, line);
	tr.setSelection(TextSelection.create(tr.doc, pos + 1 + url.length));
	view.dispatch(tr.scrollIntoView());
	view.focus();
	return true;
}

let closeOpen: (() => void) | null = null;

/**
 * The menu under an address just pasted alone on its line (the paragraph at `pos`): what it may
 * become, then 保持链接 (left as it is). It takes no focus: ↑ ↓ choose, ↩ takes the one chosen (the
 * first, at first), Esc or anything else typed leaves the link, and the key goes on to the text.
 */
export function offerLinkTargets(view: EditorView, pos: number, url: string, targets: readonly LinkTarget[], parse: ParseMarkdown): void {
	closeOpen?.();
	const choices = targetsFor(url, targets);
	if (!choices.length) return;
	const paragraph = view.state.doc.nodeAt(pos);
	if (!paragraph) return;
	const items = [...choices.map((target) => ({ label: target.label, run: () => replaceBlock(view, pos, target.markdown(url), parse) })), { label: t('保持链接'), run: () => {} }];

	const root = document.createElement('div');
	root.className = 'block-menu context-menu link-paste-menu';
	root.setAttribute('role', 'menu');
	root.setAttribute('aria-label', t('粘贴的链接变成'));
	const buttons = items.map((item, index) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'block-menu-item';
		button.setAttribute('role', 'menuitem');
		button.tabIndex = -1;
		button.textContent = item.label;
		button.addEventListener('mousedown', (event) => event.preventDefault());
		button.addEventListener('click', () => choose(index));
		root.append(button);
		return button;
	});
	let active = 0;
	const mark = () => buttons.forEach((button, index) => button.classList.toggle('is-active', index === active));
	mark();
	document.body.append(root);
	const doc = view.state.doc;
	/** Under the end of the address (above it, near the bottom of the window), following the article's scroll. */
	const place = () => {
		if (view.state.doc !== doc) return;
		const end = view.coordsAtPos(Math.min(pos + paragraph.nodeSize - 1, doc.content.size));
		const left = Math.min(end.left, window.innerWidth - root.offsetWidth - 8);
		const top = end.bottom + 4 + root.offsetHeight > window.innerHeight - 8 ? Math.max(8, end.top - 4 - root.offsetHeight) : end.bottom + 4;
		root.style.left = `${Math.max(8, left)}px`;
		root.style.top = `${top}px`;
	};
	place();

	function choose(index: number): void {
		close();
		// The document as it was when offered: the paragraph is still where it was.
		if (view.state.doc === doc) items[index]!.run();
	}
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.isComposing) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			event.stopPropagation();
			active = (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
			mark();
			return;
		}
		if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
			event.preventDefault();
			event.stopPropagation();
			choose(active);
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
		}
		// Anything else: the link stays, and the key does what it does.
		if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) close();
	};
	const onPointerDown = (event: PointerEvent) => {
		if (!root.contains(event.target as Node)) close();
	};
	function close(): void {
		if (closeOpen !== close) return;
		closeOpen = null;
		root.remove();
		document.removeEventListener('keydown', onKeyDown, true);
		document.removeEventListener('pointerdown', onPointerDown, true);
		document.removeEventListener('scroll', place, true);
		window.removeEventListener('blur', close);
	}
	document.addEventListener('keydown', onKeyDown, true);
	document.addEventListener('pointerdown', onPointerDown, true);
	document.addEventListener('scroll', place, true);
	window.addEventListener('blur', close);
	closeOpen = close;
}
