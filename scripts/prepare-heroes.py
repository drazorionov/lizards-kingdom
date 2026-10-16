"""Pack generated RGBA character poses without recoloring or painting their pixels.

Connected-component extraction keeps complete tails/weapons that cross the source
sheet's nominal grid lines. Shared scale, grounded foot registration, transparent
padding and inset texture coordinates prevent clipping, jitter and atlas bleeding.
"""
from PIL import Image, ImageChops, ImageFilter
from collections import deque
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets'
CELL = 384
ANCHOR = (260, 344)
metadata = {'version': 2, 'cellSize': CELL, 'anchor': list(ANCHOR), 'heroes': {}}
for hero in ['quirel', 'urmasa']:
    source = ROOT / 'art/characters' / f'{hero}-v2-source.png'
    im = Image.open(source).convert('RGBA')
    width, height = im.size
    alpha = im.getchannel('A')
    remaining = bytearray(alpha.point(lambda v: 255 if v > 32 else 0).tobytes())
    components = []
    for start in range(width * height):
        if not remaining[start]:
            continue
        remaining[start] = 0
        queue = deque([start])
        pixels = []
        left, top, right, bottom = width, height, 0, 0
        while queue:
            pos = queue.popleft()
            y, x = divmod(pos, width)
            pixels.append(pos)
            left, top, right, bottom = min(left, x), min(top, y), max(right, x), max(bottom, y)
            for neighbor in (pos - 1 if x else -1, pos + 1 if x < width - 1 else -1, pos - width, pos + width):
                if 0 <= neighbor < width * height and remaining[neighbor]:
                    remaining[neighbor] = 0
                    queue.append(neighbor)
        if len(pixels) > 10000:
            components.append({'pixels': pixels, 'box': (left, top, right + 1, bottom + 1)})
    if len(components) != 16:
        raise ValueError(f'{hero}: expected 16 isolated poses, got {len(components)}')
    rows = [[] for _ in range(4)]
    for component in components:
        left, top, right, bottom = component['box']
        row = min(3, int(((top + bottom) / 2) / height * 4))
        rows[row].append(component)
    if any(len(row) != 4 for row in rows):
        raise ValueError(f'{hero}: invalid four by four pose layout')
    ordered = [c for row in rows for c in sorted(row, key=lambda c: c['box'][0])]
    packed = Image.new('RGBA', (CELL * 4, CELL * 4))
    frames = []
    # Horizontal registration to the center of the head, not the changing cloak/tail bounds.
    # Per-pose head centers measured from the supplied high-resolution RGBA atlas.
    head_centers = ([208, 528, 843, 1153, 211, 542, 846, 1151, 217, 540, 850, 1159, 229, 552, 850, 1160]
                    if hero == 'quirel' else
                    [246, 553, 863, 1178, 252, 566, 862, 1180, 251, 566, 868, 1179, 274, 558, 866, 1166])
    for index, c in enumerate(ordered):
        left, top, right, bottom = c['box']
        box = (max(0, left - 3), max(0, top - 3), min(width, right + 3), min(height, bottom + 3))
        mask_bytes = bytearray(width * height)
        for pos in c['pixels']:
            mask_bytes[pos] = 255
        mask = Image.frombytes('L', (width, height), bytes(mask_bytes)).filter(ImageFilter.MaxFilter(3))
        tile = im.crop(box)
        tile.putalpha(ImageChops.multiply(alpha, mask).crop(box))
        # Head is in front of the feet. Keep the body origin under the hips.
        origin_x = head_centers[index] - 20
        offset = (round(ANCHOR[0] - (origin_x - box[0])), round(ANCHOR[1] - (bottom - box[1])))
        if offset[0] < 0 or offset[1] < 0 or offset[0]+tile.width > CELL or offset[1]+tile.height > CELL:
            raise ValueError(f'{hero} frame {index}: padding overflow')
        cell = Image.new('RGBA', (CELL, CELL))
        cell.alpha_composite(tile, offset)
        packed.alpha_composite(cell, ((index % 4)*CELL, (index // 4)*CELL))
        frames.append({'sourceBounds': list(box), 'origin': [origin_x, bottom], 'rect': [(index % 4)*CELL, (index // 4)*CELL, CELL, CELL]})
        if index == 0:
            cell.save(OUT / f'hero-{hero}-portrait-v2.webp', 'WEBP', quality=93, method=6)
    packed.save(OUT / f'hero-{hero}-atlas-v2.webp', 'WEBP', quality=93, method=6)
    metadata['heroes'][hero] = {'source': str(source.relative_to(ROOT)), 'atlas': f'hero-{hero}-atlas-v2.webp', 'frames': frames}
    print(hero, '16 poses packed;', (OUT / f'hero-{hero}-atlas-v2.webp').stat().st_size, 'bytes')
(OUT / 'heroes-v2.json').write_text(json.dumps(metadata, indent=2)+'\n')
