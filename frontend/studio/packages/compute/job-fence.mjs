import { t } from '@blog/i18n/index.mjs';

/**
 * A calculation in an article: a ```job fence names the program and how it
 * is run, and holds the structure it starts from, so that without the
 * Studio (or without scripts) the fence still reads as the molecule:
 *
 *     ```job id=water-opt program=xtb args="--opt tight --alpb water" host=local title="水的结构优化" run=20261019-153012
 *     3
 *     water
 *     O   0.000000   0.000000   0.117300
 *     H   0.000000   0.757200  -0.469200
 *     H   0.000000  -0.757200  -0.469200
 *     ```
 *
 * or, for a structure that is a file of the article, `@file ./assets/mol.xyz`.
 *
 * Every run of a job is kept in the article, in its own folder:
 * `assets/jobs/<id>/<run>/`, with what was run and how it ended in
 * `run.json`, the input and everything the program wrote. `run=` is the one
 * the article shows; the others stay, to go back to.
 */

export const JOB_LANGUAGE = 'job';

/** A job's name, and a run's: what its folder is called. */
export const JOB_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const RUN_NAME_PATTERN = /^\d{8}-\d{6}(?:-\d+)?$/u;

/** Where the runs of a job are, in the article's folder. */
export const JOBS_FOLDER = 'assets/jobs';

/** Structure files a job can start from, by extension. */
export const STRUCTURE_EXTENSIONS = Object.freeze(['xyz', 'sdf', 'mol', 'pdb', 'coord']);

/** Each key the fence's meta holds, in the order it is written. */
const KEYS = ['id', 'program', 'args', 'host', 'threads', 'title', 'run'];

/**
 * What a ```job fence says. Unknown keys are kept, in `rest`, and written
 * back as they were.
 * @param {string | null | undefined} meta
 * @param {string | null | undefined} body
 */
export function parseJobFence(meta, body) {
	const options = { id: '', program: 'xtb', args: '', host: 'local', threads: 0, title: '', run: '' };
	const rest = [];
	for (const match of String(meta ?? '').matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))|(\S+)/gu)) {
		if (match[5]) {
			rest.push(match[5]);
			continue;
		}
		const key = match[1].toLowerCase();
		const value = match[2] ?? match[3] ?? match[4];
		if (key === 'threads') options.threads = /^\d{1,4}$/u.test(value) ? Number(value) : 0;
		else if (key === 'program') options.program = value.toLowerCase();
		else if (KEYS.includes(key)) options[key] = value;
		else rest.push(match[0]);
	}
	return { ...options, rest, structure: jobStructure(body) };
}

/** `assets/mol.xyz` for `./assets/mol.xyz`: a path inside the article's folder; null for one that leaves it or is a URL. */
function inArticle(written) {
	const url = String(written).trim();
	if (!url || /^[a-z][a-z0-9+.-]*:/iu.test(url) || url.startsWith('/')) return null;
	const segments = [];
	for (const segment of url.replace(/[?#].*$/su, '').split('/')) {
		let name = segment;
		try {
			name = decodeURIComponent(segment);
		} catch {
			// Written as it is.
		}
		if (name === '' || name === '.') continue;
		if (name === '..') {
			if (!segments.length) return null;
			segments.pop();
		} else segments.push(name);
	}
	return segments.length ? segments.join('/') : null;
}

/** What the job starts from: the structure written in the fence, a file of the article, or nothing yet. */
export function jobStructure(body) {
	const text = String(body ?? '');
	const file = /^\s*@file[ \t]+(\S+)\s*$/u.exec(text);
	if (file) {
		const path = inArticle(file[1]);
		return { kind: 'file', written: file[1], path };
	}
	if (!text.trim()) return { kind: 'none' };
	return { kind: 'inline', text, format: /^\s*M\s+END\s*$/mu.test(text) ? 'mol' : 'xyz' };
}

/** A value for the meta, quoted when it has to be. */
function quote(value) {
	const text = String(value);
	if (text && !/[\s"']/u.test(text)) return text;
	if (!text.includes('"')) return `"${text}"`;
	if (!text.includes("'")) return `'${text}'`;
	return `"${text.replaceAll('"', '')}"`;
}

/**
 * The meta of a ```job fence for these options; empty values are left out
 * (`host=local` and `program=xtb` are written anyway, as a reader of the
 * Markdown would want to see them).
 */
export function jobFenceMeta(options) {
	const parts = [];
	for (const key of KEYS) {
		const value = options[key];
		if (key === 'threads' ? !value : value === undefined || value === null || value === '') continue;
		if (key === 'args' && !String(value).trim()) continue;
		parts.push(`${key}=${quote(value)}`);
	}
	return [...parts, ...(options.rest ?? [])].join(' ');
}

/** The folder a run of a job is kept in, in its article: `assets/jobs/<id>/<run>`. */
export function runFolder(id, run) {
	if (!JOB_ID_PATTERN.test(String(id))) throw new Error(t('任务名 {id} 只能用小写字母、数字和连字符', { id }));
	if (!RUN_NAME_PATTERN.test(String(run))) throw new Error(t('运行名 {run} 不对', { run }));
	return `${JOBS_FOLDER}/${id}/${run}`;
}

/** A run's name: when it was started, `20261019-153012`, in the local time of the machine that started it. */
export function runName(date = new Date()) {
	const two = (value) => String(value).padStart(2, '0');
	return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
}

/** A new job's name, not one of `taken`: `job-` and six letters or digits. */
export function newJobId(taken = [], random = Math.random) {
	const used = new Set(taken);
	for (;;) {
		let id = 'job-';
		for (let index = 0; index < 6; index += 1) id += '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(random() * 36)];
		if (!used.has(id)) return id;
	}
}

/** The states a run goes through; the last four are where it ends. */
export const RUN_STATES = Object.freeze(['preparing', 'queued', 'running', 'done', 'failed', 'cancelled', 'lost']);
export const FINISHED_STATES = Object.freeze(['done', 'failed', 'cancelled', 'lost']);

/** Words for a run's state. */
export const RUN_STATE_NAMES = Object.freeze({
	get preparing() {
		return t('准备中');
	},
	get queued() {
		return t('排队中');
	},
	get running() {
		return t('运行中');
	},
	get done() {
		return t('完成');
	},
	get failed() {
		return t('失败');
	},
	get cancelled() {
		return t('已停止');
	},
	get lost() {
		return t('失去联系');
	},
});
