import { useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { NativeSelect, NativeSelectOption } from '@studio/ui/native-select';
import { saveLocale, type LocalesShown } from '../../api/client';
import { Field } from './AiSettingsDialog';
import { Actions, errorText, Frame, Status } from './Frame';

/** 语言: the Studio's, chosen among those there are, or the system's; the page loaded again in it. */
export function LocaleDialog({ shown, onClose }: { shown: LocalesShown; onClose(): void }) {
	const [chosen, setChosen] = useState(shown.chosen);
	const [status, setStatus] = useState({ text: '', error: false });
	return (
		<Frame id="locale-dialog" title={t('语言')} description={t('Studio 界面和提示用的语言。存在这台电脑上（.studio-settings.json，不进 git）')} onClose={onClose}>
			<form
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					setStatus({ text: t('正在保存…'), error: false });
					saveLocale(chosen).then(
						() => window.location.reload(),
						(error: unknown) => setStatus({ text: errorText(error, t('没能保存')), error: true }),
					);
				}}
			>
				<Field label={t('语言')}>
					<NativeSelect id="studio-locale" className="w-full" value={chosen} onChange={(event) => setChosen(event.target.value)}>
						<NativeSelectOption value="system">{t('跟随系统')}</NativeSelectOption>
						{shown.locales.map((entry) => (
							<NativeSelectOption key={entry.id} value={entry.id}>
								{entry.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Status id="locale-status" {...status} />
				<Actions>
					<Button type="button" variant="outline" size="sm" onClick={onClose}>
						{t('取消')}
					</Button>
					<Button type="submit" size="sm">
						{t('保存')}
					</Button>
				</Actions>
			</form>
		</Frame>
	);
}
