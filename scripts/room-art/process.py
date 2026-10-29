"""Turn raw room-item pictures into ready sprites for korehan/assets/room/.

  python3 scripts/room-art/process.py <folder with raw images>
  python3 scripts/room-art/process.py --grid <sheet image> <sheet number>

--grid cuts a 3x3 sheet (see catalog.py SHEETS / the prompt guide) into its
nine items, row by row, and names them from the catalogue.

Each file must already carry the target name (e.g. kotatsu.png — see
docs/reference/room-art-prompts.md). For every image: the plain background
connected to the edges is made transparent (flood fill from the border, so
white parts inside the object stay), the result is trimmed and centred on a
400x400 transparent canvas, and written to korehan/assets/room/<name>.png.
Images that already have transparency keep it.
"""
import sys, os
from collections import deque
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'korehan', 'assets', 'room')
SIZE, PAD, TOL = 400, 12, 38

def clear_background(im):
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    if any(px[x, y][3] < 250 for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))):
        return im  # already transparent
    br, bg, bb, _ = px[0, 0]
    near = lambda c: abs(c[0] - br) + abs(c[1] - bg) + abs(c[2] - bb) <= TOL * 3
    seen = bytearray(w * h)
    q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]: continue
        seen[i] = 1
        c = px[x, y]
        if not near(c): continue
        px[x, y] = (c[0], c[1], c[2], 0)
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    return im

def fit(im):
    box = im.getbbox()
    if box: im = im.crop(box)
    s = (SIZE - 2 * PAD) / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
    return canvas

def drop_specks(im, keep=0.03):
    """Keep only pieces at least `keep` of the biggest one (bits of a neighbouring cell go)."""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    parts = []
    for y in range(h):
        for x in range(w):
            if seen[y * w + x] or px[x, y][3] <= 20: continue
            comp, q = [], deque([(x, y)])
            seen[y * w + x] = 1
            while q:
                cx, cy = q.popleft(); comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] > 20:
                        seen[ny * w + nx] = 1; q.append((nx, ny))
            parts.append(comp)
    if not parts: return im
    big = max(len(c) for c in parts)
    for comp in parts:
        if len(comp) < keep * big:
            for x, y in comp: px[x, y] = px[x, y][:3] + (0,)
    return im

def grid(sheet_path, sheet_no):
    """Sheet numbers follow docs/reference/room-art-prompts.md: catalog SHEETS first, then PROPS."""
    sys.path.insert(0, os.path.dirname(__file__))
    from catalog import SHEETS, PROPS
    items = (SHEETS + PROPS)[int(sheet_no) - 1][1]
    im = Image.open(sheet_path).convert('RGBA')
    cw, ch = im.width / 3, im.height / 3
    os.makedirs(OUT, exist_ok=True)
    for k, item in enumerate(items):
        r, c = divmod(k, 3)
        cell = im.crop((round(c * cw) + 4, round(r * ch) + 4, round((c + 1) * cw) - 4, round((r + 1) * ch) - 4))
        name = item[0].replace('_', '-') + '.png'
        fit(drop_specks(clear_background(cell))).save(os.path.join(OUT, name))
        print('ok', name)

if __name__ == '__main__':
    if sys.argv[1] == '--grid':
        grid(sys.argv[2], sys.argv[3]); sys.exit(0)
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if not f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')): continue
        name = os.path.splitext(f)[0] + '.png'
        fit(clear_background(Image.open(os.path.join(src, f)))).save(os.path.join(OUT, name))
        print('ok', name)
