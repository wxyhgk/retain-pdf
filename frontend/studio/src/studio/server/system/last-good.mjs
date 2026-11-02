import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * The last version of the Studio's own code that started (docs/apps-design.md, 最小启动): when an edit breaks the
 * Studio itself, Studio.app opens that version instead (a checkout of it in .studio-cache/rescue, the articles and the
 * rest linked to the real ones). Kept each time the Studio finishes starting, when its code is as committed: then the
 * commit is what started.
 */

/** The Studio's own code: an edit outside these (an article, a picture) does not change what starts. */
const CODE = ['src', 'packages', 'plugins', 'bin', 'astro.config.mjs', 'package.json', 'package-lock.json', 'tsconfig.json'];

/** Where it is kept: `.studio-cache/last-good.json` of the project. */
export const lastGoodFile = (root) => join(root, '.studio-cache', 'last-good.json');

/**
 * The Studio at `root` has started: its commit kept as the last good one, when its code is as committed (and it is in a
 * repository). What was kept (or null, and why not).
 * @returns {Promise<{ commit: string, at: string } | { commit: null, why: string }>}
 */
export async function keepLastGood(root) {
	try {
		const { stdout: commit } = await run('git', ['-C', root, 'rev-parse', 'HEAD']);
		const { stdout: changed } = await run('git', ['-C', root, 'status', '--porcelain', '--', ...CODE]);
		if (changed.trim()) return { commit: null, why: 'uncommitted' };
		const kept = { commit: commit.trim(), at: new Date().toISOString() };
		await mkdir(dirname(lastGoodFile(root)), { recursive: true });
		await writeFile(lastGoodFile(root), `${JSON.stringify(kept)}\n`);
		return kept;
	} catch {
		return { commit: null, why: 'no-git' };
	}
}

/** The last good version kept, or null. */
export async function lastGood(root) {
	return readFile(lastGoodFile(root), 'utf8').then((text) => JSON.parse(text), () => null);
}
