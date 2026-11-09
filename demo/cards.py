from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
BG = (11, 13, 16)
TXT = (232, 237, 242)
DIM = (139, 152, 165)
ACC = (94, 234, 212)


def font(sz):
    for p in [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()


def center(d, y, t, f, fill):
    d.text(((W - d.textlength(t, font=f)) / 2, y), t, font=f, fill=fill)


im = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(im)
center(d, 430, "INTERNET COURT   x   x402   x   GENLAYER", font(30), DIM)
center(d, 500, "Paid report, refund switch", font(84), TXT)
center(d, 620, "An agent pays 0.05 USDC over x402.", font(34), DIM)
center(d, 670, "GenLayer reads the delivery and decides who gets the money.", font(34), DIM)
im.save("/tmp/intro.png")

im = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(im)
center(d, 430, "PASS", font(120), ACC)
center(d, 590, "Payment released to the seller.", font(44), TXT)
center(d, 660, "Same contract flips to FAIL when a promised fact is missing.", font(30), DIM)
im.save("/tmp/outro.png")

print("ok")
