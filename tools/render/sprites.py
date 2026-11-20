"""Детали для опытов: отдельные объекты на прозрачном фоне, ортографическая камера с наклоном 12°.

blender -b --factory-startup -P tools/render/sprites.py -- --out-dir DIR [--only ball-glass,beam] [--samples 192]
Потом: python tools/render/to_webp.py DIR/<name>.png src/course/sprites/<name>.webp --pad 0.02
Браузер рисует детали на холсте и двигает их по законам физики (src/course/physics.ts).
"""
import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import scene_lib as S  # noqa: E402

TILT = math.radians(12)
THEORY = dict(center=(1.0, 0.1, 0.62), rim=(1.0, 0.72, 0.95))


def ortho_camera(width, height, target=(0, 0, 0)):
    data = bpy.data.cameras.new('Cam')
    data.type = 'ORTHO'
    data.ortho_scale = max(width, height)
    cam = bpy.data.objects.new('Cam', data)
    bpy.context.scene.collection.objects.link(cam)
    tx, ty, tz = target
    distance = 30
    cam.location = (tx, ty - distance * math.cos(TILT), tz + distance * math.sin(TILT))
    aim = bpy.data.objects.new('Aim', None)
    bpy.context.scene.collection.objects.link(aim)
    aim.location = target
    c = cam.constraints.new('TRACK_TO')
    c.target, c.track_axis, c.up_axis = aim, 'TRACK_NEGATIVE_Z', 'UP_Y'
    bpy.context.scene.camera = cam


# name: (сборка, ширина кадра, высота кадра, пикселей на единицу, центр кадра, масштаб света)
SPRITES = {
    'ball-glass': (lambda: S.sphere((0, 0, 0), 0.5, S.glass()), 1.1, 1.1, 180, (0, 0, 0), 0.5),
    'ball-chrome': (lambda: S.sphere((0, 0, 0), 0.5, S.chrome()), 1.1, 1.1, 180, (0, 0, 0), 0.5),
    'ball-theory': (lambda: S.sphere((0, 0, 0), 0.5, S.glass(**THEORY)), 1.1, 1.1, 180, (0, 0, 0), 0.5),
    'peg': (lambda: S.sphere((0, 0, 0), 0.5, S.chrome()), 1.1, 1.1, 90, (0, 0, 0), 0.5),
    'beam': (lambda: S.rounded_box((0, 0, 0), (20, 0.6, 0.3), 0.12, S.chrome()), 20.6, 1.4, 70, (0, 0, 0), 2.5),
    'fulcrum': (lambda: S.prism((0, 0, 0), 1.0, 0.8, S.chrome()), 2.2, 2.0, 110, (0, 0, -0.1), 0.7),
    'fulcrum-hot': (lambda: S.prism((0, 0, 0), 1.0, 0.8, S.glass(**THEORY)), 2.2, 2.0, 110, (0, 0, -0.1), 0.7),
    'rail': (lambda: S.rounded_box((0, 0, 0), (20, 0.16, 0.1), 0.045, S.chrome(), segments=4), 20.4, 0.8, 70, (0, 0, 0), 2.5),
    'column-glass': (lambda: S.rounded_box((0, 0, 0), (1, 1, 3), 0.14, S.glass()), 1.3, 3.6, 120, (0, 0, 0), 0.8),
    'column-theory': (lambda: S.rounded_box((0, 0, 0), (1, 1, 3), 0.14, S.glass(**THEORY)), 1.3, 3.6, 120, (0, 0, 0), 0.8),
    'divider': (lambda: S.rounded_box((0, 0, 0), (0.1, 0.6, 3), 0.04, S.chrome(), segments=4), 0.5, 3.4, 120, (0, 0, 0), 0.8),
}


def render(name, out_dir, samples):
    build, width, height, ppu, center, light_scale = SPRITES[name]
    S.reset(round(width * ppu), round(height * ppu), samples)
    S.lights(center, scale=light_scale)
    ortho_camera(width, height, center)
    build()
    S.render_still(os.path.join(out_dir, name + '.png'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out-dir', required=True)
    parser.add_argument('--only')
    parser.add_argument('--samples', type=int, default=192)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    os.makedirs(args.out_dir, exist_ok=True)
    names = args.only.split(',') if args.only else list(SPRITES)
    for name in names:
        render(name, args.out_dir, args.samples)
