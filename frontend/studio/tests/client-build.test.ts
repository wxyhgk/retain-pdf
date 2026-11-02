import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { builtPage, ClientBuilds, isSource, sourceStamp } from '../src/studio/client-build.mjs';

/** A Studio's code, as far as its stamp sees it: src/, packages/, plugins/. */
function code(t: test.TestContext): string {
	const root = mkdtempSync(join(tmpdir(), 'studio-client-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	for (const folder of ['src/studio', 'packages/ui', 'plugins/job', 'src/studio/node_modules/x']) mkdirSync(join(root, folder), { recursive: true });
	writeFileSync(join(root, 'src/studio/main.ts'), 'main');
	writeFileSync(join(root, 'packages/ui/a.css'), 'a');
	writeFileSync(join(root, 'plugins/job/studio.ts'), 'job');
	return root;
}

test('the code’s stamp changes with a file of its changed, added or removed; not with what is not its code', (t) => {
	const root = code(t);
	const first = sourceStamp(root);
	assert.equal(sourceStamp(root), first);
	writeFileSync(join(root, 'src/studio/node_modules/x/index.js'), 'not ours');
	writeFileSync(join(root, 'notes.md'), 'not code');
	assert.equal(sourceStamp(root), first);
	writeFileSync(join(root, 'plugins/job/studio.ts'), 'job, changed');
	const changed = sourceStamp(root);
	assert.notEqual(changed, first);
	utimesSync(join(root, 'src/studio/main.ts'), new Date(), new Date(Date.now() + 60_000));
	assert.notEqual(sourceStamp(root), changed);
	assert.equal(isSource(root, join(root, 'packages/ui/a.css')), true);
	assert.equal(isSource(root, join(root, 'blog/note/index.md')), false);
	assert.equal(isSource(root, join(root, 'srcs/x.ts')), false);
});

test('the built Studio is given while it is of the code as it is; once the code changes, not, and it is built again', async (t) => {
	const root = code(t);
	const folder = join(root, '.studio-cache', 'client');
	mkdirSync(folder, { recursive: true });
	const pages = { studio: { script: 'assets/studio-1.js', imports: [], styles: ['assets/studio-1.css'] } };
	writeFileSync(join(folder, 'built.json'), JSON.stringify({ stamp: sourceStamp(root), at: 1, pages }));
	const warned: string[] = [];
	const builds = new ClientBuilds({ root, folder, warn: (message) => warned.push(message) });
	assert.deepEqual(builds.current()?.pages, pages);

	writeFileSync(join(root, 'src/studio/main.ts'), 'main, changed');
	builds.changed(join(root, 'blog/note/index.md'));
	assert.deepEqual(builds.current()?.pages, pages, 'a note is no code: the stamp is not looked at again');
	builds.changed(join(root, 'src/studio/main.ts'));
	assert.equal(builds.current(), null);
	// Built again, in a process of its own (here there is no Vite to build with: it says why it could not).
	assert.ok(builds.building);
	await builds.building;
	assert.match(warned.join('\n'), /没能构建/u);
	clearTimeout(builds.timer ?? undefined);

	// The browser tests’ one, built before they start: given as it is.
	const fixed = new ClientBuilds({ root, folder, fixed: true });
	assert.deepEqual(fixed.current()?.pages, pages);
});

test('a page made the built Studio’s: its stylesheets, its script and what that imports, KaTeX’s fonts by their built names', () => {
	const drawn = [
		'<head>',
		'<link rel="preload" href="/node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2" as="font" type="font/woff2" crossorigin />',
		'<link rel="preload" href="/node_modules/katex/dist/fonts/KaTeX_AMS-Regular.woff2" as="font" type="font/woff2" crossorigin />',
		'<!--studio:styles-->',
		'</head><body>',
		'<script type="module" src="/src/studio/main.ts"></script>',
		'</body>',
	].join('\n');
	const html = builtPage(drawn, { styles: ['assets/studio-1.css'], script: 'assets/studio-1.js', imports: ['assets/lib-2.js'] }, { stylesMark: '<!--studio:styles-->', entry: '/src/studio/main.ts', assets: ['KaTeX_Main-Regular-abc.woff2', 'KaTeX_Main-Regular-abc.woff'] });
	assert.match(html, /<link rel="stylesheet" href="\/studio-client\/assets\/studio-1\.css" \/>/u);
	assert.match(html, /<link rel="modulepreload" href="\/studio-client\/assets\/lib-2\.js" \/>\n\t\t<script type="module" src="\/studio-client\/assets\/studio-1\.js"><\/script>/u);
	assert.match(html, /href="\/studio-client\/assets\/KaTeX_Main-Regular-abc\.woff2" as="font"/u);
	// A font the build does not have: not asked for twice.
	assert.doesNotMatch(html, /KaTeX_AMS/u);
	assert.doesNotMatch(html, /\/src\/studio\/main\.ts|studio:styles/u);
});
