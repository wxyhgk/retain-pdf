import assert from 'node:assert/strict';
import test from 'node:test';
import { revealInFileManager } from './reveal.mjs';

function recorder(code = 0) {
	const calls = [];
	const run = (command, args, _options, done) => {
		calls.push([command, ...args]);
		done(code ? Object.assign(new Error('exit'), { code }) : null);
	};
	return { calls, run };
}

test('each system shows the file its own way, without a shell', async () => {
	const mac = recorder();
	await revealInFileManager('/a/b.png', { platform: 'darwin', run: mac.run });
	await revealInFileManager('/a', { platform: 'darwin', run: mac.run, isDirectory: true });
	assert.deepEqual(mac.calls, [['open', '-R', '/a/b.png'], ['open', '/a']]);

	const linux = recorder();
	await revealInFileManager('/a/b.png', { platform: 'linux', run: linux.run });
	assert.deepEqual(linux.calls, [['xdg-open', '/a']]);

	const windows = recorder(1);
	await revealInFileManager('C:\\a\\b.png', { platform: 'win32', run: windows.run });
	assert.deepEqual(windows.calls, [['explorer.exe', '/select,C:\\a\\b.png']]);

	await assert.rejects(revealInFileManager('/a', { platform: 'darwin', run: recorder(1).run }), /无法打开文件管理器/u);
});
