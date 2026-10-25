import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';

import { commandWords, loginShell } from './tasks.mjs';
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';

/**
 * The AIs the Studio starts: coding agents that run in a terminal and read the
 * notes' rules by themselves (blog/AGENTS.md, the skills in .agents/skills, the
 * author's preferences). Each is started three ways, a command line each:
 *
 * - `launch`: in the 终端 tab, to talk with (its button there);
 * - `run`: once, by itself, to do what a line of an article asks (Alt+Enter), `{prompt}` standing for what it is told;
 * - `resume`: the same, going on from the last talk in the article's folder (where each article's work goes on);
 * - `acp`: its adapter for the Agent Client Protocol, which the AI panel talks to it through (agent-sessions.mjs).
 *   Claude Code's and Codex's are in the project's dependencies; an agent without one is not in the panel.
 *
 * Presets for Claude Code, Codex and pi; the author changes them or adds others (omp…) in AI 设置, kept in the
 * Studio's settings (out of git) as `agents: { list, default }`. Their `run` keeps them to the article's folder
 * where the agent can (Claude Code's sandbox, Codex's workspace-write; pi has none).
 */

const CLAUDE_SANDBOX = `'{"sandbox":{"enabled":true,"failIfUnavailable":true,"allowUnsandboxedCommands":false}}'`;
const CLAUDE_RUN = `claude -p --permission-mode dontAsk --allowedTools "Read Edit Write Glob Grep Bash" --settings ${CLAUDE_SANDBOX}`;

export const AGENT_PRESETS = Object.freeze([
	{ id: 'claude', name: 'Claude', launch: 'claude', run: `${CLAUDE_RUN} {prompt}`, resume: `${CLAUDE_RUN} --continue {prompt}`, acp: 'claude-agent-acp', install: 'npm install -g @anthropic-ai/claude-code' },
	{ id: 'codex', name: 'Codex', launch: 'codex', run: 'codex exec -c sandbox_mode="workspace-write" {prompt}', resume: 'codex exec resume --last -c sandbox_mode="workspace-write" {prompt}', acp: 'codex-acp', install: 'npm install -g @openai/codex' },
	{ id: 'pi', name: 'pi', launch: 'pi', run: 'pi -p -a {prompt}', resume: 'pi -p -a --continue {prompt}', install: '见 https://pi.dev' },
]);

/** How long what was found installed is taken as still so, in ms. */
const KEPT_FOR = 60_000;
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/u;

/**
 * @typedef {{ id: string, name: string, launch: string, run: string, resume: string, acp?: string, install?: string }} Agent
 */

export class AgentSettings {
	#found = null;

	/** @param {string} settingsFile the Studio's settings (.studio-settings.json) */
	constructor(settingsFile, { env = process.env, shell = process.env.SHELL || '/bin/zsh' } = {}) {
		this.settingsFile = settingsFile;
		this.env = env;
		this.shell = shell;
	}

