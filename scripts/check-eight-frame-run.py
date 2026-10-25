"""Check the packed artwork and render the actual eight-frame loops for review."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art/characters/run-eight-v1"
atlases = []


def same_visible_pixels(before, after):
    assert before.getchannel("A").tobytes() == after.getchannel("A").tobytes()
    mask = before.getchannel("A").point(lambda a: 255 if a else 0)
    diff = ImageChops.difference(before.convert("RGB"), after.convert("RGB"))
    visible = Image.new("RGB", before.size)
    visible.paste(diff, (0, 0), mask)
    assert visible.getbbox() is None


for name in ["quirel", "urmasa"]:
    original = Image.open(ROOT / f"public/assets/hero-{name}-painted-atlas.webp").convert("RGBA")
    corrected = Image.open(ROOT / f"public/assets/hero-{name}-run-eight-atlas.webp").convert("RGBA")
    assert original.size == corrected.size
    changed = []
    for frame in range(original.height // 384 * 4):
        x, y = frame % 4 * 384, frame // 4 * 384
        box = (x, y, x + 384, y + 384)
        before, after = original.crop(box), corrected.crop(box)
        if 4 <= frame <= 11:
            same_visible_pixels(before.crop((0, 0, 384, 220)), after.crop((0, 0, 384, 220)))
            assert before.crop((0, 220, 384, 384)).tobytes() != after.crop((0, 220, 384, 384)).tobytes()
            # Every foot has room below it; the sprite cell never cuts a toe off.
            assert after.getchannel("A").crop((0, 380, 384, 384)).getextrema()[1] == 0
            changed.append(frame)
        else:
            same_visible_pixels(before, after)
    assert changed == list(range(4, 12))
    atlases.append(corrected)
    print(f"{name}: eight corrected run poses; original upper bodies and all non-run poses preserved; feet inside cells")

contact = Image.new("RGB", (1536, 640), "#18232d")
draw = ImageDraw.Draw(contact)
preview = []
for pose in range(8):
    pair = Image.new("RGBA", (768, 420), "#18232d")
    pd = ImageDraw.Draw(pair)
    for hero, atlas in enumerate(atlases):
        frame = 4 + pose
        x, y = frame % 4 * 384, frame // 4 * 384
        sprite = atlas.crop((x, y, x + 384, y + 384))
        pair.alpha_composite(sprite, (hero * 384, 8))
        pd.line((hero * 384 + 12, 376, hero * 384 + 372, 376), fill="#6b8087")
        pd.text((hero * 384 + 12, 397), f"{'QUIREL' if hero == 0 else 'URMASA'} — pose {pose+1}/8", fill="#f0e4cc")
        small = sprite.resize((192, 192), Image.Resampling.LANCZOS)
        contact.paste(small, (pose * 192, hero * 320 + 90), small)
        draw.line((pose * 192 + 5, hero * 320 + 274, pose * 192 + 187, hero * 320 + 274), fill="#6b8087")
        draw.text((pose * 192 + 8, hero * 320 + 295), f"POSE {pose+1}", fill="#f0e4cc")
    preview.append(pair.convert("RGB"))
contact.save(ART / "contact-sheet.png")
preview[0].save(ART / "running-preview.gif", save_all=True, append_images=preview[1:], duration=[80, 80, 90, 80, 80, 90, 80, 90], loop=0, disposal=2)
