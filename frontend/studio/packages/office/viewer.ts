import { t } from '@blog/i18n/index.mjs';
import { officeKind } from './kinds.mjs';
import { drawOffice, officeBytes } from './render.ts';
import './office.css';

/**
 * An office file shown whole, in a large window over the page: a
 * document's pages, a deck's slides, a workbook's sheets (one tab each).
 * One window for the page, made when first asked for.
 */

let viewer: { open(url: string, name: string): Promise<void> } | null = null;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
	const made = document.createElement(tag);
	made.className = className;
	if (text) made.textContent = text;
	return made;
}

function createViewer() {
	const dialog = element('dialog', 'office-viewer');
	const bar = element('div', 'office-viewer-bar');
	const title = element('strong', 'office-viewer-title');
	title.id = 'office-viewer-title';
	dialog.setAttribute('aria-labelledby', title.id);
	const status = element('span', 'office-viewer-status');
	status.setAttribute('role', 'status');
	const download = element('a', 'office-viewer-button', t('下载'));
	const close = element('button', 'office-viewer-button', t('关闭'));
	close.type = 'button';
	close.addEventListener('click', () => dialog.close());
	bar.append(title, status, element('span', 'office-viewer-space'), download, close);
	const tabs = element('nav', 'office-viewer-sheets');
	tabs.setAttribute('role', 'tablist');
	tabs.setAttribute('aria-label', t('工作表'));
	tabs.hidden = true;
	const body = element('div', 'office-viewer-body');
	dialog.append(bar, tabs, body);
	document.body.append(dialog);
	/** Bumped by every opening and closing: a drawing that finds it changed was for a file no longer shown. */
	let shown = 0;

	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) dialog.close();
	});
	dialog.addEventListener('close', () => {
		shown += 1;
		// What a document brought (its styles, a deck's charts) goes with it.
		body.replaceChildren();
		tabs.replaceChildren();
	});

	const note = (text: string) => body.replaceChildren(element('p', 'office-note', text));

	return {
		async open(url: string, name: string): Promise<void> {
			const at = ++shown;
			const kind = officeKind(name);
			title.textContent = name;
			download.href = url;
			download.download = name;
			tabs.replaceChildren();
			tabs.hidden = true;
			body.replaceChildren();
			if (!dialog.open) dialog.showModal();
			if (!kind || kind === 'old') {
				status.textContent = '';
				note(t('{name} 是旧的 Office 格式，网页里打不开。可以下载后用本机的程序打开，或在 Word / PowerPoint 里另存为 .docx / .pptx。', { name }));
				return;
			}
			status.textContent = t('正在打开…');
			try {
				const bytes = await officeBytes(url);
				if (at !== shown) return;
				const drawn = await drawOffice(kind, bytes, body, { width: Math.max(320, Math.min(1100, body.clientWidth - 48)) });
				if (at !== shown) return;
				status.textContent = '';
				const { sheets, showSheet } = drawn;
				if (sheets && showSheet && sheets.length > 1) {
					const select = (name: string) => {
						showSheet(name);
						for (const tab of tabs.children) tab.setAttribute('aria-selected', String((tab as HTMLElement).dataset.sheet === name));
					};
					tabs.replaceChildren(...sheets.map((sheet) => {
						const tab = element('button', '', sheet);
						tab.type = 'button';
						tab.dataset.sheet = sheet;
						tab.setAttribute('role', 'tab');
						tab.addEventListener('click', () => select(sheet));
						return tab;
					}));
					tabs.hidden = false;
					select(sheets[0]!);
				}
			} catch (error) {
				if (at !== shown) return;
				status.textContent = '';
				note(t('打不开 {name}：{error}。可以下载后用本机的程序打开。', { name, error: error instanceof Error ? error.message : String(error) }));
			}
		},
	};
}

/** Shows the office file at `url`, named `name`, whole. */
export function openOfficeFile(url: string, name: string): Promise<void> {
	return (viewer ??= createViewer()).open(url, name);
}
