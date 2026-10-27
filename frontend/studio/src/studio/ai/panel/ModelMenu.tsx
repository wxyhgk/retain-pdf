import { useRef, useState, type ReactNode } from 'react';

import { Box, Check, ChevronDown, KeyRound, Search, Star } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@studio/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@studio/ui/popover';
import { LOGOS, type Vendor } from '../logos/logos';
import type { ConversationOption } from '../../api/client';
import { sameChoice, type MenuService, type ModelChoice, type PanelActions, type PanelState } from './panel-state';

/**
 * Names the adapters give in English, said in Chinese as what they let it do without asking (the rest as they come).
 * Claude Code's "accept edits" lets it change files, but asks before a command that does something (python, rm…).
 */
const OPTION_NAMES: Record<string, string> = {
	default: t('每步都问'),
	acceptEdits: t('自动改文件（命令要问）'),
	plan: t('只做计划'),
	auto: t('自动（只问危险的）'),
	bypassPermissions: t('全部允许（不再问）'),
	'read-only': t('只读（改动都要问）'),
	'workspace-write': t('可改文件夹（联网要问）'),
	agent: t('自动（只问不安全的）'),
	'agent-full-access': t('完全访问（不再问）'),
};
const LEVEL_NAMES: Record<string, string> = { default: t('默认'), low: t('低'), medium: t('中'), high: t('高'), xhigh: t('很高'), max: t('最高'), ultra: t('极限') };
/** Names written as their makers write them, in a model's id made readable. */
const SPELLED: Record<string, string> = { deepseek: 'DeepSeek', gpt: 'GPT', glm: 'GLM', kimi: 'Kimi', qwen: 'Qwen', minimax: 'MiniMax', grok: 'Grok', gemini: 'Gemini', mimo: 'MiMo', o3: 'o3', o4: 'o4' };

type Choice = { value: string; name: string; description?: string | null };

const choicesOf = (option: ConversationOption | undefined): Choice[] => (option?.options ?? []).flatMap((entry) => ('options' in entry ? entry.options : [entry]));

/**
 * A model as the menu names it: what its adapter calls it, an id made readable (`deepseek/deepseek-v4-pro` →
 * DeepSeek V4 Pro, `claude-haiku-4-5` → Haiku 4.5); Claude Code's default, by the model it stands for.
 */
export function modelName(choice: Choice): string {
	if (choice.value === 'default' && choice.description && choice.description.length <= 24) return choice.description;
	const name = choice.name.trim();
	if (!/^[a-z0-9][\w.:-]*(\/[\w.:-]+)?$/u.test(name)) return name;
	const id = name.split('/').pop()!.replace(/-\d{8}$/u, '').replace(/^claude-/u, '');
	const words = id.split(/[-_]/u);
	const out: string[] = [];
	for (const word of words) {
		// Versions written with dots: 4-5 → 4.5.
		if (/^\d+$/u.test(word) && /\d$/u.test(out.at(-1) ?? '')) out[out.length - 1] += `.${word}`;
		else out.push(SPELLED[word] ?? (/^[a-z]\d/u.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)));
	}
	return out.join(' ');
}

/** How hard it thinks, as bars: as many filled as the level is high among those it has. */
function Bars({ level, of }: { level: number; of: number }) {
	const filled = of > 1 ? Math.max(1, Math.round(((level + 1) / of) * 4)) : 4;
	return (
		<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
			{[0, 1, 2, 3].map((at) => (
				<rect key={at} x={1 + at * 4} y={12 - at * 3} width="2.4" height={3 + at * 3} rx="1" fill="currentColor" opacity={at < filled ? 1 : 0.25} />
			))}
		</svg>
	);
}

