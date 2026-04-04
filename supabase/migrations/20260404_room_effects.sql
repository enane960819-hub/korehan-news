-- ============================================================
-- Room Items: add thumbnail_url + effect columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add thumbnail_url column (separate image for shop display)
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 2. Add effect column (glow_neon, glow_warm, sparkle, float, none)
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS effect TEXT NOT NULL DEFAULT 'none';

-- 3. Insert neon sign item
INSERT INTO room_items (id, name, price_nyang, image_url, base_size, sort_order, effect) VALUES
  ('neon_hwaiting', '화이팅 Neon Sign', 30, 'assets/file_000000009480720690ca8d793a34ceeb-removebg-preview.png', 90, 11, 'glow_neon')
ON CONFLICT (id) DO UPDATE SET effect = 'glow_neon', image_url = EXCLUDED.image_url;

-- 4. Set lamp to glow_warm effect
UPDATE room_items SET effect = 'glow_warm' WHERE id = 'lamp';
