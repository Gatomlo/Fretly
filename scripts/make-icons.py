"""Génère les icônes PNG de Fretly (même dessin que public/icon.svg). Usage : python scripts/make-icons.py
Nécessite Pillow. Sorties : public/icon-512.png, icon-192.png, apple-touch-icon.png."""
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

S = 3            # sur-échantillonnage pour des bords lisses
W = 512 * S


def bez(p0, p1, p2, p3, n=48):
    out = []
    for i in range(1, n + 1):
        t = i / n
        out.append(tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d
                         for a, b, c, d in zip(p0, p1, p2, p3)))
    return out


# Médiator : contour symétrique, large en haut, pointe arrondie en bas
PICK = [(256, 84)]
PICK += bez((256, 84), (360, 84), (424, 130), (410, 214))
PICK += bez((410, 214), (398, 296), (322, 400), (256, 436))
PICK += bez((256, 436), (190, 400), (114, 296), (102, 214))
PICK += bez((102, 214), (88, 130), (152, 84), (256, 84))


def gradient(c1, c2, vertical=True, diagonal=False):
    g = Image.linear_gradient('L').resize((W, W))          # noir (haut) -> blanc (bas)
    if diagonal:
        g = ImageChops.add(g.resize((W, W)), g.rotate(90).transpose(Image.FLIP_LEFT_RIGHT), scale=2)
    elif not vertical:
        g = g.rotate(90)
    return ImageOps.colorize(g, c1, c2)


def mask_of(points, dy=0):
    m = Image.new('L', (W, W), 0)
    ImageDraw.Draw(m).polygon([(x * S, (y + dy) * S) for x, y in points], fill=255)
    return m


def render():
    img = gradient('#2a1d47', '#0d0f14').convert('RGB')

    # Manche suggéré : cordes et frettes très discrètes
    d = ImageDraw.Draw(img, 'RGBA')
    for i in range(6):
        x = (96 + i * 64) * S
        d.line([(x, 0), (x, W)], fill=(255, 255, 255, 20), width=2 * S)
    for y in (150, 270, 390):
        d.line([(0, y * S), (W, y * S)], fill=(255, 255, 255, 14), width=3 * S)

    # Ombre portée du médiator
    shadow = mask_of(PICK, dy=18).filter(ImageFilter.GaussianBlur(16 * S)).point(lambda v: int(v * 0.6))
    img.paste(Image.new('RGB', (W, W), '#000000'), (0, 0), shadow)

    # Médiator en dégradé ambre -> corail
    pick = mask_of(PICK)
    img.paste(gradient('#ffc760', '#ff6f61', diagonal=True).convert('RGB'), (0, 0), pick)

    # Reflet doux en haut
    fade = Image.linear_gradient('L').transpose(Image.FLIP_TOP_BOTTOM).resize((W, W))   # blanc en haut
    fade = fade.point(lambda v: max(0, int((v - 120) * 1.4)) if v > 120 else 0).point(lambda v: int(v * 0.33))
    img.paste(Image.new('RGB', (W, W), '#ffffff'), (0, 0), ImageChops.multiply(fade, pick))

    # Lettre F en barres arrondies
    d = ImageDraw.Draw(img)
    ink = '#1a1204'
    for x0, y0, x1, y1 in ((200, 170, 248, 362), (200, 170, 332, 218), (200, 246, 306, 292)):
        d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=18 * S, fill=ink)
    return img


big = render()
for name, size in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)):
    big.resize((size, size), Image.LANCZOS).save(f'public/{name}', optimize=True)
print('ok')
