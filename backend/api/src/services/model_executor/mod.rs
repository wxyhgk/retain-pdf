//! Job-scoped model execution. This module is deliberately not a generic proxy.
//! Public application routes must never accept a worker-supplied upstream/key.
mod policy;
#[cfg(test)]
mod tests;
mod transport;

use anyhow::Result;
pub use policy::{
    Deadlines, Message, ModelConnection, ModelConnectionPolicy, ModelRequest, Provider, Thinking,
};
use retain_data::db::{Db, ModelOperation, ModelReservation, ModelSessionConflict};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

/// Safe application-facing errors: never retain provider bodies or credentials.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ModelExecutorError {
    #[error("invalid worker capability")]
    Unauthorized,
    #[error("invalid model request: {0}")]
    BadRequest(&'static str),
    #[error("model operation conflict: {0}")]
    Conflict(&'static str),
    #[error("model executor internal failure: {0}")]
    Internal(&'static str),
}

pub struct ModelExecutor {
    db: Arc<Db>,
    data_root: PathBuf,
    pools: Mutex<HashMap<String, Arc<Pool>>>,
    limits: Mutex<HashMap<String, Arc<ConnectionLimit>>>,
}
struct Pool {
    slots: Arc<ConnectionLimit>,
    client: reqwest::Client,
    url: url::Url,
}

#[derive(Default)]
struct ConnectionLimit {
    active: std::sync::Mutex<Vec<usize>>,
}
struct ConnectionPermit {
    limit: Arc<ConnectionLimit>,
    ceiling: usize,
}
impl ConnectionLimit {
    async fn acquire(self: &Arc<Self>, ceiling: usize) -> ConnectionPermit {
        loop {
            {
                let mut active = self.active.lock().unwrap_or_else(|p| p.into_inner());
                // Concurrent revisions respect the most restrictive active
                // snapshot. Lowering a ceiling drains older work first.
                let effective = active.iter().copied().min().unwrap_or(ceiling).min(ceiling);
                if active.len() < effective {
                    active.push(ceiling);
                    return ConnectionPermit {
                        limit: self.clone(),
                        ceiling,
                    };
                }
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }
}
impl Drop for ConnectionPermit {
    fn drop(&mut self) {
        let mut active = self.limit.active.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(index) = active.iter().position(|n| *n == self.ceiling) {
            active.swap_remove(index);
        }
    }
}

pub fn fingerprint(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

impl ModelExecutor {
    /// One API owns execution for a data directory. jobsd must not instantiate
    /// this owner; it only registers worker capabilities in the shared DB.
    pub fn new(db: Arc<Db>, data_root: PathBuf) -> Result<Self> {
        db.recover_model_operations()?;
        Ok(Self {
            db,
            data_root,
            pools: Mutex::new(HashMap::new()),
            limits: Mutex::new(HashMap::new()),
        })
    }

    /// For a trusted job launcher only; token is returned once, hash persisted.
    pub fn register_job(
        &self,
        job_id: &str,
        profile: &ModelConnection,
        ttl_seconds: u64,
    ) -> Result<String, ModelExecutorError> {
        profile
            .validate()
            .map_err(|_| ModelExecutorError::BadRequest("invalid model connection"))?;
        if job_id.is_empty() || !(1..=86400).contains(&ttl_seconds) {
            return Err(ModelExecutorError::BadRequest(
                "invalid capability scope or expiry",
            ));
        }
        let mut random = [0u8; 32];
        getrandom::getrandom(&mut random)
            .map_err(|_| ModelExecutorError::Internal("capability generation failed"))?;
        let token = fingerprint(&random);
        self.db
            .create_model_session(
                job_id,
                &fingerprint(token.as_bytes()),
                chrono::Utc::now().timestamp() + ttl_seconds as i64,
                &serde_json::to_value(profile)
                    .map_err(|_| ModelExecutorError::Internal("connection encoding failed"))?,
            )
            .map_err(|error| {
                if error.downcast_ref::<ModelSessionConflict>().is_some() {
                    ModelExecutorError::Conflict("frozen model connection differs")
                } else {
                    ModelExecutorError::Internal("model session persistence failed")
                }
            })?;
        Ok(token)
    }

    pub(crate) fn authorize(
        &self,
        job: &str,
        token: &str,
    ) -> Result<ModelConnection, ModelExecutorError> {
        if token.len() != 64 {
            return Err(ModelExecutorError::Unauthorized);
        }
        let session = self
            .db
            .authorize_model_session(
                job,
                &fingerprint(token.as_bytes()),
                chrono::Utc::now().timestamp(),
            )
            .map_err(|_| ModelExecutorError::Internal("model session lookup failed"))?
            .ok_or(ModelExecutorError::Unauthorized)?;
        serde_json::from_value(session.profile)
            .map_err(|_| ModelExecutorError::Internal("stored model connection is invalid"))
    }

    pub fn status(
        &self,
        job: &str,
        token: &str,
        operation: &str,
    ) -> Result<Option<ModelOperation>, ModelExecutorError> {
        self.authorize(job, token)?;
        self.db
            .get_model_operation(job, operation)
            .map_err(|_| ModelExecutorError::Internal("model operation lookup failed"))
    }

    pub fn cancel(
        &self,
        job: &str,
        token: &str,
        operation: &str,
    ) -> Result<bool, ModelExecutorError> {
        self.authorize(job, token)?;
        // A dispatched cancellation is ambiguous: aborting a local socket does
        // not establish that the upstream stopped or did not charge.
        self.db
            .cancel_model_operation(job, operation)
            .map_err(|_| ModelExecutorError::Internal("model operation cancellation failed"))
    }

    pub async fn submit(
        self: &Arc<Self>,
        job: &str,
        token: &str,
        request: ModelRequest,
    ) -> Result<ModelOperation, ModelExecutorError> {
        let profile = self.authorize(job, token)?;
        request
            .validate()
            .map_err(|_| ModelExecutorError::BadRequest("invalid bounded model request"))?;
        let hash = fingerprint(
            &serde_json::to_vec(&request)
                .map_err(|_| ModelExecutorError::Internal("model request encoding failed"))?,
        );
        match self
            .db
            .reserve_model_operation(
                job,
                &request.operation_id,
                &request.unit_id,
                &hash,
                &request.purpose,
            )
            .map_err(|_| ModelExecutorError::Internal("model operation reservation failed"))?
        {
            ModelReservation::Existing(operation) => Ok(operation),
            ModelReservation::Conflict => Err(ModelExecutorError::Conflict(
                "operation_id content conflict",
            )),
            ModelReservation::Paused => Err(ModelExecutorError::Conflict(
                "job paused; manual recovery required",
            )),
            ModelReservation::UnitBudgetExceeded => {
                Err(ModelExecutorError::Conflict("unit request budget exceeded"))
            }
            ModelReservation::Created(operation) => {
                let executor = self.clone();
                let job = job.to_owned();
                tokio::spawn(async move {
                    if executor.run(&job, &profile, &request).await.is_err() {
                        // Fail closed if persistence/credential setup fails. No
                        // raw error string can expose a URL, token or response.
                        if let Ok(Some(op)) =
                            executor.db.get_model_operation(&job, &request.operation_id)
                        {
                            let status = if op.status == "running" {
                                "ambiguous"
                            } else {
                                "failed"
                            };
                            let _ = executor.db.finish_model_operation(
                                &job,
                                &request.operation_id,
                                status,
                                None,
                                Some("executor_internal_error"),
                            );
                        }
                    }
                });
                Ok(operation)
            }
        }
    }

    async fn pool(&self, profile: &ModelConnection) -> Result<Arc<Pool>> {
        // Same frozen connection shares both a keep-alive client and slots.
        let key = fingerprint(&serde_json::to_vec(profile)?);
        if let Some(pool) = self.pools.lock().await.get(&key) {
            return Ok(pool.clone());
        }
        let url = profile.validate()?;
        let addresses = profile.addresses(&url).await?;
        let client = reqwest::Client::builder()
            .no_proxy()
            .retry(reqwest::retry::never())
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_millis(profile.deadlines.connect_ms))
            .resolve_to_addrs(url.host_str().unwrap_or(""), &addresses)
            .build()?;
        let mut limits = self.limits.lock().await;
        // Revisions/models of one connection must not each get a new budget.
        let slots = limits.entry(profile.id.clone()).or_default();
        let pool = Arc::new(Pool {
            slots: slots.clone(),
            client,
            url,
        });
        drop(limits);
        let mut pools = self.pools.lock().await;
        // DNS/client setup does not hold a global lock across unrelated
        // connections. Racing initializers converge on one pooled client.
        Ok(pools.entry(key).or_insert(pool).clone())
    }

    async fn run(
        &self,
        job: &str,
        profile: &ModelConnection,
        request: &ModelRequest,
    ) -> Result<()> {
        let started = Instant::now();
        let ready =
            tokio::time::timeout(Duration::from_millis(profile.deadlines.queue_ms), async {
                let pool = self.pool(profile).await?;
                let permit = pool.slots.acquire(profile.concurrency).await;
                // Resolve before marking dispatched. Never give the Python worker a key.
                let credential = retain_data::credentials::resolve_credential(
                    &self.data_root,
                    &profile.credential_ref,
                    "translation_api_key",
                )?;
                Ok::<_, anyhow::Error>((pool, permit, credential.secret))
            })
            .await;
        let (pool, _permit, secret) = match ready {
            Ok(Ok(ready)) => ready,
            other => {
                self.db.finish_model_operation(
                    job,
                    &request.operation_id,
                    "failed",
                    Some(&serde_json::json!({"queue_ms":started.elapsed().as_millis() as u64,"total_ms":started.elapsed().as_millis() as u64,"upstream_attempts":0})),
                    Some(if other.is_err() {
                        "queue_timeout"
                    } else {
                        "connection_setup_failed"
                    }),
                )?;
                return Ok(());
            }
        };
        if !self.db.claim_model_operation(job, &request.operation_id)? {
            return Ok(());
        }
        let queue_ms = started.elapsed().as_millis() as u64;
        let upstream =
            transport::execute(&pool.client, &pool.url, &secret, profile, request, queue_ms);
        let canceled = async {
            loop {
                tokio::time::sleep(Duration::from_millis(200)).await;
                if self
                    .db
                    .get_model_operation(job, &request.operation_id)?
                    .is_none_or(|op| op.status != "running")
                {
                    return Ok::<_, anyhow::Error>(());
                }
            }
        };
        tokio::select! {
            result=upstream=>{
                let result=result;
                self.db.finish_model_operation(job,&request.operation_id,result.status,Some(&serde_json::to_value(&result.receipt)?),result.error)?;
            },
            result=canceled=>{result?;},
        }
        Ok(())
    }
}
