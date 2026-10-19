import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { SLUG_PATTERN } from '@blog/markdown/articles/rules.mjs';
import { articleBundlePaths } from '../../articles/bundle-paths.mjs';

/** Files looked at in one article's folder; past this, only how many there are. */
const MAX_FILES = 5000;

/** Where the Studio's articles are: `blog/`, or the browser tests' copy of their fixtures. */
export function studioBlogRoot(projectRoot) {
	return process.env.STUDIO_BLOG_DIR ? resolve(process.env.STUDIO_BLOG_DIR) : resolve(projectRoot, 'blog');
}

/**
 * A short mark of what the Studio shows with `slug` open: every article's
 * `index.md` (the sidebar lists their titles) and every file in that
 * article's folder, by size and time of change. The page keeps a picture of
 * itself under this mark (page-snapshot.ts) and shows it on the next visit
 * only while the mark is the same, so it never shows what is no longer on disk.
 */
export async function pageVersion(blogRoot, slug) {
	const hash = createHash('sha256');
	for (const name of await names(blogRoot)) {
		if (SLUG_PATTERN.test(name)) hash.update(`${name}\0${await mark(join(blogRoot, name, 'index.md'))}\n`);
	}
	hash.update('\0\0');
	const seen = await addFolder(hash, articleBundlePaths(blogRoot, slug).directory, '', 0);
	hash.update(`\0${seen}`);
	return hash.digest('base64url').slice(0, 22);
}

async function names(folder) {
	try {
		return (await readdir(folder)).sort();
	} catch (error) {
		if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return [];
		throw error;
	}
}

async function mark(file) {
	try {
		const stats = await lstat(file);
		return `${stats.isDirectory() ? 'd' : stats.isSymbolicLink() ? 'l' : 'f'}${stats.size}:${stats.mtimeMs}`;
	} catch (error) {
		if (error?.code === 'ENOENT') return '-';
		throw error;
	}
}

/** Adds what is in `folder` (`path` within the article) to `hash`; how many entries it saw. */
async function addFolder(hash, folder, path, seen) {
	for (const name of await names(folder)) {
		if (seen >= MAX_FILES) return seen + 1;
		const entryPath = path ? `${path}/${name}` : name;
		const entryMark = await mark(join(folder, name));
		hash.update(`${entryPath}\0${entryMark}\n`);
		seen += 1;
		if (entryMark.startsWith('d')) seen = await addFolder(hash, join(folder, name), entryPath, seen);
	}
	return seen;
}
