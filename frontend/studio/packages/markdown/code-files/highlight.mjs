import { StringStream } from '@codemirror/language';

import { codeFileLanguage } from './languages.mjs';

/**
 * Colours for the token names, after the blog's Shiki theme (github-dark),
 * so these blocks sit with the highlighted ones.
 */
export const TOKEN_COLORS = Object.freeze({
	comment: '#6a737d',
	keyword: '#f97583',
	meta: '#ffab70',
	typeName: '#b392f0',
	propertyName: '#79b8ff',
	variableName: '#ffab70',
	number: '#79b8ff',
	atom: '#79b8ff',
	string: '#9ecbff',
	unit: '#b392f0',
	operator: '#f97583',
	invalid: '#fdaeb7',
	changed: '#ffab70',
	inserted: '#85e89d',
});

/** How a token is drawn: its colour and weight. */
export function tokenStyle(name) {
	if (!name) return '';
	const parts = name.split(' ');
	const color = parts.map((part) => TOKEN_COLORS[part]).find(Boolean);
	const styles = [];
	if (color) styles.push(`color:${color}`);
	if (parts.includes('strong') || parts.includes('invalid') || parts.includes('inserted')) styles.push('font-weight:600');
	return styles.join(';');
}

/**
 * The tokens of each line of `source` as the language's stream parser reads
 * them: `[text, token name or null][]` per line. Runs of one token name are
 * merged. An unknown language gives each line as one plain token.
 *
 * `keep(lineNumber)` limits the result to the lines shown (the rest are
 * null); every line is still read, so a parser that counts lines or sections
 * colours the kept ones as it would in the whole file.
 * @param {string} language
 * @param {string} source
 * @param {(lineNumber: number) => boolean} [keep]
 * @returns {([string, string | null][] | null)[]}
 */
export function highlightLines(language, source, keep = () => true) {
	const lines = String(source).split(/\r?\n/);
	const parser = codeFileLanguage(language)?.parser;
	const state = parser?.startState();
	return lines.map((line, index) => {
		const kept = keep(index + 1);
		if (!parser) return kept ? (line ? [[line, null]] : []) : null;
		if (!line) {
			parser.blankLine?.(state);
			return kept ? [] : null;
		}
		const stream = new StringStream(line, 4, 2);
		const tokens = [];
		while (!stream.eol()) {
			stream.start = stream.pos;
			const name = parser.token(stream, state) ?? null;
			// A parser that reads nothing would loop forever.
			if (stream.pos === stream.start) stream.next();
			if (!kept) continue;
			const text = line.slice(stream.start, stream.pos);
			const last = tokens[tokens.length - 1];
			if (last && last[1] === name) last[0] += text;
			else tokens.push([text, name]);
		}
		return kept ? tokens : null;
	});
}

/** `12`, `40-45`, `5-` (to the end) as a range of line numbers; null when it is none. */
function lineRange(text) {
	const range = String(text).trim().match(/^(\d+)(?:-(\d+)?)?$/);
	if (!range) return null;
	const start = Math.max(1, Number(range[1]));
	const end = range[2] ? Number(range[2]) : range[0].includes('-') ? Infinity : start;
	return end >= start ? { start, end } : null;
}

/** `SCF Done|Normal termination`: the texts, each looked for as written. */
function alternatives(text) {
	const found = String(text).split('|').filter((part) => part.length > 0);
	return found.length ? found : null;
}

/**
 * What a fence's meta asks for: `title="opt.log" lines=120-180 open fold`.
 * Keys take a value, with or without quotes; bare words are flags.
 *
 * Which lines of a file to show, besides `lines=`, by what they say (each
 * looked for as written, `|` between alternatives):
 * - `match="SCF Done|Normal termination"`: the lines that hold one of them,
 *   with `context=3` lines around each;
 * - `from="Standard orientation" to="Rotational constants"`: the stretch from
 *   a line holding the one to the next holding the other;
 * - `last`: only the last of these (the last geometry of an optimization).
 * Lines to stand out: `hl=12,40-45` by number, `mark="E(RB3LYP)"` by text.
 */
export function parseFenceMeta(meta) {
	const result = {
		title: '',
		lines: null,
		open: false,
		fold: false,
		match: null,
		context: 0,
		from: null,
		to: null,
		last: false,
		highlight: [],
		mark: null,
	};
	const pattern = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
	for (const match of String(meta ?? '').matchAll(pattern)) {
		const key = match[1].toLowerCase();
		const value = match[2] ?? match[3] ?? match[4];
		if (value === undefined) {
			if (key === 'open') result.open = true;
			else if (key === 'fold') result.fold = true;
			else if (key === 'last') result.last = true;
			continue;
		}
		if (key === 'title') result.title = value;
		else if (key === 'lines') result.lines = lineRange(value);
		else if (key === 'match') result.match = alternatives(value);
		else if (key === 'context' && /^\d+$/.test(value)) result.context = Math.min(50, Number(value));
		else if (key === 'from') result.from = alternatives(value);
		else if (key === 'to') result.to = alternatives(value);
		else if (key === 'hl') result.highlight = value.split(',').map(lineRange).filter(Boolean);
		else if (key === 'mark') result.mark = alternatives(value);
	}
	return result;
}

