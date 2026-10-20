"""Encode the five generated materials without altering their artwork."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art/biome-terrain"
for asset in json.loads((ART / "prompts.json").read_text())["assets"]:
    image = Image.open(ART / asset["source"]).convert("RGB").resize((1024, 1024))
    image.save(ROOT / "public/assets" / f"{asset['key']}-surface-v1.webp", quality=88)
