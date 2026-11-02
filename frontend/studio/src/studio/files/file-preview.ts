import { t } from '@blog/i18n/index.mjs';
import { studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { textFileLanguage } from '@blog/markdown/code-files/languages.mjs';
import { officeKind } from '@blog/office/kinds.mjs';
import { openBlockSheet } from '@blog/ui/block-sheet.ts';
import { openArticleFileInApp, revealArticleFile } from '../api/client';
import { drawFileHistory } from './file-history-view';

/**
 * What the Studio shows a file of the article as, opened in it (设置 › 打开文件 › 在 Studio 里打开): a PDF in the
 * page's own reader, a picture to look at closely, a video or a sound to play, a table (CSV, TSV) as a table, an
 * office file in its viewer, a text file (code, data, an input) in its editor. Null: none (a zip, a checkpoint).
 */
export type PreviewKind = 'pdf' | 'image' | 'video' | 'audio' | 'table' | 'office' | 'text';

const extension = (path: string) => (/\.([^./]+)$/u.exec(path)?.[1] ?? '').toLowerCase();

export function previewKind(path: string): PreviewKind | null {
	const kind = extension(path);
	if (kind === 'pdf') return 'pdf';
	if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'heic'].includes(kind)) return 'image';
	if (['mp4', 'mov', 'm4v', 'webm'].includes(kind)) return 'video';
	if (['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'opus'].includes(kind)) return 'audio';
	if (['csv', 'tsv'].includes(kind)) return 'table';
	if (officeKind(path)) return 'office';
	if (textFileLanguage(path)) return 'text';
	return null;
}

/** The rows of a CSV or TSV file (quotes as CSV has them: a field in "", "" a quote in it), at most `limit`. */
export function tableRows(text: string, separator: string, limit = 2000): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let at = 0; at < text.length && rows.length < limit; at += 1) {
		const character = text[at]!;
		if (quoted) {
			if (character === '"' && text[at + 1] === '"') {
				field += '"';
				at += 1;
			} else if (character === '"') quoted = false;
			else field += character;
		} else if (character === '"' && field === '') quoted = true;
		else if (character === separator) {
			row.push(field);
			field = '';
		} else if (character === '\n' || character === '\r') {
			if (character === '\r' && text[at + 1] === '\n') at += 1;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += character;
	}
	if (field || row.length) rows.push([...row, field]);
	return rows;
}

type PreviewHost = {
	slug: string;
	path: string;
	toast(message: string, error?: boolean): void;
	/** A text file is opened in its editor instead (file-editor.ts); an office file in its viewer. */
	edit(path: string): void;
	viewOffice(url: string, name: string): void;
	/** A version was brought back over the file (its previews drawn again). */
	restored(): void;
};

/** Opens the file `path` of the article in the Studio, as what it is (previewKind); false: it cannot be shown here. */
export function openFilePreview(host: PreviewHost): boolean {
	const kind = previewKind(host.path);
	const name = host.path.split('/').pop() ?? host.path;
	const url = studioFileUrl(host.slug, host.path);
	if (!kind) return false;
	if (kind === 'text') {
		host.edit(host.path);
		return true;
	}
	if (kind === 'office') {
		host.viewOffice(url, name);
		return true;
	}
	const failed = (error: unknown) => host.toast(error instanceof Error ? error.message : String(error), true);
	openBlockSheet({
		kind: extension(host.path).toUpperCase() || t('文件'),
		title: host.path,
		tabs: [
			{ key: 'preview', label: t('预览'), wide: true, draw: (panel) => drawPreview(panel, kind, url, host) },
			{ key: 'history', label: t('历史版本'), wide: true, draw: (panel) => drawFileHistory(panel, { slug: host.slug, path: host.path, toast: host.toast, restored: host.restored }) },
		],
		actions: [
			...(kind === 'table' ? [{ label: t('编辑文本'), run: () => host.edit(host.path) }] : []),
			{ label: /Mac/u.test(navigator.platform) ? t('在 Finder 中显示') : t('在文件管理器中显示'), run: () => void revealArticleFile(host.slug, host.path).catch(failed) },
			{ label: t('用默认程序打开'), primary: true, run: () => void openArticleFileInApp(host.slug, host.path).catch(failed) },
		],
	});
	return true;
}

