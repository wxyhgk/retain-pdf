use std::path::Path;

pub(super) struct CommandBuilder {
    parts: Vec<String>,
}

impl CommandBuilder {
    pub(super) fn new(python_bin: &str, script_path: &Path, unbuffered: bool) -> Self {
        let mut parts = vec![python_bin.to_string()];
        if unbuffered {
            parts.push("-u".to_string());
        }
        parts.push(script_path.to_string_lossy().to_string());
        Self { parts }
    }

    pub(super) fn flag(&mut self, name: &str, enabled: bool) {
        if enabled {
            self.parts.push(name.to_string());
        }
    }

    pub(super) fn arg(&mut self, name: &str, value: impl ToString) {
        self.parts.push(name.to_string());
        self.parts.push(value.to_string());
    }

    pub(super) fn path_arg(&mut self, name: &str, value: &Path) {
        self.arg(name, value.to_string_lossy());
    }

    pub(super) fn finish(self) -> Vec<String> {
        self.parts
    }
}
