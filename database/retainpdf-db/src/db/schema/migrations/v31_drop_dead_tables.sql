-- 2026-11-20：删掉没人用的表（数据库整理第 1 步，docs/ops/planning/database-cleanup/20261120-数据库整理.md）。
--
-- - RetainPDF 自己的 AI（2026-11-03 去掉）留下的：对话 ai_conversations / ai_messages、对话里的附件 assets、
--   AI 计算 agent_calculation_runs / agent_calculation_artifacts、AI 改写文档 document_operations /
--   document_operation_attempts / document_operation_events / document_versions；
-- - 收藏 favorites：接口和前端入口早就没了。
--
-- 删前在真实库里查过都是 0 行；升级前照旧自动备份。表上的同步触发器（v17、v19）随表一起删掉。
-- 先删引用别人的表，再删被引用的。
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS agent_calculation_artifacts;
DROP TABLE IF EXISTS agent_calculation_runs;
DROP TABLE IF EXISTS document_operation_events;
DROP TABLE IF EXISTS document_operation_attempts;
DROP TABLE IF EXISTS document_versions;
DROP TABLE IF EXISTS document_operations;
DROP TABLE IF EXISTS ai_messages;
DROP TABLE IF EXISTS ai_conversations;
DROP TABLE IF EXISTS assets;
-- 同步里这几类的待发改动、已知实体也一起清掉（同步不再认这些种类）
DELETE FROM sync_dirty WHERE kind IN ('favorite', 'asset', 'conversation', 'calculation', 'operation');
DELETE FROM sync_entities WHERE kind IN ('favorite', 'asset', 'conversation', 'calculation', 'operation');
DELETE FROM sync_entity_files WHERE kind IN ('favorite', 'asset', 'conversation', 'calculation', 'operation');
DELETE FROM sync_pending WHERE kind IN ('favorite', 'asset', 'conversation', 'calculation', 'operation');
DELETE FROM sync_own_records WHERE kind IN ('favorite', 'asset', 'conversation', 'calculation', 'operation');
