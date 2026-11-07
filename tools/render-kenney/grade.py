# Crops rendered sprites to content and applies the game's cold, desaturated grade.
import sys, glob, os
from PIL import Image, ImageEnhance
src, dst = sys.argv[1], sys.argv[2]
for f in sorted(glob.glob(src + '/*.png')):
    im = Image.open(f).convert('RGBA')
    bb = im.getchannel('A').getbbox()
    if not bb: continue
    im = im.crop(bb)
    a = im.getchannel('A')
    rgb = ImageEnhance.Color(im.convert('RGB')).enhance(0.45)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.05)
    tint = Image.new('RGB', rgb.size, (86, 120, 140))
    rgb = Image.blend(rgb, tint, 0.12)
    out = rgb.convert('RGBA'); out.putalpha(a)
    out.save(os.path.join(dst, os.path.basename(f)), optimize=True)
