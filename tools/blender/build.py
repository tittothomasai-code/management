# Usage: blender -b --factory-startup --python build.py -- <rig> <lod 0|1|2> <out.glb>
# Builds one showroom rig at one LOD, bakes AO into the 'AO' vertex colour, exports Draco-compressed GLB.
import sys, os, importlib, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
rig, lod, out = sys.argv[sys.argv.index('--') + 1:][:3]; lod = int(lod)
import parts; parts.reset(); parts.LOD = lod
mod = importlib.import_module('rig_' + rig); mod.build()
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == 'MESH']
for o in meshes:
    a = o.data.color_attributes.new('AO', 'BYTE_COLOR', 'POINT'); o.data.color_attributes.active_color = a
    o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index
# Bake ambient occlusion into vertex colours (Cycles, CPU). Low LOD uses fewer samples.
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = (8, 16, 32)[lod]
sc.render.bake.target = 'VERTEX_COLORS'; sc.render.bake.margin = 0
w = bpy.data.worlds.new('w'); sc.world = w; w.light_settings.distance = 6.0
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
try:
    bpy.ops.object.bake(type='AO')
except Exception as e:
    print('AO bake failed, exporting without AO:', e)
# Brighten AO (keep contact darkening but avoid muddy colours): ao' = 0.35 + 0.65 * ao
for o in meshes:
    a = o.data.color_attributes['AO']
    for d in a.data:
        v = d.color[0]; v = .35 + .65 * v; d.color = (v, v, v, 1)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True,
    export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
    export_normals=True, export_texcoords=False, export_materials='EXPORT', export_extras=False, export_lights=False, export_cameras=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=(12, 14, 14)[lod], export_draco_normal_quantization=(8, 10, 10)[lod],
    export_draco_color_quantization=8)
print('BUILT', rig, lod, out, os.path.getsize(out), 'bytes', len(meshes), 'meshes', sum(len(o.data.polygons) for o in meshes), 'faces')
