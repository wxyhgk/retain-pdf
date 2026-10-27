import { useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
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

/**
 * The conversations of AI 问答 (chat-list.ts reads them): one clicked is shown in the middle; its menu renames or
 * deletes it, as a double-click renames it; dragged, it goes where it is let go (a line shows where).
 */
export function ChatList({ chats, chosen }: { chats: Conversation[] | null; chosen: string | null }) {
	const act = useActions();
	const [dragged, setDragged] = useState<string | null>(null);
	/** Where it would go: before this one, or after the last (null). */
	const [target, setTarget] = useState<{ before: string | null } | null>(null);
	if (!chats) return null;
	if (!chats.length) return <p className="chat-list-empty mx-2 mt-0.5 mb-1.5 text-[11px] leading-normal text-muted-foreground">{t('还没有对话。＋ 开一个，或在右边的 AI 面板里说话')}</p>;
	const end = () => {
		setDragged(null);
		setTarget(null);
	};
	return chats.map((entry, index) => (
		<button
			key={entry.id}
			type="button"
			data-chat={entry.id}
			draggable
			title={`${entry.title || t('新对话')} · ${entry.agent.name}`}
			className={cn(
				'chat-row relative flex h-[29px] w-full items-center gap-1.5 rounded-md px-2 text-left text-[13px] text-foreground hover:bg-accent',
				entry.id === chosen && 'active bg-accent',
				entry.id === dragged && 'opacity-50',
				target && dragged && dragged !== entry.id && (target.before === entry.id ? 'is-drop-before' : target.before === null && index === chats.length - 1 ? 'is-drop-after' : ''),
			)}
			onClick={() => act.openChat(entry.id)}
			onDoubleClick={() => act.renameChat(entry)}
			onContextMenu={(event) => {
				event.preventDefault();
				act.chatMenu(entry, event.currentTarget);
			}}
			onDragStart={(event) => {
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData('text/plain', entry.title || entry.id);
				setDragged(entry.id);
			}}
			onDragOver={(event) => {
				if (!dragged) return;
				event.preventDefault();
				const box = event.currentTarget.getBoundingClientRect();
				const lower = event.clientY > box.top + box.height / 2;
				setTarget({ before: lower ? (chats[index + 1]?.id ?? null) : entry.id });
			}}
			onDrop={(event) => {
				event.preventDefault();
				if (dragged && target && target.before !== dragged) act.moveChat(dragged, target.before);
				end();
			}}
			onDragEnd={end}
		>
			<span className="chat-row-title min-w-0 flex-1 truncate">{entry.title || t('新对话')}</span>
			<span className="chat-row-when flex-none text-[11px] text-muted-foreground">{entry.state === 'running' ? t('进行中') : when(entry.updated)}</span>
		</button>
	));
}
