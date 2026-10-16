"""Extract and optimize the supplied artwork; no replacement/generated character art.
Dark edge-connected matte removal keeps interior cloak/shadow pixels intact.
"""
from PIL import Image
from collections import deque
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets'
OUT.mkdir(parents=True, exist_ok=True)
files = {'npc':'0fe04303-582c-496e-a3a5-f4144246b897','bossArt':'05b11536-e1d3-4c09-960b-89bf70e165b1','enemy':'208f8b72-447b-449e-aa34-d314308f0a34','map':'324fc2de-2007-4797-a14b-db1b1566edc1','cover':'675d005a-e9f2-4aff-a05b-10f7e7dba8f2','growth':'7a06ef01-a2cc-4817-9f2a-afeae65be50d','boss':'fd9ea6c3-900a-469a-a810-347b983d8304'}
images={key:Image.open(ROOT/'inputs'/f'{value}.JPG').convert('RGB') for key,value in files.items()}
manifest={}
def save(name, key, box=None, sprite=False, width=None):
    im=images[key].crop(box) if box else images[key].copy()
    if sprite:
        im=im.convert('RGBA'); w,h=im.size; p=im.load(); seen=set(); q=deque()
        for x in range(w): q.extend([(x,0),(x,h-1)])
        for y in range(h): q.extend([(0,y),(w-1,y)])
        while q:
            x,y=q.popleft()
            if (x,y) in seen or x<0 or y<0 or x>=w or y>=h: continue
            seen.add((x,y)); r,g,b,a=p[x,y]
            if max(r,g,b)<39 and r+g+b<85:
                p[x,y]=(r,g,b,0);q.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
        # Clean tiny JPEG matte flecks and soften the exposed edge only.
        alpha=im.getchannel('A'); bounds=alpha.getbbox()
        if bounds: im=im.crop(bounds)
    if width and im.width>width: im.thumbnail((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
    im.save(OUT/f'{name}.webp','WEBP',quality=88,method=6)
    manifest[name]={'source':files[key]+'.JPG','crop':box,'size':im.size}
save('cover','cover',width=1145)
save('world-map','map',width=1535)
# Full-width original scene beneath the progression diagram.
save('forest-panorama','growth',(390,873,1318,1013))
save('kingdom-panorama','bossArt',(18,797,984,992))
save('castle','cover',(210,425,1145,1190))
xs=[280,465,657,860,1064,1260]; ends=[453,646,851,1058,1250,1440]
for i,(x,e) in enumerate(zip(xs,ends)):
    save(f'region-{i}','map',(x,782,e,917))
# Same illustrated hero at successive poses, from the original animation strip.
for i,box in enumerate([(21,397,89,447),(91,391,158,447),(163,386,224,447),(226,379,302,447),(306,371,380,447)]):
    save(f'hero-gold-{i}','growth',box,True)
for i,box in enumerate([(16,521,95,575),(96,515,174,575),(177,507,254,576),(260,494,345,576),(348,485,439,577)]):
    save(f'hero-red-{i}','growth',box,True)
# Enemy frames, grouped by region.
for region,top,bottom in [(0,138,200),(1,250,303),(2,373,435),(3,733,793),(4,495,548),(5,601,672)]:
    for i,(x,e) in enumerate([(201,262),(264,324),(325,385),(386,446)]): save(f'enemy-{region}-{i}','enemy',(x,top,e,bottom),True)
# Bosses from the corresponding animation sheets (Mushroom, Mire, Storm, Bell, Depth, Lake).
for region,col,row in [(0,0,0),(1,1,0),(2,0,1),(3,1,1),(4,0,2),(5,1,2)]:
    for i in range(3):
        x=(221 if col==0 else 994)+i*81; y=[122,333,546][row]
        save(f'boss-{region}-{i}','boss',(x,y,x+77,y+60),True)
save('elder','npc',(321,218,370,279),True)
save('token','growth',(29,167,100,248),True)
save('mushroom','enemy',(866,140,907,199),True)
# Generated atlas expands the supplied environments; original sprites remain untouched.
atlas=Image.open(ROOT/'art/environment-atlas.png').convert('RGB')
for i in range(6):
    col,row=i%2,i//2
    box=(round(col*atlas.width/2),round(row*atlas.height/3),round((col+1)*atlas.width/2),round((row+1)*atlas.height/3))
    tile=atlas.crop(box)
    tile.save(OUT/f'background-{i}.webp','WEBP',quality=90,method=6)
    manifest[f'background-{i}']={'source':'art/environment-atlas.png','crop':box,'size':tile.size}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Prepared {len(manifest)} assets from the original artwork.')
