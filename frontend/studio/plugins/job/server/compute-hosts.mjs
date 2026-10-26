import { shellWord } from './job-shell.mjs';
import { t } from '@blog/i18n/index.mjs';
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';

/**
 * The machines a job can run on (计算机器), kept with the Studio's other
 * settings outside git: this one, and others reached by ssh, where a job
 * runs at once or is handed to Slurm.
 *
 *     { name: 'zh-5090', label: '5090 服务器', kind: 'ssh', ssh: 'zh-5090-nps',
 *       scheduler: 'direct', workdir: '~/studio-jobs', threads: 16,
 *       programs: { xtb: '/home/me/miniconda3/bin/xtb' }, setup: '' }
 *
 * `name` is what a job's fence says (`host=zh-5090`); `ssh` the address as
 * `ssh` takes it, a Host of ~/.ssh/config included. A Slurm machine also has
 * `partition` and, if it should be limited, `time` (`24:00:00`).
 */

export const LOCAL_HOST = Object.freeze({
	name: 'local',
	get label() {
		return t('本机');
	},
	kind: 'local',
	scheduler: 'direct',
	workdir: '~/studio-jobs',
	threads: 4,
	programs: {},
	setup: '',
});

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PROGRAM = /^[a-z][\w-]*$/u;

export class ComputeHostError extends Error {
	constructor(message) {
		super(message);
		this.name = 'ComputeHostError';
		this.statusCode = 400;
	}
}

/** A machine as written, checked and with its defaults; throws ComputeHostError for one that cannot be used. */
export function readHost(value) {
	if (!value || typeof value !== 'object') throw new ComputeHostError(t('机器的设置不对'));
	const name = String(value.name ?? '').trim();
	if (!NAME.test(name)) throw new ComputeHostError(name ? t('机器名 {name} 只能用小写字母、数字和连字符', { name }) : t('机器名 （空） 只能用小写字母、数字和连字符'));
	const kind = value.kind === 'ssh' ? 'ssh' : 'local';
	const scheduler = value.scheduler === 'slurm' ? 'slurm' : 'direct';
	const ssh = String(value.ssh ?? '').trim();
	// Given to ssh as one word: never an option, never two words.
	if (kind === 'ssh' && !/^[\w.@%:[\]-]+$/u.test(ssh)) throw new ComputeHostError(t('ssh 地址不对：写 ~/.ssh/config 里的 Host，或 用户@地址'));
	if (kind === 'ssh' && ssh.startsWith('-')) throw new ComputeHostError(t('ssh 地址不能以 - 开头'));
	const workdir = String(value.workdir ?? LOCAL_HOST.workdir).trim() || LOCAL_HOST.workdir;
	if (!(workdir.startsWith('/') || workdir === '~' || workdir.startsWith('~/')) || workdir.split('/').includes('..')) {
		throw new ComputeHostError(t('工作目录要写完整路径，或以 ~/ 开头'));
	}
	// Each program's path, by its name (any program's: one whose plugin is off now keeps its path).
	const programs = {};
	for (const [program, written] of Object.entries(value.programs && typeof value.programs === 'object' ? value.programs : {})) {
		const path = String(written ?? '').trim();
		if (PROGRAM.test(program) && path) programs[program] = path;
	}
	const threads = Number.isInteger(value.threads) && value.threads > 0 && value.threads <= 1024 ? value.threads : LOCAL_HOST.threads;
	const host = { name, label: String(value.label ?? '').trim() || (name === LOCAL_HOST.name ? LOCAL_HOST.label : name), kind, scheduler, workdir, threads, programs, setup: String(value.setup ?? '') };
	if (kind === 'ssh') host.ssh = ssh;
	if (scheduler === 'slurm') {
		host.partition = /^[\w,-]*$/u.test(String(value.partition ?? '')) ? String(value.partition ?? '') : '';
		host.time = /^[\d:-]*$/u.test(String(value.time ?? '')) ? String(value.time ?? '') : '';
	}
	return host;
}

export class ComputeHosts {
	/** @param {string} settingsFile the Studio's settings (.studio-settings.json) */
	constructor(settingsFile) {
		this.settingsFile = settingsFile;
	}

