import type { Conversation } from '../api/client';
import { cn } from '@studio/lib/utils';
import { useActions } from './shell-state';

/** When a conversation was last spoken in: the time today, else the day. */
export function when(iso: string | undefined, now = new Date()): string {
	const date = new Date(iso ?? '');
	if (Number.isNaN(date.getTime())) return '';
	const pad = (value: number) => String(value).padStart(2, '0');
	if (date.toDateString() === now.toDateString()) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return `${date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}-`}${date.getMonth() + 1}-${date.getDate()}`;
}

/** The conversations of AI 问答 (chat-list.ts reads them): one clicked is shown in the middle, its menu deletes it. */
export function ChatList({ chats, chosen }: { chats: Conversation[] | null; chosen: string | null }) {
	const act = useActions();
	if (!chats) return null;
	if (!chats.length) return <p className="chat-list-empty mx-2 mt-0.5 mb-1.5 text-[11px] leading-normal text-muted-foreground">还没有对话。＋ 开一个，或在右边的 AI 面板里说话</p>;
	return chats.map((entry) => (
		<button
			key={entry.id}
			type="button"
			data-chat={entry.id}
			title={`${entry.title || '新对话'} · ${entry.agent.name}`}
			className={cn('chat-row flex h-[29px] w-full items-center gap-1.5 rounded-md px-2 text-left text-[13px] text-foreground hover:bg-accent', entry.id === chosen && 'active bg-accent')}
			onClick={() => act.openChat(entry.id)}
			onContextMenu={(event) => {
				event.preventDefault();
				act.chatMenu(entry, event.currentTarget);
			}}
		>
			<span className="chat-row-title min-w-0 flex-1 truncate">{entry.title || '新对话'}</span>
			<span className="chat-row-when flex-none text-[11px] text-muted-foreground">{entry.state === 'running' ? '进行中' : when(entry.updated)}</span>
		</button>
	));
}
