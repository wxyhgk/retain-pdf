import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RetainmolHost } from './retainmol-host.mjs';

async function fixture(t) {
	const folder = await mkdtemp(join(tmpdir(), 'studio-retainmol-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	const checkout = join(folder, 'RetainMol');
	await mkdir(join(checkout, 'apps', 'retainmol'), { recursive: true });
	await writeFile(join(checkout, 'apps', 'retainmol', 'package.json'), '{}');
	const project = join(folder, 'blog-repo');
	await mkdir(project);
	return { folder, checkout, project, settingsFile: join(project, '.studio-settings.json'), cacheDir: join(project, '.studio-cache', 'retainmol') };
}

/**
 * RetainMol's build as the tests need it: `vite build` writes a page into
 * its --outDir; the commands are recorded. `code` is what git says of it.
 */
function fakeTools(code) {
	const ran = [];
	return {
		ran,
		run: async (command, args, cwd) => {
			ran.push(`${command} ${args[0]}${args[0] === 'vite' ? ` ${args[1]}` : ''} @ ${cwd.split('/').at(-1)}`);
			if (args[0] === 'vite') {
				const out = args[args.indexOf('--outDir') + 1];
				await mkdir(join(out, 'assets'), { recursive: true });
				await writeFile(join(out, 'index.html'), `<title>retainmol</title>${code.commit}`);
				await writeFile(join(out, 'assets', 'app-1a2b.js'), 'console.log(1)');
			}
		},
		git: async (args) => (args[0] === 'rev-parse' ? code.commit : args[0] === 'status' ? code.status : code.diff),
	};
}

test('RetainMol is found where the settings say, or beside the repository; a folder without it is refused, saying where', async (t) => {
	const { checkout, project, settingsFile, folder } = await fixture(t);
	const host = new RetainmolHost({ projectRoot: project, settingsFile });
	assert.equal(await host.root(), checkout);
	await writeFile(settingsFile, JSON.stringify({ retainmolRoot: folder }));
	await assert.rejects(host.root(), (error) => error.statusCode === 503 && error.message.includes(`${folder} 里没有 apps/retainmol`));
	await writeFile(settingsFile, JSON.stringify({ retainmolRoot: checkout }));
	assert.equal(await host.root(), checkout);
});

test('built once into the Studio’s cache and served from there; built again only when its code changed', async (t) => {
	const { project, settingsFile, cacheDir } = await fixture(t);
	const code = { commit: 'abc\n', status: '', diff: '' };
	const tools = fakeTools(code);
	const host = new RetainmolHost({ projectRoot: project, settingsFile, cacheDir, port: 0, ...tools });
	t.after(() => host.close());
	const [url, again] = await Promise.all([host.start(), host.start()]);
	assert.equal(again, url);
	assert.deepEqual(tools.ran, ['node scripts/copy-ocl-resources.mjs @ retainmol', 'npm run @ RetainMol', 'npx vite build @ retainmol']);

	// Its page, its assets (kept by the browser: named by content), and any other address is its page.
	const page = await fetch(`${url}/?embed=1`);
	assert.equal(page.headers.get('cache-control'), 'no-cache');
	assert.match(await page.text(), /^<title>retainmol<\/title>abc/u);
	const asset = await fetch(`${url}/assets/app-1a2b.js`);
	assert.equal(asset.headers.get('content-type'), 'text/javascript; charset=utf-8');
	assert.match(asset.headers.get('cache-control') ?? '', /immutable/u);
	assert.match(await (await fetch(`${url}/some/route`)).text(), /retainmol/u);
	assert.equal((await fetch(`${url}/..%2f..%2fsecret`)).status, 403);

	// Unchanged: not built again.
	await host.start();
	assert.equal(tools.ran.length, 3);
	// Changed (an edit not committed): built again, and served as it is now.
	code.diff = 'diff --git a/apps/retainmol/src/x.ts';
	code.commit = 'abc-edited\n';
	await host.start();
	assert.equal(tools.ran.length, 6);
	assert.match(await (await fetch(`${url}/`)).text(), /abc-edited/u);
});

test('its port taken: another one; a build that fails says why; a fixed address is used without building', async (t) => {
	const { project, settingsFile, cacheDir } = await fixture(t);
	const taken = createServer().listen(0, '127.0.0.1');
	await new Promise((resolvePromise) => taken.on('listening', resolvePromise));
	t.after(() => taken.close());
	const busyPort = taken.address().port;
	const host = new RetainmolHost({ projectRoot: project, settingsFile, cacheDir, port: busyPort, ...fakeTools({ commit: 'a', status: '', diff: '' }) });
	t.after(() => host.close());
	const url = await host.start();
	assert.notEqual(new URL(url).port, String(busyPort));

	const failing = new RetainmolHost({
		projectRoot: project,
		settingsFile,
		cacheDir: join(project, 'other-cache'),
		run: async (command) => {
			if (command === 'npm') throw new Error('npm run build:packages 失败：error TS2307');
		},
		git: async () => 'b',
	});
	await assert.rejects(failing.start(), /TS2307/u);

	const fixed = new RetainmolHost({ projectRoot: project, settingsFile, fixedUrl: 'http://127.0.0.1:4999', run: () => assert.fail('nothing built') });
	assert.equal(await fixed.start(), 'http://127.0.0.1:4999');
});
