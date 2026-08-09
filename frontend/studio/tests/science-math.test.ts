import assert from 'node:assert/strict';
import test from 'node:test';

import { renderMathHtml } from '../src/science/rendering/math.ts';

test('renders inline math without a display container', () => {
	const result = renderMathHtml(String.raw`E = mc^2`, false);
	assert.equal(result.error, undefined);
	assert.match(result.html, /class="katex"/);
	assert.doesNotMatch(result.html, /class="katex-display"/);
	assert.match(result.html, /<math[^>]*>/);
});

test('renders display math with the KaTeX display container', () => {
	const result = renderMathHtml(String.raw`\int_0^1 x^2\,dx`, true);
	assert.equal(result.error, undefined);
	assert.match(result.html, /class="katex-display"/);
	assert.match(result.html, /display="block"/);
});

test('renders mhchem commands on the shared KaTeX instance', () => {
	const result = renderMathHtml(String.raw`\ce{2 H2 + O2 -> 2 H2O}`, true);
	assert.equal(result.error, undefined);
	assert.match(result.html, /class="katex-display"/);
	assert.match(result.html, /H/);
	assert.doesNotMatch(result.html, /Undefined control sequence/);
});

test('returns renderable error HTML instead of throwing for invalid LaTeX', () => {
	assert.doesNotThrow(() => renderMathHtml(String.raw`\frac{`, false));
	const result = renderMathHtml(String.raw`\frac{`, false);
	assert.ok(result.error);
	assert.match(result.html, /katex-error/);
});
