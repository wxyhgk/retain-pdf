/**
 * The words of a source file (TypeScript, JavaScript, TSX, Astro), as far as translating them goes: what is given to
 * `t()` (the Chinese to translate), and Chinese left outside it (to be given to it, or marked `i18n-ignore` on its
 * line when it is not for the author to read: a pattern, what is written into an article, a prompt for the AI).
 */

const HAN = /[一-鿿]/u;
/** After these (spaces aside), a / starts a pattern, not a division. */
const BEFORE_PATTERN = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);

/** The string literals (and, with `jsx`, the JSX text) of `source`, comments and patterns left out, each with where it is. */
function* pieces(source, jsx) {
	let line = 1;
	let at = 0;
	let last = '';
	const length = source.length;
	while (at < length) {
		const char = source[at];
		const next = source[at + 1];
		if (char === '\n') {
			line += 1;
			at += 1;
			continue;
		}
		if (char === ' ' || char === '\t' || char === '\r') {
			at += 1;
			continue;
		}
		if (char === '/' && next === '/') {
			while (at < length && source[at] !== '\n') at += 1;
			continue;
		}
		if (char === '/' && next === '*') {
			const end = source.indexOf('*/', at + 2);
			const stop = end < 0 ? length : end + 2;
			line += (source.slice(at, stop).match(/\n/gu) ?? []).length;
			at = stop;
			continue;
		}
		if (char === '/' && (BEFORE_PATTERN.has(last) || /\b(?:return|typeof|case|in|of)$/u.test(source.slice(Math.max(0, at - 8), at).trimEnd()))) {
			// A pattern: to its closing /, its [classes] whole.
			let inClass = false;
			at += 1;
			while (at < length && source[at] !== '\n') {
				const inside = source[at];
				if (inside === '\\') at += 1;
				else if (inside === '[') inClass = true;
				else if (inside === ']') inClass = false;
				else if (inside === '/' && !inClass) break;
				at += 1;
			}
			at += 1;
			last = '/';
			continue;
		}
		if (char === "'" || char === '"' || char === '`') {
			const start = at;
			const startLine = line;
			at += 1;
			while (at < length && source[at] !== char) {
				if (source[at] === '\\') at += 1;
				else if (source[at] === '\n') line += 1;
				at += 1;
			}
			at += 1;
			last = char;
			yield { kind: 'string', quote: char, text: source.slice(start + 1, at - 1), start, line: startLine };
			continue;
		}
		if (jsx && char === '>' && last !== '=' && last !== '-') {
			// JSX text: from a tag's > to the next < or {, when it holds Chinese.
			let end = at + 1;
			while (end < length && !'<{}>'.includes(source[end])) end += 1;
			const text = source.slice(at + 1, end);
			if (HAN.test(text) && (source[end] === '<' || source[end] === '{')) yield { kind: 'jsx', quote: '', text, start: at + 1, line };
		}
		last = /[\w$]/u.test(char) ? 'x' : char;
		at += 1;
	}
}

/** Whether the piece at `start` is the first argument of t(…). */
function inT(source, start) {
	return /(?:^|[^\w.$])t\(\s*$/u.test(source.slice(Math.max(0, start - 40), start));
}

/** What `source` gives to t(): the Chinese to translate, as written. */
export function translatable(source, { jsx = false } = {}) {
	const found = [];
	for (const piece of pieces(source, jsx)) {
		if (piece.kind !== 'string' || !inT(source, piece.start)) continue;
		if (piece.quote === '`' && piece.text.includes('${')) throw new Error(`t() takes words as written, not \`…\${}\`: line ${piece.line}`);
		found.push(piece.text.replace(/\\(['"`\\])/gu, '$1').replace(/\\n/gu, '\n'));
	}
	return found;
}

/** Chinese in `source` not given to t(), by line: what is left to translate. */
export function untranslated(source, { jsx = false } = {}) {
	const lines = source.split('\n');
	const found = [];
	for (const piece of pieces(source, jsx)) {
		if (!HAN.test(piece.text) || lines[piece.line - 1]?.includes('i18n-ignore')) continue;
		if (piece.kind === 'string' && inT(source, piece.start)) continue;
		found.push({ line: piece.line, text: piece.text.trim().slice(0, 60) });
	}
	return found;
}
