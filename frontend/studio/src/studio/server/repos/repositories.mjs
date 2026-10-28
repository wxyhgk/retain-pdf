import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { t } from '@blog/i18n/index.mjs';
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';
import { resourceContentType } from '../files/file-repository.mjs';

/**
 * 代码仓库: the git repositories the author keeps code in, looked at as GitHub shows them — the list (what each is,
 * its branch, its last commit, what is not committed, its languages), and each one's home (its files, its README, a
 * file's text). Two kinds, one list: those the Studio keeps itself (`repos/` beside blog/, out of the blog's git, each
 * its own git repository, made here), and those already on this machine the author added (their paths kept in the
 * Studio's settings, never in git). Only looked at here, on this machine: nothing is pushed or fetched.
 *
 * The 小程序 代码仓库 (apps/code-library) asks for all this through `studio.repos.*`.
 */

const git = promisify(execFile);

/** What the Studio's own repositories may be called: a folder name, no dots or slashes to go elsewhere. */
const OWN_NAME = /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,63}$/u;
/** Where repositories already on this machine usually are, looked through (two levels) when the author adds one. */
const USUAL_PLACES = ['Code', 'code', 'Projects', 'projects', 'Developer', 'src', 'repos', 'GitHub', 'Documents/GitHub', 'workspace'];
/** A file larger is not shown as text. */
const LARGEST_TEXT = 1024 * 1024;
/** A file larger is not highlighted (shown plain). */
const LARGEST_HIGHLIGHTED = 200 * 1024;
/** How many files of a folder are listed. */
const MOST_ENTRIES = 3000;
const PICTURES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'ico', 'bmp']);

