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
    # forehead bits showing between hair strands: small pieces, but only in the head band
    H0=core.shape[0]; top=np.zeros_like(core); top[:int(H0*0.36)]=True
    keep|=np.isin(lb,np.nonzero((sz>=2)&(sz<60))[0])&core&top&(d<5)
    # small skin pieces cut off by a collar / scarf / bandana (the neck): close to the main skin
    near=keep.copy()
    for _ in range(8):
        g=near.copy(); g[1:]|=near[:-1]; g[:-1]|=near[1:]; g[:,1:]|=near[:,:-1]; g[:,:-1]|=near[:,1:]; near=g
    keep|=np.isin(lb,np.nonzero((sz>=4)&(sz<60))[0])&core&near&(d<5)
    # Shading: darker, more orange skin (ear insides, neck and hairline shadow) that touches the
    # skin. Hair is darker (L < 45); cream / pink clothes are paler (chroma < ~22) or pinker.
    hue=np.degrees(np.arctan2(L[...,2],L[...,1]))
    shade=op&(L[...,0]>=46)&(L[...,0]<=84)&(ch>=24)&(hue>=36)&(hue<=72)
    cur=keep.copy()
    for it in range(10):
        nb=np.zeros_like(cur)
        nb[1:]|=cur[:-1]; nb[:-1]|=cur[1:]; nb[:,1:]|=cur[:,:-1]; nb[:,:-1]|=cur[:,1:]
        add=nb&~cur&shade
        if not add.any(): break
        cur|=add
    # small holes fully inside the skin (nostril dots, blush specks) that aren't dark lines
    hole=op&~cur&(L[...,0]>=50)
    hl,hs=comps(hole)
    H,W=cur.shape
    for i in np.nonzero((hs>0)&(hs<=30))[0]:
        if i==0: continue
        ys,xs=np.nonzero(hl==i)
        if ys.min()==0 or xs.min()==0 or ys.max()==H-1 or xs.max()==W-1: continue
        ring=np.zeros_like(cur); ring[np.clip(ys+1,0,H-1),xs]=1; ring[np.clip(ys-1,0,H-1),xs]=1; ring[ys,np.clip(xs+1,0,W-1)]=1; ring[ys,np.clip(xs-1,0,W-1)]=1
        ring&=~(hl==i)
        if cur[ring].mean()>0.9: cur[hl==i]=True
    w=cur.astype(float)
    # the reddish skin outline right next to the skin (1 px), so darker tones get no orange halo
    nb=np.zeros_like(cur)
    nb[1:]|=cur[:-1]; nb[:-1]|=cur[1:]; nb[:,1:]|=cur[:,:-1]; nb[:,:-1]|=cur[:,1:]
    line=nb&~cur&op&(L[...,0]>=28)&(L[...,0]<62)&(ch>=14)&(hue>=25)&(hue<=75)
    w=np.where(line,0.85,w)
    # soft edge: 2 px of anti-aliased skin-ish pixels around it get a partial weight
    edge=cur.copy()
    for it in range(2):
        nb=np.zeros_like(edge)
        nb[1:]|=edge[:-1]; nb[:-1]|=edge[1:]; nb[:,1:]|=edge[:,:-1]; nb[:,:-1]|=edge[:,1:]
        ring=nb&~edge&op&(d<16)&(ch>10)&(L[...,0]>30)
        w=np.where(ring,np.maximum(w,np.clip(1-(d-7)/12,0.35,1)),w)
        edge=edge|ring
    return (w*255).astype(np.uint8)
names=[f[:-4] for f in sorted(os.listdir(AV)) if f.endswith('.png') and not f.startswith('acc-')]
for n in (sys.argv[1:] or names):
    m=mask(AV+n+'.png'); Image.fromarray(m,'L').save(OUT+n+'.png',optimize=True)
print('ok',len(sys.argv[1:] or names))
