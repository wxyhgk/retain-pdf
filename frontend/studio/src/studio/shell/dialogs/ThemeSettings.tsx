import { useState } from 'react';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { setTheme, themeChoice, type ThemeChoice } from '../../common/theme';

/** 设置 › 外观: light, dark, or the system's (followed as it changes); shown at once. */
export function ThemeSettings() {
	const [chosen, setChosen] = useState(themeChoice);
	const choices: Array<{ id: ThemeChoice; label: string; icon: LucideIcon }> = [
		{ id: 'system', label: t('跟随系统'), icon: Monitor },
		{ id: 'light', label: t('亮色'), icon: Sun },
		{ id: 'dark', label: t('暗色'), icon: Moon },
	];
	return (
		<div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('外观')}>
			{choices.map((choice) => (
				<button
					key={choice.id}
					type="button"
					role="radio"
					data-theme-choice={choice.id}
					aria-checked={chosen === choice.id}
					className={cn(
						'flex h-20 flex-col items-center justify-center gap-2 rounded-lg border border-border text-[13px] text-muted-foreground transition-colors hover:bg-[var(--studio-fill)]',
						chosen === choice.id && 'border-foreground font-medium text-foreground',
					)}
					onClick={() => {
						setTheme(choice.id);
						setChosen(choice.id);
					}}
				>
					<choice.icon aria-hidden className="size-5" />
					{choice.label}
				</button>
			))}
		</div>
	);
}
