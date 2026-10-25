import { StudioApi } from '../api.mjs';
import { aiRoutes } from './ai.mjs';
import { articleFileRoutes } from './article-files.mjs';
import { articleRoutes } from './articles.mjs';
import { driveRoutes } from './drive.mjs';
import { pluginRoutes } from './plugins.mjs';
import { taskRoutes } from './tasks.mjs';

/**
 * What the Studio's server is made of, as the routes use it (put together in
 * src/plugins/studio-dev.mjs).
 * @typedef {object} Studio
 * @property {string | undefined} site the blog's address, so links to its articles written in full count as theirs
 * @property {string} projectRoot
 * @property {string} blogRoot
 * @property {{ blog: boolean, drive: boolean }} testing browser tests' own blog/ and drive: no windows opened
 * @property {(slug: string) => string} articleFolder
 * @property {(slug: string | null, driveRoot: string | null) => Record<string, string>} programEnv
 * @property {import('../article-repository.mjs').ArticleRepository} articles
 * @property {import('../article-history.mjs').ArticleHistory} history
 * @property {import('../file-repository.mjs').FileRepository} files
 * @property {import('../code-file-previews.mjs').CodeFilePreviews} codeFiles
 * @property {import('../file-manager.mjs').ArticleFileManager} manager
 * @property {import('../article-files.mjs').ArticleFiles} articleFiles
 * @property {import('../article-git.mjs').ArticleGit} articleGit
 * @property {import('../article-library.mjs').ArticleLibrary} library
 * @property {import('../blog-watcher.mjs').BlogWatcher} watcher
 * @property {import('../drive.mjs').Drive} drive
 * @property {import('../drive-text.mjs').DriveText} driveText
 * @property {import('../terminal-host.mjs').TerminalHost} terminals
 * @property {import('../tasks.mjs').Tasks} tasks
 * @property {import('../mini-apps.mjs').MiniApps} miniApps
 * @property {import('../plugin-settings.mjs').PluginSettings} pluginSettings
 * @property {import('../ai-settings.mjs').AiSettings} aiSettings
 * @property {import('../agent-settings.mjs').AgentSettings} agentSettings
 * @property {Promise<any>} plugins the plugins' kernel on this server
 */

/** The Studio's API (/api/studio/…), every route of it. */
export function studioApi(studio) {
	const api = new StudioApi();
	articleRoutes(api, studio);
	articleFileRoutes(api, studio);
	driveRoutes(api, studio);
	aiRoutes(api, studio);
	taskRoutes(api, studio);
	pluginRoutes(api, studio);
	return api;
}
