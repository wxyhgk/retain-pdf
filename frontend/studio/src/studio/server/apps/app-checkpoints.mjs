import { execFile } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';

import { t } from '@blog/i18n/index.mjs';

const run = promisify(execFile);

/**
 * An app's code as it was, kept before an AI changes it (its 「让 AI 修」, 「AI」) and when the author asks: brought
 * back with one click (docs/apps-design.md). A checkpoint is a copy of the app's own files, those git would keep (in a
 * repository: tracked, and new ones not ignored; else all but node_modules and the like), in the Studio's cache (out of
 * git), the latest few of each app. Going back keeps one of how it was first, so going back can be undone too.
 *
 * @typedef {{ stamp: string, when: string, why: string, files: number }} Checkpoint
 */

/** Checkpoints kept for an app. */
const KEPT = 12;
/** A file larger than this is left out (data, a build); one checkpoint no larger than `TOTAL`. */
const LARGEST = 5 * 1024 * 1024;
const TOTAL = 100 * 1024 * 1024;
/** Folders never in a checkpoint (dependencies, builds, tools' own). */
const SKIPPED = new Set(['node_modules', '.git', 'dist', '.vite', '.astro', '.claude', '.studio-cache', 'test-results', 'playwright-report']);

export class AppCheckpoints {
	/** @param {string} folder where they are kept (the Studio's cache) */
	constructor(folder) {
		this.folder = folder;
	}

	/** An app's files to keep, as paths under `root`. */
	async #files(root) {
		let listed = null;
		try {
			const { stdout } = await run('git', ['-C', root, 'ls-files', '-co', '--exclude-standard', '-z'], { maxBuffer: 64 * 1024 * 1024 });
			listed = stdout.split('\0').filter(Boolean);
		} catch {
			// Not in a repository: its folder, walked.
		}
		if (!listed) listed = await walk(root);
		const kept = [];
		let total = 0;
		for (const path of listed) {
			if (path.split('/').some((part) => SKIPPED.has(part))) continue;
			const info = await stat(join(root, path)).catch(() => null);
			if (!info?.isFile() || info.size > LARGEST) continue;
			total += info.size;
			if (total > TOTAL) throw Object.assign(new Error(t('这个小程序的文件太多了（超过 {limit} MB），没有存检查点', { limit: TOTAL / 1024 / 1024 })), { statusCode: 413 });
			kept.push(path);
		}
		return kept;
	}

	/** Keeps the app's files under `root` as they are now (`why`: what for); the oldest beyond the latest few let go. */
	async save(id, root, why) {
		const files = await this.#files(root);
		const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
		const place = join(this.folder, id, stamp);
		for (const path of files) {
			await mkdir(dirname(join(place, 'files', path)), { recursive: true });
			await cp(join(root, path), join(place, 'files', path));
		}
		/** @type {Checkpoint & { paths: string[] }} */
		const kept = { stamp, when: new Date().toISOString(), why, files: files.length, paths: files };
		await mkdir(place, { recursive: true });
		await writeFile(join(place, 'checkpoint.json'), JSON.stringify(kept));
		const all = await this.list(id);
		for (const old of all.slice(KEPT)) await rm(join(this.folder, id, old.stamp), { recursive: true, force: true });
		return { stamp, when: kept.when, why, files: files.length };
	}

	/** The app's checkpoints, the latest first. @returns {Promise<Checkpoint[]>} */
	async list(id) {
		const stamps = await readdir(join(this.folder, id)).catch(() => []);
		const found = [];
		for (const stamp of stamps) {
			const kept = await readFile(join(this.folder, id, stamp, 'checkpoint.json'), 'utf8').then(JSON.parse, () => null);
			if (kept) found.push({ stamp: kept.stamp, when: kept.when, why: kept.why, files: kept.files });
		}
		return found.sort((a, b) => b.stamp.localeCompare(a.stamp));
	}

	/** Puts the app's files under `root` back as they were at `stamp`: those made since removed; how they were before kept first. */
	async restore(id, root, stamp) {
		const place = join(this.folder, id, String(stamp));
		if (relative(join(this.folder, id), place).split(sep).includes('..')) throw Object.assign(new Error(t('没有这个检查点')), { statusCode: 404 });
		const kept = await readFile(join(place, 'checkpoint.json'), 'utf8').then(JSON.parse, () => null);
		if (!kept) throw Object.assign(new Error(t('没有这个检查点')), { statusCode: 404 });
		await this.save(id, root, t('回到 {when} 的检查点之前', { when: kept.when }));
		const wanted = new Set(kept.paths);
		for (const path of await this.#files(root)) if (!wanted.has(path)) await rm(join(root, path), { force: true });
		for (const path of kept.paths) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await cp(join(place, 'files', path), join(root, path));
		}
		return { stamp: kept.stamp, files: kept.paths.length };
	}
}

/** The files under `root` (paths relative to it), the skipped folders left out. */
async function walk(root, under = '') {
	const entries = await readdir(join(root, under), { withFileTypes: true }).catch(() => []);
	const found = [];
	for (const entry of entries) {
		if (SKIPPED.has(entry.name)) continue;
		const path = under ? `${under}/${entry.name}` : entry.name;
		if (entry.isDirectory()) found.push(...(await walk(root, path)));
		else if (entry.isFile()) found.push(path);
	}
	return found;
}
