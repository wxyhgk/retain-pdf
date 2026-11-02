import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { t } from '@blog/i18n/index.mjs';

export class TerminalUnavailableError extends Error {
	constructor(message) {
		super(message);
		this.name = 'TerminalUnavailableError';
		this.statusCode = 503;
	}
}

/**
 * Runs `tools/studio-terminal`, the Rust program that serves shells to the
 * page, and hands out the one-time tickets it accepts. The program is built
 * with cargo the first time a terminal is asked for (a no-op build after
 * that, so it follows changes to its source), and stops with the dev server:
 * closing its stdin makes it exit.
 */
export class TerminalHost {
	#child = null;
	#ready = null;
	#acks = new Map();

	constructor(crateRoot, { cargo = 'cargo', binary = join(crateRoot, 'target', 'release', 'studio-terminal'), spawnImpl = spawn } = {}) {
		this.crateRoot = crateRoot;
		this.cargo = cargo;
		this.binary = binary;
		this.spawnImpl = spawnImpl;
	}

	/**
	 * A WebSocket URL that opens one shell in `cwd`, usable once, within a minute.
	 * @param {string} cwd absolute folder the shell starts in
	 * @param {Record<string, string>} env extra environment for the shell
	 */
	async open(cwd, env = {}) {
		const port = await this.#start();
		const ticket = randomBytes(32).toString('hex');
		const granted = new Promise((resolve, reject) => {
			this.#acks.set(ticket, resolve);
			setTimeout(() => {
				if (this.#acks.delete(ticket)) reject(new TerminalUnavailableError(t('终端程序没有响应')));
			}, 5000);
		});
		// Gone between its start and now (it crashed): the next terminal starts it again.
		if (!this.#child?.stdin.writable) {
			this.#acks.delete(ticket);
			throw new TerminalUnavailableError(t('终端程序刚刚退出了，再试一次'));
		}
		this.#child.stdin.write(`${JSON.stringify({ ticket, cwd, env })}\n`);
		await granted;
		return { url: `ws://127.0.0.1:${port}/pty?ticket=${ticket}` };
	}

	close() {
		this.#child?.stdin.end();
		this.#child = null;
		this.#ready = null;
	}

	#start() {
		this.#ready ??= this.#launch().catch((error) => {
			this.#ready = null;
			throw error;
		});
		return this.#ready;
	}

	async #launch() {
		await this.#build();
		const child = this.spawnImpl(this.binary, [], { stdio: ['pipe', 'pipe', 'inherit'] });
		this.#child = child;
		// Written to as it exits: the write fails (EPIPE), the server goes on.
		child.stdin.on('error', () => {});
		const lines = createInterface({ input: child.stdout });
		const port = await new Promise((resolve, reject) => {
			child.once('error', (error) => reject(new TerminalUnavailableError(t('终端程序无法启动：{message}', { message: error.message }))));
			child.once('exit', () => reject(new TerminalUnavailableError(t('终端程序启动后立即退出了'))));
			lines.once('line', (line) => {
				let port;
				try {
					({ port } = JSON.parse(line));
				} catch {
					// Something else said first (a warning): no port.
				}
				Number.isInteger(port) ? resolve(port) : reject(new TerminalUnavailableError(t('终端程序没有报告端口')));
			});
		});
		lines.on('line', (line) => {
			let message;
			try {
				message = JSON.parse(line);
			} catch {
				return;
			}
			const ack = this.#acks.get(message.granted);
			if (ack && this.#acks.delete(message.granted)) ack();
		});
		child.on('exit', () => {
			// Gone (crashed, or killed by hand): the next terminal starts it again.
			if (this.#child === child) {
				this.#child = null;
				this.#ready = null;
			}
		});
		return port;
	}

	#build() {
		return new Promise((resolve, reject) => {
			const build = this.spawnImpl(this.cargo, ['build', '--release', '--quiet'], { cwd: this.crateRoot, stdio: ['ignore', 'inherit', 'inherit'] });
			build.once('error', (error) => {
				reject(new TerminalUnavailableError(
					error.code === 'ENOENT' ? t('终端需要 Rust 来编译：请先安装 https://rustup.rs') : t('无法编译终端程序：{message}', { message: error.message }),
				));
			});
			build.once('exit', (code) => {
				if (code === 0) resolve();
				else reject(new TerminalUnavailableError(t('终端程序编译失败，详情见运行开发服务器的窗口')));
			});
		});
	}
}
