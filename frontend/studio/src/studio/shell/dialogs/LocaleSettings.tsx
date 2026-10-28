import { useEffect, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { NativeSelect, NativeSelectOption } from '@studio/ui/native-select';
import { localeSettings, saveLocale, type LocalesShown } from '../../api/client';
import { Field } from './AiSettings';
import { Actions, errorText, Status } from './Frame';

/** 设置 › 语言: the Studio's, chosen among those there are, or the system's; the page loaded again in it. */
export function LocaleSettings() {
	const [shown, setShown] = useState<LocalesShown | null>(null);
	const [chosen, setChosen] = useState('system');
	const [status, setStatus] = useState({ text: '', error: false });
	useEffect(() => {
		localeSettings().then(
			(locales) => {
				setShown(locales);
				setChosen(locales.chosen);
			},
			(error: unknown) => setStatus({ text: errorText(error, t('读不到语言设置')), error: true }),
		);
	}, []);
	if (!shown) return <Status id="locale-status" {...status} />;
	return (
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
				<Button type="submit" size="sm">
					{t('保存')}
				</Button>
			</Actions>
		</form>
	);
}
