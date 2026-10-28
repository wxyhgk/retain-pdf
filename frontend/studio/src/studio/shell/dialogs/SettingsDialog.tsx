import { useRef, useState } from 'react';
import { Languages, Puzzle, Search, Sparkles, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@studio/ui/dialog';
import type { AiSettingsShown } from '../../api/client';
import { AiSettings } from './AiSettings';
import { LocaleSettings } from './LocaleSettings';
import { PluginSettings, type PluginsHost } from './PluginSettings';

export type SettingsSection = 'locale' | 'ai' | 'plugins';

/**
 * 设置 opened at `section`. For want of an AI setting (识别图片): `why` said above it, and `done` told what was saved
 * once it closes (null when nothing was); saved then, it closes by itself, the work asked for going on.
 */
export type SettingsAsk = { section: SettingsSection; plugins: PluginsHost | null; why?: string; done?(settings: AiSettingsShown | null): void };

type Entry = { id: SettingsSection; label: string; icon: LucideIcon; title: string; description: string; words: string };

/** The settings' parts, in groups as the column lists them; `words` are what a search finds them by too. */
function groups(): Array<{ name: string; entries: Entry[] }> {
	return [
		{
			name: t('偏好'),
			entries: [{ id: 'locale', label: t('语言'), icon: Languages, title: t('语言'), description: t('Studio 界面和提示用的语言。存在这台电脑上（.studio-settings.json，不进 git）'), words: t('language locale 界面 中文 english') }],
		},
		{
			name: 'AI',
			entries: [{ id: 'ai', label: t('AI 模型'), icon: Sparkles, title: t('AI 模型'), description: t('识别图片时用的大模型。key 只存在这台电脑上（.studio-settings.json，不进 git）'), words: t('ai key claude openai deepseek 识别 图片 公式 ocr 模型 接口') }],
		},
		{
			name: t('扩展'),
			entries: [{ id: 'plugins', label: t('插件'), icon: Puzzle, title: t('插件'), description: t('plugins/ 里的每个文件夹。关掉只影响 Studio 和开发服务器，马上生效；博客构建和发布的页面照常用全部插件'), words: t('plugins 插件 块 计算 分子 扩展') }],
		},
	];
}

/**
 * 设置, as Notion's: the parts in a column on the left (a search above them), the one chosen on the right — 语言, AI 模型
 * (识别图片), 插件. Opened from the workspace's menu at the foot of the left column, or by what wants an AI setting.
 */
export function SettingsDialog({ section, plugins, why = '', done, onClose }: SettingsAsk & { onClose(): void }) {
	const [shown, setShown] = useState(section);
	const [query, setQuery] = useState('');
	const saved = useRef<AiSettingsShown | null>(null);
	const all = groups();
	const entry = all.flatMap((group) => group.entries).find((each) => each.id === shown)!;
	const asked = query.trim().toLowerCase();
	const found = all
		.map((group) => ({ ...group, entries: group.entries.filter((each) => !asked || `${each.label} ${each.title} ${each.description} ${each.words}`.toLowerCase().includes(asked)) }))
		.filter((group) => group.entries.length);
	const close = () => {
		done?.(saved.current);
		onClose();
	};

	return (
		<Dialog open onOpenChange={(open) => !open && close()}>
			<DialogContent
				id="settings-dialog"
				className="grid h-[min(680px,calc(100vh-2rem))] max-w-[calc(100vw-2rem)] grid-cols-[220px_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[900px]"
				onOpenAutoFocus={(event) => {
					// Opened for an AI setting: the caret goes to the field wanting it (AiSettings), not the search.
					if (why) event.preventDefault();
				}}
			>
				<nav className="flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-border bg-[var(--studio-fill)] p-2.5" aria-label={t('设置')}>
					<label className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-[13px] text-muted-foreground focus-within:border-ring">
						<Search aria-hidden className="size-3.5 flex-none" />
						<input
							id="settings-search"
							className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
							placeholder={t('搜索设置')}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => {
								const first = found[0]?.entries[0];
								if (event.key === 'Enter' && first) setShown(first.id);
							}}
						/>
					</label>
					{found.map((group) => (
						<div key={group.name} className="grid gap-0.5">
							<span className="px-2 pb-0.5 text-[11px] text-muted-foreground">{group.name}</span>
							{group.entries.map((each) => (
								<button
									key={each.id}
									type="button"
									data-section={each.id}
									aria-current={each.id === shown ? 'page' : undefined}
									className={cn(
										'flex h-8 items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-foreground transition-colors hover:bg-[var(--studio-fill-2)]',
										each.id === shown && 'bg-[var(--studio-fill-2)] font-medium',
									)}
									onClick={() => setShown(each.id)}
								>
									<each.icon aria-hidden className="size-4 text-muted-foreground" />
									{each.label}
								</button>
							))}
						</div>
					))}
					{!found.length && <p className="px-2 text-xs text-muted-foreground">{t('没有找到「{query}」', { query: query.trim() })}</p>}
				</nav>
				<section id={`settings-${shown}`} className="min-h-0 overflow-y-auto px-8 pt-9 pb-8 sm:px-14">
					<div className="mx-auto grid max-w-[560px] gap-6">
						<header className="grid gap-1.5 pr-6">
							<DialogTitle className="text-[22px] font-semibold text-accent-foreground">{entry.title}</DialogTitle>
							<DialogDescription className="text-xs leading-normal">{entry.description}</DialogDescription>
						</header>
						<div className="border-t border-border pt-5">
							{shown === 'locale' && <LocaleSettings />}
							{shown === 'ai' && (
								<AiSettings
									why={why}
									onSaved={(settings) => {
										saved.current = settings;
										// Asked for by work waiting on it: that goes on.
										if (why) close();
									}}
								/>
							)}
							{shown === 'plugins' && plugins && <PluginSettings host={plugins} />}
						</div>
					</div>
				</section>
			</DialogContent>
		</Dialog>
	);
}
