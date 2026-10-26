import { execFile } from 'node:child_process';
import { t } from '@blog/i18n/index.mjs';

/**
 * Asks the author for a folder with the system's own dialog, on the machine
 * the Studio runs on (macOS); its path, or null when the dialog was
 * cancelled. Elsewhere there is none: the path is typed instead.
 */
export function chooseFolder(prompt, { platform = process.platform, run = execFile } = {}) {
	if (platform !== 'darwin') {
		return Promise.reject(Object.assign(new Error(t('这台电脑上不能弹出选择文件夹的窗口，请直接输入文件夹路径')), { statusCode: 501 }));
	}
	// The prompt goes in as an argument, never into the script's text.
	const script = ['on run argv', 'POSIX path of (choose folder with prompt (item 1 of argv))', 'end run'];
	return new Promise((resolve, reject) => {
		run('osascript', [...script.flatMap((line) => ['-e', line]), prompt], { timeout: 10 * 60_000 }, (error, stdout) => {
			// -128: the author pressed 取消.
			if (error && /-128/u.test(String(error.message) + String(error.stderr ?? ''))) resolve(null);
			else if (error) reject(new Error(t('无法打开选择文件夹的窗口：{message}', { message: error.message })));
			else resolve(String(stdout).trim().replace(/(.)\/$/u, '$1') || null);
		});
	});
}
