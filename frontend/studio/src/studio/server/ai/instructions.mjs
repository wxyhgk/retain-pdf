import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { AgentSettings } from './agent-settings.mjs';
import { runProgram } from '../tasks/tasks.mjs';

/**
 * Alt+Enter: a line of an article that says, in words, what is wanted ("画一个
 * sin x 的图") is done by an AI (the one chosen in AI 设置), by itself, in the
 * article's folder, as a task. It is told where the line is, not given the
 * article: it reads what it needs (a long one is a book), and the article's
 * work log (`ai/work/log.md`, what was done in it before, by whichever AI).
 * It goes on from the last talk in that folder, unless told to start anew
 * (`fresh`). What it changes in index.md comes back to the Studio as a change
 * on disk, to accept or reject where it is (blog/AGENTS.md says so too).
 */

/**
 * What the AI is told.
 * @param {{ text: string, start: number, end: number, heading: string }} line
 */
export function instructionPrompt({ text, start, end, heading }) {
	const where = start === end ? `第 ${start} 行` : `第 ${start}–${end} 行`;
	return [
		`作者在这篇文章的 index.md ${where}${heading ? `（「${heading}」这一节）` : ''}写了一件要你做的事，原文是：`,
		'',
		text.trim(),
		'',
		'请：',
		'1. 做这件事。要更多上下文，就读 index.md 里相关的部分和 ai/work/log.md（这篇文章里以前做过的事），不要整篇通读。',
		`2. 把 index.md ${where}换成结果，按 AGENTS.md 和技能里的写法；只改这几行，别的不动。作者会在 Studio 里逐处审阅。`,
		'3. 写的脚本和数据放进 ai/work/，在 ai/work/log.md 末尾加一行：日期、要做的事、产出了哪些文件。',
		'做不了的话，把原因写在回答里，不要改文件。',
	].join('\n');
}

/**
 * How long a line may be: it goes to the AI as a word of its command, and a word has a limit (128 KB on Linux;
 * Chinese takes three bytes a character).
 */
export const MAX_INSTRUCTION = 30_000;

/** Per article folder, the end of its queue of AI runs: two at once would both change index.md. */
const queues = new Map();

/**
 * Starts the AI on a line of an article, as a task of `tasks`. A run already going in the article is waited
 * for first (the task says so, and can be cancelled while it waits). It goes on from the last talk only when
 * there was one here before (the work log is there): a first `resume` may find nothing to resume.
 * @param {{ tasks: import('../tasks/tasks.mjs').Tasks, agents: AgentSettings, slug: string, folder: string, env: Record<string, string>, line: { text: string, start: number, end: number, heading: string }, fresh?: boolean, agentId?: string }} options
 */
export async function startInstruction({ tasks, agents, slug, folder, env, line, fresh = false, agentId }) {
	const fail = (message) => Object.assign(new Error(message), { statusCode: 400 });
	if (!line?.text?.trim()) throw fail('这一行是空的，没有要做的事');
	if (!Number.isInteger(line.start) || !Number.isInteger(line.end) || line.start < 1 || line.end < line.start) throw fail('行号不对');
	if (line.text.length > MAX_INSTRUCTION) throw fail(`要做的事太长（${line.text.length} 字，最多 ${MAX_INSTRUCTION} 字）：把材料放进文件，这一行只写要做什么、用哪个文件`);
	const { list, default: chosen } = await agents.config();
	const agent = list.find((candidate) => candidate.id === (agentId ?? chosen));
	if (!agent) throw fail('AI 设置里没有这个 AI');
	const title = line.text.trim().replace(/\s+/gu, ' ').slice(0, 60);
	const before = queues.get(folder);
	let done;
	const turn = new Promise((resolve) => (done = resolve));
	queues.set(folder, turn);
	const task = tasks.start({ kind: 'instruction', title: `${agent.name}：${title}`, slug }, async ({ log, signal }) => {
		try {
			if (before) {
				log('这篇文章里还有一件事在做，等它做完…\n');
				await Promise.race([before, new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))]);
				if (signal.aborted) throw new Error('已取消');
			}
			const resume = !fresh && existsSync(join(folder, 'ai', 'work', 'log.md'));
			await runProgram(AgentSettings.words(agent, instructionPrompt(line), resume), { cwd: folder, env, log, signal });
			return { agent: agent.id, start: line.start, end: line.end };
		} finally {
			done();
			if (queues.get(folder) === turn) queues.delete(folder);
		}
	});
	return task;
}
