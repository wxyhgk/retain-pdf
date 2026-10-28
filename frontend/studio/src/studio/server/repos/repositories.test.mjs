import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { Repositories } from './repositories.mjs';

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' } });

/** A project folder (where `repos/` goes), a home with one repository in ~/Code, and the settings file. */
async function place(t) {
	const root = await realpath(await mkdtemp(join(tmpdir(), 'repos-')));
	t.after(() => rm(root, { recursive: true, force: true }));
	const home = join(root, 'home');
	const project = join(root, 'project');
	const existing = join(home, 'Code', 'optimizer');
	await mkdir(join(existing, 'src', 'deep'), { recursive: true });
	await mkdir(project, { recursive: true });
	await writeFile(join(existing, 'README.md'), '# optimizer\n\n![logo](./docs/logo.png)\n\nGEDIIS 和 RFO 的**复现**，见 [说明](docs/notes.md)。\n\n[危险](javascript:alert(1)) [网站](https://example.com)\n');
	await mkdir(join(existing, 'docs'));
	await writeFile(join(existing, 'docs', 'logo.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
	await writeFile(join(existing, 'docs', 'notes.md'), '说明\n');
	await writeFile(join(existing, 'src', 'opt.py'), '# step\ndef rfo(g, H):\n    return -g\n');
	await writeFile(join(existing, 'src', 'deep', 'a.f90'), 'program a\nend program\n');
	await writeFile(join(existing, 'data.bin'), Buffer.from([0, 1, 2, 3]));
	await writeFile(join(existing, '.gitignore'), 'build/\n');
	await mkdir(join(existing, 'build'));
	await writeFile(join(existing, 'build', 'out.o'), 'x');
	git(existing, 'init', '-q', '-b', 'main');
	git(existing, 'add', '.');
	git(existing, 'commit', '-q', '-m', '第一次提交');
	// Not committed yet: a new file, a change.
	await writeFile(join(existing, 'src', 'new.py'), 'print(1)\n');
	await writeFile(join(existing, 'src', 'opt.py'), '# step\ndef rfo(g, H):\n    return -g * 2\n');
	const repositories = new Repositories({ ownRoot: join(project, 'repos'), settingsFile: join(project, '.studio-settings.json'), home });
	return { repositories, existing, project, home };
}

test('repositories on this machine found in the usual places, added, listed as GitHub lists them, taken off the list', async (t) => {
	const { repositories, existing } = await place(t);
	assert.deepEqual(await repositories.list(), []);
	const found = await repositories.discover();
	assert.deepEqual(found.map((each) => each.path), [existing]);

	await assert.rejects(repositories.add('Code/optimizer'), { statusCode: 400 });
	await assert.rejects(repositories.add(join(existing, '..')), { statusCode: 400 });
	// A folder inside it is enough: its repository is what is added.
	const added = await repositories.add(join(existing, 'src'));
	assert.equal(added.name, 'optimizer');
	assert.equal(added.own, false);
	assert.equal(added.branch, 'main');
	assert.equal(added.commit.subject, '第一次提交');
	assert.equal(added.changes, 2);
	assert.equal(added.description, 'GEDIIS 和 RFO 的复现，见 说明。');
	assert.deepEqual(added.languages.map((each) => each.name), ['Python', 'Fortran']);
	assert.deepEqual(await repositories.discover(), []);

	assert.equal(await repositories.remove(added.id), true);
	assert.deepEqual(await repositories.list(), []);
});

test('a repository of the Studio’s own: made in repos/ with git and a README, listed with the others', async (t) => {
	const { repositories, project } = await place(t);
	await assert.rejects(repositories.create({ name: '../escape' }), { statusCode: 400 });
	const made = await repositories.create({ name: '过渡态脚本', description: '找过渡态用的小脚本' });
	assert.equal(made.own, true);
	assert.equal(made.description, '找过渡态用的小脚本');
	assert.match(made.path, /project\/repos\/过渡态脚本$/u);
	await assert.rejects(repositories.create({ name: '过渡态脚本' }), { statusCode: 409 });
	await assert.rejects(repositories.remove(made.id), { statusCode: 400 });
	assert.equal(execFileSync('git', ['-C', join(project, 'repos', '过渡态脚本'), 'rev-parse', '--is-inside-work-tree']).toString().trim(), 'true');
});

test('a repository’s home: its folders then files as git sees them, its README as HTML (links made its own, nothing run), a file highlighted', async (t) => {
	const { repositories, existing } = await place(t);
	const { id } = await repositories.add(existing);
	const top = await repositories.tree(id);
	assert.deepEqual(top.entries.map((entry) => `${entry.kind}:${entry.path}`), ['folder:docs', 'folder:src', 'file:.gitignore', 'file:data.bin', 'file:README.md']);
	assert.equal(top.readme.path, 'README.md');
	assert.match(top.readme.html, /<img src="\/api\/studio\/repos\/r\w+\/raw\/docs\/logo\.png" alt="logo">/u);
	assert.match(top.readme.html, /<a href="#file=docs%2Fnotes\.md">说明<\/a>/u);
	assert.match(top.readme.html, /<a href="https:\/\/example\.com" target="_blank">网站<\/a>/u);
	assert.doesNotMatch(top.readme.html, /javascript:/u);

	const src = await repositories.tree(id, 'src');
	assert.deepEqual(src.entries.map((entry) => entry.path), ['src/deep', 'src/new.py', 'src/opt.py']);
	await assert.rejects(repositories.tree(id, 'nothing'), { statusCode: 404 });

	const code = await repositories.file(id, 'src/opt.py');
	assert.equal(code.language, 'Python');
	assert.equal(code.text, '# step\ndef rfo(g, H):\n    return -g * 2\n');
	assert.deepEqual(code.lines[0], [['# step', 'c']]);
	assert.ok(code.lines[1].some(([text, kind]) => text === 'def' && kind === 'k'));
	assert.equal((await repositories.file(id, 'data.bin')).kind, 'binary');
	assert.equal((await repositories.file(id, 'docs/logo.png')).kind, 'picture');
	const notes = await repositories.file(id, 'docs/notes.md');
	assert.match(notes.html, /<p>说明<\/p>/u);

	// Only a file git sees there: not one ignored, not out of it, not through a link.
	await symlink('/etc/hosts', join(existing, 'hosts'));
	for (const path of ['build/out.o', '../README.md', 'src/../../x', '.git/config', 'hosts']) {
		await assert.rejects(repositories.file(id, path), { statusCode: 404 }, path);
		await assert.rejects(repositories.raw(id, path), { statusCode: 404 }, path);
	}
	const raw = await repositories.raw(id, 'docs/logo.png');
	assert.equal(raw.contentType, 'image/png');
	raw.body.destroy();
	await assert.rejects(repositories.tree('rnothing'), { statusCode: 404 });
});
