import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { AgentSessions } from './agent-sessions.mjs';
import { InlineAi, promptFor } from './inline-ai.mjs';

const standIn = fileURLToPath(new URL('../../../tests/e2e/fake-agents/claude-agent-acp', import.meta.url));
const article = { title: '方法', path: 'method/index.md' };

test('what the AI in the editor is told: the article, what is around, what to change, and to give back Markdown alone', () => {
	const told = promptFor({ mode: 'rewrite', instruction: '改得更简洁', article, before: '## 引言\n前一段。', selected: '要改的 `一段`。', after: '后一段。' });
	assert.match(told, /《方法》，文件 method\/index\.md/u);
	assert.match(told, /前文（最后 60 行以内）：\n\n````markdown\n## 引言\n前一段。\n````/u);
	assert.match(told, /要改的是这一段：\n\n````markdown\n要改的 `一段`。\n````/u);
	assert.match(told, /要求：改得更简洁/u);
	assert.match(told, /只输出改好的这一段 Markdown/u);
	assert.match(promptFor({ mode: 'write', instruction: '写一句', article, before: 'a', after: 'b' }), /要在这里（前文和后文之间）写新的内容。[\s\S]*只输出要放进去的 Markdown/u);
});

test('asked, it answers with the Markdown alone, in a session of its own, another made ready after', async (t) => {
	const cwd = await mkdtemp(join(tmpdir(), 'inline-ai-'));
	const sessions = new AgentSessions({ binFolder: join(cwd, 'none'), env: process.env });
	t.after(async () => {
		sessions.closeAll();
		await rm(cwd, { recursive: true, force: true });
	});
	let started = 0;
	const inline = new InlineAi({
		sessions,
		cwd,
		start: async () => (started++, { agent: { id: 'claude', name: 'Claude', acp: standIn }, env: { PATH: process.env.PATH }, models: null }),
	});
	const asked = { id: 'one', agent: 'claude', mode: 'rewrite', instruction: '改', article, selected: '旧的。', before: '', after: '' };
	assert.deepEqual(await inline.ask(asked), { markdown: '这是 AI 改写后的段落（第 1 次）。' });
	assert.deepEqual(await inline.ask({ ...asked, id: 'two', mode: 'write' }), { markdown: 'AI 写的新段落。' });
	// One for each ask, and one ready for the next; none of them the panel's conversations.
	assert.equal(started, 3);
	assert.deepEqual(await sessions.list(), []);
});
