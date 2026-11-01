import { useEffect, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { Input } from '@studio/ui/input';
import { retainpdfSettings, saveRetainpdf, type RetainpdfShown } from '../../api/client';
import { Field } from './AiSettings';
import { Actions, errorText, Status } from './Frame';

/** 设置 › RetainPDF: where its pages are, for 翻译 in the left column; empty is the default (its desktop app's). */
export function RetainpdfSettings() {
	const [shown, setShown] = useState<RetainpdfShown | null>(null);
	const [url, setUrl] = useState('');
	const [status, setStatus] = useState({ text: '', error: false });
	useEffect(() => {
		retainpdfSettings().then(
			(settings) => {
				setShown(settings);
				setUrl(settings.isDefault ? '' : settings.url);
			},
			(error: unknown) => setStatus({ text: errorText(error, t('读不到 RetainPDF 的地址')), error: true }),
		);
	}, []);
	if (!shown) return <Status id="retainpdf-status" {...status} />;
	return (
		<form
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				setStatus({ text: t('正在保存…'), error: false });
				saveRetainpdf(url).then(
					(settings) => {
						setShown(settings);
						setUrl(settings.isDefault ? '' : settings.url);
						setStatus({ text: t('已保存，下次打开「翻译」时用这个地址'), error: false });
					},
					(error: unknown) => setStatus({ text: errorText(error, t('没能保存')), error: true }),
				);
			}}
		>
			<Field label={t('地址')}>
				<Input id="retainpdf-url" autoComplete="off" spellCheck={false} value={url} placeholder={shown.default} onChange={(event) => setUrl(event.target.value)} />
			</Field>
			<small className="-mt-2 text-xs leading-normal text-muted-foreground">{t('空着就是 RetainPDF 桌面版和开发环境的默认地址。')}</small>
			<Status id="retainpdf-status" {...status} />
			<Actions>
				<Button type="submit" size="sm">
					{t('保存')}
				</Button>
			</Actions>
		</form>
	);
}
