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

Accessory anchors tested on base-long (352x736): centre x, y, drawn width, y mode
(bottom = sprite bottom sits at y, centre = sprite centre at y).

| item | x | y | width | mode |
|------|---|---|-------|------|
| cap | 180 | 138 | 300 | bottom |
| beanie | 180 | 132 | 290 | bottom |
| crown | 180 | 72 | 170 | bottom |
| catears | 180 | 98 | 280 | bottom |
| bow | 270 | 70 | 110 | centre |
| sunglasses | 178 | 210 | 215 | centre |
| beret | 185 | 122 | 290 | bottom |
| sakura-pin | 272 | 100 | 120 | centre |
| earmuffs | 180 | 242 | 345 | bottom |
| black-bow | 180 | 40 | 150 | centre |
| bear-clip | 98 | 102 | 88 | centre |
| bunny-clip | 262 | 102 | 88 | centre |
| flower-crown | 180 | 78 | 290 | centre |
| heart-glasses | 178 | 212 | 220 | centre |
| headband | 180 | 190 | 300 | bottom |
| bucket-hat | 180 | 142 | 320 | bottom |

Outfits done: long-*, short-* (hanbok, uniform, knit, barista).
Room: korehan/assets/room/theme-default.png is the new default room (square, baseboard
60-64% down, floor below); every room theme copies its layout. Not wired yet.

Next: outfits for bob/curly, green-hair mask sheet.
