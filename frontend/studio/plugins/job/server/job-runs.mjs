import { existsSync } from 'node:fs';
import { appendFile, lstat, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import {
	FINISHED_STATES,
	JOB_ID_PATTERN,
	JOBS_FOLDER,
	RUN_NAME_PATTERN,
	STRUCTURE_EXTENSIONS,
	jobStructure,
	runFolder,
	runName,
} from '@blog/compute/job-fence.mjs';
import { joinArgs } from '@blog/compute/job-options.mjs';
import { t } from '@blog/i18n/index.mjs';
import { JobShell, shellPath, shellWord } from './job-shell.mjs';

/**
 * Runs the jobs of the articles' ```job blocks (@blog/compute) on the
 * machines of compute-hosts.mjs, and keeps each run in its article:
 * `assets/jobs/<id>/<run>/` holds run.json (what was run, where, and how
 * it is going or how it ended), the input, and, once it ends, everything
 * the program wrote but its scratch files. While it runs, its output is
 * brought over as it grows, so the page can show it.
 *
 * The run itself happens in a folder of the machine (its `workdir`,
 * `<slug>/<id>/<run>` under it), started so that it goes on without the
 * Studio: closing the page or stopping the dev server leaves it running,
 * and the Studio takes it up again when it starts (`resume`). Where each
 * one is lives in `stateFile`, outside git, as it names machines and
 * folders the article need not publish.
 */

/** What a run leaves that is no result, whatever its program (its own script); a program adds its own (`scratch`). */
const SCRATCH = ['run.sh', '*.tmp'];

/** A run started before programs said theirs (kept in the state file from then): xtb's and CREST's. */
const SCRATCH_BEFORE = ['xtbrestart', 'gfnff_topo', 'gfnff_charges', 'gfnff_adjacency', '*.mdrestart', 'crest.restart', 'cre_members', ...SCRATCH];

/** How often a running job is looked at, by where it runs, in ms. */
const INTERVALS = { local: 1000, ssh: 3000, slurm: 5000 };

/** A live file bigger than `live` is kept as its last `tail` bytes only, saying so; a result bigger than `result` is left on the machine. */
const LIMITS = { live: 4 * 1024 * 1024, tail: 1024 * 1024, result: 20 * 1024 * 1024 };

const MAX_ARGS = 2000;
const MAX_INLINE_STRUCTURE = 2 * 1024 * 1024;

export class JobRunError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.name = 'JobRunError';
		this.statusCode = statusCode;
	}
}

/** The script a run executes on its machine, in its folder. */
export function runScript({ folder, host, command, output, threads }) {
	const [program, ...rest] = command;
	const path = host.programs?.[program] || program;
	const lines = [
		'#!/bin/bash',
		// Written by the Studio for one run; the folder it is in holds the run.
		`cd ${shellPath(folder)} || exit 1`,
	];
	// Found through PATH and called by its name: programs print how they were called, and the output is published.
	if (path.includes('/')) lines.push(`export PATH=${shellWord(posix.dirname(path))}:"$PATH"`);
	if (host.setup?.trim()) lines.push(host.setup.trim());
	lines.push(
		// OpenBLAS threads of its own inside OpenMP's would warn on every call (millions of lines in CREST's output).
		`export OMP_NUM_THREADS=${threads} MKL_NUM_THREADS=${threads} OPENBLAS_NUM_THREADS=1 OMP_MAX_ACTIVE_LEVELS=1 OMP_STACKSIZE=4G`,
		'ulimit -s unlimited 2>/dev/null',
		`${[posix.basename(path), ...rest].map(shellWord).join(' ')} > ${shellWord(output)} 2>&1`,
		'echo $? > .exit',
	);
	return `${lines.join('\n')}\n`;
}

/** Starts the script, and says how to find it again: a process, or a Slurm job. */
function launchScript(entry, host) {
	const folder = shellPath(entry.folder);
	if (entry.scheduler === 'slurm') {
		const options = [
			`--job-name=${shellWord(`studio-${entry.id}`)}`,
			'--output=slurm.out',
			`--cpus-per-task=${entry.threads}`,
			'--ntasks=1',
			...(host.partition ? [`--partition=${shellWord(host.partition)}`] : []),
			...(host.time ? [`--time=${shellWord(host.time)}`] : []),
		];
		return `cd ${folder} && sbatch --parsable --chdir="$PWD" ${options.join(' ')} run.sh`;
	}
	// Its own session: a Ctrl-C to the dev server does not reach it, nor does the end of an ssh.
	return `cd ${folder} && { nohup bash run.sh > /dev/null 2>&1 < /dev/null & echo $! > .pid; }`;
}

