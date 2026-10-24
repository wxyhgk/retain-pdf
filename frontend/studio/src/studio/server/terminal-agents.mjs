import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The AIs the 终端 tab starts with a click: the coding agents that run in a
 * terminal and read the notes' rules by themselves (blog/AGENTS.md and the
 * skills in .agents/skills: Claude Code through blog/CLAUDE.md and .claude/skills).
 */
export const TERMINAL_AGENTS = Object.freeze([
	{ id: 'claude', name: 'Claude', command: 'claude', install: 'npm install -g @anthropic-ai/claude-code' },
	{ id: 'codex', name: 'Codex', command: 'codex', install: 'npm install -g @openai/codex' },
	{ id: 'pi', name: 'pi', command: 'pi', install: '见 https://pi.dev' },
]);

/** How long what was found is taken as still so, in ms (one is installed while the Studio runs, now and then). */
const KEPT_FOR = 60_000;

let known = null;

/**
 * Which of them this machine has: looked for as the terminal's shell finds
 * programs (a login shell: the Studio's own server, started by the Mac app,
 * has a shorter PATH than the author's terminal). With `STUDIO_TERMINAL_AGENT_DIR` (browser tests: stand-ins that
 * say where they were started), only the programs in that folder, started by their full path.
 * @returns {Promise<Array<(typeof TERMINAL_AGENTS)[number] & { installed: boolean }>>}
 */
export async function terminalAgents({ shell = process.env.SHELL || '/bin/zsh', env = process.env, now = Date.now() } = {}) {
	const standIns = env.STUDIO_TERMINAL_AGENT_DIR;
	if (standIns) {
		return Promise.all(TERMINAL_AGENTS.map(async (agent) => {
			const command = join(standIns, agent.command);
			const installed = await access(command, constants.X_OK).then(() => true, () => false);
			return { ...agent, command, installed };
		}));
	}
	if (!known || now - known.at > KEPT_FOR || known.shell !== shell) {
		const names = TERMINAL_AGENTS.map((agent) => agent.command).join(' ');
		const found = await new Promise((resolve) => {
			execFile(shell, ['-lc', `for c in ${names}; do command -v "$c" >/dev/null 2>&1 && echo "found:$c"; done`], { env, timeout: 5000 }, (_error, stdout) => {
				resolve(new Set(String(stdout ?? '').split('\n').filter((line) => line.startsWith('found:')).map((line) => line.slice('found:'.length).trim())));
			});
		});
		known = { at: now, shell, found };
	}
	return TERMINAL_AGENTS.map((agent) => ({ ...agent, installed: known.found.has(agent.command) }));
}
