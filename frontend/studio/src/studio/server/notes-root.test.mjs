import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { studioBlogRoot } from './articles/page-version.mjs';
import { studioSettingsFile } from './locale-settings.mjs';
import { LOCAL_FILE, notesRoot } from './notes-root.mjs';

test('the notes are where STUDIO_NOTES_DIR says, else where .studio-local.json says, else with the code', (t) => {
	const code = realpathSync(mkdtempSync(join(tmpdir(), 'studio-code-')));
	const saved = { notes: process.env.STUDIO_NOTES_DIR, blog: process.env.STUDIO_BLOG_DIR };
	delete process.env.STUDIO_NOTES_DIR;
	delete process.env.STUDIO_BLOG_DIR;
	t.after(() => {
		rmSync(code, { recursive: true, force: true });
		for (const [name, value] of [['STUDIO_NOTES_DIR', saved.notes], ['STUDIO_BLOG_DIR', saved.blog]]) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	});

	// Notes and code in one folder, as before.
	assert.equal(notesRoot(code), code);
	assert.equal(studioBlogRoot(code), join(code, 'blog'));

	// This machine's file: a path from the code's folder, or a whole one.
	writeFileSync(join(code, LOCAL_FILE), JSON.stringify({ notes: '../my-notes' }));
	assert.equal(notesRoot(code), join(code, '..', 'my-notes'));
	assert.equal(studioBlogRoot(code), join(code, '..', 'my-notes', 'blog'));
	assert.equal(studioSettingsFile(code), join(code, '..', 'my-notes', '.studio-settings.json'));
	// A copy of the code with the file linked in (Studio.app's rescue, .studio-cache/rescue): the same notes.
	const rescue = join(code, '.studio-cache', 'rescue');
	mkdirSync(rescue, { recursive: true });
	symlinkSync(join(code, LOCAL_FILE), join(rescue, LOCAL_FILE));
	assert.equal(notesRoot(rescue), join(code, '..', 'my-notes'));
	writeFileSync(join(code, LOCAL_FILE), JSON.stringify({ notes: '/elsewhere/notes' }));
	assert.equal(notesRoot(code), '/elsewhere/notes');

	// The environment before the file.
	process.env.STUDIO_NOTES_DIR = '/from/env';
	assert.equal(notesRoot(code), '/from/env');

	// A file that says nothing usable: with the code.
	delete process.env.STUDIO_NOTES_DIR;
	writeFileSync(join(code, LOCAL_FILE), '{ not json');
	assert.equal(notesRoot(code), code);
});