/** How the run is doing on its machine, and how big its live files are. */
function probeScript(entry) {
	const state = entry.scheduler === 'slurm'
		? `q=$(squeue -h -j ${shellWord(entry.slurmId)} -o %T 2>/dev/null); if [ -n "$q" ]; then echo "slurm $q"; else echo dead; fi`
		: 'if [ -f .pid ] && kill -0 "$(cat .pid)" 2>/dev/null; then echo running; else echo dead; fi';
	const sizes = entry.live.map((name) => `[ -f ${shellWord(name)} ] && echo "size $(wc -c < ${shellWord(name)}) ${name}"`).join('\n');
	return `cd ${shellPath(entry.folder)} 2>/dev/null || { echo gone; exit 0; }\nif [ -f .exit ]; then echo "exit $(cat .exit)"; else ${state}; fi\n${sizes}\ntrue\n`;
}

function cancelScript(entry) {
	if (entry.scheduler === 'slurm') return `scancel ${shellWord(entry.slurmId)}`;
	return `cd ${shellPath(entry.folder)} || exit 0\nstop() { for child in $(pgrep -P "$1"); do stop "$child"; done; kill -TERM "$1" 2>/dev/null; }\n[ -f .pid ] && stop "$(cat .pid)"\ntrue\n`;
}

function parseProbe(text) {
	const result = { state: null, code: null, slurm: null, sizes: {} };
	for (const line of text.split('\n')) {
		const words = line.trim().split(/\s+/u);
		if (words[0] === 'exit') {
			result.state = 'exit';
			result.code = /^\d+$/u.test(words[1] ?? '') ? Number(words[1]) : 1;
		} else if (words[0] === 'slurm') {
			result.slurm = words[1] ?? '';
			result.state = ['PENDING', 'CONFIGURING', 'REQUEUED', 'RESV_DEL_HOLD', 'REQUEUE_HOLD'].includes(result.slurm) ? 'queued' : ['RUNNING', 'COMPLETING', 'STAGE_OUT', 'SUSPENDED'].includes(result.slurm) ? 'running' : 'dead';
		} else if (['running', 'dead', 'gone'].includes(words[0])) {
			result.state = words[0];
		} else if (words[0] === 'size' && /^\d+$/u.test(words[1] ?? '')) {
			result.sizes[words.slice(2).join(' ')] = Number(words[1]);
		}
	}
	return result;
}

export class JobRuns {
	#entries = new Map();
	#problems = new Map();
	#timer = null;
	#busy = new Set();
	#saving = Promise.resolve();

	/**
	 * @param {import('@blog/kernel/server.mjs').StudioFiles} files the articles' folders (the dev server's `ctx.server.files`)
	 * @param {{ programs: { get(name: string): import('@blog/compute/programs.mjs').JobProgram | null, list(): import('@blog/compute/programs.mjs').JobProgram[] }, hosts: import('./compute-hosts.mjs').ComputeHosts, stateFile: string, shellFor?: (host: object) => JobShell, now?: () => Date, intervals?: Partial<typeof INTERVALS>, limits?: Partial<typeof LIMITS> }} options
	 */
	constructor(files, { programs, hosts, stateFile, shellFor = (host) => new JobShell(host), now = () => new Date(), intervals = {}, limits = {} }) {
		this.files = files;
		this.programs = programs;
		this.hosts = hosts;
		this.stateFile = stateFile;
		this.shellFor = shellFor;
		this.now = now;
		this.intervals = { ...INTERVALS, ...intervals };
		this.limits = { ...LIMITS, ...limits };
	}

