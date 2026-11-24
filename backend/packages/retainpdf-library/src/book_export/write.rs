//! 书文件夹落盘：先写临时目录，整体改名替换旧的，读的人不会看到写了一半的文件夹。

use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use serde_json::Value;

use super::names::short_id;

/// 正在写的书文件夹。没 [`publish`](Self::publish) 就丢掉（出错时不留半成品）。
pub(super) struct TempBookDir {
    books_root: PathBuf,
    name: String,
    path: PathBuf,
    published: bool,
}

impl TempBookDir {
    pub(super) fn new(books_root: &Path, name: &str) -> io::Result<Self> {
        fs::create_dir_all(books_root)?;
        let path = books_root.join(format!(".tmp-{name}-{:016x}", fastrand::u64(..)));
        fs::create_dir_all(&path)?;
        Ok(Self { books_root: books_root.to_path_buf(), name: name.to_string(), path, published: false })
    }

    /// 写一个文件；`relative` 只能是普通的相对路径（不许 `..`、绝对路径）。
    pub(super) fn write(&self, relative: &str, bytes: &[u8]) -> io::Result<()> {
        let relative = Path::new(relative);
        if relative.components().any(|part| !matches!(part, Component::Normal(_))) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, format!("bad path {}", relative.display())));
        }
        let path = self.path.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, bytes)
    }

    /// `source.pdf` 链接到原文 PDF。建不了（Windows 没有权限之类）返回 false，调用方把路径写进 meta.json。
    pub(super) fn link_source_pdf(&self, source_pdf: &Path) -> bool {
        let link = self.path.join("source.pdf");
        #[cfg(unix)]
        let linked = std::os::unix::fs::symlink(source_pdf, &link).is_ok();
        #[cfg(windows)]
        let linked = std::os::windows::fs::symlink_file(source_pdf, &link).is_ok();
        #[cfg(not(any(unix, windows)))]
        let linked = false;
        linked
    }

    /// 换上去：旧的同名文件夹先挪开，新的改名过去，再删旧的。返回最终路径。
    pub(super) fn publish(mut self) -> io::Result<PathBuf> {
        let target = self.books_root.join(&self.name);
        let old = self.books_root.join(format!(".old-{}-{:016x}", self.name, fastrand::u64(..)));
        let had_old = match fs::rename(&target, &old) {
            Ok(()) => true,
            Err(error) if error.kind() == io::ErrorKind::NotFound => false,
            Err(error) => return Err(error),
        };
        if let Err(error) = fs::rename(&self.path, &target) {
            if had_old {
                let _ = fs::rename(&old, &target);
            }
            return Err(error);
        }
        self.published = true;
        if had_old {
            let _ = fs::remove_dir_all(&old);
        }
        Ok(target)
    }
}

impl Drop for TempBookDir {
    fn drop(&mut self) {
        if !self.published {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

/// 读一个书文件夹的 meta.json。
pub(super) fn read_meta(dir: &Path) -> Option<Value> {
    serde_json::from_slice(&fs::read(dir.join("meta.json")).ok()?).ok()
}

/// `books/` 下所有书文件夹（不含正在写的临时目录），和它们 meta.json 里的书编号。
pub(super) fn list_book_dirs(books_root: &Path) -> Vec<(PathBuf, String)> {
    let Ok(entries) = fs::read_dir(books_root) else { return Vec::new() };
    let mut dirs: Vec<(PathBuf, String)> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
        .filter_map(|entry| {
            let path = entry.path();
            let document_id = read_meta(&path)?.get("document_id")?.as_str()?.to_string();
            Some((path, document_id))
        })
        .collect();
    dirs.sort();
    dirs
}

/// 这本书现有的文件夹（书名改过会有不同名字的旧文件夹）。
pub(super) fn book_dirs_of(books_root: &Path, document_id: &str) -> Vec<PathBuf> {
    let suffix = format!("-{}", short_id(document_id));
    list_book_dirs(books_root)
        .into_iter()
        .filter(|(path, id)| id == document_id && path.file_name().is_some_and(|name| name.to_string_lossy().ends_with(&suffix)))
        .map(|(path, _)| path)
        .collect()
}

/// 删掉 `books/` 下的一个书文件夹（只删 `books/` 直接下一层的目录）。
pub(super) fn remove_book_dir(books_root: &Path, dir: &Path) -> io::Result<()> {
    if dir.parent() != Some(books_root) {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, format!("not a book folder: {}", dir.display())));
    }
    match fs::remove_dir_all(dir) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        other => other,
    }
}

/// 上次没收尾的临时目录（进程中途被杀）：开始导出前清掉。
pub(super) fn remove_stale_temporaries(books_root: &Path) {
    let Ok(entries) = fs::read_dir(books_root) else { return };
    for entry in entries.filter_map(Result::ok) {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with(".tmp-") || name.starts_with(".old-") {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("retain-book-write-{name}-{:016x}", fastrand::u64(..)));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn publishing_replaces_the_folder_as_a_whole() {
        let root = temp_root("publish");
        let books = root.join("books");
        let first = TempBookDir::new(&books, "a-01234567").unwrap();
        first.write("text/01-x.md", b"old").unwrap();
        first.write("stale.md", b"gone").unwrap();
        first.publish().unwrap();
        let second = TempBookDir::new(&books, "a-01234567").unwrap();
        second.write("text/01-x.md", b"new").unwrap();
        let path = second.publish().unwrap();
        assert_eq!(fs::read_to_string(path.join("text/01-x.md")).unwrap(), "new");
        assert!(!path.join("stale.md").exists(), "旧文件夹整个换掉，不留旧文件");
        let leftovers: Vec<_> = fs::read_dir(&books).unwrap().filter_map(Result::ok).collect();
        assert_eq!(leftovers.len(), 1, "临时目录、旧目录都清掉了");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn an_unpublished_folder_leaves_nothing_behind() {
        let root = temp_root("drop");
        let books = root.join("books");
        {
            let temp = TempBookDir::new(&books, "a-01234567").unwrap();
            temp.write("meta.json", b"{}").unwrap();
        }
        assert_eq!(fs::read_dir(&books).unwrap().count(), 0);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn writes_refuse_paths_outside_the_folder() {
        let root = temp_root("escape");
        let temp = TempBookDir::new(&root.join("books"), "a-01234567").unwrap();
        for bad in ["../x.md", "/etc/x", "text/../../x.md", "./x.md"] {
            assert!(temp.write(bad, b"x").is_err(), "{bad}");
        }
        drop(temp);
        assert!(remove_book_dir(&root.join("books"), &root).is_err(), "只删 books/ 下一层");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn folders_of_a_book_are_found_by_id_even_after_a_rename() {
        let root = temp_root("find");
        let books = root.join("books");
        for (name, id) in [("old-title-01234567", "0123456789"), ("new-title-01234567", "0123456789"), ("other-abcdef01", "abcdef0123")] {
            let temp = TempBookDir::new(&books, name).unwrap();
            temp.write("meta.json", serde_json::json!({ "document_id": id }).to_string().as_bytes()).unwrap();
            temp.publish().unwrap();
        }
        let found = book_dirs_of(&books, "0123456789");
        assert_eq!(found.len(), 2);
        assert_eq!(list_book_dirs(&books).len(), 3);
        let _ = fs::remove_dir_all(&root);
    }
}
