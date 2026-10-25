# Storybook (picture-book reader) — feature guide

An interactive, paginated picture-book mode for stories. Each page shows a
full illustration with tappable **pins** (people / objects / emotions /
places); tapping a pin reveals the related Korean **words, expressions, and
feelings**, with per-word Save.

## Pieces

| Layer | File | Role |
|---|---|---|
| Reader UI | `korehan/korehan-stories.html` | `#sb-overlay` + `sbOpen()` … paginated viewer, pins, popups |
| Image gen | `supabase/functions/story-illustrate/index.ts` | gpt-image-1 → Storage → public URL (admin only) |
| Generator | `korehan/korehan-x9f4k2m7.html` | `generateStorybook(storyId)` + "📖 Storybook 생성" button |

## Data model

Pages live inside `stories_data.data.pages` (no migration — `data` is a free
JSON blob that the site already spreads onto each story object):

```jsonc
pages: [
  {
    "text_ko": "할머니가 드디어 스마트폰을 사셨다.",  // verbatim page text
    "text_en": "Grandma finally bought a smartphone.",
    "image_url": "https://…/story-illustrations/<id>/0-<ts>.png",
    "image_prompt": "An elderly Korean woman smiling at a new smartphone…",
    "hotspots": [
      {
        "x": 0.42, "y": 0.61,                       // normalized center (0–1)
        "kind": "person",                            // person|object|emotion|place|action|animal|food
        "label_ko": "할머니", "label_en": "grandmother",
        "vocab":       [{ "ko": "할머니", "rom": "halmeoni", "en": "grandmother" }],
        "expressions": [{ "ko": "정신이 없다", "en": "to be hectic" }],
        "emotions":    [{ "ko": "설렘", "en": "excitement" }]
      }
    ]
  }
]
```

The reader (`_sbBuildPages`) reads this shape directly. When a story has no
`pages` yet, `_sbDerivePages()` builds a placeholder book from the body +
thumbnail + vocab so the flow is testable — but the **entry button only
appears for stories that have real `pages`**.

## Generation pipeline (`generateStorybook`)

1. **PLAN** — Claude (sonnet) splits the body into pages with verbatim
   `text_ko`, `text_en`, an English `image_prompt`, and `hotspots[]` (the
   learning items, no coordinates yet).
2. **IMAGE** — per page, calls `story-illustrate` (gpt-image-1) → uploads to
   the `story-illustrations` bucket → `image_url`.
3. **LOCATE** — Claude vision is shown the generated image + the hotspot
   labels and returns normalized `x`/`y` for each; unplaced pins fall back
   to preset positions.
4. **SAVE** — writes `pages[]` into `stories_data.data`.

## One-time provisioning (owner)

1. `app_settings` row: `key='openai_key'`, `value=<OpenAI API key>`.
2. Storage bucket `story-illustrations` (public read).
3. `supabase functions deploy story-illustrate`.

## Notes / future

- Cost: one gpt-image-1 generation + one vision call per page. It's an admin
  batch action, so latency (1–3 min/story) is acceptable.
- Guests: the storybook is launched from inside the reader, which already
  applies the guest gate; the storybook itself is not separately gated.
- Re-running generation overwrites `pages` (images are upserted by path).
