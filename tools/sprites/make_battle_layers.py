# Generates seamless, horizontally tiling silhouette layers (SVG) that scroll over the battle
# background so running reads clearly: a mid layer (pillars, collapsed slabs) and a ground layer
# (rubble, puddles, rebar) per lane. Colors match the flooded-city background.
import random, sys
random.seed(int(sys.argv[2]) if len(sys.argv) > 2 else 3)
out = sys.argv[1]
W = 1600

def mid():
    H = 520; p = []
    for x in range(0, W, 400):
        x0 = x + random.randint(40, 200); w = random.randint(44, 70)
        top = random.randint(0, 60)
        p.append(f'<rect x="{x0}" y="{top}" width="{w}" height="{H-top}" fill="#0d151c" opacity=".85"/>')
        for d in range(random.randint(2, 4)):  # drips of dark residue
            dx = x0 + random.randint(4, w - 8); dl = random.randint(60, 220)
            p.append(f'<rect x="{dx}" y="{top}" width="{random.randint(3,7)}" height="{dl}" fill="#05090c" opacity=".9"/>')
        p.append(f'<rect x="{x0-10}" y="{top}" width="{w+20}" height="14" fill="#101a22"/>')
    for x in range(0, W, 520):
        x0 = x + random.randint(150, 330); w = random.randint(140, 260); h = random.randint(50, 110)
        pts = f'{x0},{H} {x0+w*0.15},{H-h} {x0+w*0.55},{H-h*0.7} {x0+w*0.8},{H-h*1.1} {x0+w},{H}'
        p.append(f'<polygon points="{pts}" fill="#0f171e" opacity=".9"/>')
    return H, p

def ground():
    H = 140; p = []
    for x in range(0, W, 230):
        x0 = x + random.randint(0, 120); w = random.randint(70, 160); h = random.randint(18, 48)
        pts = f'{x0},{H} {x0+w*0.2},{H-h} {x0+w*0.5},{H-h*0.6} {x0+w*0.7},{H-h*0.9} {x0+w},{H}'
        p.append(f'<polygon points="{pts}" fill="#0a1117"/>')
        if random.random() < 0.5:
            rx = x0 + w * 0.4
            p.append(f'<line x1="{rx}" y1="{H-h}" x2="{rx+random.randint(-30,30)}" y2="{H-h-random.randint(20,50)}" stroke="#1b2731" stroke-width="3"/>')
    for x in range(0, W, 400):
        cx = x + random.randint(60, 340)
        p.append(f'<ellipse cx="{cx}" cy="{H-8}" rx="{random.randint(60,120)}" ry="7" fill="#7f9db0" opacity=".12"/>')
    return H, p

for name, fn in [('mid', mid), ('ground', ground)]:
    H, parts = fn()
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">' + ''.join(parts) + '</svg>'
    open(f'{out}/layer_{name}.svg', 'w').write(svg)
    print(name, W, H)
