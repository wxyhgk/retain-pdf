# Draws icons/icon.png (1024×1024): the Mac icon grid's rounded square, black, with a white serif S.
# Run with python3 (needs Pillow); build.sh turns the PNG into the app's .icns.
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE, SCALE = 1024, 4
here = Path(__file__).parent
big = SIZE * SCALE
image = Image.new('RGBA', (big, big), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
inset, radius = 100 * SCALE, 185 * SCALE
draw.rounded_rectangle((inset, inset, big - inset, big - inset), radius, fill=(25, 25, 25, 255))
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia.ttf', 560 * SCALE)
box = draw.textbbox((0, 0), 'S', font=font)
x = (big - (box[2] - box[0])) / 2 - box[0]
y = (big - (box[3] - box[1])) / 2 - box[1]
draw.text((x, y), 'S', font=font, fill=(255, 255, 255, 255))
image.resize((SIZE, SIZE), Image.LANCZOS).save(here / 'icon.png')
