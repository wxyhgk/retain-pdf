import { execFile } from 'node:child_process';
import { dirname } from 'node:path';
import { t } from '@blog/i18n/index.mjs';

/**
 * Shows a file in the system's file manager: selected in Finder or Explorer,
 * or its folder opened elsewhere. Arguments go straight to the program, never
 * through a shell.
 */
export function revealInFileManager(path, { isDirectory = false, platform = process.platform, run = execFile } = {}) {
	const [command, args] = platform === 'darwin'
		? ['open', isDirectory ? [path] : ['-R', path]]
		: platform === 'win32'
			? ['explorer.exe', isDirectory ? [path] : [`/select,${path}`]]
			: ['xdg-open', [isDirectory ? path : dirname(path)]];
	return new Promise((resolve, reject) => {
		run(command, args, { timeout: 10_000 }, (error) => {
			// Explorer exits with 1 even when it opened the folder.
			if (error && !(platform === 'win32' && error.code === 1)) reject(new Error(t('无法打开文件管理器：{message}', { message: error.message })));
			else resolve();
		});
	});
}
