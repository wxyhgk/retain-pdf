import { t } from '@blog/i18n/index.mjs';
import type { ComputeHost, JobApi } from './api.ts';
import './hosts-dialog.css';

/**
 * 计算机器: the machines ```job blocks run on, kept with the Studio's
 * settings (server/compute-hosts.mjs). Each is a card: how it is reached (here, or
 * ssh), whether jobs start at once or go to Slurm, where they run, and the
 * programs (each program plugin's, `ctx.jobs`), which 检测 finds. Saved together.
 */
/** A program as the dialog needs it: its name (its key in a machine's programs) and label. */
export type ProgramName = { name: string; label: string };

export function createComputeHostsDialog(api: JobApi, programs: () => ProgramName[]) {
	const dialog = document.createElement('dialog');
	dialog.className = 'article-dialog compute-hosts-dialog';
	dialog.innerHTML = `
		<form onsubmit="return false">
			<div class="dialog-heading">
				<div><strong>${t('计算机器')}</strong><span>${t('计算块在哪里跑：本机、用 SSH 连得上的服务器，或服务器上的 Slurm 队列')}</span></div>
				<button type="button" data-close aria-label="${t('关闭')}">×</button>
			</div>
			<div id="compute-hosts-list"></div>
			<button id="compute-hosts-add" class="compute-hosts-add" type="button">＋ ${t('添加机器')}</button>
			<p id="compute-hosts-error" class="dialog-error" role="alert" hidden></p>
			<div class="dialog-actions">
				<button type="button" data-close>${t('取消')}</button>
				<button id="compute-hosts-save" class="is-primary" type="button">${t('保存')}</button>
			</div>
		</form>`;
	dialog.id = 'compute-hosts-dialog';
	document.body.append(dialog);
	const list = dialog.querySelector<HTMLElement>('#compute-hosts-list')!;
	const error = dialog.querySelector<HTMLElement>('#compute-hosts-error')!;
	const add = dialog.querySelector<HTMLButtonElement>('#compute-hosts-add')!;
	const save = dialog.querySelector<HTMLButtonElement>('#compute-hosts-save')!;
	const cancels = [...dialog.querySelectorAll<HTMLButtonElement>('[data-close]')];
	let closed: (() => void) | null = null;
	let cards: Array<{ root: HTMLElement; read(): ComputeHost }> = [];

	const close = () => {
		dialog.close();
		closed?.();
		closed = null;
	};
	for (const button of cancels) button.addEventListener('click', close);
	dialog.addEventListener('cancel', (event) => {
		event.preventDefault();
		close();
	});

	add.addEventListener('click', () => {
		const taken = new Set(cards.map((card) => card.read().name));
		let index = 1;
		while (taken.has(`server-${index}`)) index += 1;
		const card = hostCard(api, programs(), { name: `server-${index}`, label: '', kind: 'ssh', ssh: '', scheduler: 'direct', workdir: '~/studio-jobs', threads: 8, programs: {}, setup: '' }, remove);
		cards.push(card);
		list.append(card.root);
		card.root.querySelector<HTMLInputElement>('[data-key="ssh"]')?.focus();
	});

	function remove(root: HTMLElement): void {
		cards = cards.filter((card) => card.root !== root);
		root.remove();
	}

	save.addEventListener('click', async () => {
		error.hidden = true;
		save.disabled = true;
		try {
			await api.saveHosts(cards.map((card) => card.read()));
			close();
		} catch (failure) {
			error.textContent = failure instanceof Error ? failure.message : String(failure);
			error.hidden = false;
		} finally {
			save.disabled = false;
		}
	});

	return {
		/** Opens the list; resolves when it is closed, saved or not. */
		async open(): Promise<void> {
			error.hidden = true;
			list.replaceChildren();
			cards = [];
			try {
				for (const host of await api.hosts()) {
					const card = hostCard(api, programs(), host, remove);
					cards.push(card);
					list.append(card.root);
				}
			} catch (failure) {
				error.textContent = failure instanceof Error ? failure.message : String(failure);
				error.hidden = false;
			}
			dialog.showModal();
			return new Promise((resolvePromise) => {
				closed = resolvePromise;
			});
		},
		dispose(): void {
			dialog.remove();
		},
	};
}

