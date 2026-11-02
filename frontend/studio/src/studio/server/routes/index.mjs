import { StudioApi } from '../api.mjs';
import { aiRoutes } from './ai.mjs';
import { articleFileRoutes } from './article-files.mjs';
import { articleRoutes } from './articles.mjs';
import { conversationRoutes } from './conversations.mjs';
import { driveRoutes } from './drive.mjs';
import { pluginRoutes } from './plugins.mjs';
import { repoRoutes } from './repos.mjs';
import { settingRoutes } from './settings.mjs';
import { taskRoutes } from './tasks.mjs';

/**
 * What the Studio's server is made of, as the routes use it (put together in
 * src/plugins/studio-dev.mjs).
 * @typedef {object} Studio
 * @property {string | undefined} site the blog's address, so links to its articles written in full count as theirs
 * @property {string} projectRoot the Studio's code
 * @property {string} notesRoot the author's notes: blog/, apps/, chats/, templates/, settings (notes-root.mjs)
 * @property {string} blogRoot
 * @property {{ blog: boolean, drive: boolean }} testing browser tests' own blog/ and drive: no windows opened
 * @property {(slug: string) => string} articleFolder
 * @property {(slug: string | null, driveRoot: string | null) => Record<string, string>} programEnv
 * @property {import('../articles/article-repository.mjs').ArticleRepository} articles
 * @property {import('../articles/article-history.mjs').ArticleHistory} history
 * @property {import('../articles/templates.mjs').ArticleTemplates} templates page templates (templates/)
 * @property {import('../files/file-repository.mjs').FileRepository} files
 * @property {import('../articles/code-file-previews.mjs').CodeFilePreviews} codeFiles
 * @property {import('../files/file-manager.mjs').ArticleFileManager} manager
 * @property {import('../articles/article-files.mjs').ArticleFiles} articleFiles
 * @property {import('../articles/article-git.mjs').ArticleGit} articleGit
 * @property {import('../articles/article-library.mjs').ArticleLibrary} library
 * @property {import('../articles/blog-watcher.mjs').BlogWatcher} watcher
 * @property {{ subscribe(listener: (id: string) => void): () => void }} appChanges a page app's files changed (its windows load it again)
 * @property {import('../drive/drive.mjs').Drive} drive
 * @property {import('../drive/drive-text.mjs').DriveText} driveText
 * @property {import('../system/terminal-host.mjs').TerminalHost} terminals
 * @property {import('../tasks/tasks.mjs').Tasks} tasks
 * @property {import('../apps/mini-apps.mjs').MiniApps} miniApps
 * @property {import('../apps/project-apps.mjs').ProjectApps} projectApps the project apps' development servers
 * @property {import('../apps/app-checkpoints.mjs').AppCheckpoints} appCheckpoints the apps' code as it was before an AI changed it
 * @property {import('../plugin-settings.mjs').PluginSettings} pluginSettings
 * @property {import('../locale-settings.mjs').LocaleSettings} localeSettings the language the Studio speaks
 * @property {import('../retainpdf-settings.mjs').RetainpdfSettings} retainpdfSettings where RetainPDF's pages are (翻译)
 * @property {import('../retainpdf-notes.mjs').RetainpdfNotes} retainpdfNotes 读书笔记: a book's page of notes, found or made
 * @property {import('../retainpdf-library.mjs').RetainpdfLibrary} retainpdfLibrary RetainPDF's books, read by the AIs
 * @property {import('../retainpdf-reading.mjs').RetainpdfReading} retainpdfReading what is read in 翻译, told the AIs
 * @property {import('../ai/ai-settings.mjs').AiSettings} aiSettings
 * @property {import('../ai/agent-settings.mjs').AgentSettings} agentSettings
 * @property {import('../ai/agent-sessions.mjs').AgentSessions} conversations the AI panel's
 * @property {import('../ai/panel-models.mjs').PanelModels} panelModels the service the panel's Claude Code talks to
 * @property {Promise<any>} plugins the plugins' kernel on this server
 * @property {import('../articles/notes-index.mjs').NotesIndex} notesIndex the code and pictures of all the notes, gathered
 * @property {import('../remote/remote-access.mjs').RemoteAccess} remote 其他设备访问: the door other devices of the author's come in by
 * @property {import('../repos/repositories.mjs').Repositories} repositories 代码仓库: the git repositories the author keeps code in
 */

/** The Studio's API (/api/studio/…), every route of it. */
export function studioApi(studio) {
	const api = new StudioApi();
	articleRoutes(api, studio);
	articleFileRoutes(api, studio);
	driveRoutes(api, studio);
	aiRoutes(api, studio);
	taskRoutes(api, studio);
	conversationRoutes(api, studio);
	pluginRoutes(api, studio);
	settingRoutes(api, studio);
	repoRoutes(api, studio);
	return api;
}
