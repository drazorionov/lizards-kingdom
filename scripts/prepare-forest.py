"""Convert source paintings; pack boss poses with the shared alpha-preserving packer."""
from pathlib import Path
from PIL import Image
import importlib.util,json
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('packing',ROOT/'scripts/prepare-creatures.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
for name in ['canopy','roots','sanctum','terrain','ledges']:
    im=Image.open(ROOT/f'art/forest/{name}-source.png')
    im.save(ROOT/f'public/assets/forest-{name}.webp',quality=88,method=6)
meta=m.pack('forest-mother-attacks',ROOT/'art/forest/mother-attacks-source.png',24,320)
(ROOT/'public/assets/forest-mother.json').write_text(json.dumps(meta,indent=2)+'\n')
