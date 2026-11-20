//! 把一个库现在的表结构写成一份文本（2026-11-20 数据库整理第 4 步）：每张表的列、类型、非空、默认值、主键、外键、
//! 索引、触发器。新建空库跑完全部建表和迁移的结果提交成 `database/retainpdf-db/schema.sql`（测试守着），
//! 以后看「现在每张表长什么样」只看那一个文件；老库升上来的结构也拿它比。
//!
//! `canonical`：列按名字排（老库 ALTER 补的列排在最后，顺序不同不算差异），比较用；不排的按声明顺序，给人看。

use anyhow::Result;
use rusqlite::Connection;

fn normalized(sql: &str) -> String {
    sql.split_whitespace().collect::<Vec<_>>().join(" ").replace("IF NOT EXISTS ", "")
}

/// FTS5 这类虚表自己建的影子表（`blocks_fts_data`……）不单列，跟着虚表走。
fn is_shadow_table(name: &str, virtual_tables: &[String]) -> bool {
    virtual_tables.iter().any(|vt| {
        name.strip_prefix(vt.as_str())
            .and_then(|rest| rest.strip_prefix('_'))
            .is_some_and(|suffix| matches!(suffix, "data" | "idx" | "content" | "docsize" | "config"))
    })
}

pub(crate) fn describe_schema(conn: &Connection, canonical: bool) -> Result<String> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    let objects: Vec<(String, String, String, Option<String>)> = {
        let mut stmt = conn.prepare(
            "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
        )?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))?;
        rows.collect::<rusqlite::Result<_>>()?
    };
    let virtual_tables: Vec<String> = objects
        .iter()
        .filter(|(kind, _, _, sql)| kind == "table" && sql.as_deref().is_some_and(|s| s.starts_with("CREATE VIRTUAL")))
        .map(|(_, name, _, _)| name.clone())
        .collect();
    let mut out = format!("-- user_version {version}\n");
    for (kind, name, _, sql) in &objects {
        if kind != "table" || is_shadow_table(name, &virtual_tables) {
            continue;
        }
        out.push('\n');
        if virtual_tables.contains(name) {
            out.push_str(&format!("{}\n", normalized(sql.as_deref().unwrap_or(""))));
            continue;
        }
        out.push_str(&format!("TABLE {name}\n"));
        let mut columns: Vec<String> = {
            let mut stmt = conn.prepare(&format!("PRAGMA table_xinfo(\"{name}\")"))?;
            let rows = stmt.query_map([], |row| {
                let column: String = row.get(1)?;
                let kind: String = row.get(2)?;
                let not_null: i64 = row.get(3)?;
                let default: Option<String> = row.get(4)?;
                let pk: i64 = row.get(5)?;
                let mut line = format!("  {column} {kind}");
                if not_null != 0 {
                    line.push_str(" NOT NULL");
                }
                if let Some(default) = default {
                    line.push_str(&format!(" DEFAULT {default}"));
                }
                if pk != 0 {
                    line.push_str(&format!(" PRIMARY KEY#{pk}"));
                }
                Ok(line)
            })?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        if canonical {
            columns.sort();
        }
        for column in columns {
            out.push_str(&column);
            out.push('\n');
        }
        // 外键：同一条约束的几列合在一行
        let mut keys: Vec<(i64, String, String, String, String, String)> = {
            let mut stmt = conn.prepare(&format!("PRAGMA foreign_key_list(\"{name}\")"))?;
            let rows = stmt.query_map([], |row| {
                Ok((row.get(0)?, row.get(2)?, row.get(3)?, row.get::<_, Option<String>>(4)?.unwrap_or_default(), row.get(5)?, row.get(6)?))
            })?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        keys.sort_by_key(|key| key.0);
        let mut foreign: Vec<String> = Vec::new();
        for id in keys.iter().map(|key| key.0).collect::<std::collections::BTreeSet<_>>() {
            let parts: Vec<_> = keys.iter().filter(|key| key.0 == id).collect();
            let (_, table, _, _, on_update, on_delete) = parts[0];
            let from: Vec<&str> = parts.iter().map(|key| key.2.as_str()).collect();
            let to: Vec<&str> = parts.iter().map(|key| key.3.as_str()).collect();
            foreign.push(format!(
                "  FOREIGN KEY ({}) REFERENCES {table}({}) ON UPDATE {on_update} ON DELETE {on_delete}",
                from.join(", "),
                to.join(", ")
            ));
        }
        foreign.sort();
        for line in foreign {
            out.push_str(&line);
            out.push('\n');
        }
        // 索引：建表约束带出来的（主键、UNIQUE）按列写，自己建的写 SQL；触发器写 SQL
        let mut extras: Vec<String> = Vec::new();
        let mut stmt = conn.prepare(&format!("PRAGMA index_list(\"{name}\")"))?;
        let indexes: Vec<(String, i64, String)> = stmt
            .query_map([], |row| Ok((row.get(1)?, row.get(2)?, row.get(3)?)))?
            .collect::<rusqlite::Result<_>>()?;
        for (index, unique, origin) in indexes {
            if origin == "c" {
                continue; // 自己建的索引在下面按 SQL 写
            }
            let mut stmt = conn.prepare(&format!("PRAGMA index_info(\"{index}\")"))?;
            let cols: Vec<String> = stmt.query_map([], |row| row.get(2))?.collect::<rusqlite::Result<_>>()?;
            let label = if origin == "pk" { "PRIMARY KEY" } else if unique != 0 { "UNIQUE" } else { "INDEX" };
            extras.push(format!("  {label} ({})", cols.join(", ")));
        }
        for (kind, object, table, sql) in &objects {
            if table == name && (kind == "index" || kind == "trigger") {
                if let Some(sql) = sql {
                    extras.push(format!("  {} {object}: {}", kind.to_uppercase(), normalized(sql)));
                }
            }
        }
        extras.sort();
        for line in extras {
            out.push_str(&line);
            out.push('\n');
        }
    }
    Ok(out)
}
