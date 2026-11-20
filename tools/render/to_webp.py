"""PNG с прозрачностью → WebP (Pillow). Обрезает пустые прозрачные поля и уменьшает до нужной ширины.

python tools/render/to_webp.py <in.png> <out.webp> [--width 1000] [--no-trim] [--pad 0.05]
python tools/render/to_webp.py --frames <in_dir> <out_dir> --width 960   # кадры анимации без обрезки
"""
import argparse
import os

from PIL import Image


def trim(image, pad):
    box = image.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not box:
        return image
    left, top, right, bottom = box
    margin = int(max(right - left, bottom - top) * pad)
    return image.crop((max(0, left - margin), max(0, top - margin),
                       min(image.width, right + margin), min(image.height, bottom + margin)))


def shrink(image, width):
    if width and image.width > width:
        image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('target')
    parser.add_argument('--width', type=int, default=0)
    parser.add_argument('--pad', type=float, default=0.05)
    parser.add_argument('--no-trim', action='store_true')
    parser.add_argument('--frames', action='store_true', help='source и target — папки с PNG-кадрами')
    args = parser.parse_args()
    if args.frames:
        os.makedirs(args.target, exist_ok=True)
        for name in sorted(os.listdir(args.source)):
            if name.endswith('.png'):
                shrink(Image.open(os.path.join(args.source, name)).convert('RGBA'), args.width).save(os.path.join(args.target, name))
        return
    image = Image.open(args.source).convert('RGBA')
    if not args.no_trim:
        image = trim(image, args.pad)
    image = shrink(image, args.width)
    image.save(args.target, 'WEBP', quality=86, method=6)
    print(args.target, image.size, os.path.getsize(args.target))


if __name__ == '__main__':
    main()