/** Languages by extension, for the list's 「语言」 and for highlighting (Shiki's names). */
const LANGUAGES = {
	py: 'Python', ipynb: 'Jupyter', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
	rs: 'Rust', go: 'Go', c: 'C', h: 'C', cpp: 'C++', cc: 'C++', cxx: 'C++', hpp: 'C++', f: 'Fortran', f90: 'Fortran', f95: 'Fortran', f03: 'Fortran',
	jl: 'Julia', r: 'R', m: 'MATLAB', java: 'Java', kt: 'Kotlin', swift: 'Swift', rb: 'Ruby', pl: 'Perl', lua: 'Lua', sh: 'Shell', bash: 'Shell', zsh: 'Shell',
	html: 'HTML', css: 'CSS', scss: 'CSS', vue: 'Vue', svelte: 'Svelte', astro: 'Astro', tex: 'TeX', md: 'Markdown', json: 'JSON', toml: 'TOML', yaml: 'YAML', yml: 'YAML',
	gjf: 'Gaussian', com: 'Gaussian', inp: '输入文件', // i18n-ignore: a language's name
};
const SHIKI = { py: 'python', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', rs: 'rust', go: 'go', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', f: 'fortran-fixed-form', f90: 'fortran-free-form', f95: 'fortran-free-form', f03: 'fortran-free-form', jl: 'julia', r: 'r', m: 'matlab', java: 'java', kt: 'kotlin', swift: 'swift', rb: 'ruby', pl: 'perl', lua: 'lua', sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript', html: 'html', css: 'css', scss: 'scss', vue: 'vue', svelte: 'svelte', astro: 'astro', tex: 'latex', md: 'markdown', json: 'json', toml: 'toml', yaml: 'yaml', yml: 'yaml', sql: 'sql', xml: 'xml', dockerfile: 'docker', makefile: 'makefile', cmake: 'cmake' };
/** Light GitHub's colours (Shiki's github-light) as the Studio's black and white: what each kind of token is drawn as. */
const TOKEN_KINDS = { '#D73A49': 'k', '#6A737D': 'c', '#6F42C1': 'f', '#032F62': 's', '#005CC5': 'n', '#22863A': 'k', '#E36209': 'v' };

const extension = (path) => {
	const name = basename(path).toLowerCase();
	if (name === 'dockerfile' || name === 'makefile') return name;
	return extname(name).slice(1);
};
const idOf = (path) => `r${createHash('sha1').update(path).digest('hex').slice(0, 10)}`;
const said = (message, statusCode) => Object.assign(new Error(message), { statusCode });

/** A path as the author reads it: the home folder as `~`. */
function shown(path) {
	const home = homedir();
	return path === home || path.startsWith(`${home}${sep}`) ? `~${path.slice(home.length)}` : path;
}

async function gitIn(dir, args, { timeout = 8000 } = {}) {
	const { stdout } = await git('git', ['-C', dir, ...args], { timeout, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' } });
	return stdout;
}

/** The top of the git repository `dir` is in (its real path), or null. */
async function topOf(dir) {
	try {
		const top = (await gitIn(dir, ['rev-parse', '--show-toplevel'])).trim();
		return top ? await realpath(top) : null;
	} catch {
		return null;
	}
}

/** README's first paragraph, as plain words: what the repository says it is. */
function descriptionIn(readme) {
	const paragraph = readme
		.replace(/^---\n[\s\S]*?\n---\n/u, '')
		.split(/\n\s*\n/u)
		.map((block) => block.trim())
		.find((block) => block && !/^(#|!\[|<|\[!\[|```|\||-{3,}|={3,})/u.test(block));
	if (!paragraph) return '';
	return paragraph
		.replace(/!\[[^\]]*\]\([^)]*\)/gu, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
		.replace(/[*_`>]/gu, '')
		.replace(/\s+/gu, ' ')
		.trim()
		.slice(0, 200);
}

/** The files git sees in it: those committed and those new, not those ignored. */
async function filesIn(dir) {
	const listed = await gitIn(dir, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
	return [...new Set(listed.split('\0').filter(Boolean))];
}

/** A file's lines highlighted, in the Studio's black and white: `[[text, kind]]` per line (kind '' for plain). */
let highlighter = null;
async function highlighted(text, path) {
	const language = SHIKI[extension(path)];
	if (!language || text.length > LARGEST_HIGHLIGHTED) return null;
	try {
		const { createHighlighter } = await import('shiki');
		highlighter ??= createHighlighter({ themes: ['github-light'], langs: [] });
		const shiki = await highlighter;
		if (!shiki.getLoadedLanguages().includes(language)) await shiki.loadLanguage(language);
		const { tokens } = shiki.codeToTokens(text, { lang: language, theme: 'github-light' });
		return tokens.map((line) =>
			line.map((token) => {
				const kind = TOKEN_KINDS[String(token.color ?? '').toUpperCase()] ?? '';
				// An operator is not a keyword to the eye.
				return [token.content, kind === 'k' && !/[\p{L}\p{N}]/u.test(token.content) ? '' : kind];
			}),
		);
	} catch {
		return null;
	}
}

/** README as HTML (no HTML of its own let through): its pictures and links to the repository's files made the app's. */
function readmeHtml(markdown, { dir, raw, file }) {
	const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype);
	const tree = processor.runSync(processor.parse(markdown));
	const inRepository = (url) => {
		if (!url || /^[a-z][a-z0-9+.-]*:/iu.test(url) || url.startsWith('#') || url.startsWith('//')) return null;
		const path = url.startsWith('/') ? url.slice(1) : [dir, url].filter(Boolean).join('/');
		const parts = [];
		for (const part of path.replace(/[?#].*$/u, '').split('/')) {
			if (!part || part === '.') continue;
			if (part === '..') parts.pop();
			else parts.push(decodeURIComponent(part));
		}
		return parts.join('/');
	};
	// Only addresses that go somewhere (the web, mail, the repository's own): no `javascript:` run where the app runs.
	const safe = (url) => /^(https?:|mailto:|#|\/api\/studio\/repos\/)/iu.test(url);
	visit(tree, 'element', (node) => {
		if (node.tagName === 'img') {
			const path = inRepository(String(node.properties?.src ?? ''));
			if (path) node.properties.src = raw(path);
			if (!safe(String(node.properties.src ?? ''))) delete node.properties.src;
		} else if (node.tagName === 'a') {
			const href = String(node.properties?.href ?? '');
			const path = inRepository(href);
			if (path !== null) node.properties.href = file(path);
			else if (!safe(href)) delete node.properties.href;
			else if (!href.startsWith('#')) node.properties.target = '_blank';
		}
	});
	return unified().use(rehypeStringify).stringify(tree);
}

export class Repositories {
	/**
	 * @param {{ ownRoot: string, settingsFile: string, home?: string }} options `ownRoot`: where the Studio's own are
	 *   (`repos/`, reposRootOf); `home`: where repositories already on this machine are looked for
	 */
	constructor({ ownRoot, settingsFile, home = homedir() }) {
		this.ownRoot = resolve(ownRoot);
		this.settingsFile = settingsFile;
		this.home = home;
	}

	/** The paths of those added (their real paths). */
	async #added() {
		const saved = (await readSettings(this.settingsFile)).repos?.added;
		return Array.isArray(saved) ? saved.filter((path) => typeof path === 'string') : [];
	}

	/** Every repository: the Studio's own, then those added; each `{ id, path, own }`. */
	async #all() {
		const found = [];
		const entries = await readdir(this.ownRoot, { withFileTypes: true }).catch(() => []);
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
			const path = join(this.ownRoot, entry.name);
			const real = await realpath(path).catch(() => path);
			found.push({ id: idOf(real), path: real, own: true });
		}
		for (const path of await this.#added()) if (!found.some((each) => each.path === path)) found.push({ id: idOf(path), path, own: false });
		return found;
	}

	async #one(id) {
		const repository = (await this.#all()).find((each) => each.id === id);
		if (!repository) throw said(t('没有这个仓库'), 404);
		return repository;
	}

	/** What the list shows of one: what it is, where, its branch and last commit, what is not committed, its languages. */
	async #summary({ id, path, own }) {
		const summary = { id, name: basename(path), path: shown(path), own, description: '', branch: '', commit: null, changes: 0, files: 0, languages: [], remote: '', problem: '' };
		try {
			const [branch, last, status, files, remote, readme] = await Promise.all([
				gitIn(path, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => ''),
				gitIn(path, ['log', '-1', '--format=%h%x00%s%x00%an%x00%ct']).catch(() => ''),
				gitIn(path, ['status', '--porcelain']).catch(() => ''),
				filesIn(path),
				gitIn(path, ['remote', 'get-url', 'origin']).catch(() => ''),
				readFile(join(path, 'README.md'), 'utf8').catch(() => readFile(join(path, 'readme.md'), 'utf8').catch(() => '')),
			]);
			summary.branch = branch.trim() === 'HEAD' ? '' : branch.trim();
			const [hash, subject, author, time] = last.trim().split('\0');
			if (hash) summary.commit = { hash, subject, author, time: Number(time) * 1000 };
			summary.changes = status.split('\n').filter(Boolean).length;
			summary.files = files.length;
			// Shown as GitHub hides it: the address only, no user or token in it.
			summary.remote = remote.trim().replace(/\/\/[^@/]+@/u, '//');
			summary.description = descriptionIn(readme);
			const counts = new Map();
			for (const file of files) {
				const language = LANGUAGES[extension(file)];
				if (language && language !== 'Markdown' && language !== 'JSON' && language !== 'YAML' && language !== 'TOML') counts.set(language, (counts.get(language) ?? 0) + 1);
			}
			const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
			summary.languages = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => ({ name, share: Math.round((count / total) * 100) }));
		} catch (error) {
			summary.problem = error?.code === 'ENOENT' ? t('这个文件夹不在了') : t('读不了这个仓库：{error}', { error: String(error?.message ?? error).split('\n')[0] });
		}
		return summary;
	}

	/** Every repository, as the list shows them, the last committed to first. */
	async list() {
		const summaries = await Promise.all((await this.#all()).map((repository) => this.#summary(repository)));
		return summaries.sort((a, b) => (b.commit?.time ?? 0) - (a.commit?.time ?? 0) || a.name.localeCompare(b.name));
	}

	/** Repositories on this machine not added yet, in the usual places (~/Code…, two levels down): to add one. */
	async discover() {
		const added = new Set((await this.#all()).map((each) => each.path));
		const found = new Map();
		const look = async (dir, depth) => {
			const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
			if (entries.some((entry) => entry.name === '.git')) {
				const real = await realpath(dir).catch(() => dir);
				if (!added.has(real) && !real.startsWith(this.ownRoot + sep)) found.set(real, { path: real, shown: shown(real), name: basename(real) });
				return;
			}
			if (depth >= 2) return;
			for (const entry of entries) if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') await look(join(dir, entry.name), depth + 1);
		};
		for (const place of USUAL_PLACES) await look(join(this.home, place), 0);
		return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
	}

	/** One already on this machine added (a folder in it is enough: its repository's top is kept). */
	async add(path) {
		const asked = String(path ?? '').trim().replace(/^~(?=$|\/)/u, this.home);
		if (!asked.startsWith('/')) throw said(t('要给出完整的路径，比如 ~/Code/项目'), 400);
		const top = await topOf(asked);
		if (!top) throw said(t('{path} 不是 git 仓库', { path: shown(asked) }), 400);
		await updateSettings(this.settingsFile, (settings) => {
			const added = Array.isArray(settings.repos?.added) ? settings.repos.added : [];
			return { ...settings, repos: { ...settings.repos, added: [...new Set([...added, top])] } };
		});
		return (await this.list()).find((each) => each.id === idOf(top));
	}

	/** One added taken off the list (its folder left as it is). The Studio's own are not removed here. */
	async remove(id) {
		const repository = await this.#one(id);
		if (repository.own) throw said(t('Studio 自己的仓库在 repos/ 里，不在这里删'), 400);
		await updateSettings(this.settingsFile, (settings) => ({ ...settings, repos: { ...settings.repos, added: (settings.repos?.added ?? []).filter((path) => path !== repository.path) } }));
		return true;
	}

	/** A new repository of the Studio's own: `repos/<name>/`, git, a README saying what it is, committed. */
	async create({ name, description = '' } = {}) {
		const folder = String(name ?? '').trim();
		if (!OWN_NAME.test(folder)) throw said(t('仓库名只能用文字、数字和 . _ -，不超过 64 个字'), 400);
		const path = join(this.ownRoot, folder);
		if (await lstat(path).catch(() => null)) throw said(t('已经有叫 {name} 的仓库了', { name: folder }), 409);
		await mkdir(path, { recursive: true });
		await gitIn(path, ['init', '-q', '-b', 'main']);
		await writeFile(join(path, 'README.md'), `# ${folder}\n\n${String(description).trim() || t('（写下这个仓库是做什么的）')}\n`);
		await gitIn(path, ['add', 'README.md']);
		// Without a name and email for git (a new machine), it stays uncommitted: the README is there all the same.
		await gitIn(path, ['commit', '-q', '-m', t('新建仓库')]).catch(() => {});
		const id = idOf(await realpath(path));
		return (await this.list()).find((each) => each.id === id);
	}

	/**
	 * A folder of it (`dir`, '' for its top): its folders, then its files, as git sees them (not those ignored), each
	 * with its size; and its README there, as HTML, when it has one.
	 */
	async tree(id, dir = '') {
		const { path } = await this.#one(id);
		const prefix = dir ? `${dir.replace(/\/+$/u, '')}/` : '';
		const folders = new Set();
		const files = [];
		for (const file of await filesIn(path)) {
			if (!file.startsWith(prefix)) continue;
			const rest = file.slice(prefix.length);
			const slash = rest.indexOf('/');
			if (slash >= 0) folders.add(rest.slice(0, slash));
			else files.push(rest);
		}
		if (prefix && !folders.size && !files.length) throw said(t('没有这个文件夹'), 404);
		const entries = [...[...folders].sort((a, b) => a.localeCompare(b)).map((name) => ({ name, path: prefix + name, kind: 'folder', size: null }))];
		for (const name of files.sort((a, b) => a.localeCompare(b)).slice(0, MOST_ENTRIES)) {
			const info = await stat(join(path, prefix, name)).catch(() => null);
			entries.push({ name, path: prefix + name, kind: 'file', size: info?.size ?? null });
		}
		const readmeName = files.find((name) => /^readme(\.md|\.markdown)?$/iu.test(name));
		const readme = readmeName ? await this.#readme(id, path, prefix + readmeName, prefix.replace(/\/$/u, '')) : null;
		return { dir: prefix.replace(/\/$/u, ''), entries, readme, truncated: files.length > MOST_ENTRIES };
	}

	async #readme(id, path, file, dir) {
		const text = await readFile(join(path, file), 'utf8').catch(() => null);
		if (text === null) return null;
		const html = readmeHtml(text.slice(0, LARGEST_TEXT), { dir, raw: (inside) => rawUrl(id, inside), file: (inside) => `#file=${encodeURIComponent(inside)}` });
		return { path: file, html };
	}

	/** A file of it: its text (highlighted when it is code), or that it is a picture (`raw`) or not text. */
	async file(id, file) {
		const { path } = await this.#one(id);
		const inside = await this.#inside(path, file);
		const info = await stat(inside);
		const found = { path: file, size: info.size, language: LANGUAGES[extension(file)] ?? '', kind: 'text', text: '', lines: null, html: '', raw: rawUrl(id, file) };
		if (PICTURES.has(extension(file))) return { ...found, kind: 'picture' };
		if (info.size > LARGEST_TEXT) return { ...found, kind: 'large' };
		const bytes = await readFile(inside);
		if (bytes.subarray(0, 8000).includes(0)) return { ...found, kind: 'binary' };
		const text = bytes.toString('utf8');
		const markdown = /\.(md|markdown)$/iu.test(file) ? readmeHtml(text, { dir: file.split('/').slice(0, -1).join('/'), raw: (at) => rawUrl(id, at), file: (at) => `#file=${encodeURIComponent(at)}` }) : '';
		return { ...found, text, lines: await highlighted(text, file), html: markdown };
	}

	/** A file of it for a picture or a download (`raw`), only one git sees there, no link followed. */
	async raw(id, file) {
		const { path } = await this.#one(id);
		const inside = await this.#inside(path, file);
		const handle = await open(inside, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => null);
		if (!handle) throw said(t('没有这个文件'), 404);
		const { size } = await handle.stat();
		return { body: handle.createReadStream(), contentType: resourceContentType(file), size, range: null };
	}

	/** Where `file` is in the repository at `path`: only a file git sees there, not through a link, not out of it. */
	async #inside(path, file) {
		const asked = String(file ?? '');
		if (!asked || asked.split('/').some((part) => !part || part === '..' || part === '.git') || asked.includes('\0')) throw said(t('没有这个文件'), 404);
		const known = new Set(await filesIn(path));
		if (!known.has(asked)) throw said(t('没有这个文件'), 404);
		let current = path;
		for (const part of asked.split('/')) {
			current = join(current, part);
			const info = await lstat(current).catch(() => null);
			if (!info || info.isSymbolicLink()) throw said(t('没有这个文件'), 404);
		}
		if (relative(path, current).startsWith('..')) throw said(t('没有这个文件'), 404);
		return current;
	}
}

/** Where a file of a repository is served (pictures in its README, a picture opened, a download). */
export const rawUrl = (id, file) => `/api/studio/repos/${encodeURIComponent(id)}/raw/${file.split('/').map(encodeURIComponent).join('/')}`;
