import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

import JSZip from 'jszip';
import * as XLSX from 'xlsx';

/**
 * The drive's files as text, to search and for an AI to read: Word, PowerPoint
 * and Excel files, PDFs (through poppler's `pdftotext`, when the machine has
 * it) and plain text (logs, inputs, notes) each get a `.txt` of their words in
 * `.studio-text/` in the drive, at the same path (`组会/第3次.pptx.txt`).
 * `index.json` there says which version of each file it was made from, so
 * only what changed is read again.
 */

export const TEXT_FOLDER = '.studio-text';
const MANIFEST = 'index.json';
const VERSION = 1;
/** Files bigger than this are not read for their words. */
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
/** How much of a file's words are kept. */
const MAX_TEXT_CHARS = 2_000_000;

/** Files read as they are. */
const PLAIN = new Set(['txt', 'md', 'markdown', 'log', 'out', 'csv', 'tsv', 'json', 'yaml', 'yml', 'toml', 'tex', 'bib', 'py', 'sh', 'r', 'jl', 'm', 'c', 'cpp', 'f', 'f90', 'xyz', 'gjf', 'com', 'inp', 'pdb', 'mol', 'mol2', 'sdf', 'cif', 'html', 'xml']);
const SHEETS = new Set(['xlsx', 'xlsm', 'xls', 'ods']);

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** XML text with its entities read. */
function unescapeXml(text) {
	return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/giu, (whole, decimal, hex, name) =>
		decimal ? String.fromCodePoint(Number(decimal)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : (ENTITIES[name] ?? whole));
}

/**
 * The words of an Office XML part: only its runs of text (`<w:t>`, `<a:t>`),
 * not the numbers a drawing's position is written in; each paragraph on a
 * line of its own, tabs and breaks kept.
 */
function paragraphs(xml, prefix) {
	const token = new RegExp(`<${prefix}:t(?:\\s[^>]*)?>([^<]*)</${prefix}:t>|<${prefix}:t\\s*/>|<${prefix}:(tab|br)\\b[^>]*/>|</${prefix}:p>`, 'gu');
	let text = '';
	for (const match of xml.matchAll(token)) {
		if (match[1] !== undefined) text += unescapeXml(match[1]);
		else if (match[2] === 'tab') text += '\t';
		else if (match[2] === 'br' || match[0].startsWith('</')) text += '\n';
	}
	return text
		.split('\n')
		.map((line) => line.trimEnd())
		.filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
		.join('\n')
		.trim();
}

const byNumber = (pattern) => (left, right) => Number(pattern.exec(left)?.[1] ?? 0) - Number(pattern.exec(right)?.[1] ?? 0);

async function docxText(bytes) {
	const zip = await JSZip.loadAsync(bytes);
	const parts = ['word/document.xml', ...Object.keys(zip.files).filter((name) => /^word\/(footnotes|endnotes)\.xml$/u.test(name))];
	const texts = [];
	for (const part of parts) {
		const xml = await zip.file(part)?.async('string');
		if (xml) texts.push(paragraphs(xml, 'w'));
	}
	return texts.filter(Boolean).join('\n\n');
}

async function pptxText(bytes) {
	const zip = await JSZip.loadAsync(bytes);
	const slide = /^ppt\/slides\/slide(\d+)\.xml$/u;
	const slides = Object.keys(zip.files).filter((name) => slide.test(name)).sort(byNumber(slide));
	const texts = [];
	for (const [index, name] of slides.entries()) {
		const words = paragraphs(await zip.file(name).async('string'), 'a');
		const note = zip.file(`ppt/notesSlides/notesSlide${slide.exec(name)[1]}.xml`);
		const spoken = note ? paragraphs(await note.async('string'), 'a').replace(/^\d+$/mu, '').trim() : '';
		texts.push([`## 第 ${index + 1} 张`, words, spoken ? `备注：${spoken}` : ''].filter(Boolean).join('\n'));
	}
	return texts.join('\n\n');
}

function sheetText(bytes) {
	const book = XLSX.read(bytes, { type: 'buffer' });
	return book.SheetNames.map((name) => `## 工作表 ${name}\n${XLSX.utils.sheet_to_csv(book.Sheets[name], { blankrows: false }).trim()}`).join('\n\n');
}

