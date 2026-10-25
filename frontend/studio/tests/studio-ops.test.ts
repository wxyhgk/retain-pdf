import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { markdownSection } from '../src/studio/ops/markdown-section.mjs';
import { createStudioOps } from '../src/studio/ops/studio-ops.mjs';

// The pages' operations for an AI: the core (studio-ops.mjs), the command line (bin/studio.mjs) and the
// MCP server (bin/studio-mcp.mjs), on a blog of their own.

const root = fileURLToPath(new URL('..', import.meta.url));

function temporaryBlog(t: { after: (fn: () => void) => void }): string {
	const blog = mkdtempSync(join(tmpdir(), 'studio-ops-'));
	process.env.STUDIO_BLOG_DIR = blog;
	t.after(() => {
		rmSync(blog, { recursive: true, force: true });
		delete process.env.STUDIO_BLOG_DIR;
	});
	return blog;
}

test('a heading’s section in Markdown runs to the next heading as high or higher, at the top level', () => {
	const body = '前言。\n\n## 方法\n\n甲。\n\n### 细节\n\n乙。\n\n- ## 列表里的\n\n## 结果\n\n丙。\n';
	const section = markdownSection(body, '方法')!;
	assert.equal(body.slice(section.from, section.to), '## 方法\n\n甲。\n\n### 细节\n\n乙。\n\n- ## 列表里的\n\n');
	assert.equal(section.text, '甲。\n\n### 细节\n\n乙。\n\n- ## 列表里的');
	assert.equal(markdownSection(body, '列表里的'), null);
	// A line in a formula is no heading.
	const formula = '## 推导\n\n$$\n# 不是标题\n$$\n\n## 下一节\n';
	assert.equal(markdownSection(formula, '推导')!.text, '$$\n# 不是标题\n$$');
	assert.equal(markdownSection(formula, '不是标题'), null);
});

test('pages made, moved, split, merged, published, deleted and brought back through the operations', async (t) => {
	const blog = temporaryBlog(t);
	const ops = createStudioOps({ root });
	const project = await ops.createPage({ title: '项目', body: '前言。\n\n## 计算方法\n\n先算一遍。\n\n## 结果\n\n结果。' });
	assert.match(project.slug, /^note-\d{8}-\d{6}$/u);
	const notes = await ops.createPage({ title: '杂记', parent: project.slug });
	assert.deepEqual((await ops.pageTree()).map((page) => [page.title, page.children.map((child: { title: string }) => child.title)]), [['项目', ['杂记']]]);

	const split = await ops.splitPage({ slug: project.slug, heading: '计算方法' });
	const projectSource = (await ops.readPage({ slug: project.slug })).source;
	assert.match(projectSource, new RegExp(`\\[计算方法\\]\\(/blog/${split.slug}/\\)\\n\\n## 结果`, 'u'));
	assert.match((await ops.readPage({ slug: split.slug })).source, /先算一遍。\n$/u);
	assert.equal((await ops.listHistory({ slug: project.slug })).length, 1, 'the text before kept');

	await ops.movePage({ slug: split.slug, parent: project.slug, before: notes.slug });
	assert.deepEqual((await ops.pageTree())[0].children.map((child: { title: string }) => child.title), ['计算方法', '杂记']);

	await ops.updatePage({ slug: split.slug, title: 'Computational Methods', description: '怎么算的' });
	const published = await ops.publishPage({ slug: split.slug });
	assert.equal(published.slug, 'computational-methods');
	// The link to it in the page above follows it: its new address, and its new title (its words were its title).
	assert.match((await ops.readPage({ slug: project.slug })).source, /\[Computational Methods\]\(\/blog\/computational-methods\/\)/u);

	await ops.mergePage({ slug: 'computational-methods' });
	assert.match((await ops.readPage({ slug: project.slug })).source, /## Computational Methods\n\n先算一遍。/u);

	const { trashed } = await ops.deletePage({ slug: project.slug });
	assert.equal(trashed.length, 2, 'with the page under it');
	assert.equal((await ops.listPages()).length, 0);
	for (const entry of [...trashed].reverse()) await ops.restorePage({ trashed: entry });
	assert.equal((await ops.listPages()).length, 2);
	assert.ok(readFileSync(join(blog, project.slug, 'index.md'), 'utf8'));
});

test('the command line: one operation per command, JSON out, its mistakes said on stderr', (t) => {
	temporaryBlog(t);
	const studio = (...args: string[]) => execFileSync(process.execPath, [join(root, 'bin/studio.mjs'), ...args], { env: process.env, encoding: 'utf8' });
	assert.match(studio('help'), /create-page/u);
	assert.match(studio('help', 'move-page'), /--before/u);
	const made = JSON.parse(studio('create-page', '--title', '新页', '--body', '-'));
	assert.match(made.slug, /^note-/u);
	assert.equal(JSON.parse(studio('list-pages'))[0].title, '新页');
	assert.throws(() => studio('move-page', '--slug', made.slug, '--parent', 'nowhere'), (error: { stderr: string }) => /上级页面不存在/u.test(error.stderr));
	assert.throws(() => studio('read-page'), (error: { stderr: string }) => /需要 --slug/u.test(error.stderr));
});

test('the MCP server: initialize, the tools with their schemas, a call and its result', async (t) => {
	temporaryBlog(t);
	const server = spawn(process.execPath, [join(root, 'bin/studio-mcp.mjs')], { env: process.env });
	t.after(() => server.kill());
	const answers: Array<{ id: number; result?: any; error?: any }> = [];
	let buffer = '';
	server.stdout.on('data', (chunk) => {
		buffer += chunk;
		for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
			answers.push(JSON.parse(buffer.slice(0, at)));
			buffer = buffer.slice(at + 1);
		}
	});
	const ask = async (id: number, method: string, params?: unknown) => {
		server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
		for (let waited = 0; waited < 5000; waited += 20) {
			const answer = answers.find((entry) => entry.id === id);
			if (answer) return answer;
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		throw new Error(`no answer to ${method}`);
	};
	const init = await ask(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
	assert.equal(init.result.protocolVersion, '2025-06-18');
	server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
	const tools = (await ask(2, 'tools/list')).result.tools;
	const create = tools.find((tool: { name: string }) => tool.name === 'create_page');
	assert.deepEqual(create.inputSchema.required, ['title']);
	const made = (await ask(3, 'tools/call', { name: 'create_page', arguments: { title: '从 MCP 建的' } })).result;
	assert.equal(made.isError, false);
	assert.match(made.structuredContent.slug, /^note-/u);
	const wrong = (await ask(4, 'tools/call', { name: 'read_page', arguments: {} })).result;
	assert.equal(wrong.isError, true);
	assert.equal((await ask(5, 'no/such')).error.code, -32601);
});
