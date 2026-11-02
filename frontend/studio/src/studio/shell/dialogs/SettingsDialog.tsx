import { useRef, useState } from 'react';
import { BookOpen, FileCode, Languages, Palette, Puzzle, Search, Sparkles, Tablet, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@studio/ui/dialog';
import type { AiSettingsShown } from '../../api/client';
import { AiSettings } from './AiSettings';
import { FileOpenSettings } from './FileOpenSettings';
import { RemoteSettings } from './RemoteSettings';
import { ThemeSettings } from './ThemeSettings';
import { LocaleSettings } from './LocaleSettings';
import { RetainpdfSettings } from './RetainpdfSettings';
import { PluginSettings, type PluginsHost } from './PluginSettings';

export type SettingsSection = 'locale' | 'theme' | 'files' | 'remote' | 'retainpdf' | 'ai' | 'plugins';

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
			entries: [
				{ id: 'locale', label: t('语言'), icon: Languages, title: t('语言'), description: t('Studio 界面和提示用的语言。存在这台电脑上（.studio-settings.json，不进 git）'), words: t('language locale 界面 中文 english') },
				{ id: 'theme', label: t('外观'), icon: Palette, title: t('外观'), description: t('亮色、暗色，或者跟着系统变。博客的页面也一样。存在这个浏览器里，马上生效'), words: t('theme dark light 暗色 亮色 深色 浅色 黑 白 夜间 外观 主题') },
				{ id: 'files', label: t('打开文件'), icon: FileCode, title: t('打开文件'), description: t('点文章里指向文件的链接（脚本、数据、PDF……）时怎么打开：在 Studio 里、用默认程序（比如 VS Code、预览）、在 Finder 中显示。存在这个浏览器里，改了马上生效'), words: t('file open 文件 打开 默认程序 finder vscode 附件 链接 点击') },
				{ id: 'remote', label: t('其他设备访问'), icon: Tablet, title: t('其他设备访问'), description: t('让配对过的别的电脑（浏览器）或 iPad 经局域网或 Tailscale 用这台 Mac 上的 Studio：文章、AI、终端都在 Mac 上跑。默认关着'), words: t('ipad iphone 远程 remote tailscale 局域网 配对 扫码 二维码 手机 平板 浏览器 电脑 browser 网页') },
				{ id: 'retainpdf', label: 'RetainPDF', icon: BookOpen, title: 'RetainPDF', description: t('左栏「书库」打开的 RetainPDF 页面在哪里。存在这台电脑上（.studio-settings.json，不进 git）'), words: t('retainpdf pdf 翻译 书 阅读 地址 端口 translate') },
			],
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
 * (识别图片), 插件, 打开文件. Opened from the workspace's menu at the foot of the left column, or by what wants an AI setting.
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
							<span className="px-2 pb-0.5 text-xs text-muted-foreground">{group.name}</span>
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
							{shown === 'theme' && <ThemeSettings />}
							{shown === 'files' && <FileOpenSettings />}
							{shown === 'remote' && <RemoteSettings />}
							{shown === 'retainpdf' && <RetainpdfSettings />}
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
