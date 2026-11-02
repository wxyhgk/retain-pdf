import { useEffect, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import type { PluginStatus } from '@blog/kernel/index.mjs';
import { cn } from '@studio/lib/utils';
import { Switch } from '@studio/ui/switch';
import { listPlugins, setPluginEnabled, type PluginEntry } from '../../api/client';
import { errorText, Status } from './Frame';

/** What 设置 › 插件 asks of the Studio's plugins (plugins.ts). */
export type PluginsHost = {
	/** How one is doing here, and what it says it is. */
	info(id: string): { status: PluginStatus; description: string | null };
	/** Takes it out of the Studio, or puts it in, at once. */
	setEnabled(id: string, enabled: boolean): Promise<void>;
};

const ENVIRONMENTS: Record<PluginEntry['entries'][number], string> = { 'build.mjs': t('构建'), 'page.ts': t('博客页面'), 'studio.ts': 'Studio', 'server.mjs': t('开发服务器') };

/** How a plugin is doing, in words; `error` when it is not working. */
function stateOf(plugin: PluginEntry, studio: PluginStatus | null): { text: string; error: boolean } {
	if (!plugin.enabled) return { text: t('已关闭'), error: false };
	const places = [
		{ status: studio, failed: (error: string) => t('Studio 里没能启动：{error}', { error }), waiting: () => t('Studio 里在等它需要的服务（inject），没有启动') },
		{ status: plugin.server, failed: (error: string) => t('开发服务器上没能启动：{error}', { error }), waiting: () => t('开发服务器上在等它需要的服务（inject），没有启动') },
	];
	for (const { status, failed, waiting } of places) {
		if (status?.state === 'failed') return { text: failed(status.error ?? ''), error: true };
		if (status?.state === 'waiting') return { text: waiting(), error: true };
	}
	return { text: t('运行中'), error: false };
}

/**
 * 设置 › 插件: the project's plugins (plugins/<name>/), each turned on or off in the Studio. Off, its studio.ts and
 * server.mjs are taken out at once (all they registered undone); the blog's build and its pages use it all the same.
 * Kept in the Studio's settings, not in git.
 */
export function PluginSettings({ host }: { host: PluginsHost }) {
	const [plugins, setPlugins] = useState<PluginEntry[] | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [status, setStatus] = useState({ text: '', error: false });
	const say = (text: string, error = false) => setStatus({ text, error });

	useEffect(() => {
		listPlugins().then(setPlugins, (error: unknown) => say(errorText(error, t('读不到插件')), true));
	}, []);

	async function turn(plugin: PluginEntry, enabled: boolean): Promise<void> {
		setBusy(plugin.id);
		say(enabled ? t('正在打开 {id}…', { id: plugin.id }) : t('正在关闭 {id}…', { id: plugin.id }));
		try {
			const listed = await setPluginEnabled(plugin.id, enabled);
			await host.setEnabled(plugin.id, enabled);
			setPlugins(listed);
			say(enabled ? t('已打开 {id}', { id: plugin.id }) : t('已关闭 {id}；它在 Studio 里注册的东西都撤掉了', { id: plugin.id }));
		} catch (error) {
			say(errorText(error, t('没能改成')), true);
		} finally {
			setBusy(null);
		}
	}

	return (
		<>
			<ul id="plugins-list" className="grid gap-0.5">
				{plugins?.map((plugin) => {
					const inStudio = plugin.entries.includes('studio.ts') || plugin.entries.includes('server.mjs');
					const info = plugin.entries.includes('studio.ts') ? host.info(plugin.id) : null;
					const state = stateOf(plugin, info?.status ?? null);
					return (
						<li key={plugin.id} className="plugin-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 rounded-md px-2 py-2.5 hover:bg-muted" data-plugin={plugin.id}>
							<div className="grid min-w-0 gap-0.5">
								<strong className="font-mono text-[13px] font-semibold text-accent-foreground">{plugin.id}</strong>
								{info?.description && <span className="text-xs leading-normal">{info.description}</span>}
								<span className="text-xs text-muted-foreground">{plugin.entries.map((entry) => ENVIRONMENTS[entry]).join(' · ')}</span>
								<span className={cn('plugin-state text-xs text-muted-foreground', state.error && 'is-error text-destructive')}>{inStudio ? state.text : t('只用于博客的构建和页面，这里没有可关的')}</span>
							</div>
							{inStudio && <Switch checked={plugin.enabled} disabled={busy === plugin.id} aria-label={t('启用插件 {id}', { id: plugin.id })} onCheckedChange={(on) => void turn(plugin, on)} />}
						</li>
					);
				})}
				{plugins?.length === 0 && <li className="px-2 py-3.5 text-xs text-muted-foreground">{t('plugins/ 里还没有插件')}</li>}
			</ul>
			<Status id="plugins-status" {...status} />
		</>
	);
}
