import { deleteConversation, listConversations, type Conversation } from '../api/client';
import { showContextMenu } from './context-menu';

/**
 * A conversation kept as a page (src/studio/server/chat-store.mjs): its id is its slug, `chat-20261025-153012`
 * (`-2` after it for a second begun the same second), opened in the editor as an article is. As
 * src/articles/bundle-paths.mjs has it.
 */
export const isChatSlug = (slug: string | null | undefined): boolean => typeof slug === 'string' && /^chat-\d{8}-\d{6}(-\d+)?$/u.test(slug);

/** What the left column's 对话 needs of the Studio around it. */
export type ChatListHost = {
	/** Opens the conversation's page in the editor. */
	open(id: string): void;
	/** The conversation `id` is gone (deleted): when it is the page open, another is opened. */
	removed(id: string): void;
	toast(message: string): void;
};

/** When a conversation was last spoken in: the time today, else the day. */
function when(iso: string | undefined): string {
	const date = new Date(iso ?? '');
	if (Number.isNaN(date.getTime())) return '';
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, '0');
	if (date.toDateString() === now.toDateString()) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return `${date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}-`}${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * The left column's 对话: the conversations that are pages (spoken to, or begun as one), the latest first; one
 * clicked is opened in the editor (问答为主), its menu deletes it.
 */
export function createChatList(root: HTMLElement, host: ChatListHost) {
	let chosen: string | null = null;
	let shown: Conversation[] = [];

	function draw(): void {
		if (!shown.length) {
			const none = document.createElement('p');
			none.className = 'chat-list-empty';
			none.textContent = '还没有对话。＋ 开一个，或在右边的 AI 面板里说话';
			root.replaceChildren(none);
			return;
		}
		root.replaceChildren(
			...shown.map((entry) => {
				const row = document.createElement('button');
				row.type = 'button';
				row.className = `chat-row${entry.id === chosen ? ' active' : ''}`;
				row.dataset.chat = entry.id;
				const title = document.createElement('span');
				title.className = 'chat-row-title';
				title.textContent = entry.title || '新对话';
				const time = document.createElement('span');
				time.className = 'chat-row-when';
				time.textContent = entry.state === 'running' ? '进行中' : when(entry.updated);
				row.append(title, time);
				row.title = `${entry.title || '新对话'} · ${entry.agent.name}`;
				row.addEventListener('click', () => host.open(entry.id));
				row.addEventListener('contextmenu', (event) => {
					event.preventDefault();
					showContextMenu([{ label: '删除这个对话', danger: true, action: () => void remove(entry) }], row);
				});
				return row;
			}),
		);
	}

	async function remove(entry: Conversation): Promise<void> {
		if (!window.confirm(`删除对话「${entry.title || '新对话'}」？\n它在 chats/ 里的页面和记录都会删掉，不能恢复。`)) return;
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
			shown = (await listConversations()).conversations.filter((entry) => entry.onPage);
			draw();
		} catch {
			// Shown as it was.
		}
	}

	return {
		refresh,
		/** The conversation spoken in last (read anew); null when there is none. */
		async latest(): Promise<string | null> {
			await refresh();
			return shown[0]?.id ?? null;
		},
		/** The conversation open in the editor (null: an article is), marked. */
		select(id: string | null): void {
			chosen = id;
			for (const row of root.querySelectorAll<HTMLElement>('.chat-row')) row.classList.toggle('active', row.dataset.chat === id);
		},
	};
}
