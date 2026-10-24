import { spawn } from 'node:child_process';

/**
 * Work the Studio does in the background, the page told how it goes: an AI
 * doing what a line of an article asks (Alt+Enter), a PDF read by an OCR
 * service. Each is a task: what it is, which article it is for, its state
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

/**
 * Runs a program for a task, its output into the task's log, stopped (with
 * what it started) when the task is cancelled. Started through a login shell,
 * so it is found as the author's terminal finds it; `argv` goes to it as it
 * is, no word of it read by the shell. Rejects when it fails or is stopped.
 * @param {string[]} argv
 * @param {{ cwd: string, env?: Record<string, string>, log: (text: string) => void, signal: AbortSignal, shell?: string }} options
 */
export function runProgram(argv, { cwd, env = {}, log, signal, shell = process.env.SHELL || '/bin/zsh' }) {
	return new Promise((resolve, reject) => {
		if (signal.aborted) return reject(new Error('已取消'));
		const child = spawn(shell, ['-lc', 'exec "$@"', 'studio-task', ...argv], {
			cwd,
			env: { ...process.env, ...env },
			stdio: ['ignore', 'pipe', 'pipe'],
			// Its own process group: stopping it stops what it started too.
			detached: true,
		});
		const decoder = (stream) => {
			stream.setEncoding('utf8');
			stream.on('data', log);
		};
		decoder(child.stdout);
		decoder(child.stderr);
		const stop = () => {
			try {
				process.kill(-child.pid, 'SIGTERM');
			} catch {
				// Over already.
			}
		};
		signal.addEventListener('abort', stop, { once: true });
		child.on('error', (error) => {
			signal.removeEventListener('abort', stop);
			reject(error);
		});
		child.on('close', (code, killed) => {
			signal.removeEventListener('abort', stop);
			if (signal.aborted) reject(new Error('已取消'));
			else if (code === 0) resolve();
			else reject(new Error(killed ? `被信号 ${killed} 结束` : `退出码 ${code}`));
		});
	});
}

/**
 * A command line as its words, as a shell would split it (quotes kept
 * together, a backslash escaping the next character), but nothing run or
 * expanded: for the commands the author sets (agent-settings.mjs).
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
			else if (character === '\\' && quote === '"' && index + 1 < line.length) word += line[++index];
			else word += character;
		} else if (character === '"' || character === "'") {
			quote = character;
			word ??= '';
		} else if (character === '\\' && index + 1 < line.length) {
			word = (word ?? '') + line[++index];
		} else if (/\s/u.test(character)) {
			if (word !== null) words.push(word);
			word = null;
		} else {
			word = (word ?? '') + character;
		}
	}
	if (quote) throw new Error('命令里的引号没有配对');
	if (word !== null) words.push(word);
	return words;
}
