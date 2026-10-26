import { cancelTask, followTasks, taskLog, type TaskSummary } from '../api/client';

/** What the tray tells the Studio around it. */
export type TaskTrayHost = {
	/** A task is over (done, failed or cancelled), seen while the page was open. */
	ended(task: TaskSummary): void;
};

/** How long a task that went well stays in the tray once it is over, in ms. */
const DONE_SHOWN_FOR = 6000;

const STATES: Record<TaskSummary['state'], string> = { running: '进行中', done: '完成', failed: '出错', cancelled: '已取消' };

function elapsed(task: TaskSummary): string {
	const seconds = Math.max(0, Math.round(((task.ended ?? Date.now()) - task.started) / 1000));
	return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

/**
 * The background tasks (server/tasks.mjs), at the bottom right of the page: what each is, how long it has
 * taken, its log on asking, and a way to stop it. One that went well goes after a moment; one that went
 * wrong stays, saying why, till it is closed.
 */
export function createTaskTray(tray: HTMLElement, host: TaskTrayHost) {
	type Shown = { task: TaskSummary; item: HTMLElement; time: HTMLElement; state: HTMLElement; log: HTMLPreElement; action: HTMLButtonElement };
	const shown = new Map<string, Shown>();
	let ticking = 0;

	function remove(id: string): void {
		shown.get(id)?.item.remove();
		shown.delete(id);
		tray.hidden = !shown.size;
	}

	function update(entry: Shown): void {
		const { task } = entry;
		entry.item.dataset.state = task.state;
		entry.state.textContent = task.state === 'failed' && task.error ? `出错：${task.error}` : STATES[task.state];
		entry.time.textContent = elapsed(task);
		entry.action.textContent = task.state === 'running' ? '取消' : '关闭';
	}

	function show(task: TaskSummary): Shown {
		const item = document.createElement('div');
		item.className = 'task-item';
		const head = document.createElement('div');
		head.className = 'task-head';
		const title = document.createElement('span');
		title.className = 'task-title';
		title.textContent = task.title;
		title.title = task.title;
		const time = document.createElement('span');
		time.className = 'task-time';
		head.append(title, time);
		const foot = document.createElement('div');
		foot.className = 'task-foot';
		const state = document.createElement('span');
		state.className = 'task-state';
		const logButton = document.createElement('button');
		logButton.type = 'button';
		logButton.textContent = '日志';
		const action = document.createElement('button');
		action.type = 'button';
		foot.append(state, logButton, action);
		const log = document.createElement('pre');
		log.className = 'task-log';
		log.hidden = true;
		item.append(head, foot, log);
		const entry: Shown = { task, item, time, state, log, action };
		logButton.addEventListener('click', () => {
			log.hidden = !log.hidden;
			logButton.textContent = log.hidden ? '日志' : '收起';
			if (!log.hidden) {
				void taskLog(entry.task.id).then((text) => {
					log.textContent = text || '（还没有输出）';
					log.scrollTop = log.scrollHeight;
				});
			}
		});
		action.addEventListener('click', () => {
			if (entry.task.state === 'running') void cancelTask(entry.task.id);
			else remove(entry.task.id);
		});
		shown.set(task.id, entry);
		tray.prepend(item);
		tray.hidden = false;
		update(entry);
		return entry;
	}

	function tick(): void {
		for (const entry of shown.values()) if (entry.task.state === 'running') entry.time.textContent = elapsed(entry.task);
		const running = [...shown.values()].some((entry) => entry.task.state === 'running');
		if (running && !ticking) ticking = window.setInterval(tick, 1000);
		if (!running && ticking) {
			window.clearInterval(ticking);
			ticking = 0;
		}
	}

	followTasks((event) => {
		if (event.type === 'all') {
			// Opened again: what still runs.
			for (const task of event.tasks) if (task.state === 'running' && !shown.has(task.id)) show(task);
		} else if (event.type === 'task') {
			const known = shown.get(event.task.id);
			const was = known?.task.state;
			const entry = known ?? show(event.task);
			entry.task = event.task;
			update(entry);
			if (was === 'running' && event.task.state !== 'running') {
				host.ended(event.task);
				if (event.task.state !== 'failed') window.setTimeout(() => remove(event.task.id), DONE_SHOWN_FOR);
			}
		} else {
			const entry = shown.get(event.id);
			if (entry && !entry.log.hidden) {
				entry.log.textContent += event.text;
				entry.log.scrollTop = entry.log.scrollHeight;
			}
		}
		tick();
	});
	tray.hidden = true;
}
