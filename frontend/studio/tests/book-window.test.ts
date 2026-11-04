import assert from 'node:assert/strict';
import test from 'node:test';

import { BookText, CHUNK, formulaCount, isBook } from '../src/studio/editor/book-window.ts';

/** A book of `pages` pages: a heading, paragraphs with formulas, a display formula, a list. */
function book(pages: number): string {
	return Array.from({ length: pages }, (_, index) => `## 第 ${index + 1} 页\n\n反应速率由能垒决定，$E_a = ${index}$，$k = A e^{-E_a/RT}$。\n\n$$\nk(T) = ${index}\n$$\n\n- 一项\n- 二项\n`).join('\n');
}

const squeezed = (text: string) => text.replace(/\n{2,}/gu, '\n\n').trim();

test('a book is told by its length or its formulas', () => {
	assert.equal(formulaCount('$a$ 和 $$b$$ 和 \\(c\\)'), 4);
	assert.equal(isBook('短文'), false);
	assert.equal(isBook('$x$'.repeat(1600)), true);
});

test('opened at its start or further in: the window a few chunks, before and after it the rest, the whole as it was', () => {
	const body = book(800);
	for (const from of [0, Math.floor(body.length / 2), body.length - 10]) {
		const opened = BookText.open(body, from)!;
		assert.ok(opened.window.length > CHUNK && opened.window.length < CHUNK * 5);
		assert.equal(opened.book.full(opened.window), body);
		assert.ok(opened.book.start <= from);
		// Whole blocks: it starts where one does.
		assert.ok(body.slice(opened.book.start).startsWith(opened.window.slice(0, 40)));
	}
	// Too short, or with definitions: none.
	assert.equal(BookText.open(book(3)), null);
	assert.equal(BookText.open(`${book(800)}\n[x]: https://example.org\n`), null);
});

test('scrolled down and back up, chunks in at one end and out at the other: the whole is the same text', () => {
	const body = book(3000);
	const opened = BookText.open(body)!;
	const text = opened.book;
	let window = opened.window;
	// Down: a chunk in at the end, the first let go (its blocks as the editor writes them).
	for (let step = 0; step < 6; step += 1) {
		window = joinedWindow(window, text.takeAfter()!);
		const cut = window.indexOf('\n## ', CHUNK);
		text.putBefore(window.slice(0, cut));
		window = window.slice(cut + 1);
		assert.equal(squeezed(text.full(window)), squeezed(body));
	}
	// Up: a chunk in at the start, the last let go.
	for (let step = 0; step < 8 && text.hasBefore; step += 1) {
		window = joinedWindow(text.takeBefore()!, window);
		const cut = window.lastIndexOf('\n## ', window.length - CHUNK);
		text.putAfter(window.slice(cut + 1));
		window = window.slice(0, cut);
		assert.equal(squeezed(text.full(window)), squeezed(body));
	}
	// An edit in the window is in the whole.
	assert.match(text.full(window.replace('第 1 页', '第一页')), /## 第一页/u);
});

function joinedWindow(first: string, then: string): string {
	return `${first.replace(/\n+$/u, '')}\n\n${then.replace(/^\n+/u, '')}`;
}
