import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { NUMBER, parseQcOutput, qcProgram, readRules } from '../parsers/qc/qc.mjs';

// Each output in fixtures/qc/ is read and checked against its answer (`<name>.answer.json`): every value
// the answer gives must be what is read (a value it leaves out is not checked). The answers agree with
// cclib (qc-cclib-check.py). A new case is a new output and its answer here; no test to write.

const FIXTURES = new URL('./fixtures/qc/', import.meta.url);
const outputs = readdirSync(FIXTURES).filter((name) => /\.(log|out)$/u.test(name));

/** Where `actual` differs from what `expected` gives, as paths and both values. */
function differences(actual: unknown, expected: unknown, path = ''): string[] {
	if (typeof expected === 'number' && typeof actual === 'number') {
		return Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)) ? [] : [`${path}: read ${actual}, answer ${expected}`];
	}
	if (Array.isArray(expected)) {
		if (!Array.isArray(actual)) return [`${path}: read ${JSON.stringify(actual)}, answer a list`];
		if (actual.length !== expected.length) return [`${path}: read ${actual.length} of them, answer ${expected.length}`];
		return expected.flatMap((item, index) => differences(actual[index], item, `${path}[${index}]`));
	}
	if (expected && typeof expected === 'object') {
		if (!actual || typeof actual !== 'object') return [`${path}: read ${JSON.stringify(actual)}, answer ${JSON.stringify(expected)}`];
		return Object.entries(expected).flatMap(([key, value]) => differences((actual as Record<string, unknown>)[key], value, path ? `${path}.${key}` : key));
	}
	return actual === expected ? [] : [`${path}: read ${JSON.stringify(actual)}, answer ${JSON.stringify(expected)}`];
}

test('the outputs to check are there, each with its answer', () => {
	assert.ok(outputs.length >= 10);
	for (const output of outputs) assert.ok(readdirSync(FIXTURES).includes(output.replace(/\.(log|out)$/u, '.answer.json')), `${output} has no answer`);
});

for (const output of outputs) {
	test(`${output} is read as its answer says`, () => {
		const text = readFileSync(new URL(output, FIXTURES), 'utf8');
		const answer = JSON.parse(readFileSync(new URL(output.replace(/\.(log|out)$/u, '.answer.json'), FIXTURES), 'utf8'));
		const read = parseQcOutput(text);
		assert.deepEqual(differences(read, answer), []);
	});
}

test('the program is told from the start of its output; another file is neither', () => {
	for (const output of outputs) {
		const head = readFileSync(new URL(output, FIXTURES), 'utf8').slice(0, 8192);
		assert.equal(qcProgram(head), output.endsWith('.log') ? 'gaussian' : 'orca', output);
	}
	assert.equal(qcProgram('step 1: E = -1.0\nconverged'), null);
});

test('a table of rules takes the first, the last or every match, read as a number unless told otherwise', () => {
	const text = 'E = -1.5\nE = -2.5D-01\nname: water\n';
	const pattern = new RegExp(String.raw`^E = (${NUMBER})`);
	assert.deepEqual(
		readRules(text, {
			first: { pattern, take: 'first' },
			last: { pattern },
			all: { pattern, take: 'all' },
			name: { pattern: /^name: (\w+)/, read: (match) => match[1] },
			missing: { pattern: /^G = (\d+)/ },
		}),
		{ first: -1.5, last: -0.25, all: [-1.5, -0.25], name: 'water', missing: null },
	);
});
