import { t } from '@blog/i18n/index.mjs';
import { formulaOf, type Atom } from './xyz-frames.ts';

/**
 * What xtb's output (`xtb.out`) says: the energies of its summary, the
 * optimization's steps as they are printed (so a run still going can be
 * drawn), the frequencies' count of imaginary modes, and why it stopped
 * when it failed. Read from the end where xtb prints a value more than once.
 */

export type XtbStep = { cycle: number; energy: number; gradientNorm: number | null };

export type XtbOutput = {
	version: string | null;
	call: string | null;
	/** `normal termination of xtb`. */
	terminated: boolean;
	/** The fatal error's lines, `[ERROR]` and the `-1-` … under it. */
	errors: string[];
	warnings: string[];
	/** Hartree. */
	energy: number | null;
	enthalpy: number | null;
	freeEnergy: number | null;
	/** G(RRHO) contribution, Hartree. */
	rrho: number | null;
	gradientNorm: number | null;
	/** eV. */
	gap: number | null;
	homo: number | null;
	lumo: number | null;
	/** Debye. */
	dipole: number | null;
	solvation: { model: string; solvent: string } | null;
	optimization: { converged: boolean | null; cycles: number | null; steps: XtbStep[] } | null;
	imaginary: number | null;
	/** Seconds, the whole run. */
	wallTime: number | null;
};

const NUMBER = String.raw`[+-]?\d+\.?\d*(?:[eEdD][+-]?\d+)?`;

const toNumber = (text: string | undefined): number | null => {
	if (text === undefined) return null;
	const value = Number(text.replace(/[dD]/u, 'e'));
	return Number.isFinite(value) ? value : null;
};

