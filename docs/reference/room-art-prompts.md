# My Room item art: prompts

Two sets: (A) the 29 catalogue items that still have no picture (one image each), and
(B) 63 new items in 7 sheets of 9: one picture per sheet, a 3x3 grid.

Cut sheets and clean single images with `scripts/room-art/process.py` (background removal,
trim, 400x400). Pictures go to `korehan/assets/room/`; items appear in the shop automatically
once their file exists.

## Style (paste once per chat)

```
I'm making item sprites for a cozy pixel-art room game. Style for EVERY image: soft pixel-art (chunky visible pixels, smooth shading), front-facing view, warm cozy colours, no text, no floor shadow, plain pure white background. Match the style of a small yellow pixel-art two-seat sofa.
```

## (B) New items — one message per sheet

Paste: *"Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in
its own cell with empty white space around it, no grid lines, no labels. Row 1: …, Row 2: …, Row 3: …"*

Then run: `python3 scripts/room-art/process.py --grid <sheet.png> <sheet number>`

### Sheet 1: Study corner
- Row 1: a small adjustable study desk lamp, warm light; a vintage desk globe on a wooden stand; a neat stack of five colourful books with a bookmark
- Row 2: a ceramic cup full of pencils and pens; a wall calendar with a few days circled in red; a framed poster of the Korean alphabet chart (consonants and vowels as simple shapes, no readable text)
- Row 3: a cute round twin-bell alarm clock; a pastel school backpack with keychains; a comfy rolling study chair
- Files (row by row): `desk-lamp.png`, `globe.png`, `book-stack.png`, `pencil-cup.png`, `wall-calendar.png`, `hangul-poster.png`, `alarm-clock.png`, `school-bag.png`, `study-chair.png`

### Sheet 2: Korean tradition
- Row 1: a traditional Korean gayageum zither lying on a stand; a traditional Korean janggu hourglass drum with sticks; a smiling Korean hahoe wooden mask hanging on the wall
- Row 2: an open traditional Korean folding fan with plum blossoms; a hanging calligraphy scroll with brush strokes (abstract, no readable text); a glowing Korean hanji paper lamp with wooden frame
- Row 3: a yunnori game set: four wooden sticks and a cloth board; a low Korean wooden tea table with a celadon tea set; a traditional hanok lattice paper window with soft light
- Files (row by row): `gayageum.png`, `janggu.png`, `hahoe-mask.png`, `buchae-fan.png`, `calligraphy-scroll.png`, `hanji-lamp.png`, `yut-set.png`, `tea-table.png`, `hanok-window.png`

### Sheet 3: Cafe & kitchen
- Row 1: a cup of brown sugar bubble tea with a wide straw; a Korean electric rice cooker with steam; a yellow aluminium pot of ramyeon with an egg and green onions
- Row 2: a modern Korean kimchi refrigerator; a bowl of patbingsu shaved ice with red beans and rice cakes; a cute retro mini fridge with stickers
- Row 3: a woven bowl of tangerines with leaves; a small wooden coffee bar cart with mugs and a pour-over kettle; a Korean lunch box with rice, egg roll and side dishes
- Files (row by row): `bubble-tea.png`, `rice-cooker.png`, `ramyeon-pot.png`, `kimchi-fridge.png`, `bingsu.png`, `mini-fridge.png`, `tangerine-bowl.png`, `coffee-cart.png`, `dosirak.png`

### Sheet 4: K-culture & hobbies
- Row 1: a colourful concert poster with stage lights (no people, no text); a glowing fan light stick; an acoustic guitar leaning on a stand
- Row 2: a digital piano keyboard on a stand; a noraebang karaoke microphone on a stand with sparkles; a handheld game console and controller on a small cushion
- Row 3: a retro film camera; a skateboard with colourful stickers; a string of instant photos with clips and fairy lights on a wall
- Files (row by row): `kpop-poster.png`, `light-stick.png`, `guitar.png`, `keyboard-piano.png`, `karaoke-mic.png`, `game-console.png`, `film-camera.png`, `skateboard.png`, `photo-wall.png`

### Sheet 5: Cozy furniture
- Row 1: a cozy single bed with a quilted blanket and pillows; a wooden wardrobe with two doors; a round fluffy rug with a pattern, seen from a slight angle
- Row 2: two stacked Korean floor cushions (bangseok); a small round wooden coffee table with a mug; a TV on a low wooden stand
- Row 3: a window showing the Seoul night skyline with N Seoul Tower; a window with raindrops and a cloudy sky; a round minimalist wall clock
- Files (row by row): `single-bed.png`, `wardrobe.png`, `round-rug.png`, `floor-cushions.png`, `coffee-table.png`, `tv-stand.png`, `window-seoul.png`, `window-rain.png`, `wall-clock.png`

### Sheet 6: Pets & plants
- Row 1: a chubby hamster holding a sunflower seed; a smiling shiba inu sitting; a fluffy white bunny with floppy ears
- Row 2: a colourful parrot on a perch; a small glass tank with a turtle and a rock; a round goldfish bowl with two goldfish
- Row 3: a big monstera plant in a woven basket; a small pine bonsai on a wooden stand; three tiny cacti in matching pots
- Files (row by row): `hamster.png`, `shiba-dog.png`, `bunny.png`, `parrot.png`, `turtle-tank.png`, `goldfish-bowl.png`, `plant-monstera.png`, `bonsai.png`, `cactus-trio.png`

### Sheet 7: Seasons & holidays
- Row 1: a cheerful snowman with a red scarf; a Korean new-year lucky pouch (bokjumeoni) in red silk; a bowl of tteokguk rice cake soup
- Row 2: a plate of colourful songpyeon rice cakes on pine needles; a pot of red carnations with a ribbon; a vase with blooming cherry blossom branches
- Row 3: a retro electric fan; a glass jar with red and orange maple leaves; a heart-shaped box of chocolates with a bow
- Files (row by row): `snowman.png`, `bokjumeoni.png`, `tteokguk.png`, `songpyeon.png`, `carnation-pot.png`, `cherry-branch.png`, `summer-fan.png`, `maple-jar.png`, `choco-box.png`

## (A) Existing items without a picture — one message each

