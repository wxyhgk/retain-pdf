-- 多用户：数据归属。默认 'local'（单机模式的本机用户），所以单机版什么都不用改；
-- 多用户模式下归不到任何账号的行仍是 'local'，没有哪个网站账号看得见（宁可看不见，不可看错）。
-- 任务和书不由调用方填：插入时由触发器继承——任务跟上传走、没有上传就跟源任务走；
-- 书跟同指纹的上传走（多用户下指纹按账号区分，见 services/accounts::scoped_content_hash）。
-- 这样 jobsd、重跑、续跑、重新渲染这些不经过 API 的写入路径也不会漏掉归属。
ALTER TABLE uploads ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE jobs ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE documents ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE glossaries ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
ALTER TABLE collections ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
CREATE INDEX IF NOT EXISTS idx_uploads_owner ON uploads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id);
CREATE TRIGGER IF NOT EXISTS jobs_inherit_owner AFTER INSERT ON jobs
BEGIN
    UPDATE jobs SET owner_user_id = COALESCE(
        (SELECT u.owner_user_id FROM uploads u WHERE u.upload_id = NEW.upload_id),
        (SELECT p.owner_user_id FROM jobs p
          WHERE p.job_id = CASE WHEN json_valid(NEW.request_json)
                                THEN json_extract(NEW.request_json, '$.source.artifact_job_id') END
            AND p.job_id <> NEW.job_id),
        owner_user_id)
    WHERE job_id = NEW.job_id AND owner_user_id = 'local';
END;
CREATE TRIGGER IF NOT EXISTS documents_inherit_owner AFTER INSERT ON documents
BEGIN
    UPDATE documents SET owner_user_id = COALESCE(
        (SELECT u.owner_user_id FROM uploads u WHERE u.content_hash = NEW.document_id
          ORDER BY u.uploaded_at LIMIT 1),
        owner_user_id)
    WHERE document_id = NEW.document_id AND owner_user_id = 'local';
END;
