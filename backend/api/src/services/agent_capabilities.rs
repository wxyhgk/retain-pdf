use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, KeyInit, Mac};
use retain_data::db::Db;
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use crate::error::AppError;

pub const AGENT_CAPABILITY_ISSUE_SCHEMA: &str = "agent_capability_issue_v1";
const AGENT_CAPABILITY_CLAIMS_SCHEMA: &str = "agent_capability_claims_v1";
const TOKEN_PREFIX: &str = "rpdfcap1";
const TOKEN_ISSUER: &str = "retainpdf-api";
const TOKEN_AUDIENCE: &str = "retainpdf-agent-cli";
const DEFAULT_TTL_SECONDS: u64 = 120;
const MAX_TTL_SECONDS: u64 = 300;
const MAX_TOKEN_BYTES: usize = 16 * 1024;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AgentCapabilityAction {
    #[serde(rename = "document.inspect")]
    DocumentInspect,
    #[serde(rename = "operation.create")]
    OperationCreate,
    #[serde(rename = "operation.get")]
    OperationGet,
    #[serde(rename = "operation.run")]
    OperationRun,
    #[serde(rename = "operation.commit")]
    OperationCommit,
    #[serde(rename = "operation.cancel")]
    OperationCancel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AgentCapabilityClaims {
    pub schema: String,
    pub issuer: String,
    pub audience: String,
    pub issued_at: u64,
    pub expires_at: u64,
    pub capability_id: String,
    pub conversation_id: String,
    pub document_id: String,
    pub actions: Vec<AgentCapabilityAction>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AgentCapabilityIssueInput {
    pub schema: String,
    pub conversation_id: String,
    pub document_id: String,
    pub actions: Vec<AgentCapabilityAction>,
    #[serde(default)]
    pub ttl_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentCapabilityIssueView {
    pub schema: &'static str,
    pub token_type: &'static str,
    pub capability: String,
    pub capability_id: String,
    pub conversation_id: String,
    pub document_id: String,
    pub actions: Vec<AgentCapabilityAction>,
    pub issued_at: u64,
    pub expires_at: u64,
}

#[derive(Debug)]
pub struct AgentCapabilityAuthority {
    signing_key: [u8; 32],
}

impl AgentCapabilityAuthority {
    pub fn new_random() -> anyhow::Result<Self> {
        let mut signing_key = [0_u8; 32];
        getrandom::getrandom(&mut signing_key)
            .map_err(|error| anyhow::anyhow!("generate agent capability signing key: {error}"))?;
        Ok(Self { signing_key })
    }

    #[cfg(test)]
    fn from_key(signing_key: [u8; 32]) -> Self {
        Self { signing_key }
    }

    pub fn issue(
        &self,
        conversation_id: &str,
        document_id: &str,
        actions: Vec<AgentCapabilityAction>,
        ttl_seconds: u64,
    ) -> Result<AgentCapabilityIssueView, AppError> {
        self.issue_at(
            conversation_id,
            document_id,
            actions,
            ttl_seconds,
            unix_now()?,
        )
    }

    fn issue_at(
        &self,
        conversation_id: &str,
        document_id: &str,
        actions: Vec<AgentCapabilityAction>,
        ttl_seconds: u64,
        now: u64,
    ) -> Result<AgentCapabilityIssueView, AppError> {
        validate_scope_id("conversation_id", conversation_id)?;
        validate_scope_id("document_id", document_id)?;
        if !(1..=MAX_TTL_SECONDS).contains(&ttl_seconds) {
            return Err(AppError::bad_request(format!(
                "ttl_seconds must be between 1 and {MAX_TTL_SECONDS}"
            )));
        }
        let actions = normalize_actions(actions)?;
        let mut nonce = [0_u8; 16];
        getrandom::getrandom(&mut nonce)
            .map_err(|error| AppError::internal(format!("generate capability id: {error}")))?;
        let capability_id = format!("cap-{}", URL_SAFE_NO_PAD.encode(nonce));
        let expires_at = now
            .checked_add(ttl_seconds)
            .ok_or_else(|| AppError::internal("capability expiry overflow"))?;
        let claims = AgentCapabilityClaims {
            schema: AGENT_CAPABILITY_CLAIMS_SCHEMA.to_string(),
            issuer: TOKEN_ISSUER.to_string(),
            audience: TOKEN_AUDIENCE.to_string(),
            issued_at: now,
            expires_at,
            capability_id: capability_id.clone(),
            conversation_id: conversation_id.to_string(),
            document_id: document_id.to_string(),
            actions: actions.clone(),
        };
        let payload = serde_json::to_vec(&claims)
            .map_err(|error| AppError::internal(format!("serialize capability claims: {error}")))?;
        let encoded_payload = URL_SAFE_NO_PAD.encode(payload);
        let signed = format!("{TOKEN_PREFIX}.{encoded_payload}");
        let signature = self.sign(signed.as_bytes())?;
        Ok(AgentCapabilityIssueView {
            schema: AGENT_CAPABILITY_ISSUE_SCHEMA,
            token_type: "RetainPDF-Agent-Capability",
            capability: format!("{signed}.{}", URL_SAFE_NO_PAD.encode(signature)),
            capability_id,
            conversation_id: conversation_id.to_string(),
            document_id: document_id.to_string(),
            actions,
            issued_at: now,
            expires_at,
        })
    }

    pub fn authenticate_request(
        &self,
        token: &str,
        method: &str,
        path: &str,
    ) -> Result<AgentCapabilityClaims, AppError> {
        let claims = self.verify_at(token, unix_now()?)?;
        let (action, path_document_id) = requested_action(method, path)
            .ok_or_else(|| AppError::forbidden("agent capability does not allow this request"))?;
        if !claims.actions.contains(&action) {
            return Err(AppError::forbidden(
                "agent capability does not allow this action",
            ));
        }
        if path_document_id.is_some_and(|document_id| document_id != claims.document_id) {
            return Err(AppError::forbidden(
                "agent capability is scoped to a different document",
            ));
        }
        Ok(claims)
    }

    fn verify_at(&self, token: &str, now: u64) -> Result<AgentCapabilityClaims, AppError> {
        if token.is_empty() || token.len() > MAX_TOKEN_BYTES {
            return Err(invalid_capability());
        }
        let mut parts = token.split('.');
        let prefix = parts.next();
        let encoded_payload = parts.next();
        let encoded_signature = parts.next();
        if prefix != Some(TOKEN_PREFIX)
            || encoded_payload.is_none()
            || encoded_signature.is_none()
            || parts.next().is_some()
        {
            return Err(invalid_capability());
        }
        let encoded_payload = encoded_payload.expect("checked payload");
        let signed = format!("{TOKEN_PREFIX}.{encoded_payload}");
        let signature = URL_SAFE_NO_PAD
            .decode(encoded_signature.expect("checked signature"))
            .map_err(|_| invalid_capability())?;
        if URL_SAFE_NO_PAD.encode(&signature) != encoded_signature.expect("checked signature") {
            return Err(invalid_capability());
        }
        let mut mac = HmacSha256::new_from_slice(&self.signing_key)
            .map_err(|_| AppError::internal("initialize capability verifier"))?;
        mac.update(signed.as_bytes());
        mac.verify_slice(&signature)
            .map_err(|_| invalid_capability())?;
        let payload = URL_SAFE_NO_PAD
            .decode(encoded_payload)
            .map_err(|_| invalid_capability())?;
        if URL_SAFE_NO_PAD.encode(&payload) != encoded_payload {
            return Err(invalid_capability());
        }
        let claims: AgentCapabilityClaims =
            serde_json::from_slice(&payload).map_err(|_| invalid_capability())?;
        validate_claims(&claims, now)?;
        Ok(claims)
    }

    fn sign(&self, value: &[u8]) -> Result<Vec<u8>, AppError> {
        let mut mac = HmacSha256::new_from_slice(&self.signing_key)
            .map_err(|_| AppError::internal("initialize capability signer"))?;
        mac.update(value);
        Ok(mac.finalize().into_bytes().to_vec())
    }
}

pub fn issue_agent_capability(
    db: &Db,
    authority: &AgentCapabilityAuthority,
    input: &AgentCapabilityIssueInput,
) -> Result<AgentCapabilityIssueView, AppError> {
    if input.schema != AGENT_CAPABILITY_ISSUE_SCHEMA {
        return Err(AppError::bad_request(format!(
            "unsupported agent capability schema: {}",
            input.schema
        )));
    }
    let conversation_id = input.conversation_id.trim();
    let document_id = input.document_id.trim();
    validate_scope_id("conversation_id", conversation_id)?;
    validate_scope_id("document_id", document_id)?;
    db.get_document(document_id)
        .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
    let conversation = db
        .get_conversation(conversation_id)?
        .ok_or_else(|| AppError::not_found(format!("conversation not found: {conversation_id}")))?;
    if conversation.document_id.as_deref() != Some(document_id) {
        return Err(AppError::conflict(
            "conversation is not scoped to the requested document",
        ));
    }
    authority.issue(
        conversation_id,
        document_id,
        input.actions.clone(),
        input.ttl_seconds.unwrap_or(DEFAULT_TTL_SECONDS),
    )
}

pub fn authorize_create_scope(
    claims: Option<&AgentCapabilityClaims>,
    conversation_id: &str,
    document_id: &str,
) -> Result<(), AppError> {
    if let Some(claims) = claims {
        if conversation_id.trim() != claims.conversation_id || document_id != claims.document_id {
            return Err(AppError::forbidden(
                "agent capability scope does not match the operation",
            ));
        }
    }
    Ok(())
}

pub fn authorize_operation_scope(
    db: &Db,
    claims: Option<&AgentCapabilityClaims>,
    operation_id: &str,
) -> Result<(), AppError> {
    let Some(claims) = claims else {
        return Ok(());
    };
    let operation = db.get_document_operation(operation_id)?.ok_or_else(|| {
        AppError::not_found(format!("document operation not found: {operation_id}"))
    })?;
    if operation.document_id != claims.document_id
        || operation.conversation_id.as_deref() != Some(claims.conversation_id.as_str())
    {
        return Err(AppError::forbidden(
            "agent capability scope does not match the operation",
        ));
    }
    Ok(())
}

fn requested_action<'a>(
    method: &str,
    path: &'a str,
) -> Option<(AgentCapabilityAction, Option<&'a str>)> {
    let segments: Vec<_> = path.trim_matches('/').split('/').collect();
    match (method, segments.as_slice()) {
        ("GET", ["api", "v1", "documents", document_id]) => {
            Some((AgentCapabilityAction::DocumentInspect, Some(*document_id)))
        }
        ("POST", ["api", "v1", "internal", "agent", "operations"]) => {
            Some((AgentCapabilityAction::OperationCreate, None))
        }
        ("GET", ["api", "v1", "internal", "agent", "operations", _]) => {
            Some((AgentCapabilityAction::OperationGet, None))
        }
        ("POST", ["api", "v1", "internal", "agent", "operations", _, "run"]) => {
            Some((AgentCapabilityAction::OperationRun, None))
        }
        ("POST", ["api", "v1", "internal", "agent", "operations", _, "commit"]) => {
            Some((AgentCapabilityAction::OperationCommit, None))
        }
        ("POST", ["api", "v1", "internal", "agent", "operations", _, "cancel"]) => {
            Some((AgentCapabilityAction::OperationCancel, None))
        }
        _ => None,
    }
}

fn normalize_actions(
    actions: Vec<AgentCapabilityAction>,
) -> Result<Vec<AgentCapabilityAction>, AppError> {
    let mut seen = HashSet::new();
    let actions: Vec<_> = actions
        .into_iter()
        .filter(|action| seen.insert(*action))
        .collect();
    if actions.is_empty() {
        return Err(AppError::bad_request("actions must not be empty"));
    }
    Ok(actions)
}

fn validate_claims(claims: &AgentCapabilityClaims, now: u64) -> Result<(), AppError> {
    if claims.schema != AGENT_CAPABILITY_CLAIMS_SCHEMA
        || claims.issuer != TOKEN_ISSUER
        || claims.audience != TOKEN_AUDIENCE
        || claims.actions.is_empty()
        || claims.expires_at <= claims.issued_at
        || claims.expires_at - claims.issued_at > MAX_TTL_SECONDS
        || claims.issued_at > now.saturating_add(30)
    {
        return Err(invalid_capability());
    }
    validate_scope_id("conversation_id", &claims.conversation_id)
        .map_err(|_| invalid_capability())?;
    validate_scope_id("document_id", &claims.document_id).map_err(|_| invalid_capability())?;
    if now >= claims.expires_at {
        return Err(AppError::unauthorized("agent capability has expired"));
    }
    Ok(())
}

fn validate_scope_id(name: &str, value: &str) -> Result<(), AppError> {
    if value.is_empty()
        || value.len() > 256
        || value
            .chars()
            .any(|character| !(character.is_ascii_alphanumeric() || "-_.".contains(character)))
    {
        return Err(AppError::bad_request(format!("invalid {name}")));
    }
    Ok(())
}

fn unix_now() -> Result<u64, AppError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|_| AppError::internal("system clock is before unix epoch"))
}

