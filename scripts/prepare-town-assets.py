"""Compile generated town paintings to WebP and record alpha sprite bounds.
No artwork is repainted: sources and their alpha are preserved in art/town.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'art/town'
out = ROOT / 'public/assets'
meta = {'homes': [], 'platforms': []}
for name in ['tree', 'homes', 'platforms']:
    im = Image.open(source / f'{name}-source.png').convert('RGBA')
    im.save(out / f'town-{name}-painted.webp', quality=91, method=6)
    if name == 'tree':
        continue
    cols, rows = (4, 3) if name == 'homes' else (2, 2)
    boundaries = [0, 353, 705, im.height] if name == 'homes' else [0, 540, im.height]
    for row in range(rows):
        for col in range(cols):
            left, right = round(im.width * col / cols), round(im.width * (col + 1) / cols)
            top, bottom = boundaries[row:row + 2]
            alpha = im.getchannel('A').crop((left, top, right, bottom))
            bounds = alpha.point(lambda v: 255 if v >= 16 else 0).getbbox()
            assert bounds, (name, row, col)
            x0, y0, x1, y1 = bounds
            entry = {'rect': [left+x0, top+y0, x1-x0, y1-y0]}
            if name == 'platforms':
                # First near-continuous opaque row is the walkable surface.
                scan = alpha.load()
                surface = next(y for y in range(y0,y1) if sum(scan[x,y] > 128 for x in range(x0,x1)) > (x1-x0)*0.87)
                entry['surface'] = surface-y0
            meta[name].append(entry)
(ROOT / 'src/town-art.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta,indent=2))
