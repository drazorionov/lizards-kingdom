"""Encode the approved concept sheet unchanged; register six irregular sprites.

Gutter polygons separate staggered drawings without cutting trailing roots or
including a neighboring concept. Generated pixels and alpha are preserved.
"""
from pathlib import Path
from PIL import Image
import json
root = Path(__file__).resolve().parents[1]
im = Image.open(root / 'art/forest-caverns/overlay-concepts-v1.png')
assert im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] == 0
im.save(root / 'public/assets/forest-cave-overlays-v1.webp', quality=94, method=6)
frames = [
    dict(name='ledge-corner', rect=[0,0,570,580], anchor=[430,170], polygon=[[0,0],[570,0],[570,580],[360,580],[330,460],[0,460]]),
    dict(name='wall-garden', rect=[600,0,340,580], anchor=[105,280], polygon=[[0,0],[340,0],[340,580],[0,580]]),
    dict(name='ceiling-drape', rect=[950,0,586,470], anchor=[293,150], polygon=[[0,0],[586,0],[586,470],[0,470]]),
    dict(name='floor-corner', rect=[0,470,605,554], anchor=[145,405], polygon=[[0,0],[320,0],[360,150],[605,150],[605,554],[0,554]]),
    dict(name='ceiling-corner', rect=[575,565,565,459], anchor=[370,110], polygon=[[0,0],[565,0],[565,459],[80,459],[80,370],[0,370]]),
    dict(name='wall-bloom', rect=[1150,475,386,549], anchor=[130,270], polygon=[[0,0],[386,0],[386,549],[0,549]]),
]
(root / 'src/forest-overlays.json').write_text(json.dumps(frames, indent=2)+'\n')
print('Encoded six approved overlays with original alpha.')
