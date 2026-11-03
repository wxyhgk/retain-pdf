import { t } from '@blog/i18n/index.mjs';
import type { SaveState } from '../state/article-session.ts';
import { articleAddress } from '@blog/markdown/articles/rules.mjs';
import { shell } from './shell-state.ts';

/** What the status line says, and the colour it says it in. */
export function saveStateText(state: SaveState): { text: string; tone: 'saved' | 'dirty' | 'saving' | 'error' | '' } {
	switch (state.kind) {
		case 'loading': return { text: t('正在载入…'), tone: '' };
		case 'loaded': return { text: t('已载入'), tone: 'saved' };
		case 'dirty': return { text: t('未保存'), tone: 'dirty' };
		case 'saving': return { text: t('正在保存…'), tone: 'saving' };
		case 'saved': return { text: t('已保存'), tone: 'saved' };
		case 'reviewing': return { text: t('改动待审阅'), tone: 'dirty' };
		case 'conflict': return { text: t('页面在磁盘上被修改，暂停自动保存'), tone: 'error' };
		case 'failed': return { text: t('{message}，稍后自动重试', { message: state.message }), tone: 'error' };
		case 'unshown': return { text: state.message, tone: 'error' };
	}
}

/**
 * The bar above the editor (the shell draws it: shell/TopBar.tsx; this says what it shows) and the line over the body
 * (the file, and whether its Markdown is kept as written).
 */
export function createTopBar(shellElement: HTMLElement) {
	const path = shellElement.querySelector<HTMLElement>('#editor-path')!;
	const roundtrip = shellElement.querySelector<HTMLElement>('#roundtrip-status')!;

	return {
		/** The open article. */
		showArticle(slug: string, articleTitle: string, kind: 'post' | 'wiki' = 'post'): void {
			path.textContent = `blog/${slug}/index.md`;
			shell.set({ title: articleTitle, articleHref: articleAddress(kind, slug) });
		},
		/** When the open article's text last changed (now, after a save); null for none. */
		edited(time: number | null): void {
			shell.set({ edited: time });
		},
		showTitle(articleTitle: string): void {
			shell.set({ title: articleTitle });
		},
		/** No article to open yet. */
		showEmpty(): void {
			shell.set({ status: { text: t('还没有页面'), tone: '' }, title: t('空工作区') });
			path.textContent = t('创建第一个页面后即可开始写作');
		},
		saveState(state: SaveState): void {
			shell.set({ status: saveStateText(state) });
		},
		/** Something went wrong outside saving, such as reaching the Studio at all. */
		error(message: string): void {
			shell.set({ status: { text: message, tone: 'error' } });
		},
		roundtrip(exact: boolean): void {
			roundtrip.textContent = exact ? t('Markdown 完整保留') : t('Markdown 已规范化');
			roundtrip.dataset.state = exact ? 'exact' : 'changed';
		},
	};
}
