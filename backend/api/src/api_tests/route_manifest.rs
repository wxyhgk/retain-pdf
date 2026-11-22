//! 接口清单快照：`docs/routes.txt` 列出全部路由（方法、路径、多用户下网站账号的访问策略、归哪个领域负责、谁在用）。
//!
//! 接口多了、杂了，很大一部分是因为加接口没有门槛——加一条就是加一条，没人注意到总数在涨。
//! 这份快照让每次增删、改策略都出现在提交的 diff 里，要有意识地确认。改了路由之后这里会红，
//! 确认是有意的，就用 `UPDATE_ROUTES=1 cargo test -p retainpdf-api --lib route_manifest` 重新生成。
//!
//! 清单和接口目录（总目录 `docs/api/00-接口目录.md`，各组在 `docs/api/00-接口目录/` 下）都从接口登记表（`app/endpoints.rs`）汇总，不启动服务。

use std::collections::BTreeMap;
use std::path::Path;

use crate::app::endpoints::route_policy;
use crate::services::accounts::RoutePolicy;

/// 接口清单：从登记表汇总，一行一个接口。
fn manifest() -> String {
    let mut table: BTreeMap<String, Vec<(String, &'static str, &'static str, String)>> = BTreeMap::new();
    for endpoint in crate::app::registered_endpoints() {
        table.entry(endpoint.path.to_string()).or_default().push((
            endpoint.method.to_string(),
            endpoint.access.label(),
            endpoint.owner.label(),
            users_label(&endpoint),
        ));
    }
    let mut lines = vec![
        "# 全部 HTTP 路由：方法 路径 多用户下网站账号的访问策略（signed 登录可用 / admin 只给管理员 /".to_string(),
        "# closed 关闭 / public 不需要登录） 归哪个领域负责 by 谁在用（web 前端页面 / desktop 桌面壳 / worker Python 流水线 /".to_string(),
        "# cli 命令行 / ops 运维调试 / multiuser 只有已停的多用户版 / none 还没有调用方）。".to_string(),
        "# 由 src/api_tests/route_manifest.rs 从接口登记表生成，不要手改：".to_string(),
        "#   UPDATE_ROUTES=1 cargo test -p retainpdf-api --lib route_manifest".to_string(),
    ];
    let count: usize = table.values().map(Vec::len).sum();
    lines.push(format!("# {} 条路径，{count} 个接口", table.len()));
    for (path, methods) in &mut table {
        methods.sort();
        for (method, access, owner, users) in methods.iter() {
            lines.push(format!("{method:<7}{path}  {access}  {owner}  by {users}"));
        }
    }
    lines.join("\n") + "\n"
}

fn users_label(endpoint: &crate::app::endpoints::Endpoint) -> String {
    endpoint.users.iter().map(|user| user.label()).collect::<Vec<_>>().join(",")
}

/// 路由只在登记表里注册：路由文件里不许再直接写 `.route(`，否则这条接口不进接口目录、也没有说明。
#[test]
fn routes_are_registered_only_through_endpoint_tables() {
    for file in crate::test_support::routes::router_source_files() {
        let source = std::fs::read_to_string(&file).unwrap();
        let code = source.split("\n#[cfg(test)]").next().unwrap_or_default();
        assert!(
            !code.contains(".route("),
            "{}: 直接写了 .route(…)；改成在这个文件的 crate::endpoints! 登记表里加一条",
            file.display()
        );
    }
}

#[test]
fn route_manifest_matches_snapshot() {
    let snapshot = Path::new(env!("CARGO_MANIFEST_DIR")).join("docs/routes.txt");
    let current = manifest();
    if std::env::var_os("UPDATE_ROUTES").is_some() {
        std::fs::write(&snapshot, &current).unwrap();
        return;
    }
    let saved = std::fs::read_to_string(&snapshot).unwrap_or_default();
    if saved != current {
        let saved_lines: std::collections::BTreeSet<&str> = saved.lines().collect();
        let current_lines: std::collections::BTreeSet<&str> = current.lines().collect();
        let added: Vec<_> = current_lines.difference(&saved_lines).collect();
        let removed: Vec<_> = saved_lines.difference(&current_lines).collect();
        panic!(
            "routes changed (docs/routes.txt is out of date).\n+ {added:#?}\n- {removed:#?}\n\
             If intended: UPDATE_ROUTES=1 cargo test -p retainpdf-api --lib route_manifest"
        );
    }
}

