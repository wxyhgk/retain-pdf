import { copyFile, lstat, mkdir, readdir, readFile, rm, rmdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { articleBundlePaths, resolveInside } from '../../../articles/bundle-paths.mjs';
import { stamp, stampTime } from '../articles/article-history.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * Earlier versions of an article's files (a script, an output, data in `img/` or `assets/`), kept before something
 * writes over them (an upload with 替换, a save in the Studio's file editor, a version brought back), as Notion and
 * SiYuan keep a page's: in the article's private `ai/` (never in git, never published), as
 * `ai/history/files/<time>-<reason>/<path>`.
 *
 * Reasons: `replaced` (written over), `before-restore` (what was there before an earlier version was brought back).
 *
 * Kept: the newest `FILE_HISTORY_LIMIT` of each file. A file larger than `FILE_HISTORY_LARGEST` is not kept (a
 * checkpoint of gigabytes), nor one the same as its newest version kept.
 */

export const FILE_HISTORY_REASONS = Object.freeze(['replaced', 'before-restore']);
export const FILE_HISTORY_LIMIT = 20;
export const FILE_HISTORY_LARGEST = 50 * 1024 * 1024;

const VERSION = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3})-([a-z-]+)$/u;

class FileHistoryError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

/** A file's path in the article checked: in `img/` or `assets/`, no step out of it. */
function filePath(path) {
	const segments = String(path ?? '').split('/');
	if (!['img', 'assets'].includes(segments[0]) || segments.length < 2 || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))) {
		throw new FileHistoryError(t('{path} 没有历史版本', { path }));
	}
	return segments;
}

export class ArticleFileHistory {
	/** @param {string} blogRoot */
	constructor(blogRoot) {
		this.blogRoot = blogRoot;
	}

	#folder(slug) {
		return resolveInside(articleBundlePaths(this.blogRoot, slug).ai, 'history', 'files');
	}

	/** The versions kept of the file at `path`, newest first: `{ id, time, reason, size }`. */
	async list(slug, path) {
		const segments = filePath(path);
		const folder = this.#folder(slug);
		let names;
		try {
			names = await readdir(folder);
		} catch (error) {
			if (error?.code === 'ENOENT') return [];
			throw error;
		}
		const versions = [];
		for (const id of names) {
			const match = VERSION.exec(id);
			if (!match || !FILE_HISTORY_REASONS.includes(match[2])) continue;
			const info = await lstat(resolveInside(folder, id, ...segments)).catch(() => null);
			if (info?.isFile()) versions.push({ id, time: stampTime(match[1]), reason: match[2], size: info.size });
		}
		return versions.sort((left, right) => right.id.localeCompare(left.id));
	}

	/** Where one version of the file is on disk (to read or send). */
	async version(slug, id, path) {
		if (typeof id !== 'string' || !VERSION.test(id)) throw new FileHistoryError(t('历史版本的名字无效'));
		const target = resolveInside(this.#folder(slug), id, ...filePath(path));
		const info = await lstat(target).catch(() => null);
		if (!info?.isFile()) throw new FileHistoryError(t('找不到这个历史版本'), 404);
		return target;
	}

	/**
	 * Keeps the file at `absolute` (the article's `path`, about to be written over) as a version of it; then forgets
	 * all but the newest `FILE_HISTORY_LIMIT` of it.
	 * @returns {Promise<{ id: string | null }>} the version kept, or null when none was (none there, too large, the same)
	 */
	async keep(slug, path, absolute, reason = 'replaced', now = new Date()) {
		if (!FILE_HISTORY_REASONS.includes(reason)) throw new FileHistoryError(t('历史版本的原因无效'));
		const segments = filePath(path);
		const info = await lstat(absolute).catch(() => null);
		if (!info?.isFile() || info.size > FILE_HISTORY_LARGEST) return { id: null };
		const kept = await this.list(slug, path);
		if (kept[0] && kept[0].size === info.size) {
			const [newest, current] = await Promise.all([readFile(await this.version(slug, kept[0].id, path)), readFile(absolute)]);
			if (newest.equals(current)) return { id: null };
		}
		const folder = this.#folder(slug);
		// Two in the same millisecond (two files of one drop): each its own, a millisecond on.
		let at = now.getTime();
		let id = `${stamp(new Date(at))}-${reason}`;
		while (await lstat(resolveInside(folder, id, ...segments)).catch(() => null)) id = `${stamp(new Date(++at))}-${reason}`;
		const target = resolveInside(folder, id, ...segments);
		await mkdir(dirname(target), { recursive: true });
		await copyFile(absolute, target);
		for (const old of [{ id }, ...kept].slice(FILE_HISTORY_LIMIT)) await this.#forget(folder, old.id, segments);
		return { id };
	}

	/** One version gone, and the folders it leaves empty. */
	async #forget(folder, id, segments) {
		await rm(resolveInside(folder, id, ...segments), { force: true });
		for (let depth = segments.length - 1; depth >= 0; depth -= 1) {
			const empty = await rmdir(resolveInside(folder, id, ...segments.slice(0, depth))).then(() => true, () => false);
			if (!empty) break;
		}
	}
}
