use super::*;
use std::io::{Read, Write};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        let root =
            std::env::temp_dir().join(format!("retain-bundle-test-{:032x}", fastrand::u128(..)));
        std::fs::create_dir(&root).unwrap();
        Self(root)
    }

    fn path(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }

    fn assert_no_pending(&self) {
        assert!(std::fs::read_dir(&self.0).unwrap().all(|entry| {
            !entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with(".retain-bundle-")
        }));
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn contents(path: &Path) -> std::collections::BTreeMap<String, Vec<u8>> {
    let mut zip = zip::ZipArchive::new(File::open(path).unwrap()).unwrap();
    (0..zip.len())
        .map(|index| {
            let mut entry = zip.by_index(index).unwrap();
            let name = entry.name().to_owned();
            let mut bytes = Vec::new();
            entry.read_to_end(&mut bytes).unwrap();
            (name, bytes)
        })
        .collect()
}

#[test]
fn both_bundle_formats_keep_existing_archive_paths_and_publish_valid_zip() {
    let f = Fixture::new();
    let pdf = f.path("translated.pdf");
    let md = f.path("source.md");
    let images = f.path("images");
    std::fs::create_dir_all(images.join("page-1")).unwrap();
    std::fs::write(&pdf, b"synthetic-pdf").unwrap();
    std::fs::write(&md, b"# Document").unwrap();
    std::fs::write(images.join("page-1/image.png"), b"synthetic-image").unwrap();
    let output = f.path("bundle.zip");
    std::fs::write(&output, b"old-output").unwrap();
    build_zip(&output, Some(&pdf), Some(&md), Some(&images)).unwrap();
    let expected = [
        ("translated.pdf".to_owned(), b"synthetic-pdf".to_vec()),
        ("markdown/full.md".to_owned(), b"# Document".to_vec()),
        (
            "markdown/images/page-1/image.png".to_owned(),
            b"synthetic-image".to_vec(),
        ),
    ]
    .into_iter()
    .collect();
    assert_eq!(contents(&output), expected);
    for prefix in ["markdown", "j-markdown"] {
        build_markdown_zip(&output, &md, Some(&images), prefix.into()).unwrap();
        let expected = [
            (format!("{prefix}/full.md"), b"# Document".to_vec()),
            (
                format!("{prefix}/images/page-1/image.png"),
                b"synthetic-image".to_vec(),
            ),
        ]
        .into_iter()
        .collect();
        assert_eq!(contents(&output), expected);
    }
    f.assert_no_pending();
}

#[test]
fn generation_errors_preserve_old_zip_and_remove_partial_temporary_files() {
    let f = Fixture::new();
    let output = f.path("bundle.zip");
    build_zip(&output, None, None, None).unwrap();
    let old = std::fs::read(&output).unwrap();
    let good = f.path("good.pdf");
    std::fs::write(&good, b"already-added-to-partial-zip").unwrap();
    let unreadable_file = f.path("directory-not-file");
    std::fs::create_dir(&unreadable_file).unwrap();
    assert!(build_zip(&output, Some(&good), Some(&unreadable_file), None).is_err());
    assert_eq!(std::fs::read(&output).unwrap(), old);
    f.assert_no_pending();
    assert!(build_markdown_zip(&output, &unreadable_file, None, "markdown".into()).is_err());
    assert_eq!(std::fs::read(&output).unwrap(), old);
    f.assert_no_pending();
}

#[test]
fn publication_failure_preserves_destination_and_cleans_pending_file() {
    let f = Fixture::new();
    let output = f.path("existing-directory");
    std::fs::create_dir(&output).unwrap();
    std::fs::write(output.join("sentinel"), b"keep").unwrap();
    assert!(build_zip(&output, None, None, None).is_err());
    assert_eq!(std::fs::read(output.join("sentinel")).unwrap(), b"keep");
    f.assert_no_pending();
}

#[test]
fn persistent_copy_is_atomic_and_failed_copy_preserves_old_output() {
    let f = Fixture::new();
    let source = f.path("source.zip");
    let target = f.path("target.zip");
    build_zip(&source, None, None, None).unwrap();
    std::fs::write(&target, b"old").unwrap();
    copy_bundle_atomically(&source, &target).unwrap();
    let old = std::fs::read(&target).unwrap();
    assert_eq!(old, std::fs::read(&source).unwrap());
    assert!(copy_bundle_atomically(&f.0, &target).is_err());
    assert_eq!(std::fs::read(&target).unwrap(), old);
    f.assert_no_pending();
}

#[test]
fn temporary_files_are_unique_and_unpublished_until_success() {
    let f = Fixture::new();
    let output = f.path("bundle.zip");
    std::fs::write(&output, b"old").unwrap();
    let (first, mut file1) = PendingOutput::create(&output).unwrap();
    let (second, file2) = PendingOutput::create(&output).unwrap();
    assert_ne!(first.path, second.path);
    assert_eq!(first.path.parent(), output.parent());
    file1.write_all(b"new").unwrap();
    assert_eq!(std::fs::read(&output).unwrap(), b"old");
    drop(file2);
    drop(second);
    first.publish(file1, &output).unwrap();
    assert_eq!(std::fs::read(&output).unwrap(), b"new");
    f.assert_no_pending();
}

#[test]
fn large_synthetic_file_round_trips_through_streaming_zip_io() {
    let f = Fixture::new();
    let input = f.path("large.pdf");
    const SIZE: u64 = 16 * 1024 * 1024;
    File::create(&input).unwrap().set_len(SIZE).unwrap();
    let output = f.path("large.zip");
    build_zip(&output, Some(&input), None, None).unwrap();
    let mut archive = zip::ZipArchive::new(File::open(&output).unwrap()).unwrap();
    let mut entry = archive.by_name("large.pdf").unwrap();
    assert_eq!(entry.size(), SIZE);
    assert_eq!(io::copy(&mut entry, &mut io::sink()).unwrap(), SIZE);
    f.assert_no_pending();
}

#[test]
fn markdown_layout_variants_have_separate_files_and_keep_registered_path() {
    let f = Fixture::new();
    let registered = f.path("j-markdown.zip");
    let grouped = markdown_bundle_variant_path(&registered, true);
    let flat = markdown_bundle_variant_path(&registered, false);
    assert_eq!(grouped, registered);
    assert_eq!(flat, f.path("j-markdown-flat.zip"));
    let source = f.path("full.md");
    std::fs::write(&source, b"content").unwrap();
    build_markdown_zip(&grouped, &source, None, "j-markdown".into()).unwrap();
    build_markdown_zip(&flat, &source, None, "markdown".into()).unwrap();
    assert!(contents(&grouped).contains_key("j-markdown/full.md"));
    assert!(contents(&flat).contains_key("markdown/full.md"));
    f.assert_no_pending();
}
