import assert from 'node:assert/strict';
import test from 'node:test';

import { markdownTable, parseDelimited } from '../src/studio/table-text.ts';

test('CSV as rows: quotes, quoted commas and newlines, CRLF, empty rows at the end', () => {
	assert.deepEqual(parseDelimited('﻿"能量","kcal/mol"\r\nRC2,-0.45\n"TS, 2",-0.21\n"a ""b""","x\ny"\n,\n\n'), [
		['能量', 'kcal/mol'],
		['RC2', '-0.45'],
		['TS, 2', '-0.21'],
		['a "b"', 'x\ny'],
	]);
	assert.deepEqual(parseDelimited('a\tb\n1\t2', '\t'), [['a', 'b'], ['1', '2']]);
});

test('rows as a Markdown table, numbers to the right', () => {
	assert.equal(
		markdownTable([['结构', 'E / kcal mol⁻¹', '备注'], ['RC2', '−0.45', ''], ['TS2', '1.2e-3', 'a|b'], ['PC2', '-41.70']]),
		['| 结构 | E / kcal mol⁻¹ | 备注 |', '| --- | ---: | --- |', '| RC2 | −0.45 |  |', '| TS2 | 1.2e-3 | a\\|b |', '| PC2 | -41.70 |  |'].join('\n'),
	);
	assert.equal(markdownTable([]), '');
});