/** How hard it thinks (the conversation's thought_level option): bars, a level chosen from a menu. */
export function EffortMenu({ option, onChange }: { option: ConversationOption; onChange(value: string): void }) {
	const choices = choicesOf(option);
	const at = Math.max(0, choices.findIndex((choice) => choice.value === String(option.currentValue)));
	const named = (choice: Choice) => LEVEL_NAMES[choice.value] ?? choice.name;
	const label = choices[at] ? t('思考：{level}', { level: named(choices[at]) }) : option.name;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button type="button" className="ai-effort" title={label} aria-label={label}>
					<Bars level={at} of={choices.length} />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="end" className="ai-menu w-40">
				<DropdownMenuLabel className="ai-menu-label">{t('思考强度')}</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={String(option.currentValue)} onValueChange={onChange}>
					{choices.map((choice) => (
						<DropdownMenuRadioItem key={choice.value} value={choice.value} className="ai-menu-item">
							{named(choice)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** The makers, in the order the picker groups their models, with the names their groups go by. */
const VENDORS: Array<{ id: Vendor; name: string; match: RegExp }> = [
	{ id: 'claude', name: 'Claude', match: /claude|anthropic|opus|sonnet|haiku|fable/u },
	{ id: 'openai', name: 'OpenAI', match: /gpt|openai|codex|\bo[134]\b/u },
	{ id: 'gemini', name: 'Gemini', match: /gemini|google/u },
	{ id: 'deepseek', name: 'DeepSeek', match: /deepseek/u },
	{ id: 'kimi', name: 'Kimi', match: /kimi|moonshot/u },
	{ id: 'qwen', name: t('通义千问'), match: /qwen|tongyi/u },
	{ id: 'zhipu', name: t('智谱 GLM'), match: /glm|zhipu|zai/u },
	{ id: 'minimax', name: 'MiniMax', match: /minimax/u },
	{ id: 'grok', name: 'Grok', match: /grok|xai/u },
	{ id: 'xiaomi', name: t('小米 MiMo'), match: /mimo|xiaomi/u },
	{ id: 'openrouter', name: 'OpenRouter', match: /openrouter/u },
];

/** Whose model it is, by its id, its name, the service it is had through (by its id: Claude Code's tiers, through the Claude account, are Claude's). */
function vendorOf(...said: Array<string | null | undefined>): Vendor | null {
	const text = said.filter(Boolean).join(' ').toLowerCase();
	return VENDORS.find((vendor) => vendor.match.test(text))?.id ?? null;
}

/** A maker's logo: in its own colours in the picker, in one colour (the words') under the input. */
export function Logo({ vendor, color = false }: { vendor: Vendor | null; color?: boolean }) {
	if (!vendor) return <Box className="ai-logo is-none" aria-hidden />;
	// Our own copies of their SVGs (logos.ts), nothing of the page's.
	return <span className="ai-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: color ? LOGOS[vendor].color : LOGOS[vendor].mono }} />;
}

/** A name without its maker's (the logo says it): DeepSeek V4 Pro → V4 Pro, Claude Haiku 5.5 → Haiku 5.5. */
function shortName(name: string, vendor: Vendor | null): string {
	const maker = VENDORS.find((entry) => entry.id === vendor);
	const words = [maker?.name, vendor === 'claude' ? 'Claude' : '', vendor === 'kimi' ? 'Kimi' : ''].filter(Boolean) as string[];
	for (const word of words) {
		if (name.toLowerCase().startsWith(`${word.toLowerCase()} `) && name.length > word.length + 1) return name.slice(word.length + 1);
	}
	return name;
}

/** A model as the picker lists it: what choosing it does, whose it is, its names, how it is paid for. */
type Entry = { key: string; choice: ModelChoice; vendor: Vendor | null; name: string; via: 'account' | 'key' | null };

/**
 * The model, as Notion's: its maker's logo and its name under the input; chosen from a picker of the starred ones and
 * each maker's (with whether a subscription account or an API key pays for it), found by typing its name; at its foot,
 * which AI runs it and what it may do without asking. Another service's or AI's: the conversation gone on with by it.
 */
export function ModelMenu({ state, actions }: { state: PanelState; actions: PanelActions }) {
	const { conversation, agents, favorites, switching } = state;
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [active, setActive] = useState(0);
	const [services, setServices] = useState<MenuService[]>([]);
	const list = useRef<HTMLDivElement>(null);
	const agentId = conversation?.agent.id ?? state.agent;
	const agent = agents.find((entry) => entry.id === agentId);
	const kind = agent?.kind ?? 'other';
	const options = conversation?.configOptions ?? [];
	const model = options.find((option) => option.category === 'model' && option.type === 'select');
	const mode = options.find((option) => option.category === 'mode' && option.type === 'select');
	const choices = choicesOf(model);
	const current = choices.find((choice) => choice.value === String(model?.currentValue));
	const here = conversation ? actions.currentService(conversation) : null;
	const busy = conversation?.state === 'running' || conversation?.state === 'starting' || switching;
	/** How a service is paid for: Claude's account a subscription; one with a key, by use. */
	const viaOf = (service: string | null): Entry['via'] => (service === 'claude-account' ? 'account' : service && service !== 'pi-own' ? 'key' : null);

	/** The service its models are had through, telling whose they are (pi's say so themselves: `deepseek/…`). */
	const through = kind === 'pi' ? null : here;
	// Every model it can choose: the conversation's (pi's by their service), the other services' (Claude Code's).
	const entries: Entry[] = [];
	for (const choice of choices) {
		const named = modelName(choice);
		const provider = kind === 'pi' && choice.value.includes('/') ? choice.value.split('/')[0]! : here;
		const vendor = vendorOf(choice.value, named, choice.description, through);
		entries.push({ key: `here:${choice.value}`, choice: { agent: agentId, provider: kind === 'claude' ? here : null, value: choice.value, name: named }, vendor, name: named, via: viaOf(provider) });
	}
	for (const service of services) {
		if (!service.usable || service.id === here || kind !== 'claude') continue;
		const models = service.models.length ? service.models : [{ value: '', name: t('默认模型') }];
		for (const choice of models) {
			const named = choice.value ? modelName(choice) : choice.name;
			const vendor = vendorOf(choice.value, named, service.id);
			entries.push({ key: `${service.id}:${choice.value}`, choice: { agent: agentId, provider: service.id, value: choice.value, name: named }, vendor, name: named, via: viaOf(service.id) });
		}
	}
	const keyless = services.filter((service) => !service.usable);
	const isCurrent = (choice: ModelChoice) => choice.agent === agentId && choice.value === String(model?.currentValue) && (kind !== 'claude' || (choice.provider ?? here) === here);

	// What the picker lists: the starred first, then each maker's; as typed for, those whose names have it.
	const needle = query.trim().toLowerCase();
	const matches = (entry: Entry) => !needle || [entry.name, VENDORS.find((vendor) => vendor.id === entry.vendor)?.name, entry.choice.value].join(' ').toLowerCase().includes(needle);
	const starred: Entry[] = needle
		? []
		: favorites.map((choice) => entries.find((entry) => sameChoice(entry.choice, choice)) ?? { key: `star:${choice.agent}:${choice.provider}:${choice.value}`, choice, vendor: vendorOf(choice.value, choice.name), name: choice.name, via: viaOf(choice.provider) });
	const groups = [...VENDORS.map((vendor) => vendor.id), null].map((vendor) => ({ vendor, entries: entries.filter((entry) => entry.vendor === vendor && matches(entry)) })).filter((group) => group.entries.length);
	const rows = [...starred, ...groups.flatMap((group) => group.entries)];
	const at = Math.min(active, Math.max(0, rows.length - 1));

	const shownVendor = current ? vendorOf(current.value, modelName(current), current.description, through) : null;
	const label = switching ? t('正在换…') : current ? shortName(modelName(current), shownVendor) : (agent?.name ?? 'AI');

	function choose(entry: Entry): void {
		if (busy) return;
		setOpen(false);
		actions.switchTo(entry.choice);
	}

	function keyDown(event: React.KeyboardEvent): void {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const next = (at + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % Math.max(1, rows.length);
			setActive(next);
			list.current?.querySelector(`[data-row="${next}"]`)?.scrollIntoView({ block: 'nearest' });
		} else if (event.key === 'Enter' && rows[at]) {
			event.preventDefault();
			choose(rows[at]!);
		}
	}

	let index = 0;
	/** One model's row; `short`, under its maker's name (the name without the maker's). */
	const row = (entry: Entry, short = false) => {
		const position = index++;
		const name = short ? shortName(entry.name, entry.vendor) : entry.name;
		const starredNow = favorites.some((choice) => sameChoice(choice, entry.choice));
		return (
			<div
				key={`${position}:${entry.key}`}
				data-row={position}
				role="option"
				aria-selected={position === at}
				aria-disabled={busy}
				className={cn('ai-pick', position === at && 'is-active', isCurrent(entry.choice) && 'is-current')}
				onPointerMove={() => setActive(position)}
				onClick={() => choose(entry)}
			>
				<Logo vendor={entry.vendor} color />
				<span className="ai-pick-name" title={entry.name}>
					{name}
				</span>
				{entry.via && <span className="ai-pick-via">{entry.via === 'account' ? t('账号') : 'key'}</span>}
				<Check className="ai-pick-check" aria-hidden />
				<button
					type="button"
					className={cn('ai-pick-star', starredNow && 'is-starred')}
					aria-label={starredNow ? t('取消常用') : t('设为常用')}
					title={starredNow ? t('取消常用') : t('设为常用')}
					onClick={(event) => {
						event.stopPropagation();
						actions.toggleFavorite(entry.choice);
					}}
				>
					<Star aria-hidden />
				</button>
			</div>
		);
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) return;
				setQuery('');
				setActive(0);
				actions.services(agentId).then(setServices, () => setServices([]));
			}}
		>
			<PopoverTrigger asChild>
				<button type="button" className="ai-model" aria-label={t('模型：{name}', { name: label })} title={agent ? t('{model}（{agent} 运行）', { model: current ? modelName(current) : label, agent: agent.name }) : label}>
					<Logo vendor={shownVendor} />
					<span className="ai-model-label">{label}</span>
					<ChevronDown aria-hidden />
				</button>
			</PopoverTrigger>
			<PopoverContent side="top" align="end" className="ai-picker" onOpenAutoFocus={(event) => event.preventDefault()}>
				<div className="ai-picker-search">
					<Search aria-hidden />
					<input
						autoFocus
						value={query}
						placeholder={t('搜索模型')}
						aria-label={t('搜索模型')}
						onChange={(event) => {
							setQuery(event.target.value);
							setActive(0);
						}}
						onKeyDown={keyDown}
					/>
				</div>
				<div ref={list} className="ai-picker-list" role="listbox" aria-label={t('模型')}>
					{starred.length > 0 && (
						<>
							<p className="ai-picker-label">{t('常用')}</p>
							{starred.map((entry) => row(entry))}
						</>
					)}
					{groups.map((group) => (
						<div key={group.vendor ?? 'other'} role="group" aria-label={VENDORS.find((vendor) => vendor.id === group.vendor)?.name ?? t('其他')}>
							<p className="ai-picker-label">{VENDORS.find((vendor) => vendor.id === group.vendor)?.name ?? t('其他')}</p>
							{group.entries.map((entry) => row(entry, true))}
						</div>
					))}
					{!rows.length && <p className="ai-picker-empty">{t('没有匹配的模型')}</p>}
					{!needle && keyless.length > 0 && (
						<button
							type="button"
							className="ai-picker-keyless"
							onClick={() => {
								setOpen(false);
								actions.showSheet(true);
							}}
						>
							<KeyRound aria-hidden />
							<span className="ai-pick-name">{keyless.map((service) => service.name).join(' · ')}</span>
							<span className="ai-pick-via">{t('填 key')}</span>
						</button>
					)}
				</div>
				<div className="ai-picker-foot">
					<FootMenu label={t('程序')} value={agent?.name ?? 'AI'} disabled={busy}>
						<DropdownMenuRadioGroup value={agentId} onValueChange={(value) => { setOpen(false); actions.chooseAgent(value); }}>
							{agents.map((entry) => (
								<DropdownMenuRadioItem key={entry.id} value={entry.id} className="ai-menu-item">
									{entry.name}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</FootMenu>
					{mode && (
						<FootMenu label={t('权限')} value={OPTION_NAMES[String(mode.currentValue)] ?? choicesOf(mode).find((choice) => choice.value === String(mode.currentValue))?.name ?? ''}>
							<DropdownMenuRadioGroup
								value={String(mode.currentValue)}
								onValueChange={(value) => {
									setOpen(false);
									actions.setOption(mode.id, value);
								}}
							>
								{choicesOf(mode).map((choice) => (
									<DropdownMenuRadioItem key={choice.value} value={choice.value} className="ai-menu-item">
										{OPTION_NAMES[choice.value] ?? choice.name}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</FootMenu>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** One of the picker's foot: what it is and what it is now, its choices in a menu over it. */
function FootMenu({ label, value, disabled = false, children }: { label: string; value: string; disabled?: boolean; children: ReactNode }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button type="button" className="ai-picker-foot-item" disabled={disabled} aria-label={t('{label}：{value}', { label, value })}>
					<span className="ai-picker-foot-label">{label}</span>
					<span className="ai-picker-foot-value">{value}</span>
					<ChevronDown aria-hidden />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="start" className="ai-menu w-56">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
