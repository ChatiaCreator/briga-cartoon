# Lula's super "FAZ O L!" as a Mixamo-rig animation built in Blender: he winds up, raises the right
# hand to face height with the palm forward and makes the L (index finger up, thumb out to the
# side, the other fingers closed), holds it with a little pump, and goes back to his guard.
# Output: tools/mixamo/in/Faz_o_L.fbx, converted like any Mixamo clip (tools/mixamo/convert.cjs).
# Run: blender -b --factory-startup -P tools/blender/faz_o_l.py
#
# The rig comes from a Mixamo clip ("Fight Idle", its first frame is the base guard). Each key
# pose aims bones at directions in the character's own frame (forward, up, his right), so the
# script does not depend on how the importer turned the armature.
import bpy, math, os
from mathutils import Vector, Matrix, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.normpath(os.path.join(HERE, '..', 'mixamo', 'in'))
SRC = os.path.join(IN, 'Idle.fbx')  # a relaxed standing idle, square to the front
OUT = os.path.join(IN, 'Faz_o_L.fbx')
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
scene = bpy.context.scene
arm = next(o for o in scene.objects if o.type == 'ARMATURE')
src_act = arm.animation_data.action
scene.frame_set(int(src_act.frame_range[0]))
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
P = arm.pose.bones
B = lambda n: P['mixamorig:' + n]
for pb in P:
    if pb.rotation_mode != 'QUATERNION':
        q = pb.rotation_euler.to_quaternion()
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = q
base = {pb.name: (pb.location.copy(), pb.rotation_quaternion.copy()) for pb in P}
arm.animation_data.action = None
for pb in P:
    pb.location, pb.rotation_quaternion = base[pb.name][0].copy(), base[pb.name][1].copy()
bpy.context.view_layer.update()

# Character frame in armature space, from the rest pose (standing straight, not the guard,
# whose feet are one in front of the other): up (hips to head), his right, forward.
rest = lambda n: arm.data.bones['mixamorig:' + n].head_local.copy()
UP = (rest('Head') - rest('Hips')).normalized()
RIGHT = rest('RightUpLeg') - rest('LeftUpLeg')
RIGHT = (RIGHT - UP * RIGHT.dot(UP)).normalized()
FWD = UP.cross(RIGHT).normalized()
if (rest('Head') + FWD * 0.1 - rest('Neck')).length < (rest('Head') - rest('Neck')).length - 0.5:
    pass
# The game turns him to face the camera while he makes the L (poses.js): the gesture is built
# square to the front, hand in front of the chest and face.
FRAME = [RIGHT, UP, FWD]
D = lambda r=0.0, u=0.0, f=0.0: (FRAME[0] * r + FRAME[1] * u + FRAME[2] * f).normalized()


def chest_frame():
    """Directions from the chest as posed now: his right (left to right shoulder), up, forward."""
    up = (B('Neck').head - B('Spine1').head).normalized()
    right = B('RightArm').head - B('LeftArm').head
    right = (right - up * right.dot(up)).normalized()
    fwd = up.cross(right).normalized()
    if fwd.dot(FWD) < 0:
        fwd = -fwd
    FRAME[:] = [right, up, fwd]


def reset():
    for pb in P:
        pb.location, pb.rotation_quaternion = base[pb.name][0].copy(), base[pb.name][1].copy()
    bpy.context.view_layer.update()


def aim(name, d):
    """Turn bone `name` (its Y axis, the direction it points) to direction d (armature space)."""
    pb = B(name)
    M = pb.matrix.copy()
    cur = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    rot = cur.rotation_difference(d)
    pb.matrix = Matrix.Translation(M.translation) @ (rot.to_matrix() @ M.to_3x3()).to_4x4()
    bpy.context.view_layer.update()


def roll(name, child, want):
    """Spin bone `name` around its own axis so its child joint sits towards direction `want`."""
    pb = B(name)
    M = pb.matrix.copy()
    axis = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    off = B(child).head - pb.head
    off = (off - axis * off.dot(axis)).normalized()
    w = (want - axis * want.dot(axis)).normalized()
    ang = off.angle(w)
    if off.cross(w).dot(axis) < 0:
        ang = -ang
    rot = Quaternion(axis, ang)
    pb.matrix = Matrix.Translation(M.translation) @ (rot.to_matrix() @ M.to_3x3()).to_4x4()
    bpy.context.view_layer.update()


