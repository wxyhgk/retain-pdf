import { computeHosts, detectComputeHost, saveComputeHosts, type ComputeHost } from '../api/client';
import './compute-hosts.css';

/**
 * 计算机器: the machines ```job blocks run on, kept with the Studio's
 * settings (compute-hosts.mjs). Each is a card: how it is reached (here, or
 * ssh), whether jobs start at once or go to Slurm, where they run, and the
 * programs, which 检测 finds. Saved together.
 */
export function createComputeHostsDialog() {
	const dialog = document.querySelector<HTMLDialogElement>('#compute-hosts-dialog')!;
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
		const card = hostCard({ name: `server-${index}`, label: '', kind: 'ssh', ssh: '', scheduler: 'direct', workdir: '~/studio-jobs', threads: 8, programs: {}, setup: '' }, remove);
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
			await saveComputeHosts(cards.map((card) => card.read()));
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
				for (const host of await computeHosts()) {
					const card = hostCard(host, remove);
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
	};
}

function hostCard(host: ComputeHost, remove: (root: HTMLElement) => void): { root: HTMLElement; read(): ComputeHost } {
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
	const display = input('label', host.label === host.name ? '' : host.label, isLocal ? '本机' : '5090 服务器');
	const kind = choice('kind', [['local', '本机'], ['ssh', 'SSH']], host.kind);
	kind.disabled = isLocal;
	const ssh = input('ssh', host.ssh ?? '', '~/.ssh/config 里的 Host，或 用户@地址');
	const scheduler = choice('scheduler', [['direct', '直接运行'], ['slurm', '交给 Slurm 排队']], host.scheduler);
	const partition = input('partition', host.partition ?? '', '默认分区');
	const time = input('time', host.time ?? '', '不限，如 24:00:00');
	const workdir = input('workdir', host.workdir, '~/studio-jobs');
	const threads = input('threads', String(host.threads), '4', 'number');
	threads.min = '1';
	const xtb = input('xtb', host.programs.xtb ?? '', 'xtb（在 PATH 里）');
	const crest = input('crest', host.programs.crest ?? '', 'crest（在 PATH 里）');
	const setup = document.createElement('textarea');
	setup.rows = 2;
	setup.value = host.setup;
	setup.placeholder = '运行前执行，如 module load xtb 或 source ~/miniconda3/bin/activate chem';
	setup.spellcheck = false;

	const sshField = label('SSH 地址', ssh);
	const partitionField = label('Slurm 分区', partition);
	const timeField = label('时间上限', time);
	const fields = document.createElement('div');
	fields.className = 'host-fields';
	fields.append(
		label('名称（计算块里写的 host=）', name),
		label('显示名', display),
		label('连接', kind),
		sshField,
		label('运行方式', scheduler),
		partitionField,
		timeField,
		label('工作目录', workdir),
		label('默认线程', threads),
		label('xtb', xtb, true),
		label('CREST', crest, true),
		label('环境设置', setup, true),
	);

	const foot = document.createElement('div');
	foot.className = 'host-foot';
	const detect = document.createElement('button');
	detect.type = 'button';
	detect.textContent = '检测程序';
	const found = document.createElement('span');
	found.className = 'host-found';
	foot.append(detect, found);
	if (!isLocal) {
		const drop = document.createElement('button');
		drop.type = 'button';
		drop.className = 'host-remove';
		drop.textContent = '删除这台机器';
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
		programs: { ...(xtb.value.trim() ? { xtb: xtb.value.trim() } : {}), ...(crest.value.trim() ? { crest: crest.value.trim() } : {}) },
		setup: setup.value,
	});

	detect.addEventListener('click', async () => {
		detect.disabled = true;
		found.textContent = kind.value === 'ssh' ? `正在连 ${ssh.value.trim() || '…'}` : '正在找';
		try {
			const result = await detectComputeHost(read());
			if (result.programs.xtb && !xtb.value.trim()) xtb.value = result.programs.xtb;
			if (result.programs.crest && !crest.value.trim()) crest.value = result.programs.crest;
			if (result.slurm && scheduler.value !== 'slurm') {
				scheduler.value = 'slurm';
				sync();
			}
			const defaultPartition = result.partitions.find((value) => value.endsWith('*'));
			if (result.slurm && defaultPartition && !partition.value.trim()) partition.value = defaultPartition.replace(/\*$/u, '');
			const parts = [
				result.programs.xtb ? 'xtb ✓' : '没有 xtb',
				result.programs.crest ? 'CREST ✓' : '没有 CREST',
				result.cpus ? `${result.cpus} 个处理器` : '',
				result.slurm ? `Slurm（${result.partitions.join(' ') || '无分区'}）` : '',
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
