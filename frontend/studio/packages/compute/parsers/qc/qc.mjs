/**
 * Quantum chemistry outputs (Gaussian's `.log`, ORCA's `.out`) read into one
 * shape, `QcOutput`: what a card and its sheet show, whatever program wrote
 * it. Each program is a file of its own (gaussian.mjs, orca.mjs) written the
 * same way: a table of rules for the single values (`readRules`: a pattern,
 * which match to take, how to read it) and a few readers for what comes as a
 * table (the geometry, the frequencies, the orbitals). What a reader does not
 * find is null; the rest is still read.
 *
 * The shared pieces are in common.mjs. How to fix or extend a reader: README.md here. The outputs it is tested on, each
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

import { parseGaussianOutput } from './gaussian.mjs';
import { parseOrcaOutput } from './orca.mjs';

export * from './common.mjs';

/** Which program wrote an output, from its start (the first few KB do); null when neither. */
export function qcProgram(/** @type {string} */ head) {
	if (/Entering Gaussian System|Gaussian, Inc\./u.test(head)) return 'gaussian';
	if (/\*\s+O\s+R\s+C\s+A\s+\*/u.test(head)) return 'orca';
	return null;
}

/**
 * An output read, whichever program wrote it; null when it is neither Gaussian's nor ORCA's.
 * @param {string} text
 * @returns {QcOutput | null}
 */
export function parseQcOutput(text) {
	const program = qcProgram(text.slice(0, 16384));
	if (program === 'gaussian') return parseGaussianOutput(text);
	if (program === 'orca') return parseOrcaOutput(text);
	return null;
}
