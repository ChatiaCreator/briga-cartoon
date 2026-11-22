# 3D pieces for the White House stage, standing on the plaza in front of the painting so they move
# against it as the camera pans (depth): the fence's stone pillar with its lantern on top, like
# the ones in the painting. Output: assets/models/whitehouse_props.glb (root "Pillar"; the
# lantern glass is the material "lantern_glass", lit by the game).
# Run: blender -b --factory-startup -P tools/blender/whitehouse_props.py -- [--preview out.png]
import bpy, math, sys, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'assets', 'models', 'whitehouse_props.glb'))
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = args[args.index('--preview') + 1] if '--preview' in args else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def mat(name, color, rough=0.6, metal=0.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 3.0
    return m


def box(name, size, loc, m, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('b', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier='b')
    o.data.materials.append(m)
    if parent:
        o.parent = parent
    return o


stone = mat('stone', (0.26, 0.2, 0.12), 0.8)           # warm limestone in the night, like the painting's (linear colour)
stone_dark = mat('stone_trim', (0.15, 0.11, 0.065), 0.8)
navy = mat('plaque', (0.02, 0.03, 0.12), 0.5)
gold = mat('gold', (0.75, 0.5, 0.12), 0.35, 1.0)
iron = mat('iron', (0.015, 0.015, 0.018), 0.45, 0.6)
glass = mat('lantern_glass', (1.0, 0.75, 0.35), 0.2, 0.0, emit=(1.0, 0.72, 0.3))

# Pillar (base at the floor, Blender Z up = the game's Y; front face towards -Y = the game's +Z).
pillar = box('Pillar', (0.62, 0.62, 0.22), (0, 0, 0.11), stone_dark, 0.02)
box('Shaft', (0.52, 0.52, 1.7), (0, 0, 0.22 + 0.85), stone, 0.015, pillar)
box('Band', (0.58, 0.58, 0.08), (0, 0, 0.62), stone_dark, 0.01, pillar)
box('Cap', (0.66, 0.66, 0.12), (0, 0, 1.98), stone_dark, 0.02, pillar)
box('CapTop', (0.56, 0.56, 0.06), (0, 0, 2.07), stone, 0.01, pillar)
# Navy plaque with a gold frame on the front, and three gold stars.
box('PlaqueFrame', (0.34, 0.03, 0.62), (0, -0.27, 1.25), gold, 0.006, pillar)
box('Plaque', (0.29, 0.035, 0.56), (0, -0.272, 1.25), navy, 0.004, pillar)
for k, x in enumerate((-0.08, 0, 0.08)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=0.028, depth=0.01, location=(x, -0.292, 1.04),
                                        rotation=(math.pi / 2, 0, math.pi / 2))
    s = bpy.context.object
    s.name = f'Star{k}'
    s.data.materials.append(gold)
    s.parent = pillar
# Lantern on top: iron base, glass body with iron corner posts, roof and finial.
box('LanternBase', (0.26, 0.26, 0.06), (0, 0, 2.13), iron, 0.01, pillar)
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.14, depth=0.34, location=(0, 0, 2.33))
body = bpy.context.object
body.name = 'LanternGlass'
body.data.materials.append(glass)
body.parent = pillar
for a in range(8):
    ang = math.pi * 2 * a / 8 + math.pi / 8
    box(f'Post{a}', (0.018, 0.018, 0.36), (0.145 * math.cos(ang), 0.145 * math.sin(ang), 2.33), iron, 0, pillar)
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.2, radius2=0.03, depth=0.16, location=(0, 0, 2.58))
roof = bpy.context.object
roof.name = 'LanternRoof'
roof.data.materials.append(iron)
roof.parent = pillar
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.035, location=(0, 0, 2.69))
fin = bpy.context.object
fin.name = 'Finial'
fin.data.materials.append(gold)
fin.parent = pillar

bpy.ops.object.select_all(action='DESELECT')
pillar.select_set(True)
for c in pillar.children_recursive:
    c.select_set(True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_format='GLB', export_yup=True, export_apply=True)
print('wrote', OUT, os.path.getsize(OUT), 'bytes')

if PREVIEW:
    cam_d = bpy.data.cameras.new('c')
    cam = bpy.data.objects.new('c', cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = (1.6, -4.2, 1.6)
    cam.rotation_euler = (Vector((0, 0, 1.4)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for loc, e in (((2, -3, 4), 400), ((-3, -2, 2), 120)):
        l = bpy.data.lights.new('l', 'AREA')
        l.energy = e
        l.size = 2
        lo = bpy.data.objects.new('l', l)
        lo.location = loc
        scene.collection.objects.link(lo)
        lo.rotation_euler = (Vector((0, 0, 1.2)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w')
    scene.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.03, 0.03, 0.08, 1)
    scene.view_settings.view_transform = 'Standard'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.render.resolution_x, scene.render.resolution_y = 500, 700
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
