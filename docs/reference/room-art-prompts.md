# My Room item art: prompts

158 items still need a picture. Nine at a time: each sheet below is ONE message that
makes a 3x3 picture of nine items. Send the sheet pictures back with their sheet number;
they are cut with `python3 scripts/room-art/process.py --grid <picture> <sheet number>`
(background removal, trim, 400x400) into `korehan/assets/room/`. An item shows up in the shop
as soon as its picture exists.

## 1. Style (paste once at the start of a chat)

```
I'm making item sprites for a cozy pixel-art room game. Style for EVERY image: soft pixel-art (chunky visible pixels, smooth shading), front-facing view, warm cozy colours, no text, no floor shadow, plain pure white background. Match the style of a small yellow pixel-art two-seat sofa.
```

## 2. One message per sheet

If items touch each other or a cell is empty, reply:
`Same sheet, but leave clear white space between all nine items and keep each one inside its own cell.`
If one item comes out wrong, redraw only that one: `Draw ONE item, centred, nothing else: <description>`.

## A. New props: sheets 8-17 (90 items)

### Sheet 8: Study desk props

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: an open notebook with neat handwritten Korean letters ㄱ ㄴ ㄷ and a pencil on it; a small wooden box full of colourful flashcards with a few sticking out; a wooden hourglass sand timer with pink sand.
Row 2: a cluster of pastel sticky notes stuck in a grid, with doodles but no readable text; an open laptop covered in cute stickers, screen glowing softly; over-ear headphones resting on a small wooden stand.
Row 3: a tablet on a little stand with a stylus pen next to it; a small shiny gold trophy cup on a wooden base; a wall hanger with three ribbons and gold, silver and bronze medals.
```
Files, row by row: `hangul-notebook.png`, `flashcard-box.png`, `sand-timer.png`, `sticky-notes.png`, `study-laptop.png`, `headphone-stand.png`, `tablet-pen.png`, `trophy.png`, `medal-rack.png`

### Sheet 9: Korean daily life

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a small round Korean banana milk bottle, plain yellow with no logo; a woven basket full of colourful Korean snack bags with no logos or text; a dalgona honeycomb candy with a star shape on a metal tray with a small ladle.
Row 2: three golden fish-shaped bungeoppang pastries in a paper bag; a black lacquer Korean najeon jewellery box inlaid with shimmering mother-of-pearl flowers; a gift wrapped in colourful Korean patchwork bojagi cloth, tied in a knot on top.
Row 3: a small figurine of N Seoul Tower on a round base; a small cute stone statue of a haetae, the Korean lion guardian, sitting; a small model of a Korean hanok house with a curved tiled roof and warm lit windows.
```
Files, row by row: `banana-milk.png`, `snack-basket.png`, `dalgona-set.png`, `bungeoppang.png`, `najeon-box.png`, `bojagi-gift.png`, `namsan-mini.png`, `haetae-statue.png`, `mini-hanok.png`

### Sheet 10: Cozy decor

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: three lit pillar candles of different heights on a small tray; a snow globe with a tiny hanok house inside and snowflakes; an open wooden music box with a tiny dancer.
Row 2: a ceramic vase with dried pampas grass and small dried flowers; a floating wooden wall shelf with small potted plants and a few books; a cream macrame wall hanging on a wooden stick.
Row 3: a soft brown teddy bear sitting with a red bow; two small framed photos standing side by side, showing a beach and mountains; a glowing pink and blue crescent moon neon sign.
```
Files, row by row: `candle-trio.png`, `snow-globe.png`, `music-box.png`, `dried-flowers.png`, `wall-shelf.png`, `macrame.png`, `teddy-bear.png`, `framed-photo.png`, `neon-moon.png`

### Sheet 11: Cute plushies

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a cute round plush toy of a Korean tiger, smiling; a cute plush toy of a black and white Korean magpie (kkachi); a cute friendly plush toy of a Korean dokkaebi goblin with one small horn and a club.
Row 2: a white rabbit plush pounding rice cakes with a tiny mallet, sitting on a crescent moon; a round cushion that looks like a slice of gimbap; a cute orange persimmon plush with a green leaf hat and a smile.
Row 3: a squishy white rice cake (tteok) plush with a happy face; a chubby penguin plush wearing a little knitted scarf; a round cat-shaped floor cushion, sleeping cat face.
```
Files, row by row: `tiger-plush.png`, `magpie-plush.png`, `dokkaebi-plush.png`, `moon-rabbit.png`, `gimbap-pillow.png`, `persimmon-plush.png`, `tteok-plush.png`, `penguin-plush.png`, `cat-cushion.png`

