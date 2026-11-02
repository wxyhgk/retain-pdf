import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

import { endWithServer, loginShell } from '../tasks/tasks.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The project apps' development servers (docs/apps-design.md): one started when its window is opened, on a port of
 * its own, with its own base (`/studio-apps/<id>/`), and its backend beside it if it has one. Each runs through a
 * login shell (found as the author's terminal finds it), in a process group of its own that ends with the Studio's
 * server however that ends (tasks.mjs). One whose development server ends by itself is said to have stopped; it is
 * started again when asked, not by itself. Its backend ending is written in its output only: the page goes on (one
 * already running elsewhere, on the same port, answers it). What they write is kept, the last few hundred lines.
 *
 * @typedef {'stopped' | 'starting' | 'running' | 'failed'} AppState
 * @typedef {{ state: AppState, port: number | null, error: string | null }} AppStatus
 */

/** Lines of output kept for an app. */
const KEPT = 400;
/** How long a development server is waited for. */
const PATIENCE = 90_000;

/** A port free on this machine now. */
function freePort() {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.unref();
		probe.on('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const { port } = /** @type {import('node:net').AddressInfo} */ (probe.address());
			probe.close(() => resolve(port));
		});
	});
}

export class ProjectApps {
	/** @type {Map<string, { state: AppState, port: number | null, error: string | null, base: string, log: string[], groups: number[], letGo: Array<() => void>, ready: Promise<number> | null }>} */
	#apps = new Map();
	#listeners = new Set();
	#closed = false;

	/**
	 * @param {{ env?: () => Record<string, string>, shell?: string, patience?: number }} [options]
	 */
	constructor({ env = () => ({}), shell = process.env.SHELL || '/bin/zsh', patience = PATIENCE } = {}) {
		this.env = env;
		this.shell = shell;
		this.patience = patience;
	}

	/** @returns {AppStatus} */
	status(id) {
		const app = this.#apps.get(id);
		return app ? { state: app.state, port: app.port, error: app.error } : { state: 'stopped', port: null, error: null };
	}

	/** The port of an app's development server while it runs; null otherwise. */
	port(id) {
		const app = this.#apps.get(id);
		return app?.state === 'running' ? app.port : null;
	}

	/** What the app's commands wrote, the last lines. */
	log(id) {
		return this.#apps.get(id)?.log.join('') ?? '';
	}

