/**
 * The input and output files of quantum chemistry programs, as code fences:
 * ```gaussian, ```orca, ```incar, ```poscar, ```kpoints, ```cp2k, ```output.
 *
 * Each is a CodeMirror stream parser, so the one definition colours the
 * Studio's code blocks (`StreamLanguage.define`) and the blog's, at build
 * time (`highlight.mjs` runs it over each line). Token names are Lezer
 * highlight tags.
 *
 * ```gjf and ```com stay molecules: their fences draw the structure.
 */

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eEdD][-+]?\d+)?(?![\w.])/;
const NUMBER_ONLY = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eEdD][-+]?\d+)?$/;
const WORD = /^[^\s=,;()[\]{}/!#*]+/;
const ELEMENT = /^(?:[A-Z][a-z]?|[a-z]{1,2})(?:\d+|\([^)]*\))?(?=\s|$)/;
const BOOLEAN = /^(?:\.(?:TRUE|FALSE|T|F)\.|TRUE|FALSE|true|false|T|F|yes|no|YES|NO)(?![\w.])/;

/** Whether the token starting now is the first on its line. */
function first(stream) {
	return /^\s*$/.test(stream.string.slice(0, stream.start));
}

/** A number, word or single character; `wordStyle` for words that are not numbers. */
function value(stream, wordStyle) {
	if (stream.match(NUMBER)) return 'number';
	if (stream.match(BOOLEAN)) return 'atom';
	if (stream.match(/^"[^"]*"?|^'[^']*'?/)) return 'string';
	if (stream.match(WORD)) return wordStyle;
	stream.next();
	return 'punctuation';
}

/** Gaussian input, a .gjf or .com file: Link 0, route, title, molecule, then any extra sections. */
const gaussian = {
	name: 'gaussian',
	startState: () => ({ section: 0, filled: false, line: 0 }),
	blankLine(state) {
		if (!state.filled) return;
		state.section += 1;
		state.filled = false;
		state.line = 0;
	},
	token(stream, state) {
		if (stream.sol()) {
			// A line of spaces ends a section as an empty one does.
			if (/^\s*$/.test(stream.string)) {
				gaussian.blankLine(state);
				stream.skipToEnd();
				return null;
			}
			state.filled = true;
			state.line += 1;
		}
		if (stream.eatSpace()) return null;
		if (stream.match('!')) {
			stream.skipToEnd();
			return 'comment';
		}
		if (first(stream) && stream.match(/^--Link1--/i)) {
			state.section = -1;
			return 'keyword';
		}
		const section = Math.max(state.section, 0);
		if (section === 0) {
			if (first(stream) && stream.match(/^%[\w-]+/)) return 'meta';
			if (stream.match(/^#[pPnNtT]?(?=\s|$)/)) return 'meta';
			// 6-31G(d) is one word, though it starts with a digit.
			const word = stream.match(WORD);
			if (word) return NUMBER_ONLY.test(word[0]) ? 'number' : 'keyword';
			stream.next();
			return 'punctuation';
		}
		if (section === 1) {
			stream.skipToEnd();
			return 'string';
		}
		if (section === 2) {
			if (state.line === 1) return value(stream, 'number');
			if (stream.match(/^Variables:/i)) return 'keyword';
			if (first(stream) && stream.match(ELEMENT)) return 'typeName';
			return value(stream, 'variableName');
		}
		if (stream.match(/^\*{4}/)) return 'meta';
		return value(stream, 'propertyName');
	},
};

/** ORCA input: `!` keywords, `%block … end`, `* xyz charge mult … *`. */
const orca = {
	name: 'orca',
	startState: () => ({ block: '' }),
	token(stream, state) {
		if (stream.eatSpace()) return null;
		if (stream.match('#')) {
			stream.skipToEnd();
			return 'comment';
		}
		if (state.block === 'coords') {
			if (first(stream) && stream.match(/^\*(?=\s|$)/)) {
				state.block = '';
				return 'meta';
			}
			if (first(stream) && stream.match(ELEMENT)) return 'typeName';
			return value(stream, 'variableName');
		}
		if (first(stream) && stream.match(/^\*\s*(?:xyzfile|gzmtfile|pdbfile)\b/i)) return 'meta';
		if (first(stream) && stream.match(/^\*\s*(?:xyz|int|gzmt|pdb)\b/i)) {
			state.block = 'coords';
			return 'meta';
		}
		if (first(stream) && stream.match('!')) {
			state.block = '';
			return 'meta';
		}
		// One-line settings, not blocks.
		if (stream.match(/^%(?:maxcore|moinp|base|id)\b/i)) {
			state.block = '';
			return 'meta';
		}
		if (stream.match(/^%\w+/)) {
			state.block = 'percent';
			return 'typeName';
		}
		if (stream.match(/^\$new_job\b/i)) return 'keyword';
		if (state.block === 'percent') {
			if (stream.match(/^end(?![\w.])/i)) return 'typeName';
			if (first(stream) && stream.match(/^[A-Za-z_]\w*/)) return 'propertyName';
			return value(stream, 'string');
		}
		return value(stream, 'keyword');
	},
};

/** VASP INCAR: `TAG = value`, several on a line when split by `;`. */
const incar = {
	name: 'incar',
	startState: () => ({ afterEquals: false }),
	token(stream, state) {
		if (stream.sol()) state.afterEquals = false;
		if (stream.eatSpace()) return null;
		if (stream.match(/^[#!]/)) {
			stream.skipToEnd();
			return 'comment';
		}
		if (stream.match(';')) {
			state.afterEquals = false;
			return 'punctuation';
		}
		if (stream.match('=')) {
			state.afterEquals = true;
			return 'operator';
		}
		if (!state.afterEquals && stream.match(/^[A-Za-z_][\w]*/)) return 'propertyName';
		return value(stream, 'string');
	},
};

/** VASP POSCAR or CONTCAR: comment, scale, lattice, species and counts, coordinates. */
const poscar = {
	name: 'poscar',
	startState: () => ({ line: 0, coordinates: 0 }),
	token(stream, state) {
		if (stream.sol()) {
			state.line += 1;
			// Line 6 holds the species in VASP 5 and later, and the counts before it.
			if (state.line === 6 && !/^\s*[A-Za-z]/.test(stream.string)) state.line = 7;
			if (state.line === 8 && !/^\s*[sS]/.test(stream.string)) state.line = 9;
		}
		if (state.line === 1) {
			stream.skipToEnd();
			return 'comment';
		}
		if (stream.eatSpace()) return null;
		if (stream.match(/^[#!]/)) {
			stream.skipToEnd();
			return 'comment';
		}
		if (state.line === 6) {
			stream.match(WORD) || stream.next();
			return 'typeName';
		}
		if (state.line === 8 || state.line === 9) {
			stream.skipToEnd();
			return 'keyword';
		}
		if (state.line > 9 && stream.match(/^[TF](?![\w.])/)) return 'atom';
		if (state.line > 9 && stream.match(/^[A-Za-z]\w*/)) return 'comment';
		return value(stream, 'string');
	},
};

/** VASP KPOINTS: comment, count, mode, then the grid or the path. */
const kpoints = {
	name: 'kpoints',
	startState: () => ({ line: 0 }),
	token(stream, state) {
		if (stream.sol()) state.line += 1;
		if (state.line === 1) {
			stream.skipToEnd();
			return 'comment';
		}
		if (stream.eatSpace()) return null;
		if (stream.match(/^[#!]/)) {
			stream.skipToEnd();
			return 'comment';
		}
		if (stream.match(/^[A-Za-z][\w-]*/)) return 'keyword';
		return value(stream, 'string');
	},
};

/** CP2K input: `&SECTION … &END`, keywords and values, `@INCLUDE`/`@SET` and `${VARIABLE}`. */
const cp2k = {
	name: 'cp2k',
	startState: () => ({}),
	token(stream) {
		if (stream.eatSpace()) return null;
		if (stream.match(/^[#!]/)) {
			stream.skipToEnd();
			return 'comment';
		}
		if (stream.match(/^&END\b/i)) {
			stream.eatSpace();
			stream.match(/^\w+/);
			return 'typeName';
		}
		if (stream.match(/^&\w+/)) return 'typeName';
		if (stream.match(/^@\w+/)) return 'meta';
		if (stream.match(/^\$\{\w+\}|^\$\w+/)) return 'variableName';
		if (stream.match(/^\[[^\]]*\]/)) return 'unit';
		if (first(stream) && stream.match(/^[A-Za-z_][\w-]*/)) return 'propertyName';
		return value(stream, 'string');
	},
};

const OUTPUT_LINES = [
	['invalid', /Error termination|\bERROR\b|\bError\b|ABORTING|\babort(?:ed|ing)\b|\bfailed\b|did not converge|NOT CONVERGED/i],
	['changed', /\bWARNING\b|\bWarning\b/],
	['inserted', /Normal termination|TERMINATED NORMALLY|Stationary point found|OPTIMIZATION RUN COMPLETED|THE OPTIMIZATION HAS CONVERGED|reached required accuracy|\bSCF CONVERGED\b/i],
	['energy', /SCF Done|FINAL SINGLE POINT ENERGY|Free Energies|Total Energy\s*[:=]|free\s+energy\s+TOTEN|energy\s+without\s+entropy|ENERGY\|\s*Total|Final Gibbs free energy|\bE\([^)]*\)\s*=|Zero-point correction/i],
];

/** A program's output, a .log or .out file: errors, warnings, normal endings and energies stand out. */
const output = {
	name: 'output',
	startState: () => ({ kind: '' }),
	token(stream, state) {
		if (stream.sol()) {
			const line = stream.string;
			state.kind = /^\s*(?:[-=*~_]{4,}\s*)+$/.test(line) ? 'rule' : OUTPUT_LINES.find(([, pattern]) => pattern.test(line))?.[0] ?? '';
		}
		if (stream.eatSpace()) return null;
		if (state.kind === 'rule') {
			stream.skipToEnd();
			return 'comment';
		}
		if (state.kind && state.kind !== 'energy') {
			stream.skipToEnd();
			return state.kind;
		}
		const number = stream.match(NUMBER);
		if (number) return state.kind === 'energy' && number[0].includes('.') ? 'number strong' : 'number';
		if (stream.match(/^[A-Za-z_][\w()-]*/)) return null;
		stream.next();
		return null;
	},
};

/**
 * @type {readonly {
 *   name: string;
 *   label: string;
 *   aliases: readonly string[];
 *   file: string;
 *   extensions: readonly string[];
 *   names: readonly string[];
 *   parser: typeof gaussian;
 * }[]}
 */
export const codeFileLanguages = Object.freeze([
	{ name: 'gaussian', label: 'Gaussian 输入', aliases: ['g16', 'g09'], file: 'input.gjf', extensions: [], names: [], parser: gaussian },
	{ name: 'orca', label: 'ORCA 输入', aliases: [], file: 'input.inp', extensions: [], names: [], parser: orca },
	{ name: 'incar', label: 'INCAR', aliases: [], file: 'INCAR', extensions: [], names: ['INCAR'], parser: incar },
	{ name: 'poscar', label: 'POSCAR', aliases: ['contcar'], file: 'POSCAR', extensions: ['vasp'], names: ['POSCAR', 'CONTCAR'], parser: poscar },
	{ name: 'kpoints', label: 'KPOINTS', aliases: [], file: 'KPOINTS', extensions: [], names: ['KPOINTS'], parser: kpoints },
	{ name: 'cp2k', label: 'CP2K 输入', aliases: [], file: 'input.inp', extensions: [], names: [], parser: cp2k },
	{ name: 'output', label: '输出', aliases: ['out'], file: 'output.out', extensions: ['out', 'log'], names: ['OUTCAR', 'OSZICAR'], parser: output },
]);

/** The code-file language a fence names, by name or alias, or undefined. */
export function codeFileLanguage(language) {
	const name = String(language ?? '').trim().toLowerCase();
	if (!name) return undefined;
	return codeFileLanguages.find((entry) => entry.name === name || entry.aliases.includes(name));
}

/** The fence language for a file in the article folder, from its name, or undefined. */
export function codeFileLanguageForPath(path) {
	const name = String(path).split('/').pop() ?? '';
	const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
	const found = codeFileLanguages.find((entry) => entry.names.includes(name.toUpperCase()) || (extension && entry.extensions.includes(extension)));
	return found?.name;
}

/** Every fence language the code files claim: names and aliases. */
export const codeFileFenceNames = Object.freeze(codeFileLanguages.flatMap((entry) => [entry.name, ...entry.aliases]));
