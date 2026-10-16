import { listTrash, purgeTrash, restoreArticle, restoreArticleFile } from '../api/client.ts';
import { trackWrite } from '../state/writes.ts';
import type { TrashEntry } from '../types.ts';

/** What the trash view needs from the Studio around it. */
export type TrashViewHost = {
	/** A whole article is back. */
	articleRestored(slug: string): void;
	/** A file or folder of an article is back. */
	fileRestored(slug: string, path: string): void;
};

const relative = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });

/** How long ago, in words: 刚刚, 3 分钟前, 昨天… */
export function timeAgo(time: number, now = Date.now()): string {
	const seconds = Math.round((time - now) / 1000);
	if (seconds > -45) return '刚刚';
	const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['minute', 60], ['hour', 3600], ['day', 86400]];
	for (let at = steps.length - 1; at >= 0; at -= 1) {
		const [unit, size] = steps[at];
		if (Math.abs(seconds) >= size || unit === 'minute') return relative.format(Math.round(seconds / size), unit);
	}
	return '刚刚';
}

/** 回收站: what was deleted in the last 30 days, to put back or delete for good. */
export function createTrashView(dialog: HTMLDialogElement, host: TrashViewHost) {
	const list = dialog.querySelector<HTMLElement>('#trash-list')!;
	const status = dialog.querySelector<HTMLElement>('#trash-status')!;

	function say(message: string, error = false): void {
		status.textContent = message;
		status.classList.toggle('is-error', error);
	}

	function errorText(error: unknown, fallback: string): string {
		return error instanceof Error ? error.message : fallback;
	}

	async function restore(entry: TrashEntry): Promise<void> {
		try {
			if (entry.kind === 'article') {
				const { slug } = await trackWrite(() => restoreArticle(entry.trashed));
				host.articleRestored(slug);
				say(`已恢复「${entry.title ?? slug}」`);
			} else {
				const { path } = await trackWrite(() => restoreArticleFile(entry.slug, entry.trashed));
				host.fileRestored(entry.slug, path);
				say(`已恢复 ${entry.slug}/${path}`);
			}
		} catch (error) {
			say(errorText(error, '恢复失败'), true);
		}
		await load();
	}

	async function purge(entry: TrashEntry): Promise<void> {
		const name = entry.kind === 'article' ? `文章「${entry.title ?? entry.slug}」` : `${entry.slug}/${entry.path}`;
		if (!window.confirm(`彻底删除${name}？\n删除后不能再恢复。`)) return;
		try {
			await purgeTrash(entry.trashed);
			say(`已彻底删除${name}`);
		} catch (error) {
			say(errorText(error, '删除失败'), true);
		}
		await load();
	}

	function row(entry: TrashEntry): HTMLElement {
		const item = document.createElement('li');
		item.className = 'trash-item';
		const icon = document.createElement('span');
		icon.className = 'trash-icon';
		icon.textContent = entry.kind === 'article' ? entry.icon || '▤' : entry.kind === 'directory' ? '▸' : '▫';
		const words = document.createElement('span');
		words.className = 'trash-words';
		const name = document.createElement('span');
		name.className = 'trash-name';
		name.textContent = entry.kind === 'article' ? entry.title ?? entry.slug : entry.path ?? '';
		const where = document.createElement('span');
		where.className = 'trash-where';
		where.textContent = `${entry.kind === 'article' ? `文章 · blog/${entry.slug}/` : `${entry.slug} 的${entry.kind === 'directory' ? '文件夹' : '文件'}`} · ${timeAgo(entry.deletedAt)}删除`;
		words.append(name, where);
		const back = document.createElement('button');
		back.type = 'button';
		back.textContent = '恢复';
		back.addEventListener('click', () => void restore(entry));
		const gone = document.createElement('button');
		gone.type = 'button';
		gone.className = 'is-danger';
		gone.textContent = '彻底删除';
		gone.addEventListener('click', () => void purge(entry));
		item.append(icon, words, back, gone);
		return item;
	}

	async function load(): Promise<void> {
		let entries: TrashEntry[];
		try {
			entries = await listTrash();
		} catch (error) {
			say(errorText(error, '读不到回收站'), true);
			return;
		}
		list.replaceChildren(...entries.map(row));
		if (!entries.length) {
			const empty = document.createElement('li');
			empty.className = 'trash-empty';
			empty.textContent = '回收站是空的。删除的文章和文件会在这里保留 30 天。';
			list.append(empty);
		}
	}

	return {
		async open(): Promise<void> {
			say('');
			await load();
			if (!dialog.open) dialog.showModal();
		},
	};
}
