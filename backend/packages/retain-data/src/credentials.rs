use std::collections::BTreeMap;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

const VAULT_SCHEMA: &str = "retainpdf_credential_vault_v1";
const MAX_VAULT_BYTES: u64 = 256 * 1024;
const MAX_SECRET_BYTES: usize = 8192;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedCredential {
    pub kind: String,
    pub provider: String,
    pub secret: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CredentialResolveError {
    InvalidReference,
    NotFound,
    VaultUnreadable,
    VaultUnsafe,
    VaultInvalid,
    KindMismatch { expected: String, actual: String },
}

impl fmt::Display for CredentialResolveError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidReference => formatter.write_str("credential_ref is invalid"),
            Self::NotFound => formatter.write_str("credential reference not found"),
            Self::VaultUnreadable => formatter.write_str("credential vault is unreadable"),
            Self::VaultUnsafe => formatter.write_str("credential vault path is unsafe"),
            Self::VaultInvalid => formatter.write_str("credential vault is invalid"),
            Self::KindMismatch { expected, actual } => write!(
                formatter,
                "credential kind mismatch: expected {expected}, got {actual}"
            ),
        }
    }
}

impl std::error::Error for CredentialResolveError {}

#[derive(Debug, Deserialize)]
struct StoredCredential {
    kind: String,
    #[serde(default)]
    provider: String,
    secret: String,
}

#[derive(Debug, Deserialize)]
struct CredentialVault {
    schema: String,
    credentials: BTreeMap<String, StoredCredential>,
}

pub fn resolve_credential(
    data_root: &Path,
    credential_ref: &str,
    expected_kind: &str,
) -> Result<ResolvedCredential, CredentialResolveError> {
    validate_credential_ref(credential_ref)?;
    let vault = load_vault(data_root)?;
    let stored = vault
        .credentials
        .get(credential_ref)
        .ok_or(CredentialResolveError::NotFound)?;
    if stored.kind != expected_kind {
        return Err(CredentialResolveError::KindMismatch {
            expected: expected_kind.to_string(),
            actual: stored.kind.clone(),
        });
    }
    Ok(ResolvedCredential {
        kind: stored.kind.clone(),
        provider: stored.provider.clone(),
        secret: stored.secret.clone(),
    })
}

fn load_vault(data_root: &Path) -> Result<CredentialVault, CredentialResolveError> {
    let path = vault_path(data_root);
    let metadata = fs::symlink_metadata(&path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            CredentialResolveError::NotFound
        } else {
            CredentialResolveError::VaultUnreadable
        }
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() || metadata.len() > MAX_VAULT_BYTES
    {
        return Err(CredentialResolveError::VaultUnsafe);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o077 != 0 {
            return Err(CredentialResolveError::VaultUnsafe);
        }
    }
    let bytes = fs::read(path).map_err(|_| CredentialResolveError::VaultUnreadable)?;
    let vault: CredentialVault =
        serde_json::from_slice(&bytes).map_err(|_| CredentialResolveError::VaultInvalid)?;
    if vault.schema != VAULT_SCHEMA
        || vault.credentials.iter().any(|(reference, item)| {
            validate_credential_ref(reference).is_err()
                || !valid_shape(&item.kind)
                || item.secret.is_empty()
                || item.secret.len() > MAX_SECRET_BYTES
        })
    {
        return Err(CredentialResolveError::VaultInvalid);
    }
    Ok(vault)
}

fn vault_path(data_root: &Path) -> PathBuf {
    data_root.join("secrets").join("credentials.json")
}

fn validate_credential_ref(value: &str) -> Result<(), CredentialResolveError> {
    if !value.starts_with("cred_") || !valid_shape(value) {
        return Err(CredentialResolveError::InvalidReference);
    }
    Ok(())
}

fn valid_shape(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_' || byte == b'-'
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "retain-data-credential-{name}-{}-{:016x}",
            std::process::id(),
            fastrand::u64(..)
        ))
    }

    fn write_vault(root: &Path, kind: &str, secret: &str) {
        let directory = root.join("secrets");
        fs::create_dir_all(&directory).expect("create secret directory");
        let path = directory.join("credentials.json");
        fs::write(
            &path,
            format!(
                r#"{{"schema":"{VAULT_SCHEMA}","revision":1,"credentials":{{"cred_test":{{"kind":"{kind}","provider":"openai","label":"test","secret":"{secret}","created_at":"now","updated_at":"now"}}}}}}"#
            ),
        )
        .expect("write vault");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(path, fs::Permissions::from_mode(0o600)).expect("secure vault");
        }
    }

    #[test]
    fn resolves_expected_credential_kind() {
        let root = test_root("resolve");
        write_vault(&root, "translation_api_key", "sk-test");
        let resolved = resolve_credential(&root, "cred_test", "translation_api_key")
            .expect("resolve credential");
        assert_eq!(resolved.provider, "openai");
        assert_eq!(resolved.secret, "sk-test");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_wrong_kind_and_unsafe_permissions() {
        let root = test_root("wrong-kind");
        write_vault(&root, "ocr_token", "token");
        assert!(matches!(
            resolve_credential(&root, "cred_test", "translation_api_key"),
            Err(CredentialResolveError::KindMismatch { .. })
        ));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(
                root.join("secrets").join("credentials.json"),
                fs::Permissions::from_mode(0o644),
            )
            .expect("make vault unsafe");
            assert_eq!(
                resolve_credential(&root, "cred_test", "translation_api_key"),
                Err(CredentialResolveError::VaultUnsafe)
            );
        }
        let _ = fs::remove_dir_all(root);
    }
}
