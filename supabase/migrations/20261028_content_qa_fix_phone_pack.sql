-- auto-apply
-- First auto-built pack ("내 전화번호", Starter): frame 2 read
-- "번호는 새 번호예요" (번호 twice). Drop the leading "번호는 " so it reads
-- "새 번호예요." Only touches that exact frame text. Idempotent.
update public.writing_topic_content
   set content = jsonb_set(content, '{frames,1,parts,0}', '""'::jsonb),
       updated_at = now()
 where topic_ko = '내 전화번호' and level = 'Starter' and content ? 'auto'
   and content #>> '{frames,1,parts,0}' = '번호는 ';
