import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PROJECT_ROOT = process.cwd();
const REPOSITORY_ROOT = join(PROJECT_ROOT, "../..");
const JS_ROOT = join(PROJECT_ROOT, "src/js");
const PLATFORM_ROOT = join(PROJECT_ROOT, "src/platform");
const DOMAIN_JOB_SOURCE_ROOT = join(PROJECT_ROOT, "../../frontend/packages/domain/src/job");
// FEATURE_ROOT（src/js/features）已在批次 5B 的 B6/B7 拆空删除：型别归
// platform/contracts、store 归 app/home/state、idle 视图归 app/home/composition、
// resetStatusDetailRuntimeView 归 features/job-detail。以它为扫描根的四条规则
// 见下方逐条说明（两条重定向到新位置，四条删除并注明被谁接管）。
const BOOTSTRAP_ROOT = join(PROJECT_ROOT, "src/app/bootstrap");
// 新世界功能层（按功能重组后的 src/features/*），承接原 FEATURE_ROOT 仍然成立的规则。
const FEATURE_LAYER_ROOT = join(PROJECT_ROOT, "src/features");
const SOURCE_ROOTS = {
  api: join(PLATFORM_ROOT, "api/legacy"),
  bootstrap: BOOTSTRAP_ROOT,
  config: join(PLATFORM_ROOT, "config"),
  contracts: join(PLATFORM_ROOT, "contracts"),
  desktop: join(PLATFORM_ROOT, "desktop"),
  job: DOMAIN_JOB_SOURCE_ROOT,
  jobMirror: join(JS_ROOT, "job"),
  jobDetail: join(PROJECT_ROOT, "src/features/job-detail/domain/page"),
  jobStatus: join(JS_ROOT, "job-status"),
  state: join(JS_ROOT, "state"),
  statusDetail: join(PROJECT_ROOT, "src/features/job-detail/domain/snapshot"),
  ui: join(JS_ROOT, "ui"),
  utils: join(PLATFORM_ROOT, "utils"),
};
const APP_ENTRYPOINTS = [
  join(PROJECT_ROOT, "app.js"),
  join(PROJECT_ROOT, "app-bundle-entry.js"),
];
const ROOT_COMPAT_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+(?:state|job)\.js["']/;
const ROOT_PROVIDER_CONFIG_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+provider-config\.js["']/;
const ROOT_CONFIG_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+config\.js["']/;
const ROOT_TEMPLATES_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+templates\.js["']/;
const ROOT_DOM_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+dom\.js["']/;
const ROOT_MAIN_IMPORT_PATTERN = /from\s+["'](?:\.\/src\/js\/main\.js|(?:\.\.\/)+main\.js)["']/;
const WEBAWESOME_USAGE_PATTERN = /@awesome\.me\/webawesome|<wa-|wa-(?:button|dialog|progress|badge|card|progress-ring|progress-bar)\b|WebAwesome|Web Awesome/;
const SHARED_DIALOG_SHELL_SELECTOR_PATTERN = /^\s*\.(?:app-(?:dialog|confirm|floating)-[\w-]+|desktop-dialog|desktop-shell|desktop-head|desktop-body|dialog-close-btn)(?:\s|[,{:#.])/m;
const RAW_RADIX_DIALOG_IMPORT_PATTERN = /import\s*\{[^}]*\bDialog\s+as\s+DialogPrimitive\b[^}]*\}\s*from\s*["']radix-ui["']/s;
const BROWSER_BLOCKING_DIALOG_PATTERN = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/;
const APP_UPDATE_SELECTOR_PATTERN = /^\s*\.app-update-[\w-]+(?:\s|[,{:#.])/m;
const LIBRARY_SHELL_SELECTOR_PATTERN = /^\s*(?:\.(?:page|app-shell|topbar|app-shell-header|library-[\w-]+|home-action-btn|brand-[\w-]+|hero(?:-[\w-]+)?)(?:\s|[,{:#.])|#recent-jobs-list\.library-grid\b|\.recent-jobs-more-row\s+#load-more-jobs-btn\b)/m;
const API_PREFIX_FROM_ROOT_CONSTANTS_PATTERN = /import\s*{[^}]*API_PREFIX[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const UPLOAD_CONSTANTS_FROM_ROOT_PATTERN = /import\s*{[^}]*(?:DEFAULT_FILE_LABEL|FRONT_MAX_BYTES|FRONT_MAX_PAGE_COUNT)[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const MODEL_CONSTANTS_FROM_ROOT_PATTERN = /import\s*{[^}]*(?:DEFAULT_MODEL|DEFAULT_BASE_URL|DEFAULT_MODEL_VERSION)[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const STORAGE_KEYS_FROM_ROOT_PATTERN = /import\s*{[^}]*(?:BROWSER_CONFIG_STORAGE_KEY|DEVELOPER_CONFIG_STORAGE_KEY)[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const WORKFLOW_DEFAULTS_FROM_ROOT_PATTERN = /import\s*{[^}]*(?:DEFAULT_MODE|DEFAULT_LANGUAGE|DEFAULT_RULE_PROFILE|DEFAULT_RENDER_MODE|DEFAULT_TYPST_FONT_FAMILY|DEFAULT_PDF_COMPRESS_DPI|DEFAULT_TRANSLATED_PDF_NAME|DEFAULT_BODY_FONT_SIZE_FACTOR|DEFAULT_BODY_LEADING_FACTOR|DEFAULT_INNER_BBOX_SHRINK_X|DEFAULT_INNER_BBOX_SHRINK_Y|DEFAULT_INNER_BBOX_DENSE_SHRINK_X|DEFAULT_INNER_BBOX_DENSE_SHRINK_Y|DEFAULT_FONT_UNIFY_MODE|DEFAULT_WORKERS|DEFAULT_BATCH_SIZE|DEFAULT_CLASSIFY_BATCH_SIZE|DEFAULT_COMPILE_WORKERS|DEFAULT_TIMEOUT_SECONDS)[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const BOOTSTRAP_EXTERNAL_IMPORT_PATTERN = /from\s+["']\.\.\/(?:features|ui|api|state)\/|from\s+["']\.\.\/(?:config|constants)\.js["']/;
// Phase 3 home cutover 删掉了绝大部分 src/js/bootstrap/(227 个手工 DI 端口文件里的
// 226 个);现存文件只允许承担明确的 package/reader iframe 依赖注入边界。以下两份
// 清单曾各有 30~130 个条目对应
// 已删除文件——Phase 4 收紧为只保留仍然存在的条目,新文件若再落进 bootstrap/ 会被
// 下面两条门禁测试正确拦下,强制显式决定是否加回允许清单。
const BOOTSTRAP_GROUPED_PORT_FILES = [];
const BOOTSTRAP_GROUPED_PORT_DISCOVERY_ALLOWLIST = new Set([]);

const BOOTSTRAP_EXTERNAL_IMPORT_ALLOWLIST = new Set([
  "job-domain-adapters.ts",
  "reader-dialog-runtime-port.js",
  "reader-dialog-runtime-port.ts",
]);

function isSourceFile(filePath) {
  return filePath.endsWith(".ts")
    || filePath.endsWith(".tsx")
    || filePath.endsWith(".js")
    || filePath.endsWith(".jsx");
}

/** 源文件已迁 TS 后，测试里仍可写 foo.js，实际读 foo.ts */
function resolveSourcePath(filePath) {
  if (existsSync(filePath)) {
    return filePath;
  }
  if (filePath.endsWith(".js")) {
    const asTs = `${filePath.slice(0, -3)}.ts`;
    if (existsSync(asTs)) return asTs;
    const asTsx = `${filePath.slice(0, -3)}.tsx`;
    if (existsSync(asTsx)) return asTsx;
  }
  if (filePath.endsWith(".jsx")) {
    const asTsx = `${filePath.slice(0, -4)}.tsx`;
    if (existsSync(asTsx)) return asTsx;
  }
  return filePath;
}

function walkFiles(root) {
  if (!existsSync(root)) {
    return [];
  }
  const pending = [root];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) {
        pending.push(join(current, entry));
      }
      continue;
    }
    if (isSourceFile(current)) {
      files.push(current);
    }
  }
  return files.sort();
}

function allPathsUnder(root) {
  const pending = [root];
  const paths = [];
  while (pending.length > 0) {
    const current = pending.pop();
    paths.push(current);
    if (!statSync(current).isDirectory()) {
      continue;
    }
    for (const entry of readdirSync(current)) {
      pending.push(join(current, entry));
    }
  }
  return paths.sort();
}

function readRootSource(fileName) {
  return readFileSync(join(JS_ROOT, fileName), "utf8");
}

function readSource(filePath) {
  return readFileSync(resolveSourcePath(filePath), "utf8");
}

function readBootstrapSource(fileName) {
  return readSource(join(BOOTSTRAP_ROOT, fileName));
}

// job-runtime 已随 jobs 功能迁至 features/jobs/domain/runtime。
const JOB_RUNTIME_DOMAIN = join(PROJECT_ROOT, "src/features/jobs/domain/runtime");
function readJobRuntimeSource(fileName) {
  return readSource(join(JOB_RUNTIME_DOMAIN, fileName.replace(/\.js$/, ".ts")));
}

function relativeToProject(filePath) {
  return relative(PROJECT_ROOT, filePath);
}

/**
 * 扫描类门禁的共用取文件入口。
 *
 * walkFiles 对不存在的目录返回 []，于是 `assert.deepEqual(offenders, [])` 恒真——
 * 扫描根一旦被搬走或写错，门禁就"静默变绿"，看起来还在守着，实际什么都不查。
 * 批次 4 的 ingest 迁移已经让 upload 门禁这样死过一次。凡是"遍历目录找违规"的
 * 门禁都必须经这里取文件：目录不存在、或过滤后一个文件都没扫到，都直接判失败，
 * 并在消息里点名是哪个根失效了。
 */
function scanRoot(root, filter = isSourceFile) {
  assert.ok(existsSync(root), `扫描根不存在，门禁已失效: ${relativeToProject(root)}`);
  const files = walkFiles(root).filter(filter);
  assert.ok(files.length > 0, `扫描根为空，门禁已失效: ${relativeToProject(root)}`);
  return files;
}

/** 多扫描根版本：逐个根做存在性与非空校验，任一根失效即失败 */
function scanRoots(roots, filter = isSourceFile) {
  return roots.flatMap((root) => scanRoot(root, filter));
}

const IS_TS_OR_TSX = (filePath) => /\.(?:ts|tsx)$/.test(filePath);
const IS_SCRIPT_SOURCE = (filePath) => /\.(?:ts|tsx|js|jsx)$/.test(filePath);

/** 去掉 `import type` 再匹配——TS 类型导入不构成运行时对 view 层的依赖 */
function sourceWithoutTypeImports(source) {
  return source
    .replace(/import\s+type\s+[\s\S]*?from\s+["'][^"']+["']\s*;?/g, "")
    .replace(/import\s*\{[^}]*\}\s*from\s+["'][^"']+["']\s*;?/g, (block) => {
      // 保留值导入；若整行只有 type 已在上一步处理
      return block;
    });
}

function findMatchingImports(files, pattern) {
  return files
    .filter((file) => pattern.test(sourceWithoutTypeImports(readSource(file))))
    .map((file) => relativeToProject(file));
}

function findMatchingSources(files, pattern) {
  return files
    .filter((file) => pattern.test(readSource(file)))
    .map((file) => relativeToProject(file));
}

function stripCompatibilityReExports(source) {
  return source
    .replace(/export\s+(?:\{[\s\S]*?\}|\*)\s+from\s+["'][^"']+["'];/g, "")
    .trim();
}

test("source tree does not contain notebook checkpoint artifacts", () => {
  const offenders = allPathsUnder(join(PROJECT_ROOT, "src"))
    .filter((filePath) => filePath.split("/").includes(".ipynb_checkpoints"))
    .map((filePath) => relativeToProject(filePath));

  assert.deepEqual(offenders, []);
});

test("npm workspaces use the repository root lockfile", () => {
  const nestedLockfiles = [
    join(REPOSITORY_ROOT, "frontend/desktop/package-lock.json"),
    join(REPOSITORY_ROOT, "frontend/web/package-lock.json"),
    join(REPOSITORY_ROOT, "frontend/web-react/package-lock.json"),
    join(REPOSITORY_ROOT, "frontend/packages/reader/package-lock.json"),
  ].filter((filePath) => existsSync(filePath));

  assert.equal(existsSync(join(REPOSITORY_ROOT, "package-lock.json")), true);
  assert.deepEqual(nestedLockfiles, []);
});

test("runtime frontend does not depend on WebAwesome", () => {
  const runtimeSources = [
    ...APP_ENTRYPOINTS,
    join(PROJECT_ROOT, "package.json"),
    join(REPOSITORY_ROOT, "package-lock.json"),
    ...walkFiles(JS_ROOT),
    ...allPathsUnder(join(PROJECT_ROOT, "src/styles")).filter((filePath) => filePath.endsWith(".css")),
  ].filter((filePath) => existsSync(filePath));
  const offenders = findMatchingSources(runtimeSources, WEBAWESOME_USAGE_PATTERN);

  assert.deepEqual(offenders, []);
});

test("upload workflow presentation components stay independent from home services", () => {
  // 原路径 src/app/home/features/workflow/components/upload 已在批次 4 的 ingest
  // 迁移中删除，本门禁自那天起对空数组做 deepEqual，一直是永久绿灯。upload 展示层
  // 现在在 features/ingest/ui/components/upload。
  const presentationRoot = join(PROJECT_ROOT, "src/features/ingest/ui/components/upload");
  const offenders = scanRoot(presentationRoot, IS_TS_OR_TSX)
    .filter((file) => /useHomeServices|home-services-context|composition\//.test(readFileSync(file, "utf8")))
    .map((file) => relativeToProject(file));

  assert.deepEqual(offenders, []);
});

test("book detail tab and artifact components stay independent from APIs and home services", () => {
  // book-detail 已随按功能重组迁至 src/features/book-detail。
  const detailRoot = join(PROJECT_ROOT, "src/features/book-detail/ui");
  // 逐个根校验存在性与非空，避免其中一个根被搬走后另一个把总数撑起来、本门禁半哑。
  const presentationFiles = scanRoots([
    join(detailRoot, "tabs"),
    join(detailRoot, "artifacts"),
  ]);
  const offenders = presentationFiles
    .filter((file) => /useHomeServices|home-services-context|composition\/|@retainpdf\/api|domain\/controller/.test(readFileSync(file, "utf8")))
    .map((file) => relativeToProject(file));

  assert.deepEqual(offenders, []);
  assert.equal(existsSync(join(detailRoot, "tabs/BookDetailTranslateTab.tsx")), false);
  assert.equal(existsSync(join(detailRoot, "tabs/BookDetailMoreTab.tsx")), false);
});

test("agent operation presentation components stay independent from APIs and home services", () => {
  // ask 已随按功能重组迁至 src/features/ask，展示组件在 ui/operations。
  const presentationRoot = join(PROJECT_ROOT, "src/features/ask/ui/operations");
  const presentationFiles = scanRoot(presentationRoot, (file) => /Agent[^/]*\.tsx$/.test(file));
  const offenders = presentationFiles
    .filter((file) => /useHomeServices|home-services-context|composition\/|@retainpdf\/api/.test(readFileSync(file, "utf8")))
    .map((file) => relativeToProject(file));

  assert.deepEqual(offenders, []);
});

test("shared dialog shell styles stay in dialog-shell css", () => {
  const styleSources = allPathsUnder(join(PROJECT_ROOT, "src/styles"))
    .filter((filePath) => filePath.endsWith(".css"))
    .filter((filePath) => filePath !== join(PROJECT_ROOT, "src/styles/dialog-shell.css"));
  const offenders = findMatchingSources(styleSources, SHARED_DIALOG_SHELL_SELECTOR_PATTERN);

  assert.deepEqual(offenders, []);
});

test("application dialogs use the shared dialog component boundary", () => {
  const sharedDialog = join(PROJECT_ROOT, "src/ui/components/dialog.tsx");
  // 唯一允许直连 Radix Dialog 的文件。路径写错就等于把豁免发给了一个不存在的文件，
  // 门禁会反过来把真正的共享组件判成违规——先断言它在，失败信息才指得准。
  assert.ok(existsSync(sharedDialog), `共享 dialog 组件不存在，门禁已失效: ${relativeToProject(sharedDialog)}`);
  const offenders = findMatchingSources(
    walkFiles(join(PROJECT_ROOT, "src")).filter((filePath) => filePath !== sharedDialog),
    RAW_RADIX_DIALOG_IMPORT_PATTERN,
  );

  assert.deepEqual(offenders, []);
});

test("production React UI does not use browser blocking dialogs", () => {
  const offenders = findMatchingSources(
    scanRoots([join(PROJECT_ROOT, "src/app"), join(PROJECT_ROOT, "src/ui")]),
    BROWSER_BLOCKING_DIALOG_PATTERN,
  );

  assert.deepEqual(offenders, []);
});

test("app update styles stay in app-update css", () => {
  const styleSources = allPathsUnder(join(PROJECT_ROOT, "src/styles"))
    .filter((filePath) => filePath.endsWith(".css"))
    .filter((filePath) => filePath !== join(PROJECT_ROOT, "src/styles/pages/home/app-update.css"));
  const offenders = findMatchingSources(styleSources, APP_UPDATE_SELECTOR_PATTERN);

  assert.deepEqual(offenders, []);
});

test("library shell styles stay in library-shell css", () => {
  const styleSources = allPathsUnder(join(PROJECT_ROOT, "src/styles"))
    .filter((filePath) => filePath.endsWith(".css"))
    .filter((filePath) => filePath !== join(PROJECT_ROOT, "src/styles/pages/home/library-shell.css"));
  const offenders = findMatchingSources(styleSources, LIBRARY_SHELL_SELECTOR_PATTERN);

  assert.deepEqual(offenders, []);
});

// 删：「feature modules import local view.js only through explicit view boundary ports」。
// 旧世界的 features/*/view.js 视图层已随各功能迁移全部删除（src 下已无 view.ts/js），
// 且同一模式由下方「React 新世界禁止 import 旧视图层」的
// `features/*/view.js(旧 DOM 视图)` 一条接管，扫描根 src/{app,ui,features} 仍存在
// 且有存在性断言，不会静默变绿。

// 删：「feature modules import legacy global state only through state boundary ports」。
// 由「React 新世界禁止 import 旧视图层」的 `src/js/state/store.js(全局状态)` 一条
// 接管，且更严——那条只留 app/desktop/bootstrap.ts 一个豁免（有只减不增的长度断言），
// 不像这里按 *-state.ts 文件名整片放行。

// 删：「feature modules do not import default ui adapters directly」。
// 它拦的是旧 src/js/ui 适配层，该目录已整体删除（SOURCE_ROOTS.ui 现在只用于
// existsSync 反向断言），被禁目标本身不存在。且 FEATURE_UI_IMPORT_PATTERN 是
// `(../)+ui/`，若改指 src/features 会把新世界合法的 `../../../ui/hooks/*`
// （src/ui，A7 之后 React 侧共用层）误判成违规——不能重定向，只能删。

// 删：「feature modules receive upload defaults through ports」。
// FEATURE_UPLOAD_CONSTANTS_IMPORT_PATTERN 是 `(../)+config/upload-constants.js`，
// 指旧 src/js/config——该目录已迁 src/platform/config 并删除，相对路径在新树里
// 解析不到任何东西。现网 upload-constants 的唯一消费方是
// app/home/composition/external/config.ts（装配层转出，本就是允许的），
// 规则已无可拦对象。

test("root compatibility barrels are removed", () => {
  const remaining = [
    "config.js",
    "constants.js",
    "dom.js",
    "job.js",
    "main.js",
    "state.js",
    "templates.js",
  ].filter((fileName) => existsSync(join(JS_ROOT, fileName)));

  assert.deepEqual(remaining, []);
});

test("job artifact helpers read runtime and upload state through artifact runtime port", () => {
  const artifactsSource = readSource(join(SOURCE_ROOTS.job, "artifacts.js"));
  const runtimePortSource = readSource(join(SOURCE_ROOTS.job, "artifact-runtime-port.js"));

  assert.equal(
    artifactsSource.includes("../features/job-runtime/current-job-state.js"),
    false,
  );
  assert.equal(
    artifactsSource.includes("../features/job-runtime/secondary-resource-cache.js"),
    false,
  );
  assert.equal(
    artifactsSource.includes("../state/upload-state.js"),
    false,
  );
  assert.match(artifactsSource, /artifact-runtime-port\.js/);
  assert.match(runtimePortSource, /createArtifactRuntimePort/);
  assert.match(runtimePortSource, /defaultArtifactRuntimePort/);
  assert.equal(runtimePortSource.includes("../ui/"), false);
  assert.equal(runtimePortSource.includes("../features/job-runtime/"), false);
  assert.equal(runtimePortSource.includes("../state/"), false);
  assert.equal(existsSync(join(SOURCE_ROOTS.ui, "default-artifact-runtime-port.js")), false);
});

test("job layer does not keep ui presenter compatibility facades", () => {
  assert.equal(existsSync(join(SOURCE_ROOTS.job, "elapsed-renderer.js")), false);
  assert.equal(existsSync(join(SOURCE_ROOTS.job, "workflow-visibility.js")), false);
});

test("job helpers keep job-runtime feature access behind explicit runtime ports", () => {
  const offenders = walkFiles(SOURCE_ROOTS.job)
    .map((file) => relative(SOURCE_ROOTS.job, file))
    .filter((file) => readSource(join(SOURCE_ROOTS.job, file)).includes("../features/job-runtime/"));

  assert.deepEqual(offenders, []);
});

test("job stage history presentation helpers are owned by the job layer", () => {
  const stageHistorySource = readSource(join(SOURCE_ROOTS.job, "stage-history.js"));
  const statusDetailUtilsSource = readSource(join(SOURCE_ROOTS.statusDetail, "utils.js"));
  // 迁移后跨目录 import 统一写 @/ 或功能内相对路径，断言用路径无关的正则，
  // 否则只匹配旧的 ../status-detail/utils.js 会让本门禁退化成永远通过。
  const jobDetailOffenders = walkFiles(SOURCE_ROOTS.jobDetail)
    .filter((file) => {
      const source = readSource(file);
      return source.includes("stageHistoryDisplay")
        && /["'][^"']*(?:status-detail|snapshot)\/utils\.js["']/.test(source);
    })
    .map((file) => relativeToProject(file));

  assert.match(stageHistorySource, /stageHistoryDisplay/);
  assert.match(stageHistorySource, /resolveStageHistoryDuration/);
  assert.match(statusDetailUtilsSource, /@retainpdf\/domain\/job/);
  assert.deepEqual(jobDetailOffenders, []);
});

test("source modules read API prefix from config api constants", () => {
  // SOURCE_ROOTS.reader (src/js/reader) 已在更早的迁移中删除，留在这里只贡献 0 个
  // 文件、让门禁半哑（A0 加固时发现）。移除该根，其余三根逐个校验存在且非空。
  const offenders = findMatchingImports(scanRoots([
    SOURCE_ROOTS.api,
    SOURCE_ROOTS.bootstrap,
    SOURCE_ROOTS.jobDetail,
  ]), API_PREFIX_FROM_ROOT_CONSTANTS_PATTERN);

  assert.deepEqual(offenders, []);
});

test("source modules read model defaults from config model constants", () => {
  // SOURCE_ROOTS.features（src/js/features）已删除：scanRoot 会因扫描根不存在
  // 直接失败。这里照 SOURCE_ROOTS.reader 的先例摘掉死根而不替换——本规则拦的是
  // 根 barrel `(../)+constants.js`，而 src/js/constants.js 已由
  // 「root compatibility barrels are removed」断言不存在，换任何新根都恒不命中。
  const offenders = findMatchingImports(scanRoots([
    SOURCE_ROOTS.bootstrap,
    SOURCE_ROOTS.config,
  ]), MODEL_CONSTANTS_FROM_ROOT_PATTERN);

  assert.deepEqual(offenders, []);
});

test("source modules read storage keys from config storage keys", () => {
  const offenders = findMatchingImports(
    scanRoot(SOURCE_ROOTS.config),
    STORAGE_KEYS_FROM_ROOT_PATTERN,
  );

  assert.deepEqual(offenders, []);
});

test("source modules read workflow defaults from config workflow defaults", () => {
  // 同上：摘掉已删除的 SOURCE_ROOTS.features。顺手把 filesUnder 换成 scanRoot——
  // filesUnder 对不存在的根静默返回 []，正是本文件反复防的「静默变绿」。
  const offenders = findMatchingImports(
    scanRoot(SOURCE_ROOTS.bootstrap),
    WORKFLOW_DEFAULTS_FROM_ROOT_PATTERN,
  );

  assert.deepEqual(offenders, []);
});

test("bootstrap external imports stay isolated in explicit leaf ports", () => {
  const offenders = walkFiles(BOOTSTRAP_ROOT)
    .filter((file) => BOOTSTRAP_EXTERNAL_IMPORT_PATTERN.test(readSource(file)))
    .map((file) => relative(BOOTSTRAP_ROOT, file))
    .filter((file) => !BOOTSTRAP_EXTERNAL_IMPORT_ALLOWLIST.has(file));

  assert.deepEqual(offenders, []);
});

test("bootstrap grouped port list covers grouped port files", () => {
  const groupedPortSet = new Set(BOOTSTRAP_GROUPED_PORT_FILES);
  const discovered = walkFiles(BOOTSTRAP_ROOT)
    .map((file) => relative(BOOTSTRAP_ROOT, file))
    .filter((file) => /(?:-ports|mount-ports|feature-controllers-port)\.(?:js|ts)$/.test(file))
    .filter((file) => !BOOTSTRAP_GROUPED_PORT_DISCOVERY_ALLOWLIST.has(file));
  const missing = discovered.filter((file) => !groupedPortSet.has(file));

  assert.deepEqual(missing, []);
});

test("runtime source paths avoid the legacy hidden credential facade", () => {
  const bootstrapFiles = walkFiles(BOOTSTRAP_ROOT);
  const desktopFiles = walkFiles(SOURCE_ROOTS.desktop);
  // credentials 已迁至 src/features/credentials：扫描根从已删除的 src/js/features
  // 改指新功能层，规则本身（谁都不许依赖隐藏凭据门面）仍然成立。
  const featureFiles = scanRoot(FEATURE_LAYER_ROOT).filter((filePath) => {
    return !filePath.endsWith("/features/credentials/hidden-inputs.js")
      && !filePath.endsWith("/features/credentials/hidden-inputs.ts");
  });
  for (const filePath of [...bootstrapFiles, ...desktopFiles, ...featureFiles]) {
    const source = readFileSync(filePath, "utf8");
    assert.equal(
      source.includes("features/credentials/hidden-inputs.js")
        || source.includes("../credentials/hidden-inputs.js")
        || source.includes("./hidden-inputs.js"),
      false,
      `${filePath} should not depend on hidden-inputs.js`,
    );
  }
});

test("job runtime default adapter shims are not kept in feature layer", () => {
  // 原断言在 src/js/features/job-runtime/ —— 该目录已随 jobs 功能迁走并删除，
  // 断言恒真。改指真实落点 features/jobs/domain/runtime，防回弹才继续有效。
  for (const fileName of ["job-actions-runtime-port.js", "presentation-runtime-port.js"]) {
    assert.equal(existsSync(resolveSourcePath(join(JOB_RUNTIME_DOMAIN, fileName))), false);
  }
});

// recent-jobs 已随 library 功能迁至 features/library/domain/recent-jobs。
const RECENT_JOBS_DOMAIN = join(PROJECT_ROOT, "src/features/library/domain/recent-jobs");
function readRecentJobsSource(fileName) {
  return readSource(join(RECENT_JOBS_DOMAIN, fileName.replace(/\.js$/, ".ts")));
}

test("recent jobs feature does not import home state directly", () => {
  for (const fileName of ["controller.js", "loader.js", "commit.js", "runtime-item.js"]) {
    // 允许 `import type { HomeStatePort }`（编译期擦除，无运行时依赖）
    const source = sourceWithoutTypeImports(readRecentJobsSource(fileName));

    assert.equal(source.includes("../home/state.js"), false);
  }
  assert.equal(readRecentJobsSource("runtime-item.js").includes("../../job/core.js"), false);
  assert.equal(readRecentJobsSource("runtime-item.js").includes("../../job-status/"), false);
  assert.match(readRecentJobsSource("runtime-item.js"), /runtime-value-helpers\.js/);
  assert.equal(
    readRecentJobsSource("library-refresh-port.js").includes("../library/library-event-port.js"),
    false,
  );
  assert.equal(
    readRecentJobsSource("active-job-recovery.js").includes("../job-runtime/active-job-storage.js"),
    false,
  );
  assert.equal(readRecentJobsSource("state.js").includes("../../state/store.js"), false);
  assert.match(readRecentJobsSource("loading-state-contract.js"), /RECENT_JOBS_LOADING_STATES/);
});

test("current job state is store-only with no legacy mirror", () => {
  const currentJobStateSource = readJobRuntimeSource("current-job-state.js");
  const secondarySelectorSource = readJobRuntimeSource("current-job-secondary-selectors.js");

  // 迁移完成:镜像 port 文件不得存在,选择器读 store 快照
  // 同上：扫描点从已删除的 src/js/features/job-runtime 改指 features/jobs/domain/runtime。
  assert.equal(existsSync(resolveSourcePath(join(JOB_RUNTIME_DOMAIN, "legacy-current-job-state-port.js"))), false);
  assert.equal(/state\.currentJob[A-Za-z]*\s*=(?!=)/.test(currentJobStateSource), false);
  // 允许 TS 收窄：currentJobStoreFor(state as object | null | undefined).getSnapshot()
  assert.match(
    currentJobStateSource,
    /currentJobStoreFor\(\s*state(?:\s+as\s+[^)]+)?\s*\)\.getSnapshot\(\)/,
  );
  assert.equal(currentJobStateSource.includes("secondary-resource-cache.js"), false);
  assert.match(currentJobStateSource, /current-job-secondary-selectors\.js/);
  assert.match(secondarySelectorSource, /secondary-resource-cache\.js/);
});

test("job runtime library events use injected library ports", () => {
  const controllerSource = readJobRuntimeSource("controller.js");
  const libraryEventsSource = readJobRuntimeSource("library-events.js");

  assert.equal(controllerSource.includes("../library/library-event-port.js"), false);
  assert.equal(libraryEventsSource.includes("../library/library-event-port.js"), false);
  assert.equal(libraryEventsSource.includes("createLibraryEventPort"), false);
  assert.match(controllerSource, /libraryEventPort/);
  assert.match(libraryEventsSource, /contracts\/library-event-contract\.js/);
});

test("job domains are consumed from packages instead of web mirrors", () => {
  assert.deepEqual(
    walkFiles(SOURCE_ROOTS.jobMirror),
    [],
    "frontend/web/src/js/job must not return; use @retainpdf/domain/job",
  );
  assert.deepEqual(
    walkFiles(SOURCE_ROOTS.jobStatus),
    [],
    "frontend/web/src/js/job-status must not return; use @retainpdf/domain/job-status",
  );

  // 原先断言主页网关的 external/job.ts 转出 job-status；B8 解散网关后，
  // 真正的消费点是装配工厂本身。
  const runtimeFeaturesSource = readSource(join(
    PROJECT_ROOT,
    "src/app/home/composition/create-runtime-features.ts",
  ));
  assert.match(runtimeFeaturesSource, /@retainpdf\/domain\/job-status/);
});

test("ui layer does not keep stage action compatibility helper", () => {
  assert.equal(existsSync(join(SOURCE_ROOTS.ui, "stage-actions.js")), false);
});

test("status detail layer does not keep legacy render compatibility facades", () => {
  for (const fileName of ["renderer.js", "presentation.js"]) {
    assert.equal(existsSync(join(SOURCE_ROOTS.statusDetail, fileName)), false);
  }
});

test("credentials runtime state is store-only with no legacy mirror ports", () => {
  // credentials 已迁至 src/features/credentials（按功能重组），其非 React 实现在 domain/。
  const CREDENTIALS_DOMAIN = join(PROJECT_ROOT, "src/features/credentials/domain");
  // credential slice 已统一到 app-framework store,镜像 port 文件不应再出现
  for (const fileName of ["runtime-state-port.ts", "balance-state-port.ts", "legacy-runtime-port.ts"]) {
    assert.equal(existsSync(join(CREDENTIALS_DOMAIN, fileName)), false);
  }
  for (const fileName of ["validation.ts", "deepseek-flow.ts", "browser.ts", "ocr-readiness-flow.ts"]) {
    const source = readSource(join(CREDENTIALS_DOMAIN, fileName));
    // 迁移后跨目录 import 统一写 @/ 别名，断言必须同时覆盖新旧两种写法，
    // 否则只匹配旧的相对路径会让本门禁退化成永远通过。
    assert.equal(/["'][^"']*state\/actions\.js["']/.test(source), false);
    assert.equal(source.includes("legacy-runtime-port"), false);
    assert.equal(source.includes("balance-state-port"), false);
  }
});

test("upload controller reads upload state only through upload state port", () => {
  // upload 已随按功能重组迁至 src/features/ingest/domain/upload。
  const UPLOAD_DOMAIN = join(PROJECT_ROOT, "src/features/ingest/domain/upload");
  const source = readSource(join(UPLOAD_DOMAIN, "controller.ts"));
  const stateSource = readSource(join(UPLOAD_DOMAIN, "state.ts"));

  // 迁移后跨目录 import 统一写 @/ 别名，断言用路径无关的正则，
  // 否则只匹配旧相对路径会让本门禁退化成永远通过。
  const legacyStateImport = /["'][^"']*state\/(?:actions|upload-state|store)\.js["']/;
  assert.doesNotMatch(source, legacyStateImport);
  assert.match(source, /getUploadStatePort/);
  assert.doesNotMatch(stateSource, legacyStateImport);
});

// ===== React 迁移防回弹门禁(Phase 0 起生效) =====
// 新世界(src/app/**、src/ui/**、src/features/**)只能消费旧世界的纯逻辑层
// (api/contracts/state-port/actions/view-model 等),禁止 import 旧视图层——
// 一旦引用,旧 DOM 视图就会"回弹"进 React 树,迁移永远收不了口。
//
// 注:tests/esm-entry-resolution.test.mjs 已随 Phase 2b reader cutover 退役——
// 三页(home/detail/reader)入口全部经 esbuild 打包,import 断链在 build:js
// 构建期即失败,不再需要独立的原生 ESM 解析守卫。

// features 只允许经这一条路径引用 app 层：主页装配出来的 DI 容器。
//
// 为什么不能靠搬文件消除：useHomeServices() 要的是 HomeApp 装配出来的**实例**，
// 而它的类型 HomeServices（composition/types.ts + types-split/ 共 692 行）引用了
// 每一个功能的类型。把 context 下沉到 platform 会造成 platform → features，
// 比现状更糟。正确终局是按域拆窄 Context（代码里已有 useHomeDialogStore /
// useHomeStatusAreaStore / useHomeWorkflowDialog / useHomeSettingsHub 四个先例），
// 但那是行为影响性重构，违反「移动与行为修改分开」，留作批次 6。
//
// 在此之前用**只减不增的清单**把这条遗留倒置显性化：新增消费方必须先改这里，
// 评审时能看见。
const HOME_SERVICES_CONTEXT_CONSUMERS = Object.freeze([
  "src/features/ask/ui/HomeAskView.tsx",
  "src/features/book-detail/ui/BookDetailDialog.tsx",
  "src/features/book-detail/ui/panels/translate/TranslateProgress.tsx",
  "src/features/ingest/ui/InlineErrorBox.tsx",
  "src/features/ingest/ui/TranslationWorkflowDialog.tsx",
  "src/features/ingest/ui/WorkflowPanel.tsx",
  "src/features/ingest/ui/components/PageRangeDialog.tsx",
  "src/features/ingest/ui/components/UploadTile.tsx",
  "src/features/job-detail/ui/panels/FailurePanel.tsx",
  "src/features/job-detail/ui/panels/OverviewPanel.tsx",
  "src/features/job-detail/ui/useStatusDetailOverview.ts",
  "src/features/jobs/ui/ResultActions.tsx",
  "src/features/jobs/ui/use-status-card-model.ts",
  "src/features/library/ui/page/RecentJobsLibrary.tsx",
  "src/features/library/ui/page/use-library-search-binding.ts",
]);

// detail / reader 两页原本各有一条「不得直连 src/js/*，须经本页 external.ts」。
// 批次 5 之后 src/js 与两页的 external.ts 都已删除——detail 的在 C1 解散，
// reader 的仍在（它是 @retainpdf/reader 包的宿主注入面，不是旧世界网关）。
// 规则对象消失，改为断言旧目录不得复活；方向约束由 C3 的四层门禁接管。
test("已删除的旧目录不得复活", () => {
  for (const dir of ["src/js", "src/pages", "src/shared", "src/components", "src/lib"]) {
    assert.equal(
      existsSync(join(PROJECT_ROOT, dir)),
      false,
      `${dir} 已在批次 5 删除，不得以任何形式复活`,
    );
  }
  assert.equal(
    existsSync(join(PROJECT_ROOT, "src/app/home/composition/external.ts")),
    false,
    "主页集中网关已在 B8 解散，不得复活（蓝图 §5.2：不允许用新 barrel 取代）",
  );
  assert.equal(
    existsSync(join(PROJECT_ROOT, "src/app/detail/external.ts")),
    false,
    "detail 页网关已在 C1 解散，不得复活",
  );
});

test("features 引用 app 层仅限主页 DI 容器，且消费方清单只减不增", () => {
  const featureFiles = scanRoot(join(PROJECT_ROOT, "src/features"));
  const appImports = [];
  const contextConsumers = [];
  for (const file of featureFiles) {
    const source = readFileSync(file, "utf8");
    const rel = relativeToProject(file).replace(/\\/g, "/");
    for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["'](@\/app\/[^"']+)["']/g)) {
      const target = match[1];
      if (target === "@/app/home/home-services-context.js") {
        contextConsumers.push(rel);
      } else {
        appImports.push(`${rel} → ${target}`);
      }
    }
  }
  assert.deepEqual(
    appImports,
    [],
    "features 不得引用 app 层（唯一例外是 @/app/home/home-services-context.js）",
  );
  const unlisted = [...new Set(contextConsumers)]
    .filter((file) => !HOME_SERVICES_CONTEXT_CONSUMERS.includes(file))
    .sort();
  assert.deepEqual(
    unlisted,
    [],
    "新增了 useHomeServices 消费方，请先登记进 HOME_SERVICES_CONTEXT_CONSUMERS（该清单只减不增，批次 6 用窄 Context 消除）",
  );
  const stale = HOME_SERVICES_CONTEXT_CONSUMERS
    .filter((file) => !contextConsumers.includes(file))
    .sort();
  assert.deepEqual(stale, [], "清单里有已不再消费该 context 的条目，请删除（只减不增）");
});

test("React 新世界禁止 import 旧视图层(防回弹)", () => {
  const REACT_ROOTS = [
    join(PROJECT_ROOT, "src/app"),
    // src/shared 已在 A7 解散：React 侧（hooks/icons/theme/decor/download-toast）
    // 全部落到 src/ui，防回弹扫描根随之改指这里。
    join(PROJECT_ROOT, "src/ui"),
    // 按功能重组后的新树同样受防回弹约束，否则功能迁过去就脱离门禁。
    join(PROJECT_ROOT, "src/features"),
  ];
  // 旧视图层路径特征:命中即违规
  const FORBIDDEN_IMPORT_PATTERNS = [
    // 只拦旧世界的 src/js/components/;新世界页面自身的 components/ 子目录
    // (src/app/*/components/,目录约定)不在此列
    // src/js/components/ 已随 library 迁移清空并删除；保留本条防止新代码重建该目录。
    [/(?:from\s+|import\s+)["'][^"']*\/js\/components\//, "src/js/components/(自定义元素/对话框视图)"],
    // domain/ 可以读构建产物（app-update 需要 APP_VERSION）；ui/ 不行，
    // 由同功能的 domain/ 做一层薄封装再向 ui/ 暴露。
    [/(?:from\s+|import\s+)["'][^"']*\/generated\//, "platform/generated/(预编译产物)", { domainAllowed: true }],
    // 装配层：app/ 做依赖接线是它的职责，features/ 与 ui/ 不得触达。
    // 作用域在下面的循环里按扫描根收窄（src/app 即未来的 app/）。
    [/(?:from\s+|import\s+)["'][^"']*\/bootstrap\//, "bootstrap/(DI 装配层，仅 app 可用)"],
    [/(?:from\s+|import\s+)["'][^"']*\/features\/[^"']*\/view\.js["']/, "features/*/view.js(旧 DOM 视图)"],
    [/(?:from\s+|import\s+)["'][^"']*\/features\/[^"']*view-port\.js["']/, "features/*view-port.js(旧 DOM 端口)"],
    [/(?:from\s+|import\s+)["'][^"']*\/features\/[^"']*dom-contract\.js["']/, "features/*dom-contract.js(旧 DOM 契约)"],
    [/(?:from\s+|import\s+)["'][^"']*\/features\/[^"']*card-markup\.js["']/, "features/*card-markup.js(字符串模板)"],
    [/(?:from\s+|import\s+)["'][^"']*\/features\/[^"']*card-template\.js["']/, "features/*card-template.js(字符串模板)"],
    [/(?:from\s+|import\s+)["'][^"']*\/js\/dom\//, "src/js/dom/(旧 DOM 工具)"],
    // src/js/state 已在 B10 整体删除（6 片死代码 + 塌缩剩余两片到
    // platform/desktop/state.ts）。保留本条防止该目录以任何形式复活。
    [/(?:from\s+|import\s+)["'][^"']*\/js\/state\//, "src/js/state/(已删除的全局状态单例)"],
    [/(?:from\s+|import\s+)["'][^"']*\/js\/job\/core/, "src/js/job/core.js(任务核心)"],
    // domain/ 用 platform 的 store 工厂建自己的状态是目标架构（15 个功能在用）；
    // ui/ 不得直连，须经同功能 domain/ 暴露的 store 实例。
    [/(?:from\s+|import\s+)["'][^"']*\/platform\/store\/store/, "platform/store/store.ts(状态框架)", { domainAllowed: true }],
    [/import\s*\(\s*["'][^"']*\/js\//, "dynamic import src/js/*(应经 composition/external)"],
  ];

  function walkReactFiles(root) {
    const pending = [root];
    const files = [];
    while (pending.length > 0) {
      const current = pending.pop();
      const stat = statSync(current);
      if (stat.isDirectory()) {
        for (const entry of readdirSync(current)) {
          pending.push(join(current, entry));
        }
        continue;
      }
      if (isSourceFile(current)) {
        files.push(current);
      }
    }
    return files.sort();
  }

  function isExternalGate(file) {
    const normalized = file.replace(/\\/g, "/");
    return normalized.includes("/composition/external")
      || normalized.endsWith("/external.ts")
      || normalized.endsWith("/external.js");
  }

  const violations = [];
  // 原先是 `if (!existsSync(root)) continue;`——三个根一旦都被搬走，循环整个跳过，
  // violations 保持 []，本门禁（防回弹总闸）就静默变绿。改为逐根断言存在，并在
  // 循环外累计实际扫过的文件数，扫到 0 个同样判失败。
  let scannedFileCount = 0;
  for (const root of REACT_ROOTS) {
    assert.ok(
      existsSync(root),
      `扫描根不存在，防回弹门禁已失效: ${relativeToProject(root)}`,
    );
    const rootFiles = walkReactFiles(root);
    scannedFileCount += rootFiles.length;
    for (const file of rootFiles) {
      if (isExternalGate(file)) continue;
      const source = readFileSync(file, "utf8");
      // src/app 是装配层（B1 后改名为 src/app），依赖接线正是它的职责。
      const normalizedPath = file.replace(/\\/g, "/");
      const isAppLayer = normalizedPath.includes("/src/app/") || normalizedPath.includes("/src/app/");
      const isFeatureDomain = /\/src\/features\/[^/]+\/domain\//.test(normalizedPath);
      // app 是装配层：它建页面级 store（home-store / text-store）、给各域接线，
      // 用 platform 的 store 工厂与 features/*/domain 同理合法。禁止的是
      // features/*/ui 与 src/ui 直连——那两处必须经 domain 暴露的实例。
      const isStoreFactoryUser = isFeatureDomain || isAppLayer;
      for (const [pattern, label, options] of FORBIDDEN_IMPORT_PATTERNS) {
        if (isAppLayer && label.startsWith("bootstrap/")) continue;
        if (isFeatureDomain && options?.domainAllowed) continue;
        if (isStoreFactoryUser && label.startsWith("platform/store/store")) continue;
        if (label.startsWith("dynamic import")) {
          if (file.includes("/composition/")) {
            // composition 层含大量 TS 类型查询 `import("js/...")`，非运行时动态 import，豁免
            continue;
          }
          // 排除 TS 类型查询 `import("...")`（Promise<import> / `=> import(` / `: import(` / `as import(`），只拦运行时动态 import
          const stripped = source
            .replace(/Promise<\s*import\s*\(/g, "Promise<typeImport(")
            .replace(/:\s*import\s*\(/g, ": typeImport(")
            .replace(/=>\s*import\s*\(/g, "=> typeImport(")
            .replace(/\bas\s+import\s*\(/g, "as typeImport(")
            .replace(/import\s+type\s+/g, "typeImport ");
          if (pattern.test(stripped)) {
            violations.push(`${relative(PROJECT_ROOT, file)} → ${label}`);
          }
          continue;
        }
        if (pattern.test(source)) {
          violations.push(`${relative(PROJECT_ROOT, file)} → ${label}`);
        }
      }
    }
  }
  assert.ok(
    scannedFileCount > 0,
    `防回弹门禁一个文件都没扫到，门禁已失效: ${REACT_ROOTS.map(relativeToProject).join(", ")}`,
  );
  assert.deepEqual(
    violations,
    [],
    `React 新世界引用了旧视图层,请改为消费纯逻辑层或在 React 内重写:\n  ${violations.join("\n  ")}`,
  );
});


/** Any import whose module path reaches src/js (…/js/…); composition/external is the only gate. */
const HOME_FEATURES_DIRECT_JS_IMPORT =
  /from\s+["'][^"']*(?:^|\/)js\/[^"']+["']|from\s+["'][^"']*(?:\.\.\/)+js\/[^"']+["']/;


// 已退休：`app/home/features/` 在批次 5B 被清空（app-shell 迁 app/home/shell，
// shared 的两个文件按归属迁进 features/{jobs,library}）。该规则的意图「app 层
// 不得直连 src/js/*」现由防回弹总闸覆盖——src/js 只剩 state/，其 store 已在
// FORBIDDEN_IMPORT_PATTERNS 里，且 REACT_ROOTS 含 src/app。已实证：
// 往 app/home/HomeApp.tsx 注入 @/js/state/store.js 会被点名。





// 已退休：本规则校验「external barrel 覆盖 home features 用到的全部符号」，
// 两侧对象都没了——home features 目录已清空，external 网关本身也在 B8 解散。

test("@/ui/lib/utils proxies to @retainpdf/ui (not duplicated cn impl)", () => {
  const utilsPath = join(PROJECT_ROOT, "src/ui/lib/utils.ts");
  const uiUtilsPath = join(PROJECT_ROOT, "../../frontend/packages/ui/src/lib/utils.ts");
  assert.equal(existsSync(utilsPath), true, "src/ui/lib/utils.ts must exist");
  assert.equal(existsSync(uiUtilsPath), true, "frontend/packages/ui/src/lib/utils.ts must exist");
  const proxySource = readFileSync(utilsPath, "utf8");
  // sole export should re-export from @retainpdf/ui, no local clsx/twMerge impl
  assert.match(proxySource, /from\s+["']@retainpdf\/ui\/lib\/utils["']/, "src/ui/lib/utils.ts should proxy to @retainpdf/ui/lib/utils");
  assert.equal(proxySource.includes("clsx"), false, "proxy must not duplicate clsx impl");
  assert.equal(proxySource.includes("twMerge"), false, "proxy must not duplicate twMerge impl");
  const uiSource = readFileSync(uiUtilsPath, "utf8");
  assert.match(uiSource, /clsx/, "frontend/packages/ui/src/lib/utils.ts should own clsx/twMerge impl");
  assert.match(uiSource, /twMerge/, "frontend/packages/ui/src/lib/utils.ts should own clsx/twMerge impl");
  // Workspace packages must resolve through package.json exports, not source aliases.
  const tsconfigRaw = readFileSync(join(PROJECT_ROOT, "tsconfig.json"), "utf8");
  assert.doesNotMatch(tsconfigRaw, /packages\/(?:api|domain|reader|ui)\/src/);
  const bundle = readFileSync(join(PROJECT_ROOT, "scripts/build-js-bundle.mjs"), "utf8");
  assert.doesNotMatch(bundle, /packages\/(?:api|domain|reader|ui)\/src/);
  const loader = readFileSync(join(PROJECT_ROOT, "tests/helpers/jsx-loader.mjs"), "utf8");
  assert.doesNotMatch(loader, /packages\/(?:api|domain|reader|ui)\/src/);
});

test("@retainpdf/ui and @retainpdf/api packages expose expected entries", () => {
  for (const pkg of ["ui", "api"]) {
    const pkgJson = JSON.parse(readFileSync(join(PROJECT_ROOT, `../packages/${pkg}/package.json`), "utf8"));
    assert.equal(pkgJson.name, `@retainpdf/${pkg}`, `packages/${pkg}/package.json name must be @retainpdf/${pkg}`);
    assert.ok(pkgJson.exports?.["."], `packages/${pkg} must export "."`);
    assert.ok(pkgJson.scripts?.build, `packages/${pkg} must have build script`);
    assert.ok(pkgJson.scripts?.typecheck, `packages/${pkg} must have typecheck script`);
  }
  // ui exports styles.css must resolve to existing built artifact after build
  const uiPkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "../../frontend/packages/ui/package.json"), "utf8"));
  assert.ok(uiPkg.exports?.["./styles.css"], "@retainpdf/ui must export ./styles.css");
  // api exports library-books / jobs subpaths
  const apiPkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "../../frontend/packages/api/package.json"), "utf8"));
  assert.ok(apiPkg.exports?.["./library-books"], "@retainpdf/api must export ./library-books");
  assert.ok(apiPkg.exports?.["./jobs"], "@retainpdf/api must export ./jobs");
  assert.ok(apiPkg.exports?.["./job-images"], "@retainpdf/api must export ./job-images");
  assert.ok(apiPkg.exports?.["./reader"], "@retainpdf/api must export ./reader");
  assert.ok(apiPkg.exports?.["./search"], "@retainpdf/api must export ./search");
});

test("reader, search, and recent-job images use the canonical API package", () => {
  // reader 宿主已随按功能重组迁至 src/features/reader/domain/host。
  const readerData = readFileSync(
    join(PROJECT_ROOT, "src/features/reader/domain/host/data.ts"),
    "utf8",
  );
  for (const entry of ["http", "jobs-artifacts", "jobs", "reader", "translation-debug"]) {
    assert.match(
      readerData,
      new RegExp(`from ["']@retainpdf/api/${entry}["']`),
      `Reader data port must consume @retainpdf/api/${entry}`,
    );
  }
  assert.doesNotMatch(
    readerData,
    /from\s+["'][^"']*js\/api\/(?:http|jobs-artifacts|reader|translation-debug)\.js["']/,
  );
  assert.doesNotMatch(readerData, /loadAiChat\s*:/, "deprecated Reader AI chat must not be wired");

  const legacySearchAdapter = readFileSync(join(PROJECT_ROOT, "src/platform/api/legacy/search.ts"), "utf8");
  assert.match(legacySearchAdapter, /from\s+["']@retainpdf\/api\/search["']/);
  assert.doesNotMatch(legacySearchAdapter, /\bfetch\s*\(/, "search adapter must not duplicate HTTP logic");

  // 卡片 presenter 与图片加载器已随 library 功能迁至 features/library/domain/card。
  for (const file of [
    "src/features/library/domain/card/recent-job-card-presenter.ts",
    "src/features/library/domain/card/recent-job-card-image-loader.ts",
  ]) {
    const source = readFileSync(join(PROJECT_ROOT, file), "utf8");
    assert.match(source, /from\s+["']@retainpdf\/api\/job-images["']/);
    assert.doesNotMatch(source, /api\/job-images\.js/);
  }
  assert.equal(existsSync(join(PROJECT_ROOT, "src/platform/api/legacy/job-images.ts")), false);
  assert.equal(existsSync(join(PROJECT_ROOT, "src/platform/api/legacy/reader.ts")), false);
});

test("job cancellation and OCR ambiguity recovery use canonical endpoint clients", () => {
  const runtimeController = readFileSync(
    join(PROJECT_ROOT, "src/features/jobs/domain/runtime/controller.ts"),
    "utf8",
  );
  assert.match(runtimeController, /cancelOcrJob/);
  assert.match(runtimeController, /cancelJob/);
  assert.doesNotMatch(runtimeController, /submitJson/);
  assert.doesNotMatch(runtimeController, /buildJobDetailEndpoint/);

  const apiActions = readFileSync(
    join(PROJECT_ROOT, "../../frontend/packages/api/src/jobs-actions.ts"),
    "utf8",
  );
  assert.match(apiActions, /export async function cancelJob/);
  assert.match(apiActions, /export async function cancelOcrJob/);
  assert.match(apiActions, /export async function resolveOcrAmbiguity/);
  assert.match(apiActions, /\/ocr\/resolve-ambiguity/);
});
