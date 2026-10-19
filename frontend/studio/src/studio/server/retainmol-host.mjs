import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

/**
 * RetainMol (the author's molecule editor, a project of its own) for the
 * Studio's sheets, where molecules are built: started from its checkout on
 * first use, with its own dev server (`npm run dev`, which builds its
 * packages first), and stopped with the Studio's. The page shows it in a
 * frame, in its embedded mode (`?embed=1`, RetainMol's app/embed.ts).
 *
 * Where the checkout is: `retainmolRoot` in the Studio's settings
 * (.studio-settings.json), absolute or from the repository; `../RetainMol`
 * when not set.
 */

export class RetainmolUnavailableError extends Error {
	constructor(message) {
		super(message);
		this.name = 'RetainmolUnavailableError';
		this.statusCode = 503;
	}
}

const START_TIMEOUT_MS = 240_000;

export class RetainmolHost {
	#child = null;
	#starting = null;
	#output = [];

	/**
	 * @param {{ projectRoot: string, settingsFile: string, port?: number, fixedUrl?: string | null, spawnImpl?: typeof spawn, fetchImpl?: typeof fetch }} options
	 * `fixedUrl`: a RetainMol running elsewhere, used instead of starting one.
	 */
	constructor({ projectRoot, settingsFile, port = 5310, fixedUrl = null, spawnImpl = spawn, fetchImpl = fetch }) {
		this.fixedUrl = fixedUrl;
		this.projectRoot = projectRoot;
		this.settingsFile = settingsFile;
		this.port = port;
		this.spawnImpl = spawnImpl;
		this.fetchImpl = fetchImpl;
		this.url = `http://127.0.0.1:${port}`;
	}

	/** The RetainMol checkout to run; throws when there is none. */
	async root() {
		let written = '../RetainMol';
		try {
			written = JSON.parse(await readFile(this.settingsFile, 'utf8')).retainmolRoot || written;
		} catch {
			// No settings: the default.
		}
		const root = isAbsolute(written) ? written : resolve(this.projectRoot, written);
		if (!existsSync(join(root, 'apps', 'retainmol', 'package.json'))) {
			throw new RetainmolUnavailableError(`找不到 RetainMol：${root} 里没有 apps/retainmol。在 .studio-settings.json 的 retainmolRoot 里写上它的位置`);
		}
		return root;
	}

	async #answering() {
		try {
			const response = await this.fetchImpl(`${this.url}/`, { signal: AbortSignal.timeout(2000) });
			return response.ok && /RetainMol/iu.test(await response.text());
		} catch {
			return false;
		}
	}

	/** Its address, once it answers: started now if it is not running. */
	async start() {
		// One running elsewhere (the browser tests' stand-in): used as it is.
		if (this.fixedUrl) return this.fixedUrl;
		if (await this.#answering()) return this.url;
		this.#starting ??= this.#start().finally(() => {
			this.#starting = null;
		});
		return this.#starting;
	}

	async #start() {
		const root = await this.root();
		if (!this.#child) {
			this.#output = [];
			// Its own process group, so that stopping it stops what npm started under it.
			const child = this.spawnImpl('npm', ['run', 'dev', '--workspace', 'retainmol', '--', '--host', '127.0.0.1', '--port', String(this.port), '--strictPort'], {
				cwd: root,
				detached: true,
				stdio: ['ignore', 'pipe', 'pipe'],
				env: { ...process.env, BROWSER: 'none' },
			});
			const keep = (chunk) => {
				this.#output.push(...String(chunk).split('\n').filter(Boolean));
				this.#output = this.#output.slice(-20);
			};
			child.stdout?.on('data', keep);
			child.stderr?.on('data', keep);
			child.on('exit', () => {
				if (this.#child === child) this.#child = null;
			});
			this.#child = child;
		}
		const deadline = Date.now() + START_TIMEOUT_MS;
		while (Date.now() < deadline) {
			if (await this.#answering()) return this.url;
			if (!this.#child) throw new RetainmolUnavailableError(`RetainMol 没能启动：${this.#output.slice(-3).join(' ') || '进程退出了'}`);
			await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
		}
		throw new RetainmolUnavailableError(`RetainMol 四分钟内没有启动好：${this.#output.slice(-3).join(' ')}`);
	}

	close() {
		const child = this.#child;
		this.#child = null;
		if (!child?.pid) return;
		try {
			process.kill(-child.pid, 'SIGTERM');
		} catch {
			child.kill('SIGTERM');
		}
	}
}
