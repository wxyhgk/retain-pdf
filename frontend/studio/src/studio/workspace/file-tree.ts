import { findArticleReferences, movedPath } from '../../articles/article-references.mjs';
import { PUBLISHED_FOLDERS } from '../../articles/rules.mjs';
import { fileName, isImage, parentPath } from '../article-files.ts';
import type { ArticleFileEntry } from '../types.ts';

/** One row of the file panel's tree. */
export type FileNode = {
	entry: ArticleFileEntry;
	name: string;
	depth: number;
	children: FileNode[];
};

/** The article's own text first, then its folders, then the files only the Studio writes. */
const TOP_LEVEL_ORDER = ['index.md', 'img', 'assets', 'ai', 'article.views.json'];
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

export function formatSize(size: number): string {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
	return `${(size / 1024 / 1024).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
