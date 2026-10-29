"""New My Room items (owner, 2026-10-29: "about 100 items").

Each SHEET is one picture made in an image tool as a 3x3 grid (row by row,
left to right). `process.py --grid` cuts a sheet into the nine files named
here. `python3 scripts/room-art/catalog.py` rewrites the prompt guide
(docs/reference/room-art-prompts.md) and the catalog migration.

Item = (id, name, category, price_nyang, base_size, effect, prompt)
Prices follow the tiers in 20261029_my_room_ownership_prices.sql
(starter 60–140, low 170–310, mid 340–620, upper 660–960).
"""
import os

SHEETS = [
  ("Study corner", [
    ("desk_lamp", "Desk Lamp", "deco", 140, 100, "glow_warm", "a small adjustable study desk lamp, warm light"),
    ("globe", "Desk Globe", "deco", 220, 110, "none", "a vintage desk globe on a wooden stand"),
    ("book_stack", "Book Stack", "deco", 120, 100, "none", "a neat stack of five colourful books with a bookmark"),
    ("pencil_cup", "Pencil Cup", "deco", 60, 70, "none", "a ceramic cup full of pencils and pens"),
    ("wall_calendar", "Wall Calendar", "deco", 100, 110, "none", "a wall calendar with a few days circled in red"),
    ("hangul_poster", "Hangul Poster", "deco", 170, 130, "none", "a framed poster of the Korean alphabet chart (consonants and vowels as simple shapes, no readable text)"),
    ("alarm_clock", "Alarm Clock", "deco", 80, 80, "none", "a cute round twin-bell alarm clock"),
    ("school_bag", "School Backpack", "deco", 140, 100, "none", "a pastel school backpack with keychains"),
    ("study_chair", "Study Chair", "furniture", 260, 130, "none", "a comfy rolling study chair"),
  ]),
  ("Korean tradition", [
    ("gayageum", "Gayageum", "deco", 540, 170, "none", "a traditional Korean gayageum zither lying on a stand"),
    ("janggu", "Janggu Drum", "deco", 340, 120, "none", "a traditional Korean janggu hourglass drum with sticks"),
    ("hahoe_mask", "Hahoe Mask", "deco", 290, 100, "none", "a smiling Korean hahoe wooden mask hanging on the wall"),
    ("buchae_fan", "Buchae Fan", "deco", 170, 110, "none", "an open traditional Korean folding fan with plum blossoms"),
    ("calligraphy_scroll", "Calligraphy Scroll", "deco", 240, 130, "none", "a hanging calligraphy scroll with brush strokes (abstract, no readable text)"),
    ("hanji_lamp", "Hanji Lamp", "deco", 220, 110, "glow_warm", "a glowing Korean hanji paper lamp with wooden frame"),
    ("yut_set", "Yut Set", "deco", 120, 100, "none", "a yunnori game set: four wooden sticks and a cloth board"),
    ("tea_table", "Dabang Tea Table", "furniture", 460, 150, "none", "a low Korean wooden tea table with a celadon tea set"),
    ("hanok_window", "Hanok Window", "deco", 380, 150, "none", "a traditional hanok lattice paper window with soft light"),
  ]),
  ("Cafe & kitchen", [
    ("bubble_tea", "Bubble Tea", "deco", 60, 70, "none", "a cup of brown sugar bubble tea with a wide straw"),
    ("rice_cooker", "Rice Cooker", "deco", 220, 100, "none", "a Korean electric rice cooker with steam"),
    ("ramyeon_pot", "Ramyeon Pot", "deco", 140, 100, "none", "a yellow aluminium pot of ramyeon with an egg and green onions"),
    ("kimchi_fridge", "Kimchi Fridge", "furniture", 580, 160, "none", "a modern Korean kimchi refrigerator"),
    ("bingsu", "Bingsu", "deco", 100, 80, "none", "a bowl of patbingsu shaved ice with red beans and rice cakes"),
    ("mini_fridge", "Mini Fridge", "furniture", 380, 130, "none", "a cute retro mini fridge with stickers"),
    ("tangerine_bowl", "Tangerine Bowl", "deco", 80, 80, "none", "a woven bowl of tangerines with leaves"),
    ("coffee_cart", "Coffee Cart", "furniture", 460, 150, "none", "a small wooden coffee bar cart with mugs and a pour-over kettle"),
    ("dosirak", "Dosirak", "deco", 100, 80, "none", "a Korean lunch box with rice, egg roll and side dishes"),
  ]),
  ("K-culture & hobbies", [
    ("kpop_poster", "K-pop Poster", "deco", 170, 130, "none", "a colourful concert poster with stage lights (no people, no text)"),
    ("light_stick", "Light Stick", "deco", 140, 90, "glow_neon", "a glowing fan light stick"),
    ("guitar", "Acoustic Guitar", "deco", 380, 150, "none", "an acoustic guitar leaning on a stand"),
    ("keyboard_piano", "Keyboard Piano", "furniture", 620, 170, "none", "a digital piano keyboard on a stand"),
    ("karaoke_mic", "Karaoke Mic", "deco", 240, 130, "sparkle", "a noraebang karaoke microphone on a stand with sparkles"),
    ("game_console", "Game Console", "deco", 460, 120, "none", "a handheld game console and controller on a small cushion"),
    ("film_camera", "Film Camera", "deco", 260, 90, "none", "a retro film camera"),
    ("skateboard", "Skateboard", "deco", 220, 120, "none", "a skateboard with colourful stickers"),
    ("photo_wall", "Photo Wall", "deco", 290, 140, "none", "a string of instant photos with clips and fairy lights on a wall"),
  ]),
  ("Cozy furniture", [
    ("single_bed", "Cozy Bed", "furniture", 720, 200, "none", "a cozy single bed with a quilted blanket and pillows"),
    ("wardrobe", "Wardrobe", "furniture", 600, 180, "none", "a wooden wardrobe with two doors"),
    ("round_rug", "Round Rug", "furniture", 260, 170, "none", "a round fluffy rug with a pattern, seen from a slight angle"),
    ("floor_cushions", "Floor Cushions", "furniture", 190, 120, "none", "two stacked Korean floor cushions (bangseok)"),
    ("coffee_table", "Coffee Table", "furniture", 340, 140, "none", "a small round wooden coffee table with a mug"),
    ("tv_stand", "TV Stand", "furniture", 660, 180, "none", "a TV on a low wooden stand"),
    ("window_seoul", "Seoul Night Window", "deco", 540, 170, "glow_warm", "a window showing the Seoul night skyline with N Seoul Tower"),
    ("window_rain", "Rainy Window", "deco", 460, 170, "none", "a window with raindrops and a cloudy sky"),
    ("wall_clock", "Wall Clock", "deco", 120, 100, "none", "a round minimalist wall clock"),
  ]),
  ("Pets & plants", [
    ("hamster", "Hamster", "pet", 240, 70, "none", "a chubby hamster holding a sunflower seed"),
    ("shiba_dog", "Shiba Inu", "pet", 460, 120, "none", "a smiling shiba inu sitting"),
    ("bunny", "Bunny", "pet", 340, 90, "none", "a fluffy white bunny with floppy ears"),
    ("parrot", "Parrot", "pet", 380, 100, "none", "a colourful parrot on a perch"),
    ("turtle_tank", "Turtle Tank", "pet", 380, 130, "none", "a small glass tank with a turtle and a rock"),
    ("goldfish_bowl", "Goldfish Bowl", "pet", 190, 100, "none", "a round goldfish bowl with two goldfish"),
    ("plant_monstera", "Monstera", "deco", 260, 150, "none", "a big monstera plant in a woven basket"),
    ("bonsai", "Bonsai", "deco", 340, 110, "none", "a small pine bonsai on a wooden stand"),
    ("cactus_trio", "Cactus Trio", "deco", 120, 100, "none", "three tiny cacti in matching pots"),
  ]),
  ("Seasons & holidays", [
    ("snowman", "Snowman", "deco", 170, 120, "none", "a cheerful snowman with a red scarf"),
    ("bokjumeoni", "Lucky Pouch", "deco", 140, 80, "none", "a Korean new-year lucky pouch (bokjumeoni) in red silk"),
    ("tteokguk", "Tteokguk Bowl", "deco", 100, 80, "none", "a bowl of tteokguk rice cake soup"),
    ("songpyeon", "Songpyeon Plate", "deco", 100, 80, "none", "a plate of colourful songpyeon rice cakes on pine needles"),
    ("carnation_pot", "Carnation Pot", "deco", 120, 90, "none", "a pot of red carnations with a ribbon"),
    ("cherry_branch", "Cherry Blossom Vase", "deco", 220, 130, "sparkle", "a vase with blooming cherry blossom branches"),
    ("summer_fan", "Electric Fan", "deco", 170, 120, "none", "a retro electric fan"),
    ("maple_jar", "Maple Leaf Jar", "deco", 140, 100, "none", "a glass jar with red and orange maple leaves"),
    ("choco_box", "Chocolate Box", "deco", 100, 80, "none", "a heart-shaped box of chocolates with a bow"),
  ]),
]

