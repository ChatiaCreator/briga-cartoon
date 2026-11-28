# Converts a rigged character FBX (for example from Tripo) to the GLB the game reads: mesh,
# skeleton and textures, no animations.
# Run: blender -b --factory-startup -P tools/blender/fbx_to_glb.py -- <in.fbx> <out.glb>
import bpy, sys, os

src, dst = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)
# Textures packed inside the FBX are kept in the GLB.
for img in bpy.data.images:
    if img.source == 'FILE' and not img.packed_file and img.filepath and not os.path.exists(bpy.path.abspath(img.filepath)):
        print('missing texture', img.filepath)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
arm = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE'), None)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print('armature', arm and arm.name, 'bones', arm and len(arm.data.bones), 'meshes', [m.name for m in meshes],
      'images', [i.name for i in bpy.data.images])
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=False, export_skins=True,
                          export_yup=True, export_apply=False, export_image_format='AUTO')
print('wrote', dst, os.path.getsize(dst))
