import { createContext, useContext, useMemo } from 'react';

import { t } from '@blog/i18n/index.mjs';
import type { Conversation } from '../api/client';
import { createStore, useStore } from './store.ts';

/** What the middle shows: the article, the drive, the table of all articles, or AI 问答. */
export type View = 'editor' | 'drive' | 'table' | 'chat';

/** A tab of the right column: the Studio's (`ai`, `files`…) or a plugin's. */
export type SideTab = { key: string; label: string; id: string; controls: string };

/**
 * What the shell (the parts React draws: the left column, the bar above the editor, the right column's tabs) shows.
 * The rest of the Studio sets it (`shell.set`); the shell is drawn again from it.
 */
export type ShellState = {
	view: View;
	sidebarCollapsed: boolean;
	/** The open article's title, in the bar. */
	title: string;
	/** What the status line says, and in which tone (top-bar.ts `saveStateText`). */
	status: { text: string; tone: string };
	/** When the open article last changed; null for none. */
	edited: number | null;
	/** The open article on the blog. */
	articleHref: string;
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
	openTrash(): void;
	openPlugins(): void;
	openAiSettings(): void;
	openLocale(): void;
	pageMenu(anchor: HTMLElement): void;
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
	openTrash: nothing,
	openPlugins: nothing,
	openAiSettings: nothing,
	openLocale: nothing,
	pageMenu: nothing,
	chooseTab: nothing,
	togglePanel: nothing,
	closePanel: nothing,
});

export const useActions = (): ShellActions => useContext(ActionsContext);
