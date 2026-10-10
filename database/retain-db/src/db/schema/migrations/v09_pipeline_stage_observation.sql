-- the durable stage row also owns the latest worker observation.
-- Public progress events are emitted from this update transaction; the
-- worker JSONL remains a legacy/debug projection rather than state truth.
ALTER TABLE pipeline_stages ADD COLUMN raw_stage TEXT;
ALTER TABLE pipeline_stages ADD COLUMN substage TEXT;
ALTER TABLE pipeline_stages ADD COLUMN stage_detail TEXT;
ALTER TABLE pipeline_stages ADD COLUMN progress_current INTEGER;
ALTER TABLE pipeline_stages ADD COLUMN progress_total INTEGER;
ALTER TABLE pipeline_stages ADD COLUMN progress_unit TEXT;
ALTER TABLE pipeline_stages ADD COLUMN producer_seq INTEGER;
ALTER TABLE pipeline_stages ADD COLUMN observation_payload_json TEXT NOT NULL DEFAULT '{}';
