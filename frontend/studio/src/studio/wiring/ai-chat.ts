// The AI tab (a coding agent doing what it is asked, by itself, shown as it goes) and AI 问答, as Notion's: the AI tab's
// panel itself, moved whole into the middle, the conversations listed in the left column in place of the pages; back
// in the side when an article is shown again. What the AI changes in the article open is held while it works.
import { AppWindow, Maximize2, PanelRight, PictureInPicture2 } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { floatingBox } from '../ai/ai-float';
import { createAiPanel } from '../ai/ai-panel';
import { showContextMenu } from '../common/context-menu';
import { showToast } from '../common/toast';
import { sourceLinesOf } from '@blog/document/source-lines.ts';
import { createChatList } from '../shell/chat-list';
import type { ArticleSummary } from '../types';
import type { Studio } from './studio';
import type { answerWindows } from '../windows/studio-line';

export function createAiChat(studio: Studio, { withArticlePictures }: { withArticlePictures(markdown: string): Promise<string> }) {
	// Made before the parts it reaches (the right column asks at once whether its tab is shown): each read when used.
	const { shell } = studio;

	/** The changes on disk to the article open while the AI worked (its files), to be looked over once it is done. */
	let heldChanges: { slug: string; paths: Set<string> } | null = null;

	let aiArticles: { from: ArticleSummary[] | null; named: ArticleSummary[] } = { from: null, named: [] };
	const aiPane = shell.querySelector<HTMLElement>('#side-ai')!;
	/** What the AI is told of the article open: here, and in a window of its own (answerWindow). */
	const article = () => (studio.session.slug ? { slug: studio.session.slug, title: studio.title() } : null);
	const hasSelection = () => Boolean(studio.session.slug) && studio.editor.hasSelection();
	async function selection() {
		const marked = studio.session.slug && studio.editor.hasSelection() ? studio.editor.markSelection() : null;
		if (!marked || !(await studio.session.flush())) return null;
		return sourceLinesOf(studio.session.current.source, marked);
	}
	function insert(markdown: string): boolean {
		if (!studio.session.slug) return false;
		// Its pictures copied into the article first, so that they show there.
		withArticlePictures(markdown).then(
			(taken) => studio.editor.insertMarkdown(taken),
			(error: unknown) => showToast(error instanceof Error ? error.message : t('没能放进来'), true),
		);
		return true;
	}
	function runInTerminal(command: string): void {
		studio.sidePanel.show('terminal');
		studio.terminal.run(command);
	}
	const aiPanel = createAiPanel(aiPane, {
		article,
		articles() {
			// The same list while the pages are (the panel's links drawn again only when they change).
			const listed = studio.articleList.articles();
			if (aiArticles.from !== listed) aiArticles = { from: listed, named: listed.map((entry) => ({ ...entry, title: entry.title || entry.slug })) };
			return aiArticles.named;
		},
		openArticle(slug) {
			studio.showView('editor');
			void studio.session.open(slug);
		},
		hasSelection,
		selection,
		toast: (message) => showToast(message),
		runInTerminal,
		insert,
		// ⤢ / ⤡: the panel whole in the middle (AI 问答), or back where it was (in the side, or floating).
		openWhole: () => studio.showView('chat'),
		closeWhole: () => studio.showView('editor'),
		// 显示方式, as Notion's: in the side, floating over the Studio, or whole (全屏, AI 问答).
		layout(anchor, { full, whole }) {
			const mark = (on: boolean) => (on ? '✓' : undefined);
			showContextMenu(
				[
					{ label: t('侧栏'), icon: PanelRight, hint: mark(!full && mode === 'side'), action: () => setMode('side') },
					{ label: t('悬浮'), icon: PictureInPicture2, hint: mark(!full && mode === 'float'), action: () => setMode('float') },
					'separator',
					{ label: t('全屏'), icon: Maximize2, hint: mark(full), action: () => !full && whole() },
					'separator',
					{ label: t('新窗口'), icon: AppWindow, action: () => void popOut() },
				],
				anchor,
			);
		},
		followed(id) {
			chatList.select(id);
			void chatList.refresh();
			if (shell.dataset.view === 'chat') showChatAddress(id);
		},
		changed: () => void chatList.refresh(),
		// What it changed in the article open, held while it worked: looked over now, all at once.
		turnOver() {
			const held = heldChanges;
			heldChanges = null;
			if (held && held.slug === studio.session.slug) studio.session.changedOnDisk([...held.paths]);
		},
	});
	const aiPaneHome = { parent: aiPane.parentElement!, next: aiPane.nextSibling };

	/** Where the panel is when not whole in the middle: in the right column, or floating over the Studio. Kept. */
	type Mode = 'side' | 'float';
	const MODE = 'studio.ai.mode';
	let mode: Mode = 'side';
	try {
		if (localStorage.getItem(MODE) === 'float') mode = 'float';
	} catch {
		// Not kept: in the side.
	}
	const floatBox = shell.querySelector<HTMLElement>('#ai-float')!;
	const floating = floatingBox(floatBox, () => aiPane.querySelector<HTMLElement>('.ai-toolbar'));

	/** The AI is in a window of its own (新窗口): not shown here meanwhile; back where it was once that window shuts. */
	let inWindow = false;
	let windows: ReturnType<typeof answerWindows> | null = null;
	let windowOpened: (kind: string) => Promise<boolean> = async () => false;

	function hideHere(): void {
		floatBox.hidden = true;
		aiPane.classList.remove('is-floating');
		aiPanel.setFloating(false);
		studio.sidePanel.lend('ai', true);
		aiPane.hidden = true;
	}

	/** 新窗口: the AI in a window of the computer's own (beside the editor, on another screen), with this conversation. */
	async function popOut(): Promise<void> {
		const opening = windowOpened('ai');
		window.open('/studio/window?ai=1&w=460&h=780&title=AI', 'studio-ai', 'popup,width=460,height=780');
		if (!(await opening)) return showToast(t('没能打开新窗口（浏览器拦下了弹出窗口？）'), true);
		inWindow = true;
		if (shell.dataset.view === 'chat') studio.showView('editor');
		else hideHere();
	}

	/** The panel put where its mode says (not while whole in the middle): its tab lent by the right column when it floats. */
	function home(): void {
		if (inWindow) return hideHere();
		if (mode === 'float') {
			if (aiPane.parentElement !== floatBox) floatBox.prepend(aiPane);
			aiPane.hidden = false;
			aiPane.classList.add('is-floating');
			aiPanel.setFloating(true);
			floating.place();
			floatBox.hidden = false;
			studio.sidePanel.lend('ai', true);
		} else {
			floatBox.hidden = true;
			aiPane.classList.remove('is-floating');
			aiPanel.setFloating(false);
			if (aiPane.parentElement !== aiPaneHome.parent) aiPaneHome.parent.insertBefore(aiPane, aiPaneHome.next);
			studio.sidePanel.lend('ai', false);
		}
	}

	function setMode(next: Mode): void {
		mode = next;
		try {
			localStorage.setItem(MODE, next);
		} catch {
			// Not kept: this time only.
		}
		// Whole in the middle: back to the article, where it goes as asked.
		if (shell.dataset.view === 'chat') studio.showView('editor');
		else home();
		if (next === 'side') studio.sidePanel.show('ai');
		aiPanel.focus();
	}

	/** The AI panel shown where it is (asked for by a 小程序, a command): its tab, or the floating box as it is. */
	function showAi(): void {
		if (inWindow) return;
		if (mode === 'side' || shell.dataset.view === 'chat') studio.sidePanel.show('ai');
		else home();
	}

	/** What the AI in a window of its own asks (windows/window-main.ts): what it is told here, and to come back. */
	async function answerWindow(method: string, args: unknown[]): Promise<unknown> {
		switch (method) {
			case 'ai.state':
				return { article: article(), hasSelection: hasSelection(), articles: aiPanelArticles(), conversation: aiPanel.current() };
			case 'ai.selection':
				return selection();
			case 'ai.insert':
				return insert(String(args[0] ?? ''));
			case 'ai.openArticle':
				studio.showView('editor');
				await studio.session.open(String(args[0] ?? ''));
				return true;
			case 'ai.runInTerminal':
				runInTerminal(String(args[0] ?? ''));
				return true;
			case 'ai.dock': {
				inWindow = false;
				const [where, conversation] = args;
				if (typeof conversation === 'string' && conversation) await aiPanel.open(conversation);
				if (where === 'full') studio.showView('chat');
				else setMode(where === 'float' ? 'float' : 'side');
				return true;
			}
			default:
				throw new Error(t('Studio 不认识 {method}', { method }));
		}
	}

	/** The articles as the AI is told them (the same list while the pages are). */
	function aiPanelArticles() {
		const listed = studio.articleList.articles();
		if (aiArticles.from !== listed) aiArticles = { from: listed, named: listed.map((entry) => ({ ...entry, title: entry.title || entry.slug })) };
		return aiArticles.named;
	}
	const chatView = shell.querySelector<HTMLElement>('#chat-view')!;
	const chatList = createChatList({
		removed(id) {
			if (aiPanel.current() === id) void openLatestChat();
		},
		renamed: (id, title) => aiPanel.renamed(id, title),
		toast: (message) => showToast(message),
	});
	void chatList.refresh();

	/** The conversation shown in the address (?chat=…), to be shown again on reload. */
	function showChatAddress(id: string | null): void {
		const url = new URL(window.location.href);
		if (id) url.searchParams.set('chat', id);
		else url.searchParams.delete('chat');
		history.replaceState(null, '', url);
	}

	/** AI 问答 with the conversation `id`. */
	function openChat(id: string): void {
		studio.showView('chat');
		void aiPanel.open(id).then(() => aiPanel.focus());
	}

	/** AI 问答 with a new conversation (listed and in the address once begun: `followed`). */
	function newChat(): void {
		studio.showView('chat');
		void aiPanel.newChat();
		aiPanel.focus();
	}

	/**
	 * The AI panel whole in the middle (AI 问答), moved there from the side and lent by it, or back where it was; the
	 * left column lists the conversations meanwhile.
	 */
	function showChat(on: boolean): void {
		const there = chatView.contains(aiPane);
		chatView.hidden = !on;
		if (on && !there) {
			floatBox.hidden = true;
			aiPane.classList.remove('is-floating');
			aiPanel.setFloating(false);
			chatView.append(aiPane);
			studio.sidePanel.lend('ai', true);
			aiPanel.setFull(true);
		} else if (!on && there) {
			aiPanel.setFull(false);
			home();
		}
		const shown = on ? aiPanel.current() : null;
		chatList.select(shown);
		showChatAddress(shown);
		if (on) void chatList.refresh();
	}

	/** AI 问答 with the conversation spoken in last; a new one when there is none. */
	async function openLatestChat(): Promise<void> {
		const latest = await chatList.latest();
		if (latest) openChat(latest);
		else newChat();
	}

	/**
	 * A change on disk to the article open, while the AI is at work writing it bit by bit: held, to be looked over once
	 * its turn is over (turnOver), not at each bit. Whether it was held.
	 */
	function hold(change: { slug: string; paths: string[] }): boolean {
		if (!aiPanel.working() || !studio.session.slug) return false;
		if (!heldChanges || heldChanges.slug !== studio.session.slug) {
			heldChanges = { slug: studio.session.slug, paths: new Set() };
			showToast(t('AI 在改这篇文章，做完后一起给你过目'));
		}
		for (const path of change.paths) heldChanges.paths.add(path);
		return true;
	}

	return {
		aiPanel,
		chatList,
		openChat,
		newChat,
		showChat,
		hold,
		showAi,
		answerWindow,
		/** The line to the windows of their own: the AI's window shut, the AI is back here where it was. */
		windows(line: ReturnType<typeof answerWindows>, opened: (kind: string) => Promise<boolean>): void {
			windows = line;
			windowOpened = opened;
			line.heard(({ what, kind }) => {
				if (kind !== 'ai' || what !== 'bye' || !inWindow) return;
				inWindow = false;
				if (shell.dataset.view !== 'chat') home();
			});
		},
		/** Where it was left (floating), once the right column is there to lend its tab. */
		restoreLayout: () => mode === 'float' && shell.dataset.view !== 'chat' && home(),
	};
}