	#read() {
		return readSettings(this.settingsFile);
	}

	/** @returns {Promise<{ list: Agent[], default: string }>} */
	async config() {
		const saved = (await this.#read()).agents ?? {};
		const list = Array.isArray(saved.list) && saved.list.length ? saved.list.filter(valid).map(withAdapter) : AGENT_PRESETS.map((agent) => ({ ...agent }));
		const chosen = list.some((agent) => agent.id === saved.default) ? saved.default : list[0]?.id ?? '';
		return { list: this.#standIns(list), default: chosen };
	}

	/** The list, each saying whether this machine has its program (the first word of `launch`). */
	async shown() {
		const { list, default: chosen } = await this.config();
		const found = await this.#installed(list.map((agent) => commandWords(agent.launch)[0]));
		return { agents: list.map((agent) => ({ ...agent, installed: found.has(commandWords(agent.launch)[0]) })), default: chosen, presets: AGENT_PRESETS };
	}

	/** Saves the list and the one Alt+Enter uses. */
	async set(change) {
		const fail = (message) => Object.assign(new Error(message), { statusCode: 400 });
		if (!change || !Array.isArray(change.list) || !change.list.length) throw fail('至少要有一个 AI');
		const ids = new Set();
		for (const agent of change.list) {
			if (!valid(agent)) throw fail(`「${agent?.name ?? ''}」没写全：名字、代号（小写英文）、三条命令都要有，后台命令里要有 {prompt}`);
			if (ids.has(agent.id)) throw fail(`代号「${agent.id}」重复了`);
			ids.add(agent.id);
		}
		if (!ids.has(change.default)) throw fail('默认的 AI 不在列表里');
		const agents = { list: change.list.map(({ id, name, launch, run, resume, acp, install }) => ({ id, name, launch, run, resume, ...(acp ? { acp } : {}), ...(install ? { install } : {}) })), default: change.default };
		await updateSettings(this.settingsFile, (settings) => ({ ...settings, agents }));
		this.#found = null;
		return this.shown();
	}

	/**
	 * The words to run `agent` by itself, told `prompt`, going on from the last talk when `resume`.
	 * @returns {string[]}
	 */
	static words(agent, prompt, resume) {
		return commandWords(resume ? agent.resume : agent.run).map((word) => (word === '{prompt}' ? prompt : word));
	}

	/** Browser tests: the programs of STUDIO_TERMINAL_AGENT_DIR (stand-ins), by their full path. */
	#standIns(list) {
		const folder = this.env.STUDIO_TERMINAL_AGENT_DIR;
		if (!folder) return list;
		const local = (line) => line.replace(/^(\S+)/u, (word) => (word.startsWith(folder) ? word : join(folder, word)));
		return list.map((agent) => ({ ...agent, launch: local(agent.launch), run: local(agent.run), resume: local(agent.resume), ...(agent.acp ? { acp: local(agent.acp) } : {}) }));
	}

	/** Which of these programs a login shell finds (the terminal's PATH, longer than the server's when the Mac app started it). */
	async #installed(programs) {
		if (this.env.STUDIO_TERMINAL_AGENT_DIR) {
			const found = await Promise.all(programs.map((program) => access(program, constants.X_OK).then(() => program, () => null)));
			return new Set(found.filter(Boolean));
		}
		const wanted = [...new Set(programs)].filter((program) => /^[\w./+-]+$/u.test(program));
		const key = wanted.join(' ');
		if (!this.#found || this.#found.key !== key || Date.now() - this.#found.at > KEPT_FOR) {
			const found = await new Promise((resolve) => {
				execFile(loginShell(this.shell), ['-lc', 'for c in "$@"; do command -v "$c" >/dev/null 2>&1 && echo "found:$c"; done', 'studio', ...wanted], { env: this.env, timeout: 5000 }, (_error, stdout) => {
					resolve(new Set(String(stdout ?? '').split('\n').filter((line) => line.startsWith('found:')).map((line) => line.slice('found:'.length).trim())));
				});
			});
			this.#found = { key, at: Date.now(), found };
		}
		return this.#found.found;
	}
}

/** A saved agent of the presets' (saved before they had one) given their ACP adapter. */
function withAdapter(agent) {
	if (typeof agent.acp === 'string' && agent.acp.trim()) return agent;
	const preset = AGENT_PRESETS.find((candidate) => candidate.id === agent.id);
	return preset?.acp ? { ...agent, acp: preset.acp } : agent;
}

/** Whether `agent` is a whole one: an id, a name, its three commands, `{prompt}` in the two that run by themselves. */
function valid(agent) {
	if (!agent || typeof agent !== 'object' || !ID.test(agent.id ?? '') || typeof agent.name !== 'string' || !agent.name.trim()) return false;
	for (const key of ['launch', 'run', 'resume']) {
		if (typeof agent[key] !== 'string' || !agent[key].trim()) return false;
		try {
			const words = commandWords(agent[key]);
			if (key !== 'launch' && !words.includes('{prompt}')) return false;
		} catch {
			return false;
		}
	}
	if (agent.acp !== undefined) {
		try {
			if (typeof agent.acp !== 'string' || !commandWords(agent.acp).length) return false;
		} catch {
			return false;
		}
	}
	return true;
}
