"""Clear the white gaps left BETWEEN hair strands by background removal.

  python3 scripts/avatar/hair-gaps.py [--dry] sprite ...   (names in korehan/assets/avatar, no .png)

Background removal only clears white that touches the outside. Where long hair splits into
strands (beside the arms) the white between two strands is enclosed, so it stayed as thin
opaque white lines. A gap is a thin, tall cluster of near-white pixels whose surroundings are
mostly warm hair colours; it goes transparent together with its grey anti-aliased rim.
Eye highlights (small, round), drawstrings and stripes (cool / navy surroundings), collars and
sneakers (wide or big) don't match. Re-run skin-masks.py for the same sprites afterwards.
"""
import sys, os
from collections import deque
import numpy as np
from PIL import Image
FACE_Y = 150   # the face (eyes ~107-111) is above this; its middle half is skipped
AV = os.path.join(os.path.dirname(__file__), '..', '..', 'korehan', 'assets', 'avatar')

def fix(a):
    rgb = a[..., :3].astype(int); al = a[..., 3].astype(int)
    h, w = al.shape
    mx = rgb.max(-1); mn = rgb.min(-1); lum = rgb.mean(-1)
    op = al > 200
    core = op & (mn >= 225) & (mx - mn < 22)
    warm = (al > 120) & (rgb[..., 0] - rgb[..., 2] >= 4) & (lum < 205)
    rim = op & (mn >= 135) & (mx - mn < 32)
    dark = (al > 120) & (lum < 130)
    seen = np.zeros_like(core); out = np.zeros_like(core)
    for y0, x0 in zip(*np.nonzero(core)):
        if seen[y0, x0]: continue
        comp = []; q = deque([(y0, x0)]); seen[y0, x0] = True
        while q:
            y, x = q.popleft(); comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and core[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
        if len(comp) > 140: continue
        ys = np.array([c[0] for c in comp]); xs = np.array([c[1] for c in comp])
        rows = {}
        for y, x in comp: rows[y] = rows.get(y, 0) + 1
        height = ys.max() - ys.min() + 1; width = max(rows.values())
        if height < 5 or width > 3 or height < 2.5 * width: continue
        ring = np.zeros_like(core); ring[ys, xs] = True
        for _ in range(3):
            g = ring.copy(); g[1:] |= ring[:-1]; g[:-1] |= ring[1:]; g[:, 1:] |= ring[:, :-1]; g[:, :-1] |= ring[:, 1:]; ring = g
        ring[ys, xs] = False
        if warm[ring].mean() < 0.45 or dark[ring].mean() < 0.4: continue      # hair around it, not sequins
        if ys.min() < FACE_Y and (xs > 0.25 * w).all() and (xs < 0.75 * w).all(): continue   # eye highlights
        out[ys, xs] = True
    # Take the grey anti-aliased rim with it (2 steps).
    for _ in range(2):
        g = out.copy(); g[1:] |= out[:-1]; g[:-1] |= out[1:]; g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]
        out |= g & rim
    al[out] = 0
    a[..., 3] = al
    return a, int(out.sum())

if __name__ == '__main__':
    args = sys.argv[1:]; dry = '--dry' in args; args = [x for x in args if x != '--dry']
    tot = 0
    for n in args:
        p = os.path.join(AV, n + '.png')
        a = np.array(Image.open(p).convert('RGBA'))
        a, k = fix(a); tot += k
        if k and not dry: Image.fromarray(a).save(p, optimize=True)
        print(n, k)
    print('cleared', tot, 'px')
