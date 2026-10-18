import { codeFileLanguageForPath } from '../code-files/languages.mjs';
import { PUBLISHED_FOLDERS } from '../articles/rules.mjs';
import { isMoleculeLanguage } from '../science/parsers/molecule-block.ts';

/**
 * An article's files as the Studio's page writes and moves them: their
 * names, and what to put in the article to use one. The file panel and the
 * editor (a file dropped or pasted into it) both use these.
 */

/** A file dragged from the panel carries its article path under this type, so the editor can tell it from files off the desktop. */
export const STUDIO_FILE_DRAG_TYPE = 'application/x-studio-file';
/** What a file dragged from the drive (资料库) carries: its path there. */
export const DRIVE_DRAG_TYPE = 'application/x-studio-drive';

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
 * chemistry block reading the structure file, or a plain link. `ai/` is not
 * published and has none.
 */
export function markdownReference(path: string): string | null {
	if (!PUBLISHED_FOLDERS.includes(path.split('/', 1)[0])) return null;
	const name = fileName(path);
	const label = name.replace(/[[\]\\]/gu, '\\$&');
	if (isImage(path)) return `![${label.replace(/\.[^.]+$/u, '')}](${linkPath(path)})`;
	const language = extension(path);
	if (language && isMoleculeLanguage(language)) return `\`\`\`${language}\n@file ./${path}\n\`\`\``;
	// A program's input or output shows as the file, highlighted, to read or download.
	const codeFile = codeFileLanguageForPath(path);
	if (codeFile) return `\`\`\`${codeFile}\n@file ./${path}\n\`\`\``;
	return `[${label}](${linkPath(path)})`;
}
