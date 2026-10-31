import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

/**
 * The Studio's type is set for Chinese, not only Latin (design.css): no text under 12px, no negative tracking, no
 * weights PingFang lacks (450, 550, 650). What is no text but a mark drawn with a character (a handle's ⋮⋮, a dot, a
 * file's kind written on its icon) is let be.
 */

const ROOT = join(import.meta.dirname, '..');
const MARKS = ['.ai-block-handle', '.ai-send.is-stop', '.db-check', '.drive-icon', '.panel-label', '#roundtrip-status', '.page-git'];

function files(directory: string, ending: RegExp): string[] {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		if (name === 'node_modules' || name === 'third-party') return [];
		return statSync(path).isDirectory() ? files(path, ending) : ending.test(name) ? [path] : [];
	});
}

test('the Studio’s styles: no text under 12px, no negative tracking, no weights Chinese fonts lack', () => {
	const found: string[] = [];
	for (const file of [...files(join(ROOT, 'src/studio'), /\.css$/u), ...files(join(ROOT, 'packages/editor-kit'), /\.css$/u), ...files(join(ROOT, 'plugins'), /\.css$/u)]) {
		readFileSync(file, 'utf8')
			.split('\n')
			.forEach((line, at) => {
				if (MARKS.some((mark) => line.includes(mark))) return;
				if (/font-size:\s*(?:\d|1[01])(?:\.\d+)?px|letter-spacing:\s*-|font-weight:\s*(?:450|550|650)\b/u.test(line)) found.push(`${file.slice(ROOT.length + 1)}:${at + 1}`);
			});
	}
	for (const file of files(join(ROOT, 'src/studio'), /\.tsx?$/u)) {
		readFileSync(file, 'utf8')
			.split('\n')
			.forEach((line, at) => {
				// The app's letter in its corner (a mark, not text).
				if (line.includes('font-extrabold')) return;
				if (/\btext-\[(?:\d|1[01])(?:\.\d+)?px\]|\btracking-tight(?:er)?\b/u.test(line)) found.push(`${file.slice(ROOT.length + 1)}:${at + 1}`);
			});
	}
	assert.deepEqual(found, []);
});
