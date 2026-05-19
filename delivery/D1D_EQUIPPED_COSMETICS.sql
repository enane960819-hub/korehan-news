-- =============================================================================
-- Item 1D — equipped cosmetics (frame slot MVP)
-- =============================================================================
-- Adds the storage + RPC for "applying" a purchased / pulled cosmetic to the
-- user's profile. This first migration covers the FRAME slot only — the
-- highest-visibility cosmetic. TITLE / PET / OUTFIT slots will follow.
--
-- Idempotent. Safe to re-run.

ALTER TABLE user_stats
  ADD COLUMN IF NOT EXISTS equipped_cosmetics JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS user_stats_equipped_frame_idx
  ON user_stats ((equipped_cosmetics->>'frame'))
  WHERE equipped_cosmetics ? 'frame';

-- =============================================================================
-- set_equipped_cosmetic — server-validated equip / unequip
-- =============================================================================
-- p_slot:   'frame' (only slot supported in this migration)
-- p_item_id: the shop_items.id or gacha_items.id to equip. Pass NULL or ''
--            to clear the slot.
--
-- Returns: jsonb { ok: bool, error?: string, equipped?: jsonb }
-- Errors:
--   INVALID_SLOT  — slot name not allowed
--   WRONG_SLOT    — item exists but its id does not match the slot pattern
--   NOT_OWNED     — caller does not own the item in either owned_items
--                   (shop) or gacha_owned_items (gacha)

CREATE OR REPLACE FUNCTION set_equipped_cosmetic(
  p_slot    TEXT,
  p_item_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_owned   INT;
  v_current JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF p_slot NOT IN ('frame') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_SLOT');
  END IF;

  -- Empty/null clears the slot.
  IF p_item_id IS NULL OR length(trim(p_item_id)) = 0 THEN
    UPDATE user_stats
      SET equipped_cosmetics = COALESCE(equipped_cosmetics, '{}'::jsonb) - p_slot
      WHERE user_id = v_uid
      RETURNING equipped_cosmetics INTO v_current;
    RETURN jsonb_build_object('ok', true, 'equipped', COALESCE(v_current, '{}'::jsonb));
  END IF;

  -- Slot-vs-id sanity. We allow any *_frame pattern; explicit allow-list
  -- would be safer but harder to maintain as the catalog grows.
  IF p_slot = 'frame' AND p_item_id NOT LIKE '%frame%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WRONG_SLOT');
  END IF;

  -- Ownership: check shop (owned_items) and gacha (gacha_owned_items).
  -- gacha_owned_items may not exist in some envs — defensive try.
  SELECT quantity INTO v_owned
  FROM owned_items
  WHERE user_id = v_uid AND item_id = p_item_id;

  IF v_owned IS NULL THEN
    BEGIN
      SELECT quantity INTO v_owned
      FROM gacha_owned_items
      WHERE user_id = v_uid AND item_id = p_item_id;
    EXCEPTION WHEN undefined_table THEN
      v_owned := NULL;
    END;
  END IF;

  IF v_owned IS NULL OR v_owned < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_OWNED');
  END IF;

  -- Persist.
  UPDATE user_stats
    SET equipped_cosmetics = jsonb_set(
      COALESCE(equipped_cosmetics, '{}'::jsonb),
      ARRAY[p_slot],
      to_jsonb(p_item_id),
      true
    )
    WHERE user_id = v_uid
    RETURNING equipped_cosmetics INTO v_current;

  RETURN jsonb_build_object('ok', true, 'equipped', COALESCE(v_current, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION set_equipped_cosmetic(TEXT, TEXT) TO authenticated;