	#runDirectory(slug, id, run) {
		return this.files.inside(this.files.articleFolder(slug), ...runFolder(id, run).split('/'));
	}

	async #article(slug) {
		const directory = this.files.articleFolder(slug);
		const info = await lstat(directory).catch(() => null);
		if (!info?.isDirectory() || info.isSymbolicLink()) throw new JobRunError(t('找不到文章 {slug}', { slug }), 404);
		return directory;
	}

	/** What the job starts from, as the file its run reads: [name, contents]. */
	async #input(slug, body) {
		const structure = jobStructure(body);
		if (structure.kind === 'none') throw new JobRunError(t('这个计算块还没有结构：写上 XYZ，或 @file ./assets/分子.xyz'));
		if (structure.kind === 'inline') {
			if (structure.text.length > MAX_INLINE_STRUCTURE) throw new JobRunError(t('写在块里的结构太大，放到 assets/ 的文件里再引用'));
			const text = structure.text.endsWith('\n') ? structure.text : `${structure.text}\n`;
			if (structure.format === 'xyz' && !/^\s*\d+\s*$/u.test(text.split('\n')[0])) throw new JobRunError(t('XYZ 的第一行应是原子数'));
			return [`input.${structure.format}`, text];
		}
		const [root, ...rest] = structure.path?.split('/') ?? [];
		const extension = posix.extname(structure.path ?? '').slice(1).toLowerCase() || posix.basename(structure.path ?? '');
		if (!['img', 'assets'].includes(root) || !rest.length) throw new JobRunError(t('{path} 不是文章 img/ 或 assets/ 里的文件', { path: structure.written }));
		if (!STRUCTURE_EXTENSIONS.includes(extension)) throw new JobRunError(t('{path}：结构文件只能是 {extensions}', { path: structure.written, extensions: STRUCTURE_EXTENSIONS.join('、') }));
		const directory = await this.#article(slug);
		const path = this.files.inside(directory, root, ...rest);
		const info = await lstat(path).catch(() => null);
		if (!info?.isFile()) throw new JobRunError(t('找不到 {path}', { path: structure.written }), 404);
		if (info.size > 64 * 1024 * 1024) throw new JobRunError(t('{path} 太大', { path: structure.written }));
		return [extension === 'coord' ? 'coord' : `input.${extension}`, await readFile(path)];
	}

	/**
	 * Starts a run of the job `id` of the article: written in its folder as
	 * preparing, then sent to its machine and started there. Resolves with
	 * its run.json once it is written; how the start goes is in run.json.
	 * @param {string} slug
	 * @param {{ id: string, program: string, args?: string, host: string, threads?: number, body: string }} request
	 */
	async start(slug, request) {
		const id = String(request?.id ?? '');
		if (!JOB_ID_PATTERN.test(id) || id.length > 64) throw new JobRunError(t('计算块的名字只能用小写字母、数字和连字符'));
		const program = this.programs.get(String(request.program ?? ''));
		if (!program) {
			const known = this.programs.list().map((entry) => entry.name);
			throw new JobRunError(known.length ? t('不认识的程序 {program}，现在能算 {programs}', { program: request.program, programs: known.join('、') }) : t('不认识的程序 {program}，现在能算的一个也没有（plugins/ 里没有程序插件）', { program: request.program }));
		}
		const args = String(request.args ?? '');
		if (args.length > MAX_ARGS || /[\r\n\0]/u.test(args)) throw new JobRunError(t('命令行参数要写在一行里'));
		const host = await this.hosts.get(String(request.host || 'local'));
		const threads = Number.isInteger(request.threads) && request.threads > 0 && request.threads <= 1024 ? request.threads : host.threads;
		const [input, contents] = await this.#input(slug, String(request.body ?? ''));
		const directory = await this.#article(slug);

		// Making its folder takes the name: two started in the same second get two.
		let run;
		let folder;
		for (let suffix = 1; ; suffix += 1) {
			run = suffix === 1 ? runName(this.now()) : `${runName(this.now())}-${suffix}`;
			folder = this.#runDirectory(slug, id, run);
			await mkdir(dirname(folder), { recursive: true });
			try {
				await mkdir(folder);
				break;
			} catch (error) {
				if (error?.code !== 'EEXIST') throw error;
			}
		}
		await writeFile(join(folder, input), contents);
		const command = program.command(input, args, threads);
		const record = {
			format: 1,
			id,
			run,
			program: program.name,
			args,
			command: joinArgs(command),
			host: host.name,
			hostLabel: host.label,
			scheduler: host.scheduler,
			threads,
			input,
			output: program.output,
			state: 'preparing',
			created: this.now().toISOString(),
			started: null,
			finished: null,
			exitCode: null,
			error: null,
			files: [input],
		};
		await this.#write(slug, record);
		const entry = {
			slug,
			id,
			run,
			host: host.name,
			scheduler: host.scheduler,
			folder: `${host.workdir.replace(/\/+$/u, '')}/${slug}/${id}/${run}`,
			threads,
			live: program.live,
			scratch: [...program.scratch, ...SCRATCH],
			slurmId: null,
			cancel: false,
			misses: 0,
			next: 0,
		};
		void this.#launch(entry, host, command, record, input, contents);
		return record;
	}

	async #launch(entry, host, command, record, input, contents) {
		const key = this.#key(entry);
		this.#entries.set(key, entry);
		this.#busy.add(key);
		let staging = null;
		try {
			staging = await mkdtemp(join(tmpdir(), 'studio-job-'));
			await writeFile(join(staging, input), contents);
			await writeFile(join(staging, 'run.sh'), runScript({ folder: entry.folder, host, command, output: record.output, threads: entry.threads }));
			const shell = this.shellFor(host);
			await shell.push(staging, [input, 'run.sh'], entry.folder);
			const launched = await shell.check(launchScript(entry, host), { detached: true });
			if (entry.scheduler === 'slurm') {
				const slurmId = launched.stdout.toString('utf8').trim().split(/[;\s]/u)[0];
				if (!/^\d+$/u.test(slurmId)) throw new JobRunError(`sbatch 没有给出任务号：${launched.stdout.toString('utf8').trim() || launched.stderr}`, 502); // i18n-ignore: kept in run.json
				entry.slurmId = slurmId;
			}
			if (entry.cancel) await shell.exec(cancelScript(entry)).catch(() => {});
			await this.#update(entry, { state: entry.scheduler === 'slurm' ? 'queued' : 'running', started: entry.scheduler === 'slurm' ? null : this.now().toISOString() });
			await this.#save();
			this.#schedule();
		} catch (error) {
			this.#entries.delete(key);
			await this.#update(entry, { state: 'failed', finished: this.now().toISOString(), error: `没能开始：${error.message}` }).catch(() => {}); // i18n-ignore: kept in run.json
		} finally {
			this.#busy.delete(key);
			if (staging) await rm(staging, { recursive: true, force: true }).catch(() => {});
		}
	}

	/** Stops a run: the process ends, or Slurm takes the job back; what it wrote so far is brought over. */
	async cancel(slug, id, run) {
		const record = await this.#read(slug, id, run);
		if (FINISHED_STATES.includes(record.state)) return record;
		const entry = this.#entries.get(this.#key({ slug, id, run }));
		if (!entry) return this.#update({ slug, id, run }, { state: 'cancelled', finished: this.now().toISOString() });
		entry.cancel = true;
		// Still being started: it is stopped once it has a process to stop.
		if (record.state === 'preparing') return record;
		const host = await this.hosts.get(entry.host);
		await this.shellFor(host).check(cancelScript(entry));
		entry.next = 0;
		this.#schedule();
		return record;
	}

	/** The runs of a job, newest first, with what keeps a running one from being seen (a machine out of reach). */
	async list(slug, id) {
		if (!JOB_ID_PATTERN.test(String(id))) throw new JobRunError(t('计算块的名字不对'));
		const directory = await this.#article(slug);
		const folder = this.files.inside(directory, ...JOBS_FOLDER.split('/'), id);
		const names = (await readdir(folder).catch(() => [])).filter((name) => RUN_NAME_PATTERN.test(name)).sort().reverse();
		const runs = [];
		for (const run of names) {
			const record = await this.#read(slug, id, run).catch(() => null);
			if (record) runs.push({ ...record, problem: this.#problems.get(this.#key({ slug, id, run })) ?? null });
		}
		return runs;
	}

	/** Takes up the runs that were going when the Studio last stopped. */
	async resume() {
		let kept = {};
		try {
			kept = JSON.parse(await readFile(this.stateFile, 'utf8')).runs ?? {};
		} catch {
			return;
		}
		for (const entry of Object.values(kept)) {
			if (!entry || typeof entry !== 'object') continue;
			const record = await this.#read(entry.slug, entry.id, entry.run).catch(() => null);
			if (!record || FINISHED_STATES.includes(record.state)) continue;
			this.#entries.set(this.#key(entry), { ...entry, misses: 0, next: 0 });
		}
		await this.#save();
		this.#schedule();
	}

	close() {
		clearTimeout(this.#timer);
		this.#timer = null;
		this.#entries.clear();
	}

	/** Resolves once no run is being started or looked at, for tests. */
	async settled() {
		while (this.#busy.size) await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
	}

	/** The article whose folder now holds the run, when it is no longer in its own; null when none does. */
	async #movedTo({ slug, id, run }) {
		// The articles' folder: the one an article's folder is in.
		const blog = dirname(this.files.articleFolder(slug));
		for (const name of await readdir(blog).catch(() => [])) {
			let folder;
			try {
				folder = this.#runDirectory(name, id, run);
			} catch {
				continue;
			}
			if (existsSync(join(folder, 'run.json'))) return name;
		}
		return null;
	}

	#key({ slug, id, run }) {
		return `${slug}/${id}/${run}`;
	}

	#schedule() {
		if (this.#timer || !this.#entries.size) return;
		const wait = Math.max(50, Math.min(...[...this.#entries.values()].map((entry) => entry.next - Date.now())));
		this.#timer = setTimeout(() => {
			this.#timer = null;
			void this.#tick();
		}, wait);
		this.#timer.unref?.();
	}

	async #tick() {
		const due = [...this.#entries.entries()].filter(([key, entry]) => entry.next <= Date.now() && !this.#busy.has(key));
		await Promise.all(due.map(([key, entry]) => this.#look(key, entry)));
		this.#schedule();
	}

	async #look(key, entry) {
		this.#busy.add(key);
		try {
			if (!existsSync(join(this.#runDirectory(entry.slug, entry.id, entry.run), 'run.json'))) {
				this.#entries.delete(key);
				// The article took another name (published, renamed in the Studio or by the CLI): the run went with it.
				const moved = await this.#movedTo(entry);
				if (moved) this.#entries.set(this.#key({ ...entry, slug: (entry.slug = moved) }), entry);
				// Else the article or the run went (deleted): nothing to write into any more.
				await this.#save();
				return;
			}
			const host = await this.hosts.get(entry.host);
			const shell = this.shellFor(host);
			const kind = entry.scheduler === 'slurm' ? 'slurm' : host.kind;
			let probe;
			try {
				const result = await shell.exec(probeScript(entry), { timeout: 60_000 });
				if (result.code !== 0) throw new Error(result.stderr.trim().split('\n').at(-1) || `退出码 ${result.code}`); // i18n-ignore: kept in run.json
				probe = parseProbe(result.stdout.toString('utf8'));
				await this.#problem(entry, null);
			} catch (error) {
				// Out of reach for now: the run goes on there; look again later.
				await this.#problem(entry, `暂时连不上 ${host.label}：${error.message}`); // i18n-ignore: kept in run.json
				entry.next = Date.now() + Math.max(this.intervals[kind] * 4, 15_000);
				return;
			}
			await this.#follow(entry, shell, probe.sizes);
			if (probe.state === 'exit' || probe.state === 'gone' || (probe.state === 'dead' && ++entry.misses >= 2)) {
				await this.#finish(entry, shell, probe);
				return;
			}
			if (probe.state === 'running' || probe.state === 'queued') {
				entry.misses = 0;
				const record = await this.#read(entry.slug, entry.id, entry.run);
				if (record.state !== probe.state) await this.#update(entry, { state: probe.state, started: probe.state === 'running' ? record.started ?? this.now().toISOString() : record.started });
			}
			entry.next = Date.now() + this.intervals[kind] * (probe.state === 'queued' ? 3 : 1);
		} catch {
			entry.next = Date.now() + 15_000;
		} finally {
			this.#busy.delete(key);
		}
	}

	/**
	 * Brings over what the live files gained since last time. One grown too
	 * big is kept as its end, under a line that says so: the whole of it
	 * stays on the machine.
	 */
	async #follow(entry, shell, sizes) {
		const folder = this.#runDirectory(entry.slug, entry.id, entry.run);
		entry.cut ??= {};
		for (const [name, size] of Object.entries(sizes)) {
			if (!entry.live.includes(name)) continue;
			const local = join(folder, name);
			const have = (await stat(local).catch(() => null))?.size ?? 0;
			if (size > this.limits.live) {
				// Already here: the whole of it (brought with the results), or its end at this size.
				if (have === size || entry.cut[name] === size) continue;
				const result = await shell.exec(`cd ${shellPath(entry.folder)} && tail -c ${this.limits.tail} ${shellWord(name)}`, { timeout: 60_000 });
				if (result.code !== 0) continue;
				const text = result.stdout.toString('utf8');
				const note = `[Studio] ${name} 有 ${(size / 1024 / 1024).toFixed(1)} MB，这里只有最后 ${(this.limits.tail / 1024 / 1024).toFixed(1)} MB；完整的文件留在计算机器的运行目录里。\n`; // i18n-ignore: written into the output file
				await writeFile(local, note + text.slice(text.indexOf('\n') + 1));
				entry.cut[name] = size;
				continue;
			}
			if (size === have) continue;
			const fresh = size < have;
			const result = await shell.exec(`cd ${shellPath(entry.folder)} && tail -c +${fresh ? 1 : have + 1} ${shellWord(name)}`, { timeout: 60_000 });
			if (result.code !== 0) continue;
			if (fresh) await writeFile(local, result.stdout);
			else await appendFile(local, result.stdout);
		}
	}

	async #finish(entry, shell, probe) {
		const folder = this.#runDirectory(entry.slug, entry.id, entry.run);
		let files = [];
		let error = null;
		if (probe.state !== 'gone') {
			try {
				await shell.pull(entry.folder, folder, { skip: entry.scratch ?? SCRATCH_BEFORE, maxBytes: this.limits.result });
				// The output left behind as too big: its end, at least.
				await this.#follow(entry, shell, probe.sizes);
			} catch (pullError) {
				error = `结果没能取回：${pullError.message}`; // i18n-ignore: kept in run.json
			}
		}
		files = (await readdir(folder, { withFileTypes: true })).filter((item) => item.isFile() && !item.name.startsWith('.') && item.name !== 'run.json').map((item) => item.name).sort();
		const state = entry.cancel ? 'cancelled' : probe.state === 'exit' ? (probe.code === 0 ? 'done' : 'failed') : 'lost';
		if (state === 'lost' && !error) error = probe.state === 'gone' ? '机器上找不到这次运行的文件夹' : entry.scheduler === 'slurm' ? `Slurm 任务结束了，但没有正常退出${probe.slurm ? `（${probe.slurm}）` : ''}` : '进程不在了，也没有留下退出码（机器重启过？）'; // i18n-ignore: kept in run.json
		const finished = this.now().toISOString();
		// One queued (Slurm) that ran and exited between two looks was never seen running: started by the time it ended.
		const { started } = await this.#read(entry.slug, entry.id, entry.run);
		await this.#update(entry, { state, exitCode: probe.code, started: started ?? (probe.state === 'exit' ? finished : null), finished, files, error });
		this.#entries.delete(this.#key(entry));
		this.#problems.delete(this.#key(entry));
		await this.#save();
	}

	async #problem(entry, message) {
		const key = this.#key(entry);
		if ((this.#problems.get(key) ?? null) === message) return;
		if (message) this.#problems.set(key, message);
		else this.#problems.delete(key);
		// Said in run.json too, so the page, which follows the file, learns it.
		await this.#update(entry, { problem: message });
	}

	async #read(slug, id, run) {
		const text = await readFile(join(this.#runDirectory(slug, id, run), 'run.json'), 'utf8').catch(() => null);
		if (text === null) throw new JobRunError(t('找不到这次运行：{id}/{run}', { id, run }), 404);
		return JSON.parse(text);
	}

	async #write(slug, record) {
		await this.files.writeText(join(this.#runDirectory(slug, record.id, record.run), 'run.json'), `${JSON.stringify(record, null, '\t')}\n`);
	}

	async #update(entry, changes) {
		const record = { ...(await this.#read(entry.slug, entry.id, entry.run)), ...changes };
		if (record.problem === null) delete record.problem;
		await this.#write(entry.slug, record);
		return record;
	}

	/** Where each running job is, for the next start of the Studio. */
	#save() {
		const runs = {};
		for (const [key, { next, misses, cut, ...entry }] of this.#entries) runs[key] = entry;
		this.#saving = this.#saving.then(async () => {
			await mkdir(dirname(this.stateFile), { recursive: true });
			await this.files.writeText(this.stateFile, `${JSON.stringify({ runs }, null, '\t')}\n`);
		}).catch(() => {});
		return this.#saving;
	}
}

