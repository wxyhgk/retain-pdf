/**
 * XYZ files of many frames, as xtb and CREST write them: an optimization's
 * steps (`xtbopt.log`, a comment ` energy: -5.08 gnorm: 0.009 xtb: 6.7.1`)
 * and an ensemble of conformers (`crest_conformers.xyz`, the energy alone).
 */

export type Atom = { symbol: string; x: number; y: number; z: number };

export type XyzFrame = {
	atoms: Atom[];
	comment: string;
	/** Hartree, from the comment; null when it gives none. */
	energy: number | null;
	gradientNorm: number | null;
};

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:[eEdD][+-]?\d+)?`;

function energyOf(comment: string): number | null {
	const named = new RegExp(String.raw`energy:\s*(${NUMBER})`, 'u').exec(comment);
	if (named) return Number(named[1]);
	const bare = new RegExp(String.raw`^\s*(${NUMBER})\b`, 'u').exec(comment);
	return bare ? Number(bare[1]) : null;
}

/** Every complete frame, in order. A frame cut short (a file still being written) ends the list. */
export function parseXyzFrames(text: string): XyzFrame[] {
	const lines = text.split(/\r?\n/u);
	const frames: XyzFrame[] = [];
	let index = 0;
	while (index < lines.length) {
		const count = lines[index].trim();
		if (!count) {
			index += 1;
			continue;
		}
		if (!/^\d+$/u.test(count)) break;
		const atomsCount = Number(count);
		if (index + 1 + atomsCount >= lines.length) break;
		const comment = lines[index + 1] ?? '';
		const atoms: Atom[] = [];
		for (const line of lines.slice(index + 2, index + 2 + atomsCount)) {
			const [symbol, x, y, z] = line.trim().split(/\s+/u);
			if (!symbol || [x, y, z].some((value) => value === undefined || !Number.isFinite(Number(value)))) return frames;
			atoms.push({ symbol, x: Number(x), y: Number(y), z: Number(z) });
		}
		if (atoms.length !== atomsCount) break;
		const gradient = new RegExp(String.raw`gnorm:\s*(${NUMBER})`, 'u').exec(comment);
		frames.push({ atoms, comment, energy: energyOf(comment), gradientNorm: gradient ? Number(gradient[1]) : null });
		index += 2 + atomsCount;
	}
	return frames;
}

/** One frame as an XYZ file. */
export function frameToXyz(frame: { atoms: Atom[]; comment?: string }): string {
	const rows = frame.atoms.map((atom) => `${atom.symbol.padEnd(2)} ${[atom.x, atom.y, atom.z].map((value) => value.toFixed(6).padStart(12)).join(' ')}`);
	return [String(frame.atoms.length), frame.comment?.trim() ?? '', ...rows].join('\n') + '\n';
}

/** The sum formula, Hill order: C, H, then the rest by symbol (`C2H6O`). */
export function formulaOf(atoms: Atom[]): string {
	const counts = new Map<string, number>();
	for (const { symbol } of atoms) {
		const name = symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	const order = counts.has('C') ? ['C', 'H'] : [];
	const names = [...order.filter((name) => counts.has(name)), ...[...counts.keys()].filter((name) => !order.includes(name)).sort()];
	return names.map((name) => `${name}${counts.get(name) === 1 ? '' : counts.get(name)}`).join('');
}
