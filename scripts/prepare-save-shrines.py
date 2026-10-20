"""Copy source art and encode transparent game sprites; preserve generated pixels.
Opaque foot bounds anchor the solid object, excluding its soft surrounding glow.
"""
import json
import shutil
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
records = json.loads((root / 'art/save-shrines/prompts.json').read_text())['assets']
anchors = []
for record in records:
    region = record['region']
    source = root / f'art/save-shrines/{record["key"]}-v1.png'
    if not source.exists():
        shutil.copyfile(record['source'], source)
    im = Image.open(source).convert('RGBA')
    assert im.getchannel('A').getextrema()[0] == 0
    bounds = im.getchannel('A').point(lambda a: 255 if a >= 192 else 0).getbbox()
    anchors.append(dict(foot=bounds[3] / im.height))
    im.thumbnail((768, 512), Image.Resampling.LANCZOS)
    im.save(root / f'public/assets/save-shrine-{region}-v1.webp', quality=92, method=6)
    print(record['key'], bounds, im.size)
(root / 'src/save-shrine-anchors.json').write_text(json.dumps(anchors, indent=2)+'\n')