/// 接口目录分总两级（2026-11-22）：总目录 `docs/api/00-接口目录.md` 放说明、统计、分组表，每组一个文件放在
/// `docs/api/00-接口目录/` 下，总目录引用它们。
const DIRECTORY_INDEX: &str = "docs/api/00-接口目录.md";
const DIRECTORY_DIR: &str = "docs/api/00-接口目录";

/// 路由文件（模块路径的最后几段）→ 分组：(模块后缀, 文件名, 标题)。每个路由文件都要在这里登记，否则测试红
/// （以前没登记的落进“其他”，标签、运行资源就在那里）。文件名的编号就是总目录里的顺序。
const SECTIONS: &[(&str, &str, &str)] = &[
    ("router::public", "01-登录和健康检查", "登录和健康检查（不需要登录）"),
    ("router::accounts", "02-账号和管理后台", "账号、管理后台"),
    ("router::credentials", "03-凭据", "凭据"),
    ("router::providers", "04-服务商", "模型和 OCR 服务商"),
    ("router::ingestion", "05-上传", "上传"),
    ("router::jobs::lifecycle", "06-任务", "任务"),
    ("router::jobs::actions", "07-任务-操作", "任务 · 操作"),
    ("router::jobs::progress", "08-任务-进度", "任务 · 进度"),
    ("router::jobs::files", "09-任务-文件", "任务 · 文件"),
    ("router::jobs::reports", "10-任务-报告", "任务 · 报告"),
    ("router::jobs::reader", "11-任务-阅读", "任务 · 阅读"),
    ("router::jobs::translations", "12-任务-译文", "任务 · 译文"),
    ("router::jobs::data", "13-任务-数据", "任务 · 数据"),
    ("router::documents", "14-书", "书（文档）"),
    ("router::collections", "15-合集", "合集"),
    ("router::tags", "16-标签", "标签"),
    ("router::glossaries", "17-术语表", "术语表"),
    ("router::fonts", "18-字体", "字体"),
    ("router::runtime_assets", "19-运行资源", "运行资源（字体、Typst 按需下载）"),
    ("router::sync", "20-多设备同步", "多设备同步"),
    ("router::backups", "21-备份和用量", "备份、模型用量"),
    ("router::model_requests", "22-内部-模型调用", "内部：模型调用"),
];

/// 这个路由文件归哪一组（`SECTIONS` 里的下标）。没登记返回 None。
fn section_of(module: &str) -> Option<usize> {
    SECTIONS
        .iter()
        .enumerate()
        .filter(|(_, (suffix, _, _))| module.ends_with(suffix) || module.contains(&format!("{suffix}::")))
        .max_by_key(|(_, (suffix, _, _))| suffix.len())
        .map(|(index, _)| index)
}

fn short_path(path: &str) -> String {
    path.strip_prefix("/api/v1").filter(|rest| !rest.is_empty()).unwrap_or(path).to_string()
}

const LEGEND: &[&str] = &[
    "「谁能用」只在多用户模式下起作用：`signed` 登录就能用（路径里的编号要是自己的）、`admin` 只给管理员、",
    "`closed` 对网站账号关闭、`public` 不需要登录。单机版里所有接口都能用。",
    "",
    "「负责」是业务逻辑所在的领域包（改它、删它找谁）；「谁在用」：`web` 前端页面、`desktop` 桌面壳主进程、`worker` Python 流水线、",
    "`cli` 命令行、`ops` 运维和调试、`multiuser` 只有已停的多用户网站版、`none` 还没有调用方。依据是代码里的调用和 rust_api 的",
    "按接口计数（`backend/api/src/app/route_usage.rs`，用 `ops/development/route_usage_report.py` 看）。",
];

