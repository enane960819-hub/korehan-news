"""Remove the white halo left inside hair outlines (owner 2026-10-31: "white gaps in the hair").

  python3 scripts/avatar/fix-hair-halo.py [--dry] [sprite ...]   (no args = every sprite)

The sprites were cut from pictures on a white background; near-white pixels stayed between the
hair outline and the strands. A pixel is fixed when it is near-white, within 3 px of the
transparent outside, and within 2 px of hair-dark pixels; it takes the median colour of the dark
pixels around it. Pixels in the face box (around the eyes, SPRITE metrics in avatar-art.js) are
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

def fix(name, dry=False):
    p = AV + name + '.png'
    a = np.asarray(Image.open(p).convert('RGBA')).copy()
    rgb = a[..., :3].astype(int); al = a[..., 3]
    mx = rgb.max(-1); mn = rgb.min(-1)
    lum = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]
    clear = al < 60
    white = (al >= 60) & (mn >= 120) & (mx - mn <= 40)   # white and the grey anti-aliased fringe
    # hair is warm dark brown / black; clothes outlines (navy, grey, black) are not warm
    hair = (al >= 200) & (lum < 115) & (mn < 110) & (rgb[..., 0] - rgb[..., 2] >= 12)
    cand = white & grow(clear, 7) & grow(hair, 2)
    m = SP.get(name)
    if m:
        ex, ey = m[2], m[3]
        H, W = cand.shape
        yy, xx = np.mgrid[0:H, 0:W]
        cand &= ~((np.abs(xx - ex) < 50) & (yy > ey - 32) & (yy < ey + 34))
        # only long hair reaches below the chin; elsewhere stay on the head
        if not name.startswith('long') and not name == 'base-long': cand &= yy < ey + 45
    ys, xs = np.nonzero(cand)
    for y, x in zip(ys, xs):
        y0, y1, x0, x1 = max(0, y - 2), y + 3, max(0, x - 2), x + 3
        nb = hair[y0:y1, x0:x1]
        if nb.sum() < 2: continue
        a[y, x, :3] = np.median(rgb[y0:y1, x0:x1][nb], axis=0)
    if not dry: Image.fromarray(a, 'RGBA').save(p, optimize=True)
    return int(cand.sum())

if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if x != '--dry']; dry = '--dry' in sys.argv
    names = args or sorted(f[:-4] for f in os.listdir(AV) if f.endswith('.png') and not f.startswith('acc-'))
    tot = 0
    for n in names: tot += fix(n, dry)
    print('fixed', tot, 'px in', len(names), 'sprites')
