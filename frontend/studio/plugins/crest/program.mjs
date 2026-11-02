import { describeXtbCommon, joinArgs, readXtbCommon, splitArgs, writeXtbCommon, XTB_COMMON_FIELDS } from '@blog/compute/job-options.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * CREST as a program of ```job blocks (@blog/compute/programs.mjs): a
 * conformer search, with its method, its energy window, and what it takes
 * as xtb does (charge, unpaired electrons, solvent). It calls xtb, which is
 * looked for beside it.
 */

export const CREST_METHODS = Object.freeze({ gfn2: 'GFN2-xTB', gfn1: 'GFN1-xTB', gfn0: 'GFN0-xTB', gfnff: 'GFN-FF', 'gfn2//gfnff': 'GFN2//GFN-FF' });

/** The form's fields for a CREST command line. */
export function readCrestOptions(args) {
	const options = { task: 'conformers', method: 'gfn2', charge: 0, uhf: 0, solvent: null, ewin: null, extra: [] };
	const words = splitArgs(args);
	for (let index = 0; index < words.length; index += 1) {
		const word = words[index];
		const next = words[index + 1];
		const common = readXtbCommon(words, index, options);
		if (common) {
			index += common - 1;
		} else if (word === '--gfnff') {
			options.method = 'gfnff';
		} else if (/^--gfn[012](?:\/\/gfnff)?$/u.test(word)) {
			options.method = word.slice(2);
		} else if (word === '--ewin' && next !== undefined && Number.isFinite(Number(next))) {
			options.ewin = Number(next);
			index += 1;
		} else {
			options.extra.push(word);
		}
	}
	return options;
}

export function writeCrestArgs(options) {
	const words = [options.method && options.method !== 'gfn2' ? `--${options.method}` : '--gfn2', ...writeXtbCommon(options)];
	if (options.ewin !== null && options.ewin !== undefined) words.push('--ewin', String(options.ewin));
	return joinArgs([...words, ...(options.extra ?? [])]);
}

/** @type {import('@blog/compute/programs.mjs').JobProgram} */
export const crest = Object.freeze({
	name: 'crest',
	label: 'CREST',
	order: 20,
	starter: '--gfn2',
	read: readCrestOptions,
	write: writeCrestArgs,
	describe: (options) => [t('构象搜索'), CREST_METHODS[options.method] ?? options.method, ...describeXtbCommon(options)].join(' · '),
	fields: [
		{
			key: 'method',
			get label() {
				return t('方法');
			},
			kind: 'select',
			choices: () => Object.entries(CREST_METHODS),
			get: (options) => options.method,
			set: (options, value) => ({ ...options, method: value }),
		},
		{
			key: 'ewin',
			get label() {
				return t('能量窗口 kcal/mol');
			},
			kind: 'number',
			min: 0,
			max: 100,
			step: 0.5,
			get placeholder() {
				return t('默认 6');
			},
			get: (options) => (options.ewin === null ? '' : String(options.ewin)),
			set: (options, value) => ({ ...options, ewin: value.trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value) }),
		},
		...XTB_COMMON_FIELDS,
	],
	command: (input, args, threads) => {
		const words = splitArgs(args);
		const parallel = threads && !words.includes('-T') && !words.includes('--threads') ? ['-T', String(threads)] : [];
		return ['crest', input, ...words, ...parallel];
	},
	output: 'crest.out',
	live: ['crest.out'],
	scratch: ['crest.restart', 'cre_members', 'xtbrestart', 'gfnff_topo', 'gfnff_charges', 'gfnff_adjacency', '*.mdrestart'],
});
