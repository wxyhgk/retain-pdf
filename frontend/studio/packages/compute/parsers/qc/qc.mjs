/**
 * Quantum chemistry outputs (Gaussian's `.log`, ORCA's `.out`) read into one
 * shape, `QcOutput`: what a card and its sheet show, whatever program wrote
 * it. Each program is a file of its own (gaussian.mjs, orca.mjs) written the
 * same way: a table of rules for the single values (`readRules`: a pattern,
 * which match to take, how to read it) and a few readers for what comes as a
 * table (the geometry, the frequencies, the orbitals). What a reader does not
 * find is null; the rest is still read.
 *
 * How to fix or extend one: README.md here. The outputs it is tested on, each
 * with the values it must read from it, are in test/fixtures/qc/.
 */

/**
 * @typedef {{ symbol: string, x: number, y: number, z: number }} Atom
 * @typedef {{ frequency: number, intensity: number | null, symmetry: string | null, displacements: [number, number, number][] }} Vibration
 * @typedef {{ state: number, energy: number, wavelength: number, strength: number, symmetry: string | null }} ExcitedState
 * @typedef {{
 *   program: 'gaussian' | 'orca',
 *   version: string | null,
 *   route: string | null,
 *   method: string | null,
 *   reference: 'R' | 'U' | 'RO' | null,
 *   basis: string | null,
 *   jobs: string[],
 *   charge: number | null,
 *   multiplicity: number | null,
 *   terminated: boolean,
 *   errors: string[],
 *   energy: number | null,
 *   steps: number[],
 *   optimization: { converged: boolean, cycles: number } | null,
 *   atoms: Atom[] | null,
 *   vibrations: Vibration[],
 *   imaginary: number | null,
 *   thermo: { temperature: number | null, zpe: number | null, enthalpy: number | null, freeEnergy: number | null } | null,
 *   homo: number | null,
 *   lumo: number | null,
 *   s2: number | null,
 *   excited: ExcitedState[],
 *   dipole: number | null,
 *   wallTime: number | null,
 * }} QcOutput
 *
 * Units: energies in Hartree (`energy`, `steps`, `thermo`, `homo`, `lumo`), excitation energies in eV
 * and wavelengths in nm, frequencies in cm⁻¹ (imaginary ones below zero), IR intensities in km/mol,
 * coordinates in Å, the dipole in Debye, `wallTime` in seconds. `thermo.zpe` is the zero-point
 * correction; `enthalpy` and `freeEnergy` are totals (electronic energy included).
 * `jobs`: 'sp', 'opt', 'ts', 'freq', 'td', 'irc', 'scan', as the input asked for them. `method` is
 * without its R, U or RO (`reference`: restricted, unrestricted, restricted open-shell).
 */

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

/** Which program wrote an output, from its start (the first few KB do); null when neither. */
export function qcProgram(/** @type {string} */ head) {
	if (/Entering Gaussian System|Gaussian, Inc\./u.test(head)) return 'gaussian';
	if (/\*\s+O\s+R\s+C\s+A\s+\*/u.test(head)) return 'orca';
	return null;
}

/** The chemical formula of atoms, carbon and hydrogen first (Hill). */
export function formulaOf(/** @type {Atom[]} */ atoms) {
	/** @type {Map<string, number>} */
	const counts = new Map();
	for (const atom of atoms) counts.set(atom.symbol, (counts.get(atom.symbol) ?? 0) + 1);
	const order = counts.has('C') ? ['C', 'H', ...[...counts.keys()].filter((symbol) => symbol !== 'C' && symbol !== 'H').sort()] : [...counts.keys()].sort();
	return order.filter((symbol) => counts.has(symbol)).map((symbol) => `${symbol}${counts.get(symbol) === 1 ? '' : counts.get(symbol)}`).join('');
}

/**
 * An output read, whichever program wrote it; null when it is neither Gaussian's nor ORCA's.
 * @param {string} text
 * @returns {Promise<QcOutput | null>}
 */
export async function parseQcOutput(text) {
	const program = qcProgram(text.slice(0, 16384));
	if (program === 'gaussian') return (await import('./gaussian.mjs')).parseGaussianOutput(text);
	if (program === 'orca') return (await import('./orca.mjs')).parseOrcaOutput(text);
	return null;
}
