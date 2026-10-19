import { listPlugins, setPluginEnabled, type PluginEntry } from '../api/client.ts';
import type { PluginStatus } from '@blog/kernel/index.mjs';
import './plugins-dialog.css';

/** What the dialog asks of the Studio's plugins (plugins.ts). */
export type PluginsDialogHost = {
	/** How one is doing here, and what it says it is. */
	info(id: string): { status: PluginStatus; description: string | null };
	/** Takes it out of the Studio, or puts it in, at once. */
	setEnabled(id: string, enabled: boolean): Promise<void>;
};

const ENVIRONMENTS: Record<PluginEntry['entries'][number], string> = { 'build.mjs': '构建', 'page.ts': '博客页面', 'studio.ts': 'Studio', 'server.mjs': '开发服务器' };

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

/** How a plugin is doing, in words; `error` when it is not working. */
function stateOf(plugin: PluginEntry, studio: PluginStatus | null): { text: string; error: boolean } {
	if (!plugin.enabled) return { text: '已关闭', error: false };
	for (const [where, status] of [['Studio 里', studio], ['开发服务器上', plugin.server]] as const) {
		if (status?.state === 'failed') return { text: `${where}没能启动：${status.error ?? ''}`, error: true };
		if (status?.state === 'waiting') return { text: `${where}在等它需要的服务（inject），没有启动`, error: true };
	}
	return { text: '运行中', error: false };
}

/**
 * 插件: the project's plugins (plugins/<name>/), each turned on or off in the
 * Studio. Off, its studio.ts and server.mjs are taken out at once (all they
 * registered undone); the blog's build and its pages use it all the same.
 * Kept in the Studio's settings, not in git.
 */
export function createPluginsDialog(dialog: HTMLDialogElement, host: PluginsDialogHost) {
	const list = dialog.querySelector<HTMLElement>('#plugins-list')!;
	const status = dialog.querySelector<HTMLElement>('#plugins-status')!;

	function say(message: string, error = false): void {
		status.textContent = message;
		status.classList.toggle('is-error', error);
	}

	function row(plugin: PluginEntry): HTMLLIElement {
		const item = element('li', 'plugin-row');
		item.dataset.plugin = plugin.id;
		const inStudio = plugin.entries.includes('studio.ts') || plugin.entries.includes('server.mjs');
		const info = plugin.entries.includes('studio.ts') ? host.info(plugin.id) : null;
		const text = element('div', 'plugin-text');
		text.append(element('strong', 'plugin-name', plugin.id));
		if (info?.description) text.append(element('span', 'plugin-description', info.description));
		text.append(element('span', 'plugin-entries', plugin.entries.map((entry) => ENVIRONMENTS[entry]).join(' · ')));
		const state = stateOf(plugin, info?.status ?? null);
		const stateLine = element('span', `plugin-state${state.error ? ' is-error' : ''}`, inStudio ? state.text : '只用于博客的构建和页面，这里没有可关的');
		text.append(stateLine);
		item.append(text);
		if (!inStudio) return item;

		const toggle = element('label', 'plugin-switch');
		const input = element('input');
		input.type = 'checkbox';
		input.setAttribute('role', 'switch');
		input.checked = plugin.enabled;
		input.setAttribute('aria-label', `启用插件 ${plugin.id}`);
		toggle.append(input, element('span', 'plugin-switch-track'));
		input.addEventListener('change', async () => {
			const enabled = input.checked;
			input.disabled = true;
			say(enabled ? `正在打开 ${plugin.id}…` : `正在关闭 ${plugin.id}…`);
			try {
				const plugins = await setPluginEnabled(plugin.id, enabled);
				await host.setEnabled(plugin.id, enabled);
				draw(plugins);
				say(enabled ? `已打开 ${plugin.id}` : `已关闭 ${plugin.id}；它在 Studio 里注册的东西都撤掉了`);
			} catch (error) {
				input.checked = !enabled;
				input.disabled = false;
				say(error instanceof Error ? error.message : '没能改成', true);
			}
		});
		item.append(toggle);
		return item;
	}

	function draw(plugins: PluginEntry[]): void {
		list.replaceChildren(...plugins.map(row));
		if (!plugins.length) list.append(element('li', 'plugin-empty', 'plugins/ 里还没有插件'));
	}

	return {
		async open(): Promise<void> {
			say('');
			list.replaceChildren();
			dialog.showModal();
			try {
				draw(await listPlugins());
			} catch (error) {
				say(error instanceof Error ? error.message : '读不到插件', true);
			}
		},
	};
}
