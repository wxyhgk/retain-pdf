import type { XyzFrame } from './xyz-frames.ts';

/**
 * What CREST says (`crest.out`), and its ensemble (`crest_conformers.xyz`)
 * as a table: each conformer's energy above the lowest and its share at room
 * temperature, by Boltzmann.
 */

export type CrestOutput = {
	version: string | null;
	call: string | null;
	/** `CREST terminated normally.` */
	terminated: boolean;
	errors: string[];
	/** How many conformers it kept. */
	conformers: number | null;
	/** Hartree. */
	lowest: number | null;
	wallTime: number | null;
};

export function parseCrestOutput(text: string): CrestOutput {
	const lastOf = (pattern: RegExp) => [...text.matchAll(new RegExp(pattern.source, 'gu'))].at(-1) ?? null;
	const runtime = lastOf(/CREST runtime \(total\)\s+(\d+) d,\s+(\d+) h,\s+(\d+) min,\s+([\d.]+) sec/u);
	const errors = text
		.split(/\r?\n/u)
		.filter((line) => /\b(?:error|abnormal termination|aborted|STOP)\b/iu.test(line) && !/error\s*:\s*0/iu.test(line))
		.map((line) => line.trim())
		.slice(0, 8);
	const terminated = /CREST terminated normally/u.test(text);
	return {
		version: lastOf(/Version\s+(\d+\.\d+(?:\.\d+)?)/u)?.[1] ?? null,
		call: lastOf(/Command line input:\s*\n\s*>?\s*\$?\s*(.+)/u)?.[1].trim() ?? null,
		terminated,
		errors: terminated ? [] : errors,
		conformers: (() => {
			const found = lastOf(/number of unique conformers for further calc\s+(\d+)/u);
			return found ? Number(found[1]) : null;
		})(),
		lowest: (() => {
			const found = lastOf(/E lowest\s*:\s*([+-]?\d+\.\d+)/u);
			return found ? Number(found[1]) : null;
		})(),
		wallTime: runtime ? ((Number(runtime[1]) * 24 + Number(runtime[2])) * 60 + Number(runtime[3])) * 60 + Number(runtime[4]) : null,
	};
}

export const HARTREE_IN_KCAL = 627.509474;
const BOLTZMANN_KCAL = 0.0019872043;

export type Conformer = { index: number; energy: number; relative: number; population: number };

/** The conformers in their order, each with ΔE (kcal/mol) and its population at `temperature` (K). */
export function ensembleTable(frames: XyzFrame[], temperature = 298.15): Conformer[] {
	const energies = frames.map((frame) => frame.energy);
	if (!energies.length || energies.some((energy) => energy === null)) return [];
	const lowest = Math.min(...(energies as number[]));
	const relative = (energies as number[]).map((energy) => (energy - lowest) * HARTREE_IN_KCAL);
	const weights = relative.map((value) => Math.exp(-value / (BOLTZMANN_KCAL * temperature)));
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	return relative.map((value, index) => ({ index: index + 1, energy: energies[index] as number, relative: value, population: weights[index] / total }));
}
