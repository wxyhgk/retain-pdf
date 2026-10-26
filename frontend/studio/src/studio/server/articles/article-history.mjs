import { lstat, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';

import { ArticleNotFoundError } from './article-repository.mjs';
import { articleBundlePaths, resolveInside } from '../../../articles/bundle-paths.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * Earlier versions of an article's `index.md`, kept in its private `ai/`
 * folder (never published) as `ai/history/<time>-<reason>.md`, so that a
 * change made on disk (the terminal, an AI, another editor) or a choice
 * made in review can always be gone back on; and, as Notion keeps a page's
 * history, what was written, every while (`edit`).
 *
 * Reasons: `before-change` (what was saved before a change on disk),
 * `unsaved` (edits not yet saved when the disk changed under them),
 * `before-restore` (what was there before an earlier version was brought back),
 * `edit` (the article as it was when a save came, `EDIT_EVERY` or more after the last version kept).
 *
 * Kept: the newest `HISTORY_LIMIT` of the first three. Of the versions kept
 * while writing, all of the last day, then the last of each day for a month,
 * and no more than `EDIT_BYTES` of them (a book's are megabytes each).
 */

export const HISTORY_REASONS = Object.freeze(['before-change', 'unsaved', 'before-restore', 'edit']);

/** How many versions an article keeps, besides those kept while writing. */
export const HISTORY_LIMIT = 50;

/** How long writing goes on between two versions kept of it, in ms. */
export const EDIT_EVERY = 10 * 60_000;

/** How long the versions kept while writing are all kept, and how long the last of each day is, in ms. */
const ALL_FOR = 24 * 60 * 60_000;
const DAILY_FOR = 30 * 24 * 60 * 60_000;

/** How many bytes of versions kept while writing an article keeps at most. */
const EDIT_BYTES = 50 * 1024 * 1024;

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
		if (typeof name !== 'string' || !NAME.test(name)) throw new HistoryError(t('历史版本的名字无效'));
		const folder = await this.#folder(slug);
		try {
			return await readFile(resolveInside(folder, name), 'utf8');
		} catch (error) {
			if (error?.code === 'ENOENT') throw new HistoryError(t('找不到这个历史版本'), 404);
			throw error;
		}
	}

	/**
	 * Keeps `source` as a version of the article, unless the newest kept one
	 * is the same text; then forgets all but the newest `HISTORY_LIMIT`.
	 * @returns {Promise<{ name: string | null }>} the version kept, or null when it was there already
	 */
	async keep(slug, source, reason, now = new Date()) {
		if (typeof source !== 'string') throw new HistoryError(t('文章内容必须是文本'));
		if (!HISTORY_REASONS.includes(reason)) throw new HistoryError(t('历史版本的原因无效'));
		const folder = await this.#folder(slug);
		const kept = await this.list(slug);
		if (kept[0] && (await this.read(slug, kept[0].name)) === source) return { name: null };
		await mkdir(folder, { recursive: true });
		// Two in the same millisecond: the later one a millisecond on, so the order stays the order they came in.
		let at = now.getTime();
		while (kept.some((entry) => entry.name.startsWith(stamp(new Date(at))))) at += 1;
		const name = `${stamp(new Date(at))}-${reason}.md`;
		await writeFile(resolveInside(folder, name), source, { flag: 'wx' });
		const entries = [{ name, time: at, reason, size: Buffer.byteLength(source) }, ...kept];
		for (const old of forgotten(entries, now.getTime())) await rm(resolveInside(folder, old.name), { force: true });
		return { name };
	}

	/**
	 * Keeps `source`, the article as it is before a save, as a version written
	 * (`edit`), when the newest version kept is `every` ms old or older: one a
	 * while, however often the article is saved as it is typed.
	 * @returns {Promise<{ name: string | null }>} the version kept, or null when none was
	 */
	async keepWritten(slug, source, now = new Date(), every = EDIT_EVERY) {
		const [newest] = await this.list(slug);
		if (newest && now.getTime() - newest.time < every) return { name: null };
		return this.keep(slug, source, 'edit', now);
	}
}

/** Of `entries` (newest first), those no longer kept at `now`. */
function forgotten(entries, now) {
	const gone = entries.filter((entry) => entry.reason !== 'edit').slice(HISTORY_LIMIT);
	const days = new Set();
	let bytes = 0;
	for (const entry of entries.filter((candidate) => candidate.reason === 'edit')) {
		const age = now - entry.time;
		// Older than a day: the newest of its day only (the entries go newest first).
		const day = new Date(entry.time).toDateString();
		const kept = age < ALL_FOR || (age < DAILY_FOR && !days.has(day));
		if (age >= ALL_FOR) days.add(day);
		bytes += kept ? entry.size : 0;
		if (!kept || bytes > EDIT_BYTES) gone.push(entry);
	}
	return gone;
}
