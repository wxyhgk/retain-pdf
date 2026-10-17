import { officeKind } from '../office-kinds.mjs';
import './office-viewer.css';

/**
 * Word, PowerPoint and Excel files shown in the page itself, read by
 * libraries loaded only when one is opened: docx-preview draws a document
 * as pages, pptx-preview its slides one under another, SheetJS a workbook
 * as tables, one tab a sheet. Nothing leaves the machine.
 */

type SheetLibrary = typeof import('xlsx');

let sheets: Promise<SheetLibrary> | null = null;
const sheetLibrary = (): Promise<SheetLibrary> => (sheets ??= import('xlsx'));

async function fileBytes(url: string): Promise<ArrayBuffer> {
	const response = await fetch(url, { cache: 'no-store' });
	if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? '读不到这个文件');
	return response.arrayBuffer();
}

/** A workbook's first sheet as rows of the text its cells show; rows with nothing in them at the end are left off. */
export async function firstSheetRows(url: string): Promise<string[][]> {
	const XLSX = await sheetLibrary();
	const book = XLSX.read(await fileBytes(url), { type: 'array' });
	const sheet = book.Sheets[book.SheetNames[0] ?? ''];
	if (!sheet) return [];
	const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
	return rows.map((row) => row.map((cell) => String(cell ?? '')));
}

/** Links in what was drawn go out in a new tab, and none runs script. */
function safeLinks(root: HTMLElement): void {
	for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
		if (/^\s*(?:javascript|vbscript|data):/iu.test(link.getAttribute('href') ?? '')) link.removeAttribute('href');
		else if (!link.getAttribute('href')?.startsWith('#')) {
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
		}
	}
}

export function createOfficeViewer(dialog: HTMLDialogElement) {
	const title = dialog.querySelector<HTMLElement>('#office-viewer-title')!;
	const status = dialog.querySelector<HTMLElement>('#office-viewer-status')!;
	const tabs = dialog.querySelector<HTMLElement>('#office-viewer-sheets')!;
	const download = dialog.querySelector<HTMLAnchorElement>('#office-viewer-download')!;
	const body = dialog.querySelector<HTMLElement>('#office-viewer-body')!;
	/** Bumped by every opening: a drawing that finds it changed was for a file no longer shown. */
	let shown = 0;

	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) dialog.close();
	});
	dialog.addEventListener('close', () => {
		shown += 1;
		// What a document brought (its styles, a viewer) goes with it.
		body.replaceChildren();
		tabs.replaceChildren();
	});

	function say(text: string): void {
		status.textContent = text;
	}

	async function drawDocument(bytes: ArrayBuffer, at: number): Promise<void> {
		const { renderAsync } = await import('docx-preview');
		if (at !== shown) return;
		const styles = document.createElement('div');
		const pages = document.createElement('div');
		pages.className = 'office-document';
		body.replaceChildren(styles, pages);
		await renderAsync(bytes, pages, styles, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, experimental: true, useBase64URL: true });
		safeLinks(pages);
	}

	async function drawSlides(bytes: ArrayBuffer, at: number): Promise<void> {
		const { init } = await import('pptx-preview');
		if (at !== shown) return;
		const deck = document.createElement('div');
		deck.className = 'office-slides';
		body.replaceChildren(deck);
		const width = Math.max(320, Math.min(1100, body.clientWidth - 48));
		const viewer = init(deck, { width, height: Math.round((width * 9) / 16), mode: 'list' });
		await viewer.preview(bytes);
		safeLinks(deck);
	}

	async function drawSheets(bytes: ArrayBuffer, at: number): Promise<void> {
		const XLSX = await sheetLibrary();
		if (at !== shown) return;
		const book = XLSX.read(bytes, { type: 'array' });
		const show = (name: string) => {
			const table = document.createElement('div');
			table.className = 'office-sheet';
			// SheetJS writes the cells' text escaped.
			table.innerHTML = XLSX.utils.sheet_to_html(book.Sheets[name]!, { header: '', footer: '' });
			body.replaceChildren(table);
			for (const tab of tabs.children) tab.setAttribute('aria-selected', String((tab as HTMLElement).dataset.sheet === name));
		};
		tabs.replaceChildren(...book.SheetNames.map((name) => {
			const tab = document.createElement('button');
			tab.type = 'button';
			tab.dataset.sheet = name;
			tab.textContent = name;
			tab.setAttribute('role', 'tab');
			tab.addEventListener('click', () => show(name));
			return tab;
		}));
		tabs.hidden = book.SheetNames.length < 2;
		if (book.SheetNames[0]) show(book.SheetNames[0]);
	}

	return {
		/** Shows the office file at `url` (named `name`) in the page. */
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
			if (kind === 'old') {
				say('');
				const note = document.createElement('p');
				note.className = 'office-note';
				note.textContent = `${name} 是旧的 Office 格式，网页里打不开。可以下载后用本机的程序打开，或在 Word / PowerPoint 里另存为 .docx / .pptx。`;
				body.replaceChildren(note);
				return;
			}
			say('正在打开…');
			try {
				const bytes = await fileBytes(url);
				if (at !== shown) return;
				if (kind === 'document') await drawDocument(bytes, at);
				else if (kind === 'slides') await drawSlides(bytes, at);
				else await drawSheets(bytes, at);
				if (at === shown) say('');
			} catch (error) {
				if (at !== shown) return;
				say('');
				const note = document.createElement('p');
				note.className = 'office-note';
				note.textContent = `打不开 ${name}：${error instanceof Error ? error.message : String(error)}。可以下载后用本机的程序打开。`;
				body.replaceChildren(note);
			}
		},
	};
}