/** Where poppler's `pdftotext` is; null without it. */
export function findPdftotext() {
	const candidates = [process.env.PDFTOTEXT, '/opt/homebrew/bin/pdftotext', '/usr/local/bin/pdftotext', '/usr/bin/pdftotext'].filter(Boolean);
	return candidates.find((path) => existsSync(path)) ?? null;
}

function pdfText(file, pdftotext) {
	return new Promise((resolve, reject) => {
		execFile(pdftotext, ['-enc', 'UTF-8', '-layout', file, '-'], { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
			if (error) reject(new Error(`pdftotext 读不了这个 PDF：${error.message}`));
			else resolve(String(stdout).replace(/\f/gu, '\n\n').replace(/[ \t]+$/gmu, '').trim());
		});
	});
}

/** Whether this kind of file has words to read (a PDF only with `pdftotext`). */
export function hasText(path, { pdftotext = null } = {}) {
	const extension = extname(path).slice(1).toLowerCase();
	return extension === 'docx' || extension === 'pptx' || SHEETS.has(extension) || PLAIN.has(extension) || (extension === 'pdf' && Boolean(pdftotext));
}

/** The words of the file at `file`; null for a kind with none. */
export async function extractText(file, { pdftotext = null } = {}) {
	const extension = extname(file).slice(1).toLowerCase();
	if (!hasText(file, { pdftotext })) return null;
	if (extension === 'pdf') return pdfText(file, pdftotext);
	const bytes = await readFile(file);
	if (extension === 'docx') return docxText(bytes);
	if (extension === 'pptx') return pptxText(bytes);
	if (SHEETS.has(extension)) return sheetText(bytes);
	return bytes.toString('utf8');
}

/** The part of `text` around `at`, on one line, for a search result. */
function snippetAt(text, at, length) {
	const start = Math.max(0, text.lastIndexOf('\n', at) + 1, at - 40);
	const end = Math.min(text.length, at + length + 60);
	const lineEnd = text.indexOf('\n', at + length);
	const piece = text.slice(start, lineEnd === -1 ? end : Math.min(end, lineEnd)).replace(/\s+/gu, ' ').trim();
	return `${start > 0 && text[start - 1] !== '\n' ? '…' : ''}${piece}`;
}

/**
 * The drive's text, kept up to date by `refresh` and searched by `search`.
 * One refresh runs at a time; a search waits a moment for one and then
 * answers from what is there.
 */
export class DriveText {
	/** @param {{ root(): Promise<string | null> }} drive */
	constructor(drive, { pdftotext = findPdftotext(), staleAfter = 30_000 } = {}) {
		this.drive = drive;
		this.pdftotext = pdftotext;
		this.staleAfter = staleAfter;
		this.refreshing = null;
		this.finished = new Map();
		/** Each file's words, read once: path → { stamp, text }. */
		this.cache = new Map();
	}

