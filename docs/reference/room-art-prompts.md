# My Room item art: prompts

41 items still need a picture. Nine at a time: each sheet below is ONE message that
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

## A. New props: sheets 8-17

### Sheet 12: Food & treats

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a shallow pan of spicy red tteokbokki rice cakes with a fish cake skewer; a hot stone bowl of bibimbap with colourful vegetables and a fried egg on top; a small plate with a stack of golden hotteok sweet pancakes.
Row 2: a glass jar of yuja citron tea marmalade with a wooden spoon and a steaming cup; a string of orange dried persimmons (gotgam) hanging from a wooden peg; a round strawberry cream cake on a cake stand.
Row 3: a steaming cup of instant noodles with chopsticks resting on the lid, no logo or text; a woven basket of fresh bakery bread: a baguette, a croissant and a soft milk bun; a whole striped watermelon with one juicy slice cut out next to it.
```
Files, row by row: `tteokbokki-pan.png`, `bibimbap-bowl.png`, `hotteok-plate.png`, `yuja-tea.png`, `gotgam-string.png`, `strawberry-cake.png`, `cup-noodle.png`, `bread-basket.png`, `watermelon.png`

## B. Catalogue items still without a picture: sheets 1-7

### Sheet 3: Cafe & kitchen

```
Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a cup of brown sugar bubble tea with a wide straw; a Korean electric rice cooker with steam; a yellow aluminium pot of ramyeon with an egg and green onions.
Row 2: a modern Korean kimchi refrigerator; a bowl of patbingsu shaved ice with red beans and rice cakes; a cute retro mini fridge with stickers.
Row 3: a woven bowl of tangerines with leaves; a small wooden coffee bar cart with mugs and a pour-over kettle; a Korean lunch box with rice, egg roll and side dishes.
```
Files, row by row: `bubble-tea.png`, `rice-cooker.png`, `ramyeon-pot.png`, `kimchi-fridge.png`, `bingsu.png`, `mini-fridge.png`, `tangerine-bowl.png`, `coffee-cart.png`, `dosirak.png`

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

### Older items (one picture each)

| file | description |
|------|-------------|
| `norigae.png` | a traditional Korean norigae ornament with a red tassel and jade piece |
| `jangdok.png` | a traditional Korean onggi earthenware jar (jangdok) with a lid |
| `cat-white.png` | a fluffy white cat sitting and looking forward |
| `koi-pond.png` | a small round indoor koi pond with two orange koi and a lily pad |
| `chuseok-lantern.png` | a round traditional Korean silk lantern (cheongsachorong) in red and blue |
