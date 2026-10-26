import { useEffect, useState } from 'react';

import type { PluginStatus } from '@blog/kernel/index.mjs';
import { cn } from '@studio/lib/utils';
import { Switch } from '@studio/ui/switch';
import { listPlugins, setPluginEnabled, type PluginEntry } from '../../api/client';
import { errorText, Frame, Status } from './Frame';

/** What the dialog asks of the Studio's plugins (plugins.ts). */
export type PluginsHost = {
	/** How one is doing here, and what it says it is. */
	info(id: string): { status: PluginStatus; description: string | null };
	/** Takes it out of the Studio, or puts it in, at once. */
	setEnabled(id: string, enabled: boolean): Promise<void>;
};

const ENVIRONMENTS: Record<PluginEntry['entries'][number], string> = { 'build.mjs': '构建', 'page.ts': '博客页面', 'studio.ts': 'Studio', 'server.mjs': '开发服务器' };

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
 * 插件: the project's plugins (plugins/<name>/), each turned on or off in the Studio. Off, its studio.ts and server.mjs
 * are taken out at once (all they registered undone); the blog's build and its pages use it all the same. Kept in the
 * Studio's settings, not in git.
 */
export function PluginsDialog({ host, onClose }: { host: PluginsHost; onClose(): void }) {
	const [plugins, setPlugins] = useState<PluginEntry[] | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [status, setStatus] = useState({ text: '', error: false });
	const say = (text: string, error = false) => setStatus({ text, error });

	useEffect(() => {
		listPlugins().then(setPlugins, (error: unknown) => say(errorText(error, '读不到插件'), true));
	}, []);

	async function turn(plugin: PluginEntry, enabled: boolean): Promise<void> {
		setBusy(plugin.id);
		say(enabled ? `正在打开 ${plugin.id}…` : `正在关闭 ${plugin.id}…`);
		try {
			const listed = await setPluginEnabled(plugin.id, enabled);
			await host.setEnabled(plugin.id, enabled);
			setPlugins(listed);
			say(enabled ? `已打开 ${plugin.id}` : `已关闭 ${plugin.id}；它在 Studio 里注册的东西都撤掉了`);
		} catch (error) {
			say(errorText(error, '没能改成'), true);
		} finally {
			setBusy(null);
		}
	}

	return (
		<Frame id="plugins-dialog" title="插件" description="plugins/ 里的每个文件夹。关掉只影响 Studio 和开发服务器，马上生效；博客构建和发布的页面照常用全部插件" className="sm:max-w-[600px]" onClose={onClose}>
			<ul id="plugins-list" className="grid max-h-[min(60vh,520px)] gap-0.5 overflow-y-auto">
				{plugins?.map((plugin) => {
					const inStudio = plugin.entries.includes('studio.ts') || plugin.entries.includes('server.mjs');
					const info = plugin.entries.includes('studio.ts') ? host.info(plugin.id) : null;
					const state = stateOf(plugin, info?.status ?? null);
					return (
						<li key={plugin.id} className="plugin-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 rounded-md px-2 py-2.5 hover:bg-muted" data-plugin={plugin.id}>
							<div className="grid min-w-0 gap-0.5">
								<strong className="font-mono text-[13px] font-semibold text-accent-foreground">{plugin.id}</strong>
								{info?.description && <span className="text-xs leading-normal">{info.description}</span>}
								<span className="text-[11px] text-muted-foreground">{plugin.entries.map((entry) => ENVIRONMENTS[entry]).join(' · ')}</span>
								<span className={cn('plugin-state text-[11px] text-muted-foreground', state.error && 'is-error text-destructive')}>{inStudio ? state.text : '只用于博客的构建和页面，这里没有可关的'}</span>
							</div>
							{inStudio && <Switch checked={plugin.enabled} disabled={busy === plugin.id} aria-label={`启用插件 ${plugin.id}`} onCheckedChange={(on) => void turn(plugin, on)} />}
						</li>
					);
				})}
				{plugins?.length === 0 && <li className="px-2 py-3.5 text-xs text-muted-foreground">plugins/ 里还没有插件</li>}
			</ul>
			<Status id="plugins-status" {...status} />
		</Frame>
	);
}
