import { NUMBER, lastLine, linesOf, readRules, seconds } from './common.mjs';

/**
 * An ORCA output (`.out`, ORCA 6) read into a QcOutput (qc.mjs). The method
 * is read from the input's `!` lines (ORCA prints a functional only as its
 * parts); the energy is the SCF's (`FINAL SINGLE POINT ENERGY` of a TD-DFT
 * run is the first excited state's).
 */

const N = NUMBER;

/** The single values: a pattern each, the last match unless said otherwise. */
const RULES = {
	version: { pattern: /Program Version (\S+)/, take: 'first', read: (m) => m[1] },
	keywords: { pattern: /^\|\s*\d+> !(.*)$/, take: 'all', read: (m) => m[1].trim() },
	blocks: { pattern: /^\|\s*\d+> %(\w+)/, take: 'all', read: (m) => m[1].toLowerCase() },
	basis: { pattern: /^Your calculation utilizes the basis: (\S+)/, take: 'first', read: (m) => m[1] },
	reference: { pattern: /^\s+Hartree-Fock type\s+HFTyp\s+\.+\s+(\w+)/, read: (m) => ({ RHF: 'R', UHF: 'U', ROHF: 'RO' })[m[1]] ?? null },
	charge: { pattern: /^\s+Total Charge\s+Charge\s+\.+\s+(-?\d+)/, take: 'first' },
	multiplicity: { pattern: /^\s+Multiplicity\s+Mult\s+\.+\s+(\d+)/, take: 'first' },
	energy: { pattern: new RegExp(String.raw`^Total Energy\s+:\s+(${N}) Eh`) },
	s2: { pattern: new RegExp(String.raw`^Expectation value of <S\*\*2>\s+:\s+(${N})`) },
	temperature: { pattern: new RegExp(String.raw`^Temperature\s+\.\.\.\s+(${N}) K`) },
	zpe: { pattern: new RegExp(String.raw`^Zero point energy\s+\.\.\.\s+(${N}) Eh`) },
	enthalpy: { pattern: new RegExp(String.raw`^Total enthalpy\s+\.\.\.\s+(${N}) Eh`) },
	freeEnergy: { pattern: new RegExp(String.raw`^Final Gibbs free energy\s+\.\.\.\s+(${N}) Eh`) },
	dipole: { pattern: new RegExp(String.raw`^Magnitude \(Debye\)\s+:\s+(${N})`) },
	wallTime: { pattern: /^TOTAL RUN TIME: (\d+) days (\d+) hours (\d+) minutes (\d+) seconds (\d+) msec/, read: (m) => seconds(m.slice(1, 4).concat(String(Number(m[4]) + Number(m[5]) / 1000))) },
	normal: { pattern: /\*\*\*\*ORCA TERMINATED NORMALLY\*\*\*\*/, take: 'all', read: () => true },
	/** Why it stopped, or what it says went wrong, in ORCA's words. */
	errors: {
		pattern: /(The optimization did not converge but reached the maximum number of\s+optimization cycles\.)|^ORCA finished by error termination in (\S+)|(SCF NOT CONVERGED AFTER\s+\d+ CYCLES)|^\s*(ABORTING THE RUN)/,
		take: 'all',
		read: (m) => (m[2] ? `Error termination in ${m[2]}` : (m[1] ?? m[3] ?? m[4])),
	},
};

/** Words of the `!` lines that say how to run, not with what method. */
const NOT_METHOD = /^(sp|engrad|opt|optts|copt|zopt|tightopt|verytightopt|looseopt|freq|numfreq|anfreq|irc|scan|uks|rks|uhf|rhf|roks|rohf|(very|extreme)?tightscf|loosescf|normalscf|slowconv|veryslowconv|kdiis|soscf|nososcf|rijcosx|rij|ri|nori|nocosx|ri-jk|autoaux|(final)?(def)?grid\d|largeprint|normalprint|miniprint|smallprint|printbasis|nopop|keepdens|moread|noautostart|xyzfile|pdbfile|pal\d+|cpcm(\(.*\))?|smd(\(.*\))?|alpb(\(.*\))?|frozencore|nofrozencore|d2|d3|d3bj|d3zero|d4|tda)$/iu;
const DISPERSION = /^(d2|d3|d3bj|d3zero|d4)$/iu;

