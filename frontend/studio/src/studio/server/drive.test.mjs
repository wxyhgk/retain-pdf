import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

import { chooseFolder } from './choose-folder.mjs';
import { Drive, driveSegments, driveUploadName } from './drive.mjs';

function setUp(t) {
	const base = mkdtempSync(join(tmpdir(), 'drive-'));
	t.after(() => rmSync(base, { recursive: true, force: true }));
	const root = join(base, '计算化学资料');
	const repository = join(base, 'repo');
	mkdirSync(join(root, '组会', '2026 秋'), { recursive: true });
	mkdirSync(repository);
	writeFileSync(join(root, '组会', '第 3 次 (定稿).pptx'), 'pptx');
	writeFileSync(join(root, 'water.log'), 'SCF Done');
	writeFileSync(join(root, '.DS_Store'), '');
	return { base, root, repository, drive: new Drive({ settingsFile: join(base, 'settings.json'), forbidden: [repository] }) };
}

test('a drive is a folder chosen outside the repository, remembered in its settings', async (t) => {
	const { base, root, repository, drive } = setUp(t);
	assert.deepEqual(await drive.describe(), { root: null, name: null, fixed: false });
	await assert.rejects(drive.list(''), /还没有选择资料库文件夹/u);
	await assert.rejects(drive.choose('relative/path'), /完整路径/u);
	await assert.rejects(drive.choose(join(repository, 'blog')), /不是一个文件夹/u);
	mkdirSync(join(repository, 'notes'));
	await assert.rejects(drive.choose(join(repository, 'notes')), /不能放在博客仓库里/u);
	await assert.rejects(drive.choose(base), /包含博客仓库/u);
	assert.deepEqual(await drive.choose(root), { root, name: '计算化学资料', fixed: false });
	assert.equal(JSON.parse(readFileSync(join(base, 'settings.json'), 'utf8')).driveRoot, root);
	assert.equal(await new Drive({ settingsFile: join(base, 'settings.json') }).root(), root);
});

test('folders first, names as people read them, nothing hidden; paths stay inside', async (t) => {
	const { root, drive } = setUp(t);
	await drive.choose(root);
	symlinkSync('/etc', join(root, 'etc'));
	assert.deepEqual((await drive.list('')).map((entry) => [entry.path, entry.kind]), [['组会', 'directory'], ['water.log', 'file']]);
	assert.deepEqual((await drive.list('组会')).map((entry) => entry.path), ['组会/2026 秋', '组会/第 3 次 (定稿).pptx']);
	await assert.rejects(drive.list('../'), /\.\./u);
	await assert.rejects(drive.list('etc'), /符号链接/u);
	await assert.rejects(drive.stream('.DS_Store'), /隐藏/u);
	const sent = await drive.stream('组会/第 3 次 (定稿).pptx');
	assert.equal(sent.size, 4);
	let text = '';
	for await (const chunk of sent.body) text += chunk;
	assert.equal(text, 'pptx');
	assert.throws(() => driveSegments('a/../b'), /\.\./u);
	assert.equal(driveUploadName('C:\\Users\\me\\Screen Shot 1.png'), 'Screen Shot 1.png');
});

test('uploads, folders, moves and the trash', async (t) => {
	const { root, drive } = setUp(t);
	await drive.choose(root);
	assert.deepEqual(await drive.upload('组会', 'notes (1).md', Readable.from(['a'])), { path: '组会/notes (1).md', size: 1 });
	assert.deepEqual(await drive.upload('组会', 'notes (1).md', Readable.from(['bb'])), { path: '组会/notes (1)-1.md', size: 2 });
	assert.deepEqual(await drive.upload('组会', 'notes (1).md', Readable.from(['bb'])), { path: '组会/notes (1)-1.md', size: 2 }, 'the same file again: the one there');
	assert.deepEqual(await drive.createFolder('组会/2026 秋/草稿'), { path: '组会/2026 秋/草稿' });
	await assert.rejects(drive.createFolder('组会/2026 秋/草稿'), /已经存在/u);
	assert.deepEqual(await drive.move('water.log', '组会/2026 秋/water opt.log'), { path: '组会/2026 秋/water opt.log' });
	await assert.rejects(drive.move('组会', '组会/2026 秋/组会'), /自己里面/u);
	await assert.rejects(drive.move('组会/notes (1).md', '组会/第 3 次 (定稿).pptx'), /已经存在/u);
	const { trashed } = await drive.trash('组会/2026 秋');
	assert.equal(existsSync(join(root, '组会', '2026 秋')), false);
	assert.deepEqual((await drive.list('')).map((entry) => entry.path), ['组会']);
	assert.deepEqual(await drive.restore(trashed), { path: '组会/2026 秋' });
	assert.equal(readFileSync(join(root, '组会', '2026 秋', 'water opt.log'), 'utf8'), 'SCF Done');
	await assert.rejects(drive.restore('not-a-stamp/a'), /无效/u);
});

test('the folder dialog: the path chosen, null when cancelled, refused off macOS', async () => {
	const answer = (error, stdout) => (_command, args, _options, done) => {
		assert.equal(args.at(-1), '选择资料库');
		done(error, stdout);
	};
	assert.equal(await chooseFolder('选择资料库', { platform: 'darwin', run: answer(null, '/Users/me/资料/\n') }), '/Users/me/资料');
	assert.equal(await chooseFolder('选择资料库', { platform: 'darwin', run: answer(Object.assign(new Error('User canceled. (-128)'), { stderr: '' })) }), null);
	await assert.rejects(chooseFolder('选择资料库', { platform: 'linux' }), /直接输入/u);
});

test('two things trashed from the drive in the same instant each have their own place there', async (t) => {
	const { root, drive } = setUp(t);
	await drive.choose(root);
	const [log, slides] = await Promise.all([drive.trash('water.log'), drive.trash('组会/第 3 次 (定稿).pptx')]);
	assert.notEqual(log.trashed.split('/')[0], slides.trashed.split('/')[0]);
	await drive.restore(log.trashed);
	await drive.restore(slides.trashed);
	assert.equal(readFileSync(join(root, 'water.log'), 'utf8'), 'SCF Done');
	assert.equal(readFileSync(join(root, '组会', '第 3 次 (定稿).pptx'), 'utf8'), 'pptx');
});
