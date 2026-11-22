# The props the fighters hold, modelled in Blender: assets/models/props.glb with one root object
# per prop (Can, Bag, Joint with its Tip, Screwdriver, Pistol). The game turns their materials into
# its cartoon (toon) materials and draws an outline around them (src/render/effects.js).
#
# Run (Blender 4.2+):  blender -b --factory-startup -P tools/blender/props.py -- [--preview out.png]
#
# Each prop keeps the frame and size the game used for its old box-and-cylinder version, so it
# sits in the hand exactly where that one did. Blender is Z-up; the glTF export turns Blender Z
# into the game's +Y and Blender -Y into the game's +Z (forward).
#   Can          axis +Y, centred, radius 0.065, height 0.24
#   Bag          centred, 0.34 wide (X) x 0.44 tall (Y) x 0.14 thick (Z), printed on both faces
#   Joint        along +Y: filter from 0, lit end ("Tip", recoloured by the game) at 0.275
#   Screwdriver  along +Y: handle around 0, tip at 0.285
#   Pistol       barrel along +Z, grip below the origin (the palm)
import bpy, bmesh, math, sys, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
TEX = os.path.join(HERE, 'textures')
OUT = os.path.join(ROOT, 'assets', 'models', 'props.glb')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = args[args.index('--preview') + 1] if '--preview' in args else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def mat(name, color, metal=0.0, rough=0.5, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if image:
        t = m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(os.path.join(TEX, image))
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    return m


def new_object(name, bm, mats=()):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    return ob


def lathe(name, profile, segs, mat_of=lambda i: 0, uv_band=None, mats=()):
    """Spin (radius, z) points around Z. uv_band(i) -> (v0, v1) wraps a label around segment i."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    rings = [[bm.verts.new((r * math.cos(2 * math.pi * k / segs), r * math.sin(2 * math.pi * k / segs), z))
              for k in range(segs)] for (r, z) in profile]
    for i in range(len(rings) - 1):
        band = uv_band(i) if uv_band else None
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            f.material_index = mat_of(i)
            f.smooth = True
            for loop, (kk, ii) in zip(f.loops, ((k, 0), (k + 1, 0), (k + 1, 1), (k, 1))):
                if band:
                    loop[uv].uv = (kk / segs, band[0] + (band[1] - band[0]) * ii)
                else:
                    p = loop.vert.co
                    loop[uv].uv = (0.5 + p.x * 4, 0.5 + p.y * 4)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return new_object(name, bm, mats)


def add(op, name, mats=(), **kw):
    op(**kw)
    ob = bpy.context.object
    ob.name = name
    for m in mats:
        ob.data.materials.append(m)
    return ob


def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def bevel(ob, width, segments=2):
    m = ob.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    apply_all(ob)


def cut(ob, cutter):
    m = ob.modifiers.new('cut', 'BOOLEAN')
    m.object = cutter
    m.operation = 'DIFFERENCE'
    apply_all(ob)
    bpy.data.objects.remove(cutter)


def smooth(ob, angle=40):
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
    apply_all(ob)


# ---------------------------------------------------------------- Can
aluminium = mat('aluminium', (0.78, 0.79, 0.82), 1.0, 0.28)
label = mat('garra_label', (1, 1, 1), 0.3, 0.35, 'garra_label.png')
H0 = -0.12
can_prof = [(0.0, 0.012), (0.03, 0.009), (0.046, 0.004), (0.054, 0.0), (0.06, 0.004), (0.065, 0.016),
            (0.065, 0.026), (0.065, 0.205),
            (0.063, 0.214), (0.056, 0.226), (0.054, 0.232), (0.055, 0.238), (0.053, 0.24), (0.05, 0.237),
            (0.048, 0.232), (0.0, 0.232)]
can = lathe('Can', [(r, z + H0) for r, z in can_prof], 64, mat_of=lambda i: 0 if i == 6 else 1,
            uv_band=lambda i: (0.0, 1.0) if i == 6 else None, mats=(label, aluminium))
tab = add(bpy.ops.mesh.primitive_cylinder_add, 'CanTab', (aluminium,), vertices=24, radius=0.016, depth=0.003,
          location=(0.012, 0, 0.2335 + H0))
tab.scale = (1.6, 1.0, 1.0)
bpy.ops.object.transform_apply(scale=True)
cut(tab, add(bpy.ops.mesh.primitive_cylinder_add, 'hole', vertices=16, radius=0.006, depth=0.01,
             location=(0.02, 0, 0.2335 + H0)))
tab.parent = can

# ---------------------------------------------------------------- Screwdriver
red = mat('handle_red', (0.86, 0.12, 0.08), 0.0, 0.35)
yellow = mat('handle_yellow', (1.0, 0.78, 0.1), 0.0, 0.4)
steel = mat('steel', (0.8, 0.82, 0.86), 1.0, 0.22)
S0 = -0.07
hprof = [(0.0, 0.0), (0.026, 0.0), (0.032, 0.006), (0.035, 0.03), (0.034, 0.08), (0.031, 0.108),
         (0.036, 0.114), (0.036, 0.13), (0.028, 0.137), (0.014, 0.144), (0.0, 0.146)]
sd = lathe('Screwdriver', [(r, z + S0) for r, z in hprof], 48, mat_of=lambda i: 1 if i in (5, 6) else 0,
           mats=(red, yellow))
for v in sd.data.vertices:  # six flutes along the grip
    if 0.008 + S0 < v.co.z < 0.104 + S0:
        a = math.atan2(v.co.y, v.co.x)
        k = 1 - 0.09 * max(0.0, math.cos(6 * a)) ** 2
        v.co.x *= k
        v.co.y *= k
shaft = add(bpy.ops.mesh.primitive_cylinder_add, 'Shaft', (steel,), vertices=20, radius=0.0085, depth=0.13,
            location=(0, 0, 0.2 + S0 + 0.004))
bpy.ops.object.shade_smooth()
blade = add(bpy.ops.mesh.primitive_cube_add, 'Blade', (steel,), size=1, location=(0, 0, 0.278 + S0 + 0.004))
blade.scale = (0.017, 0.0085, 0.022)
bpy.ops.object.transform_apply(scale=True)
for v in blade.data.vertices:
    if v.co.z > 0:
        v.co.y *= 0.25
        v.co.x *= 1.1
for o in (shaft, blade):
    o.parent = sd

# ---------------------------------------------------------------- Joint
paper = mat('paper', (0.96, 0.94, 0.88), 0.0, 0.8)
filt = mat('filter', (0.85, 0.69, 0.48), 0.0, 0.7)
ember = mat('ember', (1.0, 0.42, 0.1), 0.0, 0.6)
jprof = [(0.0, 0.0), (0.013, 0.0), (0.013, 0.035), (0.0135, 0.036)]
for k in range(1, 12):  # paper cone, a little uneven
    z = 0.036 + 0.234 * k / 11
    r = 0.0135 + (0.024 - 0.0135) * (k / 11) ** 0.8
    jprof.append((r * (1 + 0.04 * math.sin(k * 2.3)), z))
jprof += [(0.02, 0.272), (0.0, 0.274)]
joint = lathe('Joint', jprof, 20, mat_of=lambda i: 1 if i < 3 else 0, mats=(paper, filt))
tip = add(bpy.ops.mesh.primitive_uv_sphere_add, 'Tip', (ember,), segments=16, ring_count=8, radius=0.022,
          location=(0, 0, 0.275))
tip.scale = (1, 1, 0.5)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth()
tip.parent = joint

# ---------------------------------------------------------------- Bag
bag_side = mat('bag_side', (0.66, 0.42, 0.2), 0.0, 0.85)
bag_print = mat('bag_print', (1, 1, 1), 0.0, 0.7, 'bag_label.png')
W2, H2, T2 = 0.17, 0.22, 0.07
bm = bmesh.new()
uv = bm.loops.layers.uv.new()
NU, NV = 24, 30
grid = {}
for side in (-1, 1):  # front (Blender -Y, the game's +Z) and back
    for i in range(NU + 1):
        for j in range(NV + 1):
            u, v = i / NU, j / NV
            x, z = (u - 0.5) * 2 * W2, (v - 0.5) * 2 * H2
            # Puffy body: thickest in the middle, flat at the sides and at the crimped seams.
            tv = max(0.0, 1 - abs(2 * v - 1) ** 5)
            tu = max(0.0, 1 - abs(2 * u - 1) ** 6)
            t = T2 * (tv ** 0.55) * (tu ** 0.35)
            seam = abs(2 * v - 1) > 0.9
            if seam:
                t = 0.004 + 0.003 * math.sin(i * math.pi)  # zigzag crimp
            grid[side, i, j] = bm.verts.new((x * (1 - 0.04 * (1 - tv)), side * -t, z))
for side in (-1, 1):
    for i in range(NU):
        for j in range(NV):
            q = [grid[side, i, j], grid[side, i + 1, j], grid[side, i + 1, j + 1], grid[side, i, j + 1]]
            if side == 1:
                q.reverse()
            f = bm.faces.new(q)
            f.smooth = True
            f.material_index = 1
            for loop in f.loops:
                p = loop.vert.co
                uu = (p.x / (2 * W2)) + 0.5
                loop[uv].uv = (1 - uu if side == -1 else uu, p.z / (2 * H2) + 0.5)
# Close the rim between front and back.
for i in range(NU):
    for j in (0, NV):
        a, b = (grid[-1, i, j], grid[-1, i + 1, j]), (grid[1, i + 1, j], grid[1, i, j])
        f = bm.faces.new((a[0], a[1], b[0], b[1]) if j == 0 else (a[1], a[0], b[1], b[0]))
        f.material_index = 0
for j in range(NV):
    for i in (0, NU):
        a, b = (grid[-1, i, j], grid[-1, i, j + 1]), (grid[1, i, j + 1], grid[1, i, j])
        f = bm.faces.new((a[1], a[0], b[1], b[0]) if i == 0 else (a[0], a[1], b[0], b[1]))
        f.material_index = 0
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bag = new_object('Bag', bm, (bag_side, bag_print))

# ---------------------------------------------------------------- Pistol (barrel along Blender -Y)
gun_dark = mat('gun_slide', (0.03, 0.03, 0.035), 0.6, 0.35)  # linear colours: these read as near black
gun_black = mat('gun_frame', (0.012, 0.012, 0.014), 0.2, 0.6)
gun_metal = mat('gun_metal', (0.3, 0.31, 0.34), 1.0, 0.3)
slide = add(bpy.ops.mesh.primitive_cube_add, 'Pistol', (gun_dark, gun_metal), size=1, location=(0, -0.06, 0.022))
slide.scale = (0.036, 0.2, 0.034)
bpy.ops.object.transform_apply(scale=True)
bevel(slide, 0.004)
for k in range(7):  # grip serrations at the back of the slide
    c = add(bpy.ops.mesh.primitive_cube_add, 'serr', size=1, location=(0, 0.02 + k * 0.0055, 0.022))
    c.scale = (0.05, 0.0022, 0.026)
    cut(slide, c)
port = add(bpy.ops.mesh.primitive_cube_add, 'port', size=1, location=(0.018, -0.045, 0.03))
port.scale = (0.012, 0.03, 0.012)
cut(slide, port)
muzzle = add(bpy.ops.mesh.primitive_cylinder_add, 'muzzle', vertices=16, radius=0.0065, depth=0.03,
             location=(0, -0.16, 0.022), rotation=(math.pi / 2, 0, 0))
cut(slide, muzzle)
for (y, h) in ((-0.152, 0.007), (0.034, 0.008)):  # sights
    s = add(bpy.ops.mesh.primitive_cube_add, 'sight', (gun_black,), size=1, location=(0, y, 0.041 + h / 2))
    s.scale = (0.008 if y > 0 else 0.004, 0.007, h)
    s.parent = slide
frame = add(bpy.ops.mesh.primitive_cube_add, 'Frame', (gun_black,), size=1, location=(0, -0.07, -0.002))
frame.scale = (0.032, 0.16, 0.016)
bpy.ops.object.transform_apply(scale=True)
bevel(frame, 0.003)
frame.parent = slide
grip = add(bpy.ops.mesh.primitive_cube_add, 'Grip', (gun_black,), size=1, location=(0, 0.012, -0.045))
grip.scale = (0.034, 0.048, 0.1)
bpy.ops.object.transform_apply(scale=True)
for v in grip.data.vertices:  # rake the grip back and round its back strap
    v.co.y += -v.co.z * 0.32
    if v.co.y > 0.02:
        v.co.y -= 0.004
bevel(grip, 0.008, 3)
for k in range(6):  # grip texture lines
    g = add(bpy.ops.mesh.primitive_cube_add, 'gl', size=1, location=(0, 0.012 + 0.032 * (k * 0.016) / 0.1, -0.012 - k * 0.016))
    g.scale = (0.04, 0.06, 0.0025)
    g.rotation_euler = (math.atan(0.32), 0, 0)
    cut(grip, g)
grip.parent = slide
guard = add(bpy.ops.mesh.primitive_torus_add, 'Guard', (gun_black,), major_radius=0.019, minor_radius=0.0035,
            location=(0, -0.022, -0.016), rotation=(0, math.pi / 2, 0))
cut(guard, add(bpy.ops.mesh.primitive_cube_add, 'gcut', size=1, location=(0, -0.022, 0.006)))
guard.parent = slide
trigger = add(bpy.ops.mesh.primitive_cube_add, 'Trigger', (gun_metal,), size=1, location=(0, -0.018, -0.016))
trigger.scale = (0.006, 0.005, 0.018)
trigger.rotation_euler = (-0.35, 0, 0)
trigger.parent = slide
for o in (slide, frame, grip, guard):
    smooth(o)

# ---------------------------------------------------------------- Export
roots = [can, bag, joint, sd, slide]
for o in bpy.data.objects:
    o.select_set(False)
for r in roots:
    r.location = (0, 0, 0)
    r.select_set(True)
    for c in r.children_recursive:
        c.select_set(True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_format='GLB', export_yup=True,
                          export_apply=True, export_image_format='WEBP', export_image_quality=85)
print('wrote', OUT, os.path.getsize(OUT), 'bytes')

# ---------------------------------------------------------------- Review render
if PREVIEW:
    spots = {can: (-0.62, 0, 0.12, 90), bag: (-0.3, 0, 0.22, -28), joint: (0.0, -0.05, 0.1, 0),
             sd: (0.22, 0, 0.1, 0), slide: (0.52, 0, 0.12, 90)}
    for o, (x, y, z, rz) in spots.items():
        o.location = (x, y, z)
        o.rotation_euler = (0, 0, math.radians(rz))
    joint.rotation_euler = (0, math.radians(-35), 0)
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    col.objects.link(cam)
    scene.camera = cam
    cam.location = (-0.05, -2.3, 0.2)
    cam.rotation_euler = (math.radians(88), 0, 0)
    cam_data.lens = 50
    for (loc, e) in (((0.5, -0.8, 0.9), 40), ((-0.8, -0.5, 0.4), 14), ((0, 0.8, 0.6), 25)):
        l = bpy.data.lights.new('l', 'AREA')
        l.energy = e
        l.size = 0.6
        lo = bpy.data.objects.new('l', l)
        lo.location = loc
        col.objects.link(lo)
        lo.rotation_euler = (Vector((0, 0, 0.12)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.08, 0.08, 0.12, 1)
    scene.view_settings.view_transform = 'Standard'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.device = 'CPU'
    scene.render.resolution_x, scene.render.resolution_y = 1400, 560
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    print('preview', PREVIEW)
