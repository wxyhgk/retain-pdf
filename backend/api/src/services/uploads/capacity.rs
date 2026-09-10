use super::UploadError;
use retain_core::config::UploadProcessingConfig;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

pub(super) struct UploadCapacity {
    pub(super) parse: Arc<Semaphore>,
    pub(super) repair: Arc<Semaphore>,
    pub(super) queued: Arc<Semaphore>,
    pub(super) admitted: Arc<Semaphore>,
    pub(super) buffers: Arc<Semaphore>,
    config: UploadProcessingConfig,
}

impl UploadCapacity {
    pub(super) fn new(config: UploadProcessingConfig) -> Self {
        Self {
            parse: Arc::new(Semaphore::new(config.parse_workers)),
            repair: Arc::new(Semaphore::new(config.repair_workers)),
            queued: Arc::new(Semaphore::new(config.queue_capacity)),
            admitted: Arc::new(Semaphore::new(
                config.parse_workers + config.repair_workers + config.queue_capacity,
            )),
            buffers: Arc::new(Semaphore::new(config.buffer_mib as usize)),
            config,
        }
    }

    pub(super) async fn acquire(
        &self,
        slots: &Arc<Semaphore>,
    ) -> Result<OwnedSemaphorePermit, UploadError> {
        if let Ok(permit) = slots.clone().try_acquire_owned() {
            return Ok(permit);
        }
        let _queue = self
            .queued
            .clone()
            .try_acquire_owned()
            .map_err(|_| busy())?;
        tokio::time::timeout(
            Duration::from_millis(self.config.queue_wait_ms),
            slots.clone().acquire_owned(),
        )
        .await
        .map_err(|_| UploadError::QueueTimeout)?
        .map_err(|_| busy())
    }

    pub(super) fn reserve_buffer(&self, bytes: u64) -> Result<OwnedSemaphorePermit, UploadError> {
        let mib = bytes.div_ceil(1024 * 1024).max(1);
        if mib > u64::from(self.config.buffer_mib) {
            return Err(UploadError::payload_too_large(
                "PDF exceeds processing buffer budget",
            ));
        }
        self.buffers
            .clone()
            .try_acquire_many_owned(mib as u32)
            .map_err(|_| busy())
    }
}

pub(super) fn busy() -> UploadError {
    UploadError::Busy
}
