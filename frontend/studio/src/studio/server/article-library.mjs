import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { articleBundlePaths, resolveInside } from '../../articles/bundle-paths.mjs';
import { BIBLIOGRAPHY_PATH, parseBibtex, plainTex } from '@blog/markdown/references/bibtex.mjs';
import { atomicWriteText } from './atomic-write.mjs';

/**
 * An article's library, `assets/refs.bib`, as the Studio adds to it: a work
 * by its DOI, its BibTeX asked of doi.org, under a short key of its first
 * author and year (`becke1993`, then `becke1993a`…).
 */

const DOI = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/\S+)$/iu;

/** `10.1063/1.464913` from what was pasted (a bare DOI, `doi:…`, or its address); null when it is none. */
export function doiOf(text) {
	return DOI.exec(String(text ?? '').trim())?.[1]?.replace(/[.,;]+$/u, '') ?? null;
}

class LibraryError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

/** `becke1993` for an entry: its first author's family name, ASCII, and its year. */
export function shortKey(entry) {
	const first = String(entry.fields.author ?? entry.fields.editor ?? '').split(/\s+and\s+/iu)[0] ?? '';
	const plain = plainTex(first);
	const family = plain.includes(',') ? plain.split(',')[0] : (plain.split(' ').pop() ?? '');
	const ascii = family.normalize('NFD').replace(/[^A-Za-z]/gu, '').toLowerCase() || 'ref';
	const year = /\d{4}/u.exec(plainTex(entry.fields.year ?? entry.fields.date ?? ''))?.[0] ?? '';
	return `${ascii}${year}`;
}

export class ArticleLibrary {
	/**
	 * @param {string} blogRoot
	 * @param {{ exclusive: (slug: string, task: () => Promise<unknown>) => Promise<unknown> }} articles the repository, for one write at a time
	 * @param {typeof fetch} [fetchBibtex]
	 */
	constructor(blogRoot, articles, fetchBibtex = globalThis.fetch) {
		this.blogRoot = blogRoot;
		this.articles = articles;
		this.fetch = fetchBibtex;
	}

	#path(slug) {
		return resolveInside(articleBundlePaths(this.blogRoot, slug).directory, ...BIBLIOGRAPHY_PATH.split('/'));
	}

	async #read(slug) {
		try {
			return await readFile(this.#path(slug), 'utf8');
		} catch (error) {
			if (error?.code === 'ENOENT') return '';
			throw error;
		}
	}

	/** The BibTeX doi.org has for a DOI. */
	async #lookUp(doi) {
		let response;
		try {
			response = await this.fetch(`https://doi.org/${encodeURI(doi)}`, {
				headers: { Accept: 'application/x-bibtex; charset=utf-8' },
				redirect: 'follow',
				signal: AbortSignal.timeout(15_000),
			});
		} catch {
			throw new LibraryError('连不上 doi.org，检查一下网络', 502);
		}
		if (response.status === 404) throw new LibraryError(`doi.org 上没有 ${doi}`, 404);
		if (!response.ok) throw new LibraryError(`doi.org 没有给出这篇的 BibTeX（${response.status}）`, 502);
		const text = await response.text();
		const entry = [...parseBibtex(text).values()][0];
		if (!entry) throw new LibraryError('doi.org 给的不是 BibTeX', 502);
		return { text, entry };
	}

	/**
	 * Adds the work with this DOI to the article's library, unless it is
	 * there already; its key either way.
	 * @returns {Promise<{ key: string; added: boolean }>}
	 */
	async addDoi(slug, pasted) {
		const doi = doiOf(pasted);
		if (!doi) throw new LibraryError('这不像一个 DOI（形如 10.1063/1.464913）');
		const before = parseBibtex(await this.#read(slug));
		const same = (entries) => [...entries.values()].find((entry) => doiOf(entry.fields.doi ?? '')?.toLowerCase() === doi.toLowerCase());
		const known = same(before);
		if (known) return { key: known.key, added: false };
		const { text, entry } = await this.#lookUp(doi);
		return this.articles.exclusive(slug, async () => {
			const current = await this.#read(slug);
			const entries = parseBibtex(current);
			const there = same(entries);
			if (there) return { key: there.key, added: false };
			const base = shortKey(entry);
			let key = base;
			for (let letter = 0; entries.has(key); letter += 1) key = `${base}${String.fromCharCode(97 + letter)}`;
			// The entry as doi.org wrote it, under the short key.
			const written = text.trim().replace(/^(@\s*[A-Za-z]+\s*[{(]\s*)[^,]*,/u, `$1${key},`);
			const path = this.#path(slug);
			await mkdir(dirname(path), { recursive: true });
			await atomicWriteText(path, `${current.replace(/\s*$/u, current ? '\n\n' : '')}${written}\n`);
			return { key, added: true };
		});
	}
}
