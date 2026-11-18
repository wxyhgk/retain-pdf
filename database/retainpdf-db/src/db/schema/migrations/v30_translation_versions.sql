-- 译文版本（2026-11-18）：一本书可以有多份译文，前端能切换。
--
-- 一个版本 = 一次「翻译这本书」：整本翻译（拆成几段的几个任务算同一个版本）、重新翻译、只重翻一部分页。
-- 续跑、OCR 恢复、单独建的重新排版任务不另开版本，加进它来源任务的版本。
-- 只重翻一部分页的版本，其余页沿用 base_version_id 那个版本（再没有就沿用它的 base，依此类推）。
-- documents.current_translation_version_id 为空 = 自动：逐页取最新的译文（和以前一样）；用户选过某个版本才有值。
-- 隐藏的版本（hidden_at 非空）不出现在列表里，自动模式也不用它；文件都留着，随时能恢复。
CREATE TABLE IF NOT EXISTS translation_versions (
    version_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    base_version_id TEXT,
    origin TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    hidden_at TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_translation_versions_document
    ON translation_versions(document_id, created_at);

-- 一个任务最多属于一个版本。
CREATE TABLE IF NOT EXISTS translation_version_jobs (
    job_id TEXT PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
    version_id TEXT NOT NULL REFERENCES translation_versions(version_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_translation_version_jobs_version
    ON translation_version_jobs(version_id);

ALTER TABLE documents ADD COLUMN current_translation_version_id TEXT;

-- 回填：已有的每个翻译任务（book / translate）算一个版本。
INSERT OR IGNORE INTO translation_versions (version_id, document_id, origin, created_at)
SELECT 'tv-' || j.job_id, j.document_id, 'backfill', j.created_at
FROM jobs j
JOIN documents d ON d.document_id = j.document_id
WHERE j.workflow IN ('"book"', '"translate"');

INSERT OR IGNORE INTO translation_version_jobs (job_id, version_id)
SELECT substr(version_id, 4), version_id FROM translation_versions WHERE origin = 'backfill';

-- 单独建的重新排版任务（render）加进它来源任务的版本。
INSERT OR IGNORE INTO translation_version_jobs (job_id, version_id)
SELECT j.job_id, src.version_id
FROM jobs j
JOIN translation_version_jobs src ON src.job_id = json_extract(j.request_json, '$.source.artifact_job_id')
WHERE j.workflow = '"render"';

-- 复用了别的翻译任务（OCR 或译文）的，来源版本就是那个任务的版本：只重翻一部分页时其余页沿用它。
UPDATE translation_versions
SET base_version_id = (
    SELECT src.version_id
    FROM jobs j
    JOIN translation_version_jobs src ON src.job_id = json_extract(j.request_json, '$.source.artifact_job_id')
    WHERE 'tv-' || j.job_id = translation_versions.version_id
)
WHERE origin = 'backfill';