const GENERATED_NOTE: [&str; 2] = [
    "<!-- 由 backend/api/src/api_tests/route_manifest.rs 从接口登记表（backend/api/src/app/endpoints.rs）生成，不要手改：",
    "     UPDATE_ROUTES=1 cargo test -p retainpdf-api --lib route_manifest -->",
];

/// 接口目录：总目录和各组的文件，(相对仓库根的路径, 内容)。登记表里的全部接口按路由文件分组，旧地址列在新地址后面。
fn directory() -> Vec<(String, String)> {
    let endpoints = crate::app::registered_endpoints();
    let mut sections: BTreeMap<usize, Vec<crate::app::endpoints::Endpoint>> = BTreeMap::new();
    for endpoint in &endpoints {
        let section = section_of(endpoint.module)
            .unwrap_or_else(|| panic!("{}：路由文件没在 route_manifest.rs 的 SECTIONS 里登记分组", endpoint.module));
        sections.entry(section).or_default().push(*endpoint);
    }
    let link_of = |module: &str| -> String {
        let (_, stem, title) = SECTIONS[section_of(module).unwrap()];
        format!("[{title}](00-接口目录/{stem}.md)")
    };
    let current = endpoints.iter().filter(|e| e.replaced_by.is_none()).count();
    let mut index = vec!["# 接口目录".to_string(), String::new()];
    index.extend(GENERATED_NOTE.iter().map(|line| line.to_string()));
    index.push(String::new());
    index.push(match endpoints.len() - current {
        0 => format!("共 {} 个接口，分 {} 组，每组一个文件。地址前缀省略了 `/api/v1`。", endpoints.len(), sections.len()),
        old => format!(
            "共 {} 个接口（{current} 个现用地址、{old} 个旧地址：还能用，新代码不要再调），分 {} 组，每组一个文件。地址前缀省略了 `/api/v1`。",
            endpoints.len(),
            sections.len()
        ),
    });
    index.push(String::new());
    index.extend(LEGEND.iter().map(|line| line.to_string()));
    index.push(String::new());
    index.push("## 分组".to_string());
    index.push(String::new());
    index.push("| 分组 | 接口 | 负责 | 谁在用 |".to_string());
    index.push("|---|---|---|---|".to_string());
    let mut files = Vec::new();
    for (section, items) in &sections {
        let (_, stem, title) = SECTIONS[*section];
        let count = |pick: &dyn Fn(&crate::app::endpoints::Endpoint) -> Vec<&'static str>| -> String {
            let mut tally: BTreeMap<&str, usize> = BTreeMap::new();
            for endpoint in items {
                for label in pick(endpoint) {
                    *tally.entry(label).or_default() += 1;
                }
            }
            tally.iter().map(|(label, n)| format!("{label} {n}")).collect::<Vec<_>>().join("、")
        };
        index.push(format!(
            "| [{title}](00-接口目录/{stem}.md) | {} | {} | {} |",
            items.len(),
            count(&|e| vec![e.owner.label()]),
            count(&|e| e.users.iter().map(|user| user.label()).collect()),
        ));
        files.push((format!("{DIRECTORY_DIR}/{stem}.md"), section_file(title, items, &endpoints)));
    }
    index.extend(usage_summary(&endpoints, &link_of));
    let mut out = vec![(DIRECTORY_INDEX.to_string(), index.join("\n") + "\n")];
    out.extend(files);
    out
}

