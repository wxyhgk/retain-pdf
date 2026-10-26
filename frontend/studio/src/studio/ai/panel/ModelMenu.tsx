import { useState, type ReactNode } from 'react';

import { Check, ChevronDown, KeyRound, Star } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@studio/ui/dropdown-menu';
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

/**
 * The model, as Notion's: its name under the input; chosen from a menu of the starred ones, those of the service the
 * conversation runs for, each other service (another's models, or one to give a key to in ⚙), and at its foot which
 * AI runs it and what it may do without asking. Another service's or AI's: the conversation gone on with by it.
 */
export function ModelMenu({ state, actions }: { state: PanelState; actions: PanelActions }) {
	const { conversation, agents, favorites, switching } = state;
	const [services, setServices] = useState<MenuService[]>([]);
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
	const label = switching ? t('正在换…') : current ? modelName(current) : (agent?.name ?? 'AI');

	/** One of this conversation's models, as a starred one keeps it (Claude Code's by its service). */
	const ours = (choice: Choice): ModelChoice => ({ agent: agentId, provider: kind === 'claude' ? here : null, value: choice.value, name: modelName(choice) });
	const isCurrent = (choice: ModelChoice) => choice.agent === agentId && choice.value === String(model?.currentValue) && (kind !== 'claude' || (choice.provider ?? here) === here);

	const item = (choice: ModelChoice, key: string, note?: string) => {
		const starred = favorites.some((entry) => sameChoice(entry, choice));
		return (
			<DropdownMenuItem key={key} className="ai-menu-item ai-model-item" disabled={busy} onSelect={() => actions.switchTo(choice)}>
				<span className="ai-model-name">{choice.name}</span>
				{note && <span className="ai-model-note">{note}</span>}
				<button
					type="button"
					className={cn('ai-model-star', starred && 'is-starred')}
					aria-label={starred ? t('取消常用') : t('设为常用')}
					title={starred ? t('取消常用') : t('设为常用')}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						actions.toggleFavorite(choice);
					}}
				>
					<Star aria-hidden />
				</button>
				<Check className={cn('ai-model-check', !isCurrent(choice) && 'is-off')} aria-hidden />
			</DropdownMenuItem>
		);
	};
	const needsKey = (service: MenuService) => (
		<DropdownMenuItem key={service.id} className="ai-menu-item ai-model-keyless" onSelect={() => actions.showSheet(true)}>
			<span className="ai-model-name">{service.name}</span>
			<KeyRound className="ml-auto" aria-hidden />
		</DropdownMenuItem>
	);
	const sub = (key: string, title: string, children: ReactNode) => (
		<DropdownMenuSub key={key}>
			<DropdownMenuSubTrigger className="ai-menu-item">{title}</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="ai-menu max-h-[70vh] w-60 overflow-y-auto">{children}</DropdownMenuSubContent>
		</DropdownMenuSub>
	);

	// The conversation's models by service: pi's by the service of each (`deepseek/…`), the others' all of one.
	const sections: Array<{ key: string; title: string; models: Choice[] }> = [];
	if (kind === 'pi') {
		for (const choice of choices) {
			const id = choice.value.includes('/') ? choice.value.split('/')[0]! : '';
			let section = sections.find((entry) => entry.key === id);
			if (!section) sections.push((section = { key: id, title: services.find((service) => service.id === id)?.name ?? id, models: [] }));
			section.models.push(choice);
		}
	} else if (choices.length) {
		sections.push({ key: here ?? '', title: (here && services.find((service) => service.id === here)?.name) || (conversation?.service ?? agent?.name ?? ''), models: choices });
	}
	// The section of the model chosen first, open; the others each a submenu.
	const shown = sections.find((section) => section.models.some((choice) => choice.value === current?.value)) ?? sections[0];
	const listed = new Set(sections.map((section) => section.key));
	const others = services.filter((service) => service.id !== here && !listed.has(service.id));

	return (
		<DropdownMenu
			onOpenChange={(open) => {
				if (open) actions.services(agentId).then(setServices, () => setServices([]));
			}}
		>
			<DropdownMenuTrigger asChild>
				<button type="button" className="ai-model" aria-label={t('模型：{name}', { name: label })} title={agent ? t('{model}（{agent} 运行）', { model: label, agent: agent.name }) : label}>
					<span className="ai-model-label">{label}</span>
					<ChevronDown aria-hidden />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="end" className="ai-menu max-h-[70vh] w-64 overflow-y-auto">
				{favorites.length > 0 && (
					<>
						<DropdownMenuLabel className="ai-menu-label">{t('常用')}</DropdownMenuLabel>
						{favorites.map((choice, at) => item(choice, `star-${at}`, choice.agent === agentId ? undefined : agents.find((entry) => entry.id === choice.agent)?.name))}
						<DropdownMenuSeparator />
					</>
				)}
				{shown && (
					<>
						{shown.title && <DropdownMenuLabel className="ai-menu-label">{shown.title}</DropdownMenuLabel>}
						{shown.models.map((choice) => item(ours(choice), `here-${choice.value}`))}
					</>
				)}
				{(sections.length > 1 || others.length > 0) && <DropdownMenuSeparator />}
				{sections.filter((section) => section !== shown).map((section) => sub(`section-${section.key}`, section.title, section.models.map((choice) => item(ours(choice), choice.value))))}
				{others.map((service) => {
					if (!service.usable) return null;
					// Claude Code's other services: their models; one that names none (Anthropic's), its own.
					if (!service.models.length) return item({ agent: agentId, provider: service.id, value: '', name: service.name }, `service-${service.id}`);
					return sub(`service-${service.id}`, service.name, service.models.map((choice) => item({ agent: agentId, provider: service.id, value: choice.value, name: modelName(choice) }, choice.value)));
				})}
				{/* The services with no key yet, together: each opens ⚙ to give it one. */}
				{others.some((service) => !service.usable) && sub('keyless', t('更多模型来源'), others.filter((service) => !service.usable).map(needsKey))}
				<DropdownMenuSeparator />
				{sub(
					'agent',
					t('用 {name} 运行', { name: agent?.name ?? 'AI' }),
					<DropdownMenuRadioGroup value={agentId} onValueChange={actions.chooseAgent}>
						{agents.map((entry) => (
							<DropdownMenuRadioItem key={entry.id} value={entry.id} className="ai-menu-item" disabled={busy}>
								{entry.name}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>,
				)}
				{mode &&
					sub(
						'mode',
						t('权限：{name}', { name: OPTION_NAMES[String(mode.currentValue)] ?? choicesOf(mode).find((choice) => choice.value === String(mode.currentValue))?.name ?? '' }),
						<DropdownMenuRadioGroup value={String(mode.currentValue)} onValueChange={(value) => actions.setOption(mode.id, value)}>
							{choicesOf(mode).map((choice) => (
								<DropdownMenuRadioItem key={choice.value} value={choice.value} className="ai-menu-item">
									{OPTION_NAMES[choice.value] ?? choice.name}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>,
					)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
