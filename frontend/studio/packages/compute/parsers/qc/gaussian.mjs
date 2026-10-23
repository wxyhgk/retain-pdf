import { ELEMENTS, NUMBER, lastLine, linesOf, readRules, seconds, toNumber } from './common.mjs';

/**
 * A Gaussian output (`.log`) read into a QcOutput (qc.mjs). An input of
 * several jobs (`Opt Freq`: the frequencies are a second job, after
 * `Link1:`) is one output: the optimization's steps are those of its job, the
 * rest is what was printed last.
 */

const N = NUMBER;

/** The single values: a pattern each, the last match unless said otherwise. */
const RULES = {
	version: { pattern: /^ Gaussian (\d+):\s+\S*?Rev(\S+)/, take: 'first', read: (m) => `${m[1]} Rev. ${m[2]}` },
	charge: { pattern: /^ Charge =\s*(-?\d+) Multiplicity =/, take: 'first' },
	multiplicity: { pattern: /^ Charge =\s*-?\d+ Multiplicity =\s*(\d+)/, take: 'first' },
	scfMethod: { pattern: new RegExp(String.raw`^ SCF Done:\s+E\((\S+)\)\s*=\s*${N}`), read: (m) => m[1] },
	energy: { pattern: new RegExp(String.raw`^ SCF Done:\s+E\(\S+\)\s*=\s*(${N})`) },
	s2: { pattern: new RegExp(String.raw`<S\*\*2>=\s*(${N})\s+S=`) },
	temperature: { pattern: new RegExp(String.raw`^ Temperature\s+(${N}) Kelvin`) },
	zpe: { pattern: new RegExp(String.raw`^ Zero-point correction=\s+(${N})`) },
	enthalpy: { pattern: new RegExp(String.raw`^ Sum of electronic and thermal Enthalpies=\s+(${N})`) },
	freeEnergy: { pattern: new RegExp(String.raw`^ Sum of electronic and thermal Free Energies=\s+(${N})`) },
	dipole: { pattern: new RegExp(String.raw`^\s+X=\s*${N}\s+Y=\s*${N}\s+Z=\s*${N}\s+Tot=\s*(${N})`) },
	elapsed: { pattern: /^ Elapsed time:\s+(\d+) days\s+(\d+) hours\s+(\d+) minutes\s+([\d.]+) seconds/, take: 'all', read: (m) => seconds(m.slice(1, 5)) },
	excited: {
		pattern: new RegExp(String.raw`^ Excited State\s+(\d+):\s+(\S+)\s+(${N}) eV\s+(${N}) nm\s+f=(${N})`),
		take: 'all',
		read: (m) => ({ state: Number(m[1]), symmetry: m[2], energy: Number(m[3]), wavelength: Number(m[4]), strength: Number(m[5]) }),
	},
	normal: { pattern: /^ Normal termination of Gaussian/, take: 'all', read: () => true },
	/** Why it stopped, in Gaussian's words. */
	errors: {
		pattern: /^ (Optimization stopped\.)\s*\n\s+-- (.+)$|^ (Convergence failure -- run terminated\.)$|^ Error termination via \S+ in \S*?(l\d+)\.exe/,
		take: 'all',
		read: (m) => (m[1] ? `${m[1]} ${m[2].trim()}` : m[3] ? m[3] : `Error termination in ${m[4]}`),
	},
};

