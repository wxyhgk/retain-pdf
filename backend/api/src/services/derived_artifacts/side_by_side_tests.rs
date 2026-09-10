use super::*;

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        let path =
            std::env::temp_dir().join(format!("retain-pdf-builder-{:016x}", fastrand::u64(..)));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn command(&self, output: &Path, mode: &str) -> Command {
        let mut command = Command::new(std::env::current_exe().unwrap());
        command
            .args(["--ignored", "fake_pdf_builder", "--nocapture"])
            .env("RETAIN_FAKE_PDF_MODE", mode)
            .env("RETAIN_FAKE_PDF_OUTPUT", output)
            .env("RETAIN_FAKE_PDF_PID", self.0.join("pid"));
        command
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
#[ignore = "subprocess fixture, invoked only by PDF builder tests"]
fn fake_pdf_builder() {
    let Some(mode) = std::env::var_os("RETAIN_FAKE_PDF_MODE") else {
        return;
    };
    let output = PathBuf::from(std::env::var_os("RETAIN_FAKE_PDF_OUTPUT").unwrap());
    std::fs::write(
        std::env::var_os("RETAIN_FAKE_PDF_PID").unwrap(),
        std::process::id().to_string(),
    )
    .unwrap();
    match mode.to_str().unwrap() {
        "success" => std::fs::write(output, b"%PDF-new").unwrap(),
        "failure" => {
            std::fs::write(output, b"partial").unwrap();
            std::process::exit(7);
        }
        "timeout" => {
            std::fs::write(output, b"partial").unwrap();
            std::thread::sleep(Duration::from_secs(60));
        }
        "missing" => {}
        _ => panic!("unexpected fixture mode"),
    }
}

#[test]
fn uses_the_installed_pipeline_command() {
    let deps = DerivedArtifactDeps::with_pipeline_command(
        "python3",
        "/opt/retainpdf/bin/retainpdf-pipeline",
    );
    let command = side_by_side_command(deps);
    assert_eq!(
        command.get_program(),
        "/opt/retainpdf/bin/retainpdf-pipeline"
    );
    assert_eq!(
        command.get_args().collect::<Vec<_>>(),
        vec![std::ffi::OsStr::new("side-by-side-pdf")]
    );
}

#[test]
fn successful_builder_atomically_replaces_old_output_and_uses_unique_temps() {
    let fixture = Fixture::new();
    let output = fixture.0.join("output.pdf");
    std::fs::write(&output, b"old").unwrap();
    let mut temporary_paths = Vec::new();
    for _ in 0..2 {
        build_with_command(&output, Duration::from_secs(10), |temporary| {
            assert_eq!(temporary.parent(), output.parent());
            temporary_paths.push(temporary.to_path_buf());
            fixture.command(temporary, "success")
        })
        .unwrap();
        assert_eq!(std::fs::read(&output).unwrap(), b"%PDF-new");
    }
    assert_ne!(temporary_paths[0], temporary_paths[1]);
    assert!(temporary_paths.iter().all(|path| !path.exists()));
}

#[test]
fn failed_missing_and_timed_out_builds_preserve_old_output_and_cleanup() {
    for mode in ["failure", "missing", "timeout", "spawn-failure"] {
        let fixture = Fixture::new();
        let output = fixture.0.join("output.pdf");
        std::fs::write(&output, b"old-good-pdf").unwrap();
        let mut temporary_path = PathBuf::new();
        let started = Instant::now();
        let deadline = if mode == "timeout" {
            Duration::from_millis(300)
        } else {
            Duration::from_secs(10)
        };
        let result = build_with_command(&output, deadline, |temporary| {
            temporary_path = temporary.to_path_buf();
            if mode == "spawn-failure" {
                Command::new(fixture.0.join("does-not-exist"))
            } else {
                fixture.command(temporary, mode)
            }
        });
        assert!(result.is_err(), "{mode}");
        assert_eq!(std::fs::read(&output).unwrap(), b"old-good-pdf", "{mode}");
        assert!(!temporary_path.exists(), "{mode}");
        if mode == "timeout" {
            assert!(started.elapsed() < Duration::from_secs(5));
            #[cfg(unix)]
            if let Ok(pid) = std::fs::read_to_string(fixture.0.join("pid")) {
                // A reaped child must not remain even as a zombie.
                assert_eq!(unsafe { libc::kill(pid.parse().unwrap(), 0) }, -1);
                assert_eq!(
                    std::io::Error::last_os_error().raw_os_error(),
                    Some(libc::ESRCH)
                );
            }
        }
    }
}
