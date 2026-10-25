"""Bake generated leg artwork into the original eight run cells only.

Original torso, head, equipment, cloak and tail pixels are retained as a foreground
plate. This is an offline sprite packer: the game still draws one complete cell.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art/characters/run-eight-v1"
CELL = 384


def polygon_mask(polygons):
    mask = Image.new("L", (CELL, CELL))
    draw = ImageDraw.Draw(mask)
    for polygon in polygons:
        draw.polygon([tuple(p) for p in polygon], fill=255)
    return mask


def pack(name, config):
    atlas = Image.open(ROOT / f"public/assets/hero-{name}-painted-atlas.webp").convert("RGBA")
    original = atlas.crop((0, CELL, 1536, CELL * 3))
    legs = Image.open(ART / f"{name}-legs.png").convert("RGBA")
    legs = legs.resize((1536, 768), Image.Resampling.LANCZOS)
    sheet = Image.new("RGBA", original.size)
    body_sheet = Image.new("RGBA", original.size)
    masks = Image.new("L", original.size)
    for i, pose in enumerate(config["poses"]):
        x, y = i % 4 * CELL, i // 4 * CELL
        box = (x, y, x + CELL, y + CELL)
        body = original.crop(box)
        mask = polygon_mask(pose["remove"]).filter(ImageFilter.MaxFilter(5))
        if pose.get("protect"):
            mask = ImageChops.subtract(mask, polygon_mask(pose["protect"]))
        body.putalpha(ImageChops.subtract(body.getchannel("A"), mask))
        scale = config["scale"]
        hx, hy = pose["sourceHip"]
        tx, ty = pose["hip"]
        leg_cell = legs.crop(box)
        if source := pose.get("legSource"):
            # Wider source crops retain the complete leaping feet. The scale
            # converts source pixels to the same limb size as the other poses.
            leg_cell = Image.open(ART / source["file"]).convert("RGBA").crop(tuple(source["box"]))
            leg_cell.putalpha(leg_cell.getchannel("A").point(lambda a: 0 if a < 3 else a))
            scale = source["scale"]
            hx, hy = source["hip"]
        layer = leg_cell.transform(
            (CELL, CELL), Image.Transform.AFFINE,
            (1 / scale, 0, hx - tx / scale, 0, 1 / scale, hy - ty / scale),
            Image.Resampling.BICUBIC,
        )
        if pose.get("legSource"):
            # The wide stride must keep its complete toes inside the final cell.
            visible = layer.getchannel("A").point(lambda a: 255 if a > 8 else 0)
            assert visible.crop((0, 0, 3, CELL)).getbbox() is None, (name, i, "left foot clipped")
            assert visible.crop((CELL - 3, 0, CELL, CELL)).getbbox() is None, (name, i, "right foot clipped")
        # Legs cross in front of the tail and rear cloak; retain the original
        # torso and foreground loincloth above the new hip connections.
        composed = Image.alpha_composite(body, layer)
        foreground = polygon_mask(pose.get("foreground", []))
        ImageDraw.Draw(foreground).rectangle((0, 0, CELL, ty + 4), fill=255)
        keep = ImageChops.multiply(
            foreground, body.getchannel("A").point(lambda a: 255 if a else 0)
        )
        composed.paste(body, (0, 0), keep)
        composed.paste(original.crop((x, y, x + CELL, y + 220)), (0, 0))
        sheet.paste(composed, (x, y))
        body_sheet.paste(body, (x, y))
        masks.paste(mask, (x, y))
    # Clear hidden RGB from removed limbs for clean previews and alpha resampling.
    sheet.paste((0, 0, 0, 0), (0, 0), sheet.getchannel("A").point(lambda a: 0 if a else 255))
    sheet.save(ART / f"{name}-corrected-run.png")
    body_sheet.save(ART / f"{name}-preserved-body.png")
    masks.save(ART / f"{name}-leg-mask.png")
    atlas.paste(sheet, (0, CELL))
    # Lossless output keeps every non-running cell and retained body pixel intact.
    atlas.save(ROOT / f"public/assets/hero-{name}-run-eight-atlas.webp", "WEBP", lossless=True, method=6)
    return sheet


if __name__ == "__main__":
    config = json.loads((ART / "registration.json").read_text())
    for name, values in config.items():
        pack(name, values)
