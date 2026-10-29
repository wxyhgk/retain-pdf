import { t } from '@blog/i18n/index.mjs';

/**
 * What a file of an article is, for its card or its mark in a sentence (file-cards.css), in the Studio and on the
 * blog alike: by its extension.
 */

const KINDS = [
	['pdf', ['pdf']],
	['image', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'heic', 'tif', 'tiff']],
	['video', ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv']],
	['audio', ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'opus']],
	['table', ['csv', 'tsv', 'xlsx', 'xls', 'ods']],
	['archive', ['zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'tar']],
	['code', ['py', 'js', 'mjs', 'ts', 'sh', 'bash', 'zsh', 'f', 'f90', 'f95', 'c', 'h', 'cpp', 'rs', 'go', 'jl', 'r', 'm', 'ipynb', 'json', 'yaml', 'yml', 'toml', 'html', 'css', 'sql', 'tex']],
	['data', ['log', 'out', 'gjf', 'com', 'inp', 'xyz', 'cube', 'cub', 'chk', 'fchk', 'mol', 'mol2', 'sdf', 'pdb', 'cif', 'poscar', 'outcar', 'molden', 'wfn', 'dat']],
	['text', ['txt', 'md', 'markdown', 'rtf', 'doc', 'docx', 'ppt', 'pptx', 'bib']],
];

/** `pdf`, `image`, `video`, `audio`, `table`, `archive`, `code`, `data`, `text`, or `file` for the rest. */
export function fileKind(path) {
	const name = String(path).split(/[?#]/u, 1)[0].split('/').pop()?.toLowerCase() ?? '';
	const extension = name.includes('.') ? name.split('.').pop() : '';
	return KINDS.find(([, extensions]) => extensions.includes(extension))?.[0] ?? 'file';
}

/** What each kind is called on its card. */
export function fileKindName(kind) {
	return {
		pdf: 'PDF',
		image: t('图片'),
		video: t('视频'),
		audio: t('音频'),
		table: t('表格'),
		archive: t('压缩包'),
		code: t('代码'),
		data: t('数据'),
		text: t('文本'),
	}[kind] ?? t('文件');
}

/** A size as people read it: `812 B`, `14.2 KB`, `3.1 MB`, `1.2 GB`. */
export function fileSize(bytes) {
	if (!Number.isFinite(bytes) || bytes < 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