	#settings() {
		return readSettings(this.settingsFile);
	}

	/** Every machine, this one first (as set, or as it is by default). */
	async list() {
		const kept = (await this.#settings()).computeHosts;
		const hosts = [];
		for (const value of Array.isArray(kept) ? kept : []) {
			try {
				const host = readHost(value);
				if (!hosts.some((other) => other.name === host.name)) hosts.push(host);
			} catch {
				// A machine written by hand that cannot be used is left out, not the others with it.
			}
		}
		if (!hosts.some((host) => host.name === LOCAL_HOST.name)) hosts.unshift({ ...LOCAL_HOST, programs: {} });
		return hosts;
	}

	/** The machine called `name`; throws when there is none. */
	async get(name) {
		const host = (await this.list()).find((candidate) => candidate.name === name);
		if (!host) {
			const error = new ComputeHostError(t('没有叫 {name} 的计算机器，先在「计算机器」里加上它', { name }));
			error.statusCode = 404;
			throw error;
		}
		return host;
	}

	/** Keeps these machines, in this order. `local` stays this machine. */
	async save(values) {
		if (!Array.isArray(values)) throw new ComputeHostError(t('机器列表不对'));
		const hosts = values.map(readHost);
		const names = new Set();
		for (const host of hosts) {
			if (names.has(host.name)) throw new ComputeHostError(t('有两台机器都叫 {name}', { name: host.name }));
			names.add(host.name);
			if (host.name === LOCAL_HOST.name && host.kind !== 'local') throw new ComputeHostError(t('local 是本机的名字'));
		}
		// This machine's default name (本机) is kept unsaid: it is given in the language of whoever reads the list.
		const kept = hosts.map((host) => (host.name === LOCAL_HOST.name && host.label === LOCAL_HOST.label ? { ...host, label: '' } : host));
		await updateSettings(this.settingsFile, (settings) => ({ ...settings, computeHosts: kept }));
		return this.list();
	}
}

/** Where conda and the like put programs, looked in when a program is not on PATH. */
const PLACES = '"$HOME"/miniconda3 "$HOME"/anaconda3 "$HOME"/miniforge3 "$HOME"/mambaforge "$HOME"/micromamba /opt/homebrew/Caskroom/miniconda/base /opt/homebrew/Caskroom/miniforge/base /opt/conda /usr/local';

/**
 * Finds these programs on a machine: on its PATH as a login shell has it,
 * beside the programs it says it goes with (xtb where CREST is, which CREST
 * calls), else in the usual conda places. Those others come first.
 * @param {Array<{ name: string, beside?: string[] }>} programs
 */
export function detectScript(programs) {
	const known = programs.filter((program) => PROGRAM.test(program.name));
	const order = [...known.filter((program) => !program.beside?.length), ...known.filter((program) => program.beside?.length)];
	const variable = (name) => `found_${name.replaceAll('-', '_')}`;
	const lines = order.map(({ name, beside = [] }) => [
		`p=${name}; c=$(command -v "$p" 2>/dev/null)`,
		...beside.filter((other) => PROGRAM.test(other)).map((other) => `if [ -z "$c" ] && [ -n "$${variable(other)}" ] && [ -x "$(dirname "$${variable(other)}")/$p" ]; then c="$(dirname "$${variable(other)}")/$p"; fi`),
		`if [ -z "$c" ]; then for e in ${PLACES}; do for b in "$e"/bin "$e"/envs/*/bin; do if [ -x "$b/$p" ]; then c="$b/$p"; break 2; fi; done; done; fi`,
		`${variable(name)}=$c; echo "program $p $c"`,
	].join('\n'));
	return `${lines.join('\n')}
echo "cpus $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null)"
if command -v sbatch >/dev/null 2>&1; then echo "slurm $(sinfo -h -o %P 2>/dev/null | tr '\\n' ' ')"; fi
`;
}

/**
 * What a machine has: these programs' paths, how many processors, and
 * whether it has Slurm (with its partitions, the default marked `*`).
 * @param {import('./job-shell.mjs').JobShell} shell
 * @param {Array<{ name: string, beside?: string[] }>} programs
 */
export async function detectHost(shell, programs) {
	// A login shell, interactive, reads what sets PATH (conda's lines in .bashrc among them).
	const result = await shell.check(`bash -lic ${shellWord(detectScript(programs))} 2>/dev/null < /dev/null`, { timeout: 60_000 });
	const found = { programs: {}, cpus: null, slurm: false, partitions: [] };
	for (const line of result.stdout.toString('utf8').split('\n')) {
		const [word, ...rest] = line.trim().split(/\s+/u);
		if (word === 'program' && programs.some((program) => program.name === rest[0]) && rest[1]) found.programs[rest[0]] = rest.slice(1).join(' ');
		else if (word === 'cpus' && /^\d+$/u.test(rest[0] ?? '')) found.cpus = Number(rest[0]);
		else if (word === 'slurm') {
			found.slurm = true;
			found.partitions = rest.filter(Boolean);
		}
	}
	return found;
}