fn invalid_capability() -> AppError {
    AppError::unauthorized("invalid agent capability")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn authority() -> AgentCapabilityAuthority {
        AgentCapabilityAuthority::from_key([7_u8; 32])
    }

    #[test]
    fn signature_tampering_is_rejected() {
        let issued = authority()
            .issue_at(
                "conv-a",
                "doc-a",
                vec![AgentCapabilityAction::OperationGet],
                60,
                100,
            )
            .expect("issue");
        let mut token = issued.capability.into_bytes();
        let last = token.last_mut().expect("token byte");
        *last = if *last == b'a' { b'b' } else { b'a' };
        let token = String::from_utf8(token).expect("utf8 token");
        assert!(authority().verify_at(&token, 110).is_err());
    }

    #[test]
    fn expiry_is_enforced_without_sleeping() {
        let authority = authority();
        let issued = authority
            .issue_at(
                "conv-a",
                "doc-a",
                vec![AgentCapabilityAction::DocumentInspect],
                5,
                100,
            )
            .expect("issue");
        assert!(authority.verify_at(&issued.capability, 104).is_ok());
        let error = authority
            .verify_at(&issued.capability, 105)
            .expect_err("expired");
        assert!(matches!(error, AppError::Unauthorized(_)));
    }

    #[test]
    fn request_mapping_is_an_exact_allowlist() {
        assert_eq!(
            requested_action("GET", "/api/v1/documents/doc-a"),
            Some((AgentCapabilityAction::DocumentInspect, Some("doc-a")))
        );
        assert!(requested_action("DELETE", "/api/v1/documents/doc-a").is_none());
        assert!(
            requested_action("GET", "/api/v1/internal/agent/runtime-sessions/conv-a").is_none()
        );
        assert!(requested_action("POST", "/api/v1/internal/agent/capabilities").is_none());
    }
}
