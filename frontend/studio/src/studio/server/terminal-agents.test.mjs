import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { TERMINAL_AGENTS, terminalAgents } from './terminal-agents.mjs';

test('the AIs found are those on the PATH a login shell has', async (t) => {
	const bin = await mkdtemp(join(tmpdir(), 'studio-agents-'));
	t.after(() => rm(bin, { recursive: true, force: true }));
	await writeFile(join(bin, 'codex'), '#!/bin/sh\n');
	await chmod(join(bin, 'codex'), 0o755);
	const agents = await terminalAgents({ shell: '/bin/sh', env: { PATH: `${bin}:/usr/bin:/bin`, HOME: bin }, now: 1 });
	assert.deepEqual(agents.map((agent) => agent.id), TERMINAL_AGENTS.map((agent) => agent.id));
	assert.deepEqual(agents.filter((agent) => agent.installed).map((agent) => agent.id), ['codex']);
	assert.ok(agents.every((agent) => agent.install));
});
