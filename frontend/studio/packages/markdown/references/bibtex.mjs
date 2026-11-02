/**
 * Literature cited in an article: `[@becke1993]`, `[@a; @b]`, `[@a, p. 12]`
 * in the text (Pandoc's way of writing them), the entries in the article's
 * `assets/refs.bib`. The blog numbers them as they first come and lists them
 * at the end (remark-citations.mjs); the Studio draws them the same way.
 */

/** Where an article keeps its literature. */
export const BIBLIOGRAPHY_PATH = 'assets/refs.bib';

/** A citation in the text: brackets holding `@key`s, `;` between them. */
export const CITATION = /\[(@[^[\]\n]+)\]/gu;

const KEY = /^\s*@([\w:.#$%&+?<>~/-]+)\s*(?:,\s*(.*?))?\s*$/u;

/**
 * The keys a citation's brackets hold, each with what it points at in the
 * work (`p. 12`); null when the brackets are not a citation.
 * @param {string} inner what is between the brackets: `@a; @b, p. 12`
 */
export function parseCitation(inner) {
	const items = [];
	for (const part of inner.split(';')) {
		const match = KEY.exec(part);
		if (!match) return null;
		items.push({ key: match[1], locator: match[2] ?? '' });
	}
	return items.length ? items : null;
}

/** The value of a field from `start` (a brace, a quote or a bare word), and where it ends. */
function readValue(text, start) {
	let pos = start;
	let value = '';
	for (;;) {
		while (/\s/u.test(text[pos] ?? '')) pos += 1;
		const opening = text[pos];
		if (opening === '{' || opening === '"') {
			const closing = opening === '{' ? '}' : '"';
			let depth = 0;
			let at = pos + 1;
			for (; at < text.length; at += 1) {
				const char = text[at];
				if (char === '\\') {
					at += 1;
					continue;
				}
				if (char === '{') depth += 1;
				else if (char === '}' && depth > 0) depth -= 1;
				else if (char === closing && depth === 0) break;
			}
			value += text.slice(pos + 1, at);
			pos = at + 1;
		} else {
			const bare = /^[^,#}\s)]+/u.exec(text.slice(pos))?.[0] ?? '';
			value += bare;
			pos += bare.length;
		}
		while (/\s/u.test(text[pos] ?? '')) pos += 1;
		// `"a" # {b}`: one value.
		if (text[pos] !== '#') return { value, end: pos };
		pos += 1;
	}
}

/** Where the entry that opens at `start` (`{` or `(`) closes. */
function skipEntry(text, start) {
	let depth = 0;
	for (let at = start; at < text.length; at += 1) {
		if (text[at] === '{' || text[at] === '(') depth += 1;
		else if (text[at] === '}' || text[at] === ')') {
			depth -= 1;
			if (depth === 0) return at + 1;
		}
	}
	return text.length;
}

/**
 * The entries of a BibTeX file, by key: `{ type, key, fields }`, field
 * names in lower case, values as written (braces and TeX kept).
 * @param {string} text
 * @returns {Map<string, { type: string; key: string; fields: Record<string, string> }>}
 */
export function parseBibtex(text) {
	const entries = new Map();
	let at = 0;
	for (let found = text.indexOf('@', at); found !== -1; found = text.indexOf('@', at)) {
		const head = /^@([A-Za-z]+)\s*([{(])/u.exec(text.slice(found));
		if (!head) {
			at = found + 1;
			continue;
		}
		const type = head[1].toLowerCase();
		const open = found + head[0].length - 1;
		if (type === 'comment' || type === 'preamble' || type === 'string') {
			at = skipEntry(text, open);
			continue;
		}
		const comma = text.indexOf(',', open);
		if (comma === -1) break;
		const key = text.slice(open + 1, comma).trim();
		const closing = head[2] === '{' ? '}' : ')';
		const fields = {};
		let pos = comma + 1;
		while (pos < text.length) {
			while (/[\s,]/u.test(text[pos] ?? '')) pos += 1;
			if (text[pos] === closing || pos >= text.length) {
				pos += 1;
				break;
			}
			const name = /^[\w:.-]+/u.exec(text.slice(pos))?.[0];
			if (!name) {
				pos = skipEntry(text, open);
				break;
			}
			pos += name.length;
			while (/\s/u.test(text[pos] ?? '')) pos += 1;
			if (text[pos] !== '=') continue;
			const { value, end } = readValue(text, pos + 1);
			fields[name.toLowerCase()] = value;
			pos = end;
		}
		if (key) entries.set(key, { type, key, fields });
		at = pos;
	}
	return entries;
}

const ACCENTS = { '"': '̈', "'": '́', '`': '̀', '^': '̂', '~': '̃', '=': '̄', '.': '̇', c: '̧', v: '̌', u: '̆', H: '̋', r: '̊', k: '̨' };
const LETTERS = { o: 'ø', O: 'Ø', ss: 'ß', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', aa: 'å', AA: 'Å', l: 'ł', L: 'Ł', i: 'ı', j: 'ȷ' };

/** TeX in a field as plain text: accents as letters, braces and commands gone. */
export function plainTex(text) {
	return String(text ?? '')
		.replace(/\\([`'^"~=.])\s*\{?\s*\\?([A-Za-z])\s*\}?/gu, (_, accent, letter) => `${letter}${ACCENTS[accent]}`.normalize('NFC'))
		.replace(/\\([cvuHrk])\s*\{\s*([A-Za-z])\s*\}/gu, (_, accent, letter) => `${letter}${ACCENTS[accent]}`.normalize('NFC'))
		.replace(/\\(ss|ae|AE|oe|OE|aa|AA|o|O|l|L|i|j)(?![A-Za-z])\s?/gu, (_, name) => LETTERS[name])
		.replace(/\\(?:textit|textbf|emph|textrm|textsf|texttt|mathrm|text)\s*\{([^{}]*)\}/gu, '$1')
		.replace(/\\([&%$#_{}])/gu, '$1')
		.replace(/---/gu, '—')
		.replace(/--/gu, '–')
		.replace(/~/gu, ' ')
		.replace(/[{}]/gu, '')
		.replace(/\s+/gu, ' ')
		.trim();
}

/** `Becke, Axel D.` or `Axel D. Becke` as `Becke, A. D.`. */
function shortName(name) {
	const plain = plainTex(name);
	let family = plain;
	let given = '';
	if (plain.includes(',')) [family, given] = plain.split(',', 2).map((part) => part.trim());
	else {
		const words = plain.split(' ');
		family = words.pop() ?? '';
		given = words.join(' ');
	}
	const initials = given
		.split(/\s+/u)
		.filter(Boolean)
		.map((word) => word.split('-').map((part) => (part ? `${part[0]}.` : '')).join('-'))
		.join(' ');
	return initials ? `${family}, ${initials}` : family;
}

/** The authors as ACS lists them: `Becke, A. D.; Lee, C.`, the first ten and `et al.` after. */
export function authorList(authors) {
	const names = String(authors ?? '').split(/\s+and\s+/iu).map((name) => name.trim()).filter(Boolean);
	if (!names.length) return '';
	const shown = names.slice(0, 10).map((name) => (/^others$/iu.test(name) ? 'et al.' : shortName(name)));
	if (names.length > 10) shown.push('et al.');
	return shown.join('; ');
}

/**
 * An entry as the list at the end shows it, in pieces to put in a page:
 * text, `{ em }` for the journal or book, `{ strong }` for the year,
 * `{ link }` for the DOI or address. Close to the ACS style.
 * @returns {Array<string | { em: string } | { strong: string } | { link: string }>}
 */
export function referencePieces(entry) {
	const field = (name) => plainTex(entry.fields[name] ?? '');
	const pieces = [];
	const authors = authorList(entry.fields.author ?? entry.fields.editor);
	if (authors) pieces.push(`${authors}${authors.endsWith('.') ? '' : '.'} `);
	const title = field('title');
	const year = field('year') || (field('date').match(/\d{4}/u)?.[0] ?? '');
	const journal = field('journal') || field('journaltitle');
	if (entry.type === 'article' || journal) {
		if (title) pieces.push(`${title}${/[.?!]$/u.test(title) ? '' : '.'} `);
		if (journal) pieces.push({ em: journal }, ' ');
		if (year) pieces.push({ strong: year });
		if (field('volume')) pieces.push(', ', { em: field('volume') });
		if (field('pages')) pieces.push(`, ${field('pages').replace(/-+/gu, '–')}`);
		pieces.push('.');
	} else if (entry.type === 'book' || entry.type === 'incollection' || entry.type === 'inbook') {
		if (entry.type !== 'book' && title) pieces.push(`${title}. `);
		const book = entry.type === 'book' ? title : field('booktitle');
		if (book) pieces.push(entry.type === 'book' ? '' : 'In ', { em: book }, '; ');
		const publisher = [field('publisher'), field('address')].filter(Boolean).join(': ');
		pieces.push(`${publisher ? `${publisher}, ` : ''}${year}.`);
	} else {
		if (title) pieces.push(`${title}. `);
		const where = field('howpublished') || field('institution') || field('school') || field('publisher') || field('booktitle');
		pieces.push([where, year].filter(Boolean).join(', ') + (where || year ? '.' : ''));
	}
	const doi = field('doi').replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, '');
	const url = doi ? `https://doi.org/${doi}` : field('url');
	if (url) pieces.push(' ', { link: url });
	return pieces.filter((piece) => piece !== '');
}

/** `1–3, 5` for the numbers 1, 2, 3, 5. */
export function numberRanges(numbers) {
	const sorted = [...new Set(numbers)].sort((left, right) => left - right);
	const runs = [];
	for (const number of sorted) {
		const last = runs[runs.length - 1];
		if (last && number === last[1] + 1) last[1] = number;
		else runs.push([number, number]);
	}
	return runs.map(([start, end]) => (end === start ? `${start}` : end === start + 1 ? `${start},${end}` : `${start}–${end}`)).join(',');
}
