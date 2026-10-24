import { listVersions, readVersion } from '../api/client.ts';
import type { HistoryEntry, HistoryReason } from '../types.ts';
import { timeAgo } from './trash-view.ts';

/** What the history view needs from the Studio around it. */
export type HistoryViewHost = {
	/** Brings this earlier version's body back, through review. */
	restore(source: string): void;
};

const REASONS: Record<HistoryReason, string> = {
	'before-change': '磁盘上改动之前',
	unsaved: '你没保存的改动',
	'before-restore': '恢复旧版本之前',
	edit: '自动存档',
};

/** The day a version was kept, as the list heads it: 今天, 昨天, or its date. */
function dayOf(time: number): string {
	const day = new Date(time).toDateString();
	const today = new Date();
	if (day === today.toDateString()) return '今天';
	if (day === new Date(today.getTime() - 24 * 60 * 60_000).toDateString()) return '昨天';
	return new Date(time).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function size(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * 历史版本: the versions of the open article the Studio kept in its ai/history
 * (every ten minutes of writing, before a change on disk or a restore; see
 * article-history.mjs), by day, each to compare with what is there now and
 * bring back, through review.
 */
export function createHistoryView(dialog: HTMLDialogElement, host: HistoryViewHost) {
	const list = dialog.querySelector<HTMLElement>('#history-list')!;
	const status = dialog.querySelector<HTMLElement>('#history-status')!;
	let slug = '';

	function say(message: string, error = false): void {
		status.textContent = message;
		status.classList.toggle('is-error', error);
	}

	async function choose(entry: HistoryEntry): Promise<void> {
		try {
			const source = await readVersion(slug, entry.name);
			dialog.close();
			host.restore(source);
		} catch (error) {
			say(error instanceof Error ? error.message : '读不到这个版本', true);
		}
	}

	function row(entry: HistoryEntry): HTMLElement {
		const item = document.createElement('li');
		item.className = 'trash-item';
		const icon = document.createElement('span');
		icon.className = 'trash-icon';
		icon.textContent = '↺';
		const words = document.createElement('span');
		words.className = 'trash-words';
		const name = document.createElement('span');
		name.className = 'trash-name';
		name.textContent = REASONS[entry.reason];
		const when = document.createElement('span');
		when.className = 'trash-where';
		when.textContent = `${new Date(entry.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · ${timeAgo(entry.time)} · ${size(entry.size)}`;
		words.append(name, when);
		const back = document.createElement('button');
		back.type = 'button';
		back.textContent = '对比并恢复';
		back.addEventListener('click', () => void choose(entry));
		item.append(icon, words, back);
		return item;
	}

	return {
		async open(article: string): Promise<void> {
			slug = article;
			say('');
			let entries: HistoryEntry[];
			try {
				entries = await listVersions(slug);
			} catch (error) {
				say(error instanceof Error ? error.message : '读不到历史版本', true);
				entries = [];
			}
			const items: HTMLElement[] = [];
			let day = '';
			for (const entry of entries) {
				if (dayOf(entry.time) !== day) {
					day = dayOf(entry.time);
					const heading = document.createElement('li');
					heading.className = 'trash-day';
					heading.textContent = day;
					items.push(heading);
				}
				items.push(row(entry));
			}
			list.replaceChildren(...items);
			if (!entries.length) {
				const empty = document.createElement('li');
				empty.className = 'trash-empty';
				empty.textContent = '还没有历史版本。写作时每 10 分钟自动存一份；终端、AI 或别的编辑器改动这篇文章前，也会先把原来的存在这里。';
				list.append(empty);
			}
			if (!dialog.open) dialog.showModal();
		},
	};
}
