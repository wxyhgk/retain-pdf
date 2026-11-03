import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { t } from '@blog/i18n/index.mjs';

/**
 * Work the Studio does in the background, the page told how it goes: a PDF
 * read by an OCR service. Each is a task: what it is, which article it is for, its state
 * (running, done, failed, cancelled), what it has written (its log, the last
 * `LOG_KEPT` characters of it), and, once it is over, what came of it. A
 * task can be cancelled; what it runs is stopped with it.
 *
 * Tasks live as long as the server: the last `KEPT` that are over are kept to
 * be looked at, and the page follows them all as events (`subscribe`).
 */

const LOG_KEPT = 200_000;
const KEPT = 50;

/**
 * @typedef {'running' | 'done' | 'failed' | 'cancelled'} TaskState
 * @typedef {{ id: string, kind: string, title: string, slug: string | null, state: TaskState, started: number, ended: number | null, log: string, error: string | null, result: unknown }} Task
 * @typedef {{ log(text: string): void, signal: AbortSignal }} TaskContext
 */

export class Tasks {
	#tasks = new Map();
	#listeners = new Set();
	#controllers = new Map();
	#next = 1;

	/** Every task, newest first, without their logs (`get` has them). */
	list() {
		return [...this.#tasks.values()].reverse().map(({ log, ...task }) => ({ ...task, logSize: log.length }));
	}

	/** @returns {Task | null} */
	get(id) {
		return this.#tasks.get(id) ?? null;
	}

	/**
	 * Starts `run` as a task; what it returns is the task's result, what it throws its error.
	 * @param {{ kind: string, title: string, slug?: string | null }} what
	 * @param {(context: TaskContext) => Promise<unknown>} run
	 * @returns {Task}
	 */
	start({ kind, title, slug = null }, run) {
		const id = `task-${Date.now().toString(36)}-${this.#next++}`;
		/** @type {Task} */
		const task = { id, kind, title, slug, state: 'running', started: Date.now(), ended: null, log: '', error: null, result: null };
		this.#tasks.set(id, task);
		const controller = new AbortController();
		this.#controllers.set(id, controller);
		this.#emit({ type: 'task', task: this.#summary(task) });
		const log = (text) => {
			if (!text) return;
			task.log = (task.log + text).slice(-LOG_KEPT);
			this.#emit({ type: 'log', id, text });
		};
		void (async () => {
			try {
				task.result = (await run({ log, signal: controller.signal })) ?? null;
				task.state = controller.signal.aborted ? 'cancelled' : 'done';
			} catch (error) {
				task.state = controller.signal.aborted ? 'cancelled' : 'failed';
				task.error = controller.signal.aborted ? null : error instanceof Error ? error.message : String(error);
			} finally {
				task.ended = Date.now();
				this.#controllers.delete(id);
				this.#emit({ type: 'task', task: this.#summary(task) });
				this.#forgetOld();
			}
		})();
		return task;
	}

	/** Stops a running task; whether there was one. */
	cancel(id) {
		const controller = this.#controllers.get(id);
		if (!controller) return false;
		controller.abort();
		return true;
	}

	/** Calls `listener` with each change: `{ type: 'task', task }` (without its log) or `{ type: 'log', id, text }`. */
	subscribe(listener) {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	#summary({ log, ...task }) {
		return { ...task, logSize: log.length };
	}

	#emit(event) {
		for (const listener of this.#listeners) listener(event);
	}

	#forgetOld() {
		const over = [...this.#tasks.values()].filter((task) => task.state !== 'running');
		for (const task of over.slice(0, Math.max(0, over.length - KEPT))) this.#tasks.delete(task.id);
	}
}

/** Process groups of the programs running for tasks: ended with the server, however it ends. */
const running = new Set();

/** How long a program stopped is given to end before it is killed, in ms. */
const STOP_GRACE = 5000;

/** Ends every program the tasks started (the server going away): at once, nothing waited for. */
export function stopAllPrograms(signal = 'SIGTERM') {
	for (const group of running) {
		try {
			process.kill(-group, signal);
		} catch {
			// Over already.
		}
	}
}

/**
 * A process group the Studio started otherwise (an AI's conversation, agent-sessions.mjs): ended with the server
 * too. Returns how to let it go once it has ended.
 */
export function endWithServer(group) {
	watchExit();
	running.add(group);
	return () => running.delete(group);
}

let watching = false;

/**
 * The programs are in process groups of their own (so a stop takes what they started too), which a Ctrl+C in the
 * terminal does not reach: they are ended when the server ends, by a signal or otherwise. A signal is then let do
 * what it did (exit) unless something else listens for it.
 */
function watchExit() {
	if (watching) return;
	watching = true;
	process.once('exit', () => stopAllPrograms());
	for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
		const ended = () => {
			stopAllPrograms();
			if (process.listenerCount(name) === 0) process.kill(process.pid, name);
		};
		process.once(name, ended);
	}
}

