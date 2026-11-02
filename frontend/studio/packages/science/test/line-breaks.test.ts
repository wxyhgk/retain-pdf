import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { breakIntoLines } from '../rendering/line-breaks.mjs';

const require = createRequire(import.meta.url);
const katex = require('katex');

test('a chain of relations becomes lines, each starting at its relation, the number kept for the whole', () => {
	assert.equal(
		breakIntoLines(String.raw`g_x = 4(-1.953125) + 7.5 + 0.3125 = -7.8125 + 7.5 + 0.3125 = 0 \tag{3}`),
		String.raw`\begin{aligned}g_x &= 4(-1.953125) + 7.5 + 0.3125 \\ &= -7.8125 + 7.5 + 0.3125 \\ &= 0\end{aligned}\tag{3}`,
	);
	assert.equal(breakIntoLines(String.raw`\lambda \approx 12.86 \le 13 := x`), String.raw`\begin{aligned}\lambda &\approx 12.86 \\ &\le 13 \\ &:= x\end{aligned}`);
});

test('relations inside braces or \\left…\\right stay; too few relations, lines already, or none before the first: left as written', () => {
	assert.equal(breakIntoLines(String.raw`\frac{a = b}{c} = d = e`), String.raw`\begin{aligned}\frac{a = b}{c} &= d \\ &= e\end{aligned}`);
	assert.equal(breakIntoLines(String.raw`f\left(x = 1\right) = 2 = 2`), String.raw`\begin{aligned}f\left(x = 1\right) &= 2 \\ &= 2\end{aligned}`);
	assert.equal(breakIntoLines(String.raw`\ce{A <=> B} = C`), null);
	assert.equal(breakIntoLines('E = mc^2'), null);
	assert.equal(breakIntoLines(String.raw`a = b \\ c = d = e`), null);
	assert.equal(breakIntoLines(String.raw`\begin{aligned} a &= b = c \end{aligned}`), null);
	assert.equal(breakIntoLines('= a = b'), null);
	assert.equal(breakIntoLines(String.raw`a \{ = \} b = c`), String.raw`\begin{aligned}a \{ &= \} b \\ &= c\end{aligned}`);
});

test('what it gives, KaTeX draws: lines and the number', () => {
	const broken = breakIntoLines(String.raw`x^2 + \frac{1}{2} = \sqrt{y} \approx 3 \tag{12}`)!;
	const html = katex.renderToString(broken, { displayMode: true, throwOnError: true });
	assert.match(html, /\(12\)/u);
	assert.equal(html.match(/class="mrel"/gu)?.length, 2);
});

test('a long sum is broken before its + and −, about 80 characters a line, the lines after set in after its relation', () => {
	const long = String.raw`E(\zeta) = \frac{\zeta^2}{2} - Z\zeta + \frac{5}{8}\zeta + \sum_{i=1}^{N} \sum_{j>i}^{N} \frac{1}{r_{ij}} + \sum_{i}\left(-\frac{1}{2}\nabla_i^2 - \sum_A \frac{Z_A}{r_{iA}}\right) + \int \rho(\mathbf{r})\, v(\mathbf{r})\, d\mathbf{r} + E_{xc}[\rho] \tag{4}`;
	const broken = breakIntoLines(long)!;
	assert.match(broken, /^\\begin\{aligned\}E\(\\zeta\) &= \\frac\{\\zeta\^2\}\{2\} - Z\\zeta/u);
	assert.match(broken, / \\\\ &\\quad \+ /u);
	assert.match(broken, /\\end\{aligned\}\\tag\{4\}$/u);
	// Not at a sign inside braces or \left…\right, nor at one that is a term's own (−1, ^{-1}).
	assert.doesNotMatch(broken, /\\quad - \\frac\{1\}\{2\}\\nabla/u);
	const lines = broken.replace(/^\\begin\{aligned\}|\\end\{aligned\}.*$/gu, '').split(' \\\\ ');
	assert.ok(lines.length >= 2 && lines.length <= 3, String(lines.length));
	const html = katex.renderToString(broken, { displayMode: true, throwOnError: true });
	assert.match(html, /\(4\)/u);

	assert.equal(breakIntoLines(String.raw`a + b - c`), null);
	assert.equal(breakIntoLines(`-${'x'.repeat(120)}`), null);
});
