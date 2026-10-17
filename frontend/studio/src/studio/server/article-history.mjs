import { lstat, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';

import { ArticleNotFoundError } from './article-repository.mjs';
import { articleBundlePaths, resolveInside } from '../../articles/bundle-paths.mjs';

/**
 * Earlier versions of an article's `index.md`, kept in its private `ai/`
 * folder (never published) as `ai/history/<time>-<reason>.md`, so that a
 * change made on disk (the terminal, an AI, another editor) or a choice
 * made in review can always be gone back on. The newest few are kept.
 *
 * Reasons: `before-change` (what was saved before a change on disk),
 * `unsaved` (edits not yet saved when the disk changed under them),
 * `before-restore` (what was there before an earlier version was brought back).
 */

export const HISTORY_REASONS = Object.freeze(['before-change', 'unsaved', 'before-restore']);

/** How many versions an article keeps. */
export const HISTORY_LIMIT = 50;

const NAME = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3})-([a-z-]+)\.md$/u;

class HistoryError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

/** `2026-10-17T14-03-22-123` for a moment: sorts as it reads, and is a file name everywhere. */
function stamp(date) {
	return date.toISOString().replace(/\.(\d{3})Z$/u, '-$1').replaceAll(':', '-');
}

/** The moment back from a stamp. */
function stampTime(text) {
	const [, date, hour, minute, second, ms] = /^(.+)T(\d{2})-(\d{2})-(\d{2})-(\d{3})$/u.exec(text) ?? [];
	return Date.parse(`${date}T${hour}:${minute}:${second}.${ms}Z`);
}

export class ArticleHistory {
	/** @param {string} blogRoot */
	constructor(blogRoot) {
		this.blogRoot = blogRoot;
	}

	async #folder(slug) {
		const paths = articleBundlePaths(this.blogRoot, slug);
		try {
			if (!(await lstat(paths.directory)).isDirectory()) throw new ArticleNotFoundError();
		} catch (error) {
			if (error?.code === 'ENOENT') throw new ArticleNotFoundError();
			throw error;
		}
		return resolveInside(paths.ai, 'history');
	}

	/** The article's kept versions, newest first. */
	async list(slug) {
		const folder = await this.#folder(slug);
		let names;
		try {
			names = await readdir(folder);
		} catch (error) {
			if (error?.code === 'ENOENT') return [];
			throw error;
		}
		const entries = [];
		for (const name of names) {
			const match = NAME.exec(name);
			if (!match || !HISTORY_REASONS.includes(match[2])) continue;
			const info = await lstat(resolveInside(folder, name));
			if (!info.isFile()) continue;
			entries.push({ name, time: stampTime(match[1]), reason: match[2], size: info.size });
		}
		return entries.sort((left, right) => right.name.localeCompare(left.name));
	}

	/** One kept version's text. */
	async read(slug, name) {
		if (typeof name !== 'string' || !NAME.test(name)) throw new HistoryError('历史版本的名字无效');
		const folder = await this.#folder(slug);
		try {
			return await readFile(resolveInside(folder, name), 'utf8');
		} catch (error) {
			if (error?.code === 'ENOENT') throw new HistoryError('找不到这个历史版本', 404);
			throw error;
		}
	}

	/**
	 * Keeps `source` as a version of the article, unless the newest kept one
	 * is the same text; then forgets all but the newest `HISTORY_LIMIT`.
	 * @returns {Promise<{ name: string | null }>} the version kept, or null when it was there already
	 */
	async keep(slug, source, reason, now = new Date()) {
		if (typeof source !== 'string') throw new HistoryError('文章内容必须是文本');
		if (!HISTORY_REASONS.includes(reason)) throw new HistoryError('历史版本的原因无效');
		const folder = await this.#folder(slug);
		const kept = await this.list(slug);
		if (kept[0] && (await this.read(slug, kept[0].name)) === source) return { name: null };
		await mkdir(folder, { recursive: true });
		// Two in the same millisecond: the later one a millisecond on, so the order stays the order they came in.
		let at = now.getTime();
		while (kept.some((entry) => entry.name.startsWith(stamp(new Date(at))))) at += 1;
		const name = `${stamp(new Date(at))}-${reason}.md`;
		await writeFile(resolveInside(folder, name), source, { flag: 'wx' });
		for (const old of [{ name }, ...kept].slice(HISTORY_LIMIT)) await rm(resolveInside(folder, old.name), { force: true });
		return { name };
	}
}
