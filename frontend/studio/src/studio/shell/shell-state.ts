import { createContext, useContext, useMemo } from 'react';

import { t } from '@blog/i18n/index.mjs';
import type { Conversation } from '../api/client';
import { createStore, useStore } from './store.ts';

/** What the middle shows: the article, the drive, the table of all articles, or AI 问答. */
export type View = 'editor' | 'drive' | 'table' | 'chat' | 'apps';

/** A tab of the right column: the Studio's (`ai`, `files`…) or a plugin's. */
/** A tab of the right column; `icon`, a plugin's (an SVG or a character): the Studio's own are drawn by key. */
export type SideTab = { key: string; label: string; id: string; controls: string; icon?: string };

/**
 * What the shell (the parts React draws: the left column, the bar above the editor, the right column's tabs) shows.
 * The rest of the Studio sets it (`shell.set`); the shell is drawn again from it.
 */
export type ShellState = {
	view: View;
	sidebarCollapsed: boolean;
	/** The open article's title, in the bar; its icon (an emoji; empty for none). */
	title: string;
	icon: string;
	/** What the status line says, and in which tone (top-bar.ts `saveStateText`). */
	status: { text: string; tone: string };
	/** When the open article last changed; null for none. */
	edited: number | null;
	/** The open article on the blog. */
	articleHref: string;
	/** The pages the open one is under, the nearest last: links in the bar, each with a menu of the pages under it. */
	path: Array<{ slug: string; title: string; icon?: string }>;
	/** 常用: the pages starred, shown at the top of the left column; whether the open one is. */
	favorites: Array<{ slug: string; title: string; icon?: string }>;
	favorite: boolean;
	/** How many articles there are (全部文章). */
	count: number;
	/** Whether there is a page to go back to, or forward to. */
	nav: { back: boolean; forward: boolean };
	panelOpen: boolean;
	/** The right column's tabs not lent elsewhere, in order, and the one shown. */
	tabs: SideTab[];
	tab: string;
	/** The conversations of AI 问答, the latest first (null: not read yet), and the one shown. */
	chats: Conversation[] | null;
	chat: string | null;
};

/** What the shell's buttons do: the rest of the Studio's (main.ts). */
export type ShellActions = {
	search(): void;
	showView(view: View): void;
	newPage(): void;
	newChat(): void;
	openChat(id: string): void;
	chatMenu(chat: Conversation, anchor: HTMLElement): void;
	/** A conversation dragged to before another (to the end with none); one named anew (double-click). */
	moveChat(id: string, before: string | null): void;
	renameChat(chat: Conversation): void;
	openTrash(): void;
	/** 设置: 语言, AI 模型, 插件. */
	openSettings(): void;
	pageMenu(anchor: HTMLElement): void;
	/** The page open before (or after) this one, as a browser's ‹ and ›. */
	back(): void;
	/** A page of the path in the bar opened; the pages under one, for the menu after it. */
	openPage(slug: string): void;
	pagesUnder(slug: string): Array<{ slug: string; title: string }>;
	/** ☆: the page (the open one, unless named) starred in 常用, or no longer. */
	toggleFavorite(slug?: string): void;
	forward(): void;
	chooseTab(key: string): void;
	togglePanel(): void;
	closePanel(): void;
};

/** The shell before the page's script changes it, as the server draws it. */
function initialState(): ShellState {
	return {
		view: 'editor',
		sidebarCollapsed: false,
		title: t('选择一篇文章'),
		status: { text: t('正在连接…'), tone: '' },
		edited: null,
		articleHref: '/blog',
		nav: { back: false, forward: false },
		path: [],
		favorites: [],
		favorite: false,
		count: 0,
		icon: '',
		panelOpen: true,
		tabs: [
			{ key: 'ai', label: 'AI' },
			{ key: 'files', label: t('文件') },
			{ key: 'terminal', label: t('终端') },
			{ key: 'drive', label: t('资料库') },
		].map((tab) => ({ ...tab, id: `side-tab-${tab.key}`, controls: `side-${tab.key}` })),
		tab: 'files',
		chats: null,
		chat: null,
	};
}

/** The shell's state: read, changed (what is given, the rest as it was), and followed. */
export const shell = createStore(initialState());

/** The shell's state, drawn again when it changes. */
export function useShell(): ShellState {
	return useStore(shell, useMemo(initialState, []));
}

const nothing = () => {};
/** Drawn by the server (StudioPage.astro), the buttons do nothing until the page's script draws the shell itself. */
export const ActionsContext = createContext<ShellActions>({
	search: nothing,
	showView: nothing,
	newPage: nothing,
	newChat: nothing,
	openChat: nothing,
	chatMenu: nothing,
	moveChat: nothing,
	renameChat: nothing,
	openTrash: nothing,
	openSettings: nothing,
	pageMenu: nothing,
	back: nothing,
	openPage: nothing,
	toggleFavorite: nothing,
	pagesUnder: () => [],
	forward: nothing,
	chooseTab: nothing,
	togglePanel: nothing,
	closePanel: nothing,
});

export const useActions = (): ShellActions => useContext(ActionsContext);
