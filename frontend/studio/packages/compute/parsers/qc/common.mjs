/**
 * What the readers of each program (gaussian.mjs, orca.mjs) share: how a number is written, the
 * table of rules for single values, lines found from the end, element symbols, units.
 */

/** @typedef {import('./qc.mjs').Atom} Atom */

/** A number as programs print them: `-188.443`, `1.0D-05`, `.5`. */
export const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:[eEdD][+-]?\d+)?`;

export const HARTREE_IN_EV = 27.211386245988;
export const HARTREE_IN_KCAL = 627.509474;

/** @param {string | undefined} text */
export function toNumber(text) {
	if (text === undefined) return null;
	const value = Number(text.replace(/[dD]/u, 'e'));
	return Number.isFinite(value) ? value : null;
}

export const ELEMENTS = ['X', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn'];

/**
 * A rule: where a value is (`pattern`, its lines matched with `m`), which of its matches to take,
 * and how to read one (the first group as a number, unless `read` says otherwise).
 * @typedef {{ pattern: RegExp, take?: 'first' | 'last' | 'all', read?: (match: RegExpExecArray) => unknown }} Rule
 */

/**
 * The values a table of rules finds in `text`, by the rules' names: null (or [] for `all`) where
 * a pattern is not there.
 * @template {Record<string, Rule>} T
 * @param {string} text
 * @param {T} rules
 * @returns {{ [K in keyof T]: any }}
 */
export function readRules(text, rules) {
	/** @type {Record<string, unknown>} */
	const values = {};
	for (const [name, rule] of Object.entries(rules)) {
		const flags = new Set([...rule.pattern.flags, 'g', 'm']);
		const read = rule.read ?? ((match) => toNumber(match[1]));
		const found = [...text.matchAll(new RegExp(rule.pattern.source, [...flags].join('')))].map((match) => read(/** @type {RegExpExecArray} */ (match)));
		const take = rule.take ?? 'last';
		values[name] = take === 'all' ? found : ((take === 'first' ? found[0] : found.at(-1)) ?? null);
	}
	return /** @type {any} */ (values);
}

/** The lines of a text, without their line ends. */
export const linesOf = (/** @type {string} */ text) => text.split(/\r?\n/u);

/** The index of the last line that matches, from `before` back; -1 when none does. */
export function lastLine(/** @type {string[]} */ lines, /** @type {RegExp} */ pattern, before = lines.length) {
	for (let index = Math.min(before, lines.length) - 1; index >= 0; index -= 1) if (pattern.test(lines[index])) return index;
	return -1;
}

/** Days, hours, minutes and seconds (`0 days 0 hours 0 minutes 2.2 seconds`) as seconds. */
export function seconds(/** @type {(string | undefined)[]} */ parts) {
	const [days = 0, hours = 0, minutes = 0, rest = 0] = parts.map((part) => Number(part ?? 0));
	return ((days * 24 + hours) * 60 + minutes) * 60 + rest;
}

/** The chemical formula of atoms, carbon and hydrogen first (Hill). */
export function formulaOf(/** @type {Atom[]} */ atoms) {
	/** @type {Map<string, number>} */
	const counts = new Map();
	for (const atom of atoms) counts.set(atom.symbol, (counts.get(atom.symbol) ?? 0) + 1);
	const order = counts.has('C') ? ['C', 'H', ...[...counts.keys()].filter((symbol) => symbol !== 'C' && symbol !== 'H').sort()] : [...counts.keys()].sort();
	return order.filter((symbol) => counts.has(symbol)).map((symbol) => `${symbol}${counts.get(symbol) === 1 ? '' : counts.get(symbol)}`).join('');
}
