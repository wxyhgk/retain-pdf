import { t } from '@blog/i18n/index.mjs';
import { previewKind } from './file-preview';

/**
 * How a file of the article opens from a link to it, for each way of clicking (设置 › 打开文件), as in SiYuan: in the
 * Studio (a text file's editor), with the system's program for it (VS Code, Preview…), or shown in Finder. Kept in this
 * browser: a choice of this computer's.
 */
export type FileOpenWay = 'studio' | 'app' | 'folder';
export type FileClick = 'click' | 'mod' | 'alt';

const KEY = 'studio.fileOpen';
const DEFAULTS: Record<FileClick, FileOpenWay> = { click: 'studio', mod: 'app', alt: 'folder' };
const WAYS: FileOpenWay[] = ['studio', 'app', 'folder'];

export function fileOpenWays(): Record<FileClick, FileOpenWay> {
	let kept: Partial<Record<FileClick, unknown>> = {};
	try {
		kept = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
	} catch {
		// Not kept, or not readable: as it comes.
	}
	const way = (click: FileClick) => (WAYS.includes(kept[click] as FileOpenWay) ? (kept[click] as FileOpenWay) : DEFAULTS[click]);
	return { click: way('click'), mod: way('mod'), alt: way('alt') };
}

export function setFileOpenWay(click: FileClick, way: FileOpenWay): void {
	try {
		localStorage.setItem(KEY, JSON.stringify({ ...fileOpenWays(), [click]: way }));
	} catch {
		// Not kept: this time only.
	}
}

export function fileOpenWayLabel(way: FileOpenWay): string {
	if (way === 'studio') return t('在 Studio 里打开');
	if (way === 'app') return t('用默认程序打开');
	return /Mac/u.test(navigator.platform) ? t('在 Finder 中显示') : t('在文件管理器中显示');
}

export function fileClickLabel(click: FileClick): string {
	const mac = /Mac/u.test(navigator.platform);
	if (click === 'click') return t('单击');
	if (click === 'mod') return mac ? t('⌘ 单击') : t('Ctrl 单击');
	return mac ? t('⌥ 单击') : t('Alt 单击');
}

/** What a click on a link to `path` does: the way chosen for it; a file the Studio cannot show (a zip) opens with its program. */
export function fileOpenWayFor(path: string, click: FileClick): FileOpenWay {
	const way = fileOpenWays()[click];
	return way === 'studio' && !previewKind(path) ? 'app' : way;
}
