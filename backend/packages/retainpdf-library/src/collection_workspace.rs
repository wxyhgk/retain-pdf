//! 合集在磁盘上的目录（`<data_root>/collections/<id>/`）。
//!
//! 以前这里还给 AI 服务的 Agent 物化合集的工作区（`ai/`：清单 + 指向每本书的链接，
//! `POST /collections/:id/agent-workspace`）。AI 服务 2026-11-03 删了，只留删合集时清目录：
//! 以前建过的工作区还在磁盘上。

use std::fs;
use std::path::{Path, PathBuf};

/// 编号要拼进磁盘路径，而路径参数会被百分号解码（`%2E%2E` 就是 `..`），所以只认生成器的形状，
/// 不做"去掉危险字符"这种黑名单。
pub(crate) fn is_valid_collection_id(collection_id: &str) -> bool {
    let Some(rest) = collection_id.strip_prefix("col-") else {
        return false;
    };
    let bytes = rest.as_bytes();
    bytes.len() == 21
        && bytes[..14].iter().all(u8::is_ascii_digit)
        && bytes[14] == b'-'
        && bytes[15..].iter().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b))
}

/// 一个合集在磁盘上的目录。编号不合格不拼路径。
fn collection_dir(data_root: &Path, collection_id: &str) -> Option<PathBuf> {
    is_valid_collection_id(collection_id).then(|| data_root.join("collections").join(collection_id))
}

/// 删合集以后清掉它的目录（以前的工作区、Agent 留下的东西）。合集已经删了，清不掉只记日志。
pub(crate) fn remove_collection_dir(data_root: &Path, collection_id: &str) {
    let Some(dir) = collection_dir(data_root, collection_id) else {
        eprintln!("[library] not removing collection directory for invalid collection_id {collection_id:?}");
        return;
    };
    match fs::remove_dir_all(&dir) {
        Ok(()) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => eprintln!(
            "[library] failed to remove collection directory {}: {err}",
            dir.display()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{is_valid_collection_id, remove_collection_dir};

    const COL: &str = "col-20260923000000-0c0c01";

    #[test]
    fn collection_ids_must_have_the_generated_shape() {
        for _ in 0..50 {
            let id = crate::collections::new_collection_id();
            assert!(is_valid_collection_id(&id), "生成器生成的 {id} 没通过校验");
        }
        assert!(is_valid_collection_id(COL));
        for id in [
            "",
            "..",
            ".",
            "../ai",
            "../../etc",
            "/etc",
            "col-1",
            "col-",
            "col-merged",
            "col-20260923000000-ABCDEF",
            "col-20260923000000-abcde",
            "col-20260923000000-abcdef0",
            "col-2026092300000x-abcdef",
            "col-20260923000000_abcdef",
            "col-20260923000000-abcdef/..",
            "col-20260923000000-abcdef\0",
            " col-20260923000000-abcdef",
            "COL-20260923000000-abcdef",
            "col-２０２６0923000000-abcdef",
        ] {
            assert!(!is_valid_collection_id(id), "{id:?} 不该通过校验");
        }
    }

    /// 回归（A6）：`..` 这种编号以前拼成 `<data_root>/collections/../ai`，会删到数据目录下的东西。
    #[test]
    fn an_invalid_id_never_touches_the_disk_and_a_valid_one_removes_its_directory() {
        let root = std::env::temp_dir().join(format!("collection-dir-{}-{}", std::process::id(), fastrand::u64(..)));
        let decoy = root.join("ai/books");
        std::fs::create_dir_all(&decoy).unwrap();
        std::fs::write(decoy.join("keep.txt"), b"agent output").unwrap();
        for id in ["..", "../collections/..", "col-20260923000000-0c0c01/..", "col-1"] {
            remove_collection_dir(&root, id);
            assert!(decoy.join("keep.txt").is_file(), "{id:?} 碰到了 collections/ 外面的东西");
        }
        let dir = root.join("collections").join(COL).join("ai");
        std::fs::create_dir_all(&dir).unwrap();
        remove_collection_dir(&root, COL);
        assert!(!root.join("collections").join(COL).exists());
        std::fs::remove_dir_all(&root).unwrap();
    }
}
