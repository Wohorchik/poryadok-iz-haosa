"""Склеивает PNG-кадры с прозрачностью в WebM (VP9 с альфа-каналом) через видеоредактор Blender.
blender -b --factory-startup -P encode.py -- <frame_dir> <out.webm> [fps] [crf-пресет или битрейт в кбит/с]
"""
import bpy, os, sys

frame_dir, out = sys.argv[sys.argv.index('--') + 1:][:2]
rest = sys.argv[sys.argv.index('--') + 3:]
fps = int(rest[0]) if rest else 24
crf = rest[1] if len(rest) > 1 else 'MEDIUM'

files = sorted(f for f in os.listdir(frame_dir) if f.endswith('.png'))
scene = bpy.context.scene
probe = bpy.data.images.load(os.path.join(frame_dir, files[0]))
scene.render.resolution_x, scene.render.resolution_y = probe.size
scene.render.resolution_percentage = 100
scene.render.fps = fps
scene.frame_start, scene.frame_end = 1, len(files)
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'

se = scene.sequence_editor_create()
strip = se.strips.new_image(name='frames', filepath=os.path.join(frame_dir, files[0]), channel=1, frame_start=1)
for f in files[1:]:
    strip.elements.append(f)

im = scene.render.image_settings
im.media_type = 'VIDEO'
im.file_format = 'FFMPEG'
ff = scene.render.ffmpeg
ff.format = 'WEBM'
ff.codec = 'WEBM'
if crf.isdigit():
    # Числом задаётся средний битрейт в кбит/с: так проще уложиться в бюджет размера.
    ff.constant_rate_factor = 'NONE'
    ff.video_bitrate = int(crf)
    ff.maxrate = int(crf) * 3 // 2
    ff.minrate = 0
else:
    ff.constant_rate_factor = crf
ff.ffmpeg_preset = 'GOOD'
im.color_mode = 'RGBA'
print('COLOR MODE', im.color_mode)
scene.render.filepath = out
bpy.ops.render.render(animation=True)
print('ENCODED', out, os.path.getsize(out) if os.path.exists(out) else 'missing')