function drawPreview(panel: HTMLElement, kind: PreviewKind, url: string, host: PreviewHost): (() => void) | void {
	panel.classList.add('file-preview', `is-${kind}`);
	// Each time it is opened, the file as it is now (not as the page has it kept).
	const fresh = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
	if (kind === 'pdf') {
		// The page's own reader (WebKit's, Chrome's): pages, search, zoom.
		const frame = Object.assign(document.createElement('iframe'), { src: fresh, title: host.path, className: 'file-preview-frame' });
		panel.append(frame);
		return;
	}
	if (kind === 'video' || kind === 'audio') {
		const player = document.createElement(kind);
		Object.assign(player, { src: fresh, controls: true, preload: 'metadata', className: 'file-preview-player' });
		panel.append(player);
		return () => player.pause();
	}
	if (kind === 'image') return drawPicture(panel, fresh, host.path);
	if (kind === 'table') void drawTable(panel, fresh, host.path);
}

/** A picture: whole in the window at first; − + and 100% to look closer (scrolled about), a double-click to switch. */
function drawPicture(panel: HTMLElement, url: string, path: string): void {
	const stage = document.createElement('div');
	stage.className = 'file-preview-stage';
	const picture = Object.assign(document.createElement('img'), { src: url, alt: path, draggable: false });
	stage.append(picture);
	const bar = document.createElement('div');
	bar.className = 'file-preview-bar';
	const said = document.createElement('span');
	let scale: number | null = null;
	const show = () => {
		stage.classList.toggle('is-fit', scale === null);
		picture.style.width = scale === null ? '' : `${Math.round(picture.naturalWidth * scale)}px`;
		said.textContent = scale === null ? t('适应窗口') : `${Math.round(scale * 100)}%`;
	};
	const button = (label: string, title: string, run: () => void) => {
		const element = Object.assign(document.createElement('button'), { type: 'button', textContent: label, title });
		element.setAttribute('aria-label', title);
		element.addEventListener('click', run);
		return element;
	};
	const fitted = () => Math.min(1, stage.clientWidth / (picture.naturalWidth || 1), stage.clientHeight / (picture.naturalHeight || 1));
	const zoom = (by: number) => {
		scale = Math.min(8, Math.max(0.1, (scale ?? fitted()) * by));
		show();
	};
	bar.append(
		button('−', t('缩小'), () => zoom(1 / 1.25)),
		said,
		button('+', t('放大'), () => zoom(1.25)),
		button(t('适应'), t('适应窗口'), () => {
			scale = null;
			show();
		}),
		button('100%', t('原始大小'), () => {
			scale = 1;
			show();
		}),
	);
	picture.addEventListener('dblclick', () => {
		scale = scale === null ? 1 : null;
		show();
	});
	picture.addEventListener('load', () => {
		const size = document.createElement('span');
		size.className = 'file-preview-size';
		size.textContent = `${picture.naturalWidth} × ${picture.naturalHeight}`;
		bar.append(size);
		show();
	});
	panel.append(stage, bar);
	show();
}

/** A table file as a table (its first 2000 rows), the first row as its heads. */
async function drawTable(panel: HTMLElement, url: string, path: string): Promise<void> {
	const note = Object.assign(document.createElement('p'), { className: 'file-editor-note', textContent: t('正在读 {path}…', { path }) });
	panel.append(note);
	let text: string;
	try {
		const answer = await fetch(url, { cache: 'no-store' });
		if (!answer.ok) throw new Error(t('读不到 {path}', { path }));
		text = await answer.text();
	} catch (error) {
		note.textContent = error instanceof Error ? error.message : String(error);
		return;
	}
	const rows = tableRows(text, extension(path) === 'tsv' ? '\t' : ',');
	const table = document.createElement('table');
	table.className = 'file-preview-table';
	rows.forEach((row, index) => {
		const line = document.createElement('tr');
		for (const value of row) line.append(Object.assign(document.createElement(index === 0 ? 'th' : 'td'), { textContent: value }));
		(index === 0 ? table.createTHead() : (table.tBodies[0] ?? table.createTBody())).append(line);
	});
	const scroller = document.createElement('div');
	scroller.className = 'file-preview-scroll';
	scroller.append(table);
	note.replaceWith(scroller);
	if (rows.length >= 2000) panel.append(Object.assign(document.createElement('p'), { className: 'file-editor-note', textContent: t('只显示了前 2000 行') }));
}
