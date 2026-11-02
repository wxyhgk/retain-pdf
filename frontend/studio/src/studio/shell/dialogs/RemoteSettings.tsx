import { useEffect, useRef, useState } from 'react';
import { renderSVG } from 'uqr';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { Switch } from '@studio/ui/switch';
import { remoteAccess, remotePairing, removeRemoteDevice, setRemoteAccess, type RemoteShown } from '../../api/client';
import { errorText, Status } from './Frame';

const when = (time: number) => new Date(time).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * 设置 › 其他设备访问: the door for the author's other devices (server/remote/remote-access.mjs), on or off; where they
 * come in by (a browser: its https address; the certificate's fingerprint to check its warning against); a code to pair
 * with (5 minutes, once), a QR code for the Studio's iPad app, typed into a browser's page; the devices paired, each to
 * remove.
 */
export function RemoteSettings() {
	const [shown, setShown] = useState<RemoteShown | null>(null);
	const [pairing, setPairing] = useState<{ code: string; expires: number; svg: string } | null>(null);
	const [now, setNow] = useState(Date.now());
	const [status, setStatus] = useState({ text: '', error: false });
	const paired = useRef(0);
	const say = (text: string, error = false) => setStatus({ text, error });
	const load = () =>
		remoteAccess().then(
			(next) => {
				setShown(next);
				return next;
			},
			(error: unknown) => {
				say(errorText(error, t('读不到其他设备访问的设置')), true);
				return null;
			},
		);
	useEffect(() => void load(), []);

	// While a code is shown: the time it has left, and the device it pairs, once it does.
	useEffect(() => {
		if (!pairing) return;
		const timer = window.setInterval(() => {
			setNow(Date.now());
			if (Date.now() > pairing.expires) setPairing(null);
			void load().then((next) => {
				if (next && next.devices.length > paired.current) {
					setPairing(null);
					say(t('已配对「{name}」', { name: next.devices.at(-1)!.name }));
				}
			});
		}, 2000);
		return () => window.clearInterval(timer);
	}, [pairing]);

	async function turn(on: boolean): Promise<void> {
		say(on ? t('正在打开…') : t('正在关闭…'));
		try {
			setShown(await setRemoteAccess(on));
			setPairing(null);
			say('');
		} catch (error) {
			say(errorText(error, t('没能打开')), true);
		}
	}

	async function pair(): Promise<void> {
		try {
			const { code, expires, pairing: told } = await remotePairing();
			paired.current = shown?.devices.length ?? 0;
			// Black on white whatever the theme: a camera reads it so.
			setPairing({ code, expires, svg: renderSVG(told, { ecc: 'M', pixelSize: 5, border: 2, whiteColor: '#fff', blackColor: '#000' }) });
			setNow(Date.now());
			say('');
		} catch (error) {
			say(errorText(error, t('没能生成配对码')), true);
		}
	}

	if (!shown) return <Status id="remote-status" {...status} />;
	const left = pairing ? Math.max(0, Math.round((pairing.expires - now) / 1000)) : 0;
	return (
		<div className="grid gap-5">
			<label className="flex items-center justify-between gap-4">
				<span className="grid gap-0.5">
					<span className="text-[13px] text-foreground">{t('允许别的设备访问这台 Mac 上的 Studio')}</span>
					<span className="text-xs text-muted-foreground">{t('经局域网或 Tailscale；只有配对过的设备能进，传的东西都加密')}</span>
				</span>
				<Switch id="remote-enabled" checked={shown.enabled && shown.running} onCheckedChange={(on) => void turn(on)} />
			</label>
			{shown.running && (
				<>
					<div className="grid gap-1 text-[12px]">
						<span className="text-xs text-muted-foreground">{t('别的电脑在浏览器里打开这些地址，iPad 用 Studio 的 App 扫码')}</span>
						{shown.addresses.map((address) => (
							<span key={address.host} className="remote-address flex items-baseline gap-2">
								<span className="w-16 shrink-0 text-xs text-muted-foreground">{address.kind === 'tailscale' ? 'Tailscale' : t('局域网')}</span>
								<span className="font-mono select-all">https://{address.host}:{shown.port}</span>
							</span>
						))}
						{!shown.addresses.some((address) => address.kind === 'tailscale') && <span className="text-xs text-muted-foreground">{t('打开 Tailscale（两边登录同一个账号）后出门也能连')}</span>}
					</div>
					{shown.fingerprint && (
						<div className="grid gap-1">
							<span className="text-xs text-muted-foreground">{t('浏览器会提示证书不受信任（证书是 Studio 自己生成的）：点开它的证书，SHA-256 指纹和下面一样再继续；不一样就别继续')}</span>
							<span id="remote-fingerprint" className="font-mono text-xs leading-relaxed break-all text-foreground select-all">{shown.fingerprint}</span>
						</div>
					)}
					{pairing ? (
						<div id="remote-pairing" className="grid justify-items-center gap-2 rounded-lg border border-border p-4">
							<div className="remote-qr size-[208px] rounded bg-white p-1 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: pairing.svg }} />
							<span className="text-[12px] text-muted-foreground">{t('iPad 用 Studio 的 App 扫这个码；浏览器里输入：')}</span>
							<span id="remote-code" className="font-mono text-[18px] tracking-[0.2em] text-foreground">{pairing.code}</span>
							<span className="text-xs text-muted-foreground">{t('{seconds} 秒后失效，只能用一次', { seconds: left })}</span>
						</div>
					) : (
						<Button id="remote-pair" type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => void pair()}>
							{t('配对一台设备')}
						</Button>
					)}
					<div className="grid gap-1">
						<span className="text-xs text-muted-foreground">{t('配对过的设备')}</span>
						{shown.devices.length === 0 && <span className="text-[12px] text-muted-foreground">{t('还没有')}</span>}
						{shown.devices.map((device) => (
							<div key={device.id} className="remote-device flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--studio-fill)]">
								<span className="grid gap-px">
									<span className="text-[13px] text-foreground">{device.name}<span className="ml-1.5 text-xs text-muted-foreground">{device.kind === 'browser' ? t('浏览器') : 'App'}</span></span>
									<span className="text-xs text-muted-foreground">{t('{added} 配对', { added: when(device.added) })}{device.seen ? ` · ${t('{seen} 用过', { seen: when(device.seen) })}` : ''}</span>
								</span>
								<Button type="button" size="xs" variant="outline" onClick={() => void removeRemoteDevice(device.id).then(setShown, (error: unknown) => say(errorText(error, t('没能移除')), true))}>
									{t('移除')}
								</Button>
							</div>
						))}
					</div>
				</>
			)}
			<Status id="remote-status" {...status} />
		</div>
	);
}
