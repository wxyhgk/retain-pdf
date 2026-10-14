import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { TerminalHost, TerminalUnavailableError } from './terminal-host.mjs';

const crate = fileURLToPath(new URL('../../../tools/studio-terminal', import.meta.url));
const built = existsSync(join(crate, 'target', 'release', 'studio-terminal'));
// `true` stands in for cargo: these tests use the program as built and never build it.
const skip = built ? false : 'tools/studio-terminal is not built (cargo build --release)';

function connect(url) {
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(url, { headers: { origin: 'http://localhost:4321' } });
		socket.binaryType = 'arraybuffer';
		socket.onopen = () => resolve(socket);
		socket.onerror = () => reject(new Error('refused'));
	});
}

test('a ticket opens one shell in the folder it names', { skip, timeout: 15000 }, async (t) => {
	const host = new TerminalHost(crate, { cargo: 'true' });
	t.after(() => host.close());
	const { url } = await host.open(tmpdir(), { STUDIO_ARTICLE: 'note' });
	assert.match(url, /^ws:\/\/127\.0\.0\.1:\d+\/pty\?ticket=[0-9a-f]{64}$/u);

	const socket = await connect(url);
	const decoder = new TextDecoder();
	let output = '';
	const exited = new Promise((resolve) => {
		socket.onmessage = (event) => {
			if (typeof event.data === 'string') resolve(JSON.parse(event.data));
			else output += decoder.decode(event.data, { stream: true });
		};
	});
	socket.send(new TextEncoder().encode('echo "in=$(basename "$PWD") article=$STUDIO_ARTICLE"; exit 0\r'));
	assert.deepEqual(await exited, { type: 'exit', code: 0 });
	assert.match(output, /in=\S+ article=note/u);
	await assert.rejects(connect(url), /refused/u, 'a ticket works once');
});

test('without Rust the terminal says how to get it', async () => {
	const host = new TerminalHost(crate, { cargo: join(tmpdir(), 'no-cargo-here') });
	await assert.rejects(host.open(tmpdir()), (error) => error instanceof TerminalUnavailableError && /rustup\.rs/u.test(error.message));
});
