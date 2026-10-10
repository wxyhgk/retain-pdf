//! 管理后台的账号查询：分页搜索排序、单个账号的统计、某个账号的任务。只读；改账号走 accounts.rs。

use std::collections::BTreeMap;

use anyhow::Result;
use rusqlite::types::Value;
use rusqlite::{params, params_from_iter};

use super::accounts::{row_to_user, UserRecord, USER_COLUMNS};
use super::Db;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UserStatusFilter {
    Active,
    Disabled,
    Deleted,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UserSortKey {
    Username,
    CreatedAt,
    LastLoginAt,
    PageBalance,
}

/// 默认值和以前的账号列表一致：没删的全部账号，按建号时间排。
#[derive(Clone, Debug)]
pub struct UserListQuery {
    /// 用户名包含这段（不区分大小写）；空 = 不筛。
    pub q: String,
    /// None = 没删的（启用 + 停用）。
    pub status: Option<UserStatusFilter>,
    /// admin / user；None = 都要。
    pub role: Option<String>,
    pub sort: UserSortKey,
    pub descending: bool,
    /// None = 不分页。
    pub limit: Option<usize>,
    pub offset: usize,
}

impl Default for UserListQuery {
    fn default() -> Self {
        Self {
            q: String::new(),
            status: None,
            role: None,
            sort: UserSortKey::CreatedAt,
            descending: false,
            limit: None,
            offset: 0,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserListRow {
    pub user: UserRecord,
    /// 账本余额（管理员不限额，这个数对他们没意义，由调用方决定怎么展示）。
    pub page_balance: i64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserListPage {
    pub rows: Vec<UserListRow>,
    /// 符合筛选条件的总数（不受分页影响）。
    pub total: i64,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct UserStats {
    pub jobs_total: i64,
    /// queued / running / succeeded / failed / canceled → 个数（没有的不出现）。
    pub jobs_by_status: BTreeMap<String, i64>,
    pub documents: i64,
    pub uploads: i64,
    /// 上传的原始 PDF 合计字节数（不含任务产物）。
    pub upload_bytes: i64,
    /// 实际扣掉的页数：已确认的 + 还在预扣中的（退回的不算）。
    pub pages_charged: i64,
    /// 其中还在预扣中、任务没跑完的。
    pub pages_reserved: i64,
    pub last_submitted_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OwnerJobRow {
    pub job_id: String,
    pub workflow: String,
    pub status: String,
    /// 书名，没有就是上传的文件名，都没有为空。
    pub title: String,
    /// 源 PDF 的总页数（找不到上传为 None）。
    pub document_pages: Option<i64>,
    /// 这个任务按页扣了几页（不计费的任务为 None）。
    pub charged_pages: Option<i64>,
    /// reserved / settled / refunded
    pub charge_status: Option<String>,
    pub created_at: String,
    pub finished_at: Option<String>,
}

/// LIKE 里把用户输入的 % _ \ 当普通字符。
fn like_pattern(raw: &str) -> String {
    let mut escaped = String::with_capacity(raw.len() + 2);
    escaped.push('%');
    for ch in raw.trim().to_lowercase().chars() {
        if matches!(ch, '%' | '_' | '\\') {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped.push('%');
    escaped
}

/// status_json / workflow 存的是 JSON 字符串（`"failed"`），去掉引号。
fn unquote(raw: String) -> String {
    raw.trim_matches('"').to_string()
}

impl Db {
    pub fn list_users_page(&self, query: &UserListQuery) -> Result<UserListPage> {
        let mut filters = Vec::new();
        let mut args: Vec<Value> = Vec::new();
        match query.status {
            None => filters.push("u.deleted_at = ''"),
            Some(UserStatusFilter::Active) => {
                filters.push("u.deleted_at = '' AND u.status = 'active'")
            }
            Some(UserStatusFilter::Disabled) => {
                filters.push("u.deleted_at = '' AND u.status = 'disabled'")
            }
            Some(UserStatusFilter::Deleted) => filters.push("u.deleted_at <> ''"),
        }
        if let Some(role) = &query.role {
            filters.push("u.role = ?");
            args.push(Value::Text(role.clone()));
        }
        if !query.q.trim().is_empty() {
            filters.push("u.username_key LIKE ? ESCAPE '\\'");
            args.push(Value::Text(like_pattern(&query.q)));
        }
        let filter_sql = filters.join(" AND ");
        let direction = if query.descending { "DESC" } else { "ASC" };
        let order = match query.sort {
            UserSortKey::Username => format!("u.username_key {direction}"),
            UserSortKey::CreatedAt => format!("u.created_at {direction}, u.username_key ASC"),
            UserSortKey::LastLoginAt => format!("u.last_login_at {direction}, u.username_key ASC"),
            // 管理员不限额，余额排序时一律放最后。
            UserSortKey::PageBalance => {
                format!("(u.role = 'admin') ASC, balance {direction}, u.username_key ASC")
            }
        };
        let columns = USER_COLUMNS
            .split(", ")
            .map(|column| format!("u.{}", column.trim()))
            .collect::<Vec<_>>()
            .join(", ");

        let conn = self.connect()?;
        let total: i64 = conn.query_row(
            &format!("SELECT COUNT(*) FROM users u WHERE {filter_sql}"),
            params_from_iter(args.iter()),
            |row| row.get(0),
        )?;
        let mut page_args = args.clone();
        let paging = match query.limit {
            Some(limit) => {
                page_args.push(Value::Integer(limit as i64));
                page_args.push(Value::Integer(query.offset as i64));
                " LIMIT ? OFFSET ?"
            }
            None => "",
        };
        let mut stmt = conn.prepare(&format!(
            "SELECT {columns}, COALESCE(b.balance, 0) AS balance FROM users u \
             LEFT JOIN (SELECT user_id, SUM(delta) AS balance FROM page_ledger GROUP BY user_id) b \
               ON b.user_id = u.user_id \
             WHERE {filter_sql} ORDER BY {order}{paging}"
        ))?;
        let rows = stmt.query_map(params_from_iter(page_args.iter()), |row| {
            Ok(UserListRow {
                user: row_to_user(row)?,
                page_balance: row.get(11)?,
            })
        })?;
        Ok(UserListPage {
            rows: rows.collect::<rusqlite::Result<Vec<_>>>()?,
            total,
        })
    }

    pub fn user_stats(&self, user_id: &str) -> Result<UserStats> {
        let conn = self.connect()?;
        let mut stats = UserStats::default();
        let mut stmt = conn.prepare(
            "SELECT status_json, COUNT(*) FROM jobs WHERE owner_user_id = ?1 GROUP BY status_json",
        )?;
        for row in stmt.query_map(params![user_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })? {
            let (status, count) = row?;
            stats.jobs_total += count;
            *stats.jobs_by_status.entry(unquote(status)).or_default() += count;
        }
        stats.last_submitted_at = conn.query_row(
            "SELECT MAX(created_at) FROM jobs WHERE owner_user_id = ?1",
            params![user_id],
            |row| row.get(0),
        )?;
        stats.documents = conn.query_row(
            "SELECT COUNT(*) FROM documents WHERE owner_user_id = ?1",
            params![user_id],
            |row| row.get(0),
        )?;
        (stats.uploads, stats.upload_bytes) = conn.query_row(
            "SELECT COUNT(*), COALESCE(SUM(bytes), 0) FROM uploads WHERE owner_user_id = ?1",
            params![user_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        (stats.pages_charged, stats.pages_reserved) = conn.query_row(
            "SELECT COALESCE(SUM(pages), 0), COALESCE(SUM(CASE WHEN status = 'reserved' THEN pages END), 0) \
             FROM job_page_charges WHERE user_id = ?1 AND status IN ('reserved', 'settled')",
            params![user_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        Ok(stats)
    }

    /// 某个账号的任务，新的在前；返回这一页和总数。
    pub fn list_jobs_for_owner_page(
        &self,
        owner: &str,
        limit: usize,
        offset: usize,
    ) -> Result<(Vec<OwnerJobRow>, i64)> {
        let conn = self.connect()?;
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM jobs WHERE owner_user_id = ?1",
            params![owner],
            |row| row.get(0),
        )?;
        let mut stmt = conn.prepare(
            "SELECT j.job_id, j.workflow, j.status_json, COALESCE(NULLIF(d.title, ''), u.filename, ''), \
                    u.page_count, c.pages, c.status, j.created_at, j.finished_at \
             FROM jobs j \
             LEFT JOIN uploads u ON u.upload_id = j.upload_id \
             LEFT JOIN documents d ON d.document_id = j.document_id \
             LEFT JOIN job_page_charges c ON c.job_id = j.job_id \
             WHERE j.owner_user_id = ?1 ORDER BY j.created_at DESC, j.job_id DESC LIMIT ?2 OFFSET ?3",
        )?;
        let rows = stmt.query_map(params![owner, limit as i64, offset as i64], |row| {
            Ok(OwnerJobRow {
                job_id: row.get(0)?,
                workflow: unquote(row.get(1)?),
                status: unquote(row.get(2)?),
                title: row.get(3)?,
                document_pages: row.get(4)?,
                charged_pages: row.get(5)?,
                charge_status: row.get(6)?,
                created_at: row.get(7)?,
                finished_at: row.get(8)?,
            })
        })?;
        Ok((rows.collect::<rusqlite::Result<Vec<_>>>()?, total))
    }

    /// 某个账号还在排队或在跑的任务（删账号时取消用）。
    pub fn active_job_ids_for_owner(&self, owner: &str) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT job_id FROM jobs WHERE owner_user_id = ?1 \
             AND status_json IN ('\"queued\"', '\"running\"', 'queued', 'running') ORDER BY created_at",
        )?;
        let rows = stmt.query_map(params![owner], |row| row.get(0))?;
        Ok(rows.collect::<rusqlite::Result<Vec<String>>>()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: &str = "2026-10-10T00:00:00Z";

    fn db(name: &str) -> Db {
        let root =
            std::env::temp_dir().join(format!("retain-admin-users-{name}-{}", fastrand::u64(..)));
        std::fs::create_dir_all(root.join("uploads")).unwrap();
        let db = Db::new(root.join("jobs.db"), root);
        db.init().unwrap();
        db
    }

    fn user(db: &Db, user_id: &str, username: &str, role: &str, created_at: &str) {
        db.create_user(user_id, username, "hash", role, false, created_at)
            .unwrap();
    }

    fn job(db: &Db, job_id: &str, owner: &str, status: &str, created_at: &str) {
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO jobs (job_id, workflow, status_json, created_at, updated_at, command_json, request_json, log_tail_json, owner_user_id) \
                 VALUES (?1, '\"book\"', ?2, ?3, ?3, '[]', '{}', '[]', ?4)",
                params![job_id, format!("\"{status}\""), created_at, owner],
            )
            .unwrap();
    }

    fn names(page: &UserListPage) -> Vec<&str> {
        page.rows
            .iter()
            .map(|row| row.user.username.as_str())
            .collect()
    }

    #[test]
    fn default_query_matches_the_old_list_and_hides_deleted() {
        let db = db("default");
        user(&db, "u1", "carol", "user", "2026-10-01T00:00:00Z");
        user(&db, "u2", "alice", "admin", "2026-10-02T00:00:00Z");
        user(&db, "u3", "bob", "user", "2026-10-03T00:00:00Z");
        db.set_user_deleted_at("u3", NOW, NOW).unwrap();
        let page = db.list_users_page(&UserListQuery::default()).unwrap();
        assert_eq!((names(&page), page.total), (vec!["carol", "alice"], 2));
        assert_eq!(db.list_users().unwrap().len(), 2);
        let deleted = db
            .list_users_page(&UserListQuery {
                status: Some(UserStatusFilter::Deleted),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(names(&deleted), vec!["bob"]);
    }

    #[test]
    fn search_filter_sort_and_paginate() {
        let db = db("query");
        for (index, name) in ["ann", "Annie", "bob", "dan_1", "danx1"].iter().enumerate() {
            user(
                &db,
                &format!("u{index}"),
                name,
                "user",
                &format!("2026-10-0{}T00:00:00Z", index + 1),
            );
        }
        db.set_user_status("u2", "disabled", NOW).unwrap();
        db.grant_pages("u0", 5, "", "root", NOW).unwrap();
        db.grant_pages("u1", 50, "", "root", NOW).unwrap();

        let search = db
            .list_users_page(&UserListQuery {
                q: "ANN".into(),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(names(&search), vec!["ann", "Annie"]);
        // 下划线按字面匹配，不当通配符。
        let literal = db
            .list_users_page(&UserListQuery {
                q: "n_1".into(),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(names(&literal), vec!["dan_1"]);
        let disabled = db
            .list_users_page(&UserListQuery {
                status: Some(UserStatusFilter::Disabled),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(names(&disabled), vec!["bob"]);

        let by_balance = db
            .list_users_page(&UserListQuery {
                sort: UserSortKey::PageBalance,
                descending: true,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(&names(&by_balance)[..2], &["Annie", "ann"]);
        assert_eq!(by_balance.rows[0].page_balance, 50);

        let page = db
            .list_users_page(&UserListQuery {
                sort: UserSortKey::Username,
                limit: Some(2),
                offset: 2,
                ..Default::default()
            })
            .unwrap();
        assert_eq!((names(&page), page.total), (vec!["bob", "dan_1"], 5));
    }

    #[test]
    fn stats_count_jobs_documents_uploads_and_net_pages() {
        let db = db("stats");
        user(&db, "u1", "alice", "user", NOW);
        db.grant_pages("u1", 20, "", "root", NOW).unwrap();
        job(&db, "j1", "u1", "succeeded", "2026-10-01T00:00:00Z");
        job(&db, "j2", "u1", "failed", "2026-10-02T00:00:00Z");
        job(&db, "j3", "u1", "running", "2026-10-03T00:00:00Z");
        job(&db, "other", "u2", "running", "2026-10-04T00:00:00Z");
        for (job_id, pages) in [("j1", 4), ("j2", 3), ("j3", 2)] {
            db.reserve_job_pages(job_id, "u1", pages, NOW).unwrap();
        }
        db.connect()
            .unwrap()
            .execute(
                "UPDATE jobs SET status_json = '\"succeeded\"' WHERE job_id = 'j1'",
                [],
            )
            .unwrap();
        db.connect()
            .unwrap()
            .execute(
                "UPDATE jobs SET status_json = '\"failed\"' WHERE job_id = 'j2'",
                [],
            )
            .unwrap();

        let stats = db.user_stats("u1").unwrap();
        assert_eq!(stats.jobs_total, 3);
        assert_eq!(stats.jobs_by_status.get("running"), Some(&1));
        assert_eq!(stats.jobs_by_status.get("failed"), Some(&1));
        assert_eq!(
            (stats.pages_charged, stats.pages_reserved),
            (6, 2),
            "失败的 3 页退回了"
        );
        assert_eq!(
            stats.last_submitted_at.as_deref(),
            Some("2026-10-03T00:00:00Z")
        );
        assert_eq!(
            db.active_job_ids_for_owner("u1").unwrap(),
            vec!["j3".to_string()]
        );
        assert_eq!(db.user_stats("nobody").unwrap(), UserStats::default());
    }

    #[test]
    fn owner_jobs_are_paged_newest_first_with_charges() {
        let db = db("jobs");
        user(&db, "u1", "alice", "user", NOW);
        db.grant_pages("u1", 20, "", "root", NOW).unwrap();
        for day in 1..=3 {
            job(
                &db,
                &format!("j{day}"),
                "u1",
                "queued",
                &format!("2026-10-0{day}T00:00:00Z"),
            );
        }
        db.reserve_job_pages("j2", "u1", 7, NOW).unwrap();
        let (rows, total) = db.list_jobs_for_owner_page("u1", 2, 0).unwrap();
        assert_eq!(total, 3);
        assert_eq!(
            rows.iter()
                .map(|row| row.job_id.as_str())
                .collect::<Vec<_>>(),
            vec!["j3", "j2"]
        );
        assert_eq!(
            (rows[1].workflow.as_str(), rows[1].status.as_str()),
            ("book", "queued")
        );
        assert_eq!(
            (rows[1].charged_pages, rows[1].charge_status.as_deref()),
            (Some(7), Some("reserved"))
        );
        assert_eq!(rows[0].charged_pages, None);
    }
}