def spine(lean_back=0.0, twist=0.0):
    """Lean the torso back (radians, spread over three bones) and turn it towards his right."""
    for n in ('Spine', 'Spine1', 'Spine2'):
        pb = B(n)
        M = pb.matrix.copy()
        r = Quaternion(RIGHT, -lean_back / 3) @ Quaternion(UP, -twist / 3)
        pb.matrix = Matrix.Translation(M.translation) @ (r.to_matrix() @ M.to_3x3()).to_4x4()
        bpy.context.view_layer.update()


def finger(f, dirs):
    for k, d in enumerate(dirs, start=1):
        aim(f'RightHand{f}{k}', d)


def l_hand(height=1.0):
    """Right arm up with the hand at face height, palm forward, making the L."""
    chest_frame()
    # Elbow forward and a little down, forearm up: the hand ends in front of the face, a little
    # to his right (checked with FAZ_DEBUG=1: hand about 20 cm right, at face height, 30 cm forward).
    aim('RightArm', D(r=0.12, u=-0.35 + 0.15 * (height - 1), f=0.9))
    aim('RightForeArm', D(r=-0.25, u=1.0, f=0.2))
    aim('RightHand', D(r=-0.05, u=1.0, f=0.0))
    roll('RightHand', 'RightHandThumb1', D(r=-1.0, f=-0.2))    # thumb side towards his left: palm faces forward
    finger('Index', [D(u=1, f=0.03)] * 3)                      # index straight up
    finger('Thumb', [D(r=-0.7, u=0.5, f=0.2), D(r=-1, u=0.15), D(r=-1, u=0.05)])  # thumb out to the side
    for f in ('Middle', 'Ring', 'Pinky'):                      # closed against the palm
        finger(f, [D(u=0.3, f=1.0), D(u=-1.0, f=0.2), D(u=-0.4, f=-1.0)])


def key(t):
    fr = 1 + t * FPS
    for pb in P:
        pb.keyframe_insert('rotation_quaternion', frame=fr)
        pb.keyframe_insert('location', frame=fr)


scene.render.fps, scene.render.fps_base = FPS, 1.0
# 0.00 guard
reset(); key(0.0)
# 0.35 wind-up: right fist pulled down to the hip, torso leaning in and turned away
reset()
chest_frame()
aim('RightArm', D(r=0.35, u=-1.0, f=-0.1)); aim('RightForeArm', D(r=0.1, u=-0.2, f=1.0))
spine(lean_back=-0.25, twist=-0.35); key(0.35)
# 0.60 the L goes up (the wave bursts here), chest out and head up
reset(); spine(lean_back=0.22, twist=0.25); l_hand(); key(0.6)
if os.environ.get('FAZ_DEBUG'):
    c = B('Spine2').head
    for n in ('RightArm', 'RightForeArm', 'RightHand', 'Head', 'LeftHand'):
        v = B(n).head - c
        print('DEBUG', n, 'right %.2f up %.2f fwd %.2f' % (v.dot(FRAME[0]), v.dot(FRAME[1]), v.dot(FRAME[2])))
    print('DEBUG frame', [tuple(round(x, 2) for x in a) for a in FRAME], 'rest', [tuple(round(x, 2) for x in a) for a in (RIGHT, UP, FWD)])
# hold with a little pump
reset(); spine(lean_back=0.28, twist=0.25); l_hand(1.6); key(0.95)
reset(); spine(lean_back=0.22, twist=0.25); l_hand(); key(1.3)
# 1.80 back to the guard
reset(); key(1.8)
scene.frame_start, scene.frame_end = 1, int(1 + 1.8 * FPS)
arm.animation_data.action.name = 'Faz_o_L'
bpy.data.actions.remove(src_act)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.ops.export_scene.fbx(filepath=OUT, use_selection=True, object_types={'ARMATURE'}, add_leaf_bones=False,
                         bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
                         bake_anim_simplify_factor=0.0)
print('wrote', OUT)
