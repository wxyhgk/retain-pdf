import { codeFileLanguageForPath } from '../../code-files/languages.mjs';
import { isMoleculeLanguage } from '../../science/parsers/molecule-block.ts';
import { findArticleReferences, movedPath } from '../shared/article-references.mjs';
import type { ArticleFileEntry } from '../types.ts';

/** A file dragged from the panel carries its article path under this type, so the editor can tell it from files off the desktop. */
export const STUDIO_FILE_DRAG_TYPE = 'application/x-studio-file';

/** One row of the file panel's tree. */
export type FileNode = {
	entry: ArticleFileEntry;
	name: string;
	depth: number;
	children: FileNode[];
};

/** The article's own text first, then its folders, then the files only the Studio writes. */
const TOP_LEVEL_ORDER = ['index.md', 'img', 'assets', 'ai', 'article.config.yaml', 'article.views.json'];
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']);
/** Folders whose files are published with the article, so a file nothing refers to is worth pointing out. */
const PUBLISHED_FOLDERS = ['img', 'assets'];

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

/** The listing as a tree: folders before files, names in natural order (`2` before `10`). */
export function buildFileTree(entries: readonly ArticleFileEntry[]): FileNode[] {
	const nodes = new Map<string, FileNode>();
	const roots: FileNode[] = [];
	for (const entry of [...entries].sort((left, right) => left.path.split('/').length - right.path.split('/').length)) {
		const node: FileNode = { entry, name: fileName(entry.path), depth: 0, children: [] };
		nodes.set(entry.path, node);
		const parent = nodes.get(parentPath(entry.path));
		if (parent && parentPath(entry.path)) {
			node.depth = parent.depth + 1;
			parent.children.push(node);
		} else roots.push(node);
	}
	const byName = (left: FileNode, right: FileNode): number => {
		if (left.entry.kind !== right.entry.kind) return left.entry.kind === 'directory' ? -1 : 1;
		return left.name.localeCompare(right.name, 'zh-CN', { numeric: true });
	};
	for (const node of nodes.values()) node.children.sort(byName);
	const rank = (node: FileNode): number => {
		const index = TOP_LEVEL_ORDER.indexOf(node.name);
		return index < 0 ? TOP_LEVEL_ORDER.length : index;
	};
	return roots.sort((left, right) => rank(left) - rank(right) || byName(left, right));
}

/** The rows on screen: every node whose folders above it are all open. */
export function visibleNodes(tree: readonly FileNode[], expanded: ReadonlySet<string>): FileNode[] {
	const rows: FileNode[] = [];
	const walk = (nodes: readonly FileNode[]) => {
		for (const node of nodes) {
			rows.push(node);
			if (node.entry.kind === 'directory' && expanded.has(node.entry.path)) walk(node.children);
		}
	};
	walk(tree);
	return rows;
}

/**
 * Where an upload goes. Onto a folder, into it; onto a file in a folder,
 * next to it. Otherwise, by kind: pictures into `img/`, the rest into `assets/`.
 */
export function uploadFolderFor(target: ArticleFileEntry | null, file: { name: string }): string {
	if (target?.kind === 'directory') return target.path;
	const parent = target ? parentPath(target.path) : '';
	if (parent) return parent;
	return isImage(file.name) ? 'img' : 'assets';
}

/** A file in `img/` or `assets/` that the article does not point at, directly or through its folder. */
export function isUnused(entry: ArticleFileEntry, referenced: ReadonlySet<string>): boolean {
	if (entry.kind !== 'file' || !PUBLISHED_FOLDERS.includes(entry.path.split('/', 1)[0])) return false;
	return !referenced.has(entry.path);
}

/** How many places in the article point at `path` or, for a folder, at anything inside it. */
export function referenceCount(source: string, path: string): number {
	return findArticleReferences(source).filter((reference) => movedPath(reference.path, path, path) !== null).length;
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

export function formatSize(size: number): string {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
	return `${(size / 1024 / 1024).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