/// 一组的文件：标题、回到总目录的链接、这一组的接口表。
fn section_file(title: &str, items: &[crate::app::endpoints::Endpoint], endpoints: &[crate::app::endpoints::Endpoint]) -> String {
    let mut out = vec![format!("# {title}"), String::new()];
    out.extend(GENERATED_NOTE.iter().map(|line| line.to_string()));
    out.push(String::new());
    out.push(format!(
        "{} 个接口。属于[接口目录](../00-接口目录.md)；「谁能用」「负责」「谁在用」的取值见那里。地址前缀省略了 `/api/v1`。",
        items.len()
    ));
    out.push(String::new());
    out.push("| 方法 | 地址 | 谁能用 | 负责 | 谁在用 | 说明 | 旧地址 | 处理函数 |".to_string());
    out.push("|---|---|---|---|---|---|---|---|".to_string());
    for endpoint in items.iter().filter(|e| e.replaced_by.is_none()) {
        // 旧地址可能登记在别的路由文件里（比如任务下的封面现在在书下面），所以在全部接口里找。
        // 同一地址换方法的旧地址（比如 GET 换成 POST）方法和新地址不同，显示时带上方法。
        let olds: Vec<String> = endpoints
            .iter()
            .filter(|old| old.replaced_by == Some(endpoint.path) && replaces(old, endpoint))
            .map(|old| {
                let address = if old.method == endpoint.method {
                    short_path(old.path)
                } else {
                    format!("{} {}", old.method, short_path(old.path))
                };
                match old.summary.trim() {
                    "" => format!("`{address}`"),
                    note => format!("`{address}`（{}）", note.replace('|', "\\|")),
                }
            })
            .collect();
        out.push(format!(
            "| {} | `{}` | {} | {} | {} | {} | {} | `{}` |",
            endpoint.method,
            short_path(endpoint.path),
            endpoint.access.label(),
            endpoint.owner.label(),
            users_label(endpoint).replace(',', "、"),
            endpoint.summary.trim().replace('|', "\\|"),
            olds.join("<br>"),
            endpoint.handler.replace(' ', ""),
        ));
    }
    out.join("\n") + "\n"
}

/// 总目录的统计：按谁在用、按负责的领域各有多少；还没有调用方的、只有多用户版用的单独列出来，带上所在分组的链接。
fn usage_summary(endpoints: &[crate::app::endpoints::Endpoint], link_of: &dyn Fn(&str) -> String) -> Vec<String> {
    use crate::app::endpoints::User;
    let short = short_path;
    let mut by_user: BTreeMap<User, usize> = BTreeMap::new();
    let mut by_owner: BTreeMap<&str, usize> = BTreeMap::new();
    for endpoint in endpoints {
        for user in endpoint.users {
            *by_user.entry(*user).or_default() += 1;
        }
        *by_owner.entry(endpoint.owner.label()).or_default() += 1;
    }
    let mut out = vec![
        String::new(),
        "## 统计".to_string(),
        String::new(),
        format!(
            "按谁在用（一个接口可以有几个调用方）：{}。",
            by_user.iter().map(|(user, n)| format!("`{}` {n}", user.label())).collect::<Vec<_>>().join("、")
        ),
        String::new(),
        format!(
            "按负责的领域：{}。",
            by_owner.iter().map(|(owner, n)| format!("`{owner}` {n}")).collect::<Vec<_>>().join("、")
        ),
    ];
    for (user, title) in [
        (User::None, "还没有调用方的（后端先加的、调用方没接上的；要么接上，要么删）"),
        (User::Multiuser, "只有多用户网站版用的（2026-10-16 商业版停了，代码冻结）"),
    ] {
        let listed: Vec<String> = endpoints
            .iter()
            .filter(|endpoint| endpoint.users.contains(&user))
            .map(|endpoint| {
                let old = endpoint.replaced_by.map(|new| format!("（旧地址，新地址 `{}`）", short(new))).unwrap_or_default();
                format!("- {} `{}`{old}（{}）", endpoint.method, short(endpoint.path), link_of(endpoint.module))
            })
            .collect();
        out.push(String::new());
        out.push(format!("### {title}：{} 个", listed.len()));
        out.push(String::new());
        out.extend(listed);
    }
    out
}

