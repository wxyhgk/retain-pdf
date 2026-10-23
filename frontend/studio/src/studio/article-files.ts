import { codeFileLanguageForPath } from '@blog/markdown/code-files/languages.mjs';
import { PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';

/**
 * An article's files as the Studio's page writes and moves them: their
 * names, and what to put in the article to use one. The file panel and the
 * editor (a file dropped or pasted into it) both use these.
 */

/** A file dragged from the panel carries its article path under this type, so the editor can tell it from files off the desktop. */
export const STUDIO_FILE_DRAG_TYPE = 'application/x-studio-file';
/** What a file dragged from the drive (资料库) carries: its path there. */
export const DRIVE_DRAG_TYPE = 'application/x-studio-drive';

/** A plugin's block that shows a file of the article: its fence (when the extension is one), and its mark in the file list. */
export type FileBlock = { fence: string | null; icon?: string; markdown?: (path: string) => string };

/** Which plugin block shows a file with this extension (a chemistry block a structure file): set by the Studio once its plugins have started. */
let fileBlockFor: (extension: string) => FileBlock | null = () => null;

export function setFileBlocks(lookup: (extension: string) => FileBlock | null): void {
	fileBlockFor = lookup;
}

/** The plugin block that shows this file of the article, if one does. */
export function fileBlock(path: string): FileBlock | null {
	const ext = extension(path);
	return ext ? fileBlockFor(ext) : null;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']);

export function fileName(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1);
}

export function parentPath(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash < 0 ? '' : path.slice(0, slash);
}

export function extension(path: string): string {
	const name = fileName(path);
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isImage(path: string): boolean {
	return IMAGE_EXTENSIONS.has(extension(path));
}

/** How a file is written in a link: `./img/a.png`, with characters a bare link cannot hold encoded. */
export function linkPath(path: string): string {
	return `./${path.split('/').map((segment) => (/[\s()<>]/u.test(segment) ? encodeURIComponent(segment) : segment)).join('/')}`;
}

/**
 * What to paste into the article to use a published file: an image, a
 * plugin's block reading it (a chemistry block a structure file), or a plain link. `ai/` is not
 * published and has none.
 */
export function markdownReference(path: string): string | null {
	if (!PUBLISHED_FOLDERS.includes(path.split('/', 1)[0])) return null;
	const name = fileName(path);
	const label = name.replace(/[[\]\\]/gu, '\\$&');
	if (isImage(path)) return `![${label.replace(/\.[^.]+$/u, '')}](${linkPath(path)})`;
	// A block a plugin draws from the file (a structure file in a chemistry block, a video).
	const block = fileBlock(path);
	if (block?.markdown) return block.markdown(path);
	if (block?.fence) return `\`\`\`${block.fence}\n@file ./${path}\n\`\`\``;
	// A program's input or output shows as the file, highlighted, to read or download.
	const codeFile = codeFileLanguageForPath(path);
	if (codeFile) return `\`\`\`${codeFile}\n@file ./${path}\n\`\`\``;
	return `[${label}](${linkPath(path)})`;
}