function last(text: string, pattern: RegExp): RegExpExecArray | null {
	let found: RegExpExecArray | null = null;
	for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`))) found = match as RegExpExecArray;
	return found;
}

function seconds(match: RegExpExecArray | null): number | null {
	if (!match) return null;
	const [days, hours, minutes, rest] = match.slice(1, 5).map(Number);
	return ((days * 24 + hours) * 60 + minutes) * 60 + rest;
}

export function parseXtbOutput(text: string): XtbOutput {
	const summary = (name: string) => toNumber(last(text, new RegExp(String.raw`\|\s*${name}\s+(${NUMBER})\s`, 'u'))?.[1]);
	const errorAt = text.indexOf('[ERROR]');
	const errors = errorAt < 0
		? []
		: text.slice(errorAt).split(/\r?\n/u).slice(0, 12).filter((line) => line.trim() && !/^#{8,}/u.test(line.trim())).map((line) => line.trimEnd());
	const optimizing = /\bANC optimizer\b|GEOMETRY OPTIMIZATION|\.{5,} CYCLE\s+\d+/u.test(text);
	const steps: XtbStep[] = [];
	for (const match of text.matchAll(new RegExp(String.raw`CYCLE\s+(\d+)\s+\.+[\s\S]*?\* total energy\s*:\s*(${NUMBER})\s*Eh[^\n]*\n\s*gradient norm\s*:\s*(${NUMBER})`, 'gu'))) {
		steps.push({ cycle: Number(match[1]), energy: Number(match[2]), gradientNorm: toNumber(match[3]) });
	}
	const converged = last(text, /GEOMETRY OPTIMIZATION CONVERGED AFTER (\d+) ITERATIONS/u);
	const failed = last(text, /FAILED TO CONVERGE GEOMETRY OPTIMIZATION(?: IN (\d+) ITERATIONS)?/u);
	const warnings: string[] = [];
	if (failed) warnings.push(t('结构优化在 {steps} 步内没有收敛', { steps: failed[1] ?? '?' }));
	const imaginary = toNumber(last(text, /#\s*imaginary freq\.\s+(\d+)/u)?.[1]);
	if (imaginary) warnings.push(t('有 {count} 个虚频', { count: imaginary }));
	const solvation = last(text, /Solvation model:\s+(\S+)\s*\n\s*Solvent\s+(\S+)/u);
	return {
		version: last(text, /\* xtb version (\S+)/u)?.[1] ?? null,
		call: last(text, /program call\s*:\s*(.+)/u)?.[1].trim() ?? null,
		terminated: /(?<!ab)normal termination of xtb/u.test(text) && !text.includes('abnormal termination'),
		errors,
		warnings,
		energy: summary('TOTAL ENERGY'),
		enthalpy: summary('TOTAL ENTHALPY'),
		freeEnergy: summary('TOTAL FREE ENERGY'),
		rrho: toNumber(last(text, new RegExp(String.raw`G\(RRHO\) contrib\.\s+(${NUMBER})`, 'u'))?.[1]),
		gradientNorm: summary('GRADIENT NORM'),
		gap: summary('HOMO-LUMO GAP'),
		homo: toNumber(last(text, new RegExp(String.raw`(${NUMBER})\s+\(HOMO\)`, 'u'))?.[1]),
		lumo: toNumber(last(text, new RegExp(String.raw`(${NUMBER})\s+\(LUMO\)`, 'u'))?.[1]),
		dipole: toNumber(last(text, new RegExp(String.raw`molecular dipole:[\s\S]*?full:\s+${NUMBER}\s+${NUMBER}\s+${NUMBER}\s+(${NUMBER})`, 'u'))?.[1]),
		solvation: solvation ? { model: solvation[1], solvent: solvation[2] } : null,
		optimization: optimizing
			? { converged: converged ? true : failed ? false : null, cycles: converged ? Number(converged[1]) : failed?.[1] ? Number(failed[1]) : steps.length || null, steps }
			: null,
		imaginary,
		wallTime: seconds(/\btotal:\s*\n\s*\* wall-time:\s+(\d+) d,\s+(\d+) h,\s+(\d+) min,\s+([\d.]+) sec/u.exec(text)),
	};
}

export type VibrationalMode = { mode: number; frequency: number; intensity: number };

/**
 * xtb's `vibspectrum`: each mode's wavenumber (cm⁻¹; imaginary ones below
 * zero) and IR intensity (km/mol). The six (or five) of translation and
 * rotation, printed as zero, are left out.
 */
export function parseVibSpectrum(text: string): VibrationalMode[] {
	const modes: VibrationalMode[] = [];
	for (const line of text.split(/\r?\n/u)) {
		const match = new RegExp(String.raw`^\s*(\d+)\s+(?:\S+\s+)?(${NUMBER})\s+(${NUMBER})\s+(?:YES|NO|-)\s*$`, 'u').exec(line);
		if (!match) continue;
		const frequency = Number(match[2]);
		if (Math.abs(frequency) < 0.01) continue;
		modes.push({ mode: Number(match[1]), frequency, intensity: Number(match[3]) });
	}
	return modes;
}

export type NormalModes = {
	atoms: Atom[];
	modes: Array<{ frequency: number; intensity: number; displacements: Array<[number, number, number]> }>;
};

const SYMBOLS = ['', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn'];

/**
 * The normal modes xtb writes in Gaussian's form (`g98.out`): the geometry
 * and, for each mode, how far each atom moves, to show it vibrate.
 */
export function parseG98Modes(text: string): NormalModes | null {
	const lines = text.split(/\r?\n/u);
	const orientation = lines.findIndex((line) => /Standard orientation:/u.test(line));
	if (orientation < 0) return null;
	const atoms: Atom[] = [];
	for (const line of lines.slice(orientation + 5)) {
		const parts = line.trim().split(/\s+/u);
		if (parts.length !== 6 || !/^\d+$/u.test(parts[0])) break;
		atoms.push({ symbol: SYMBOLS[Number(parts[1])] ?? 'X', x: Number(parts[3]), y: Number(parts[4]), z: Number(parts[5]) });
	}
	if (!atoms.length) return null;
	const modes: NormalModes['modes'] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const frequencies = /^\s*Frequencies --\s+(.*)$/u.exec(lines[index]);
		if (!frequencies) continue;
		const values = frequencies[1].trim().split(/\s+/u).map(Number);
		const block = values.map((frequency) => ({ frequency, intensity: 0, displacements: [] as Array<[number, number, number]> }));
		let row = index + 1;
		for (; row < lines.length && !/^\s*Atom\s+AN/u.test(lines[row]); row += 1) {
			const intensity = /^\s*IR Inten\s+--\s+(.*)$/u.exec(lines[row]);
			if (intensity) intensity[1].trim().split(/\s+/u).forEach((value, column) => block[column] && (block[column].intensity = Number(value)));
		}
		for (let atom = 0; atom < atoms.length; atom += 1) {
			const parts = (lines[row + 1 + atom] ?? '').trim().split(/\s+/u).map(Number);
			block.forEach((mode, column) => mode.displacements.push([parts[2 + column * 3], parts[3 + column * 3], parts[4 + column * 3]]));
		}
		if (block.every((mode) => mode.displacements.every((vector) => vector.every(Number.isFinite)))) modes.push(...block);
		index = row + atoms.length;
	}
	return { atoms, modes };
}
