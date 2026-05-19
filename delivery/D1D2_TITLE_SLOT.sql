-- =============================================================================
-- Item 1D (cont.) — title slot for equipped_cosmetics
-- =============================================================================
-- Extends the cosmetic slot system from D1D_EQUIPPED_COSMETICS.sql to also
-- accept 'title'. Same ownership rules: caller must own the item in either
-- owned_items (shop) or gacha_owned_items (gacha). Idempotent.
--
-- The frame slot RPC was hardcoded to only allow 'frame'; this replaces it
-- with a 2-slot version. Existing equipped_cosmetics rows (only 'frame'
-- keys) are unaffected.

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

  IF p_slot NOT IN ('frame','title') THEN
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

  -- Slot-vs-id sanity. Allow-list-style pattern match so users can't equip
  -- a frame slug into the title slot or vice versa.
  IF p_slot = 'frame' AND p_item_id NOT LIKE '%frame%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WRONG_SLOT');
  END IF;
  IF p_slot = 'title' AND p_item_id NOT LIKE '%title%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'WRONG_SLOT');
  END IF;

  -- Ownership: check shop (owned_items) and gacha (gacha_owned_items).
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

CREATE INDEX IF NOT EXISTS user_stats_equipped_title_idx
  ON user_stats ((equipped_cosmetics->>'title'))
  WHERE equipped_cosmetics ? 'title';
