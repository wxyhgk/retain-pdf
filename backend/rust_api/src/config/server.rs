use super::env_vars::{env_string, env_u16};

#[derive(Clone, Debug)]
pub struct ServerRuntimeConfig {
    pub python_bin: String,
    pub bind_host: String,
    pub port: u16,
}

impl ServerRuntimeConfig {
    pub fn from_env() -> Self {
        Self {
            python_bin: env_string("PYTHON_BIN", "python"),
            bind_host: env_string("RUST_API_BIND_HOST", "0.0.0.0"),
            port: env_u16("RUST_API_PORT", 41000),
        }
    }

    pub fn from_desktop(python_bin: String, port: u16) -> Self {
        Self {
            python_bin,
            bind_host: "127.0.0.1".to_string(),
            port,
        }
    }
}
