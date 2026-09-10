//! Public application façade for backend-owned credential references.
//!
//! HTTP routes import this module rather than the storage implementation so
//! the vault can later move to Keychain or another secret backend without
//! changing the transport layer.

pub use super::service::{
    create_credential, delete_credential, get_credential_metadata, list_credentials,
    update_credential, CreateCredentialInput, CredentialDeleteView, CredentialListView,
    CredentialMutationView, DeleteCredentialQuery, UpdateCredentialInput,
};
