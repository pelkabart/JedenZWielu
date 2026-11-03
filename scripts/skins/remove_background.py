"""Wycina jednolite czarne tło ze skórek zapisanych bez przezroczystości (PNG w trybie RGB).

Tło to czarne piksele połączone z rogami obrazka. Wypełnienie idzie tylko od rogów, więc czarne
ubranie w środku postaci zostaje, o ile postać ma jaśniejszy obrys. Pliki z kanałem alfa są pomijane.
Skrypt nadpisuje pliki, więc po użyciu obejrzyj wynik na kontrastowym tle.

Użycie (wymaga Pillow):
    python scripts/skins/remove_background.py assets/skins [--threshold 12]
"""
import argparse
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


def background_mask(image: Image.Image, threshold: int) -> Image.Image:
    """Maska L: 255 dla postaci, 0 dla tła osiągalnego od rogów."""
    pixels = image.load()
    width, height = image.size
    seen = bytearray(width * height)
    queue = deque()
    for x, y in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)):
        seen[y * width + x] = 1
        queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not seen[ny * width + nx] and max(pixels[nx, ny]) <= threshold:
                seen[ny * width + nx] = 1
                queue.append((nx, ny))
    mask = Image.new('L', image.size)
    mask.putdata([0 if value else 255 for value in seen])
    return mask


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('--threshold', type=int, default=12)
    args = parser.parse_args()

    changed = 0
    for path in sorted(args.root.rglob('*.png')):
        with Image.open(path) as source:
            if source.mode != 'RGB':
                continue
            image = source.copy()
        # Lekkie rozmycie maski wygładza schodki na krawędzi postaci.
        mask = background_mask(image, args.threshold).filter(ImageFilter.GaussianBlur(0.8))
        image.putalpha(mask)
        image.save(path, optimize=True)
        changed += 1
        print(f'{path}: tlo wyciete')
    print(f'Zmienione pliki: {changed}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
