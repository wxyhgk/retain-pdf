/**
 * Equation numbers, labels and references, the way LaTeX does them, for
 * KaTeX, which has none of it. Every display formula in an article gets the
 * next number, written into it as `\tag{n}`, unless it says `\notag` or
 * `\nonumber`, or gives its own `\tag{…}`. A numbered environment
 * (`align`, `gather`, `equation`, …) numbers each of its rows instead.
 * `\label{key}` names the number; `\eqref{key}` and `\ref{key}` anywhere in
 * the article show it, linked to the formula.
 *
 * Pure text in, text out, so the blog's renderer and the Studio's editor
 * number the same article the same way.
 */

const NUMBERED_ENVIRONMENTS = ['equation', 'align', 'alignat', 'gather', 'flalign'];
const ENVIRONMENT = new RegExp(String.raw`\\begin\{(${NUMBERED_ENVIRONMENTS.join('|')})\}`, 'u');
const LABEL = /\\label\s*\{([^{}]*)\}/gu;
const TAG = /\\tag(\*?)\s*\{([^{}]*)\}/u;
const NO_NUMBER = /\\(?:notag|nonumber)(?![A-Za-z])/u;
const REFERENCE = /\\(eqref|ref)\s*\{([^{}]*)\}/gu;

/** The `id` of the element a label links to. */
export function equationAnchor(key) {
	return `eq-${key.trim().replace(/[^\w:.-]+/gu, '-')}`;
}

/** Where the environment that starts at `start` (at its `\begin`) ends, and where its body is. */
function environmentAt(source, start, name) {
	const open = `\\begin{${name}}`;
	let bodyStart = start + open.length;
	// alignat takes the number of columns.
	if (name === 'alignat') {
		const columns = /^\s*\{[^{}]*\}/u.exec(source.slice(bodyStart));
		if (columns) bodyStart += columns[0].length;
	}
	let depth = 0;
	const pattern = /\\(begin|end)\s*\{([^{}]*)\}/gu;
	pattern.lastIndex = start;
	for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
		if (match[1] === 'begin') depth += 1;
		else depth -= 1;
		if (depth === 0) return { bodyStart, bodyEnd: match.index, end: match.index + match[0].length };
	}
	return null;
}

/** The rows of an environment's body: split at `\\` outside braces and inner environments, keeping each separator. */
function rows(body) {
	const pieces = [];
	let braces = 0;
	let environments = 0;
	let from = 0;
	for (let index = 0; index < body.length; index += 1) {
		const char = body[index];
		if (char === '{') braces += 1;
		else if (char === '}') braces -= 1;
		else if (char === '\\') {
			const next = body[index + 1];
			if (next === '\\' && braces === 0 && environments === 0) {
				let end = index + 2;
				const spacing = /^\s*\[[^\]]*\]/u.exec(body.slice(end));
				if (spacing) end += spacing[0].length;
				pieces.push({ row: body.slice(from, index), separator: body.slice(index, end) });
				from = end;
				index = end - 1;
				continue;
			}
			const command = /^[A-Za-z]+/u.exec(body.slice(index + 1));
			if (command?.[0] === 'begin') environments += 1;
			else if (command?.[0] === 'end') environments -= 1;
			index += command ? command[0].length : 1;
		}
	}
	pieces.push({ row: body.slice(from), separator: '' });
	return pieces;
}

/**
 * Number the display formulas of one article, in order. Returns each one
 * ready for KaTeX (numbers as `\tag`, labels gone), the anchors each one
 * holds, what every label stands for, and the labels given again later
 * (`duplicates`, with the formula each is in), which the first one keeps.
 */
export function numberEquations(sources) {
	let count = 0;
	const labels = new Map();
	const duplicates = [];
	let current = 0;

	const numberRow = (row, anchors) => {
		const keys = [...row.matchAll(LABEL)].map((match) => match[1].trim()).filter(Boolean);
		let text = row.replace(LABEL, '');
		let tag = null;
		const manual = TAG.exec(text);
		if (manual) tag = manual[1] ? manual[2] : `(${manual[2]})`;
		else if (!NO_NUMBER.test(text) && text.trim()) {
			count += 1;
			tag = `(${count})`;
			const trailing = /\s*$/u.exec(text)[0];
			text = `${text.slice(0, text.length - trailing.length)} \\tag{${count}}${trailing}`;
		}
		if (tag) {
			for (const key of keys) {
				if (labels.has(key)) {
					duplicates.push({ key, index: current });
					continue;
				}
				labels.set(key, { tag, anchor: equationAnchor(key) });
				anchors.push(equationAnchor(key));
			}
		}
		return text;
	};

	const results = sources.map((source, index) => {
		current = index;
		const anchors = [];
		if (!ENVIRONMENT.test(source)) return { source: numberRow(source, anchors), anchors };
		let output = '';
		let at = 0;
		const pattern = new RegExp(ENVIRONMENT.source, 'gu');
		for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
			if (match.index < at) continue;
			const name = match[1];
			const environment = environmentAt(source, match.index, name);
			if (!environment) break;
			const body = source.slice(environment.bodyStart, environment.bodyEnd);
			const numbered =
				name === 'equation'
					? numberRow(body, anchors)
					: rows(body).map(({ row, separator }) => numberRow(row, anchors) + separator).join('');
			output +=
				source.slice(at, match.index).replace(LABEL, '') +
				`\\begin{${name}*}` +
				source.slice(match.index + match[0].length, environment.bodyStart) +
				numbered +
				`\\end{${name}*}`;
			at = environment.end;
			pattern.lastIndex = at;
		}
		return { source: output + source.slice(at).replace(LABEL, ''), anchors };
	});
	return { equations: results, labels, duplicates };
}

/**
 * A formula ready for KaTeX outside the numbering: labels gone, numbered
 * environments starred so KaTeX does not number them itself, and
 * references shown as links to what they name, `(??)` when nothing does.
 */
export function prepareFormula(source, labels = new Map()) {
	const unnumbered = source
		.replace(LABEL, '')
		.replace(new RegExp(String.raw`\\(begin|end)\{(${NUMBERED_ENVIRONMENTS.join('|')})\}`, 'gu'), '\\$1{$2*}');
	return resolveReferences(unnumbered, labels);
}

/** The keys `\eqref{…}` and `\ref{…}` name in `source` that no label gives, as written. */
export function unresolvedReferences(source, labels) {
	return [...source.matchAll(REFERENCE)].map((match) => match[2].trim()).filter((key) => !labels.has(key));
}

/** `\eqref{key}` as a link showing `(1)`, `\ref{key}` as one showing `1`. */
export function resolveReferences(source, labels) {
	return source.replace(REFERENCE, (_match, kind, key) => {
		const label = labels.get(key.trim());
		if (!label) return kind === 'eqref' ? '\\text{(??)}' : '\\text{??}';
		const shown = kind === 'eqref' || !label.tag.startsWith('(') ? label.tag : label.tag.slice(1, -1);
		return `\\href{#${label.anchor}}{${shown}}`;
	});
}
