import os
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_IMAGE = os.path.join(BASE_DIR, 'icon-512.png')

if not os.path.exists(SRC_IMAGE):
    raise FileNotFoundError(f"Source image not found: {SRC_IMAGE}")

img = Image.open(SRC_IMAGE).convert("RGBA")

# 1. Generate multi-resolution favicon.ico (16, 32, 48, 64, 128, 256)
# Note: Google Favicon crawler specifically looks for multiples of 48px (48x48, 96x96, etc.)
ico_path = os.path.join(BASE_DIR, 'favicon.ico')
img.save(ico_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(f"Generated {ico_path} with multiple resolutions.")

# 2. Generate various PNG favicons
sizes = {
    'favicon-16x16.png': (16, 16),
    'favicon-32x32.png': (32, 32),
    'favicon-48x48.png': (48, 48),
    'favicon-64x64.png': (64, 64),
    'favicon-96x96.png': (96, 96),
    'favicon.png': (64, 64),
    'apple-touch-icon.png': (180, 180),
    'apple-touch-icon-precomposed.png': (180, 180),
    'icon-192.png': (192, 192),
    'icon-512.png': (512, 512),
}

for filename, size in sizes.items():
    resized = img.resize(size, Image.Resampling.LANCZOS)
    out_file = os.path.join(BASE_DIR, filename)
    resized.save(out_file, format='PNG')
    print(f"Generated {filename} ({size[0]}x{size[1]})")

print("All favicon assets regenerated successfully!")
