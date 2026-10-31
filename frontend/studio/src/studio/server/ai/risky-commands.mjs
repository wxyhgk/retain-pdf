import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, resolve } from 'node:path';

import { t } from '@blog/i18n/index.mjs';

/**
 * What an AI in the Studio may not do on its own (blog/AGENTS.md says so; this keeps it so): push (the author pushes),
 * and, without the author saying yes, what loses work or stops the Studio: deleting folders outside the temporary
 * ones, throwing changes away in git, starting a development server on the notes or the Studio (there is one, the
 * Studio's), killing processes.
 */

/** A push nowhere: a remote's address with this in front is a helper that says no (bin/git-remote-studio-ai-may-not-push). */
const NO_PUSH = 'studio-ai-may-not-push::';

/** How addresses begin (a path, the web, ssh), each taken to NO_PUSH when pushed to. */
const PUSHED_FROM = ['/', '~', '.', 'file://', 'https://', 'http://', 'ssh://', 'git://', 'git@'];

/**
 * The environment of an AI's programs (its agent, the commands it runs, the agents those start) in which git pushes
 * nowhere: `pushInsteadOf` from the environment (GIT_CONFIG_*), so a repository's own settings and the author's
 * terminal are as they were, and fetching still is.
 */
export function noPushEnv(env = process.env) {
	const at = Number(env.GIT_CONFIG_COUNT) || 0;
	const added = {};
	PUSHED_FROM.forEach((prefix, index) => {
		added[`GIT_CONFIG_KEY_${at + index}`] = `url.${NO_PUSH}.pushInsteadOf`;
		added[`GIT_CONFIG_VALUE_${at + index}`] = prefix;
	});
	return { ...added, GIT_CONFIG_COUNT: String(at + PUSHED_FROM.length) };
}

/** The commands of a line of shell, each its words (roughly: quotes kept together, `;`, `&&`, `||`, `|`, newlines between). */
function commandsOf(line) {
	const commands = [];
	let words = [];
	let word = '';
	let quote = '';
	const end = () => {
		if (word) words.push(word);
		word = '';
	};
	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		if (quote) {
			if (char === quote) quote = '';
			else word += char;
		} else if (char === '"' || char === "'") quote = char;
		else if (/\s/u.test(char) && char !== '\n') end();
		else if (';&|\n()'.includes(char)) {
			end();
			if (words.length) commands.push(words);
			words = [];
		} else word += char;
	}
	end();
	if (words.length) commands.push(words);
	// `sudo`, `env A=b`, `nohup`, `time` before a command: the command.
	return commands.map((command) => {
		let at = 0;
		while (at < command.length && (['sudo', 'nohup', 'time', 'env', 'command', 'exec'].includes(command[at]) || /^\w+=/u.test(command[at]))) at += 1;
		return command.slice(at);
	});
}

/** Whether a path is in a temporary folder (what an AI makes and clears as it works), and not in the notes it works in. */
function temporary(path, cwd) {
	const full = resolve(cwd, path.replace(/^~(?=\/|$)/u, process.env.HOME ?? '~').replace(/^\$(?:TMPDIR\b|\{TMPDIR\})/u, tmpdir()));
	const inside = (folder) => full === resolve(folder) || full.startsWith(`${resolve(folder)}/`);
	if (inside(cwd) || ['/tmp', '/private/tmp'].includes(full)) return false;
	return [tmpdir(), '/tmp', '/private/tmp', '/var/folders', '/private/var/folders'].some(inside);
}

/**
 * What is risky in a shell command an AI runs in `cwd`: `{ refuse: true, why }` for what it may not do at all (push),
 * `{ refuse: false, why }` for what the author is asked about first, null for the rest.
 * @returns {{ refuse: boolean, why: string } | null}
 */
export function riskOf(command, cwd) {
	for (const words of commandsOf(String(command))) {
		const [name = '', ...rest] = words;
		const program = name.split('/').at(-1);
		const args = rest.filter((word) => !word.startsWith('-'));
		const flags = rest.filter((word) => word.startsWith('-')).join(' ');
		if (program === 'git') {
			// `git -C folder push`: what it does is the first word not an option (nor an option's value).
			const verbs = [];
			for (let index = 0; index < rest.length; index += 1) {
				if (['-C', '-c', '--git-dir', '--work-tree'].includes(rest[index])) index += 1;
				else if (!rest[index].startsWith('-')) verbs.push(rest[index]);
			}
			const [verb, ...more] = verbs;
			if (verb === 'push') return { refuse: true, why: t('推送由作者自己做，Studio 里的 AI 不推送') };
			if (verb === 'reset' && /--hard\b/u.test(flags)) return { refuse: false, why: t('会丢掉没提交的改动') };
			if (verb === 'clean' && /-\w*f/u.test(flags)) return { refuse: false, why: t('会删掉没进 git 的文件（笔记大多不在 git 里）') };
			if ((verb === 'checkout' || verb === 'restore') && (more.includes('.') || rest.includes('--'))) return { refuse: false, why: t('会丢掉没提交的改动') };
			if (verb === 'stash' && ['drop', 'clear'].includes(more[0])) return { refuse: false, why: t('会丢掉存起来的改动') };
			if (verb === 'branch' && /-\w*D/u.test(flags)) return { refuse: false, why: t('会删掉没合并的分支') };
		}
		if (program === 'rm' && /(^|\s)(-\w*[rR]\w*|--recursive)\b/u.test(flags) && args.some((path) => !temporary(path, cwd))) {
			return { refuse: false, why: t('会删掉文件夹（删页面请用回收站）') };
		}
		if (['kill', 'pkill', 'killall'].includes(program)) return { refuse: false, why: t('可能停掉 Studio 的服务器') };
		const run = words.join(' ');
		if (/^(npm|pnpm|yarn|bun) (run )?(dev|start|studio:serve)\b|^(npx )?astro dev\b|serve\.mjs\b/u.test(run)) {
			return { refuse: false, why: t('会再开一个开发服务器（Studio 已经有一个，不要再开）') };
		}
	}
	return null;
}

/**
 * An article's text (blog/<folder>/index.md) written by an AI's own file tools (pi's edit and write): not so, but
 * through the `studio` command (edit-page, update-page, create-page), which leaves its properties whole, keeps what was
 * there in its history and says what is wrong with it after; a slip of the tools (its properties' YAML broken, the
 * file cut short) is a page that no longer opens. Why, or null (another file, a tool that writes none).
 */
export function articleWriteOf(toolName, input, cwd) {
	if (toolName !== 'edit' && toolName !== 'write') return null;
	const path = typeof input?.path === 'string' ? input.path : typeof input?.file_path === 'string' ? input.file_path : '';
	if (!path) return null;
	const file = isAbsolute(path) ? path : resolve(cwd, path.replace(/^~(?=\/)/u, process.env.HOME ?? '~'));
	const above = dirname(dirname(file));
	if (basename(file) !== 'index.md' || (basename(above) !== 'blog' && above !== resolve(cwd))) return null;
	return t('文章的正文不要用编辑工具直接改：改一段用 studio edit-page --slug {slug} --old … --new …，换整篇用 studio update-page --body @文件，新建用 studio create-page（这样属性不会弄坏，改之前的版本也会存下来）', { slug: basename(dirname(file)) });
}
