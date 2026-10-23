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

/**
 * Which plugin block shows a file with this extension (a chemistry block a structure file), given
 * the start of the file when it was read; and whether one would read it (a Gaussian output is told
 * from the other `.log` files by what it says): set by the Studio once its plugins have started.
 */
let fileBlockFor: (extension: string, head?: string) => FileBlock | null = () => null;
let headWanted: (extension: string) => boolean = () => false;

export function setFileBlocks(lookup: (extension: string, head?: string) => FileBlock | null, wantsHead: (extension: string) => boolean = () => false): void {
	fileBlockFor = lookup;
	headWanted = wantsHead;
}

/** The plugin block that shows this file of the article, if one does; `head` is the file's start, when read. */
export function fileBlock(path: string, head?: string): FileBlock | null {
	const ext = extension(path);
	return ext ? fileBlockFor(ext, head) : null;
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
export function markdownReference(path: string, head?: string): string | null {
	if (!PUBLISHED_FOLDERS.includes(path.split('/', 1)[0])) return null;
	const name = fileName(path);
	const label = name.replace(/[[\]\\]/gu, '\\$&');
	if (isImage(path)) return `![${label.replace(/\.[^.]+$/u, '')}](${linkPath(path)})`;
	// A block a plugin draws from the file (a structure file in a chemistry block, a video).
	const block = fileBlock(path, head);
	if (block?.markdown) return block.markdown(path);
	if (block?.fence) return `\`\`\`${block.fence}\n@file ./${path}\n\`\`\``;
	// A program's input or output shows as the file, highlighted, to read or download.
	const codeFile = codeFileLanguageForPath(path);
	if (codeFile) return `\`\`\`${codeFile}\n@file ./${path}\n\`\`\``;
	return `[${label}](${linkPath(path)})`;
}

/**
 * markdownReference, the start of the file read first (`readHead`) when a plugin block tells such
 * files by what they say: a Gaussian or ORCA output becomes its card, another `.log` stays output.
 */
export async function readMarkdownReference(path: string, readHead: (path: string) => Promise<string | null>): Promise<string | null> {
	const ext = extension(path);
	const head = ext && headWanted(ext) ? await readHead(path).catch(() => null) : null;
	return markdownReference(path, head ?? undefined);
}
