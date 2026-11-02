import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { t } from '@blog/i18n/index.mjs';

/**
 * How the Studio reaches a machine that runs jobs: a shell here, or one
 * through ssh. Both run a bash script and give what it prints; files go
 * over as a tar stream, so the other end needs only bash and tar (and
 * Slurm's commands for a Slurm machine). Nothing here knows about articles.
 */

/** A word for bash: in single quotes, which keep everything as written. */
export function shellWord(value) {
	return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

/** A folder on the machine as bash should read it: `~/studio-jobs/a` is `"$HOME"/'studio-jobs/a'`. */
export function shellPath(path) {
	const text = String(path);
	if (text === '~') return '"$HOME"';
	if (text.startsWith('~/')) return `"$HOME"/${shellWord(text.slice(2))}`;
	return shellWord(text);
}

/** Options every ssh gets: never ask for a password, give up on a dead link, share one connection. */
export function sshOptions(controlDirectory = join(homedir(), '.ssh')) {
	return [
		'-o', 'BatchMode=yes',
		'-o', 'ConnectTimeout=15',
		'-o', 'ServerAliveInterval=20',
		'-o', 'ServerAliveCountMax=3',
		'-o', 'ControlMaster=auto',
		'-o', `ControlPath=${join(controlDirectory, 'studio-%C')}`,
		'-o', 'ControlPersist=120',
	];
}

/** Runs a command; resolves with its exit code and what it printed, and rejects only when it could not start. */
function run(command, args, { input = null, spawnImpl = spawn, timeout = 120_000, detached = false } = {}) {
	return new Promise((resolvePromise, reject) => {
		const child = spawnImpl(command, args, { stdio: ['pipe', 'pipe', 'pipe'], detached });
		const out = [];
		const err = [];
		const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
		child.stdout.on('data', (chunk) => out.push(chunk));
		child.stderr.on('data', (chunk) => err.push(chunk));
		child.on('error', (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.on('close', (code, signal) => {
			clearTimeout(timer);
			resolvePromise({ code: code ?? (signal ? 128 : 1), stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8') });
		});
		child.stdin.on('error', () => {});
		if (input && typeof input.pipe === 'function') input.pipe(child.stdin);
		else child.stdin.end(input ?? undefined);
	});
}

/** Fails with what the other end said, or with `fallback`. */
export class JobShellError extends Error {
	constructor(message) {
		super(message);
		this.name = 'JobShellError';
		this.statusCode = 502;
	}
}

function failure(result, fallback) {
	const said = result.stderr.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !/^Warning: Permanently added/u.test(line)).slice(-3).join('；');
	return new JobShellError(said || fallback);
}

/**
 * A machine's shell. `exec(script)` runs a bash script there and resolves
 * with { code, stdout, stderr }; `pipe(script, into)` runs one whose output
 * goes into `into` here (a tar stream, say).
 */
export class JobShell {
	/**
	 * @param {{ kind: 'local' | 'ssh', ssh?: string }} host
	 * @param {{ ssh?: string, sshArgs?: string[], spawnImpl?: typeof spawn }} [options]
	 */
	constructor(host, { ssh = 'ssh', sshArgs = sshOptions(), spawnImpl = spawn } = {}) {
		this.host = host;
		this.ssh = ssh;
		this.sshArgs = sshArgs;
		this.spawnImpl = spawnImpl;
	}

	#command(script) {
		if (this.host.kind !== 'ssh') return ['bash', ['-c', script]];
		// ssh hands the words to the login shell there, joined by spaces: one quoted word is the whole script.
		return [this.ssh, [...this.sshArgs, '--', this.host.ssh, `bash -c ${shellWord(script)}`]];
	}

	/**
	 * Runs `script`; `input` (text, a Buffer or a stream) is its standard input.
	 * `detached`: here, in a session of its own, so that what it leaves running
	 * outlives the dev server and a Ctrl-C to it.
	 */
	async exec(script, { input = null, timeout, detached = false } = {}) {
		const [command, args] = this.#command(script);
		try {
			return await run(command, args, { input, spawnImpl: this.spawnImpl, timeout, detached: detached && this.host.kind !== 'ssh' });
		} catch (error) {
			throw new JobShellError(t('{command} 启动不了：{error}', { command, error: error.message }));
		}
	}

	/** Runs `script` and throws with what it said when it fails. */
	async check(script, options) {
		const result = await this.exec(script, options);
		if (result.code !== 0) throw failure(result, this.host.kind === 'ssh' ? t('连不上 {host}（退出码 {code}）', { host: this.host.ssh, code: result.code }) : t('命令失败（退出码 {code}）', { code: result.code }));
		return result;
	}

	/** Files of `folder` here, by name, into `remote` there (made if it is not). */
	async push(folder, names, remote) {
		// macOS's tar would add `._name` files for the extended attributes; the other end has no use for them.
		const tar = this.spawnImpl('tar', ['-cf', '-', '-C', folder, ...names], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, COPYFILE_DISABLE: '1' } });
		const sent = this.check(`mkdir -p ${shellPath(remote)} && tar -xf - -C ${shellPath(remote)}`, { input: tar.stdout });
		const [packed] = await Promise.all([ended(tar), sent]);
		if (packed !== 0) throw new JobShellError(t('打包输入文件失败'));
	}

	/**
	 * The regular files of `remote` there, at its top, into `folder` here,
	 * except those named in `skip` and those bigger than `maxBytes`.
	 * Resolves with the names it brought.
	 */
	async pull(remote, folder, { skip = [], maxBytes = 20 * 1024 * 1024 } = {}) {
		const filters = skip.map((pattern) => `! -name ${shellWord(pattern)}`).join(' ');
		const kilobytes = Math.floor(maxBytes / 1024);
		// GNU and BSD find both take -size in k; names go to tar one per line.
		const list = `cd ${shellPath(remote)} && find . -maxdepth 1 -type f ! -name '.*' ${filters} -size -${kilobytes}k -print | sed 's|^\\./||'`;
		const listed = await this.check(list);
		const names = listed.stdout.toString('utf8').split('\n').filter(Boolean).sort();
		if (!names.length) return [];
		const [command, args] = this.#command(`cd ${shellPath(remote)} && tar -cf - -T -`);
		const sender = this.spawnImpl(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
		const receiver = this.spawnImpl('tar', ['-xf', '-', '-C', folder], { stdio: ['pipe', 'ignore', 'pipe'] });
		// Either end may go first (the connection lost, tar failing): what is written to it then fails, quietly.
		sender.stdin.on('error', () => {});
		receiver.stdin.on('error', () => {});
		sender.stdin.end(`${names.join('\n')}\n`);
		sender.stdout.pipe(receiver.stdin);
		const errors = [];
		sender.stderr.on('data', (chunk) => errors.push(chunk));
		const [sent, received] = await Promise.all([ended(sender), ended(receiver)]);
		if (sent !== 0 || received !== 0) throw new JobShellError(Buffer.concat(errors).toString('utf8').trim().split('\n').at(-1) || t('取回结果失败'));
		return names;
	}
}

/** A program's exit code once it is over; -1 when it could not be started. */
function ended(child) {
	return new Promise((resolvePromise) => {
		child.once('error', () => resolvePromise(-1));
		child.once('close', (code) => resolvePromise(code ?? -1));
	});
}
