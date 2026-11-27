-- 2026-11-27：一问带多处出处。前端「再加一段」一问最多带三处：第一处照旧在 `selection_json`（和 page 等列），
-- 另外几处整理过的出处按顺序存成 JSON 数组；书页上给每一处画「?」、重开或改问时还原。老消息没有，留空（读出来是空数组）。
ALTER TABLE ask_conversation_messages ADD COLUMN extra_selections_json TEXT;
