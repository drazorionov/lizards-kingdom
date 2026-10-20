"""Encode generated alpha atlases and register their actual material bounds.

Only WebP encoding and atlas metadata are produced; generated pixels and alpha
are preserved. Source PNGs and prompts remain in art/biome-caves.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art/biome-caves"
metadata = {}
for biome in ["marsh", "depths", "lake"]:
    atlas = {}
    for name, cols, rows in [
        ("edges-v3", 1, 4), ("walls-v3", 4, 1),
        ("joins-floor-v3", 4, 4), ("joins-ceiling-v3", 4, 4),
    ]:
        source = ART / biome / f"{name}-source.png"
        image = Image.open(source).convert("RGBA")
        alpha = image.getchannel("A")
        assert alpha.getextrema()[0] == 0, f"{source}: transparency missing"
        frames = []
        for row in range(rows):
            for col in range(cols):
                left, top = round(image.width*col/cols), round(image.height*row/rows)
                right, bottom = round(image.width*(col+1)/cols), round(image.height*(row+1)/rows)
                cell = alpha.crop((left, top, right, bottom))
                box = cell.point(lambda v: 255 if v > 96 else 0).getbbox()
                assert box, f"{source}: empty cell {col},{row}"
                x0, y0, x1, y1 = box
                frame = {"rect": [left+x0, top+y0, x1-x0, y1-y0]}
                if name in ("edges-v3", "walls-v3"):
                    band = cell.crop(box)
                    if name == "walls-v3":
                        band = band.transpose(Image.Transpose.TRANSPOSE)
                    reverse = row >= 2 if name == "edges-v3" else col >= 2
                    if reverse:
                        band = band.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                    occupied = [y for y in range(band.height)
                                if sum(band.crop((0,y,band.width,y+1)).histogram()[181:]) > band.width*.65]
                    assert occupied, f"{source}: no continuous material band"
                    frame["surface"] = occupied[0]
                else:
                    inner, ceiling = row >= 2, "ceiling" in name
                    ax = .25 if inner else .10
                    ay = (.20 if inner else .58) if ceiling else (.74 if inner else .10)
                    frame["anchor"] = [round((x1-x0)*ax,2), round((y1-y0)*ay,2)]
                frames.append(frame)
        atlas[name] = frames
        output = ROOT / "public/assets" / f"{biome}-cave-{name}.webp"
        image.save(output, quality=91, method=6)
        print(biome, name, image.size, len(frames), "frames")
    metadata[biome] = atlas
(ROOT / "src/biome-cave-art.json").write_text(json.dumps(metadata, indent=2)+"\n")
