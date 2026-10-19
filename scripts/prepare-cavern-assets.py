"""Encode generated cavern atlases and measure their existing alpha contours."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
atlas = {}
for name, cols, rows in [('floors', 1, 2), ('ceilings', 1, 2),
                         ('walls', 2, 1), ('details', 4, 2),
                         ('corners-floor-left', 4, 4), ('corners-floor-right', 4, 4),
                         ('corners-ceiling-left', 4, 4), ('corners-ceiling-right', 4, 4),
                         ('attachments', 4, 4)]:
    source = root / f'art/forest-caverns/{name}-source.png'
    im = Image.open(source).convert('RGBA')
    frames = []
    for row in range(rows):
        for col in range(cols):
            left, top = round(im.width * col / cols), round(im.height * row / rows)
            right, bottom = round(im.width * (col + 1) / cols), round(im.height * (row + 1) / rows)
            if name == 'details':
                # The generated objects use unequal gutters; retain complete
                # root tips rather than cutting them at an assumed grid line.
                cuts = [0, 384, 780, 1216, 1536] if row == 0 else [0, 425, 790, 1185, 1536]
                left, right = cuts[col], cuts[col + 1]
                top, bottom = (0, 540) if row == 0 else (540, 1024)
            alpha = im.getchannel('A').crop((left, top, right, bottom))
            box = alpha.point(lambda v: 255 if v > 96 else 0).getbbox()
            assert box, f'Missing {name} frame {row * cols + col}'
            x0, y0, x1, y1 = box
            frame = {'rect': [left + x0, top + y0, x1 - x0, y1 - y0]}
            if name in ('floors', 'ceilings'):
                # The opaque band marks collision, excluding grass / hanging roots.
                occupied = [y for y in range(y0, y1)
                            if sum(alpha.crop((x0, y, x1, y + 1)).histogram()[181:])
                            > (x1 - x0) * .85]
                assert occupied, f'No continuous material band in {name}'
                frame['surface'] = (occupied[0] if name == 'floors' else occupied[-1]) - y0
            if name.startswith('corners-'):
                frame['rect'] = [left, top, right - left, bottom - top]
                # Register the painted turn, not the transparent cell center.
                # Corner orientation is preserved; no ceiling art is inverted.
                inner = row >= 2
                ceiling = 'ceiling' in name
                ax = .3 if inner else (.15 if ceiling else .12)
                ay = (.25 if inner else .52) if ceiling else (.72 if inner else .12)
                if name.endswith('right'):
                    ax = 1 - ax
                frame['anchor'] = [x0 + (x1 - x0) * ax, y0 + (y1 - y0) * ay]
            frames.append(frame)
    atlas[name] = frames
    output = root / f'public/assets/forest-cave-{name}.webp'
    if not output.exists() or output.stat().st_mtime < source.stat().st_mtime:
        im.save(output, quality=91, method=6)
(root / 'src/forest-cave-art.json').write_text(json.dumps(atlas, indent=2) + '\n')
print(f'Packed {len(atlas)} cavern atlases, preserving generated transparency.')