/// 旧地址 `old` 算不算 `new` 的旧写法：方法相同；或者地址相同、只换了方法（GET 换 POST 这种）。
fn replaces(old: &crate::app::endpoints::Endpoint, new: &crate::app::endpoints::Endpoint) -> bool {
    old.method == new.method || old.path == new.path
}

/// 登记表自己的规矩：现用地址都要有说明；旧地址要指向一个存在的、方法相同的新地址，
/// 或者同一地址的另一个方法（只换方法时）。
#[test]
fn endpoint_registry_is_complete() {
    let endpoints = crate::app::registered_endpoints();
    for endpoint in &endpoints {
        match endpoint.replaced_by {
            None => assert!(
                !endpoint.summary.trim().is_empty(),
                "{} {}（{}）：登记表里缺一句话说明",
                endpoint.method,
                endpoint.path,
                endpoint.module
            ),
            Some(replacement) => assert!(
                endpoints
                    .iter()
                    .any(|e| e.path == replacement && replaces(endpoint, e) && e.replaced_by.is_none()),
                "{} {}：旧地址指向的新地址 {replacement} 不在登记表里（或者方法不同又不是同一地址换方法、它自己也是旧地址）",
                endpoint.method,
                endpoint.path
            ),
        }
    }
    let mut seen = std::collections::BTreeSet::new();
    for endpoint in &endpoints {
        assert!(seen.insert((endpoint.method, endpoint.path)), "{} {} 登记了两次", endpoint.method, endpoint.path);
    }
    // 谁在用：`none`（没有调用方）、`multiuser`（只有已停的多用户版）不能和别的写在一起，也不能重复。
    use crate::app::endpoints::User;
    for endpoint in &endpoints {
        let users = endpoint.users;
        let mut unique = users.to_vec();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), users.len(), "{} {}：by(…) 里有重复", endpoint.method, endpoint.path);
        for exclusive in [User::None, User::Multiuser] {
            assert!(
                !users.contains(&exclusive) || users.len() == 1,
                "{} {}：by({}) 不能和别的调用方写在一起",
                endpoint.method,
                endpoint.path,
                exclusive.label()
            );
        }
    }
}

#[test]
fn endpoint_directory_matches_registry() {
    let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let current = directory();
    let generated: std::collections::BTreeSet<String> = current.iter().map(|(path, _)| path.clone()).collect();
    // 分组文件目录里不该有生成之外的文件（分组改名、删掉以后留下的旧文件）
    let dir = repo.join(DIRECTORY_DIR);
    let existing: Vec<String> = std::fs::read_dir(&dir)
        .map(|entries| {
            entries
                .filter_map(|entry| entry.ok())
                .map(|entry| format!("{DIRECTORY_DIR}/{}", entry.file_name().to_string_lossy()))
                .collect()
        })
        .unwrap_or_default();
    if std::env::var_os("UPDATE_ROUTES").is_some() {
        std::fs::create_dir_all(&dir).unwrap();
        for stale in existing.iter().filter(|path| !generated.contains(*path)) {
            std::fs::remove_file(repo.join(stale)).unwrap();
        }
        for (path, content) in &current {
            std::fs::write(repo.join(path), content).unwrap();
        }
        return;
    }
    let stale: Vec<&String> = existing.iter().filter(|path| !generated.contains(*path)).collect();
    let outdated: Vec<&String> = current
        .iter()
        .filter(|(path, content)| std::fs::read_to_string(repo.join(path)).unwrap_or_default() != *content)
        .map(|(path, _)| path)
        .collect();
    assert!(
        stale.is_empty() && outdated.is_empty(),
        "接口目录和登记表对不上（过期 {outdated:?}，多出来的 {stale:?}）。重新生成：UPDATE_ROUTES=1 cargo test -p retainpdf-api --lib route_manifest"
    );
}

