import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * RetainMol (the author's molecule editor, a project of its own) for the
 * Studio's sheets, where molecules are built. It is built once from its
 * checkout (`vite build`, into the Studio's own cache, not RetainMol's
 * dist/) and served from here, on a port of its own: a built page opens in
 * a moment, where its dev server would first build its packages and then
 * send hundreds of modules. It is built again only when its code changed
 * (its commit, or what is not committed in apps/retainmol, packages or
 * package-lock.json). The Studio gets it ready when it starts.
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

const CONTENT_TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.wasm': 'application/wasm',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.ttf': 'font/ttf',
	'.map': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
};

/** What the build of RetainMol reads: its commit, and what is not committed in it. */
const WATCHED = ['apps/retainmol', 'packages', 'package-lock.json'];

/** Runs a command, its output kept for when it fails. */
function runCommand(command, args, cwd) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production' } });
		const output = [];
		const keep = (chunk) => output.push(String(chunk));
		child.stdout.on('data', keep);
		child.stderr.on('data', keep);
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) resolvePromise();
			else reject(new Error(`${command} ${args.join(' ')} 失败：${output.join('').trim().split('\n').slice(-3).join(' ')}`));
		});
	});
}

export class RetainmolHost {
	#server = null;
	#listening = null;
	#building = null;

	/**
	 * @param {{ projectRoot: string, settingsFile: string, cacheDir?: string, port?: number, fixedUrl?: string | null, run?: (command: string, args: string[], cwd: string) => Promise<void>, git?: (args: string[], cwd: string) => Promise<string> }} options
	 * `fixedUrl`: a RetainMol served elsewhere (the browser tests' stand-in), used as it is.
	 */
	constructor({
		projectRoot,
		settingsFile,
		cacheDir = join(projectRoot, '.studio-cache', 'retainmol'),
		port = 5310,
		fixedUrl = null,
		run = runCommand,
		git = async (args, cwd) => (await execFileAsync('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout,
	}) {
		this.projectRoot = projectRoot;
		this.settingsFile = settingsFile;
		this.cacheDir = cacheDir;
		this.port = port;
		this.fixedUrl = fixedUrl;
		this.run = run;
		this.git = git;
	}

	/** The RetainMol checkout to build; throws when there is none. */
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

	/** What its code is now: its commit and what is not committed of what the build reads. */
	async fingerprint(root) {
		const [commit, status, diff] = await Promise.all([
			this.git(['rev-parse', 'HEAD'], root),
			this.git(['status', '--porcelain=v1', '--untracked-files=all', '--', ...WATCHED], root),
			this.git(['diff', 'HEAD', '--', ...WATCHED], root),
		]);
		return createHash('sha256').update(`${commit}\n${status}\n${diff}`).digest('hex').slice(0, 20);
	}

	async #built() {
		try {
			return JSON.parse(await readFile(join(this.cacheDir, '.studio-build.json'), 'utf8'));
		} catch {
			return null;
		}
	}

	/** Its build, made now when there is none for its code as it is. Resolves with its folder. */
	async build() {
		this.#building ??= (async () => {
			const root = await this.root();
			const fingerprint = await this.fingerprint(root);
			if ((await this.#built())?.fingerprint === fingerprint && existsSync(join(this.cacheDir, 'index.html'))) return this.cacheDir;
			const app = join(root, 'apps', 'retainmol');
			// What its own `npm run build` does first (its prebuild), then the page alone: not its type check, nor its worker.
			await this.run('node', ['scripts/copy-ocl-resources.mjs'], app);
			await this.run('npm', ['run', 'build:packages'], root);
			await rm(this.cacheDir, { recursive: true, force: true });
			await mkdir(this.cacheDir, { recursive: true });
			await this.run('npx', ['vite', 'build', '--outDir', this.cacheDir, '--emptyOutDir'], app);
			await writeFile(join(this.cacheDir, '.studio-build.json'), `${JSON.stringify({ fingerprint, builtAt: new Date().toISOString() }, null, '\t')}\n`);
			return this.cacheDir;
		})().finally(() => {
			this.#building = null;
		});
		return this.#building;
	}

	/** Serves its build, from this process; on its port, or another one free when that is taken. */
	#serve() {
		this.#listening ??= new Promise((resolvePromise, reject) => {
			const server = createServer((request, response) => void this.#answer(request, response));
			const listen = (port) => server.listen(port, '127.0.0.1');
			server.on('listening', () => {
				// It lives as long as the dev server, and never keeps a process alive by itself.
				server.unref();
				this.#server = server;
				resolvePromise(`http://127.0.0.1:${server.address().port}`);
			});
			server.on('error', (error) => {
				if (error.code === 'EADDRINUSE' && server.address() === null) listen(0);
				else reject(error);
			});
			listen(this.port);
		});
		this.#listening.catch(() => {
			this.#listening = null;
		});
		return this.#listening;
	}

	async #answer(request, response) {
		const path = decodeURIComponent((request.url ?? '/').split('?', 1)[0]);
		let file = normalize(join(this.cacheDir, path));
		if (!file.startsWith(this.cacheDir + sep) && file !== this.cacheDir) {
			response.writeHead(403).end();
			return;
		}
		const info = await stat(file).catch(() => null);
		// A page of the app (no such file): its one page.
		if (!info?.isFile()) file = join(this.cacheDir, 'index.html');
		const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
		const page = file.endsWith('index.html');
		response.writeHead(existsSync(file) ? 200 : 404, {
			'Content-Type': type,
			// Its assets are named by their content; the page is read anew.
			'Cache-Control': page ? 'no-cache' : 'public, max-age=31536000, immutable',
		});
		if (!existsSync(file)) {
			response.end();
			return;
		}
		createReadStream(file).pipe(response);
	}

	/** Its address, once it is built and served: built now if its code changed. */
	async start() {
		if (this.fixedUrl) return this.fixedUrl;
		await this.build();
		return this.#serve();
	}

	close() {
		this.#server?.close();
		this.#server = null;
		this.#listening = null;
	}
}
