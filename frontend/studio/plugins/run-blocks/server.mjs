import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { t } from '@blog/i18n/index.mjs';

import { runnerOf } from './run-blocks.mjs';

/**
 * The Studio's dev server: a code block of an article run (run-blocks.mjs). Under /api/studio/plugins/run-blocks/:
 *
 *     POST articles/:slug/run   { language, code } → { output, exitCode, signal, seconds }
 *
 * The code is written to a file of its own (outside the article) and run through a login shell, as the author's
 * terminal would, in the article's folder: what it writes there (a plot, data) is the article's. Answered once it is
 * over; stopped when the Studio stops asking (the page gone), or after `LIMIT`.
 */
export const name = 'server-run-blocks';
export const inject = ['server', 'routes'];

/** How long a block may run; how much of its output is kept. */
const LIMIT = 10 * 60 * 1000;
const KEPT = 200_000;

export function apply(ctx) {
	const { server } = ctx;
	ctx.routes.post('/run-blocks/articles/:slug/run', async ({ params, json, request }) => {
		const { language, code } = await json();
		return runBlock({ language, code, cwd: server.files.articleFolder(params.slug), request });
	});
}

/**
 * Runs `code` in `language` in `cwd`: what it wrote (out and err as they came), how it ended, how long it took.
 * @param {{ language: string, code: string, cwd: string, request?: import('node:http').IncomingMessage, shell?: string, limit?: number }} asked
 */
export async function runBlock({ language, code, cwd, request, shell = process.env.SHELL || '/bin/zsh', limit = LIMIT }) {
	const runner = runnerOf(language);
	if (!runner) throw Object.assign(new Error(t('{language} 的代码块不能运行', { language: String(language) })), { statusCode: 400 });
	const folder = await mkdtemp(join(tmpdir(), 'studio-run-'));
	const file = join(folder, `block.${runner.extension}`);
	await writeFile(file, String(code ?? ''));
	const started = Date.now();
	try {
		return await new Promise((resolve) => {
			const child = spawn(shell, ['-lc', 'exec "$@"', 'run-block', runner.program, file], { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: process.env });
			let output = '';
			const take = (chunk) => {
				if (output.length < KEPT) output += chunk;
			};
			for (const stream of [child.stdout, child.stderr]) {
				stream.setEncoding('utf8');
				stream.on('data', take);
			}
			const stop = () => {
				try {
					process.kill(-child.pid, 'SIGTERM');
				} catch {
					// Over already.
				}
			};
			const timer = setTimeout(() => {
				take(`\n${t('（运行超过 {minutes} 分钟，停下了）', { minutes: Math.round(limit / 60000) })}\n`);
				stop();
			}, limit);
			const gone = () => {
				if (child.exitCode === null) stop();
			};
			request?.socket?.once('close', gone);
			child.on('error', (error) => take(`${error.message}\n`));
			child.on('close', (exitCode, signal) => {
				clearTimeout(timer);
				request?.socket?.off('close', gone);
				if (output.length >= KEPT) output = `${output.slice(0, KEPT)}\n${t('（输出太长，后面省略了）')}\n`;
				resolve({ output, exitCode, signal, seconds: Math.round((Date.now() - started) / 100) / 10 });
			});
		});
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}
