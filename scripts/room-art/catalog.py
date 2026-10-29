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

# Second batch (owner 2026-10-29: "more kinds of props"). Same tuple format; their rows go in
# 20261029_room_props.sql and stay hidden until the picture exists.
PROPS = [
  ("Study desk props", [
    ("hangul_notebook", "Hangul Notebook", "deco", 100, 90, "none", "an open notebook with neat handwritten Korean letters ㄱ ㄴ ㄷ and a pencil on it"),
    ("flashcard_box", "Flashcard Box", "deco", 120, 80, "none", "a small wooden box full of colourful flashcards with a few sticking out"),
    ("sand_timer", "Study Timer", "deco", 100, 80, "none", "a wooden hourglass sand timer with pink sand"),
    ("sticky_notes", "Sticky Note Wall", "deco", 120, 110, "none", "a cluster of pastel sticky notes stuck in a grid, with doodles but no readable text"),
    ("study_laptop", "Sticker Laptop", "deco", 310, 110, "none", "an open laptop covered in cute stickers, screen glowing softly"),
    ("headphone_stand", "Headphone Stand", "deco", 220, 100, "none", "over-ear headphones resting on a small wooden stand"),
    ("tablet_pen", "Drawing Tablet", "deco", 260, 100, "none", "a tablet on a little stand with a stylus pen next to it"),
    ("trophy", "Study Trophy", "deco", 290, 90, "none", "a small shiny gold trophy cup on a wooden base"),
    ("medal_rack", "Medal Hanger", "deco", 240, 110, "none", "a wall hanger with three ribbons and gold, silver and bronze medals"),
  ]),
  ("Korean daily life", [
    ("banana_milk", "Banana Milk", "deco", 60, 60, "none", "a small round Korean banana milk bottle, plain yellow with no logo"),
    ("snack_basket", "Snack Basket", "deco", 140, 100, "none", "a woven basket full of colourful Korean snack bags with no logos or text"),
    ("dalgona_set", "Dalgona Set", "deco", 120, 80, "none", "a dalgona honeycomb candy with a star shape on a metal tray with a small ladle"),
    ("bungeoppang", "Fish Bread", "deco", 100, 70, "none", "three golden fish-shaped bungeoppang pastries in a paper bag"),
    ("najeon_box", "Mother-of-pearl Box", "deco", 340, 90, "none", "a black lacquer Korean najeon jewellery box inlaid with shimmering mother-of-pearl flowers"),
    ("bojagi_gift", "Bojagi Gift", "deco", 140, 80, "none", "a gift wrapped in colourful Korean patchwork bojagi cloth, tied in a knot on top"),
    ("namsan_mini", "Mini N Seoul Tower", "deco", 260, 120, "none", "a small figurine of N Seoul Tower on a round base"),
    ("haetae_statue", "Haetae Statue", "deco", 380, 110, "none", "a small cute stone statue of a haetae, the Korean lion guardian, sitting"),
    ("mini_hanok", "Mini Hanok", "deco", 420, 120, "glow_warm", "a small model of a Korean hanok house with a curved tiled roof and warm lit windows"),
  ]),
  ("Cozy decor", [
    ("candle_trio", "Candle Trio", "deco", 140, 80, "glow_warm", "three lit pillar candles of different heights on a small tray"),
    ("snow_globe", "Snow Globe", "deco", 220, 90, "none", "a snow globe with a tiny hanok house inside and snowflakes"),
    ("music_box", "Music Box", "deco", 260, 80, "none", "an open wooden music box with a tiny dancer"),
    ("dried_flowers", "Dried Flower Vase", "deco", 170, 110, "none", "a ceramic vase with dried pampas grass and small dried flowers"),
    ("wall_shelf", "Plant Shelf", "deco", 290, 140, "none", "a floating wooden wall shelf with small potted plants and a few books"),
    ("macrame", "Macrame Hanging", "deco", 170, 130, "none", "a cream macrame wall hanging on a wooden stick"),
    ("teddy_bear", "Teddy Bear", "deco", 190, 100, "none", "a soft brown teddy bear sitting with a red bow"),
    ("framed_photo", "Photo Frames", "deco", 120, 90, "none", "two small framed photos standing side by side, showing a beach and mountains"),
    ("neon_moon", "Neon Moon", "deco", 310, 110, "glow_neon", "a glowing pink and blue crescent moon neon sign"),
  ]),
  ("Cute plushies", [
    ("tiger_plush", "Tiger Plush", "deco", 240, 100, "none", "a cute round plush toy of a Korean tiger, smiling"),
    ("magpie_plush", "Magpie Plush", "deco", 190, 90, "none", "a cute plush toy of a black and white Korean magpie (kkachi)"),
    ("dokkaebi_plush", "Dokkaebi Plush", "deco", 240, 100, "none", "a cute friendly plush toy of a Korean dokkaebi goblin with one small horn and a club"),
    ("moon_rabbit", "Moon Rabbit", "deco", 220, 100, "none", "a white rabbit plush pounding rice cakes with a tiny mallet, sitting on a crescent moon"),
    ("gimbap_pillow", "Gimbap Pillow", "deco", 190, 110, "none", "a round cushion that looks like a slice of gimbap"),
    ("persimmon_plush", "Persimmon Plush", "deco", 140, 80, "none", "a cute orange persimmon plush with a green leaf hat and a smile"),
    ("tteok_plush", "Rice Cake Plush", "deco", 140, 80, "none", "a squishy white rice cake (tteok) plush with a happy face"),
    ("penguin_plush", "Penguin Plush", "deco", 190, 90, "none", "a chubby penguin plush wearing a little knitted scarf"),
    ("cat_cushion", "Cat Cushion", "deco", 170, 100, "none", "a round cat-shaped floor cushion, sleeping cat face"),
  ]),
]