/// 每个路由文件都登记了分组，分组的文件名不重名。
#[test]
fn every_router_file_has_a_directory_section() {
    for endpoint in crate::app::registered_endpoints() {
        assert!(section_of(endpoint.module).is_some(), "{}：在 SECTIONS 里登记分组", endpoint.module);
    }
    let mut stems = std::collections::BTreeSet::new();
    for (_, stem, _) in SECTIONS {
        assert!(stems.insert(*stem), "分组文件名 {stem} 重复");
    }
}

/// 多用户下谁能用直接查登记表（2026-10-17 前是账号包按地址前缀判断，这组用例从那里搬过来，结果一条没变）。
#[test]
fn route_policies_come_from_the_registry() {
    assert_eq!(route_policy("GET", "/api/v1/jobs"), RoutePolicy::Signed);
    assert_eq!(route_policy("GET", "/api/v1/jobs/:job_id"), RoutePolicy::Signed);
    assert_eq!(route_policy("GET", "/api/v1/providers/ocr"), RoutePolicy::Signed);
    assert_eq!(route_policy("GET", "/api/v1/jobs/:job_id/files/output/*name"), RoutePolicy::Signed);
    assert_eq!(route_policy("GET", "/api/v1/jobs/:job_id/files/pages/:page"), RoutePolicy::Signed);
    assert_eq!(route_policy("GET", "/api/v1/jobs/:job_id/files/internal/*name"), RoutePolicy::AdminOnly);
    assert_eq!(route_policy("GET", "/api/v1/fonts"), RoutePolicy::Signed);
    assert_eq!(route_policy("POST", "/api/v1/providers/deepseek/balance"), RoutePolicy::AdminOnly);
    assert_eq!(route_policy("POST", "/api/v1/fonts/upload"), RoutePolicy::AdminOnly);
    assert_eq!(route_policy("GET", "/api/v1/credentials/:credential_ref"), RoutePolicy::AdminOnly);
    assert_eq!(route_policy("POST", "/api/v1/backups"), RoutePolicy::AdminOnly);
    assert_eq!(route_policy("POST", "/api/v1/sync/run"), RoutePolicy::AdminOnly);
    assert_eq!(route_policy("POST", "/api/v1/internal/model/jobs/:job_id/requests"), RoutePolicy::Closed);
    // 地址前缀像也不算。
    assert_eq!(route_policy("GET", "/api/v1/jobsx"), RoutePolicy::Closed);
    // 地址登记过、方法没登记：取这个地址最严的一种（让网站账号照旧拿到 405，而不是 404）。
    assert_eq!(route_policy("DELETE", "/api/v1/jobs"), RoutePolicy::Signed);
    assert_eq!(route_policy("GET", "/api/v1/fonts/upload"), RoutePolicy::AdminOnly);
    // 没登记的接口默认关闭。
    assert_eq!(route_policy("GET", "/api/v1/reports"), RoutePolicy::Closed);
}

/// 不在 rust_api 登记表里的契约：文件名 → 为什么、由谁对。
const CONTRACTS_OUTSIDE_RUST_API: &[(&str, &str)] = &[(
    "jobs-control.v1.schema.json",
    "jobsd 自己的接口；jobsd 挂的路由由 backend/jobs/src/contract_lock.rs 对这份契约双向比",
)];

/// 契约地址归一成登记表的写法：去掉 `?…` 查询串（reader-data 的 `progress/stream?after_seq=:seq`），
/// `{job_id}` 换成 axum 的 `:job_id`。
fn normalize_contract_path(path: &str) -> String {
    let path = path.split('?').next().unwrap_or_default();
    path.split('/')
        .map(|segment| match segment.strip_prefix('{').and_then(|rest| rest.strip_suffix('}')) {
            Some(name) => format!(":{name}"),
            None => segment.to_string(),
        })
        .collect::<Vec<_>>()
        .join("/")
}

