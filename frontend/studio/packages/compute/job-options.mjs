/**
 * Command lines, for the programs (programs.mjs): split and joined as a
 * shell does, and what xtb and the programs built on it (CREST) take alike —
 * charge, unpaired electrons, a solvent — as a form's fields and back. A
 * program's own words (its task, its method…) are its own (plugins/xtb,
 * plugins/crest); whatever no field knows is kept as it was, after them, so
 * the command line is the job, and the form a way of writing it.
 */

/** The solvents both ALPB and GBSA have (xtb's names), with what to call them. */
export const SOLVENTS = Object.freeze({
	water: '水',
	methanol: '甲醇',
	ethanol: '乙醇',
	acetone: '丙酮',
	acetonitrile: '乙腈',
	chcl3: '氯仿',
	ch2cl2: '二氯甲烷',
	dmso: 'DMSO',
	dmf: 'DMF',
	thf: 'THF',
	toluene: '甲苯',
	benzene: '苯',
	hexane: '正己烷',
	ether: '乙醚',
	cs2: '二硫化碳',
	octanol: '正辛醇',
	ethylacetate: '乙酸乙酯',
	nitromethane: '硝基甲烷',
});

/** Words of a command line, as a shell splits them (quotes, no expansion). */
export function splitArgs(text) {
	const words = [];
	let word = null;
	let quote = null;
	for (const character of String(text ?? '')) {
		if (quote) {
			if (character === quote) quote = null;
			else word += character;
		} else if (character === '"' || character === "'") {
			quote = character;
			word ??= '';
		} else if (/\s/u.test(character)) {
			if (word !== null) words.push(word);
			word = null;
		} else {
			word = (word ?? '') + character;
		}
	}
	if (word !== null) words.push(word);
	return words;
}

/** Words as a command line, quoted where a shell would need it. */
export function joinArgs(words) {
	return words.map((word) => (/^[\w@%+=:,./-]+$/u.test(word) ? word : `'${word.replaceAll("'", '')}'`)).join(' ');
}

const integer = (word) => (word !== undefined && /^[+-]?\d+$/u.test(word) ? Number(word) : null);

/**
 * xtb's charge, unpaired electrons and solvent, at `words[index]`: how many
 * words they took (0 when that word is none of them), into `options`.
 * @param {string[]} words
 * @param {number} index
 * @param {{ charge: number, uhf: number, solvent: { model: string, name: string } | null }} options
 */
export function readXtbCommon(words, index, options) {
	const word = words[index];
	const next = words[index + 1];
	if ((word === '--chrg' || word === '-c') && integer(next) !== null) {
		options.charge = integer(next);
		return 2;
	}
	if ((word === '--uhf' || word === '-u') && integer(next) !== null && integer(next) >= 0) {
		options.uhf = integer(next);
		return 2;
	}
	if ((word === '--alpb' || word === '--gbsa') && next !== undefined && !next.startsWith('-')) {
		options.solvent = { model: word.slice(2), name: next };
		return 2;
	}
	return 0;
}

/** Those as words of the command line. */
export function writeXtbCommon(options) {
	const words = [];
	if (options.charge) words.push('--chrg', String(options.charge));
	if (options.uhf) words.push('--uhf', String(options.uhf));
	if (options.solvent?.name) words.push(`--${options.solvent.model === 'gbsa' ? 'gbsa' : 'alpb'}`, options.solvent.name);
	return words;
}

/** Those as parts of the line saying what the job does. */
export function describeXtbCommon(options) {
	const parts = [];
	if (options.charge) parts.push(`电荷 ${options.charge > 0 ? '+' : ''}${options.charge}`);
	if (options.uhf) parts.push(`${options.uhf} 个未成对电子`);
	if (options.solvent) parts.push(`${SOLVENTS[options.solvent.name] ?? options.solvent.name}（${options.solvent.model.toUpperCase()}）`);
	return parts;
}

const solventChoices = (options) => [
	...(options.solvent && !SOLVENTS[options.solvent.name] ? [[options.solvent.name, options.solvent.name]] : []),
	...Object.entries(SOLVENTS).map(([key, name]) => [key, `${name} ${key}`]),
];

/** Those as the form's fields (programs.d.mts ProgramField). */
export const XTB_COMMON_FIELDS = Object.freeze([
	{ key: 'charge', label: '电荷', kind: 'number', min: -20, max: 20, get: (options) => String(options.charge), set: (options, value) => ({ ...options, charge: Number.parseInt(value, 10) || 0 }) },
	{ key: 'uhf', label: '未成对电子', kind: 'number', min: 0, max: 20, get: (options) => String(options.uhf), set: (options, value) => ({ ...options, uhf: Math.max(0, Number.parseInt(value, 10) || 0) }) },
	{
		key: 'solvent-model',
		label: '溶剂模型',
		kind: 'select',
		choices: () => [['', '无（气相）'], ['alpb', 'ALPB'], ['gbsa', 'GBSA']],
		get: (options) => options.solvent?.model ?? '',
		set: (options, value) => ({ ...options, solvent: value ? { model: value, name: options.solvent?.name ?? 'water' } : null }),
	},
	{
		key: 'solvent',
		label: '溶剂',
		kind: 'select',
		choices: solventChoices,
		shown: (options) => Boolean(options.solvent),
		get: (options) => options.solvent?.name ?? '',
		set: (options, value) => ({ ...options, solvent: options.solvent ? { ...options.solvent, name: value } : null }),
	},
]);
