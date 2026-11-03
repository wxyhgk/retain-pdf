import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, PluginKey, type EditorState } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import { t } from '@blog/i18n/index.mjs';

/**
 * ⌘F in the article (as SiYuan's and a browser's): the words found marked, one of them the current one, gone to with
 * ↩ and ⇧↩; one or all of them put other words in. Not in code or formulas: there a word changed breaks something
 * (and a code block has its own ⌘F). What is not drawn yet of a long article is found once it is.
 */
type Match = { from: number; to: number };
type Find = { query: string; caseSensitive: boolean; current: number; matches: Match[]; marks: DecorationSet };
type Asked = Partial<Pick<Find, 'query' | 'caseSensitive' | 'current'>>;

export const findKey = new PluginKey<Find>('find-in-article');

const nothing = (state: EditorState): Find => ({ query: '', caseSensitive: false, current: 0, matches: [], marks: DecorationSet.create(state.doc, []) });

/** Not looked in: code, formulas (their words are not the article's words). */
const skipped = (node: ProseNode) => Boolean(node.type.spec.code) || node.type.name.includes('math');

/** Where `query` is in the text of `doc`, a run of text at a time (an inline formula, a break end one). */
export function matchesIn(doc: ProseNode, query: string, caseSensitive: boolean): Match[] {
	if (!query) return [];
	const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), caseSensitive ? 'gu' : 'giu');
	const found: Match[] = [];
	doc.descendants((node, pos) => {
		if (skipped(node)) return false;
		if (!node.isTextblock) return true;
		let run = '';
		let start = -1;
		const look = () => {
			for (const match of run.matchAll(pattern)) found.push({ from: start + match.index, to: start + match.index + match[0].length });
			run = '';
			start = -1;
		};
		node.forEach((child, offset) => {
			if (child.isText && !skipped(child)) {
				if (start < 0) start = pos + 1 + offset;
				run += child.text;
			} else look();
		});
		look();
		return false;
	});
	return found;
}

function marked(state: EditorState, matches: Match[], current: number): DecorationSet {
	return DecorationSet.create(
		state.doc,
		matches.map((match, index) => Decoration.inline(match.from, match.to, { class: index === current ? 'pm-find-match is-current' : 'pm-find-match' })),
	);
}

export function findPlugins(): MilkdownPlugin[] {
	return [
		$prose(
			() =>
				new Plugin<Find>({
					key: findKey,
					state: {
						init: (_, state) => nothing(state),
						apply(tr, find, _before, state) {
							const asked = tr.getMeta(findKey) as Asked | undefined;
							if (!asked && !(tr.docChanged && find.query)) return find;
							const next = { ...find, ...asked };
							const matches = next.query ? matchesIn(state.doc, next.query, next.caseSensitive) : [];
							const current = matches.length ? Math.min(Math.max(next.current, 0), matches.length - 1) : 0;
							return { ...next, matches, current, marks: marked(state, matches, current) };
						},
					},
					props: { decorations: (state) => findKey.getState(state)?.marks },
				}),
		),
	];
}

