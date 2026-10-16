import { execFile } from 'node:child_process';
import { lstat, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { assertArticleSlug } from './bundle-paths.mjs';

const run = promisify(execFile);

/**
 * The articles as git sees them: which have changes not committed yet, and
 * committing one. Pushing stays the author's, outside the Studio.
 *
 * Committing an article takes its folder, and with it the folders of
 * articles that are gone from disk (renamed or deleted in the Studio): left
 * behind, a renamed article would be published twice, under both names.
 * Nothing else that is changed or staged is touched.
 *
 * When `blog/` is in no git repository, there is nothing to show (`available: false`).
 */
export class ArticleGit {
	#root;
	/** blog/ as git names it: through no symbolic link (macOS's /var is /private/var). */
	#blog = '';

	constructor(blogRoot, { git = 'git' } = {}) {
		this.blogRoot = resolve(blogRoot);
		this.git = git;
	}

	/**
	 * `changed`: per article folder, `new` (never committed) or `modified`;
	 * `vanished`: folders committed once and gone from disk.
	 */
	async status() {
		const root = await this.#repository();
		if (!root) return { available: false, changed: {}, vanished: [] };
		const output = await this.#git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', this.#blog]);
		const changed = {};
		const touched = new Set();
		const entries = output.split('\0');
		for (let index = 0; index < entries.length; index += 1) {
			const entry = entries[index];
			if (entry.length < 4) continue;
			const code = entry.slice(0, 2);
			// A rename lists where it went, then where it came from.
			const paths = [entry.slice(3)];
			if (code.includes('R') || code.includes('C')) paths.push(entries[(index += 1)]);
			for (const path of paths) {
				const slug = this.#slugOf(root, path);
				if (!slug) continue;
				touched.add(slug);
				changed[slug] = code === '??' && changed[slug] !== 'modified' ? 'new' : 'modified';
			}
		}
		const vanished = [];
		for (const slug of touched) {
			if (!(await exists(resolve(this.#blog, slug)))) {
				vanished.push(slug);
				delete changed[slug];
			}
		}
		return { available: true, changed, vanished: vanished.sort() };
	}

	/** Commits the article's folder, and the folders of articles gone from disk, with `message`. */
	async commit(slug, message) {
		assertArticleSlug(slug);
		if (typeof message !== 'string' || !message.trim()) throw new GitError('提交说明不能为空', 400);
		const root = await this.#repository();
		if (!root) throw new GitError('blog/ 不在 git 仓库里', 409);
		const { changed, vanished } = await this.status();
		if (!changed[slug] && !vanished.length) throw new GitError('这篇文章没有要提交的改动', 409);
		const folders = [slug, ...vanished].map((name) => resolve(this.#blog, name));
		await this.#git(root, ['add', '-A', '--', ...folders]);
		// With paths, only they are committed: whatever else was staged stays staged.
		await this.#git(root, ['commit', '--quiet', '-m', message.trim(), '--', ...folders]);
		const commit = (await this.#git(root, ['rev-parse', '--short', 'HEAD'])).trim();
		return { commit, vanished };
	}

	/** The repository blog/ is in, or null; asked again until there is one (a `git init` later). */
	async #repository() {
		if (this.#root) return this.#root;
		try {
			this.#blog = await realpath(this.blogRoot);
			this.#root = resolve((await this.#git(this.#blog, ['rev-parse', '--show-toplevel'])).trim());
		} catch {
			return null;
		}
		return this.#root;
	}

	/** The article folder a path of the repository is in, if any. */
	#slugOf(root, path) {
		const inBlog = relative(this.#blog, resolve(root, path));
		if (!inBlog || inBlog.startsWith('..')) return null;
		const [slug, rest] = inBlog.split(sep, 2);
		// A file right in blog/ is no article's.
		return rest === undefined ? null : slug;
	}

	async #git(cwd, args) {
		try {
			const { stdout } = await run(this.git, args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, maxBuffer: 16 * 1024 * 1024 });
			return stdout;
		} catch (error) {
			const said = String(error?.stderr ?? '').trim().split('\n').filter(Boolean).pop();
			throw new GitError(said ? `git：${said}` : 'git 命令失败', 500);
		}
	}
}

async function exists(path) {
	try {
		await lstat(path);
		return true;
	} catch {
		return false;
	}
}

export class GitError extends Error {
	constructor(message, statusCode) {
		super(message);
		this.name = 'GitError';
		this.statusCode = statusCode;
	}
}
