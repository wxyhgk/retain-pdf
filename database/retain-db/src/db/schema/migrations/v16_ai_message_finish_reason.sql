-- 消息记住自己是怎么结束的。空 = 正常答完;"cancelled" = 用户点了停止,
-- 正文只有半截;"rounds_exhausted" = 工具轮次预算用尽,模型被逼着收尾——它的
-- 语气照常,不记下来的话刷新回来就看不出这条回答其实没做完。
-- 兼容:旧行为空串,读出来就是"正常答完",与此前的呈现一致。
ALTER TABLE ai_messages ADD COLUMN finish_reason TEXT NOT NULL DEFAULT '';
