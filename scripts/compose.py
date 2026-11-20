"""Side-by-side: reference Mendl's (refs/bijoux.png, section 1) vs real home and scheda at 390px."""
from PIL import Image, ImageDraw
ref = Image.open("refs/bijoux.png").convert("RGB")
# section 1 phones: home x≈14-414, scheda x≈422-822, y≈180-1020 (in the 900px-wide original)
s = ref.width / 900
crop = lambda x0, x1: ref.crop((int(x0*s), int(180*s), int(x1*s), int(1022*s))).resize((390, 844))
ref_home, ref_sheet = crop(14, 414), crop(422, 822)
home = Image.open("docs/screens/home-390.png").convert("RGB").resize((390, 844))
sheet = Image.open("docs/screens/scheda-390.png").convert("RGB").resize((390, 844))
W, H, pad = 390, 844, 24
out = Image.new("RGB", (4 * W + 5 * pad, H + 2 * pad + 28), (217, 214, 208))
d = ImageDraw.Draw(out)
for i, (img, label) in enumerate([(ref_home, "reference · home"), (home, "Bijoux live · home"), (ref_sheet, "reference · scheda"), (sheet, "Bijoux live · scheda")]):
    x = pad + i * (W + pad)
    out.paste(img, (x, pad + 28))
    d.text((x, pad), label, fill=(26, 38, 71))
out.save("docs/screens/confronto-390.png")
print("docs/screens/confronto-390.png")