### Sheet 12: Food & treats

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a shallow pan of spicy red tteokbokki rice cakes with a fish cake skewer; a hot stone bowl of bibimbap with colourful vegetables and a fried egg on top; a small plate with a stack of golden hotteok sweet pancakes.
Row 2: a glass jar of yuja citron tea marmalade with a wooden spoon and a steaming cup; a string of orange dried persimmons (gotgam) hanging from a wooden peg; a round strawberry cream cake on a cake stand.
Row 3: a steaming cup of instant noodles with chopsticks resting on the lid, no logo or text; a woven basket of fresh bakery bread: a baguette, a croissant and a soft milk bun; a whole striped watermelon with one juicy slice cut out next to it.
```
Files, row by row: `tteokbokki-pan.png`, `bibimbap-bowl.png`, `hotteok-plate.png`, `yuja-tea.png`, `gotgam-string.png`, `strawberry-cake.png`, `cup-noodle.png`, `bread-basket.png`, `watermelon.png`

### Sheet 13: Hobbies

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a small wooden ukulele leaning upright; a retro portable cassette player with orange-cushion headphones and a cassette; a wooden easel holding a small painting of mountains, with a palette and brushes.
Row 2: a basket of colourful yarn balls with knitting needles and a half-knitted scarf; a half-finished jigsaw puzzle of a flower field on a board with loose pieces; a wooden baduk (Go) board with black and white stones and two stone bowls.
Row 3: a brass telescope on a wooden tripod pointing up; a rolled lavender yoga mat with two small dumbbells and a water bottle; two crossed badminton rackets with a white shuttlecock.
```
Files, row by row: `ukulele.png`, `cassette-player.png`, `easel-painting.png`, `knitting-basket.png`, `jigsaw-puzzle.png`, `baduk-board.png`, `telescope.png`, `yoga-mat.png`, `badminton-set.png`

### Sheet 14: Wall decor

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a framed Korean folk painting (minhwa) of a funny tiger and a magpie in a pine tree; a framed oil painting of yellow sunflowers in a vase; a string of colourful triangle bunting flags hanging in a gentle curve.
Row 2: a dreamcatcher with soft feathers and beads; a wooden frame with pressed wildflowers behind glass; a wall hanging of golden moon phases on a string, from crescent to full.
Row 3: a long green ivy garland draped in a loose curve with a few tiny white flowers; a wooden panel painted with colourful Korean dancheong temple patterns; a framed certificate with a gold seal and a ribbon, lines instead of readable text.
```
Files, row by row: `minhwa-tiger.png`, `sunflower-painting.png`, `bunting-flags.png`, `dreamcatcher.png`, `pressed-flowers.png`, `moon-phases.png`, `ivy-garland.png`, `dancheong-panel.png`, `framed-certificate.png`

### Sheet 15: Small furniture

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a small round wooden side table with a little lamp and a book; a three-tier wooden plant stand with small potted plants; three stacked woven storage baskets with fabric liners.
Row 2: a ceramic umbrella stand with a clear umbrella and a yellow umbrella; a small wooden shoe rack with three pairs of colourful sneakers; a neat stack of folded Korean floor bedding (yo and ibul) with a pillow on top.
Row 3: a small retro electric heater glowing warm orange; a leaning wooden ladder shelf with books, a plant and a candle; a wooden rocking chair with a knitted blanket over the back.
```
Files, row by row: `side-table.png`, `plant-stand.png`, `storage-baskets.png`, `umbrella-stand.png`, `sneaker-rack.png`, `folded-ibul.png`, `mini-heater.png`, `ladder-shelf.png`, `rocking-chair.png`