# The 5 older catalogue items that still have no picture (one image each).
OLD_MISSING = [
    ("norigae", "a traditional Korean norigae ornament with a red tassel and jade piece"),
    ("jangdok", "a traditional Korean onggi earthenware jar (jangdok) with a lid"),
    ("cat_white", "a fluffy white cat sitting and looking forward"),
    ("koi_pond", "a small round indoor koi pond with two orange koi and a lily pad"),
    ("chuseok_lantern", "a round traditional Korean silk lantern (cheongsachorong) in red and blue"),
]

STYLE = ("I'm making item sprites for a cozy pixel-art room game. Style for EVERY image: soft pixel-art "
         "(chunky visible pixels, smooth shading), front-facing view, warm cozy colours, no text, no floor "
         "shadow, plain pure white background. Match the style of a small yellow pixel-art two-seat sofa.")

def fname(i):
    return i.replace('_', '-') + '.png'

def migration(groups, path, header, sort0):
    q = lambda s: "'" + str(s).replace("'", "''") + "'"
    vals, sort = [], sort0
    for _, items in groups:
        for (i, name, cat, price, size, eff, _) in items:
            sort += 1
            vals.append(f"  ({q(i)}, {q(name)}, {price}, {q('assets/room/' + fname(i))}, {size}, {sort}, true, {q(cat)}, {q(eff)})")
    sql = (header +
           "insert into public.room_items (id, name, price_nyang, image_url, base_size, sort_order, active, category, effect)\n"
           "select v.* from (values\n" + ",\n".join(vals) + "\n) as v(id, name, price_nyang, image_url, base_size, sort_order, active, category, effect)\n"
           "where not exists (select 1 from public.room_items r where r.id = v.id);\n")
    open(path, 'w').write(sql)

def main():
    root = os.path.join(os.path.dirname(__file__), '..', '..')
    total = sum(len(i) for _, i in PROPS) + sum(len(i) for _, i in SHEETS) + len(OLD_MISSING)
    lines = ["# My Room item art: prompts", "",
      f"{total} items still need a picture. One picture per message works best (cleanest cut-outs).",
      "Name each file exactly as shown and send them over; they are cleaned with",
      "`scripts/room-art/process.py <folder>` (background removal, trim, 400x400) and go to",
      "`korehan/assets/room/`. An item shows up in the shop as soon as its picture exists.", "",
      "## Style (paste once at the start of a chat)", "", "```", STYLE, "```", "",
      "## Message for each item", "",
      "Paste `Draw ONE item, centred, nothing else in the picture: <description>` with one",
      "description from the lists below. If it comes back angled or with a floor or shadow, reply:",
      "`Same item, straight front view, plain white background, no shadow.`", ""]
    def block(title, rows):
        lines.append(f"### {title}"); lines.append("")
        lines.append("| file | description |"); lines.append("|------|-------------|")
        for f, d in rows: lines.append(f"| `{f}` | {d} |")
        lines.append("")
    lines.append("## A. New props (36)"); lines.append("")
    for title, items in PROPS:
        block(title, [(fname(i[0]), i[6]) for i in items])
    lines.append("## B. Catalogue items still without a picture"); lines.append("")
    block("Older items", [(fname(i), d) for i, d in OLD_MISSING])
    for title, items in SHEETS:
        block(title, [(fname(i[0]), i[6]) for i in items])
    open(os.path.join(root, 'docs', 'reference', 'room-art-prompts.md'), 'w').write("\n".join(lines))

    migration(SHEETS, os.path.join(root, 'supabase', 'migrations', '20261029_room_items_more.sql'),
      "-- auto-apply\n-- 63 new My Room items (owner, 2026-10-29: about 100 items in total). Pictures are made\n"
      "-- from the prompt sheets in docs/reference/room-art-prompts.md (scripts/room-art/catalog.py) and\n"
      "-- dropped into korehan/assets/room/; until a picture exists the item hides itself in every shop.\n"
      "-- Prices follow the tiers in 20261029_my_room_ownership_prices.sql. Insert-only: an item that\n"
      "-- already exists (e.g. edited in the admin) is left alone.\n", 2000)
    migration(PROPS, os.path.join(root, 'supabase', 'migrations', '20261029_room_props.sql'),
      "-- auto-apply\n-- 36 more My Room props (owner, 2026-10-29: \"more kinds of props\"), generated by\n"
      "-- scripts/room-art/catalog.py (PROPS). Hidden in every shop until korehan/assets/room/<file> exists.\n"
      "-- Prices follow the tiers in 20261029_my_room_ownership_prices.sql. Insert-only.\n", 3000)
    print(total, 'items without art')

if __name__ == '__main__':
    main()
