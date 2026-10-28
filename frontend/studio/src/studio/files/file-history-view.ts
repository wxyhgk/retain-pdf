import { t } from '@blog/i18n/index.mjs';
import { openBlockSheet } from '@blog/ui/block-sheet.ts';
import { articleFileHistory, articleFileVersion, restoreArticleFileVersion, type FileVersion } from '../api/client';

type HistoryHost = {
	slug: string;
	path: string;
	toast(message: string, error?: boolean): void;
	/** Before a version is brought back (the editor saves what is not saved yet). */
	before?(): Promise<void>;
	/** A version was brought back over the file. */
	restored(): void;
};

const when = (time: number) =>
	new Date(time).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const why = (version: FileVersion) => (version.reason === 'before-restore' ? t('恢复别的版本前') : t('被覆盖前'));
const size = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

/**
 * A file's earlier versions (kept before it was written over, server/files/file-history.mjs), drawn in `panel`: the list
 * on the left, the one chosen on the right (its text), and 恢复这个版本. In the file editor's 历史版本 tab, and alone
 * for a file the Studio does not edit (openFileHistory).
 */
export function drawFileHistory(panel: HTMLElement, host: HistoryHost): void {
	panel.classList.add('file-history');
	const list = document.createElement('ol');
	list.className = 'file-history-list';
	const shown = document.createElement('div');
	shown.className = 'file-history-shown';
	panel.replaceChildren(list, shown);
	const note = (text: string) => {
		const element = document.createElement('p');
		element.className = 'file-editor-note';
		element.textContent = text;
		return element;
	};

	async function show(version: FileVersion, row: HTMLElement): Promise<void> {
		for (const other of list.querySelectorAll('[aria-current]')) other.removeAttribute('aria-current');
		row.setAttribute('aria-current', 'true');
		const restore = document.createElement('button');
		restore.type = 'button';
		restore.className = 'file-history-restore';
		restore.textContent = t('恢复这个版本');
		restore.addEventListener('click', () => {
			restore.disabled = true;
			void (host.before?.() ?? Promise.resolve())
				.then(() => restoreArticleFileVersion(host.slug, version.id, host.path))
				.then(
					() => {
						host.toast(t('已恢复 {time} 的版本；恢复前的也留了一份', { time: when(version.time) }));
						host.restored();
						void load();
					},
					(error: unknown) => {
						restore.disabled = false;
						host.toast(error instanceof Error ? error.message : String(error), true);
					},
				);
		});
		const head = document.createElement('header');
		head.className = 'file-history-head';
		const title = document.createElement('span');
		title.textContent = `${when(version.time)} · ${why(version)} · ${size(version.size)}`;
		head.append(title, restore);
		shown.replaceChildren(head, note(t('正在读…')));
		try {
			const { text } = await articleFileVersion(host.slug, version.id, host.path);
			const body = text === null ? note(t('不是文本，或者太大，这里不显示；恢复照样可以')) : Object.assign(document.createElement('pre'), { className: 'file-history-text', textContent: text });
			shown.replaceChildren(head, body);
		} catch (error) {
			shown.replaceChildren(head, note(error instanceof Error ? error.message : String(error)));
		}
	}

	async function load(): Promise<void> {
		let versions: FileVersion[];
		try {
			versions = (await articleFileHistory(host.slug, host.path)).versions;
		} catch (error) {
			panel.replaceChildren(note(error instanceof Error ? error.message : String(error)));
			return;
		}
		if (!versions.length) {
			panel.replaceChildren(note(t('还没有历史版本。这个文件被覆盖（替换上传、在这里保存、恢复）之前，会先留一份')));
			return;
		}
		if (!panel.contains(list)) panel.replaceChildren(list, shown);
		list.replaceChildren(
			...versions.map((version) => {
				const row = document.createElement('li');
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'file-history-row';
				button.dataset.version = version.id;
				const time = document.createElement('span');
				time.textContent = when(version.time);
				const reason = document.createElement('small');
				reason.textContent = `${why(version)} · ${size(version.size)}`;
				button.append(time, reason);
				button.addEventListener('click', () => void show(version, button));
				row.append(button);
				return row;
			}),
		);
		const first = list.querySelector<HTMLElement>('.file-history-row');
		if (first) void show(versions[0]!, first);
	}

	shown.append(note(t('正在读…')));
	void load();
}

/** A file's history alone, for a file the Studio does not edit (a picture, a PDF, an output too large). */
export function openFileHistory(host: HistoryHost): void {
	openBlockSheet({
		kind: t('历史版本'),
		title: host.path,
		tabs: [{ key: 'history', label: t('历史版本'), wide: true, draw: (panel) => drawFileHistory(panel, host) }],
	});
}