function hostCard(api: JobApi, programs: ProgramName[], host: ComputeHost, remove: (root: HTMLElement) => void): { root: HTMLElement; read(): ComputeHost } {
	const root = document.createElement('section');
	root.className = 'host-card';
	const isLocal = host.name === 'local';
	const input = (key: string, value: string, placeholder = '', type = 'text') => {
		const control = document.createElement('input');
		control.type = type;
		control.dataset.key = key;
		control.value = value;
		control.placeholder = placeholder;
		control.autocomplete = 'off';
		control.spellcheck = false;
		return control;
	};
	const choice = (key: string, options: Array<[string, string]>, value: string) => {
		const control = document.createElement('select');
		control.dataset.key = key;
		for (const [optionValue, text] of options) {
			const option = document.createElement('option');
			option.value = optionValue;
			option.textContent = text;
			control.append(option);
		}
		control.value = value;
		return control;
	};
	const label = (text: string, control: HTMLElement, wide = false) => {
		const wrap = document.createElement('label');
		wrap.className = wide ? 'host-field is-wide' : 'host-field';
		const name = document.createElement('span');
		name.textContent = text;
		wrap.append(name, control);
		return wrap;
	};

	const name = input('name', host.name, 'server-1');
	name.readOnly = isLocal;
	const display = input('label', host.label === host.name ? '' : host.label, isLocal ? t('本机') : t('5090 服务器'));
	const kind = choice('kind', [['local', t('本机')], ['ssh', 'SSH']], host.kind);
	kind.disabled = isLocal;
	const ssh = input('ssh', host.ssh ?? '', t('~/.ssh/config 里的 Host，或 用户@地址'));
	const scheduler = choice('scheduler', [['direct', t('直接运行')], ['slurm', t('交给 Slurm 排队')]], host.scheduler);
	const partition = input('partition', host.partition ?? '', t('默认分区'));
	const time = input('time', host.time ?? '', t('不限，如 24:00:00'));
	const workdir = input('workdir', host.workdir, '~/studio-jobs');
	const threads = input('threads', String(host.threads), '4', 'number');
	threads.min = '1';
	// A path for each program there is; those of programs not there now (their plugin off) are kept as they were.
	const paths = programs.map((program) => ({ program, control: input(program.name, host.programs[program.name] ?? '', t('{program}（在 PATH 里）', { program: program.name })) }));
	const setup = document.createElement('textarea');
	setup.rows = 2;
	setup.value = host.setup;
	setup.placeholder = t('运行前执行，如 module load xtb 或 source ~/miniconda3/bin/activate chem');
	setup.spellcheck = false;

	const sshField = label(t('SSH 地址'), ssh);
	const partitionField = label(t('Slurm 分区'), partition);
	const timeField = label(t('时间上限'), time);
	const fields = document.createElement('div');
	fields.className = 'host-fields';
	fields.append(
		label(t('名称（计算块里写的 host=）'), name),
		label(t('显示名'), display),
		label(t('连接'), kind),
		sshField,
		label(t('运行方式'), scheduler),
		partitionField,
		timeField,
		label(t('工作目录'), workdir),
		label(t('默认线程'), threads),
		...paths.map(({ program, control }) => label(program.label, control, true)),
		label(t('环境设置'), setup, true),
	);

	const foot = document.createElement('div');
	foot.className = 'host-foot';
	const detect = document.createElement('button');
	detect.type = 'button';
	detect.textContent = t('检测程序');
	const found = document.createElement('span');
	found.className = 'host-found';
	foot.append(detect, found);
	if (!isLocal) {
		const drop = document.createElement('button');
		drop.type = 'button';
		drop.className = 'host-remove';
		drop.textContent = t('删除这台机器');
		drop.addEventListener('click', () => remove(root));
		foot.append(drop);
	}
	root.append(fields, foot);

	const sync = () => {
		const remote = kind.value === 'ssh';
		sshField.hidden = !remote;
		const slurm = scheduler.value === 'slurm';
		partitionField.hidden = !slurm;
		timeField.hidden = !slurm;
	};
	kind.addEventListener('change', sync);
	scheduler.addEventListener('change', sync);
	sync();

	const read = (): ComputeHost => ({
		name: name.value.trim(),
		label: display.value.trim(),
		kind: kind.value as ComputeHost['kind'],
		ssh: ssh.value.trim(),
		scheduler: scheduler.value as ComputeHost['scheduler'],
		partition: partition.value.trim(),
		time: time.value.trim(),
		workdir: workdir.value.trim(),
		threads: Number(threads.value) || 4,
		programs: {
			...Object.fromEntries(Object.entries(host.programs).filter(([name]) => !programs.some((program) => program.name === name))),
			...Object.fromEntries(paths.filter(({ control }) => control.value.trim()).map(({ program, control }) => [program.name, control.value.trim()])),
		},
		setup: setup.value,
	});

	detect.addEventListener('click', async () => {
		detect.disabled = true;
		found.textContent = kind.value === 'ssh' ? t('正在连 {host}', { host: ssh.value.trim() || '…' }) : t('正在找');
		try {
			const result = await api.detect(read());
			for (const { program, control } of paths) if (result.programs[program.name] && !control.value.trim()) control.value = result.programs[program.name]!;
			if (result.slurm && scheduler.value !== 'slurm') {
				scheduler.value = 'slurm';
				sync();
			}
			const defaultPartition = result.partitions.find((value) => value.endsWith('*'));
			if (result.slurm && defaultPartition && !partition.value.trim()) partition.value = defaultPartition.replace(/\*$/u, '');
			const parts = [
				...programs.map((program) => (result.programs[program.name] ? `${program.label} ✓` : t('没有 {program}', { program: program.label }))),
				result.cpus ? t('{count} 个处理器', { count: result.cpus }) : '',
				result.slurm ? `Slurm（${result.partitions.join(' ') || t('无分区')}）` : '',
			];
			found.textContent = parts.filter(Boolean).join(' · ');
		} catch (failure) {
			found.textContent = failure instanceof Error ? failure.message : String(failure);
		} finally {
			detect.disabled = false;
		}
	});

	return { root, read };
}
