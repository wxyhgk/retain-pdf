import { PencilLine, Trash2 } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { deleteConversation, listConversations, orderConversations, renameConversation, type Conversation } from '../api/client';
import { shell } from './shell-state';
import { showContextMenu } from '../common/context-menu';

/** What the left column's 对话 needs of the Studio around it. */
export type ChatListHost = {
	/** The conversation `id` is gone (deleted): when it is the one shown, another is. */
	removed(id: string): void;
	/** The conversation `id` named anew: the panel showing it says so. */
	renamed?(id: string, title: string): void;
	toast(message: string): void;
};

/**
 * The left column's 对话 (AI 问答): the conversations kept in chats/ (spoken to, or begun here), the latest first,
 * read for the shell to list (shell/ChatList.tsx); one's menu deletes it.
 */
export function createChatList(host: ChatListHost) {
	async function remove(entry: Conversation): Promise<void> {
		if (!window.confirm(t('删除对话「{title}」？\n它在 chats/ 里的记录会删掉，不能恢复。', { title: entry.title || t('新对话') }))) return;
		try {
			await deleteConversation(entry.id);
			host.removed(entry.id);
			await refresh();
		} catch (error) {
			host.toast(error instanceof Error ? error.message : t('没能删除'));
		}
	}

	/** 重命名: the author's name for it, kept (the AI's own title no longer put over it). */
	async function rename(entry: Conversation): Promise<void> {
		const typed = window.prompt(t('对话的新名字'), entry.title || '');
		const title = typed?.trim();
		if (!title || title === entry.title) return;
		try {
			await renameConversation(entry.id, title);
			host.renamed?.(entry.id, title);
			await refresh();
		} catch (error) {
			host.toast(error instanceof Error ? error.message : t('没能改名'));
		}
	}

	async function refresh(): Promise<void> {
		try {
			shell.set({ chats: (await listConversations()).conversations.filter((entry) => entry.onPage) });
		} catch {
			// Shown as it was.
		}
	}

	return {
		refresh,
		/** The conversation spoken in last (read anew); null when there is none. */
		async latest(): Promise<string | null> {
			await refresh();
			return shell.get().chats?.[0]?.id ?? null;
		},
		/** The conversation shown (null: none), marked. */
		select(id: string | null): void {
			shell.set({ chat: id });
		},
		/** A conversation's menu, at its row. */
		menu(entry: Conversation, row: HTMLElement): void {
			showContextMenu([
				{ label: t('重命名'), icon: PencilLine, action: () => void rename(entry) },
				'separator',
				{ label: t('删除这个对话'), danger: true, icon: Trash2, action: () => void remove(entry) },
			], row);
		},
		rename: (entry: Conversation) => void rename(entry),
		/** `id` dragged to before `before` (to the end with none): the order kept (chats/order.json). */
		async move(id: string, before: string | null): Promise<void> {
			const ids = (shell.get().chats ?? []).map((entry) => entry.id).filter((other) => other !== id);
			const at = before ? ids.indexOf(before) : -1;
			ids.splice(at < 0 ? ids.length : at, 0, id);
			const byId = new Map((shell.get().chats ?? []).map((entry) => [entry.id, entry]));
			// Shown in its place at once; kept, then read again.
			shell.set({ chats: ids.flatMap((other) => (byId.has(other) ? [byId.get(other)!] : [])) });
			try {
				await orderConversations(ids);
			} catch (error) {
				host.toast(error instanceof Error ? error.message : t('没能保存顺序'));
			}
			await refresh();
		},
	};
}