/** What the `!` lines and the `%` blocks ask for. */
export function orcaJobs(keywords, blocks) {
	const words = keywords.join(' ').toLowerCase().split(/\s+/u);
	const jobs = [];
	if (words.some((word) => /^(opt|optts|copt|zopt|tightopt|verytightopt|looseopt)$/u.test(word))) jobs.push('opt');
	if (words.includes('optts')) jobs.push('ts');
	if (words.some((word) => /^(freq|numfreq|anfreq)$/u.test(word))) jobs.push('freq');
	if (blocks.includes('tddft') || blocks.includes('cis') || words.includes('tda')) jobs.push('td');
	if (words.includes('irc')) jobs.push('irc');
	if (words.includes('scan')) jobs.push('scan');
	return jobs.length ? jobs : ['sp'];
}

/** The method the `!` lines name: the word that is no job, setting or basis set, with its dispersion. */
function methodOf(keywords, basis) {
	const words = keywords.join(' ').split(/\s+/u).filter(Boolean);
	const method = words.find((word) => !NOT_METHOD.test(word) && !word.includes('/') && word.toLowerCase() !== basis?.toLowerCase());
	const dispersion = words.find((word) => DISPERSION.test(word));
	return method ? `${method}${dispersion ? `-${dispersion.toUpperCase()}` : ''}` : null;
}

/** The geometry last printed. */
function atomsOf(lines) {
	const at = lastLine(lines, /^CARTESIAN COORDINATES \(ANGSTROEM\)/u);
	if (at < 0) return null;
	const atoms = [];
	for (const line of lines.slice(at + 2)) {
		const parts = line.trim().split(/\s+/u);
		if (parts.length !== 4 || !/^[A-Z][a-z]?$/u.test(parts[0])) break;
		atoms.push({ symbol: parts[0], x: Number(parts[1]), y: Number(parts[2]), z: Number(parts[3]) });
	}
	return atoms.length ? atoms : null;
}

/** The lines after a section's title (the last one printed), `skip` more left out. */
function sectionAfter(lines, title, skip = 0) {
	const at = lastLine(lines, title);
	return at < 0 ? [] : lines.slice(at + 1 + skip);
}

/** The last frequency calculation's vibrations (without translations and rotations): frequency, IR intensity, how each atom moves. */
function vibrationsOf(lines, atomCount) {
	const listed = [];
	let started = false;
	for (const line of sectionAfter(lines, /^VIBRATIONAL FREQUENCIES$/u)) {
		const match = new RegExp(String.raw`^\s+(\d+):\s+(${N}) cm\*\*-1`, 'u').exec(line);
		if (match) {
			started = true;
			listed.push({ mode: Number(match[1]), frequency: Number(match[2]) });
		} else if (started && !line.trim()) break;
	}
	// Translations and rotations are printed as 0.00. (Not ORCA's "first frequency considered to be a
	// vibration": that one leaves imaginary modes out, for the thermochemistry.)
	const vibrating = listed.filter((entry) => entry.frequency !== 0);

	/** @type {Map<number, number>} */
	const intensities = new Map();
	for (const line of sectionAfter(lines, /^IR SPECTRUM$/u)) {
		const match = new RegExp(String.raw`^\s+(\d+):\s+${N}\s+${N}\s+(${N})\s`, 'u').exec(line);
		if (match) intensities.set(Number(match[1]), Number(match[2]));
		else if (intensities.size && !line.trim()) break;
	}

	/** @type {Map<number, number[]>} the columns of the normal modes, by mode */
	const columns = new Map();
	let heads = [];
	for (const line of sectionAfter(lines, /^NORMAL MODES$/u)) {
		if (/^-{5,}$/u.test(line.trim()) || /^[A-Z]/u.test(line)) {
			if (columns.size) break;
			continue;
		}
		const parts = line.trim().split(/\s+/u);
		if (!parts[0]) continue;
		if (parts.every((part) => /^\d+$/u.test(part))) {
			heads = parts.map(Number);
			continue;
		}
		if (heads.length && parts.length === heads.length + 1 && /^\d+$/u.test(parts[0])) {
			heads.forEach((mode, column) => {
				if (!columns.has(mode)) columns.set(mode, []);
				columns.get(mode)?.push(Number(parts[column + 1]));
			});
		}
	}

	return vibrating.map((entry) => {
		const column = columns.get(entry.mode) ?? [];
		/** @type {[number, number, number][]} */
		const displacements = [];
		for (let atom = 0; atom < atomCount; atom += 1) displacements.push([column[atom * 3] ?? 0, column[atom * 3 + 1] ?? 0, column[atom * 3 + 2] ?? 0]);
		return { frequency: entry.frequency, intensity: intensities.get(entry.mode) ?? null, symmetry: null, displacements };
	});
}

