"""Remove the light fringe left on the OUTER edge of the hair by background removal.

  python3 scripts/avatar/defringe.py [--dry] sprite ...   (names in korehan/assets/avatar, no .png)

Light, greyish pixels around the head (above HEAD_Y, i.e. the shoulders) form small clusters;
a cluster goes transparent when it touches the transparent background and lies next to hair
(warm, dark). White collars, shirts, sequins and sneakers are lower down or not next to hair,
so they stay. Then a final pass drops single light edge pixels between hair and background.
Re-run skin-masks.py for the same sprites afterwards.
"""
import sys, os
import numpy as np
from PIL import Image
AV = os.path.join(os.path.dirname(__file__), '..', '..', 'korehan', 'assets', 'avatar')

HEAD_Y = 170   # below the chin of every template sprite (eyes ~107-111)

def fix(a):
    from collections import deque
    rgb = a[..., :3].astype(int); al = a[..., 3].astype(int)
    h, w = al.shape
    lum = rgb.mean(-1); mx = rgb.max(-1); mn = rgb.min(-1)
    op = al > 40
    light = op & (mn > 140) & (mx - mn < 80)
    light[HEAD_Y:] = False
    hair = (al > 200) & (lum < 125) & (rgb[..., 0] >= rgb[..., 2])
    tr = ~op
    def near(mask, r):
        out = mask.copy()
        for _ in range(r):
            g = out.copy(); g[1:] |= out[:-1]; g[:-1] |= out[1:]; g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]; out = g
        return out
    near_tr, near_hair = near(tr, 1), near(hair, 2)
    seen = np.zeros_like(light); total = 0
    for y0, x0 in zip(*np.nonzero(light)):
        if seen[y0, x0]: continue
        comp = []; q = deque([(y0, x0)]); seen[y0, x0] = True
        while q:
            y, x = q.popleft(); comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
        ys = np.array([c[0] for c in comp]); xs = np.array([c[1] for c in comp])
        if len(comp) > 160 or not near_tr[ys, xs].any() or near_hair[ys, xs].mean() < 0.5: continue
        al[ys, xs] = 0; total += len(comp)
    a[..., 3] = al
    return a, total

if __name__ == '__main__':
    args = sys.argv[1:]; dry = '--dry' in args; args = [x for x in args if x != '--dry']
    tot = 0
    for n in args:
        p = os.path.join(AV, n + '.png')
        im = Image.open(p).convert('RGBA'); a = np.array(im)
        a, k = fix(a); tot += k
        if k and not dry: Image.fromarray(a).save(p, optimize=True)
        print(n, k)
    print('removed', tot, 'px')
