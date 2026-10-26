import { deleteConversation, listConversations, type Conversation } from '../api/client';
import { shell } from '../shell/shell-state';
import { showContextMenu } from './context-menu';

/** What the left column's 对话 needs of the Studio around it. */
export type ChatListHost = {
	/** The conversation `id` is gone (deleted): when it is the one shown, another is. */
	removed(id: string): void;
	toast(message: string): void;
};

/**
 * The left column's 对话 (AI 问答): the conversations kept in chats/ (spoken to, or begun here), the latest first,
 * read for the shell to list (shell/ChatList.tsx); one's menu deletes it.
 */
export function createChatList(host: ChatListHost) {
	async function remove(entry: Conversation): Promise<void> {
		if (!window.confirm(`删除对话「${entry.title || '新对话'}」？\n它在 chats/ 里的记录会删掉，不能恢复。`)) return;
		try {
			await deleteConversation(entry.id);
			host.removed(entry.id);
			await refresh();
		} catch (error) {
			host.toast(error instanceof Error ? error.message : '没能删除');
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
			showContextMenu([{ label: '删除这个对话', danger: true, action: () => void remove(entry) }], row);
		},
	};
}
