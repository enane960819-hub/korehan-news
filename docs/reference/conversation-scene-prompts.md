# Conversation scene pictures: prompts

Owner picked option B (2026-10-30): every conversation card shows a small pixel-art scene
instead of the speakers' initials. 18 scenes cover all situations; each conversation picks
one by its title / situation (a conversation can also name its scene in the admin).

**Live (2026-10-31):** both sheets are drawn and cut to `korehan/assets/convo/<scene>.webp`
(200x200). `khConvScene()` in `korehan-shared.js` picks the scene: `data.scene` (admin "Card
picture" field) first, then keyword rules on the title / situation (`KH_CONV_SCENE_RULES`), then
the category default. Used by the Conversations list, the "Next" card and the Home rail. A new
scene = new picture + add its name to `KH_CONV_SCENES` (and a rule if it should be picked
automatically).

Two sheets, nine scenes each, same style chat as the room items. Send the pictures back
with their sheet number; they are cut like room items (background removal, trim) into
`korehan/assets/convo/`.

## 1. Style (paste once at the start of a chat)

```
I'm making small scene pictures for a cozy pixel-art app. Style for EVERY image: soft pixel-art (chunky visible pixels, smooth shading), warm cozy colours, each scene is a tiny diorama: a small square piece of floor or ground seen from slightly above, with the scene's furniture and objects standing on it, floating on a plain pure white background. No people, no faces, no text, no logos, no floor shadow. Match the style of a small yellow pixel-art two-seat sofa.
```

## 2. One message per sheet

If scenes touch each other or a cell is empty, reply:
`Same sheet, but leave clear white space between all nine scenes and keep each one inside its own cell.`
If one scene comes out wrong, redraw only that one: `Draw ONE scene, centred, nothing else: <description>`.

### Scene sheet 1: home, food, work

```
Make ONE square image: a 3x3 grid of nine separate tiny dioramas, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a home kitchen table set for breakfast with rice bowls, soup, a fried egg and chopsticks; a smartphone standing on a small side table, its screen showing a call with a green phone icon, a cup of tea beside it; a cafe counter with an espresso machine, two takeaway coffee cups and a small menu board with no text.
Row 2: an office desk with a laptop, a stack of documents, a mug and a desk plant; a restaurant table with a round Korean barbecue grill, sizzling meat, side dishes and two green soju-style bottles with no labels; a cozy living room corner with a sofa, a low table with snacks and a TV showing a drama scene.
Row 3: a classroom corner with a wooden school desk, a chair, open textbooks and a green chalkboard with no writing; a pharmacy counter with medicine boxes, a thermometer and a cup of warm water; a convenience store corner with a snack shelf, a drinks fridge and a small counter, no logos or text.
```
Files, row by row: `home-meal.png`, `phone-call.png`, `cafe.png`, `office.png`, `bbq-dinner.png`, `living-room.png`, `classroom.png`, `pharmacy.png`, `convenience-store.png`

### Scene sheet 2: going out, travel, life events

```
Make ONE square image: a 3x3 grid of nine separate tiny dioramas, evenly spaced, each centred in its own cell with plenty of empty white space around it, nothing touching, no grid lines, no labels.
Row 1: a train station platform with a sleek white high-speed train, a bench and a suitcase; an airport gate corner with a big window showing a plane, a suitcase and a passport on a seat; a clothing shop corner with a rack of jackets, a mirror and two shopping bags.
Row 2: a riverside park bench at sunset with a small tree, a bicycle and two convenience-store ramen cups on the bench; two red cinema seats with a big popcorn bucket and two drinks; a karaoke room corner with a sofa, a microphone on the table, a tambourine and a glowing screen with no text.
Row 3: a hair salon chair in front of a big mirror with scissors, a comb and a hair dryer on a shelf; a cozy table for two with two coffee cups, a small cake and a pink envelope with a heart seal; a front door with a stack of cardboard moving boxes and a potted plant waiting outside.
```
Files, row by row: `train-station.png`, `airport.png`, `clothing-shop.png`, `river-park.png`, `cinema.png`, `karaoke.png`, `hair-salon.png`, `date-table.png`, `moving-day.png`
