# Slices character sprite sheets (4 rows: idle, attack, move, extra) into a uniform frame atlas.
# Usage: python slice_units.py <out_dir> <id>=<sheet.png> ...   (sheets must already be transparent)
import sys, json
import numpy as np
from PIL import Image

ANIMS = ['idle', 'attack', 'move', 'extra']
SCALE = 0.8

def runs(mask1d, min_gap, min_len):
    out, start, gap = [], None, 0
    for i, v in enumerate(mask1d):
        if v:
            if start is None: start = i
            gap = 0; end = i
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                if end - start + 1 >= min_len: out.append((start, end + 1))
                start = None
    if start is not None and end - start + 1 >= min_len: out.append((start, end + 1))
    return out

def slice_sheet(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)[..., 3].astype(int)
    a[a < 40] = 0
    arr = np.array(im); arr[..., 3] = a
    im = Image.fromarray(arr)
    mask = a > 0
    bands = runs(mask.sum(1) > 3, min_gap=8, min_len=90)        # rows of frames (drops label text)
    frames = []
    # typical frame width = median of idle-row segments (effects never bridge idle frames)
    idle = runs(mask[bands[0][0]:bands[0][1]].sum(0) > 2, min_gap=5, min_len=40)
    typical = float(np.median([b - a for a, b in idle]))
    pitch = float(np.median([idle[i + 1][0] - idle[i][0] for i in range(len(idle) - 1)]))
    for (y0, y1) in bands[:4]:
        band = mask[y0:y1]
        raw = runs(band.sum(0) > 2, min_gap=5, min_len=40)       # frames (drops thin grid lines)
        segs = []
        for (a, b) in raw:  # effect trails can bridge frames: split by the sheet's frame pitch
            k = max(1, round((b - a - typical) / pitch) + 1) if (b - a) > typical * 1.5 else 1
            step = (b - a) / k
            segs += [(int(a + i * step), int(a + (i + 1) * step)) for i in range(k)]
        row = []
        for (x0, x1) in segs:
            sub = band[:, x0:x1]
            ys = np.where(sub.any(1))[0]
            fy0, fy1 = y0 + ys[0], y0 + ys[-1] + 1
            feet = sub[ys[-1] - int((ys[-1] - ys[0]) * 0.25):ys[-1] + 1]
            cols = np.where(feet.any(0))[0]
            cx = x0 + (cols[0] + cols[-1]) / 2 if len(cols) else (x0 + x1) / 2
            row.append(dict(box=(x0, fy0, x1, fy1), cx=cx))
        frames.append(row)
    return im, frames

def build(uid, path, out):
    im, rows = slice_sheet(path)
    left = max(f['cx'] - f['box'][0] for r in rows for f in r)
    right = max(f['box'][2] - f['cx'] for r in rows for f in r)
    h = max(f['box'][3] - f['box'][1] for r in rows for f in r)
    fw, fh = int(left + right) + 4, int(h) + 4
    ncol = max(len(r) for r in rows)
    atlas = Image.new('RGBA', (fw * ncol, fh * len(rows)), (0, 0, 0, 0))
    meta = {'frameW': round(fw * SCALE), 'frameH': round(fh * SCALE), 'anchorX': round((left + 2) * SCALE), 'anims': {}}
    for ri, r in enumerate(rows):
        for ci, f in enumerate(r):
            x0, y0, x1, y1 = f['box']
            crop = im.crop((x0, y0, x1, y1))
            px = int(left - (f['cx'] - x0)) + 2
            atlas.paste(crop, (ci * fw + px, ri * fh + (fh - 2 - (y1 - y0))), crop)
        meta['anims'][ANIMS[ri]] = {'row': ri, 'frames': len(r)}
    atlas = atlas.resize((round(atlas.width * SCALE), round(atlas.height * SCALE)), Image.LANCZOS)
    atlas.save(f'{out}/{uid}.webp', 'WEBP', quality=88, method=6)
    meta['cols'] = ncol
    return meta

if __name__ == '__main__':
    out = sys.argv[1]; allmeta = {}
    for arg in sys.argv[2:]:
        uid, path = arg.split('=', 1)
        allmeta[uid] = build(uid, path, out)
        print(uid, allmeta[uid])
    json.dump(allmeta, open(f'{out}/units.json', 'w'), indent=1)
