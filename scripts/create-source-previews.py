"""Optional asset regeneration: Python 3 + Pillow. Originals are never overwritten."""
from pathlib import Path
import json
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
accounts = json.loads((root / 'src/data/accounts.json').read_text(encoding='utf-8'))
destination = root / 'public/source-previews'
destination.mkdir(exist_ok=True)
manifest = {}
before = after = 0
for account in accounts:
    original = root / 'public' / account['image'].lstrip('/')
    target = destination / (account['id'] + '.webp')
    with Image.open(original) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((640, 16000), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=78, method=6)
        manifest[account['id']] = {'width': image.width, 'height': image.height}
    before += original.stat().st_size
    after += target.stat().st_size
(root / 'src/data/source-previews.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(accounts)} presentation copies: {before} -> {after} bytes. Original collection files unchanged.')
