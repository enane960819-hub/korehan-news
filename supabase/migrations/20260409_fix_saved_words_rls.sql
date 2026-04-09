-- ═══════════════════════════════════════════════════════════════
-- Fix saved_words RLS — add proper policies if missing
-- The catch-all security hotfix may have enabled RLS without
-- adding SELECT/INSERT policies, locking users out completely
-- ═══════════════════════════════════════════════════════════════

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.saved_words ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "sw_users_read_own" ON public.saved_words;
DROP POLICY IF EXISTS "sw_users_insert_own" ON public.saved_words;
DROP POLICY IF EXISTS "sw_users_update_own" ON public.saved_words;
DROP POLICY IF EXISTS "sw_users_delete_own" ON public.saved_words;
DROP POLICY IF EXISTS "sw_service_full" ON public.saved_words;

-- Create proper policies
CREATE POLICY "sw_users_read_own" ON public.saved_words FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sw_users_insert_own" ON public.saved_words FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sw_users_update_own" ON public.saved_words FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sw_users_delete_own" ON public.saved_words FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "sw_service_full" ON public.saved_words FOR ALL USING (auth.role() = 'service_role');

-- Also fix user_saved_words and vocabulary_bank if they have RLS without policies
ALTER TABLE IF EXISTS public.user_saved_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usw_users_read_own" ON public.user_saved_words;
DROP POLICY IF EXISTS "usw_users_write_own" ON public.user_saved_words;
DROP POLICY IF EXISTS "usw_service_full" ON public.user_saved_words;
CREATE POLICY "usw_users_read_own" ON public.user_saved_words FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "usw_users_write_own" ON public.user_saved_words FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "usw_service_full" ON public.user_saved_words FOR ALL USING (auth.role() = 'service_role');

-- vocabulary_bank: users can read their own + all active public vocab
ALTER TABLE IF EXISTS public.vocabulary_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vb_public_read" ON public.vocabulary_bank;
DROP POLICY IF EXISTS "vb_users_write_own" ON public.vocabulary_bank;
DROP POLICY IF EXISTS "vb_service_full" ON public.vocabulary_bank;
CREATE POLICY "vb_public_read" ON public.vocabulary_bank FOR SELECT USING (true);
CREATE POLICY "vb_users_write_own" ON public.vocabulary_bank FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "vb_service_full" ON public.vocabulary_bank FOR ALL USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
