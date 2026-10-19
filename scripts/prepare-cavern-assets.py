"""Pack narrow terrain skins and register their exposed planes and joint turns.

Generated alpha is preserved. Only atlas metadata and WebP encoding are produced;
no background removal, recoloring, or synthesized artwork happens here.
"""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
atlas = {}
for name, cols, rows in [('edges-v2', 1, 4), ('walls-v2', 4, 1),
                         ('joins-floor-v2', 4, 4), ('joins-ceiling-v2', 4, 4),
                         ('growth-v2', 4, 2)]:
    source = root / f'art/forest-caverns/{name}-source.png'
    im = Image.open(source).convert('RGBA')
    frames = []
    for row in range(rows):
        for col in range(cols):
            left, top = round(im.width * col / cols), round(im.height * row / rows)
            right, bottom = round(im.width * (col + 1) / cols), round(im.height * (row + 1) / rows)
            alpha = im.getchannel('A').crop((left, top, right, bottom))
            box = alpha.point(lambda v: 255 if v > 96 else 0).getbbox()
            assert box, f'Missing {name} frame {row * cols + col}'
            x0, y0, x1, y1 = box
            frame = {'rect': [left + x0, top + y0, x1 - x0, y1 - y0]}
            if name in ('edges-v2', 'walls-v2'):
                # Measure a continuous material band, ignoring sparse moss tips.
                a = alpha.crop(box)
                if name == 'walls-v2':
                    a = a.transpose(Image.Transpose.TRANSPOSE)
                reverse = (row >= 2 if name == 'edges-v2' else col >= 2)
                if reverse:
                    a = a.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                occupied = [y for y in range(a.height)
                            if sum(a.crop((0, y, a.width, y + 1)).histogram()[181:]) > a.width * .65]
                assert occupied, f'No material band in {name}'
                frame['surface'] = occupied[0]
            elif name == 'growth-v2':
                frame['anchor'] = [(x1 - x0) * (.12 if row == 0 else .5),
                                   (y1 - y0) * (.5 if row == 0 else .02)]
            else:
                # The generator places turns relative to the painted bounds,
                # not consistently at cell center. Register that actual turn.
                inner, ceiling = row >= 2, 'ceiling' in name
                ax = .25 if inner else .10
                ay = (.20 if inner else .58) if ceiling else (.74 if inner else .10)
                frame['anchor'] = [(x1 - x0) * ax, (y1 - y0) * ay]
            frames.append(frame)
    atlas[name] = frames
    output = root / f'public/assets/forest-cave-{name}.webp'
    if not output.exists() or output.stat().st_mtime < source.stat().st_mtime:
        im.save(output, quality=91, method=6)
(root / 'src/forest-cave-art.json').write_text(json.dumps(atlas, indent=2) + '\n')
print(f'Packed {len(atlas)} narrow terrain atlases, preserving generated transparency.')
