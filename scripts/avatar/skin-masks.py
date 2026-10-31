"""Skin-tone masks for the My Room character (avatar-art.js SKINS / tintSkin).

  python3 scripts/avatar/skin-masks.py [sprite ...]   (no args = every sprite)

Writes korehan/assets/avatar/skin/<sprite>.png: 255 where the pixel is skin, a soft edge
around it, 0 elsewhere. Skin = close to the base faces' palette, in a blob of 60+ px (so
skin-coloured specks on cream / pink clothes stay), grown 2 px into anti-aliased edges.
Re-run after adding or redrawing a sprite, and bump KH_ROOM_ART_V."""
import numpy as np, os, sys
from collections import deque
from PIL import Image
AV=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','korehan','assets','avatar')+'/'
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
OUT=os.path.join(ROOT,'korehan','assets','avatar','skin')+'/'
C=np.load(os.path.join(os.path.dirname(os.path.abspath(__file__)),'skin-palette.npy'))   # Lab skin colours sampled from the 4 base faces
def lab(rgb):
    c=rgb/255.0; c=np.where(c>0.04045,((c+0.055)/1.055)**2.4,c/12.92)
    M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
    xyz=c@M.T/np.array([0.9505,1,1.089]); f=np.where(xyz>0.008856,np.cbrt(xyz),7.787*xyz+16/116)
    return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)
def comps(m):
    H,W=m.shape; lab_=np.zeros((H,W),int); n=0; sizes=[0]
    for y,x in zip(*np.nonzero(m)):
        if lab_[y,x]: continue
        n+=1; q=deque([(y,x)]); lab_[y,x]=n; s=0
        while q:
            cy,cx=q.popleft(); s+=1
            for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny,nx=cy+dy,cx+dx
                if 0<=ny<H and 0<=nx<W and m[ny,nx] and not lab_[ny,nx]: lab_[ny,nx]=n; q.append((ny,nx))
        sizes.append(s)
    return lab_,np.array(sizes)
def mask(path):
    a=np.asarray(Image.open(path).convert('RGBA'))
    L=lab(a[...,:3].astype(float)); d=np.sqrt(((L[...,None,:]-C)**2).sum(-1)).min(-1)
    ch=np.sqrt(L[...,1]**2+L[...,2]**2); op=a[...,3]>40
    core=op&(d<7)&(ch>15)
    lb,sz=comps(core)
    keep=np.isin(lb,np.nonzero(sz>=60)[0])&core
    w=keep.astype(float)
    # soft edge: up to 2 px around kept skin, pixels that are skin-ish (looser) get a partial weight
    cur=keep.copy()
    for it in range(2):
        nb=np.zeros_like(cur)
        nb[1:]|=cur[:-1]; nb[:-1]|=cur[1:]; nb[:,1:]|=cur[:,:-1]; nb[:,:-1]|=cur[:,1:]
        ring=nb&~cur&op&(d<16)&(ch>10)&(L[...,0]>30)
        w=np.where(ring,np.maximum(w,np.clip(1-(d-7)/12,0.35,1)),w)
        cur=cur|ring
    return (w*255).astype(np.uint8)
names=[f[:-4] for f in sorted(os.listdir(AV)) if f.endswith('.png') and not f.startswith('acc-')]
for n in (sys.argv[1:] or names):
    m=mask(AV+n+'.png'); Image.fromarray(m,'L').save(OUT+n+'.png',optimize=True)
print('ok',len(sys.argv[1:] or names))
