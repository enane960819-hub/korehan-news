"""Turn raw room-item pictures into ready sprites for korehan/assets/room/.

  python3 scripts/room-art/process.py <folder with raw images>
  python3 scripts/room-art/process.py --grid <sheet image> <sheet number>

--auto <picture> name1,name2,... finds the items on any layout and names them in reading
order (rows top to bottom, left to right). --grid cuts a 3x3 sheet (see catalog.py SHEETS / the prompt guide) into its
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
    # 256 colours: pixel art looks the same and the file is ~5x smaller (phones load the shop).
    return canvas.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)

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

def find_items(im, gap=4, tol=60):
    """Items on a plain background, in reading order (rows top to bottom, then left to right).
    Parts closer than `gap` px (drum + sticks, puzzle + loose pieces) count as one item.
    Returns (boxes, labels, scale) with labels on a 1/4-size grid."""
    import numpy as np
    a = np.asarray(im.convert('RGB')).astype(int)
    bg = a[0, 0]
    ink = np.abs(a - bg).sum(2) > tol
    s = 4
    h, w = ink.shape[0] // s, ink.shape[1] // s
    small = ink[:h * s, :w * s].reshape(h, s, w, s).any(axis=(1, 3))
    grow = small.copy()
    for _ in range(max(1, gap // s)):
        g = grow.copy()
        g[1:] |= grow[:-1]; g[:-1] |= grow[1:]; g[:, 1:] |= grow[:, :-1]; g[:, :-1] |= grow[:, 1:]
        grow = g
    lab = np.zeros((h, w), int)
    comps = []
    for y, x in zip(*np.nonzero(grow)):
        if lab[y, x]: continue
        k = len(comps) + 1
        lab[y, x] = k
        q = deque([(y, x)]); ys = []; xs = []
        while q:
            cy, cx = q.popleft()
            if small[cy, cx]: ys.append(cy); xs.append(cx)
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and grow[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = k; q.append((ny, nx))
        comps.append((k, len(ys), (min(xs) * s, min(ys) * s, (max(xs) + 1) * s, (max(ys) + 1) * s)) if ys else (k, 0, None))
    comps = [c for c in comps if c[1] > 0]
    med_a = sorted(c[1] for c in comps)[len(comps) // 2]
    comps = [c for c in comps if c[1] >= 0.02 * med_a]          # noise
    # Loose small parts (a stylus, a shuttlecock, drumsticks) join the nearest item.
    def gapd(a, b):
        return max(0, max(a[0], b[0]) - min(a[2], b[2])) + max(0, max(a[1], b[1]) - min(a[3], b[3]))
    while True:
        tiny = [c for c in comps if c[1] < 0.25 * med_a]
        if not tiny or len(comps) < 2: break
        c = min(tiny, key=lambda c: c[1])
        rest = [d for d in comps if d is not c]
        d = min(rest, key=lambda d: gapd(c[2], d[2]))
        lab[lab == c[0]] = d[0]
        nb = (min(c[2][0], d[2][0]), min(c[2][1], d[2][1]), max(c[2][2], d[2][2]), max(c[2][3], d[2][3]))
        comps = [x for x in rest if x is not d] + [(d[0], d[1] + c[1], nb)]
    # Items stacked on top of each other that touch (a lantern hanging under a box): split at
    # the emptiest rows into as many parts as the height suggests.
    med_h = sorted(c[2][3] - c[2][1] for c in comps)[len(comps) // 2]
    out, nxt = [], int(lab.max()) + 1
    for c in comps:
        x0, y0, x1, y1 = c[2]
        n = int((y1 - y0) / med_h + 0.25)
        if n < 2:
            out.append(c); continue
        rows_ink = small[y0 // s:y1 // s, x0 // s:x1 // s].sum(1)
        cuts, hh = [], len(rows_ink)
        for i in range(1, n):
            lo, hi = int(hh * i / n - hh / (3 * n)), int(hh * i / n + hh / (3 * n))
            cuts.append(lo + int(rows_ink[lo:hi].argmin()))
        bands = [0] + cuts + [hh]
        for j in range(n):
            ya, yb = y0 // s + bands[j], y0 // s + bands[j + 1]
            region = lab[ya:yb, x0 // s:x1 // s]
            k = c[0] if j == 0 else nxt
            if j: region[region == c[0]] = k; nxt += 1
            sm = small[ya:yb, x0 // s:x1 // s] & (region == k)
            if not sm.any(): continue
            yy, xx = np.nonzero(sm)
            out.append((k, int(sm.sum()), ((x0 // s + xx.min()) * s, (ya + yy.min()) * s, (x0 // s + xx.max() + 1) * s, (ya + yy.max() + 1) * s)))
    comps = out
    comps.sort(key=lambda c: (c[2][1] + c[2][3]) / 2)
    rows, mh = [], sorted(c[2][3] - c[2][1] for c in comps)[len(comps) // 2]
    for c in comps:
        cy = (c[2][1] + c[2][3]) / 2
        if rows and cy - rows[-1][0] < 0.5 * mh: rows[-1][1].append(c)
        else: rows.append([cy, [c]])
    ordered = [c for _, r in rows for c in sorted(r, key=lambda c: c[2][0])]
    return ordered, lab, s

def clear_background_safe(im, tol=36, r=2, hole=400, hole_min=6, pocket_ring=120):
    """Background removal that can't leak through thin gaps in an outline: the fill runs on
    the background eroded by `r` px and is grown back afterwards. Pure background trapped
    inside a ring (a wreath, a hanging cord) or framed by dark outline is cleared too.
    Check the result on a dark background: a white stripe inside a mid-dark fill (medal ribbons)
    looks like a gap to this rule and has to be put back by hand."""
    import numpy as np
    a = np.array(im.convert('RGBA'))
    rgb = a[:, :, :3].astype(int)
    bg = np.array([253, 253, 253])
    near = np.abs(rgb - bg).sum(2) <= tol
    def shift_all(m, op):
        o = m.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s = np.roll(m, (dy, dx), (0, 1))
            if dy == 1: s[0] = m[0]
            if dy == -1: s[-1] = m[-1]
            if dx == 1: s[:, 0] = m[:, 0]
            if dx == -1: s[:, -1] = m[:, -1]
            o = op(o, s)
        return o
    er = near.copy()
    for _ in range(r): er = shift_all(er, np.logical_and)
    reach = np.zeros_like(er)
    reach[0, :] = er[0, :]; reach[-1, :] = er[-1, :]; reach[:, 0] = er[:, 0]; reach[:, -1] = er[:, -1]
    while True:
        n = shift_all(reach, np.logical_or) & er
        if (n == reach).all(): break
        reach = n
    for _ in range(r + 1): reach = shift_all(reach, np.logical_or) & near
    # Background trapped between leaves / petals / a box and its lid: white pockets the outside
    # fill can't reach. Cleared when framed by dark outline pixels (see pocket_ring).
    pure = (np.abs(rgb - bg).sum(2) <= 15) & ~reach
    h, w = pure.shape
    seen = np.zeros_like(pure)
    holes = np.zeros_like(pure)
    big = max(hole, int(0.03 * h * w))
    for y, x in zip(*np.nonzero(pure)):
        if seen[y, x]: continue
        comp, q = [], deque([(y, x)]); seen[y, x] = True
        while q:
            cy, cx = q.popleft(); comp.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and pure[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        if len(comp) < hole_min: continue
        ys, xs = zip(*comp)
        m = np.zeros_like(pure); m[list(ys), list(xs)] = True
        g = m.copy()
        for _ in range(r + 2): g = shift_all(g, np.logical_or)
        ring = g & ~near & ~m                       # first non-light pixels around the pocket
        ring_lum = float(np.median(rgb[ring].mean(1))) if ring.any() else 255.0
        if os.environ.get('KH_POCKET_DEBUG'):
            print('  pocket', len(comp), 'ring', round(ring_lum), 'at', min(xs), min(ys))
        # Real gaps are framed by the dark outline every pixel-art shape has; a highlight sits
        # in a lighter fill (glass, cream, gold), so it stays.
        if len(comp) >= big or ring_lum <= pocket_ring:
            holes[list(ys), list(xs)] = True
    # Grow each cleared pocket over its light anti-aliased rim so no pale outline is left.
    for _ in range(r + 1): holes = shift_all(holes, np.logical_or) & near
    reach |= holes
    a[reach, 3] = 0
    return Image.fromarray(a)

def auto(sheet_path, names):
    """Cut any layout (3x3, 2x4, 5+4 ...) by finding the items; `names` in reading order."""
    import numpy as np
    im = Image.open(sheet_path).convert('RGBA')
    items, lab, s = find_items(im)
    if len(items) != len(names):
        print('found', len(items), 'items but got', len(names), 'names:', [c[2] for c in items]); sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    big = np.kron(lab, np.ones((s, s), int))
    big = np.pad(big, ((0, im.height - big.shape[0]), (0, im.width - big.shape[1])), mode='edge')
    kept = np.array(sorted(c[0] for c in items))
    for (k, _, (x0, y0, x1, y1)), name in zip(items, names):
        pad = 6
        box = (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))
        cell = np.array(clear_background_safe(im.crop(box)))
        other = big[box[1]:box[3], box[0]:box[2]]
        cell[np.isin(other, kept) & (other != k), 3] = 0   # parts of neighbouring items only
        out = drop_specks(Image.fromarray(cell).copy())
        fit(out).save(os.path.join(OUT, name + '.png'))
        print('ok', name)

if __name__ == '__main__':
    if sys.argv[1] == '--auto':
        auto(sys.argv[2], sys.argv[3].split(',')); sys.exit(0)
    if sys.argv[1] == '--grid':
        grid(sys.argv[2], sys.argv[3]); sys.exit(0)
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if not f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')): continue
        name = os.path.splitext(f)[0] + '.png'
        fit(clear_background(Image.open(os.path.join(src, f)))).save(os.path.join(OUT, name))
        print('ok', name)
