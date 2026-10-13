import assert from 'node:assert/strict';
import test from 'node:test';

import { describeRDKitError } from '../src/science/rendering/rdkit-messages.ts';

test('valence errors name the atom as the molfile counts it', () => {
	assert.equal(
		describeRDKitError('[10:44:09] Explicit valence for atom # 0 O, 3, is greater than permitted\n'),
		'第 1 个原子 O 连了 3 价，超过它允许的化合价',
	);
	assert.equal(
		describeRDKitError('[09:01:02] Explicit valence for atom #12 C, 5, is greater than permitted'),
		'第 13 个原子 C 连了 5 价，超过它允许的化合价',
	);
});

test('known RDKit failures are said in Chinese, others pass through without the timestamp', () => {
	assert.match(describeRDKitError("[10:00:00] Can't kekulize mol.  Unkekulized atoms: 0 1 2"), /凯库勒/);
	assert.equal(describeRDKitError('[10:00:00] SMILES Parse Error: syntax error while parsing: C(('), 'SMILES 写法有误');
	assert.equal(describeRDKitError('[10:00:00] ****\n[10:00:00] Something new\n'), 'Something new');
	assert.equal(describeRDKitError(''), '');
});
