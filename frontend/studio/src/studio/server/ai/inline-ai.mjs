import { t } from '@blog/i18n/index.mjs';

/**
 * The AI in the editor (选中文字 → AI 改写, 空行按空格): one thing asked at a time of the AI chosen in the panel, in a
 * session of its own, kept ready (an agent takes seconds to start), let go once it has answered and another made
 * ready. What it is asked is to give back Markdown and nothing else: the text that goes in place of the blocks
 * selected, or that goes where the caret is; the page shows it as a change to accept or reject where it goes.
 */

/** Lines of the article around what is asked about, given to the AI for what comes before and after. */
const AROUND = 60;

export class InlineAi {
	/** @type {Map<string, Promise<any>>} a session ready, per AI */
	#ready = new Map();
	/** @type {Map<string, any>} what is being asked, by the page's id for it */
	#asking = new Map();

	/**
	 * @param {{ sessions: import('./agent-sessions.mjs').AgentSessions, cwd: string, start: (agentId: string) => Promise<{ agent: any, env: Record<string, string>, models: any }> }} options
	 * `start`: what a session of that AI is started with (the service chosen for it in the panel)
	 */
	constructor({ sessions, cwd, start }) {
		this.sessions = sessions;
		this.cwd = cwd;
		this.start = start;
	}

	/** A session of `agentId` made ready, if none is (the author is about to ask). */
	warm(agentId) {
		if (!this.#ready.has(agentId)) {
			const made = this.start(agentId).then(({ agent, env, models }) => this.sessions.start({ agent, cwd: this.cwd, env, models, listed: false }));
			// One that failed to start is forgotten, so the next ask tries again (and says why).
			made.catch(() => this.#ready.get(agentId) === made && this.#ready.delete(agentId));
			this.#ready.set(agentId, made);
		}
		return this.#ready.get(agentId);
	}

	/**
	 * Asks: `mode` rewrite (the blocks `selected` rewritten) or write (something put where `before` ends and `after`
	 * begins), as `instruction` says. Resolves with the Markdown that goes there.
	 * @param {{ id: string, agent: string, options?: Record<string, string>, mode: 'rewrite' | 'write', instruction: string, article: { title: string, path: string }, selected?: string, before?: string, after?: string }} asked
	 */
	async ask(asked) {
		const session = await this.warm(asked.agent);
		this.#ready.delete(asked.agent);
		this.#asking.set(asked.id, session);
		try {
			for (const [configId, value] of Object.entries(asked.options ?? {})) {
				const option = session.configOptions.find((entry) => entry.id === configId);
				const choices = (option?.options ?? []).flatMap((entry) => (Array.isArray(entry.options) ? entry.options : [entry]));
				if (option && option.currentValue !== value && choices.some((choice) => choice.value === value)) await session.configure(configId, value).catch(() => {});
			}
			const done = new Promise((resolve) => {
				let began = false;
				const stop = session.subscribe((event) => {
					// It was told to use no tool: what it asks leave for is refused.
					if (event.type === 'item' && event.item.kind === 'permission' && !event.item.chosen) session.answer(event.item.id, null);
					if (session.state === 'running') began = true;
					else if (began) {
						stop();
						resolve();
					}
				});
			});
			session.prompt(promptFor(asked));
			await done;
			const said = session.items.slice(session.items.findIndex((item) => item.kind === 'user') + 1);
			const failed = said.find((item) => item.kind === 'error' || item.kind === 'stop');
			if (failed) throw Object.assign(new Error(failed.kind === 'stop' ? t('已停止') : failed.message), { statusCode: failed.kind === 'stop' ? 409 : 502 });
			const text = unfenced(said.filter((item) => item.kind === 'message').map((item) => item.text).join('\n\n'));
			if (!text.trim()) throw Object.assign(new Error(t('AI 没有给出内容')), { statusCode: 502 });
			return { markdown: text };
		} finally {
			this.#asking.delete(asked.id);
			session.close();
			// The next one made ready meanwhile.
			void this.warm(asked.agent).catch(() => {});
		}
	}

	/** Stops what is asked under `id`. */
	cancel(id) {
		this.#asking.get(id)?.cancel();
	}
}

/** What the AI is told: the article, what is asked about and what is around it, and to give back Markdown only. */
export function promptFor({ mode, instruction, article, selected = '', before = '', after = '' }) {
	const fence = (text) => {
		const ticks = '`'.repeat(Math.max(4, ...[...text.matchAll(/`+/gu)].map((run) => run[0].length + 1)));
		return `${ticks}markdown\n${text}\n${ticks}`;
	};
	const tail = (text, lines) => text.split('\n').slice(-lines).join('\n').trim();
	const head = (text, lines) => text.split('\n').slice(0, lines).join('\n').trim();
	const parts = [`你在帮作者改一篇 Markdown 笔记（博客「计算化学手记」，写法见 blog/AGENTS.md）：《${article.title}》，文件 ${article.path}。`]; // i18n-ignore: for the AI
	if (before.trim()) parts.push(`前文（最后 ${AROUND} 行以内）：`, fence(tail(before, AROUND))); // i18n-ignore: for the AI
	if (mode === 'rewrite') parts.push('要改的是这一段：', fence(selected.trim())); // i18n-ignore: for the AI
	else parts.push('要在这里（前文和后文之间）写新的内容。'); // i18n-ignore: for the AI
	if (after.trim()) parts.push(`后文（开头 ${AROUND} 行以内）：`, fence(head(after, AROUND))); // i18n-ignore: for the AI
	parts.push(`要求：${instruction.trim()}`); // i18n-ignore: for the AI
	parts.push(
		mode === 'rewrite'
			? '只输出改好的这一段 Markdown，它会原样换掉上面那段：不要解释，不要在外面加代码围栏，不要读写文件、不要运行命令。公式、化学式、链接、图片、文献引用、代码块等写法要保持有效。' // i18n-ignore: for the AI
			: '只输出要放进去的 Markdown，它会原样放在前文和后文之间：不要解释，不要在外面加代码围栏，不要读写文件、不要运行命令。公式、化学式、链接、图片、文献引用、代码块等按这篇的写法写。', // i18n-ignore: for the AI
	);
	return parts.join('\n\n');
}

/** A whole answer in one fence of Markdown: what is in it. */
function unfenced(text) {
	const found = /^\s*(`{3,}|~{3,})(?:markdown|md)?\s*\n([\s\S]*?)\n\1\s*$/u.exec(text);
	return (found ? found[2] : text).trim();
}
