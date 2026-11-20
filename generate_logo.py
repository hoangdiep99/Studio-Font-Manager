from PIL import Image, ImageDraw, ImageFont
import math

size = 512
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 1. Background: Luxurious rounded square with crimson-to-burgundy gradient
# Radius ~ 110px
bg_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
bg_draw = ImageDraw.Draw(bg_layer)

for y in range(size):
    # gradient from #b91c1c (crimson) to #4c0519 (deep luxury burgundy)
    ratio = y / size
    r = int(190 * (1 - ratio) + 76 * ratio)
    g = int(24 * (1 - ratio) + 5 * ratio)
    b = int(50 * (1 - ratio) + 25 * ratio)
    bg_draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

# Create rounded rectangle mask
mask = Image.new('L', (size, size), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([(16, 16), (size - 16, size - 16)], radius=105, fill=255)

img.paste(bg_layer, (0, 0), mask)

# 2. Golden luxury rim / border
border_draw = ImageDraw.Draw(img)
border_draw.rounded_rectangle([(18, 18), (size - 18, size - 18)], radius=103, outline=(245, 197, 66, 180), width=6)
border_draw.rounded_rectangle([(24, 24), (size - 24, size - 24)], radius=97, outline=(255, 235, 150, 70), width=2)

# 3. Soft golden glow / radial highlight inside
glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
g_draw = ImageDraw.Draw(glow)
center_x, center_y = size // 2, size // 2 - 20
for radius in range(180, 0, -5):
    alpha = int(45 * (1 - radius / 180))
    g_draw.ellipse([center_x - radius, center_y - radius, center_x + radius, center_y + radius], fill=(255, 215, 0, alpha))
img = Image.alpha_composite(img, glow)

# 4. Draw Typography Emblem: Stylized capital 'F' in gold & ivory + subtle diamond sparkle
draw = ImageDraw.Draw(img)

# Try loading an elegant serif / modern font, or draw custom bezier/polygon
try:
    font = ImageFont.truetype("timesbd.ttf", 310)
except:
    font = ImageFont.load_default()

# Shadow for letter
draw.text((center_x - 70, center_y - 185), "F", font=font, fill=(20, 2, 7, 180))
# Outer gold
draw.text((center_x - 74, center_y - 190), "F", font=font, fill=(245, 197, 66, 255))
# Inner ivory/champagne highlight
draw.text((center_x - 76, center_y - 192), "F", font=font, fill=(255, 250, 235, 255))

# 5. Add small golden 4-point sparkle stars
def draw_sparkle(cx, cy, r_outer, r_inner, color):
    pts = []
    for i in range(8):
        angle = i * math.pi / 4
        r = r_outer if i % 2 == 0 else r_inner
        pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(pts, fill=color)

draw_sparkle(size - 95, 95, 26, 7, (255, 240, 180, 255))
draw_sparkle(size - 135, 140, 13, 4, (255, 225, 120, 220))
draw_sparkle(90, size - 110, 18, 5, (255, 235, 150, 220))

# 6. Save as logo.png (512x512) and app.ico (multi-res 256, 128, 64, 48, 32, 16)
img.save("C:/Users/DiepPC/Desktop/Studio-Font-Manager/logo.png", format="PNG")
img.save("C:/Users/DiepPC/Desktop/Studio-Font-Manager/public/logo.png", format="PNG")

ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
img.save("C:/Users/DiepPC/Desktop/Studio-Font-Manager/app.ico", format="ICO", sizes=ico_sizes)

print("Generated logo.png and app.ico successfully!")
