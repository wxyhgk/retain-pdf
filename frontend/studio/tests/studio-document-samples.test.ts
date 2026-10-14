import assert from 'node:assert/strict';
import test from 'node:test';

import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

import remarkMathBrackets from '../src/plugins/remark-math-brackets.mjs';
import { mergeMarkdownBody, parseStudioDocument, serializeStudioDocument } from '../src/studio/document/index.ts';

/** Markdown an article can hold, one construct per sample. */
const samples: Array<[kind: string, source: string]> = [
	['code-block', '```\ncode\n```'],
	['code-block', '```python\nprint(1)\n```'],
	['code-block', '```smiles\nCCO\n```'],
	['code-block', '```sdf\nwater\n  -OEChem-\n\n  3  0  0  0  0  0\n```'],
	['code-block', '```xyz\n1\nwater\nO 0 0 0\n```'],
	['code-block', '```gjf\n#p HF/6-31G\n\nwater\n\n0 1\nO\n```'],
	['code-block', '```cube\nCUBE FILE\nOUTER LOOP\n```'],
	['code-block', '````\n```\n````'],
	['code-block', 'Before\n\n```sdf-3d\nMOCK\n```\n\nAfter'],
	['heading', '# Title'],
	['heading', '## Title'],
	['heading', '### Title'],
	['heading', '###### Deep'],
	['heading', '## A *b* `c`'],
	['heading', 'Intro\n\n# Title\n\nOutro'],
	['heading', '# 从 Hartree–Fock 方程开始'],
	['list', '* a\n* b'],
	['list', '* a\n\n* b'],
	['list', '1. a\n2. b'],
	['list', '3. a\n4. b'],
	['list', '* a\n  * b\n  * c\n* d'],
	['list', '* text\n* ```\n  code\n  ```'],
	['list', 'Before\n\n* a\n* b\n\nAfter'],
	['mark-code', '`x`'],
	['mark-code', 'run `x` now'],
	['mark-code', '`` x ` y ``'],
	['mark-em', '*a*'],
	['mark-em', 'x *a* y'],
	['mark-em', '*a **b***'],
	['mark-link', '[text](https://x.y)'],
	['mark-link', '[text](https://x.y "cap")'],
	['mark-link', '<https://x.y>'],
	['mark-link', 'see [text](https://x.y) now'],
	['mark-strong', '**a**'],
	['mark-strong', 'x **a** y'],
	['mark-strong', '**a *b***'],
	['paragraph', 'Hello'],
	['paragraph', 'One\n\nTwo'],
	['paragraph', 'A *b* **c** `d` [e](https://x.y)'],
	['paragraph', 'Before\n\n```\ncode\n```\n\nAfter'],
	['paragraph', 'Intro\n\n# Title\n\nOutro'],
	['paragraph', '中文段落，第二句。'],
	['small-nodes', '> quote'],
	['small-nodes', '> a\n>\n> > b'],
	['small-nodes', '> # Title\n>\n> text'],
	['small-nodes', '---'],
	['small-nodes', '![alt](https://x.y/img.png)'],
	['small-nodes', '![alt](https://x.y/img.png "cap")'],
	['small-nodes', 'one\\\ntwo'],
	['small-nodes', '> quote\n\n---\n\n![a](./b.png)'],
	['math', 'Orbital energy $\\varepsilon_p$ and reaction $\\ce{H2O -> H+ + OH-}$.\n\n$$\n\\hat{f}(i)\\,\\phi_p(i)=\\varepsilon_p\\,\\phi_p(i),\n$$'],
	['math', 'Keep $\\notARealCommand{x}$ unchanged.'],
	['math', '能量 \\(E = mc^2\\)\n\n\\[\nE_{HF} = \\sum_i h_{ii}\n\\]'],
];

/**
 * Stands in for the editor, which writes the same Markdown back in its own
 * style: other bullet, emphasis and rule markers, `$…$` for `\(…\)`.
 */
const rewriter = unified()
	.use(remarkParse)
	.use(remarkMath)
	.use(remarkMathBrackets)
	.use(remarkStringify, { bullet: '-', emphasis: '_', strong: '_', rule: '*', fence: '~' });

function rewritten(markdown: string): string {
	return String(rewriter.processSync(markdown));
}

for (const [kind, source] of samples) {
	test(`${kind}: ${JSON.stringify(source)} reads and writes back byte for byte`, () => {
		const article = `---\ntitle: sample\n---\n${source}\n`;
		assert.equal(serializeStudioDocument(parseStudioDocument(article)), article);
	});

	test(`${kind}: ${JSON.stringify(source)} keeps the author's bytes when the editor only restyles it`, () => {
		const result = mergeMarkdownBody(source, rewritten(source));
		assert.equal(result.body, source);
		assert.equal(result.changedBlocks, 0);
	});
}