/** The find bar, over the editor's top right: what it looks for, how many there are, the current one, what to put in. */
export function createFindBar(host: { panel: HTMLElement; scroller: HTMLElement; view(): EditorView | null; findEverywhere(words: string): void }) {
	const bar = document.createElement('div');
	bar.className = 'find-bar';
	bar.hidden = true;
	bar.setAttribute('role', 'search');
	const field = (id: string, placeholder: string) => Object.assign(document.createElement('input'), { id, placeholder, type: 'text', spellcheck: false });
	const button = (label: string, title: string, run: () => void) => {
		const element = document.createElement('button');
		element.type = 'button';
		element.textContent = label;
		element.title = title;
		element.setAttribute('aria-label', title);
		element.addEventListener('click', run);
		return element;
	};
	const query = field('find-query', t('在这篇里查找'));
	const count = document.createElement('span');
	count.className = 'find-count';
	const replacement = field('find-replacement', t('替换为'));
	const caseButton = button('Aa', t('区分大小写'), () => {
		caseButton.toggleAttribute('aria-pressed', !caseButton.hasAttribute('aria-pressed'));
		ask({ caseSensitive: caseButton.hasAttribute('aria-pressed'), current: 0 });
	});
	const replaceRow = document.createElement('div');
	replaceRow.className = 'find-row';
	replaceRow.append(
		replacement,
		button(t('替换'), t('替换这一处'), () => replaceOne()),
		button(t('全部替换'), t('替换这篇里的每一处'), () => replaceAll()),
	);
	const findRow = document.createElement('div');
	findRow.className = 'find-row';
	findRow.append(
		query,
		count,
		caseButton,
		button('↑', t('上一处（⇧↩）'), () => go(-1)),
		button('↓', t('下一处（↩）'), () => go(1)),
		button('⋯', t('在全部页面里查找替换（⌘⇧F）'), () => host.findEverywhere(query.value)),
		button('×', t('关闭（Esc）'), () => close()),
	);
	bar.append(findRow, replaceRow);
	host.panel.append(bar);

	const state = () => {
		const view = host.view();
		return view ? (findKey.getState(view.state) ?? null) : null;
	};
	function ask(asked: Asked): void {
		const view = host.view();
		if (!view) return;
		view.dispatch(view.state.tr.setMeta(findKey, asked).setMeta('addToHistory', false));
		show();
	}
	function show(): void {
		const find = state();
		const total = find?.matches.length ?? 0;
		count.textContent = !query.value ? '' : total ? `${(find?.current ?? 0) + 1}/${total}` : t('没有');
		bar.classList.toggle('is-empty', Boolean(query.value) && !total);
		const match = find?.matches[find.current];
		const view = host.view();
		if (!match || !view) return;
		// The current one in sight, in the middle of the editor.
		const top = view.coordsAtPos(match.from).top;
		const box = host.scroller.getBoundingClientRect();
		if (top < box.top + 60 || top > box.bottom - 60) host.scroller.scrollTop += top - box.top - box.height / 2;
	}
	function go(by: number): void {
		const find = state();
		if (!find?.matches.length) return;
		ask({ current: (find.current + by + find.matches.length) % find.matches.length });
	}
	function replaceOne(): void {
		const view = host.view();
		const find = state();
		const match = find?.matches[find.current];
		if (!view || !match) return;
		view.dispatch(view.state.tr.insertText(replacement.value, match.from, match.to));
		show();
	}
	function replaceAll(): void {
		const view = host.view();
		const find = state();
		if (!view || !find?.matches.length) return;
		let tr = view.state.tr;
		for (const match of [...find.matches].reverse()) tr = tr.insertText(replacement.value, match.from, match.to);
		view.dispatch(tr);
		show();
	}
	function close(): void {
		bar.hidden = true;
		ask({ query: '' });
		host.view()?.focus();
	}

	query.addEventListener('input', () => ask({ query: query.value, current: 0 }));
	// Esc closes it wherever the keys are (WebKit leaves them on the page after a click on one of its buttons), but in a
	// dialog's own; heard first, before the editor takes Esc to select a block.
	window.addEventListener(
		'keydown',
		(event) => {
			if (bar.hidden || event.key !== 'Escape' || event.isComposing || event.defaultPrevented) return;
			if ((event.target as Element | null)?.closest?.('dialog, [role="dialog"]')) return;
			event.preventDefault();
			event.stopPropagation();
			close();
		},
		true,
	);
	bar.addEventListener('keydown', (event) => {
		if (event.isComposing) return;
		if (event.key === 'Enter' && event.target === query) {
			event.preventDefault();
			go(event.shiftKey ? -1 : 1);
		} else if (event.key === 'Enter' && event.target === replacement) {
			event.preventDefault();
			replaceOne();
		}
	});

	return {
		/** Opened (the words selected in the article to look for, if some are), its field taking the keys. */
		open(): void {
			const view = host.view();
			const selected = view && !view.state.selection.empty ? view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, ' ') : '';
			if (selected && !selected.includes('\n') && selected.length < 200) query.value = selected;
			bar.hidden = false;
			query.focus();
			query.select();
			ask({ query: query.value });
		},
		close,
		isOpen: () => !bar.hidden,
		/** Another article shown (or this one anew): its places found. */
		refresh(): void {
			if (!bar.hidden && query.value) ask({ query: query.value, current: 0 });
		},
	};
}
