import { describeXtbCommon, joinArgs, readXtbCommon, splitArgs, writeXtbCommon, XTB_COMMON_FIELDS } from '@blog/compute/job-options.mjs';

/**
 * xtb as a program of ```job blocks (@blog/compute/programs.mjs): its
 * tasks (a single point, an optimization, frequencies, both), its methods,
 * an optimization's level, and what it shares with the programs built on
 * it (charge, unpaired electrons, solvent).
 */

/** What an xtb job does; `--opt`, `--hess`, `--ohess` take a level. */
export const XTB_TASKS = Object.freeze({
	sp: { name: '单点能', flag: '' },
	opt: { name: '结构优化', flag: '--opt' },
	hess: { name: '频率', flag: '--hess' },
	ohess: { name: '优化 + 频率', flag: '--ohess' },
});

export const XTB_METHODS = Object.freeze({ gfn2: 'GFN2-xTB', gfn1: 'GFN1-xTB', gfn0: 'GFN0-xTB', gfnff: 'GFN-FF' });

export const OPT_LEVELS = Object.freeze(['crude', 'sloppy', 'loose', 'lax', 'normal', 'tight', 'vtight', 'extreme']);

/** The form's fields for an xtb command line. */
export function readXtbOptions(args) {
	const options = { task: 'sp', method: 'gfn2', level: '', charge: 0, uhf: 0, solvent: null, extra: [] };
	const words = splitArgs(args);
	for (let index = 0; index < words.length; index += 1) {
		const word = words[index];
		const next = words[index + 1];
		const common = readXtbCommon(words, index, options);
		if (common) {
			index += common - 1;
		} else if (['--opt', '--hess', '--ohess'].includes(word)) {
			options.task = word.slice(2);
			if (next !== undefined && OPT_LEVELS.includes(next)) {
				options.level = next;
				index += 1;
			}
		} else if (word === '--gfn' && ['0', '1', '2'].includes(next)) {
			options.method = `gfn${next}`;
			index += 1;
		} else if (word === '--gfnff') {
			options.method = 'gfnff';
		} else {
			options.extra.push(word);
		}
	}
	return options;
}

/** The command line for the form's fields, the words it did not know after them. */
export function writeXtbArgs(options) {
	const words = [];
	const task = XTB_TASKS[options.task];
	if (task?.flag) {
		words.push(task.flag);
		if (options.level && OPT_LEVELS.includes(options.level)) words.push(options.level);
	}
	if (options.method === 'gfnff') words.push('--gfnff');
	else if (options.method && options.method !== 'gfn2') words.push('--gfn', options.method.slice(3));
	return joinArgs([...words, ...writeXtbCommon(options), ...(options.extra ?? [])]);
}

/** @type {import('@blog/compute/programs.mjs').JobProgram} */
export const xtb = Object.freeze({
	name: 'xtb',
	label: 'xtb',
	order: 10,
	starter: '--opt',
	read: readXtbOptions,
	write: writeXtbArgs,
	describe: (options) => [XTB_TASKS[options.task]?.name ?? options.task, XTB_METHODS[options.method] ?? options.method, ...describeXtbCommon(options)].join(' · '),
	fields: [
		{ key: 'task', label: '任务', kind: 'select', choices: () => Object.entries(XTB_TASKS).map(([key, value]) => [key, value.name]), get: (options) => options.task, set: (options, value) => ({ ...options, task: value, level: ['opt', 'ohess'].includes(value) ? options.level : '' }) },
		{ key: 'method', label: '方法', kind: 'select', choices: () => Object.entries(XTB_METHODS), get: (options) => options.method, set: (options, value) => ({ ...options, method: value }) },
		{
			key: 'level',
			label: '优化精度',
			kind: 'select',
			choices: () => [['', '默认'], ...OPT_LEVELS.map((name) => [name, name])],
			shown: (options) => ['opt', 'ohess'].includes(options.task),
			get: (options) => options.level,
			set: (options, value) => ({ ...options, level: value }),
		},
		...XTB_COMMON_FIELDS,
	],
	// The threads, unless the command line already says how many.
	command: (input, args, threads) => {
		const words = splitArgs(args);
		const parallel = threads && !words.includes('-P') && !words.includes('--parallel') ? ['--parallel', String(threads)] : [];
		return ['xtb', input, ...words, ...parallel];
	},
	output: 'xtb.out',
	live: ['xtb.out', 'xtbopt.log'],
	scratch: ['xtbrestart', 'gfnff_topo', 'gfnff_charges', 'gfnff_adjacency', '*.mdrestart'],
	beside: ['crest'],
});
