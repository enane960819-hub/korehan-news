-- auto-apply
-- Owner put Fake News on hold (2026-10-29): its articles go back to draft so
-- nothing links to or lists them. KH_FAKE_NEWS_ON in korehan-shared.js hides
-- the nav link and home rail. Re-publish (status = 'published') to bring back.
update public.articles set status = 'draft' where section = 'fake' and status = 'published';
