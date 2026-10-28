-- auto-apply
-- The first auto-built pack ("내 전화번호", Starter) used phone numbers as
-- frame options, so its particle rendered as "010-…(이에요/예요)". The
-- validator now rejects that; remove the pack (auto-built only) and let
-- content-qa rebuild it. Idempotent.
delete from public.writing_topic_content
 where topic_ko = '내 전화번호' and level = 'Starter' and content ? 'auto';
delete from public.content_qa_runs where key = 'pack::내 전화번호|Starter';