/// 读 `<backend>/contracts/*.schema.json`（和根目录 `contracts/` 字节一致，`check_parity.py` 守着）
/// 每份的端点表，返回 (文件名, 方法, 契约里写的地址, 归一后拿来比的地址)。
/// 有 `proxy_path` 的（runtime-config.v1：`path` 是 Python AI 服务的地址）比 `proxy_path`。
fn contract_endpoints(contracts_dir: &Path) -> Vec<(String, String, String, String)> {
    let mut files: Vec<_> = std::fs::read_dir(contracts_dir)
        .unwrap_or_else(|error| panic!("read {}: {error}", contracts_dir.display()))
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.to_string_lossy().ends_with(".schema.json"))
        .collect();
    files.sort();
    assert!(!files.is_empty(), "{} 下没有契约", contracts_dir.display());
    let mut out = Vec::new();
    for file in files {
        let name = file.file_name().unwrap().to_string_lossy().to_string();
        if CONTRACTS_OUTSIDE_RUST_API.iter().any(|(skip, _)| *skip == name) {
            continue;
        }
        let schema: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&file).unwrap())
            .unwrap_or_else(|error| panic!("{name}: {error}"));
        let Some(endpoints) = schema.get("endpoints") else { continue };
        for endpoint in endpoints.as_array().unwrap_or_else(|| panic!("{name}: endpoints 不是数组")) {
            let method = endpoint["method"].as_str().unwrap_or_else(|| panic!("{name}: 端点缺 method"));
            let path = endpoint["path"].as_str().unwrap_or_else(|| panic!("{name}: 端点缺 path"));
            let public = endpoint.get("proxy_path").and_then(|value| value.as_str()).unwrap_or(path);
            out.push((name.clone(), method.to_string(), public.to_string(), normalize_contract_path(public)));
        }
    }
    out
}

/// 契约端点表里的每条方法加地址都要在登记表里，而且是现用地址。反过来不要求：管理后台、内部接口可以不进契约。
/// 删接口时契约里留下的残留地址在这里红（2026-10-22 删书架旧地址时是手工 grep 发现的）。
/// 方案见 docs/ops/planning/api-reorg/20261022-契约端点加函数名和传输方式.md。
#[test]
fn contract_endpoints_are_registered() {
    let contracts_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../contracts");
    for (skip, _) in CONTRACTS_OUTSIDE_RUST_API {
        assert!(contracts_dir.join(skip).is_file(), "CONTRACTS_OUTSIDE_RUST_API 里的 {skip} 已经不存在，删掉这一条");
    }
    let registry = crate::app::registered_endpoints();
    let endpoints = contract_endpoints(&contracts_dir);
    assert!(endpoints.len() > 40, "契约端点只读到 {} 条，读取逻辑可能坏了", endpoints.len());
    let mut problems = Vec::new();
    for (file, method, written, path) in &endpoints {
        match registry.iter().find(|e| e.method == method && e.path == path) {
            None => problems.push(format!("{file}: {method} {written} 不在接口登记表里")),
            Some(found) => {
                if let Some(replacement) = found.replaced_by {
                    problems.push(format!("{file}: {method} {written} 是旧地址，契约里改成 {replacement}"));
                }
            }
        }
    }
    assert!(
        problems.is_empty(),
        "契约端点表和接口登记表（app/endpoints.rs）对不上：\n  {}\n\
         接口删了就删契约里的那条；改了地址就改契约的 path（contracts/ 和 backend/contracts/ 一起改）",
        problems.join("\n  ")
    );
}

#[test]
fn contract_paths_normalize_to_registry_style() {
    assert_eq!(normalize_contract_path("/internal/v1/jobs/{job_id}/launch"), "/internal/v1/jobs/:job_id/launch");
    assert_eq!(
        normalize_contract_path("/api/v1/jobs/:job_id/progress/stream?after_seq=:seq"),
        "/api/v1/jobs/:job_id/progress/stream"
    );
    assert_eq!(normalize_contract_path("/api/v1/documents"), "/api/v1/documents");
}
