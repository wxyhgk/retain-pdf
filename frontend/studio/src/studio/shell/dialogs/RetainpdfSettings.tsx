import { useEffect, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { Input } from '@studio/ui/input';
import { checkRetainpdf, retainpdfSettings, saveRetainpdf, type RetainpdfShown } from '../../api/client';
import { Field } from './AiSettings';
import { Actions, errorText, Status } from './Frame';

/**
 * 设置 › RetainPDF: where its pages are, for 翻译 in the left column; empty is the default (its desktop app's). And its
 * API, for the AIs to read the books (server/retainpdf-library.mjs): its address (empty: the pages', as its desktop app
 * serves both) and its key, kept by the Studio's server and never shown back.
 */
export function RetainpdfSettings() {
	const [shown, setShown] = useState<RetainpdfShown | null>(null);
	const [url, setUrl] = useState('');
	const [apiUrl, setApiUrl] = useState('');
	const [key, setKey] = useState('');
	const [status, setStatus] = useState({ text: '', error: false });
	const take = (settings: RetainpdfShown) => {
		setShown(settings);
		setUrl(settings.isDefault ? '' : settings.url);
		setApiUrl(settings.apiUrl);
		setKey('');
	};
	useEffect(() => {
		retainpdfSettings().then(take, (error: unknown) => setStatus({ text: errorText(error, t('读不到 RetainPDF 的地址')), error: true }));
	}, []);
	if (!shown) return <Status id="retainpdf-status" {...status} />;
	const save = (api: { apiUrl?: string; apiKey?: string }, said: string) => {
		setStatus({ text: t('正在保存…'), error: false });
		saveRetainpdf(url, api).then(
			(settings) => {
				take(settings);
				setStatus({ text: said, error: false });
			},
			(error: unknown) => setStatus({ text: errorText(error, t('没能保存')), error: true }),
		);
	};
	// What is written saved first: it is that which is tried.
	const check = () => {
		setStatus({ text: t('正在连 RetainPDF…'), error: false });
		saveRetainpdf(url, { apiUrl, ...(key.trim() ? { apiKey: key } : {}) })
			.then((settings) => {
				take(settings);
				return checkRetainpdf();
			})
			.then(
			({ books }) => setStatus({ text: t('连上了：书库里有 {count} 本书，AI 能读到', { count: books }), error: false }),
			(error: unknown) => setStatus({ text: errorText(error, t('连不上 RetainPDF')), error: true }),
		);
	};
	return (
		<form
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				save({ apiUrl, ...(key.trim() ? { apiKey: key } : {}) }, t('已保存，下次打开「翻译」时用这个地址'));
			}}
		>
			<Field label={t('地址')}>
				<Input id="retainpdf-url" autoComplete="off" spellCheck={false} value={url} placeholder={shown.default} onChange={(event) => setUrl(event.target.value)} />
			</Field>
			<small className="-mt-2 text-xs leading-normal text-muted-foreground">{t('空着就是 RetainPDF 桌面版和开发环境的默认地址。')}</small>
			<Field label={t('接口地址')}>
				<Input id="retainpdf-api-url" autoComplete="off" spellCheck={false} value={apiUrl} placeholder={shown.url} onChange={(event) => setApiUrl(event.target.value)} />
			</Field>
			<small className="-mt-2 text-xs leading-normal text-muted-foreground">{t('AI 从这里读书库里的书。空着就和上面的地址一样（桌面版是这样）；开发环境的接口在另一个端口，比如 http://127.0.0.1:41000/。')}</small>
			<Field label={t('API 密钥')}>
				<Input id="retainpdf-api-key" type="password" autoComplete="off" value={key} placeholder={shown.keySet ? t('已保存（不改就空着）') : t('RetainPDF 的 X-API-Key')} onChange={(event) => setKey(event.target.value)} />
			</Field>
			<Status id="retainpdf-status" {...status} />
			<Actions>
				{shown.keySet ? (
					<Button type="button" size="sm" variant="ghost" id="retainpdf-forget-key" onClick={() => save({ apiKey: '' }, t('已删掉密钥'))}>
						{t('删掉密钥')}
					</Button>
				) : null}
				<Button type="button" size="sm" variant="outline" id="retainpdf-check" onClick={check}>
					{t('测试连接')}
				</Button>
				<Button type="submit" size="sm">
					{t('保存')}
				</Button>
			</Actions>
		</form>
	);
}
