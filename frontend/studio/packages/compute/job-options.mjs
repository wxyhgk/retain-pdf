/**
 * A job's command line (the fence's `args=`) as the fields of its form, and
 * back. The form knows the task, the method, charge and unpaired electrons,
 * the solvent and, for an optimization, how tight; whatever else is written
 * is kept as it was, after them. So the command line is the job, and the
 * form a way of writing it.
 */

/** What an xtb job does; `--opt`, `--hess`, `--ohess` take a level. */
export const XTB_TASKS = Object.freeze({
	sp: { name: '单点能', flag: '' },
	opt: { name: '结构优化', flag: '--opt' },
	hess: { name: '频率', flag: '--hess' },
	ohess: { name: '优化 + 频率', flag: '--ohess' },
});

export const CREST_TASKS = Object.freeze({
	conformers: { name: '构象搜索', flag: '' },
});

export const XTB_METHODS = Object.freeze({ gfn2: 'GFN2-xTB', gfn1: 'GFN1-xTB', gfn0: 'GFN0-xTB', gfnff: 'GFN-FF' });
export const CREST_METHODS = Object.freeze({ gfn2: 'GFN2-xTB', gfn1: 'GFN1-xTB', gfn0: 'GFN0-xTB', gfnff: 'GFN-FF', 'gfn2//gfnff': 'GFN2//GFN-FF' });

export const OPT_LEVELS = Object.freeze(['crude', 'sloppy', 'loose', 'lax', 'normal', 'tight', 'vtight', 'extreme']);

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

export const DEFAULT_OPTIONS = Object.freeze({
	xtb: { task: 'opt', method: 'gfn2', level: '', charge: 0, uhf: 0, solvent: null, ewin: null, extra: [] },
	crest: { task: 'conformers', method: 'gfn2', level: '', charge: 0, uhf: 0, solvent: null, ewin: null, extra: [] },
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
 * The form's fields for a job's command line.
 * @param {'xtb' | 'crest'} program
 * @param {string} args
 */
export function readJobOptions(program, args) {
	const options = { ...DEFAULT_OPTIONS[program === 'crest' ? 'crest' : 'xtb'], task: program === 'crest' ? 'conformers' : 'sp', extra: [] };
	const words = splitArgs(args);
	for (let index = 0; index < words.length; index += 1) {
		const word = words[index];
		const next = words[index + 1];
		const take = () => {
			index += 1;
			return next;
		};
		if (program !== 'crest' && ['--opt', '--hess', '--ohess'].includes(word)) {
			options.task = word.slice(2);
			if (next !== undefined && OPT_LEVELS.includes(next)) options.level = take();
		} else if (program !== 'crest' && word === '--gfn' && ['0', '1', '2'].includes(next)) {
			options.method = `gfn${take()}`;
		} else if (word === '--gfnff') {
			options.method = 'gfnff';
		} else if (program === 'crest' && /^--gfn[012](?:\/\/gfnff)?$/u.test(word)) {
			options.method = word.slice(2);
		} else if ((word === '--chrg' || word === '-c') && integer(next) !== null) {
			options.charge = integer(take());
		} else if ((word === '--uhf' || word === '-u') && integer(next) !== null && integer(next) >= 0) {
			options.uhf = integer(take());
		} else if ((word === '--alpb' || word === '--gbsa') && next !== undefined && !next.startsWith('-')) {
			options.solvent = { model: word.slice(2), name: take() };
		} else if (program === 'crest' && word === '--ewin' && next !== undefined && Number.isFinite(Number(next))) {
			options.ewin = Number(take());
		} else {
			options.extra.push(word);
		}
	}
	return options;
}

/** The command line for the form's fields, the words it did not know after them. */
export function writeJobArgs(program, options) {
	const words = [];
	if (program === 'crest') {
		if (options.method && options.method !== 'gfn2') words.push(`--${options.method}`);
		else words.push('--gfn2');
	} else {
		const task = XTB_TASKS[options.task];
		if (task?.flag) {
			words.push(task.flag);
			if (options.level && OPT_LEVELS.includes(options.level)) words.push(options.level);
		}
		if (options.method === 'gfnff') words.push('--gfnff');
		else if (options.method && options.method !== 'gfn2') words.push('--gfn', options.method.slice(3));
	}
	if (options.charge) words.push('--chrg', String(options.charge));
	if (options.uhf) words.push('--uhf', String(options.uhf));
	if (options.solvent?.name) words.push(`--${options.solvent.model === 'gbsa' ? 'gbsa' : 'alpb'}`, options.solvent.name);
	if (program === 'crest' && options.ewin !== null && options.ewin !== undefined) words.push('--ewin', String(options.ewin));
	return joinArgs([...words, ...(options.extra ?? [])]);
}

/** The words a run adds for its threads, unless the command line already says how many. */
export function threadArgs(program, args, threads) {
	if (!threads) return [];
	const words = splitArgs(args);
	if (program === 'crest') return words.includes('-T') || words.includes('--threads') ? [] : ['-T', String(threads)];
	return words.includes('-P') || words.includes('--parallel') ? [] : ['--parallel', String(threads)];
}

/**
 * What a run of the job executes, in its folder: the program, the input,
 * the command line and the threads. `input` is the structure's file name there.
 */
export function jobCommand(program, args, input, threads) {
	return [program, input, ...splitArgs(args), ...threadArgs(program, args, threads)];
}

/** The file a program's output goes to, in the run's folder. */
export function outputFile(program) {
	return program === 'crest' ? 'crest.out' : 'xtb.out';
}

/** A line saying what the job does, for the block's head: 「结构优化 · GFN2-xTB · 水 (ALPB)」. */
export function describeJob(program, options) {
	const tasks = program === 'crest' ? CREST_TASKS : XTB_TASKS;
	const methods = program === 'crest' ? CREST_METHODS : XTB_METHODS;
	const parts = [tasks[options.task]?.name ?? options.task, methods[options.method] ?? options.method];
	if (options.charge) parts.push(`电荷 ${options.charge > 0 ? '+' : ''}${options.charge}`);
	if (options.uhf) parts.push(`${options.uhf} 个未成对电子`);
	if (options.solvent) parts.push(`${SOLVENTS[options.solvent.name] ?? options.solvent.name}（${options.solvent.model.toUpperCase()}）`);
	return parts.join(' · ');
}
