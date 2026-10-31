"""Remove the white halo left inside hair outlines (owner 2026-10-31: "white gaps in the hair").

  python3 scripts/avatar/fix-hair-halo.py [--dry] [sprite ...]   (no args = every sprite)

The sprites were cut from pictures on a white background; near-white / grey lines stayed between
the hair outline and the strands. Hair = the warm dark blob(s) reaching the top of the head. A
light pixel is fixed when it sits in a thin line inside that hair (5x5: 7+ hair, at most 11 light
pixels) and takes the median hair colour around it; three passes. Pixels in the face box (around the eyes, SPRITE metrics in avatar-art.js) are
never touched, so eye highlights stay. Re-run skin-masks.py afterwards and bump KH_ROOM_ART_V.
"""
import numpy as np, os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
AV = os.path.join(HERE, '..', '..', 'korehan', 'assets', 'avatar') + '/'
src = open(os.path.join(HERE, '..', '..', 'korehan', 'js', 'features', 'avatar-art.js')).read()
blk = re.search(r"var SPRITE = \{([\s\S]*?)\n  \};", src).group(1)
SP = {m.group(1): [float(x) for x in m.group(2).split(',')] for m in re.finditer(r"'([a-z-]+)': \[([0-9., ]+)\]", blk)}

def grow(m, n):
    m = m.copy()
    for _ in range(n):
        g = m.copy(); g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]; m = g
    return m

def comps(m):
    from collections import deque
    H, W = m.shape; lab = np.zeros((H, W), int); n = 0
    for y, x in zip(*np.nonzero(m)):
        if lab[y, x]: continue
        n += 1; q = deque([(y, x)]); lab[y, x] = n
        while q:
            cy, cx = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; q.append((ny, nx))
    return lab

def fix(name, dry=False):
    p = AV + name + '.png'
    a = np.asarray(Image.open(p).convert('RGBA')).copy()
    m = SP.get(name)
    if not m: return 0
    ex, ey = m[2], m[3]
    total = 0
    for _ in range(3):
        rgb = a[..., :3].astype(int); al = a[..., 3]
        mx = rgb.max(-1); mn = rgb.min(-1)
        lum = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]
        H, W = al.shape
        yy, xx = np.mgrid[0:H, 0:W]
        # hair: warm dark pixels in the blob(s) that reach the top of the head
        dark = (al >= 120) & (lum < 120) & (mn < 115) & (rgb[..., 0] - rgb[..., 2] >= 10)
        lab = comps(dark)
        ids = np.unique(lab[(yy < ey - 25) & (lab > 0)])
        hair = np.isin(lab, ids) & (lab > 0)
        light = (al >= 40) & (mn >= 115) & (mx - mn <= 45)
        # thin light lines only: few light pixels around, several hair pixels around
        k = np.ones((5, 5), int)
        def box(b):
            b = np.pad(b.astype(int), 2)
            return sum(b[dy:dy + H, dx:dx + W] for dy in range(5) for dx in range(5))
        nl, nh = box(light), box(hair)
        cand = light & (nh >= 7) & (nl <= 11)
        # single specks on the top outline of the hair have fewer hair neighbours
        cand |= light & (nh >= 4) & (nl <= 6) & (yy < ey - 20)
        cand &= ~((np.abs(xx - ex) < 50) & (yy > ey - 32) & (yy < ey + 34))   # face: eye highlights stay
        ys, xs = np.nonzero(cand)
        if not len(ys): break
        for y, x in zip(ys, xs):
            y0, y1, x0, x1 = max(0, y - 2), y + 3, max(0, x - 2), x + 3
            nb = hair[y0:y1, x0:x1]
            a[y, x, :3] = np.median(rgb[y0:y1, x0:x1][nb], axis=0)
            if a[y, x, 3] < 200: a[y, x, 3] = 255 if nb.sum() >= 12 else a[y, x, 3]
        total += len(ys)
    if not dry: Image.fromarray(a, 'RGBA').save(p, optimize=True)
    return total

if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if x != '--dry']; dry = '--dry' in sys.argv
    names = args or sorted(f[:-4] for f in os.listdir(AV) if f.endswith('.png') and not f.startswith('acc-'))
    tot = 0
    for n in names: tot += fix(n, dry)
    print('fixed', tot, 'px in', len(names), 'sprites')