/** The route (`#p B3LYP/def2SVP Opt Freq`), its lines joined: the first job's. */
function routeOf(text) {
	const match = /^ -+\n( #[^\n]*(?:\n [^-\n][^\n]*)*)\n -+$/mu.exec(text);
	return match ? match[1].split('\n').map((line) => line.slice(1)).join('').trim() : null;
}

/** What the route asks for. */
export function gaussianJobs(route) {
	const words = (route ?? '').toLowerCase();
	const jobs = [];
	if (/(^|\s)opt\b/u.test(words)) jobs.push('opt');
	if (/(^|\s)opt[=(][^\s]*\b(ts|qst2|qst3)\b/u.test(words)) jobs.push('ts');
	if (/(^|\s)freq\b/u.test(words)) jobs.push('freq');
	if (/(^|\s)(td|tda)\b/u.test(words)) jobs.push('td');
	if (/(^|\s)irc\b/u.test(words)) jobs.push('irc');
	if (/(^|\s)scan\b|modredundant/u.test(words)) jobs.push('scan');
	return jobs.length ? jobs : ['sp'];
}

/** The archive entry's fields (`1\1\GINC-…\FOpt\RB3LYP\def2SVP\C1O2\…`), the last job's; null without one. */
function archiveOf(lines) {
	const at = lastLine(lines, /^ 1\\1\\/u);
	if (at < 0) return null;
	return lines.slice(at, at + 2).map((line) => line.slice(1)).join('').split('\\');
}

/** The geometry last printed: the standard orientation, or the input one when there is none (NoSymm). */
function atomsOf(lines) {
	let at = lastLine(lines, /^\s+Standard orientation:/u);
	if (at < 0) at = lastLine(lines, /^\s+Input orientation:/u);
	if (at < 0) return null;
	const atoms = [];
	for (const line of lines.slice(at + 5)) {
		const parts = line.trim().split(/\s+/u);
		if (parts.length !== 6 || !/^\d+$/u.test(parts[0])) break;
		atoms.push({ symbol: ELEMENTS[Number(parts[1])] ?? 'X', x: Number(parts[3]), y: Number(parts[4]), z: Number(parts[5]) });
	}
	return atoms.length ? atoms : null;
}

/** The last frequency calculation's modes: frequency, IR intensity, symmetry, how each atom moves. */
function vibrationsOf(lines, atomCount) {
	const start = lastLine(lines, /^ Harmonic frequencies \(cm\*\*-1\)/u);
	if (start < 0) return [];
	const vibrations = [];
	for (let index = start; index < lines.length; index += 1) {
		const frequencies = /^\s+Frequencies --\s+(.*)$/u.exec(lines[index]);
		if (!frequencies) {
			if (/^ - Thermochemistry -/u.test(lines[index])) break;
			continue;
		}
		const values = frequencies[1].trim().split(/\s+/u).map(Number);
		const labels = lines[index - 1].trim().split(/\s+/u);
		const symmetries = labels.length === values.length && labels.every((label) => !/^\d+$/u.test(label)) ? labels : null;
		const block = values.map((frequency, column) => ({ frequency, intensity: /** @type {number | null} */ (null), symmetry: symmetries?.[column] ?? null, displacements: /** @type {[number, number, number][]} */ ([]) }));
		let row = index + 1;
		for (; row < lines.length && !/^\s+Atom\s+AN/u.test(lines[row]); row += 1) {
			const intensity = /^\s+IR Inten\s+--\s+(.*)$/u.exec(lines[row]);
			if (intensity) intensity[1].trim().split(/\s+/u).forEach((value, column) => block[column] && (block[column].intensity = toNumber(value)));
		}
		for (let atom = 0; atom < atomCount; atom += 1) {
			const parts = (lines[row + 1 + atom] ?? '').trim().split(/\s+/u).map(Number);
			block.forEach((mode, column) => mode.displacements.push([parts[2 + column * 3], parts[3 + column * 3], parts[4 + column * 3]]));
		}
		vibrations.push(...block);
		index = row + atomCount;
	}
	return vibrations;
}

/** The orbital energies last printed: the highest occupied and lowest empty, of either spin. */
function frontierOf(lines) {
	/** @type {Record<string, number[]>} */
	let levels = {};
	let inside = false;
	for (const line of lines) {
		const match = /^\s+(Alpha|Beta)\s+(occ|virt)\. eigenvalues --(.*)$/u.exec(line);
		if (!match) {
			inside = false;
			continue;
		}
		if (!inside && match[1] === 'Alpha' && match[2] === 'occ') levels = {};
		inside = true;
		const key = `${match[1]} ${match[2]}`;
		(levels[key] ??= []).push(...(match[3].match(/-?\d+\.\d+/gu) ?? []).map(Number));
	}
	const occupied = [levels['Alpha occ']?.at(-1), levels['Beta occ']?.at(-1)].filter((value) => value !== undefined);
	const empty = [levels['Alpha virt']?.[0], levels['Beta virt']?.[0]].filter((value) => value !== undefined);
	return { homo: occupied.length ? Math.max(...occupied) : null, lumo: empty.length ? Math.min(...empty) : null };
}

/** @returns {import('./qc.mjs').QcOutput} */
export function parseGaussianOutput(text) {
	const lines = linesOf(text);
	const values = readRules(text, RULES);
	const route = routeOf(text);
	const jobs = gaussianJobs(route);
	const archive = archiveOf(lines);
	const scfMethod = values.scfMethod ?? null;
	const method = archive?.[4] ?? scfMethod;
	const basis = archive?.[5] ?? /\/([^\s/]+)/u.exec(route ?? '')?.[1] ?? null;

	// The optimization is the job whose steps are printed: its own SCF energies, one a geometry.
	let optimization = null;
	/** @type {number[]} */
	let steps = [];
	if (jobs.includes('opt')) {
		const job = text.split(/^ Link1:/mu).find((part) => /^ Step number\s+\d+/mu.test(part)) ?? '';
		steps = [...job.matchAll(new RegExp(String.raw`^ SCF Done:\s+E\(\S+\)\s*=\s*(${N})`, 'gmu'))].map((match) => Number(match[1]));
		optimization = { converged: /^ Optimization completed\./mu.test(job), cycles: [...job.matchAll(/^ Step number\s+\d+/gmu)].length };
	}

	const atoms = atomsOf(lines);
	const vibrations = jobs.includes('freq') && atoms ? vibrationsOf(lines, atoms.length) : [];
	/** @type {import('./qc.mjs').ExcitedState[]} */
	const excited = values.excited;
	const lastRun = excited.findLastIndex((state) => state.state === 1);
	const thermo = values.zpe === null ? null : { temperature: values.temperature, zpe: values.zpe, enthalpy: values.enthalpy, freeEnergy: values.freeEnergy };
	return {
		program: 'gaussian',
		version: values.version,
		route,
		// `RB3LYP TD-FC`: B3LYP, restricted (the TD-DFT is among the jobs).
		method: method?.split(' ')[0].replace(/^(RO|R|U)(?=[A-Z0-9])/u, '') ?? null,
		reference: /^(RO|R|U)(?=[A-Z0-9])/u.exec(method ?? '')?.[1] ?? null,
		basis,
		jobs,
		charge: values.charge,
		multiplicity: values.multiplicity,
		terminated: values.normal.length > 0 && !/^ Error termination/mu.test(text),
		errors: values.errors.map((/** @type {string} */ error) => error.replace(/\s+/gu, ' ')),
		energy: values.energy,
		steps,
		optimization,
		atoms,
		vibrations,
		imaginary: vibrations.length ? vibrations.filter((mode) => mode.frequency < 0).length : null,
		thermo,
		...frontierOf(lines),
		s2: values.s2,
		excited: lastRun < 0 ? [] : excited.slice(lastRun),
		dipole: values.dipole,
		wallTime: values.elapsed.length ? values.elapsed.reduce((sum, each) => sum + each, 0) : null,
	};
}
