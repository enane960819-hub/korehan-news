# Avatar sprites (character customization — work in progress)

Cut from the owner's ChatGPT sheets (2026-10-29), background removed, trimmed.
Same body template for all: base-<hair>.png (white tee, grey trousers) and
<hair>-<outfit>.png presets. acc-<name>.png are accessories (sheet 1: cap, beanie,
crown, catears, bow, sunglasses). Dropped as awkward on the body: headphones (cover
the face, can't sit behind the hair), round glasses (opaque lenses hide the eyes),
grad cap (angled view on a front-facing head).
Sheet 2: beret, sakura-pin, earmuffs, black-bow, bear-clip, bunny-clip, flower-crown,
heart-glasses, headband, bucket-hat (all kept; the crown's inner background hole was cleared).
Hats removed (owner 2026-10-29: placed-on hats look wrong): cap, beanie, beret, bucket hat,
crown, earmuffs. Only flat head pieces (cat ears, headband, flower crown, bows, clips) and
glasses stay. Outfits with a hat drawn in are fine (drawn together with the head).
Pale fringe between hair strands was repainted with the neighbouring hair colour.
Not used by the site yet — the editor is being built.

Accessory anchors tested on base-long (176x368): centre x, y, drawn width, y mode
(bottom = sprite bottom sits at y, centre = sprite centre at y). Sprites are drawn
feet-aligned, so measure y from the feet (368 - y) for other bases. Hats sit low enough
to cover the top of the head (2026-10-29 fix: they floated above it before).

| item | x | y | width | mode |
|------|---|---|-------|------|
| catears | 90 | 46 | 136 | bottom |
| bow | 135 | 35 | 55 | centre |
| sunglasses | 89 | 105 | 108 | centre |
| sakura-pin | 136 | 50 | 60 | centre |
| black-bow | 90 | 20 | 75 | centre |
| bear-clip | 49 | 51 | 44 | centre |
| bunny-clip | 131 | 51 | 44 | centre |
| flower-crown | 90 | 32 | 140 | centre |
| heart-glasses | 89 | 106 | 110 | centre |
| headband | 90 | 92 | 146 | bottom |

Outfits (all four hair bases): hanbok, uniform, knit, barista, street, cute, summer,
pajamas, halloween = 9 per base, 36 total. long/short hanbok-barista come from the large
per-character sheets; everything else from the 36-figure sheet (cut along seams, upscaled
from ~280 px, so slightly softer). Some looks have headwear drawn in (street cap/beret,
cute cat ears/beret, hanbok flower pin, summer hat/heart glasses, pajama headbands,
witch hat, red hood): the editor should hide head accessories on those.
All body sprites are stored at half the original scale (base-long 176x368).
Room backgrounds: see korehan/assets/room/themes/README.md.

Next: green-hair mask sheet (optional), editor.
