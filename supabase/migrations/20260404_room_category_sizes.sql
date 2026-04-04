-- ============================================================
-- Room Items: add category + double base sizes
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add category column
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'deco';

-- 2. Double all base sizes
UPDATE room_items SET base_size = base_size * 2;

-- 3. Set categories for existing items
UPDATE room_items SET category = 'character' WHERE id IN ('character', 'char_silver', 'char_thumbs');
UPDATE room_items SET category = 'pet' WHERE id IN ('cat', 'fennec', 'poop');
UPDATE room_items SET category = 'furniture' WHERE id IN ('bookshelf', 'cushion', 'lamp');
UPDATE room_items SET category = 'deco' WHERE id IN ('plant', 'neon_hwaiting');
