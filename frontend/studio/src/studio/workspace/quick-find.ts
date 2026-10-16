import { searchArticles } from '../api/client.ts';
import type { ArticleSummary, SearchResult } from '../types.ts';
import { filterArticles } from './article-list.ts';

/** What the quick find needs from the Studio around it. */
export type QuickFindHost = {
	/** The articles, to offer before anything is typed and to match titles at once. */
	articles(): ArticleSummary[];
	/** Opens an article; `text` is what was searched for, to show where it is. */
	open(slug: string, text?: string): void;
};

type Row = { slug: string; title: string; icon: string; snippet?: string; text?: string };

/** `text` with each `needle` in it marked. */
function marked(text: string, needle: string): Node[] {
	const nodes: Node[] = [];
	const lower = text.toLocaleLowerCase('zh-CN');
	const wanted = needle.toLocaleLowerCase('zh-CN');
	let at = 0;
	for (let found = lower.indexOf(wanted); wanted && found !== -1; found = lower.indexOf(wanted, at)) {
		nodes.push(document.createTextNode(text.slice(at, found)));
		const mark = document.createElement('mark');
		mark.textContent = text.slice(found, found + wanted.length);
		nodes.push(mark);
		at = found + wanted.length;
	}
	nodes.push(document.createTextNode(text.slice(at)));
	return nodes;
}

/** The part of a long line around what was found. */
function around(text: string, needle: string): string {
	const found = text.toLocaleLowerCase('zh-CN').indexOf(needle.toLocaleLowerCase('zh-CN'));
	if (found < 40) return text;
	return `…${text.slice(found - 30)}`;
}

/**
 * ⌘K: find an article by its title or its text, as Notion's search does.
 * Titles match as they are typed; the text is asked of the server a moment later.
 */
export function createQuickFind(dialog: HTMLDialogElement, host: QuickFindHost) {
	const input = dialog.querySelector<HTMLInputElement>('#quick-find-input')!;
	const list = dialog.querySelector<HTMLElement>('#quick-find-results')!;
	let rows: Row[] = [];
	let index = 0;
	let timer = 0;
	let asking: AbortController | null = null;
	/** While an article is asked for (`pick`): who gets it. */
	let picking: ((slug: string | null) => void) | null = null;

	function draw(): void {
		const query = input.value.trim();
		list.replaceChildren(...rows.map((row, at) => {
			const item = document.createElement('li');
			item.className = `quick-find-item${at === index ? ' is-selected' : ''}`;
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', String(at === index));
			const icon = document.createElement('span');
			icon.className = 'quick-find-icon';
			icon.textContent = row.icon || '▤';
			const words = document.createElement('span');
			words.className = 'quick-find-words';
			const title = document.createElement('span');
			title.className = 'quick-find-title';
			title.append(...marked(row.title, query));
			words.append(title);
			if (row.snippet) {
				const snippet = document.createElement('span');
				snippet.className = 'quick-find-snippet';
				snippet.append(...marked(row.snippet, query));
				words.append(snippet);
			}
			item.append(icon, words);
			item.addEventListener('mousemove', () => {
				if (index === at) return;
				index = at;
				draw();
			});
			item.addEventListener('click', () => choose(at));
			return item;
		}));
		if (!rows.length) {
			const empty = document.createElement('li');
			empty.className = 'quick-find-empty';
			empty.textContent = query ? '没有找到' : '还没有文章';
			list.append(empty);
		}
		list.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
	}

	/** Titles at once, as typed. */
	function titles(query: string): Row[] {
		return filterArticles(host.articles(), query).map((article) => ({ slug: article.slug, title: article.title, icon: article.icon ?? '' }));
	}

	function update(): void {
		const query = input.value.trim();
		rows = titles(query);
		index = 0;
		draw();
		window.clearTimeout(timer);
		asking?.abort();
		if (!query) return;
		timer = window.setTimeout(() => {
			const controller = new AbortController();
			asking = controller;
			searchArticles(query, controller.signal).then((results: SearchResult[]) => {
				if (controller.signal.aborted || input.value.trim() !== query) return;
				const seen = new Set(rows.map((row) => row.slug));
				const selected = rows[index]?.slug;
				// The titles stay first; each article whose text holds it follows, with the first line it is on.
				for (const result of results) {
					const line = result.matches[0];
					const existing = rows.find((row) => row.slug === result.slug);
					if (existing && line && !existing.snippet) {
						existing.snippet = around(line.text, query);
						existing.text = query;
					}
					if (seen.has(result.slug)) continue;
					seen.add(result.slug);
					rows.push({ slug: result.slug, title: result.title, icon: result.icon, snippet: line ? around(line.text, query) : undefined, text: line ? query : undefined });
				}
				index = Math.max(0, rows.findIndex((row) => row.slug === selected));
				draw();
			}, () => {});
		}, 120);
	}

	function choose(at: number): void {
		const row = rows[at];
		if (!row) return;
		const answer = picking;
		picking = null;
		dialog.close();
		if (answer) answer(row.slug);
		else host.open(row.slug, row.text);
	}

	input.addEventListener('input', update);
	input.addEventListener('keydown', (event) => {
		if (event.isComposing) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!rows.length) return;
			index = (index + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
			draw();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			choose(index);
		}
	});
	// Closed without a choice: nothing was picked.
	dialog.addEventListener('close', () => {
		const answer = picking;
		picking = null;
		answer?.(null);
	});
	dialog.addEventListener('click', (event) => {
		// A click on the backdrop closes it.
		if (event.target === dialog) dialog.close();
	});

	function show(placeholder: string): void {
		input.placeholder = placeholder;
		input.value = '';
		update();
		dialog.showModal();
		input.focus();
	}

	return {
		open(): void {
			if (dialog.open) {
				input.select();
				return;
			}
			show('搜索标题和正文…');
		},
		/** Asks which article: its slug, or null when given up. */
		pick(): Promise<string | null> {
			if (dialog.open) dialog.close();
			return new Promise((resolve) => {
				picking = resolve;
				show('链接到哪篇文章…');
			});
		},
	};
}
