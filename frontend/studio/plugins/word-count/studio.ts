import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/studio.ts';
import type {} from '@blog/kernel/ui.ts';

import { countMarkdown, statsLine, type Stats } from './count.ts';

/**
 * The Studio: 字数统计, a tab in the right column that counts the open
 * article (Chinese characters, English words, reading time, headings,
 * formulas, images, code blocks) and keeps count while it is typed in or
 * another article is opened (`studio/source-changed`), while it is on
 * screen; and a command that types the count in where the caret is. The
 * counting itself is count.ts.
 */
export const name = 'word-count';
export const description = '字数统计：右栏一个页签，随着打字实时数中文字、英文词、阅读时间，以及标题、公式、图片、代码块；还能把统计写成一行插进正文。';
export const inject = ['studio', 'panels', 'commands', 'styles'];

const STYLE = `
.word-count { display: flex; flex-direction: column; gap: 14px; padding: 14px 16px; color: rgb(var(--gray-dark)); }
.word-count-title { margin: 0; font-size: 12px; color: rgb(var(--gray)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.word-count-main { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.word-count-card { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid rgb(var(--gray-light)); border-radius: 8px; background: var(--surface-soft); }
.word-count-card strong { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.word-count-card span { font-size: 12px; color: rgb(var(--gray)); }
.word-count-list { margin: 0; display: grid; grid-template-columns: 1fr auto; row-gap: 6px; font-size: 14px; }
.word-count-list dt { color: rgb(var(--gray)); }
.word-count-list dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.word-count-list dd small { margin-left: 6px; color: rgb(var(--gray)); font-size: 12px; }
.word-count-empty { margin: 0; font-size: 14px; color: rgb(var(--gray)); }
`;

const number = (value: number): string => value.toLocaleString('en-US');

/** The tab's content for these counts, in the order it is read. */
function render(pane: HTMLElement, title: string, stats: Stats): void {
	const card = (value: string, label: string): HTMLElement => {
		const box = document.createElement('div');
		box.className = 'word-count-card';
		const strong = document.createElement('strong');
		strong.textContent = value;
		const text = document.createElement('span');
		text.textContent = label;
		box.append(strong, text);
		return box;
	};
	const heading = document.createElement('p');
	heading.className = 'word-count-title';
	heading.textContent = title;
	const main = document.createElement('div');
	main.className = 'word-count-main';
	main.dataset.stat = 'main';
	main.append(
		card(number(stats.chinese), '中文字'),
		card(number(stats.english), '英文词'),
		card(stats.minutes ? `${stats.minutes} 分钟` : '—', '阅读时间'),
	);
	const list = document.createElement('dl');
	list.className = 'word-count-list';
	const rows: Array<[string, string, keyof Stats]> = [
		['标题', '', 'headings'],
		['行间公式', '', 'formulas'],
		['图片', '', 'images'],
		['代码块', stats.jobBlocks ? `其中计算块 ${stats.jobBlocks}` : '', 'codeBlocks'],
	];
	for (const [label, note, key] of rows) {
		const term = document.createElement('dt');
		term.textContent = label;
		const value = document.createElement('dd');
		value.dataset.stat = key;
		value.textContent = number(stats[key]);
		if (note) {
			const small = document.createElement('small');
			small.textContent = note;
			value.append(small);
		}
		list.append(term, value);
	}
	pane.replaceChildren(heading, main, list);
}

export function apply(ctx: Context): void {
	ctx.styles.add(STYLE);
	/** Tells the tab, once drawn, whether it is on screen. */
	let screen: (onScreen: boolean) => void = () => {};

	/** The count of the open article now; null when none is open. */
	const current = (): { slug: string; stats: Stats } | null => {
		const slug = ctx.studio.slug();
		const source = ctx.studio.source();
		return slug !== null && source !== null ? { slug, stats: countMarkdown(source) } : null;
	};

	ctx.panels.register({
		key: 'word-count',
		label: '字数',
		draw(pane) {
			const root = document.createElement('div');
			root.className = 'word-count';
			pane.append(root);
			// Counted again when the article's file changes while the tab is on screen, and when it comes on screen after a change.
			let onScreen = false;
			let stale = true;
			const update = () => {
				if (!onScreen || !stale) return;
				stale = false;
				const article = ctx.studio.article();
				const source = ctx.studio.source();
				if (!article || source === null) {
					const empty = document.createElement('p');
					empty.className = 'word-count-empty';
					empty.textContent = '还没有打开文章。';
					root.replaceChildren(empty);
					return;
				}
				render(root, article.title, countMarkdown(source));
			};
			const changed = () => {
				stale = true;
				update();
			};
			const stop = [ctx.on('studio/source-changed', changed), ctx.on('studio/article-opened', changed)];
			screen = (now) => {
				onScreen = now;
				update();
			};
			return () => {
				for (const off of stop) off();
				screen = () => {};
				root.remove();
			};
		},
		shown: () => screen(true),
		hidden: () => screen(false),
	});

	ctx.commands.register({
		id: 'word-count.open',
		label: '字数统计',
		icon: '#',
		places: ['sidebar'],
		run: () => ctx.studio.showPanel('word-count'),
	});

	ctx.commands.register({
		id: 'word-count.insert',
		label: '插入字数统计',
		icon: '#',
		keys: 'Mod-Alt-w',
		keywords: ['wordcount', 'zishu', 'tongji', '字数'],
		places: ['slash', 'page-menu'],
		run() {
			const now = current();
			if (!now) throw new Error('还没有打开文章');
			ctx.studio.editor.insertText(statsLine(now.stats));
		},
	});
}