### Sheet 16: Seasons & events 2

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a red and white Christmas stocking with a small gift peeking out; a pile of three wrapped gift boxes with bows in different colours; an open box of chocolate-dipped biscuit sticks with a red ribbon, no logo or text.
Row 2: a cute smiling ghost-shaped paper lantern glowing softly; a colourful paper pinwheel on a stick in a small pot; a pink Korean lotus lantern (yeondeung) glowing from inside.
Row 3: a two-layer birthday cake with lit candles and sprinkles; a striped colourful beach ball; a big wrapped bouquet of roses and baby's breath with a satin ribbon.
```
Files, row by row: `xmas-stocking.png`, `gift-pile.png`, `choco-sticks.png`, `ghost-lantern.png`, `pinwheel.png`, `lotus-lantern.png`, `birthday-cake.png`, `beach-ball.png`, `graduation-bouquet.png`

### Sheet 17: Animal friends

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a cute white Korean Jindo dog sitting with curled tail; a calm capybara sitting with a small orange on its head; a tiny round hedgehog curled on a small cushion.
Row 2: a fluffy red panda sitting and holding its striped tail; a fluffy yellow duckling standing; a cute otter floating on its back holding a pebble.
Row 3: a round little sparrow sitting on a wooden perch; a small glass tank with a pink smiling axolotl and green plants; a fluffy cream alpaca with a small scarf.
```
Files, row by row: `jindo-dog.png`, `capybara.png`, `hedgehog-pet.png`, `red-panda.png`, `duckling.png`, `otter.png`, `sparrow-perch.png`, `axolotl-tank.png`, `alpaca.png`

## B. Catalogue items still without a picture: sheets 1-7

### Sheet 1: Study corner

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a small adjustable study desk lamp, warm light; a vintage desk globe on a wooden stand; a neat stack of five colourful books with a bookmark.
Row 2: a ceramic cup full of pencils and pens; a wall calendar with a few days circled in red; a framed poster of the Korean alphabet chart (consonants and vowels as simple shapes, no readable text).
Row 3: a cute round twin-bell alarm clock; a pastel school backpack with keychains; a comfy rolling study chair.
```
Files, row by row: `desk-lamp.png`, `globe.png`, `book-stack.png`, `pencil-cup.png`, `wall-calendar.png`, `hangul-poster.png`, `alarm-clock.png`, `school-bag.png`, `study-chair.png`

### Sheet 2: Korean tradition

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a traditional Korean gayageum zither lying on a stand; a traditional Korean janggu hourglass drum with sticks; a smiling Korean hahoe wooden mask hanging on the wall.
Row 2: an open traditional Korean folding fan with plum blossoms; a hanging calligraphy scroll with brush strokes (abstract, no readable text); a glowing Korean hanji paper lamp with wooden frame.
Row 3: a yunnori game set: four wooden sticks and a cloth board; a low Korean wooden tea table with a celadon tea set; a traditional hanok lattice paper window with soft light.
```
Files, row by row: `gayageum.png`, `janggu.png`, `hahoe-mask.png`, `buchae-fan.png`, `calligraphy-scroll.png`, `hanji-lamp.png`, `yut-set.png`, `tea-table.png`, `hanok-window.png`

