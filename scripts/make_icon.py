"""Generate LocalMind's rounded glass-style app icon locally (no network)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
ICON_DIR.mkdir(parents=True, exist_ok=True)

S = 512
R = 112


def lerp(a, b, t):
    return a + (b - a) * t


def gradient_bg():
    img = Image.new("RGB", (S, S))
    px = img.load()
    c1 = (11, 16, 32)      # deep navy
    c2 = (38, 45, 104)     # indigo
    c3 = (16, 30, 62)      # blue shadow
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * (S - 1))
            if t < 0.5:
                k = t * 2
                base = tuple(lerp(c1[i], c2[i], k) for i in range(3))
            else:
                k = (t - 0.5) * 2
                base = tuple(lerp(c2[i], c3[i], k) for i in range(3))
            px[x, y] = tuple(int(v) for v in base)
    return img.convert("RGBA")


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def build():
    img = gradient_bg()

    # Soft accent glow behind the monogram.
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((120, 90, 410, 400), fill=(124, 140, 255, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    img = Image.alpha_composite(img, glow)

    # Frosted top-left sheen.
    sheen = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.polygon(
        [(0, 0), (S, 0), (S * 0.62, 0), (0, S * 0.55)],
        fill=(255, 255, 255, 26),
    )
    sheen = sheen.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img, sheen)

    d = ImageDraw.Draw(img)

    # Modern geometric L with rounded caps and corner.
    stroke = 54
    accent = (205, 212, 255, 255)
    d.line((190, 140, 190, 344), fill=accent, width=stroke)
    d.line((190, 344, 336, 344), fill=accent, width=stroke)
    r = stroke / 2
    for cx, cy in ((190, 140), (190, 344), (336, 344)):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=accent)

    # Glowing diamond: a small note/tag accent.
    cx, cy, half = 340, 158, 30
    diamond = [(cx, cy - half), (cx + half, cy), (cx, cy + half), (cx - half, cy)]
    dglow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(dglow).polygon(diamond, fill=(124, 140, 255, 180))
    dglow = dglow.filter(ImageFilter.GaussianBlur(22))
    img = Image.alpha_composite(img, dglow)
    d = ImageDraw.Draw(img)
    d.polygon(diamond, fill=(167, 139, 250, 255))
    d.polygon(
        [(cx, cy - half + 7), (cx + half - 7, cy), (cx, cy + half - 7), (cx - half + 7, cy)],
        outline=(255, 255, 255, 120),
    )

    # Subtle inner border.
    d.rounded_rectangle((3, 3, S - 4, S - 4), radius=R - 2, outline=(255, 255, 255, 34), width=3)

    img.putalpha(rounded_mask(S, R))
    return img


def main():
    base = build()
    base.save(ICON_DIR / "icon.png")

    for name, size in (
        ("32x32.png", 32),
        ("128x128.png", 128),
        ("128x128@2x.png", 256),
    ):
        base.resize((size, size), Image.Resampling.LANCZOS).save(ICON_DIR / name)

    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    base.save(
        ICON_DIR / "icon.ico",
        format="ICO",
        sizes=sizes,
    )
    print("generated:", ", ".join(p.name for p in sorted(ICON_DIR.iterdir())))


if __name__ == "__main__":
    main()