STYLE = ("I'm making item sprites for a cozy pixel-art room game. Style for EVERY image: soft pixel-art "
         "(chunky visible pixels, smooth shading), front-facing view, warm cozy colours, no text, no floor "
         "shadow, plain pure white background. Match the style of a small yellow pixel-art two-seat sofa.")

def main():
    root = os.path.join(os.path.dirname(__file__), '..', '..')
    lines = ["# My Room item art: prompts", "",
      "Two sets: (A) the 29 catalogue items that still have no picture (one image each), and",
      "(B) 63 new items in 7 sheets of 9: one picture per sheet, a 3x3 grid.", "",
      "Cut sheets and clean single images with `scripts/room-art/process.py` (background removal,",
      "trim, 400x400). Pictures go to `korehan/assets/room/`; items appear in the shop automatically",
      "once their file exists.", "",
      "## Style (paste once per chat)", "", "```", STYLE, "```", "",
      "## (B) New items — one message per sheet", "",
      "Paste: *\"Make ONE square image: a 3x3 grid of nine separate items, evenly spaced, each centred in",
      "its own cell with empty white space around it, no grid lines, no labels. Row 1: …, Row 2: …, Row 3: …\"*",
      "", "Then run: `python3 scripts/room-art/process.py --grid <sheet.png> <sheet number>`", ""]
    for n, (title, items) in enumerate(SHEETS, 1):
        lines.append(f"### Sheet {n}: {title}")
        rows = [items[i:i + 3] for i in range(0, 9, 3)]
        for r, row in enumerate(rows, 1):
            lines.append(f"- Row {r}: " + "; ".join(f"{p}" for (_, _, _, _, _, _, p) in row))
        lines.append("- Files (row by row): " + ", ".join(f"`{i[0].replace('_', '-')}.png`" for i in items))
        lines.append("")
    old = open(os.path.join(root, 'docs', 'reference', 'room-art-prompts.md')).read()
    a = old.find('## Items')
    lines += ["## (A) Existing items without a picture — one message each", "", old[old.find('\n', a) + 1:] if a >= 0 else ""]
    open(os.path.join(root, 'docs', 'reference', 'room-art-prompts.md'), 'w').write("\n".join(lines))

    q = lambda s: "'" + str(s).replace("'", "''") + "'"
    vals, sort = [], 2000
    for _, items in SHEETS:
        for (i, name, cat, price, size, eff, _) in items:
            sort += 1
            vals.append(f"  ({q(i)}, {q(name)}, {price}, {q('assets/room/' + i.replace('_', '-') + '.png')}, {size}, {sort}, true, {q(cat)}, {q(eff)})")
    sql = ("-- auto-apply\n-- 63 new My Room items (owner, 2026-10-29: about 100 items in total). Pictures are made\n"
           "-- from the prompt sheets in docs/reference/room-art-prompts.md (scripts/room-art/catalog.py) and\n"
           "-- dropped into korehan/assets/room/; until a picture exists the item hides itself in every shop.\n"
           "-- Prices follow the tiers in 20261029_my_room_ownership_prices.sql. Insert-only: an item that\n"
           "-- already exists (e.g. edited in the admin) is left alone.\n"
           "insert into public.room_items (id, name, price_nyang, image_url, base_size, sort_order, active, category, effect)\n"
           "select v.* from (values\n" + ",\n".join(vals) + "\n) as v(id, name, price_nyang, image_url, base_size, sort_order, active, category, effect)\n"
           "where not exists (select 1 from public.room_items r where r.id = v.id);\n")
    open(os.path.join(root, 'supabase', 'migrations', '20261029_room_items_more.sql'), 'w').write(sql)
    print(sum(len(i) for _, i in SHEETS), 'items')

if __name__ == '__main__':
    main()