/** Whether a line holds one of these texts. */
export function holdsAny(line, texts) {
	return Boolean(texts) && texts.some((text) => line.includes(text));
}

/** Whether a line stands out: its number in `hl=`, or one of `mark=` in it. */
export function isMarked(meta, number, line) {
	return meta.highlight.some((range) => number >= range.start && number <= range.end) || holdsAny(line, meta.mark);
}

/** Blocks longer than this many lines fold, showing `FOLDED_LINES` of them. */
export const FOLD_AFTER = 30;
export const FOLDED_LINES = 15;
/** A file longer than this shows its head and tail, `HEAD_LINES` and `TAIL_LINES` of them. */
export const EXCERPT_AFTER = 400;
export const HEAD_LINES = 200;
export const TAIL_LINES = 100;

/**
 * The numbers of the lines `match=`/`from=`/`last` pick, within `within`
 * (numbers, in order); `missing` names what was looked for and not found.
 */
function pickLines(lines, within, meta) {
	let picked = within;
	if (meta.from) {
		const stretches = [];
		let stretch = null;
		for (const number of picked) {
			const line = lines[number - 1];
			if (!stretch) {
				if (holdsAny(line, meta.from)) stretch = [number];
				continue;
			}
			// Without `to=`, a stretch runs to the next `from=`.
			if (!meta.to && holdsAny(line, meta.from)) {
				stretches.push(stretch);
				stretch = [number];
				continue;
			}
			stretch.push(number);
			if (meta.to && holdsAny(line, meta.to)) {
				stretches.push(stretch);
				stretch = null;
			}
		}
		// One that does not end runs to the end of the file.
		if (stretch) stretches.push(stretch);
		if (!stretches.length) return { picked: [], missing: meta.from.join('」或「') }; // i18n-ignore: rendered into the blog
		picked = (meta.last && !meta.match ? stretches.slice(-1) : stretches).flat();
	}
	if (meta.match) {
		let found = picked.filter((number) => holdsAny(lines[number - 1], meta.match));
		if (!found.length) return { picked: [], missing: meta.match.join('」或「') }; // i18n-ignore: rendered into the blog
		if (meta.last) found = found.slice(-1);
		const allowed = new Set(picked);
		const around = new Set();
		for (const number of found) {
			for (let near = number - meta.context; near <= number + meta.context; near += 1) {
				if (allowed.has(near)) around.add(near);
			}
		}
		picked = [...around].sort((left, right) => left - right);
	}
	return { picked };
}

/** Runs of consecutive numbers as parts of `lines`. */
function partsOf(lines, numbers) {
	const parts = [];
	for (const number of numbers) {
		const last = parts[parts.length - 1];
		if (last && last.start + last.lines.length === number) last.lines.push(lines[number - 1]);
		else parts.push({ start: number, lines: [lines[number - 1]] });
	}
	return parts;
}

/**
 * The lines of a file a block shows: the range its meta names (`lines=`),
 * what it looks for (`match=`, `from=`, `last`: see parseFenceMeta), or for
 * a long file the head and the tail with a gap between. Each part keeps its
 * first line's number, so the file's own line numbers can be drawn.
 * `picked` is set when lines were picked by what they say; `missing`, when
 * what was looked for is not there.
 * `options` is the fence's meta, or just a range (as `lines=`).
 * @returns {{ parts: { start: number; lines: string[] }[]; total: number; picked?: boolean; missing?: string }}
 */
export function excerptLines(text, options) {
	const meta = options && 'start' in options ? { lines: options } : (options ?? {});
	const range = meta.lines ?? null;
	const lines = String(text).replace(/\r?\n$/, '').split(/\r?\n/);
	const total = lines.length;
	if (meta.match || meta.from) {
		const first = range ? Math.min(range.start, total) : 1;
		const end = range ? Math.min(range.end, total) : total;
		const within = Array.from({ length: Math.max(0, end - first + 1) }, (_, index) => first + index);
		const { picked, missing } = pickLines(lines, within, { context: 0, last: false, ...meta });
		return { parts: partsOf(lines, picked), total, picked: true, ...(missing ? { missing } : {}) };
	}
	if (range) {
		const start = Math.min(range.start, total);
		return { parts: [{ start, lines: lines.slice(start - 1, Math.min(range.end, total)) }], total };
	}
	if (total <= EXCERPT_AFTER) return { parts: [{ start: 1, lines }], total };
	return {
		parts: [
			{ start: 1, lines: lines.slice(0, HEAD_LINES) },
			{ start: total - TAIL_LINES + 1, lines: lines.slice(total - TAIL_LINES) },
		],
		total,
	};
}

/** The name a block's content is downloaded under: its title, else its language's usual file name. */
export function downloadName(language, title, path) {
	if (title) return title.split('/').pop();
	if (path) return path.split('/').pop();
	return codeFileLanguage(language)?.file ?? 'code.txt';
}