	/** Called with an app's id when its state changes. */
	subscribe(listener) {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/**
	 * Starts the app (once: asked again while it starts or runs, the same), resolved with its port once its server
	 * answers; rejected when it ends first or does not answer in time.
	 * @param {string} id
	 * @param {import('./mini-apps.mjs').AppDev} dev
	 * @returns {Promise<number>}
	 */
	start(id, dev) {
		if (this.#closed) return Promise.reject(new Error(t('Studio 正在关闭')));
		const known = this.#apps.get(id);
		if (known?.ready && (known.state === 'starting' || known.state === 'running')) return known.ready;
		const base = `/studio-apps/${encodeURIComponent(id)}/`;
		const app = { state: /** @type {AppState} */ ('starting'), port: null, error: null, base, log: known?.log ?? [], groups: [], letGo: [], ready: null };
		this.#apps.set(id, app);
		this.#told(id);
		app.ready = (async () => {
			try {
				app.port = await freePort();
				const words = (argv) => argv.map((word) => word.replaceAll('{port}', String(app.port)).replaceAll('{base}', base));
				const ended = new Promise((_, reject) => {
					this.#run(id, app, words(dev.command), dev.cwd, (code, signal) => reject(new Error(t('开发服务器退出了（{how}）', { how: signal ?? code }))), true);
				});
				if (dev.backend) this.#run(id, app, words(dev.backend), dev.cwd, () => {}, false);
				await Promise.race([this.#answers(app.port, base), ended]);
				if (app.state !== 'starting') throw new Error(app.error ?? t('开发服务器停了'));
				app.state = 'running';
				this.#told(id);
				return app.port;
			} catch (error) {
				this.#end(id, app, 'failed', error instanceof Error ? error.message : String(error));
				throw error;
			}
		})();
		// A start no one waits for (asked again later) fails quietly; its state says why.
		app.ready.catch(() => {});
		return app.ready;
	}

	/** Stops an app's commands (and what they started). */
	stop(id) {
		const app = this.#apps.get(id);
		if (app) this.#end(id, app, 'stopped', null);
	}

	/** Stops them all: the server is closing. */
	closeAll() {
		this.#closed = true;
		for (const id of [...this.#apps.keys()]) this.stop(id);
		this.#listeners.clear();
	}

	/**
	 * Runs one of the app's commands through a login shell, its output kept; `ended` told when it ends by itself, and the
	 * app stopped with it when it is the one the app cannot be without (`vital`: its development server).
	 */
	#run(id, app, argv, cwd, ended, vital) {
		this.#write(app, `$ ${argv.join(' ')}\n`);
		const child = spawn(loginShell(this.shell), ['-lc', 'exec "$@"', 'studio-app', ...argv], {
			cwd,
			env: { ...process.env, ...this.env(), PORT: String(app.port), STUDIO_APP_BASE: app.base },
			stdio: ['ignore', 'pipe', 'pipe'],
			// Its own process group: stopping it stops what it started (npm → vite).
			detached: true,
		});
		if (child.pid) {
			app.groups.push(child.pid);
			app.letGo.push(endWithServer(child.pid));
		}
		for (const stream of [child.stdout, child.stderr]) {
			stream.setEncoding('utf8');
			stream.on('data', (text) => this.#write(app, text));
		}
		child.on('error', (error) => {
			this.#write(app, `${error.message}\n`);
			ended(null, null);
			if (vital && this.#apps.get(id) === app && app.state !== 'stopped') this.#end(id, app, 'failed', error.message);
		});
		child.on('exit', (code, signal) => {
			this.#write(app, `${t('（{program} 退出了：{how}）', { program: argv[0], how: signal ?? code })}\n`);
			ended(code, signal);
			// Its development server ended by itself: the app has stopped (it is not started again unasked).
			if (vital && this.#apps.get(id) === app && (app.state === 'starting' || app.state === 'running')) {
				this.#end(id, app, 'stopped', t('{program} 退出了（{how}）', { program: argv[0], how: signal ?? code }));
			}
		});
	}

	/** Waits for the server at `port` to answer at its base. */
	async #answers(port, base) {
		const deadline = Date.now() + this.patience;
		while (Date.now() < deadline) {
			try {
				const response = await fetch(`http://localhost:${port}${base}`, { signal: AbortSignal.timeout(2000) });
				await response.body?.cancel();
				return;
			} catch {
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
		}
		throw new Error(t('开发服务器 {seconds} 秒内没有回应', { seconds: Math.round(this.patience / 1000) }));
	}

	#end(id, app, state, error) {
		for (const group of app.groups) {
			try {
				process.kill(-group, 'SIGTERM');
			} catch {
				// Over already.
			}
		}
		for (const letGo of app.letGo) letGo();
		app.groups = [];
		app.letGo = [];
		if (app.state === state && app.error === error) return;
		app.state = state;
		app.error = error;
		app.ready = null;
		this.#told(id);
	}

	#write(app, text) {
		const lines = text.split(/(?<=\n)/u);
		// A line written in pieces stays one.
		if (app.log.length && !app.log.at(-1).endsWith('\n') && lines.length) app.log[app.log.length - 1] += lines.shift();
		app.log.push(...lines);
		if (app.log.length > KEPT) app.log.splice(0, app.log.length - KEPT);
	}

	#told(id) {
		for (const listener of this.#listeners) listener(id);
	}
}
