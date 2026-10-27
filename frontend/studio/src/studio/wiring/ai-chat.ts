// The AI tab (a coding agent doing what it is asked, by itself, shown as it goes) and AI 问答, as Notion's: the AI tab's
// panel itself, moved whole into the middle, the conversations listed in the left column in place of the pages; back
// in the side when an article is shown again. What the AI changes in the article open is held while it works.
import { t } from '@blog/i18n/index.mjs';
import { createAiPanel } from '../ai/ai-panel';
import { showToast } from '../common/toast';
import { sourceLinesOf } from '@blog/document/source-lines.ts';
import { createChatList } from '../shell/chat-list';
import type { ArticleSummary } from '../types';
import type { Studio } from './studio';

export function createAiChat(studio: Studio, { withArticlePictures }: { withArticlePictures(markdown: string): Promise<string> }) {
	// Made before the parts it reaches (the right column asks at once whether its tab is shown): each read when used.
	const { shell } = studio;

	/** The changes on disk to the article open while the AI worked (its files), to be looked over once it is done. */
	let heldChanges: { slug: string; paths: Set<string> } | null = null;

	let aiArticles: { from: ArticleSummary[] | null; named: ArticleSummary[] } = { from: null, named: [] };
	const aiPane = shell.querySelector<HTMLElement>('#side-ai')!;
	const aiPanel = createAiPanel(aiPane, {
		article: () => (studio.session.slug ? { slug: studio.session.slug, title: studio.title() } : null),
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
		hasSelection: () => Boolean(studio.session.slug) && studio.editor.hasSelection(),
		async selection() {
			const marked = studio.session.slug && studio.editor.hasSelection() ? studio.editor.markSelection() : null;
			if (!marked || !(await studio.session.flush())) return null;
			return sourceLinesOf(studio.session.current.source, marked);
		},
		toast: (message) => showToast(message),
		runInTerminal(command) {
			studio.sidePanel.show('terminal');
			studio.terminal.run(command);
		},
		insert(markdown) {
			if (!studio.session.slug) return false;
			// Its pictures copied into the article first, so that they show there.
			withArticlePictures(markdown).then(
				(taken) => studio.editor.insertMarkdown(taken),
				(error: unknown) => showToast(error instanceof Error ? error.message : t('没能放进来'), true),
			);
			return true;
		},
		// ⤢ / ⤡: the panel whole in the middle (AI 问答), or back in the side.
		openWhole: () => studio.showView('chat'),
		closeWhole: () => studio.showView('editor'),
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
			chatView.append(aiPane);
			studio.sidePanel.lend('ai', true);
			aiPanel.setFull(true);
		} else if (!on && there) {
			aiPaneHome.parent.insertBefore(aiPane, aiPaneHome.next);
			aiPanel.setFull(false);
			studio.sidePanel.lend('ai', false);
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

	return { aiPanel, chatList, openChat, newChat, showChat, hold };
}
