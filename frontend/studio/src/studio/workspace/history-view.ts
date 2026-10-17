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
};

function size(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * 历史版本: the versions of the open article the Studio kept in its ai/history
 * before a change on disk or a restore, each to compare with what is there
 * now and bring back, through review.
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
		when.textContent = `${timeAgo(entry.time)} · ${new Date(entry.time).toLocaleString('zh-CN')} · ${size(entry.size)}`;
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
			list.replaceChildren(...entries.map(row));
			if (!entries.length) {
				const empty = document.createElement('li');
				empty.className = 'trash-empty';
				empty.textContent = '还没有历史版本。终端、AI 或别的编辑器改动这篇文章时，Studio 会先把原来的版本存在这里。';
				list.append(empty);
			}
			if (!dialog.open) dialog.showModal();
		},
	};
}
