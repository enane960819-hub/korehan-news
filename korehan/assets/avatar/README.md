# Avatar sprites (character customization — work in progress)

Cut from the owner's ChatGPT sheets (2026-10-29), background removed, trimmed.
Same body template for all: base-<hair>.png (white tee, grey trousers) and
<hair>-<outfit>.png presets. acc-<name>.png are accessories (sheet 1: cap, beanie,
crown, catears, bow, sunglasses). Dropped as awkward on the body: headphones (cover
the face, can't sit behind the hair), round glasses (opaque lenses hide the eyes),
grad cap (angled view on a front-facing head).
Sheet 2: beret, sakura-pin, earmuffs, black-bow, bear-clip, bunny-clip, flower-crown,
heart-glasses, headband, bucket-hat (all kept; the crown's inner background hole was cleared).
Not used by the site yet — the editor is being built.

Accessory anchors tested on base-long (176x368): centre x, y, drawn width, y mode
(bottom = sprite bottom sits at y, centre = sprite centre at y).

| item | x | y | width | mode |
|------|---|---|-------|------|
| cap | 90 | 69 | 150 | bottom |
| beanie | 90 | 66 | 145 | bottom |
| crown | 90 | 36 | 85 | bottom |
| catears | 90 | 49 | 140 | bottom |
| bow | 135 | 35 | 55 | centre |
| sunglasses | 89 | 105 | 108 | centre |
| beret | 92 | 61 | 145 | bottom |
| sakura-pin | 136 | 50 | 60 | centre |
| earmuffs | 90 | 121 | 172 | bottom |
| black-bow | 90 | 20 | 75 | centre |
| bear-clip | 49 | 51 | 44 | centre |
| bunny-clip | 131 | 51 | 44 | centre |
| flower-crown | 90 | 39 | 145 | centre |
| heart-glasses | 89 | 106 | 110 | centre |
| headband | 90 | 95 | 150 | bottom |
| bucket-hat | 90 | 71 | 160 | bottom |

Outfits (all four hair bases): hanbok, uniform, knit, barista, street, cute, summer,
pajamas, halloween = 9 per base, 36 total. long/short hanbok-barista come from the large
per-character sheets; everything else from the 36-figure sheet (cut along seams, upscaled
from ~280 px, so slightly softer). Some looks have headwear drawn in (street cap/beret,
cute cat ears/beret, hanbok flower pin, summer hat/heart glasses, pajama headbands,
witch hat, red hood): the editor should hide head accessories on those.
All body sprites are stored at half the original scale (base-long 176x368).
Room backgrounds: see korehan/assets/room/themes/README.md.

Next: green-hair mask sheet (optional), editor.
