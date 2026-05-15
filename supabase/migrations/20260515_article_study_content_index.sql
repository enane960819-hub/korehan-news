-- article_study_content: index on (article_id) so the per-article
-- lookup is a B-tree seek instead of a table scan. Owner-reported
-- "saved content 로딩에 15초는 개에바지" — _asLoadContent's
-- `select * where article_id = ?` was stalling on slow LTE because
-- the column wasn't indexed.
--
-- Idempotent — re-running is a noop if the index exists.

CREATE UNIQUE INDEX IF NOT EXISTS article_study_content_article_id_uidx
  ON public.article_study_content (article_id);

NOTIFY pgrst, 'reload schema';
