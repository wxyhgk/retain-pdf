import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { markdownSection } from '../src/studio/ops/markdown-section.mjs';
import { withLinkAt } from '../src/studio/ops/page-link.mjs';
import { createStudioOps } from '../src/studio/ops/studio-ops.mjs';

// The pages' operations for an AI: the core (studio-ops.mjs), the command line (bin/studio.mjs) and the
// MCP server (bin/studio-mcp.mjs), on a blog of their own.

const root = fileURLToPath(new URL('..', import.meta.url));

type Ops = ReturnType<typeof createStudioOps>;
/** What read_page gives, whichever way it is asked (whole, a part, the outline, a section). */
type PageRead = { source: string; length: number; from: number; next?: number; nextHeading?: string | null; outline: Array<{ depth: number; title: string }> };
const readPage = (ops: Ops, args: Parameters<Ops['readPage']>[0]) => ops.readPage(args) as Promise<unknown> as Promise<PageRead>;

function temporaryBlog(t: { after: (fn: () => void) => void }): string {
	const blog = mkdtempSync(join(tmpdir(), 'studio-ops-'));
	// Notes of their own too (apps/, settings…): never the author's, which this folder's .studio-local.json may name.
	const notes = mkdtempSync(join(tmpdir(), 'studio-ops-notes-'));
	process.env.STUDIO_BLOG_DIR = blog;
	process.env.STUDIO_NOTES_DIR = notes;
	t.after(() => {
		rmSync(blog, { recursive: true, force: true });
		rmSync(notes, { recursive: true, force: true });
		delete process.env.STUDIO_BLOG_DIR;
		delete process.env.STUDIO_NOTES_DIR;
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
	const projectSource = (await readPage(ops, { slug: project.slug })).source;
	assert.match(projectSource, new RegExp(`\\[计算方法\\]\\(/blog/${split.slug}/\\)\\n\\n## 结果`, 'u'));
	assert.match((await readPage(ops, { slug: split.slug })).source, /先算一遍。\n$/u);
	// Kept before each change: the link to 杂记 put in it, then the section split off.
	assert.equal((await ops.listHistory({ slug: project.slug })).length, 2, 'the text before kept');

	await ops.movePage({ slug: split.slug, parent: project.slug, before: notes.slug });
	assert.deepEqual((await ops.pageTree())[0].children.map((child: { title: string }) => child.title), ['计算方法', '杂记']);

	await ops.updatePage({ slug: split.slug, title: 'Computational Methods', description: '怎么算的' });
	const published = await ops.publishPage({ slug: split.slug });
	assert.equal(published.slug, 'computational-methods');
	// The link to it in the page above follows it: its new address, and its new title (its words were its title).
	assert.match((await readPage(ops, { slug: project.slug })).source, /\[Computational Methods\]\(\/blog\/computational-methods\/\)/u);

	await ops.mergePage({ slug: 'computational-methods' });
	assert.match((await readPage(ops, { slug: project.slug })).source, /## Computational Methods\n\n先算一遍。/u);

	const { trashed } = await ops.deletePage({ slug: project.slug });
	assert.equal(trashed.length, 2, 'with the page under it');
	assert.equal((await ops.listPages()).length, 0);
	for (const entry of [...trashed].reverse()) await ops.restorePage({ trashed: entry });
	assert.equal((await ops.listPages()).length, 2);
	assert.ok(readFileSync(join(blog, project.slug, 'index.md'), 'utf8'));
});

test('a long page read in parts, by its outline, or a section; pages listed by what they are; a check that says it passed', async (t) => {
	temporaryBlog(t);
	const ops = createStudioOps({ root });
	const paragraph = `${'很长的一段。'.repeat(500)}\n\n`;
	const body = ['## 一、引言', paragraph.repeat(8), '## 二、方法', paragraph.repeat(8), '### 细节', '一小节。', '## 三、结果', '完。'].join('\n\n');
	const long = await ops.createPage({ title: '长文', body });
	const short = await ops.createPage({ title: '短文', body: '短。', parent: long.slug });

	// A short one, whole, as before.
	const whole = await readPage(ops, { slug: short.slug });
	assert.match(whole.source, /短。/u);
	assert.equal(whole.next, undefined);
	// A long one: a part, where the next begins, the heading after it.
	const first = await readPage(ops, { slug: long.slug });
	assert.ok(first.source.length <= 40_000 && first.length > 40_000);
	assert.ok(first.source.endsWith('\n'), 'cut at a line’s end');
	assert.equal(typeof first.next, 'number');
	assert.equal(first.nextHeading, '细节');
	const second = await readPage(ops, { slug: long.slug, offset: first.next });
	assert.equal(second.from, first.next);
	// Its outline; a section.
	const { outline } = await readPage(ops, { slug: long.slug, outline: true });
	assert.deepEqual(outline.map((entry: { depth: number; title: string }) => `${entry.depth} ${entry.title}`), ['2 一、引言', '2 二、方法', '3 细节', '2 三、结果']);
	const section = await readPage(ops, { slug: long.slug, heading: '三、结果' });
	assert.match(section.source, /^## 三、结果\n\n完。/u);
	assert.equal(section.nextHeading, null);
	await assert.rejects(readPage(ops, { slug: long.slug, heading: '没有这节' }), /没有标题「没有这节」/u);

	// Listed by where they are, and whether drafts.
	assert.deepEqual((await ops.listPages({ parent: long.slug })).map((page: { slug: string }) => page.slug), [short.slug]);
	assert.deepEqual((await ops.listPages({ parent: '' })).map((page: { slug: string }) => page.slug), [long.slug]);
	assert.equal((await ops.listPages({ draft: false })).length, 0);

	// A check that found nothing says it passed.
	const checked = await ops.checkPage({ slug: short.slug });
	assert.equal(checked.ok, true);
	assert.deepEqual(checked.issues, []);
	// One page's git state (the blog here is in no repository).
	assert.deepEqual(Object.keys(await ops.gitStatus({ slug: short.slug })).sort(), ['available', 'slug', 'state']);
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

test('the author’s apps for an AI: listed from their folders; how one is now, asked of the Studio running', async (t) => {
	const project = mkdtempSync(join(tmpdir(), 'studio-ops-apps-'));
	const code = mkdtempSync(join(tmpdir(), 'studio-ops-code-'));
	temporaryBlog(t);
	// The author's apps in their notes; the Studio's own in its code.
	process.env.STUDIO_NOTES_DIR = project;
	t.after(() => {
		rmSync(project, { recursive: true, force: true });
		rmSync(code, { recursive: true, force: true });
		delete process.env.STUDIO_URL;
	});
	const { mkdirSync, writeFileSync } = await import('node:fs');
	mkdirSync(join(project, 'apps', 'mol'), { recursive: true });
	writeFileSync(join(project, 'apps', 'mol', 'app.json'), JSON.stringify({ name: '分子', dev: { command: ['npm', 'run', 'dev'] }, blocks: [{ fence: 'molblock' }] }));
	mkdirSync(join(project, 'apps', 'units'));
	writeFileSync(join(project, 'apps', 'units', 'app.json'), JSON.stringify({ name: '换算' }));
	mkdirSync(join(code, 'apps', 'library'), { recursive: true });
	writeFileSync(join(code, 'apps', 'library', 'app.json'), JSON.stringify({ name: '代码库' }));
	const ops = createStudioOps({ root: code });
	// By name, as the Studio lists them.
	assert.deepEqual(await ops.listApps(), [
		{ id: 'library', name: '代码库', description: '', kind: 'page', folder: join(code, 'apps', 'library'), blocks: [] },
		{ id: 'mol', name: '分子', description: '', kind: 'project', folder: 'apps/mol', code: 'apps/mol', blocks: ['molblock'] },
		{ id: 'units', name: '换算', description: '', kind: 'page', folder: 'apps/units', blocks: [] },
	]);

	// The Studio's answer (a stand-in here), the last of its output.
	const { createServer } = await import('node:http');
	const studio = createServer((request, response) => {
		response.setHeader('content-type', 'application/json');
		if (request.url !== '/api/studio/apps/mol/status') return response.writeHead(404).end(JSON.stringify({ error: '没有这个小程序' }));
		response.end(JSON.stringify({ state: 'running', port: 5555, error: null, log: Array.from({ length: 100 }, (_, n) => `line ${n}`).join('\n'), errors: [{ when: 'now', message: 'TypeError: x is undefined' }] }));
	});
	await new Promise<void>((resolve) => studio.listen(0, '127.0.0.1', resolve));
	t.after(() => studio.close());
	process.env.STUDIO_URL = `http://127.0.0.1:${(studio.address() as { port: number }).port}`;
	const status = (await ops.appStatus({ id: 'mol' })) as { state: string; errors: Array<{ message: string }>; log: string };
	assert.equal(status.state, 'running');
	assert.equal(status.errors[0]!.message, 'TypeError: x is undefined');
	assert.equal(status.log.split('\n').length, 60);
	await assert.rejects(ops.appStatus({ id: 'nothing' }), /没有这个小程序/u);
});

test('代码仓库 for an AI: one of this machine found and added, one made, listed as the Studio lists them, one taken off', async (t) => {
	const blog = temporaryBlog(t);
	const { mkdirSync, writeFileSync } = await import('node:fs');
	const home = `${blog}-home`;
	t.after(() => {
		rmSync(home, { recursive: true, force: true });
		rmSync(`${blog}-repos`, { recursive: true, force: true });
	});
	const resume = join(home, 'Code', 'resume');
	mkdirSync(join(resume, 'src'), { recursive: true });
	writeFileSync(join(resume, 'README.md'), '# resume\n\n我的简历，LaTeX 写的。\n');
	const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
	execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: resume, env });
	execFileSync('git', ['add', '.'], { cwd: resume, env });
	execFileSync('git', ['commit', '-q', '-m', '简历'], { cwd: resume, env });
	const ops = createStudioOps({ root });

	const { found } = (await ops.addRepo({ found: true })) as { found: Array<{ path: string; name: string }> };
	assert.deepEqual(found.map((each) => each.name), ['resume']);
	await assert.rejects(ops.addRepo({}), /要给出仓库的路径/u);
	await assert.rejects(ops.addRepo({ path: home }), /不是 git 仓库/u);
	const { added } = (await ops.addRepo({ path: join(resume, 'src') })) as { added: { id: string; name: string; description: string } };
	assert.deepEqual({ name: added.name, description: added.description }, { name: 'resume', description: '我的简历，LaTeX 写的。' });

	const { created } = (await ops.createRepo({ name: 'ts-search', description: '找过渡态' })) as { created: { id: string; own: boolean } };
	assert.equal(created.own, true);
	const listed = (await ops.listRepos()) as Array<{ name: string }>;
	assert.deepEqual(listed.map((each) => each.name).sort(), ['resume', 'ts-search']);

	assert.deepEqual(await ops.removeRepo({ id: added.id }), { removed: true });
	await assert.rejects(ops.removeRepo({ id: created.id }), /不在这里删/u);
	assert.deepEqual(((await ops.listRepos()) as Array<{ name: string }>).map((each) => each.name), ['ts-search']);
	// The command line has them too.
	assert.match(execFileSync('node', [join(root, 'bin/studio.mjs'), 'help'], { env: { ...process.env, STUDIO_BLOG_DIR: blog } }).toString(), /add-repo/u);
});

test('a database made and its rows changed through the operations: create_database, create_page and update_page with props', async (t) => {
	const blog = temporaryBlog(t);
	const ops = createStudioOps(root);
	const { slug: project } = await ops.createPage({ title: '项目' });
	// A database of its own, shown at the end of the page it is under.
	const { slug: table, columns } = await ops.createDatabase({ title: '计算记录', parent: project, columns: [{ name: '方法', type: 'select' }, { name: '能量', type: 'number' }, { name: '收敛', type: 'checkbox' }] });
	assert.deepEqual(columns.map((column: { name: string }) => column.name), ['方法', '能量', '收敛']);
	assert.match(readFileSync(join(blog, table, 'index.md'), 'utf8'), /^type: database$/mu);
	assert.ok(readFileSync(join(blog, project, 'index.md'), 'utf8').includes(`\`\`\`database\n{"source":"${table}"}\n\`\`\``));
	assert.equal(((await ops.listPages({ parent: project })) as Array<{ slug: string; type?: string }>).find((page) => page.slug === table)?.type, 'database');
	const made = await ops.createPage({ title: 'H2O', parent: table, props: { 方法: 'B3LYP', 能量: -76.41, 收敛: true, 备注: '' } });
	const row = made.slug;
	const written = () => readFileSync(join(blog, row, 'index.md'), 'utf8');
	assert.doesNotMatch(written(), /^database:/mu);
	assert.match(written(), /^props: \{ "方法": "B3LYP", "能量": -76\.41, "收敛": true \}$/mu);
	// Values only for a row: the page above a database.
	await assert.rejects(ops.createPage({ title: 'x', parent: project, props: { 方法: 'PBE0' } }), /只有数据库的行有 props/u);
	// Not shown anywhere: a full-page database, from the command line too.
	const quiet = JSON.parse(execFileSync(process.execPath, [join(root, 'bin', 'studio.mjs'), 'create-database', '--title', '文献', '--parent', project, '--show', 'false', '--columns', '[{"name": "年份", "type": "number"}]'], { env: process.env, encoding: 'utf8' }));
	assert.doesNotMatch(readFileSync(join(blog, project, 'index.md'), 'utf8'), new RegExp(quiet.slug, 'u'));
	assert.deepEqual(quiet.columns, [{ name: '年份', type: 'number' }]);
	// Only those given changed; null takes one away; the rest of the page as it was.
	await ops.updatePage({ slug: row, props: { 能量: -76.42, 收敛: null } });
	assert.match(written(), /^props: \{ "方法": "B3LYP", "能量": -76\.42 \}$/mu);
	await ops.updatePage({ slug: row, props: { 方法: null, 能量: null } });
	assert.doesNotMatch(written(), /props:/u);
	await assert.rejects(ops.updatePage({ slug: row, props: ['B3LYP'] as unknown as Record<string, unknown> }), /props 要写成/u);
	// On the command line, as JSON.
	execFileSync(process.execPath, [join(root, 'bin', 'studio.mjs'), 'update-page', '--slug', row, '--props', '{"方法": "PBE0"}'], { env: process.env, encoding: 'utf8' });
	assert.match(written(), /^props: \{ "方法": "PBE0" \}$/mu);
});

test('a page’s link put in the page above: at its end, at the end of a heading’s section, after a sentence’s paragraph', () => {
	const body = '\n开头一段。\n\n## 计算方法\n\n用 B3LYP。\n\n### 基组\n\ndef2-SVP。\n\n```md\n## 不是标题\n```\n\n## 结果\n\n能量 -76.4。\n';
	const link = '[基组的选择](/blog/basis/)';
	assert.equal(withLinkAt(body, link), `${body}\n${link}\n`);
	// The section's end: past its subsections and a fenced "##" (no heading), before the next heading of its level.
	assert.equal(withLinkAt(body, link, '## 计算方法'), '\n开头一段。\n\n## 计算方法\n\n用 B3LYP。\n\n### 基组\n\ndef2-SVP。\n\n```md\n## 不是标题\n```\n\n[基组的选择](/blog/basis/)\n\n## 结果\n\n能量 -76.4。\n');
	assert.equal(withLinkAt(body, link, '基组'), '\n开头一段。\n\n## 计算方法\n\n用 B3LYP。\n\n### 基组\n\ndef2-SVP。\n\n```md\n## 不是标题\n```\n\n[基组的选择](/blog/basis/)\n\n## 结果\n\n能量 -76.4。\n');
	// After a sentence: the end of its paragraph.
	assert.equal(withLinkAt(body, link, '用 B3LYP'), '\n开头一段。\n\n## 计算方法\n\n用 B3LYP。\n\n[基组的选择](/blog/basis/)\n\n### 基组\n\ndef2-SVP。\n\n```md\n## 不是标题\n```\n\n## 结果\n\n能量 -76.4。\n');
	assert.throws(() => withLinkAt(body, link, '没有这句'), /没有「没有这句」/u);
	assert.equal(withLinkAt('\n', link), `\n${link}\n`);
});

test('a page made under another is linked from it (where asked); a database’s row is not; edit_page changes a passage of the text only', async (t) => {
	const blog = temporaryBlog(t);
	const ops = createStudioOps(root);
	const page = (slug: string) => readFileSync(join(blog, slug, 'index.md'), 'utf8');
	const { slug: project } = await ops.createPage({ title: '项目', body: '## 方法\n\n用 B3LYP。\n\n## 结果\n\n能量 -76.4。' });
	const { slug: basis, linked } = await ops.createPage({ title: '基组的选择', parent: project, link_after: '方法' });
	assert.equal(linked, true);
	assert.match(page(project), new RegExp(`用 B3LYP。\\n\\n\\[基组的选择\\]\\(/blog/${basis}/\\)\\n\\n## 结果`, 'u'));
	const { slug: end } = await ops.createPage({ title: '附录', parent: project });
	assert.ok(page(project).trimEnd().endsWith(`[附录](/blog/${end}/)`));
	await ops.createPage({ title: '不链', parent: project, link: false });
	assert.doesNotMatch(page(project), /不链/u);
	// Words not in the page above: nothing made.
	const before = (await ops.listPages({ parent: project })).length;
	await assert.rejects(ops.createPage({ title: 'x', parent: project, link_after: '没有这句' }), /link_after/u);
	assert.equal((await ops.listPages({ parent: project })).length, before);
	const { slug: table } = await ops.createDatabase({ title: '记录', parent: project, show: false });
	await ops.createPage({ title: '一行', parent: table, props: {} });
	assert.doesNotMatch(page(table), /一行/u);

	// A passage changed, once; the properties as they were; what was there kept.
	const properties = page(project).split('---')[1];
	const edited = await ops.editPage({ slug: project, old: '能量 -76.4。', new: '能量 -76.41 Hartree。' });
	assert.equal(edited.changed, 1);
	assert.ok(edited.line > 1);
	assert.match(page(project), /能量 -76\.41 Hartree。/u);
	assert.equal(page(project).split('---')[1], properties);
	assert.ok(((await ops.listHistory({ slug: project })) as unknown[]).length >= 1);
	await assert.rejects(ops.editPage({ slug: project, old: '没有这段', new: 'x' }), /正文里没有这段/u);
	await assert.rejects(ops.editPage({ slug: project, old: '## ', new: '### ' }), /有 2 处/u);
	assert.equal((await ops.editPage({ slug: project, old: '## ', new: '### ', all: true })).changed, 2);
	// Its properties are not its text: not found there.
	await assert.rejects(ops.editPage({ slug: project, old: 'title:', new: 'x' }), /正文里没有这段/u);
	// From the command line, the new text empty: taken away.
	execFileSync(process.execPath, [join(root, 'bin', 'studio.mjs'), 'edit-page', '--slug', project, '--old', '用 B3LYP。', '--new', ''], { env: process.env, encoding: 'utf8' });
	assert.doesNotMatch(page(project), /用 B3LYP/u);
});

