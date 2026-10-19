"""Package the vertical material atlas without repainting its generated alpha."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
im = Image.open(root / 'art/walls/vertical-walls-source.png').convert('RGBA')
frames = []
for col in range(6):
    left, right = round(im.width * col / 6), round(im.width * (col + 1) / 6)
    alpha = im.getchannel('A').crop((left, 0, right, im.height))
    box = alpha.point(lambda value: 255 if value > 96 else 0).getbbox()
    assert box, f'Missing wall material {col}'
    x0, y0, x1, y1 = box
    frames.append({'rect': [left + x0, y0, x1 - x0, y1 - y0],
                   'bodyTop': 110, 'bodyBottom': y1 - y0 - 110})
im.save(root / 'public/assets/vertical-walls-painted.webp', quality=91, method=6)
(root / 'src/wall-art.json').write_text(json.dumps(frames, indent=2) + '\n')
print('Packed six vertical wall materials, preserving source transparency.')
