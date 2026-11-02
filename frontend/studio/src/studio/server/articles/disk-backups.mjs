import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { watchWrites } from '../files/atomic-write.mjs';

/** How many of the newest versions are looked through for the same text. */
const RECENT = 5;

/**
 * What an article was before something outside the Studio changed it (an AI's tools, the terminal, another editor),
 * kept in its history (`before-change`) whether it is open or not: the Studio knows each article's `index.md` as it
 * last saw it, and when the disk has something else, what it knew is kept first. What the Studio writes itself
 * (`atomicWriteText`) is known as it lands, so the author's own saves keep nothing here (they keep a version a while,
 * `keepWritten`). The editor keeps one too when the article is open; the same text is not kept twice.
 */
export class DiskBackups {
	/** By folder name: its `index.md` as last seen. */
	#known = new Map();
	/** By folder name: the check going on, so two do not keep at once. */
	#checks = new Map();
	#stops = [];

	/**
	 * @param {string} blogRoot
	 * @param {import('./article-history.mjs').ArticleHistory} history
	 * @param {{ subscribe(listener: (changes: { slug: string, paths: string[] }[]) => void): () => void }} watcher
	 */
	constructor(blogRoot, history, watcher) {
		this.blogRoot = blogRoot;
		this.history = history;
		this.watcher = watcher;
	}

	/** Reads every article once, then follows them; resolves when they are all known. */
	async start() {
		this.#stops.push(
			watchWrites((path, content) => {
				const slug = this.#slugOf(path);
				if (slug) this.#known.set(slug, content);
			}),
			this.watcher.subscribe((changes) => {
				for (const { slug, paths } of changes) if (paths.includes('') || paths.includes('index.md')) void this.check(slug);
			}),
		);
		const folders = await readdir(this.blogRoot, { withFileTypes: true }).catch(() => []);
		await Promise.all(
			folders
				.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
				.map(async ({ name }) => {
					const source = await this.#read(name);
					// Written by the Studio while this was reading: that is newer.
					if (source !== null && !this.#known.has(name)) this.#known.set(name, source);
				}),
		);
	}

	stop() {
		for (const stop of this.#stops.splice(0)) stop();
	}

	/** Looks at an article's `index.md` again; keeps what it was when it is something else now. */
	check(slug) {
		const run = (this.#checks.get(slug) ?? Promise.resolve()).then(async () => {
			const source = await this.#read(slug);
			const before = this.#known.get(slug);
			if (source === null) this.#known.delete(slug);
			else this.#known.set(slug, source);
			if (source === null || before === undefined || before === source) return;
			// The editor, the article open, may have kept it already (and the edits not saved after it).
			const size = Buffer.byteLength(before);
			for (const entry of (await this.history.list(slug)).slice(0, RECENT)) if (entry.size === size && (await this.history.read(slug, entry.name)) === before) return;
			await this.history.keep(slug, before, 'before-change');
		});
		const done = run.catch((error) => console.warn(`[studio] ${error instanceof Error ? error.message : error}`));
		this.#checks.set(slug, done);
		void done.then(() => {
			if (this.#checks.get(slug) === done) this.#checks.delete(slug);
		});
		return done;
	}

	async #read(slug) {
		try {
			return await readFile(join(this.blogRoot, slug, 'index.md'), 'utf8');
		} catch {
			return null;
		}
	}

	/** The folder of `<blogRoot>/<slug>/index.md`; null for any other file. */
	#slugOf(path) {
		const parts = relative(this.blogRoot, path).split(sep);
		return parts.length === 2 && parts[1] === 'index.md' && !parts[0].startsWith('.') && parts[0] !== '..' ? parts[0] : null;
	}
}
