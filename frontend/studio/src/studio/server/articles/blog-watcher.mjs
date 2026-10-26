import { watch } from 'node:fs';
import { sep } from 'node:path';

/**
 * Tells the Studio what changed in `blog/`, whoever changed it: an AI in
 * the terminal, Finder, another editor, the Studio itself. Changes are
 * gathered for `delay` ms and reported together, per article, as paths
 * relative to it (`''` for the article folder itself). Hidden files and
 * the temporary files of atomic writes and uploads are left out.
 *
 * One recursive watch serves every listener; it runs only while someone listens.
 */
export class BlogWatcher {
	#watcher = null;
	#listeners = new Set();
	#pending = new Map();
	#timer = null;

	constructor(blogRoot, { delay = 120, watchImpl = watch } = {}) {
		this.blogRoot = blogRoot;
		this.delay = delay;
		this.watchImpl = watchImpl;
	}

	/** Calls `listener` with `[{ slug, paths }]` after changes; returns the function that stops it. */
	subscribe(listener) {
		this.#listeners.add(listener);
		if (!this.#watcher) this.#start();
		return () => {
			this.#listeners.delete(listener);
			if (!this.#listeners.size) this.close();
		};
	}

	close() {
		this.#watcher?.close();
		this.#watcher = null;
		clearTimeout(this.#timer);
		this.#timer = null;
		this.#pending.clear();
	}

	#start() {
		this.#watcher = this.watchImpl(this.blogRoot, { recursive: true }, (_type, filename) => this.#record(filename));
		this.#watcher.on?.('error', () => {
			// The folder went away or the system ran out of watches; the next listener starts over.
			this.close();
		});
	}

	#record(filename) {
		if (!filename) return;
		const segments = String(filename).split(sep).join('/').split('/').filter(Boolean);
		if (!segments.length || segments.some(isIgnored)) return;
		const [slug, ...rest] = segments;
		if (!this.#pending.has(slug)) this.#pending.set(slug, new Set());
		this.#pending.get(slug).add(rest.join('/'));
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.#flush(), this.delay);
	}

	#flush() {
		this.#timer = null;
		const changes = [...this.#pending].map(([slug, paths]) => ({ slug, paths: [...paths].sort() }));
		this.#pending.clear();
		if (!changes.length) return;
		for (const listener of this.#listeners) listener(changes);
	}
}

/** `.DS_Store`, `.upload-…` and the like, and `index.md.<uuid>.tmp` from an atomic write. */
function isIgnored(segment) {
	return segment.startsWith('.') || segment.endsWith('.tmp');
}
