//! Credential HTTP entry points and shared managed-credential capabilities.

pub(crate) mod api;
mod service;

pub(crate) use service::{
    acquire_credential_usage_lock, delete_unreferenced_managed_credential,
    get_or_create_managed_credential, CredentialUsageLock,
};
