/**
 * Code blocks of an article that run, as org-babel's in Emacs: a block of a language there is a program for (```python,
 * ```sh …) run in the article's folder, its output written under it as an ```output block (`title="运行结果"`), that
 * block replaced when it is run again.
 */

/** The languages a block can be run in: the program that runs a file of it, and the file's extension. */
export const RUNNERS = Object.freeze({
	python: { program: 'python3', extension: 'py' },
	py: { program: 'python3', extension: 'py' },
	sh: { program: 'sh', extension: 'sh' },
	shell: { program: 'sh', extension: 'sh' },
	bash: { program: 'bash', extension: 'sh' },
	zsh: { program: 'zsh', extension: 'sh' },
	javascript: { program: 'node', extension: 'mjs' },
	js: { program: 'node', extension: 'mjs' },
	node: { program: 'node', extension: 'mjs' },
	r: { program: 'Rscript', extension: 'R' },
	julia: { program: 'julia', extension: 'jl' },
});

/** The runner of a code block's language, or null when it is none that runs. */
export function runnerOf(language) {
	return RUNNERS[String(language ?? '').trim().toLowerCase()] ?? null;
}

/** The fence and title of the block a run's output is written in. */
export const RESULT_FENCE = 'output';
export const RESULT_TITLE = '运行结果'; // i18n-ignore: written into the article

/** Whether a code block's info is a run's result. */
export function isResult(language, meta) {
	return String(language ?? '') === RESULT_FENCE && String(meta ?? '').includes(`title="${RESULT_TITLE}"`);
}
