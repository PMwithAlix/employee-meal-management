from PIL import Image, ImageDraw
import os

src = r'C:\Users\S A\Downloads\خوان_ Smart Dining Brand Identity.png'
out = r'C:\Users\S A\Desktop\kavosh plus\openai-repo\final-product\src\assets\brand'
public = r'C:\Users\S A\Desktop\kavosh plus\openai-repo\final-product\public'
os.makedirs(out, exist_ok=True)
os.makedirs(public, exist_ok=True)
sheet = Image.open(src).convert('RGBA')


def key_paper(image):
    pixels = image.load()
    w, h = image.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0 and r > 228 and g > 232 and b > 238:
                pixels[x, y] = (255, 255, 255, 0)
    return image


def trim(image, pad=6):
    bbox = image.split()[-1].getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    return image.crop((
        max(0, left - pad),
        max(0, top - pad),
        min(image.width, right + pad),
        min(image.height, bottom + pad),
    ))


def as_white(image):
    result = Image.new('RGBA', image.size, (0, 0, 0, 0))
    src_px = image.load()
    dst = result.load()
    w, h = image.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = src_px[x, y]
            if a:
                dst[x, y] = (255, 255, 255, a)
    return result


def rounded_icon(mark, size=256, radius=56, fill=(37, 99, 235, 255)):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=fill)
    white = as_white(mark)
    box = int(size * 0.62)
    white = white.resize((box, int(box * white.height / white.width)), Image.Resampling.LANCZOS)
    x = (size - white.width) // 2
    y = (size - white.height) // 2 + int(size * 0.02)
    canvas.alpha_composite(white, (x, y))
    return canvas


hero = trim(key_paper(sheet.crop((36, 24, 744, 338)).copy()))
hero = hero.crop((0, 0, hero.width, max(1, hero.height - 12)))
hero = trim(hero, 4)
hero.save(os.path.join(out, 'wordmark-blue.png'))
as_white(hero).save(os.path.join(out, 'wordmark-white.png'))

mark = trim(key_paper(sheet.crop((800, 28, 980, 190)).copy()), 2)
mark.save(os.path.join(out, 'mark.png'))
as_white(mark).save(os.path.join(out, 'mark-white.png'))

icon = rounded_icon(mark)
icon.save(os.path.join(out, 'icon.png'))
icon.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(public, 'favicon.png'))
icon.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(public, 'apple-touch-icon.png'))

print('hero', hero.size, 'mark', mark.size, 'icon', icon.size)
