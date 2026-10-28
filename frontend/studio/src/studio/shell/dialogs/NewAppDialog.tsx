import { useRef, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { Button } from '@studio/ui/button';
import { Input } from '@studio/ui/input';
import { Actions, Frame } from './Frame';

/** What a new app starts as (the server's templates). */
export type AppTemplate = 'page' | 'react';

/** 新建小程序: its name and what it starts as; `done` hears them, or null when given up. */
export type NewAppAsk = { done(asked: { name: string; template: AppTemplate } | null): void };

const TEMPLATES: Array<{ key: AppTemplate; label: string; about: string }> = [
	{ key: 'page', label: t('一页网页'), about: t('一个 HTML 文件，改了保存就看到。小工具、换算、生成输入文件') },
	{ key: 'react', label: t('React + TypeScript 项目'), about: t('Vite 跑的项目，热更新，能装 npm 包、写后端。编辑器、可视化这类大一点的') },
];

export function NewAppDialog({ done, onClose }: NewAppAsk & { onClose(): void }) {
	const [name, setName] = useState('');
	const [template, setTemplate] = useState<AppTemplate>('page');
	const field = useRef<HTMLInputElement>(null);
	const answer = (asked: { name: string; template: AppTemplate } | null) => {
		done(asked);
		onClose();
	};
	const make = () => name.trim() && answer({ name: name.trim(), template });
	return (
		<Frame id="new-app-dialog" title={t('新建小程序')} description={t('起个名字，选它从什么开始；建好后在 AI 面板里说你想要什么，AI 来写。')} focus={() => field.current} onClose={() => answer(null)}>
			<Input
				ref={field}
				id="new-app-name"
				value={name}
				placeholder={t('名字，比如「能量单位换算」')}
				onChange={(event) => setName(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' && !event.nativeEvent.isComposing) make();
				}}
			/>
			<div className="grid gap-2" role="radiogroup" aria-label={t('从什么开始')}>
				{TEMPLATES.map((entry) => (
					<button
						key={entry.key}
						type="button"
						role="radio"
						aria-checked={template === entry.key}
						className={cn('grid gap-0.5 rounded-md border px-3 py-2 text-left text-sm', template === entry.key ? 'border-foreground' : 'border-border')}
						onClick={() => setTemplate(entry.key)}
					>
						<span className="font-medium">{entry.label}</span>
						<span className="text-xs text-muted-foreground">{entry.about}</span>
					</button>
				))}
			</div>
			<Actions>
				<Button type="button" variant="outline" size="sm" onClick={() => answer(null)}>
					{t('取消')}
				</Button>
				<Button id="new-app-make" type="button" size="sm" disabled={!name.trim()} onClick={make}>
					{t('新建')}
				</Button>
			</Actions>
		</Frame>
	);
}
