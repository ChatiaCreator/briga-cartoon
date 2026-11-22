# Mirrors a Mixamo animation (FBX, "Without Skin"): the same move with the other arm or leg.
# Run: blender -b --factory-startup -P tools/blender/mirror_anim.py -- <in.fbx> <out.fbx> [--no-flip]
# --no-flip only re-exports (to check that the trip through Blender changes nothing).
# The result goes to tools/mixamo/in/ and through tools/mixamo/convert.cjs like any Mixamo clip.
import bpy, sys

args = sys.argv[sys.argv.index('--') + 1:]
src, dst = args[0], args[1]
flip = '--no-flip' not in args

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
act = arm.animation_data.action
f0, f1 = (int(round(x)) for x in act.frame_range)
scene = bpy.context.scene
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')

# Blender flips poses between bones named "<name>.L" / "<name>.R": rename Mixamo's
# "mixamorig:LeftArm" to "mixamorig:Arm.L" while flipping, and back afterwards.
def side_names(to_lr):
    for b in arm.data.bones:
        n = b.name
        if to_lr:
            for side, suf in (('Left', '.L'), ('Right', '.R')):
                key = 'mixamorig:' + side
                if n.startswith(key):
                    b.name = 'mixamorig:' + n[len(key):] + suf
        else:
            for side, suf in (('Left', '.L'), ('Right', '.R')):
                if n.endswith(suf):
                    b.name = 'mixamorig:' + side + n[len('mixamorig:'):-len(suf)]

if flip:
    side_names(True)
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION' if pb.rotation_mode == 'QUATERNION' else pb.rotation_mode

poses = []
for f in range(f0, f1 + 1):
    scene.frame_set(f)
    if flip:
        bpy.ops.pose.select_all(action='SELECT')
        bpy.ops.pose.copy()
        bpy.ops.pose.paste(flipped=True)
    poses.append({pb.name: (pb.location.copy(), pb.rotation_quaternion.copy(), pb.rotation_euler.copy(), pb.rotation_mode)
                  for pb in arm.pose.bones})

# The importer sets the scene to 60 fps, but the exported file is read back at 30 fps (the clip
# came out twice as long): key the poses at 30 fps, which is what Mixamo delivers anyway.
fps_in = scene.render.fps / scene.render.fps_base
OUT_FPS = 30
scene.render.fps, scene.render.fps_base = OUT_FPS, 1.0
to_out = lambda f: 1 + (f - f0) * OUT_FPS / fps_in
arm.animation_data.action = None
for i, f in enumerate(range(f0, f1 + 1)):
    for pb in arm.pose.bones:
        loc, q, e, mode = poses[i][pb.name]
        pb.location = loc
        pb.keyframe_insert('location', frame=to_out(f))
        if mode == 'QUATERNION':
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=to_out(f))
        else:
            pb.rotation_euler = e
            pb.keyframe_insert('rotation_euler', frame=to_out(f))
scene.frame_start, scene.frame_end = 1, int(round(to_out(f1)))
arm.animation_data.action.name = act.name + ('_Mirror' if flip else '')
bpy.ops.object.mode_set(mode='OBJECT')
if flip:
    side_names(False)
bpy.data.actions.remove(act)

bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
bpy.ops.export_scene.fbx(filepath=dst, use_selection=True, object_types={'ARMATURE'}, add_leaf_bones=False,
                         bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
                         bake_anim_simplify_factor=0.0)
print('wrote', dst, 'frames', f0, f1)
