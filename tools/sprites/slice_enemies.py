# Converts 9x6 side-view battler sheets (18 motions x 3 frames) into a compact atlas:
# rows = walk, wait, attack, damage, dead (3 frames each), at half resolution.
# Usage: python slice_enemies.py <out_dir> <id>=<sheet.png> ...
import sys, json
from PIL import Image
MOTIONS = {'walk': 0, 'wait': 1, 'attack': 6, 'damage': 4, 'dead': 17}  # standard motion indices
SCALE = 0.5
def cell(sheet, idx, f):
    cw, ch = sheet.width // 9, sheet.height // 6
    x = (idx // 6) * 3 + f; y = idx % 6
    return sheet.crop((x * cw, y * ch, (x + 1) * cw, (y + 1) * ch))
out = sys.argv[1]; meta = {}
for arg in sys.argv[2:]:
    uid, path = arg.split('=', 1)
    sh = Image.open(path).convert('RGBA')
    cw, ch = sh.width // 9, sh.height // 6
    atlas = Image.new('RGBA', (cw * 3, ch * len(MOTIONS)))
    for r, (name, idx) in enumerate(MOTIONS.items()):
        for f in range(3): atlas.paste(cell(sh, idx, f), (f * cw, r * ch))
    bb = atlas.getchannel('A').getbbox()
    atlas = atlas.resize((round(atlas.width * SCALE), round(atlas.height * SCALE)), Image.LANCZOS)
    atlas.save(f'{out}/{uid}.webp', 'WEBP', quality=86, method=6)
    meta[uid] = {'frameW': round(cw * SCALE), 'frameH': round(ch * SCALE), 'cols': 3, 'anims': {n: {'row': i, 'frames': 3} for i, n in enumerate(MOTIONS)}}
    print(uid, meta[uid]['frameW'])
json.dump(meta, open(f'{out}/enemies.json', 'w'), indent=1)
