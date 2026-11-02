/**
 * A long display formula broken into lines the way the books typeset one
 * (`aligned`; KaTeX breaks no display formula itself). The page shows this
 * instead of the formula as written when that is wider than its line
 * (fit-formulas.ts); the source is not changed.
 *
 * - A chain of relations (`=`, `≈`, `<`…): a line each, the relations under one another.
 * - Else a long sum: at its `+` and `−`, about 80 characters of source a line, each
 *   line after the first set in a little (after the relation, when there is one).
 *
 * Only what is at the formula's own level counts: not inside braces (a fraction,
 * `\text{}`, `\ce{}`) or between `\left` and `\right`. A formula already in lines
 * (`\\`, an environment), or with nothing to break at, is left as it is (null).
 */

const RELATION_COMMANDS = new Set([
	'approx', 'simeq', 'cong', 'equiv', 'sim', 'propto',
	'le', 'leq', 'leqslant', 'ge', 'geq', 'geqslant', 'll', 'gg', 'ne', 'neq',
	'to', 'rightarrow', 'Rightarrow', 'longrightarrow', 'Longrightarrow', 'iff', 'implies',
]);

/** Where the relations at the formula's own level are, and the `+` and `−` between its terms: `[start, end)` each. */
function breaksOf(body) {
	const relations = [];
	const signs = [];
	let braces = 0;
	let fences = 0;
	/** What came last at this level: a term can end there (a sign after it is between two terms). */
	let afterTerm = false;
	for (let index = 0; index < body.length; index += 1) {
		const char = body[index];
		if (/\s/u.test(char)) continue;
		const top = !braces && !fences;
		if (char === '\\') {
			const command = /^[A-Za-z]+/u.exec(body.slice(index + 1))?.[0];
			if (!command) {
				index += 1; // `\{`, `\,`, `\\`: one character escaped
				afterTerm = true;
				continue;
			}
			if (command === 'left') fences += 1;
			else if (command === 'right') fences -= 1;
			const relation = top && RELATION_COMMANDS.has(command);
			if (relation) relations.push([index, index + 1 + command.length]);
			afterTerm = !relation && !/^(left|quad|qquad|cdot|times|pm|mp|div)$/u.test(command);
			index += command.length;
			continue;
		}
		if (char === '{') braces += 1;
		else if (char === '}') braces -= 1;
		if (top && (char === '=' || char === '<' || char === '>')) {
			// `:=` is one relation; so are `<=`-like pairs written as two characters.
			const start = index > 0 && body[index - 1] === ':' ? index - 1 : index;
			const end = body[index + 1] === '=' ? index + 2 : index + 1;
			relations.push([start, end]);
			index = end - 1;
			afterTerm = false;
			continue;
		}
		if (top && (char === '+' || char === '-') && afterTerm) signs.push([index, index + 1]);
		afterTerm = char !== '{' && !(top && /[+\-*/,(&^_]/u.test(char));
	}
	return { relations, signs };
}

const LINE = 80;

/** The formula broken into lines, ready for KaTeX; null when it is left as it is. */
export function breakIntoLines(source) {
	// Its number (`\tag{3}`, given by equations.mjs) and \notag go after the lines, for the whole formula.
	const after = [];
	const body = source.replace(/\\(?:tag\*?\{[^{}]*\}|notag\b|nonumber\b)/gu, (match) => {
		after.push(match);
		return '';
	}).trim();
	if (/\\begin\{|\\\\/u.test(body)) return null;
	const { relations, signs } = breaksOf(body);
	const lines = relations.length >= 2 ? chain(body, relations) : sum(body, relations, signs);
	return lines ? `\\begin{aligned}${lines.join(' \\\\ ')}\\end{aligned}${after.join('')}` : null;
}

/** `a = b = c`: `a &= b`, `&= c`. */
function chain(body, relations) {
	const first = body.slice(0, relations[0][0]).trim();
	if (!first) return null;
	return relations.map(([start, end], index) => `${index ? '' : `${first} `}&${body.slice(start, end)} ${body.slice(end, relations[index + 1]?.[0] ?? body.length).trim()}`);
}

/** A long sum, at about LINE characters a line, broken before a sign; set in after its relation, if it has one. */
function sum(body, relations, signs) {
	const from = relations[0]?.[1] ?? 0;
	const cuts = signs.filter(([start]) => start > from).map(([start]) => start);
	if (body.length - from <= LINE || !cuts.length) return null;
	const count = Math.ceil((body.length - from) / LINE);
	const target = (body.length - from) / count;
	// At the sign nearest each even share of its length.
	const pieces = [];
	let start = from;
	for (let line = 1; line < count; line += 1) {
		const ideal = from + line * target;
		const cut = cuts.filter((at) => at > start).reduce((best, at) => (best === null || Math.abs(at - ideal) < Math.abs(best - ideal) ? at : best), /** @type {number | null} */ (null));
		if (cut === null) break;
		pieces.push(body.slice(start, cut).trim());
		start = cut;
	}
	pieces.push(body.slice(start).trim());
	if (pieces.length < 2) return null;
	const head = relations.length ? `${body.slice(0, relations[0][0]).trim()} &${body.slice(relations[0][0], from)} ` : '& ';
	return pieces.map((piece, index) => (index ? `&\\quad ${piece}` : `${head}${piece}`));
}