/** The orbital energies last printed: the highest occupied and lowest empty, of either spin. */
function frontierOf(lines) {
	let homo = null;
	let lumo = null;
	for (const line of sectionAfter(lines, /^ORBITAL ENERGIES$/u, 1)) {
		if (/^\*|MULLIKEN|^-{5,}$/u.test(line.trim())) break;
		const match = new RegExp(String.raw`^\s*\d+\s+(${N})\s+(${N})\s+${N}\s*$`, 'u').exec(line);
		if (!match) continue;
		const [occupation, energy] = [Number(match[1]), Number(match[2])];
		if (occupation > 0) homo = homo === null ? energy : Math.max(homo, energy);
		else lumo = lumo === null ? energy : Math.min(lumo, energy);
	}
	return { homo, lumo };
}

/** The excited states of the last TD-DFT (or CIS) run: their absorption, from the transition electric dipoles. */
function excitedOf(lines) {
	const states = [];
	for (const line of sectionAfter(lines, /ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS/u, 4)) {
		const match = new RegExp(String.raw`^\s+\S+\s+->\s+(\d+)-(\S+)\s+(${N})\s+${N}\s+(${N})\s+(${N})`, 'u').exec(line);
		if (!match) break;
		states.push({ state: Number(match[1]), symmetry: match[2], energy: Number(match[3]), wavelength: Number(match[4]), strength: Number(match[5]) });
	}
	return states;
}

/** @returns {import('./qc.mjs').QcOutput} */
export function parseOrcaOutput(text) {
	const lines = linesOf(text);
	const values = readRules(text, RULES);
	const jobs = orcaJobs(values.keywords, values.blocks);

	// The optimization's steps: the energies printed from its first cycle until it says how it ended.
	let optimization = null;
	/** @type {number[]} */
	let steps = [];
	if (jobs.includes('opt')) {
		const from = text.search(/GEOMETRY OPTIMIZATION CYCLE\s+1\s/u);
		const ended = text.slice(Math.max(from, 0)).search(/THE OPTIMIZATION HAS CONVERGED|The optimization did not converge/u);
		const job = from < 0 ? '' : text.slice(from, ended < 0 ? undefined : from + ended);
		steps = [...job.matchAll(new RegExp(String.raw`^FINAL SINGLE POINT ENERGY\s+(${N})`, 'gmu'))].map((match) => Number(match[1]));
		optimization = { converged: /THE OPTIMIZATION HAS CONVERGED/u.test(text), cycles: [...text.matchAll(/GEOMETRY OPTIMIZATION CYCLE\s+\d+\s/gu)].length };
	}

	const atoms = atomsOf(lines);
	const vibrations = jobs.includes('freq') && atoms ? vibrationsOf(lines, atoms.length) : [];
	const thermo = values.zpe === null ? null : { temperature: values.temperature, zpe: values.zpe, enthalpy: values.enthalpy, freeEnergy: values.freeEnergy };
	return {
		program: 'orca',
		version: values.version,
		route: values.keywords.length ? `! ${values.keywords.join(' ')}` : null,
		method: methodOf(values.keywords, values.basis),
		reference: values.reference,
		basis: values.basis,
		jobs,
		charge: values.charge,
		multiplicity: values.multiplicity,
		terminated: values.normal.length > 0,
		errors: values.errors.map((error) => error.replace(/\s+/gu, ' ')),
		energy: values.energy,
		steps,
		optimization,
		atoms,
		vibrations,
		imaginary: vibrations.length ? vibrations.filter((mode) => mode.frequency < 0).length : null,
		thermo,
		...frontierOf(lines),
		s2: values.s2,
		excited: jobs.includes('td') ? excitedOf(lines) : [],
		dipole: values.dipole,
		wallTime: values.wallTime,
	};
}
