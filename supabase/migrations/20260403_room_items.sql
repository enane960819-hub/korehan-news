-- ============================================================
-- Room Items DB Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Room item catalog (replaces hardcoded ROOM_ITEMS array)
CREATE TABLE IF NOT EXISTS room_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_nyang INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  base_size INTEGER NOT NULL DEFAULT 60,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (public read, admin write)
ALTER TABLE room_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_items_read" ON room_items;
CREATE POLICY "room_items_read" ON room_items FOR SELECT USING (true);

-- 2. Seed with existing hardcoded items
INSERT INTO room_items (id, name, price_nyang, image_url, base_size, sort_order) VALUES
  ('character',   'Character',        0,  'assets/file_000000000570720694038be799df9f21-removebg-preview.png', 80, 1),
  ('cat',         'Sleeping Cat',    15,  'assets/file_000000003a7c7209a3877df863e15fd9-removebg-preview.png', 65, 2),
  ('poop',        'Happy Poop',       3,  'assets/file_000000004b247206b900dba933600c46-removebg-preview.png', 50, 3),
  ('cushion',     'Reading Cushion', 10,  'assets/file_0000000064f872098fc13437d998de5a-removebg-preview.png', 70, 4),
  ('lamp',        'Korean Lamp',     12,  'assets/file_00000000a2287209b632ccc0519de0e7-removebg-preview.png', 55, 5),
  ('bookshelf',   'Bookshelf',       25,  'assets/file_00000000a66472069f5c058b95fd2322-removebg-preview.png', 75, 6),
  ('plant',       'Potted Plant',     8,  'assets/file_00000000f734720691f7289c1f8a5e3c-removebg-preview.png', 55, 7),
  ('fennec',      'Fennec Fox',      20,  'assets/file_0000000097387206868da2533972ee90-removebg-preview.png', 60, 8),
  ('char_silver', 'Silver Character', 0,  'assets/file_00000000b8bc72069bc7877f36aaf27f-removebg-preview.png', 96, 9),
  ('char_thumbs', 'Thumbs Up Guy',    0,  'assets/file_00000000d40c7206bb289cd92deab487-removebg-preview.png', 96, 10)
ON CONFLICT (id) DO NOTHING;
