"""Pack generated art without repainting it; preserve source alpha and registration."""
from pathlib import Path
from PIL import Image
import json,importlib.util
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/assets';ART=ROOT/'art/expansion'
spec=importlib.util.spec_from_file_location('packing',ROOT/'scripts/prepare-creatures.py');packing=importlib.util.module_from_spec(spec);spec.loader.exec_module(packing)
meta={}
for key in ['marsh','storm','belfry','depths','lake']:
 im=Image.open(ART/f'{key}-background-source.png');im.save(OUT/f'{key}-background.webp',quality=90,method=6)
 # The opaque lower rock face supplies interior fill; the transparent kit supplies edges.
 terrain=Image.open(ART/f'{key}-terrain-source.png');terrain.thumbnail((768,768));terrain.save(OUT/f'{key}-terrain.webp',quality=89,method=6)
 ledges=Image.open(ART/f'{key}-ledges-source.png');ledges.save(OUT/f'{key}-ledges.webp',quality=90,method=6)
 frames=[]
 for i in range(8):
  x=round(i%4*ledges.width/4);y=round(i//4*ledges.height/2);x2=round((i%4+1)*ledges.width/4);y2=round((i//4+1)*ledges.height/2)
  tile=ledges.crop((x,y,x2,y2));a=tile.getchannel('A');w,h=tile.size
  spans=[sum(v>60 for v in a.crop((0,j,w,j+1)).getdata()) for j in range(h)]
  # First full-width rock rim below the taller decorative ruins.
  top=next((j for j,n in enumerate(spans) if n>=max(spans)*.93),h//2)
  frames.append({'rect':[x,y,x2-x,y2-y],'top':top})
 meta[key]=frames
im=Image.open(ART/'town-background-source.png');im.save(OUT/'town-background.webp',quality=92,method=6)
for i in range(3):
 meta[f'town-npcs-{i}']=packing.pack(f'town-npcs-{i}',ART/f'town-npcs-{i}-source.png')
 atlas=Image.open(OUT/f'town-npcs-{i}-atlas.webp')
 for row in range(4):atlas.crop((0,row*256,256,(row+1)*256)).save(OUT/f'npc-{i}-{row}.webp',quality=90,method=6)
Image.open(ART/'world-secrets-reference.png').save(OUT/'world-secrets.webp',quality=93,method=6)
(OUT/'expansion.json').write_text(json.dumps(meta,indent=2)+'\n')
print('Packed expansion assets')
# Exact token illustrations cropped from the supplied progression board.
from collections import deque
board=Image.open(ROOT/'inputs/7a06ef01-a2cc-4817-9f2a-afeae65be50d.JPG').convert('RGBA')
for i,cx in enumerate([69,178,291,408,527]):
 tile=board.crop((cx-44,160,cx+44,249));px=tile.load();w,h=tile.size;q=deque([(x,0) for x in range(w)]+[(x,h-1) for x in range(w)]+[(0,y) for y in range(h)]+[(w-1,y) for y in range(h)]);seen=set()
 while q:
  x,y=q.popleft()
  if x<0 or y<0 or x>=w or y>=h or (x,y) in seen:continue
  seen.add((x,y));r,g,b,a=px[x,y]
  if max(r,g,b)<65 and r+g+b<140: px[x,y]=(r,g,b,0);q.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
 tile.save(OUT/f'token-type-{i}.webp',quality=93,method=6)

# Six animation rows: four attacks, awakening, hit/defeat.
bosses={}
for key in ['marsh','storm','belfry','depths','lake']:
 name=key+'-boss-attacks';bosses[name]=packing.pack(name,ART/(name+'-source.png'),24,320)
(OUT/'expansion-bosses.json').write_text(json.dumps(bosses,indent=2)+'\n')
