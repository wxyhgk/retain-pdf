import { bodyParts } from '@blog/document/parse.ts';

/**
 * A book in the editor a window at a time, as SiYuan shows a long document: what is before the window and what is after
 * it kept as text, only a few screens of it made into the editor's blocks. A book's thousands of blocks laid out in
 * WebKit made each formula drawn near its top lay out the rest again (0.1–0.2 s a time, as it was scrolled through);
 * a window of them, a moment. The editor (studio-editor.ts) takes chunks in at one end as it is scrolled there and lets
 * them go at the other; what it reports is the whole body, the window's Markdown between the text before and after it.
 */

/** A body this long, or of this many formulas, is a book. */
export const BOOK_CHARACTERS = 400_000;
export const BOOK_FORMULAS = 1500;
/** About how long a chunk is (in characters, of whole blocks): what comes into the window, or goes from it, at a time. */
export const CHUNK = 8_000;
/** How many chunks the window opens with. */
const OPENED_CHUNKS = 5;

/** About how many formulas a body has: its `$`s halved, and its `\(`s. */
export function formulaCount(body: string): number {
	return Math.round((body.match(/\$/gu)?.length ?? 0) / 2) + (body.match(/\\\(/gu)?.length ?? 0);
}

export const isBook = (body: string): boolean => body.length > BOOK_CHARACTERS || formulaCount(body) > BOOK_FORMULAS;

/** `first` and `then` as one text, a blank line between them (what separated them before is not kept: as written). */
function joined(first: string, then: string): string {
	if (!first.trim()) return then.replace(/^\n+/u, '');
	if (!then.trim()) return first.replace(/\n+$/u, '\n');
	return `${first.replace(/\n+$/u, '')}\n\n${then.replace(/^\n+/u, '')}`;
}

/** A heading of a book, as the outline lists it: its level, its words, where its line starts in the body. */
export type BookHeading = { level: number; text: string; at: number };

/** The headings (levels 1–3) of a body, line by line, not those in code or display formulas: a book's outline. */
export function bookHeadings(body: string): BookHeading[] {
	const found: BookHeading[] = [];
	let fence = '';
	let at = 0;
	for (const line of body.split('\n')) {
		const opening = /^\s{0,3}(`{3,}|~{3,}|\$\$)/u.exec(line)?.[1];
		if (fence) {
			if (opening && opening[0] === fence[0] && opening.length >= fence.length) fence = '';
		} else if (opening) {
			fence = opening;
		} else {
			const heading = /^(#{1,3})\s+(.*?)\s*#*\s*$/u.exec(line);
			if (heading?.[2]) found.push({ level: heading[1]!.length, text: heading[2], at });
		}
		at += line.length + 1;
	}
	return found;
}

export class BookText {
	/** The text before the window, and where each of its chunks starts (the first at 0). */
	#before: string;
	#beforeStarts: number[];
	/** The text after the window: chunks let go from its end (the nearest first), then the rest, as it was. */
	#afterChunks: string[] = [];
	#rest: string;

	private constructor(before: string, beforeStarts: number[], rest: string) {
		this.#before = before;
		this.#beforeStarts = beforeStarts;
		this.#rest = rest;
	}

	/**
	 * A book, its window opened at the chunk `from` (an offset in it) is in: that chunk and a few after it. Null for a
	 * body that cannot be cut (one with link definitions, which may come after their use), or that is one chunk.
	 */
	static open(body: string, from = 0): { book: BookText; window: string } | null {
		const starts: number[] = [];
		let at = 0;
		for (const part of bodyParts(body, CHUNK, CHUNK)) {
			starts.push(starts.length ? part[0]!.start : 0);
			if (part[0]!.start <= from) at = starts.length - 1;
			else if (starts.length > at + OPENED_CHUNKS) break;
		}
		if (starts.length < 2) return null;
		// Near the end: the window as many chunks still, from further up.
		at = Math.max(0, Math.min(at, starts.length - OPENED_CHUNKS));
		const start = starts[at]!;
		const end = starts[at + OPENED_CHUNKS] ?? body.length;
		return { book: new BookText(body.slice(0, start), starts.slice(0, at), body.slice(end)), window: body.slice(start, end) };
	}

	/** How far into the body the window starts (characters before it). */
	get start(): number {
		return this.#before.length;
	}

	get hasBefore(): boolean {
		return this.#before.trim() !== '';
	}

	get hasAfter(): boolean {
		return this.#afterChunks.length > 0 || this.#rest.trim() !== '';
	}

	/** The whole body: `window` (the editor's Markdown) between the text before and after it. */
	full(window: string): string {
		return joined(joined(this.#before, window), this.#afterText());
	}

	/** The chunk right after the window, out of what is after it, to go at its end; null when there is none. */
	takeAfter(): string | null {
		const kept = this.#afterChunks.shift();
		if (kept !== undefined) return kept;
		if (!this.#rest.trim()) return null;
		const parts = bodyParts(this.#rest, CHUNK, CHUNK);
		parts.next();
		const next = parts.next();
		const cut = next.done ? this.#rest.length : next.value[0]!.start;
		const chunk = this.#rest.slice(0, cut);
		this.#rest = this.#rest.slice(cut);
		return chunk;
	}

	/** The chunk right before the window, out of what is before it, to go at its start; null when there is none. */
	takeBefore(): string | null {
		const start = this.#beforeStarts.pop();
		if (start === undefined) {
			if (!this.#before.trim()) return null;
			const chunk = this.#before;
			this.#before = '';
			return chunk;
		}
		const chunk = this.#before.slice(start);
		this.#before = this.#before.slice(0, start);
		return chunk;
	}

	/** The window's first blocks let go (as Markdown): the last chunk before it now. */
	putBefore(markdown: string): void {
		if (!markdown.trim()) return;
		if (this.hasBefore) this.#beforeStarts.push(this.#before.replace(/\n+$/u, '').length + 2);
		this.#before = `${joined(this.#before, markdown).replace(/\n+$/u, '')}\n\n`;
	}

	/** The window's last blocks let go (as Markdown): the first chunk after it now. */
	putAfter(markdown: string): void {
		if (markdown.trim()) this.#afterChunks.unshift(markdown);
	}

	#afterText(): string {
		return [...this.#afterChunks, this.#rest].reduce(joined, '');
	}
}