/** Shells that run `exec "$@"` as sh does; another (fish, nushell) has a program run by sh instead. */
const POSIX_SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'mksh', 'yash']);

/** The login shell that starts a program as the author's terminal would find it, and how. */
export function loginShell(shell = process.env.SHELL || '/bin/zsh') {
	return POSIX_SHELLS.has(basename(shell)) ? shell : '/bin/sh';
}

/**
 * Runs a program for a task, its output into the task's log, stopped (with
 * what it started) when the task is cancelled: asked to end, then killed if
 * it has not after a few seconds. Started through a login shell, so it is
 * found as the author's terminal finds it; `argv` goes to it as it is, no
 * word of it read by the shell. Rejects when it fails or is stopped.
 * @param {string[]} argv
 * @param {{ cwd: string, env?: Record<string, string>, log: (text: string) => void, signal: AbortSignal, shell?: string, grace?: number }} options
 */
export function runProgram(argv, { cwd, env = {}, log, signal, shell = process.env.SHELL || '/bin/zsh', grace = STOP_GRACE }) {
	return new Promise((resolve, reject) => {
		if (signal.aborted) return reject(new Error(t('已取消')));
		watchExit();
		const child = spawn(loginShell(shell), ['-lc', 'exec "$@"', 'studio-task', ...argv], {
			cwd,
			env: { ...process.env, ...env },
			stdio: ['ignore', 'pipe', 'pipe'],
			// Its own process group: stopping it stops what it started too.
			detached: true,
		});
		if (child.pid) running.add(child.pid);
		const decoder = (stream) => {
			stream.setEncoding('utf8');
			stream.on('data', log);
			stream.on('error', () => {});
		};
		decoder(child.stdout);
		decoder(child.stderr);
		let killer = null;
		const kill = (name) => {
			try {
				process.kill(-child.pid, name);
			} catch {
				// Over already.
			}
		};
		const stop = () => {
			kill('SIGTERM');
			killer = setTimeout(() => kill('SIGKILL'), grace);
			killer.unref?.();
		};
		const over = () => {
			signal.removeEventListener('abort', stop);
			clearTimeout(killer);
			running.delete(child.pid);
		};
		signal.addEventListener('abort', stop, { once: true });
		child.on('error', (error) => {
			over();
			reject(error);
		});
		child.on('close', (code, killed) => {
			over();
			if (signal.aborted) reject(new Error(t('已取消')));
			else if (code === 0) resolve();
			else reject(new Error(killed ? t('被信号 {killed} 结束', { killed }) : t('退出码 {code}', { code })));
		});
	});
}

/**
 * A command line as its words, as a shell would split it (quotes kept
 * together, a backslash escaping the next character, in double quotes only
 * `$`, `` ` ``, `"` and itself; words apart by spaces, tabs and new lines,
 * not by a full-width space), but nothing run or expanded: for the commands
 * the author sets (agent-settings.mjs).
 * @returns {string[]}
 */
export function commandWords(line) {
	const words = [];
	let word = null;
	let quote = null;
	for (let index = 0; index < line.length; index += 1) {
		const character = line[index];
		if (quote) {
			if (character === quote) quote = null;
			else if (character === '\\' && quote === '"' && /[$`"\\]/u.test(line[index + 1] ?? '')) word += line[++index];
			else word += character;
		} else if (character === '"' || character === "'") {
			quote = character;
			word ??= '';
		} else if (character === '\\' && index + 1 < line.length) {
			word = (word ?? '') + line[++index];
		} else if (character === ' ' || character === '\t' || character === '\n') {
			if (word !== null) words.push(word);
			word = null;
		} else {
			word = (word ?? '') + character;
		}
	}
	if (quote) throw new Error(t('命令里的引号没有配对'));
	if (word !== null) words.push(word);
	return words;
}
