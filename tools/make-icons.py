"""產生 App 圖示（主畫面、分頁、iOS）。需要 Pillow：pip install pillow
用法：python tools/make-icons.py
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SS = 4  # 先畫 4 倍大再縮小，邊緣才會平滑

BG_TOP = (255, 248, 236)
BG_BOTTOM = (243, 230, 210)
# 和遊戲裡一樣的糖果色：珊瑚紅、天空藍、向日葵黃、薄荷綠（不帶圖案）
TILES = [
    ((255, 111, 97), None),
    ((74, 155, 246), None),
    ((255, 196, 61), None),
    ((45, 196, 145), None),
]


def heart(cx, cy, r):
    pts = []
    for i in range(240):
        t = i / 240 * 2 * math.pi
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * r / 17, cy - y * r / 17 - r * 0.05))
    return pts


def star(cx, cy, r):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def triangle(cx, cy, r):
    return [(cx, cy - r * 0.95), (cx + r * 0.98, cy + r * 0.72), (cx - r * 0.98, cy + r * 0.72)]


def draw_symbol(d, shape, cx, cy, r, fill):
    if shape == 'circle':
        d.ellipse([cx - r * 0.82, cy - r * 0.82, cx + r * 0.82, cy + r * 0.82], fill=fill)
    elif shape == 'heart':
        d.polygon(heart(cx, cy, r), fill=fill)
    elif shape in ('star', 'triangle'):
        pts = star(cx, cy, r * 1.05) if shape == 'star' else triangle(cx, cy, r * 0.9)
        width = int(r * (0.14 if shape == 'star' else 0.2))
        d.polygon(pts, fill=fill)
        # 多繞一點，讓起點也有圓角接頭
        d.line(pts + pts[:2], fill=fill, width=width, joint='curve')


def make(size, content_ratio, rounded):
    S = size * SS
    img = Image.new('RGBA', (S, S))
    # 米色漸層底
    bg = Image.new('RGB', (1, 2))
    bg.putpixel((0, 0), BG_TOP)
    bg.putpixel((0, 1), BG_BOTTOM)
    bg = bg.resize((S, S), Image.BILINEAR)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22) if rounded else 0, fill=255)
    img.paste(bg, (0, 0), mask)

    box = S * content_ratio
    gap = box * 0.07
    tile = (box - gap) / 2
    x0 = (S - box) / 2
    y0 = (S - box) / 2

    # 陰影
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(4):
        tx = x0 + (i % 2) * (tile + gap)
        ty = y0 + (i // 2) * (tile + gap)
        sd.rounded_rectangle([tx, ty + tile * 0.06, tx + tile, ty + tile * 1.06], radius=tile * 0.28, fill=(90, 50, 15, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.012))
    img.alpha_composite(shadow)

    d = ImageDraw.Draw(img)
    for i, (color, shape) in enumerate(TILES):
        tx = x0 + (i % 2) * (tile + gap)
        ty = y0 + (i // 2) * (tile + gap)
        dark = tuple(int(c * 0.8) for c in color)
        d.rounded_rectangle([tx, ty, tx + tile, ty + tile], radius=tile * 0.28, fill=dark)
        d.rounded_rectangle([tx, ty, tx + tile, ty + tile * 0.93], radius=tile * 0.28, fill=color)
        # 上方的光澤
        hl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(hl).ellipse([tx + tile * 0.08, ty + tile * 0.04, tx + tile * 0.7, ty + tile * 0.42], fill=(255, 255, 255, 60))
        hl = hl.filter(ImageFilter.GaussianBlur(tile * 0.06))
        clip = Image.new('L', (S, S), 0)
        ImageDraw.Draw(clip).rounded_rectangle([tx, ty, tx + tile, ty + tile * 0.93], radius=tile * 0.28, fill=255)
        img.paste(Image.alpha_composite(img, hl), (0, 0), clip)
        d = ImageDraw.Draw(img)
        # 左上角的小光點，跟遊戲裡的軟糖一樣
        shine = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(shine).rounded_rectangle([tx + tile * 0.16, ty + tile * 0.12, tx + tile * 0.52, ty + tile * 0.27], radius=tile * 0.08, fill=(255, 255, 255, 150))
        img.alpha_composite(shine.rotate(0))
        d = ImageDraw.Draw(img)

    return img.resize((size, size), Image.LANCZOS)


def main():
    icons = ROOT / 'public' / 'icons'
    icons.mkdir(parents=True, exist_ok=True)
    make(192, 0.7, False).save(icons / 'icon-192.png')
    make(512, 0.7, False).save(icons / 'icon-512.png')
    make(512, 0.56, False).save(icons / 'icon-maskable-512.png')
    make(512, 0.74, True).save(ROOT / 'src' / 'app' / 'icon.png')
    make(180, 0.7, False).convert('RGB').save(ROOT / 'src' / 'app' / 'apple-icon.png')
    print('icons written')


if __name__ == '__main__':
    main()
