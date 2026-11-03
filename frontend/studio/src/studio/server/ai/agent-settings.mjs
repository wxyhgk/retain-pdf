import { join } from 'node:path';

import { commandWords } from '../tasks/tasks.mjs';
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The AIs the AI panel talks to, over the Agent Client Protocol (agent-sessions.mjs), each by its adapter (`acp`, in
 * the project's dependencies for these three): pi first, the one the Studio is made around (its subagents, words said
 * in between, its tools); Claude Code and Codex under 设置 › AI › 高级, in the panel only once turned on there.
 *
 * Kept in the Studio's settings (out of git) as `agents.on`: the ids of those of 高级 turned on. Not said yet: those
 * a conversation kept in chats/ was had with (`used`), as the author had them before. Settings saved before (when the
 * AIs were also started in the terminal and by Alt+Enter) are read as far as they still mean anything: an AI the author
 * added with an adapter of its own is listed after these; its other command lines are let be.
 */

export const AGENT_PRESETS = Object.freeze([
	{ id: 'pi', name: 'pi', acp: 'pi-acp' },
	{ id: 'claude', name: 'Claude', acp: 'claude-agent-acp', install: 'npm install -g @anthropic-ai/claude-code' },
	{ id: 'codex', name: 'Codex', acp: 'codex-acp', install: 'npm install -g @openai/codex' },
]);

/** The AIs of 高级: off the panel till turned on. */
export const ADVANCED = Object.freeze(['claude', 'codex']);

const ID = /^[a-z0-9][a-z0-9-]{0,31}$/u;

/**
 * @typedef {{ id: string, name: string, acp: string, install?: string }} Agent
 */

export class AgentSettings {
	/**
	 * @param {string} settingsFile the Studio's settings (.studio-settings.json)
	 * @param {{ env?: NodeJS.ProcessEnv }} [options] `STUDIO_TERMINAL_AGENT_DIR`: the browser tests' stand-ins, by their full
	 *   path; `STUDIO_AGENTS_ON`: the AIs of 高级 on when the settings say nothing, the first the default (the tests talk
	 *   to the Claude stand-in first)
	 */
	constructor(settingsFile, { env = process.env } = {}) {
		this.settingsFile = settingsFile;
		this.env = env;
	}

	/**
	 * All the AIs (pi's, 高级's, any the author added), those listed in the panel (`listed`), which of 高级 are on, and
	 * the one a conversation is begun with when the author has chosen none.
	 * @param {() => Promise<string[]> | string[]} [used] the AIs of the conversations kept, for `on` when nothing is saved
	 * @returns {Promise<{ list: Agent[], listed: Agent[], on: string[], default: string }>}
	 */
	async config(used = () => []) {
		const saved = (await readSettings(this.settingsFile)).agents ?? {};
		const added = (Array.isArray(saved.list) ? saved.list : []).filter((agent) => valid(agent) && !AGENT_PRESETS.some((preset) => preset.id === agent.id));
		const list = this.#standIns([...AGENT_PRESETS, ...added.map(({ id, name, acp }) => ({ id, name, acp }))]);
		const testing = this.env.STUDIO_AGENTS_ON ? this.env.STUDIO_AGENTS_ON.split(',').map((id) => id.trim()) : null;
		const on = (Array.isArray(saved.on) ? saved.on : (testing ?? (await used()))).filter((id) => ADVANCED.includes(id));
		const listed = list.filter((agent) => !ADVANCED.includes(agent.id) || on.includes(agent.id));
		const first = testing?.find((id) => listed.some((agent) => agent.id === id));
		return { list, listed, on: [...new Set(on)], default: first ?? 'pi' };
	}

	/** 设置 › AI › 高级: the AIs of 高级, each whether it is on. */
	async shown(used) {
		const { list, on } = await this.config(used);
		return { agents: list.filter((agent) => ADVANCED.includes(agent.id)).map((agent) => ({ id: agent.id, name: agent.name, install: agent.install ?? '', on: on.includes(agent.id) })) };
	}

	/** Which of 高级 are on (the others off). */
	async set(change, used) {
		if (!change || !Array.isArray(change.on) || change.on.some((id) => !ADVANCED.includes(id))) throw Object.assign(new Error(t('只能打开或关掉 Claude、Codex')), { statusCode: 400 });
		await updateSettings(this.settingsFile, (settings) => ({ ...settings, agents: { ...(settings.agents ?? {}), on: [...new Set(change.on)] } }));
		return this.shown(used);
	}

	/** Browser tests: the adapters of STUDIO_TERMINAL_AGENT_DIR (stand-ins), by their full path. */
	#standIns(list) {
		const folder = this.env.STUDIO_TERMINAL_AGENT_DIR;
		if (!folder) return list;
		return list.map((agent) => ({ ...agent, acp: agent.acp.replace(/^(\S+)/u, (word) => (word.startsWith(folder) ? word : join(folder, word))) }));
	}
}

/** Whether `agent`, as saved, is one the panel can talk to: an id, a name, its adapter. */
function valid(agent) {
	if (!agent || typeof agent !== 'object' || !ID.test(agent.id ?? '') || typeof agent.name !== 'string' || !agent.name.trim() || typeof agent.acp !== 'string') return false;
	try {
		return commandWords(agent.acp).length > 0;
	} catch {
		return false;
	}
}
