"""Pack generated poses, preserving RGBA pixels, proportions and a fixed scale.

Connected components avoid clipping weapons/wings at nominal grid boundaries.
Runtime sheets are bounded; only the active region's creatures are decoded.
"""
from pathlib import Path
from collections import deque
from PIL import Image, ImageChops, ImageFilter
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets'

def extract(path, count):
    im=Image.open(path).convert('RGBA'); width,height=im.size
    alpha=im.getchannel('A'); mask=bytearray(alpha.point(lambda a:255 if a>40 else 0).tobytes())
    parts=[]
    for start in range(len(mask)):
        if not mask[start]: continue
        mask[start]=0; queue=deque([start]); pixels=[]; l,t,r,b=width,height,0,0
        while queue:
            p=queue.popleft(); y,x=divmod(p,width); pixels.append(p)
            l,t,r,b=min(l,x),min(t,y),max(r,x),max(b,y)
            for n in (p-1 if x else -1,p+1 if x<width-1 else -1,p-width,p+width):
                if 0<=n<len(mask) and mask[n]: mask[n]=0; queue.append(n)
        if len(pixels)>1200: parts.append({'pixels':pixels,'box':(l,t,r+1,b+1)})
    # Some generated sheets have a one-pixel contact between neighboring poses.
    # Split an oversized component along its sparsest grid seam, keeping both halves.
    split=[]
    for part in parts:
        pending=[part]
        while pending:
            c=pending.pop();l,t,r,b=c['box']
            axis=0 if r-l>width/4*1.5 else 1 if b-t>height/(count//4)*1.5 else None
            if axis is None: split.append(c);continue
            unit=width/4 if axis==0 else height/(count//4)
            low,high=(l,r) if axis==0 else (t,b)
            boundary=round(((low+high)/2)/unit)*unit
            coords=[(pos%width if axis==0 else pos//width) for pos in c['pixels']]
            hist={v:0 for v in range(int(boundary-unit*.15),int(boundary+unit*.15)+1)}
            for v in coords:
                if v in hist:hist[v]+=1
            seam=min(hist,key=hist.get)
            for side in [False,True]:
                pix=[pos for pos,v in zip(c['pixels'],coords) if (v>=seam)==side]
                if not pix:raise ValueError('Cannot isolate touching sprites')
                xs=[v%width for v in pix];ys=[v//width for v in pix]
                pending.append({'pixels':pix,'box':(min(xs),min(ys),max(xs)+1,max(ys)+1)})
    parts=split
    parts.sort(key=lambda p:len(p['pixels']),reverse=True)
    if len(parts)<count: raise ValueError(f'{path.name}: only {len(parts)} connected poses; expected {count}')
    parts=parts[:count]
    parts.sort(key=lambda p:(p['box'][1]+p['box'][3])/2)
    ordered=[]
    for row in range(count//4): ordered.extend(sorted(parts[row*4:row*4+4],key=lambda p:p['box'][0]))
    tiles=[]
    for p in ordered:
        l,t,r,b=p['box']; box=(max(0,l-3),max(0,t-3),min(width,r+3),min(height,b+3))
        raw=bytearray(width*height)
        for pos in p['pixels']: raw[pos]=255
        component=Image.frombytes('L',im.size,bytes(raw)).filter(ImageFilter.MaxFilter(5))
        tile=im.crop(box); tile.putalpha(ImageChops.multiply(alpha,component).crop(box))
        tiles.append((tile,box))
    return tiles

def pack(key,path,count=16,cell=256,hero=False):
    tiles=extract(path,count)
    scale=min((cell-20)/max(t.width for t,b in tiles),(cell-32)/max(t.height for t,b in tiles))
    anchor=(round(cell*.5),cell-16)
    sheet=Image.new('RGBA',(cell*4,cell*(count//4)))
    frames=[]
    for i,(tile,box) in enumerate(tiles):
        size=(round(tile.width*scale),round(tile.height*scale)); tile=tile.resize(size,Image.Resampling.LANCZOS)
        # Keep each pose on the same floor; uniform scaling preserves crouches.
        x=anchor[0]-tile.width//2; y=anchor[1]-tile.height
        sheet.alpha_composite(tile,((i%4)*cell+x,(i//4)*cell+y))
        frames.append({'rect':[(i%4)*cell,(i//4)*cell,cell,cell],'sourceBounds':box})
    filename=f'{key}-atlas.webp'; sheet.save(OUT/filename,'WEBP',quality=90,method=6)
    print(key,count,'poses',round((OUT/filename).stat().st_size/1024),'KiB')
    return {'atlas':filename,'cell':cell,'anchor':anchor,'frames':frames,'source':str(path.relative_to(ROOT))}

if __name__=='__main__':
    sources={}
    for suffix in ['-v2-source.png','-painted-source.png']:
        for path in sorted((ROOT/'art/creatures').glob('*'+suffix)):
            sources[path.name.replace(suffix,'')]=path
    meta={key:pack(key,path) for key,path in sorted(sources.items())}
    (OUT/'creatures.json').write_text(json.dumps(meta,indent=2)+'\n')
    heroes={}
    for name,count in [('quirel',24),('urmasa',16)]:
        key=f'hero-{name}-painted'
        heroes[name]=pack(key,ROOT/f'art/characters/{name}-painted-source.png',count,384,True)
        im=Image.open(OUT/f'{key}-atlas.webp')
        im.crop((0,0,384,384)).save(OUT/f'{key}-portrait.webp','WEBP',quality=93,method=6)
    (OUT/'heroes-painted.json').write_text(json.dumps(heroes,indent=2)+'\n')
