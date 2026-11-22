"""Tile home and panel at 390px and 1280px into one image for review (docs/screens/confronto.png)."""
from PIL import Image, ImageDraw

bg, ink = (13, 12, 11), (220, 193, 150)
mob = [Image.open(f"docs/screens/{n}-390.png").convert("RGB").resize((390, 844)) for n in ("home", "pannello")]
desk = [Image.open(f"docs/screens/{n}-1280.png").convert("RGB").resize((640, 400)) for n in ("home", "pannello")]
pad = 24
W = pad * 3 + 390 * 2 + pad + 640
H = pad * 2 + 28 + 844
out = Image.new("RGB", (W, H), bg)
d = ImageDraw.Draw(out)
x = pad
for img, label in zip(mob, ("390 · home", "390 · pannello")):
    d.text((x, pad), label, fill=ink)
    out.paste(img, (x, pad + 28))
    x += 390 + pad
for i, (img, label) in enumerate(zip(desk, ("1280 · home", "1280 · pannello"))):
    y = pad + 28 + i * (400 + 44)
    d.text((x, y - 22), label, fill=ink)
    out.paste(img, (x, y))
out.save("docs/screens/confronto.png")
print("docs/screens/confronto.png")