	async #manifest(root) {
		try {
			const read = JSON.parse(await readFile(join(root, TEXT_FOLDER, MANIFEST), 'utf8'));
			return read?.version === VERSION && read.files ? read : { version: VERSION, files: {} };
		} catch {
			return { version: VERSION, files: {} };
		}
	}

	async #save(root, manifest) {
		const target = join(root, TEXT_FOLDER, MANIFEST);
		await mkdir(dirname(target), { recursive: true });
		const temporary = `${target}.${process.pid}.tmp`;
		await writeFile(temporary, JSON.stringify(manifest));
		await rename(temporary, target);
	}

	/** Every file of the drive, hidden ones and links left out: path → { size, modified }. */
	async #files(root, folder = '', found = new Map()) {
		for (const entry of await readdir(join(root, folder), { withFileTypes: true }).catch(() => [])) {
			if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
			const path = folder ? `${folder}/${entry.name}` : entry.name;
			if (entry.isDirectory()) await this.#files(root, path, found);
			else if (entry.isFile()) {
				const info = await lstat(join(root, path)).catch(() => null);
				if (info) found.set(path, { size: info.size, modified: Math.round(info.mtimeMs) });
			}
		}
		return found;
	}

	/** Reads again what changed since the last time, and forgets what is gone. */
	refresh() {
		this.refreshing ??= this.#refresh().finally(() => {
			this.refreshing = null;
		});
		return this.refreshing;
	}

	async #refresh() {
		const root = await this.drive.root();
		if (!root) return;
		const manifest = await this.#manifest(root);
		const files = await this.#files(root);
		let unsaved = 0;
		for (const path of Object.keys(manifest.files)) {
			if (files.has(path)) continue;
			delete manifest.files[path];
			this.cache.delete(path);
			await rm(join(root, TEXT_FOLDER, `${path}.txt`), { force: true });
			unsaved += 1;
		}
		for (const [path, { size, modified }] of files) {
			const known = manifest.files[path];
			if (known && known.size === size && known.modified === modified && (known.text || !hasText(path, this))) continue;
			const entry = { size, modified, text: false };
			if (hasText(path, this) && size <= MAX_SOURCE_BYTES) {
				try {
					const text = (await extractText(join(root, path), this))?.slice(0, MAX_TEXT_CHARS) ?? '';
					const target = join(root, TEXT_FOLDER, `${path}.txt`);
					await mkdir(dirname(target), { recursive: true });
					await writeFile(target, text);
					entry.text = true;
				} catch (error) {
					entry.error = error instanceof Error ? error.message : String(error);
				}
			}
			manifest.files[path] = entry;
			this.cache.delete(path);
			unsaved += 1;
			if (unsaved >= 20) {
				await this.#save(root, manifest);
				unsaved = 0;
			}
		}
		if (unsaved || !existsSync(join(root, TEXT_FOLDER, MANIFEST))) await this.#save(root, manifest);
		this.finished.set(root, Date.now());
	}

	/** Starts a refresh when the last one is old, and waits for it up to `wait` ms; whether one is still running. */
	async #fresh(root, wait) {
		const stale = Date.now() - (this.finished.get(root) ?? 0) > this.staleAfter || !existsSync(join(root, TEXT_FOLDER, MANIFEST));
		if (!this.refreshing && stale) void this.refresh().catch(() => {});
		if (this.refreshing) await Promise.race([this.refreshing.catch(() => {}), new Promise((resolve) => setTimeout(resolve, wait))]);
		return Boolean(this.refreshing);
	}

	async #text(root, path, stamp) {
		const cached = this.cache.get(path);
		if (cached?.stamp === stamp) return cached.text;
		const text = await readFile(join(root, TEXT_FOLDER, `${path}.txt`), 'utf8').catch(() => '');
		this.cache.set(path, { stamp, text });
		return text;
	}

	/**
	 * Files whose name or words hold `query` (case aside): those by name
	 * first, each with the words around its first match.
	 * @returns {Promise<{ results: Array<{ path: string; inName: boolean; snippet?: string }>; indexing: boolean }>}
	 */
	async search(query, { limit = 30, wait = 1500 } = {}) {
		const root = await this.drive.root();
		const wanted = String(query ?? '').trim().toLocaleLowerCase('zh-CN');
		if (!root || !wanted) return { results: [], indexing: false };
		const indexing = await this.#fresh(root, wait);
		const manifest = await this.#manifest(root);
		const byName = [];
		const byText = [];
		for (const [path, entry] of Object.entries(manifest.files)) {
			const name = path.slice(path.lastIndexOf('/') + 1);
			const inName = name.toLocaleLowerCase('zh-CN').includes(wanted);
			let snippet;
			if (entry.text) {
				const text = await this.#text(root, path, `${entry.size}:${entry.modified}`);
				const at = text.toLocaleLowerCase('zh-CN').indexOf(wanted);
				if (at !== -1) snippet = snippetAt(text, at, wanted.length);
			}
			if (inName) byName.push({ path, inName, ...(snippet ? { snippet } : {}) });
			else if (snippet) byText.push({ path, inName, snippet });
		}
		const order = (left, right) => left.path.localeCompare(right.path, 'zh-CN', { numeric: true });
		return { results: [...byName.sort(order), ...byText.sort(order)].slice(0, limit), indexing };
	}
}