### Sheet 3: Cafe & kitchen

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a cup of brown sugar bubble tea with a wide straw; a Korean electric rice cooker with steam; a yellow aluminium pot of ramyeon with an egg and green onions.
Row 2: a modern Korean kimchi refrigerator; a bowl of patbingsu shaved ice with red beans and rice cakes; a cute retro mini fridge with stickers.
Row 3: a woven bowl of tangerines with leaves; a small wooden coffee bar cart with mugs and a pour-over kettle; a Korean lunch box with rice, egg roll and side dishes.
```
Files, row by row: `bubble-tea.png`, `rice-cooker.png`, `ramyeon-pot.png`, `kimchi-fridge.png`, `bingsu.png`, `mini-fridge.png`, `tangerine-bowl.png`, `coffee-cart.png`, `dosirak.png`

### Sheet 4: K-culture & hobbies

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a colourful concert poster with stage lights (no people, no text); a glowing fan light stick; an acoustic guitar leaning on a stand.
Row 2: a digital piano keyboard on a stand; a noraebang karaoke microphone on a stand with sparkles; a handheld game console and controller on a small cushion.
Row 3: a retro film camera; a skateboard with colourful stickers; a string of instant photos with clips and fairy lights on a wall.
```
Files, row by row: `kpop-poster.png`, `light-stick.png`, `guitar.png`, `keyboard-piano.png`, `karaoke-mic.png`, `game-console.png`, `film-camera.png`, `skateboard.png`, `photo-wall.png`

### Sheet 5: Cozy furniture

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a cozy single bed with a quilted blanket and pillows; a wooden wardrobe with two doors; a round fluffy rug with a pattern, seen from a slight angle.
Row 2: two stacked Korean floor cushions (bangseok); a small round wooden coffee table with a mug; a TV on a low wooden stand.
Row 3: a window showing the Seoul night skyline with N Seoul Tower; a window with raindrops and a cloudy sky; a round minimalist wall clock.
```
Files, row by row: `single-bed.png`, `wardrobe.png`, `round-rug.png`, `floor-cushions.png`, `coffee-table.png`, `tv-stand.png`, `window-seoul.png`, `window-rain.png`, `wall-clock.png`

### Sheet 6: Pets & plants

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a chubby hamster holding a sunflower seed; a smiling shiba inu sitting; a fluffy white bunny with floppy ears.
Row 2: a colourful parrot on a perch; a small glass tank with a turtle and a rock; a round goldfish bowl with two goldfish.
Row 3: a big monstera plant in a woven basket; a small pine bonsai on a wooden stand; three tiny cacti in matching pots.
```
Files, row by row: `hamster.png`, `shiba-dog.png`, `bunny.png`, `parrot.png`, `turtle-tank.png`, `goldfish-bowl.png`, `plant-monstera.png`, `bonsai.png`, `cactus-trio.png`

### Sheet 7: Seasons & holidays

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a cheerful snowman with a red scarf; a Korean new-year lucky pouch (bokjumeoni) in red silk; a bowl of tteokguk rice cake soup.
Row 2: a plate of colourful songpyeon rice cakes on pine needles; a pot of red carnations with a ribbon; a vase with blooming cherry blossom branches.
Row 3: a retro electric fan; a glass jar with red and orange maple leaves; a heart-shaped box of chocolates with a bow.
```
Files, row by row: `snowman.png`, `bokjumeoni.png`, `tteokguk.png`, `songpyeon.png`, `carnation-pot.png`, `cherry-branch.png`, `summer-fan.png`, `maple-jar.png`, `choco-box.png`

### Older items (one picture each)

| file | description |
|------|-------------|
| `norigae.png` | a traditional Korean norigae ornament with a red tassel and jade piece |
| `jangdok.png` | a traditional Korean onggi earthenware jar (jangdok) with a lid |
| `cat-white.png` | a fluffy white cat sitting and looking forward |
| `koi-pond.png` | a small round indoor koi pond with two orange koi and a lily pad |
| `chuseok-lantern.png` | a round traditional Korean silk lantern (cheongsachorong) in red and blue |
