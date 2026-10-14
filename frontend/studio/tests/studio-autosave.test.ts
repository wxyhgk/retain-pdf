import assert from 'node:assert/strict';
import test from 'node:test';

import { Autosave, type SaveOutcome } from '../src/studio/state/autosave.ts';

/** A clock the test moves by hand, and a save it answers by hand. */
function harness(options: { delay?: number; maxWait?: number; retryDelay?: number } = {}) {
	let now = 0;
	let timers: Array<{ at: number; run: () => void; id: number }> = [];
	let nextId = 0;
	const saves: Array<(outcome: SaveOutcome) => void> = [];
	const autosave = new Autosave({
		...options,
		save: () => new Promise((resolve) => saves.push(resolve)),
		setTimer: (run, ms) => {
			const id = ++nextId;
			timers.push({ at: now + ms, run, id });
			return id;
		},
		clearTimer: (id) => { timers = timers.filter((timer) => timer.id !== id); },
		now: () => now,
	});
	const settle = () => new Promise((resolve) => setImmediate(resolve));
	return {
		autosave,
		saves,
		async advance(ms: number) {
			now += ms;
			for (;;) {
				const due = timers.filter((timer) => timer.at <= now).sort((a, b) => a.at - b.at)[0];
				if (!due) break;
				timers = timers.filter((timer) => timer !== due);
				due.run();
				await settle();
			}
			await settle();
		},
		settle,
	};
}

test('saves once the author pauses', async () => {
	const { autosave, saves, advance } = harness({ delay: 800 });
	autosave.changed();
	await advance(500);
	autosave.changed();
	await advance(500);
	assert.equal(saves.length, 0, 'still typing');
	await advance(300);
	assert.equal(saves.length, 1);
});

test('typing without a pause still saves every few seconds', async () => {
	const { autosave, saves, advance } = harness({ delay: 800, maxWait: 3000 });
	for (let elapsed = 0; elapsed < 3000; elapsed += 200) {
		autosave.changed();
		await advance(200);
	}
	assert.equal(saves.length, 1);
});

test('one save at a time; what came in meanwhile is saved next', async () => {
	const { autosave, saves, advance, settle } = harness({ delay: 100 });
	autosave.changed();
	await advance(100);
	assert.equal(saves.length, 1);
	autosave.changed();
	await advance(100);
	assert.equal(saves.length, 1, 'waits for the save under way');
	saves[0]('more');
	await settle();
	await advance(100);
	assert.equal(saves.length, 2);
});

test('flush saves at once and says whether everything is on disk', async () => {
	const { autosave, saves, settle } = harness({ delay: 10_000 });
	autosave.changed();
	const flushed = autosave.flush();
	await settle();
	assert.equal(saves.length, 1);
	saves[0]('saved');
	assert.equal(await flushed, true);

	const held = autosave.flush();
	await settle();
	saves[1]('held');
	assert.equal(await held, false);
});

test('a failed save is tried again later', async () => {
	const { autosave, saves, advance, settle } = harness({ delay: 100, retryDelay: 2000 });
	autosave.changed();
	await advance(100);
	saves[0]('failed');
	await settle();
	await advance(1999);
	assert.equal(saves.length, 1);
	await advance(1);
	assert.equal(saves.length, 2);
});

test('after a conflict nothing is saved until it is settled', async () => {
	const { autosave, saves, advance, settle } = harness({ delay: 100 });
	autosave.changed();
	await advance(100);
	saves[0]('conflict');
	await settle();
	autosave.changed();
	await advance(1000);
	assert.equal(await autosave.flush(), false);
	assert.equal(saves.length, 1);
	autosave.resume();
	await advance(100);
	assert.equal(saves.length, 2);
});

test('cancel drops what was waiting', async () => {
	const { autosave, saves, advance } = harness({ delay: 100 });
	autosave.changed();
	autosave.cancel();
	await advance(1000);
	assert.equal(saves.length, 0);
});
