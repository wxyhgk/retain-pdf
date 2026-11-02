import assert from 'node:assert/strict';
import test from 'node:test';

import { detectScript, readHost } from '../server/compute-hosts.mjs';

test('a machine keeps the path of any program, by its name', () => {
	const host = readHost({ name: 'box', programs: { xtb: ' /opt/xtb/bin/xtb ', orca: '/opt/orca/orca', 'bad name': '/x', crest: '' } });
	assert.deepEqual(host.programs, { xtb: '/opt/xtb/bin/xtb', orca: '/opt/orca/orca' });
});

test('programs are looked for after those they sit beside', () => {
	const script = detectScript([{ name: 'xtb', beside: ['crest'] }, { name: 'crest' }, { name: 'orca' }, { name: '$(rm -rf ~)' }]);
	const order = [...script.matchAll(/^p=([\w-]+);/gmu)].map((match) => match[1]);
	assert.deepEqual(order, ['crest', 'orca', 'xtb']);
	assert.match(script, /-n "\$found_crest" \] && \[ -x "\$\(dirname "\$found_crest"\)\/\$p" \]/u);
	assert.doesNotMatch(script, /rm -rf/u);
});
