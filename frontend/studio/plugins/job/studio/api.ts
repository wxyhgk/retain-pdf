import type { RunRecord } from '@blog/compute/browser/job-view.ts';
import type { StudioHost } from '@blog/kernel/studio.ts';

/** A machine jobs run on (server/compute-hosts.mjs). */
export type ComputeHost = {
	name: string;
	label: string;
	kind: 'local' | 'ssh';
	ssh?: string;
	scheduler: 'direct' | 'slurm';
	partition?: string;
	time?: string;
	workdir: string;
	threads: number;
	programs: Partial<Record<'xtb' | 'crest', string>>;
	setup: string;
};

export type HostDetected = { programs: Partial<Record<'xtb' | 'crest', string>>; cpus: number | null; slurm: boolean; partitions: string[] };

export type JobInput = { program: string; args: string; host: string; threads: number; body: string };

/** This plugin's API on the dev server (server.mjs), through the Studio's `ctx.studio.api`. */
export function jobApi(api: StudioHost['api']) {
	const runs = (slug: string, id: string) => `/job/articles/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}/runs`;
	return {
		hosts: async () => (await api.get<{ hosts: ComputeHost[] }>('/job/hosts')).hosts,
		saveHosts: async (hosts: ComputeHost[]) => (await api.put<{ hosts: ComputeHost[] }>('/job/hosts', { hosts })).hosts,
		/** What a machine has: where its programs are, how many processors, whether it has Slurm. */
		detect: (host: ComputeHost) => api.post<HostDetected>('/job/hosts/detect', { host }),
		/** The runs of an article's job, newest first. */
		runs: async (slug: string, id: string) => (await api.get<{ runs: RunRecord[] }>(runs(slug, id))).runs,
		/** Starts a run of the job; `body` is the block's text, the structure it starts from. */
		start: async (slug: string, id: string, job: JobInput) => (await api.post<{ run: RunRecord }>(runs(slug, id), job)).run,
		cancel: async (slug: string, id: string, run: string) => (await api.post<{ run: RunRecord }>(`${runs(slug, id)}/${encodeURIComponent(run)}/cancel`, {})).run,
	};
}

export type JobApi = ReturnType<typeof jobApi>;
