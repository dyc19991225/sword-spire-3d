import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix, Euler

BASE_PUBLIC = r"E:\ai\sword-spire-3d\public"
MODEL_DIR = os.path.join(BASE_PUBLIC, "models")
UI_DIR = os.path.join(BASE_PUBLIC, "ui")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(UI_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb_to_lin(c):
    return pow(c / 255.0, 2.2)


def hex_rgba(hex_rgb):
    return (
        srgb_to_lin((hex_rgb >> 16) & 0xFF),
        srgb_to_lin((hex_rgb >> 8) & 0xFF),
        srgb_to_lin(hex_rgb & 0xFF),
        1.0,
    )


def make_vcol_mat(name, metallic=0.62, roughness=0.32, emission_strength=0.36):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    vcol = nt.nodes.new(type='ShaderNodeVertexColor')
    vcol.layer_name = "Color"
    nt.links.new(vcol.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if 'Emission Color' in bsdf.inputs:
        nt.links.new(vcol.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    return mat


def make_pbr_mat(name, hex_rgb, metallic=0.78, roughness=0.22, emit_hex=None, emit_str=0.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = hex_rgba(hex_rgb)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emit_hex is not None and emit_str > 0 and 'Emission Color' in bsdf.inputs:
        bsdf.inputs['Emission Color'].default_value = hex_rgba(emit_hex)
        bsdf.inputs['Emission Strength'].default_value = emit_str
    return mat


def stamp_part(target_bm, target_col, part_bm, rgba, loc=(0, 0, 0), rot=(0, 0, 0)):
    bmesh.ops.recalc_face_normals(part_bm, faces=part_bm.faces)
    mat_xform = Matrix.Translation(Vector(loc)) @ Euler(rot, 'XYZ').to_matrix().to_4x4()
    bmesh.ops.transform(part_bm, matrix=mat_xform, verts=part_bm.verts)
    vmap = {v: target_bm.verts.new(v.co) for v in part_bm.verts}
    for f in part_bm.faces:
        try:
            nf = target_bm.faces.new([vmap[v] for v in f.verts])
            for loop in nf.loops:
                loop[target_col] = rgba
        except ValueError:
            pass
    part_bm.free()


def add_box_vc(bm, col, sx, sy, sz, hex_rgb, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.025):
    p = bmesh.new()
    bmesh.ops.create_cube(p, size=1.0)
    bmesh.ops.scale(p, vec=(sx, sy, sz), verts=p.verts)
    if bevel > 0:
        bmesh.ops.bevel(p, geom=list(p.edges), offset=bevel, segments=1, affect='EDGES')
    stamp_part(bm, col, p, hex_rgba(hex_rgb), loc=loc, rot=rot)


def add_cone_vc(bm, col, r1, r2, depth, hex_rgb, loc=(0, 0, 0), rot=(0, 0, 0), segs=8):
    p = bmesh.new()
    bmesh.ops.create_cone(p, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
    stamp_part(bm, col, p, hex_rgba(hex_rgb), loc=loc, rot=rot)


def add_sphere_vc(bm, col, rx, ry, rz, hex_rgb, loc=(0, 0, 0), subdiv=1):
    p = bmesh.new()
    bmesh.ops.create_icosphere(p, subdivisions=subdiv, radius=1.0)
    bmesh.ops.scale(p, vec=(rx, ry, rz), verts=p.verts)
    stamp_part(bm, col, p, hex_rgba(hex_rgb), loc=loc)


def finalize_vc_obj(name, bm, mat):
    mesh = bpy.data.meshes.new(name + "_m")
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    print(f"  Built {name}: {len(mesh.polygons)} polys")
    return o


# =========================================================================
# 1. Build All 3D Xianxia Arena, Sword Cultivator, Flying Jian & Demons GLB!
# Note: -Y in Blender exports to +Z in Three.js!
# =========================================================================
def build_xianxia_3d_glb():
    clear_scene()
    mat = make_vcol_mat("XianxiaVColMat", metallic=0.60, roughness=0.30, emission_strength=0.38)

    # 1. Arena_Platform — Floating Obsidian-Jade Bagua Sword Altar + Stone Monoliths
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Color")
    add_cone_vc(bm, col, 7.6, 6.2, 0.72, 0x0b1120, loc=(0, 0, -0.36), segs=8)
    add_cone_vc(bm, col, 7.75, 7.65, 0.14, 0xd97706, loc=(0, 0, -0.05), segs=8)
    add_cone_vc(bm, col, 5.4, 5.4, 0.06, 0x111827, loc=(0, 0, 0.01), segs=8)
    add_cone_vc(bm, col, 3.6, 3.6, 0.07, 0x0f766e, loc=(0, 0, 0.015), segs=8)
    add_cone_vc(bm, col, 3.3, 3.3, 0.08, 0x090d16, loc=(0, 0, 0.02), segs=8)
    # 4 Ancient Floating Sword-Tomb Pillars in Background (+Y in Blender -> -Z background in Three.js!)
    for px, py, pz, tilt in (
        (-5.8, 3.6, 1.4, 0.08),
        (-2.6, 4.8, 1.9, -0.06),
        (2.8, 4.7, 1.8, 0.07),
        (5.9, 3.5, 1.5, -0.09),
    ):
        add_box_vc(bm, col, 0.72, 0.72, 3.4, 0x1e293b, loc=(px, py, pz), rot=(0, tilt, 0.2), bevel=0.05)
        add_box_vc(bm, col, 0.16, 0.76, 2.5, 0x2dd4bf, loc=(px, py, pz + 0.1), rot=(0, tilt, 0.2), bevel=0.01)
        add_cone_vc(bm, col, 0.56, 0.04, 0.85, 0xfbbf24, loc=(px, py, pz + 2.05), rot=(0, tilt, 0), segs=4)
    finalize_vc_obj("Arena_Platform", bm, mat)

    # 2. Hero_Cultivator — Immortal Sword Master (faces -Y -> +Z; rotated in Three.js toward enemies!)
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Color")
    # Flowing Dark-Indigo & Jade-White Immortal Robe Skirt
    add_cone_vc(bm, col, 0.52, 0.30, 0.92, 0x0f172a, loc=(0, 0, 0.46), segs=8)
    add_box_vc(bm, col, 0.30, 0.10, 0.86, 0xf8fafc, loc=(0, -0.34, 0.45), rot=(0.12, 0, 0), bevel=0.015)
    add_box_vc(bm, col, 0.18, 0.12, 0.82, 0x2dd4bf, loc=(0, -0.36, 0.44), rot=(0.12, 0, 0), bevel=0.01)
    # Upper Robe, Golden Belt & Jade Clouds Pauldrons
    add_box_vc(bm, col, 0.64, 0.40, 0.58, 0x1e293b, loc=(0, 0, 1.16), bevel=0.04)
    add_box_vc(bm, col, 0.68, 0.44, 0.12, 0xfbbf24, loc=(0, 0, 0.92), bevel=0.02)
    for sx in (-1, 1):
        add_box_vc(bm, col, 0.28, 0.38, 0.20, 0xe2e8f0, loc=(sx * 0.42, 0, 1.38), rot=(0, -sx * 0.28, 0), bevel=0.03)
        add_box_vc(bm, col, 0.30, 0.14, 0.08, 0xfbbf24, loc=(sx * 0.44, -0.14, 1.46), rot=(0, -sx * 0.28, 0), bevel=0.01)
        # Wide Immortal Sleeves + Sword-Finger Pose
        add_box_vc(bm, col, 0.20, 0.48, 0.24, 0x0f172a, loc=(sx * 0.44, -0.18, 1.12), rot=(0.35 if sx == 1 else -0.1, 0, 0), bevel=0.025)
    # Head + Topknot Golden Crown (束发紫金冠) + Glowing Eyes
    add_sphere_vc(bm, col, 0.22, 0.22, 0.24, 0xfde68a, loc=(0, -0.02, 1.66), subdiv=2)
    add_box_vc(bm, col, 0.36, 0.30, 0.22, 0x090d16, loc=(0, 0.06, 1.74), bevel=0.03)
    add_cone_vc(bm, col, 0.12, 0.08, 0.22, 0xfbbf24, loc=(0, 0.02, 1.96), segs=6)
    add_box_vc(bm, col, 0.32, 0.04, 0.04, 0x67e8f9, loc=(0, 0.02, 1.98), bevel=0.005)  # Hairpin!
    # Back-Mounted Ornate Ancient Sword Casket (青萍古剑匣)
    add_box_vc(bm, col, 0.36, 0.22, 1.18, 0x1c1917, loc=(0, 0.30, 1.32), rot=(0, 0.18, 0), bevel=0.03)
    add_box_vc(bm, col, 0.14, 0.24, 0.96, 0x2dd4bf, loc=(0, 0.31, 1.32), rot=(0, 0.18, 0), bevel=0.015)
    add_box_vc(bm, col, 0.40, 0.25, 0.12, 0xfbbf24, loc=(0, 0.30, 1.82), rot=(0, 0.18, 0), bevel=0.015)
    finalize_vc_obj("Hero_Cultivator", bm, mat)

    # 3. Flying_Jian — High-Detail Ancient Chinese Flying Sword (Tip along +Z Up in Blender -> +Y Up in Three.js!)
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Color")
    add_cone_vc(bm, col, 0.10, 0.01, 1.08, 0xffffff, loc=(0, 0, 0.42), segs=4)
    add_box_vc(bm, col, 0.04, 0.05, 0.85, 0xfef08a, loc=(0, 0, 0.32), bevel=0.005)
    add_box_vc(bm, col, 0.32, 0.09, 0.09, 0xfbbf24, loc=(0, 0, -0.12), bevel=0.015)
    add_cone_vc(bm, col, 0.045, 0.045, 0.26, 0x1e293b, loc=(0, 0, -0.28), segs=6)
    add_sphere_vc(bm, col, 0.065, 0.065, 0.065, 0xfbbf24, loc=(0, 0, -0.43), subdiv=1)
    finalize_vc_obj("Flying_Jian", bm, mat)

    # 4. Enemy_WolfDemon — Azure-Fanged Blood Werewolf Demon
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Color")
    for sx in (-1, 1):
        add_box_vc(bm, col, 0.22, 0.34, 0.48, 0x1e1b4b, loc=(sx * 0.26, 0.06, 0.28), rot=(0.2, 0, 0), bevel=0.025)
        add_cone_vc(bm, col, 0.09, 0.02, 0.22, 0xf43f5e, loc=(sx * 0.26, -0.18, 0.08), rot=(math.pi / 2, 0, 0), segs=5)
    add_box_vc(bm, col, 0.76, 0.62, 0.64, 0x312e81, loc=(0, -0.04, 0.92), rot=(0.28, 0, 0), bevel=0.05)
    add_cone_vc(bm, col, 0.32, 0.08, 0.56, 0x1e1b4b, loc=(0, -0.38, 1.34), rot=(1.15, 0, 0), segs=6)
    for sx in (-1, 1):
        add_cone_vc(bm, col, 0.09, 0.01, 0.34, 0x67e8f9, loc=(sx * 0.18, -0.22, 1.58), rot=(-0.2, sx * 0.25, 0), segs=5)
        add_sphere_vc(bm, col, 0.07, 0.05, 0.05, 0xff1e42, loc=(sx * 0.14, -0.48, 1.40), subdiv=1)
        # Clawed Arms + Giant Crimson Energy Talons
        add_box_vc(bm, col, 0.22, 0.54, 0.22, 0x1e1b4b, loc=(sx * 0.52, -0.28, 0.96), rot=(0.4, 0, -sx * 0.2), bevel=0.025)
        for ci in (-0.06, 0.06):
            add_cone_vc(bm, col, 0.045, 0.008, 0.38, 0xf43f5e, loc=(sx * 0.54 + ci, -0.64, 0.84), rot=(1.35, 0, 0), segs=4)
    finalize_vc_obj("Enemy_WolfDemon", bm, mat)

    # 5. Enemy_TalonGhost — Floating Netherworld Ghost Cultivator
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Color")
    add_cone_vc(bm, col, 0.48, 0.08, 1.25, 0x2e1065, loc=(0, 0, 0.78), rot=(math.pi, 0, 0), segs=7)
    add_box_vc(bm, col, 0.68, 0.42, 0.54, 0x4c1d95, loc=(0, 0, 1.38), bevel=0.04)
    add_sphere_vc(bm, col, 0.24, 0.24, 0.26, 0xe2e8f0, loc=(0, -0.08, 1.82), subdiv=1)
    add_box_vc(bm, col, 0.28, 0.08, 0.08, 0xc084fc, loc=(0, -0.28, 1.82), bevel=0.01)
    for sx in (-1, 1):
        add_cone_vc(bm, col, 0.08, 0.01, 0.42, 0xfbbf24, loc=(sx * 0.22, -0.06, 2.08), rot=(0, -sx * 0.42, 0), segs=5)
        # Floating Nether Sickles
        add_box_vc(bm, col, 0.10, 0.72, 0.14, 0xa855f7, loc=(sx * 0.68, -0.32, 1.42), rot=(0.3, 0, sx * 0.35), bevel=0.015)
    finalize_vc_obj("Enemy_TalonGhost", bm, mat)

    # 6. Enemy_IronGolem — Ancient Bronze-Iron Tomb Sword Guardian
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Color")
    for sx in (-1, 1):
        add_box_vc(bm, col, 0.34, 0.44, 0.66, 0x27272a, loc=(sx * 0.34, 0, 0.33), bevel=0.03)
    add_box_vc(bm, col, 1.06, 0.68, 0.78, 0x3f3f46, loc=(0, 0, 1.12), bevel=0.06)
    add_sphere_vc(bm, col, 0.22, 0.14, 0.22, 0xfbbf24, loc=(0, -0.34, 1.14), subdiv=1)
    add_box_vc(bm, col, 0.44, 0.42, 0.36, 0x18181b, loc=(0, -0.04, 1.68), bevel=0.04)
    add_box_vc(bm, col, 0.36, 0.08, 0.09, 0xfef08a, loc=(0, -0.24, 1.68), bevel=0.01)
    for sx in (-1, 1):
        add_box_vc(bm, col, 0.44, 0.56, 0.34, 0x78350f, loc=(sx * 0.72, 0, 1.44), rot=(0, -sx * 0.25, 0), bevel=0.04)
    # Giant Bronze Broadsword in Right Hand
    add_box_vc(bm, col, 0.28, 0.68, 0.28, 0x27272a, loc=(0.74, -0.28, 1.02), bevel=0.025)
    add_box_vc(bm, col, 0.16, 1.55, 0.34, 0xf59e0b, loc=(0.74, -1.12, 1.12), rot=(0.25, 0, 0), bevel=0.02)
    finalize_vc_obj("Enemy_IronGolem", bm, mat)

    # 7. Boss_SpiderQueen — Millennium Crimson Demoness Arachnid
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Color")
    add_sphere_vc(bm, col, 0.72, 0.92, 0.58, 0x881337, loc=(0, 0.56, 0.78), subdiv=2)
    add_sphere_vc(bm, col, 0.34, 0.34, 0.34, 0xff1e42, loc=(0, 0.96, 0.96), subdiv=1)
    add_box_vc(bm, col, 0.68, 0.58, 0.62, 0x4c0519, loc=(0, -0.24, 0.98), bevel=0.05)
    add_cone_vc(bm, col, 0.24, 0.06, 0.44, 0xfbbf24, loc=(0, -0.26, 1.56), segs=6)
    add_box_vc(bm, col, 0.48, 0.12, 0.12, 0xfda4af, loc=(0, -0.52, 1.12), bevel=0.01)
    for sx in (-1, 1):
        for li, ly in enumerate((-0.42, -0.10, 0.24, 0.58)):
            add_box_vc(bm, col, 0.68, 0.12, 0.12, 0x18181b, loc=(sx * 0.72, ly, 0.86), rot=(0, sx * 0.48, sx * (li - 1.5) * 0.22), bevel=0.02)
            add_cone_vc(bm, col, 0.09, 0.015, 0.92, 0xf43f5e, loc=(sx * 1.12, ly * 1.1, 0.44), rot=(math.pi, -sx * 0.22, 0), segs=5)
    finalize_vc_obj("Boss_SpiderQueen", bm, mat)

    # 8. Boss_FallenImmortal — Six-Winged Fallen Immortal Overlord + Demonic Sword Halo!
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Color")
    # Floating Dark-Gold Lotus Throne Base
    add_cone_vc(bm, col, 0.92, 0.56, 0.34, 0x78350f, loc=(0, 0, 0.32), segs=8)
    add_cone_vc(bm, col, 0.62, 0.36, 1.18, 0x18181b, loc=(0, 0, 1.02), segs=8)
    add_box_vc(bm, col, 0.92, 0.54, 0.72, 0x3b0764, loc=(0, 0, 1.76), bevel=0.05)
    add_sphere_vc(bm, col, 0.22, 0.14, 0.24, 0xf43f5e, loc=(0, -0.28, 1.78), subdiv=1)
    # Horned Imperial Crown Head
    add_box_vc(bm, col, 0.42, 0.42, 0.42, 0x090d16, loc=(0, -0.04, 2.34), bevel=0.04)
    add_box_vc(bm, col, 0.36, 0.10, 0.10, 0xfef08a, loc=(0, -0.25, 2.34), bevel=0.01)
    for sx in (-1, 1):
        add_cone_vc(bm, col, 0.10, 0.01, 0.62, 0xfbbf24, loc=(sx * 0.28, -0.10, 2.74), rot=(0, -sx * 0.42, 0), segs=5)
        add_box_vc(bm, col, 0.48, 0.54, 0.34, 0x9f1239, loc=(sx * 0.68, 0, 2.02), rot=(0, -sx * 0.32, 0), bevel=0.035)
        # 6 Seraphim Demonic Sword-Wings on Back!
        for wi, wang in enumerate((0.55, 0.08, -0.38)):
            add_cone_vc(
                bm, col, 0.14, 0.015, 1.68,
                0xfbbf24 if wi == 0 else 0xc084fc,
                loc=(sx * (0.88 + wi * 0.15), 0.36, 2.15 - wi * 0.36),
                rot=(0.15, sx * (1.15 - wang * 0.5), 0), segs=4
            )
    finalize_vc_obj("Boss_FallenImmortal", bm, mat)

    out_glb = os.path.join(MODEL_DIR, "xianxia_arena.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
    )
    print(f"Exported xianxia_arena.glb ({os.path.getsize(out_glb)} bytes)")


# =========================================================================
# 2. Render 11 Studio Cycles 192x192 RGBA Card & Relic Illustrations!
# =========================================================================
def render_xianxia_card_icons():
    clear_scene()
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = 22
    scn.cycles.use_denoising = False
    scn.render.resolution_x = 192
    scn.render.resolution_y = 192
    scn.render.film_transparent = True
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGBA'

    world = bpy.data.worlds.new("XianxiaWorld")
    scn.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.03, 0.04, 0.09, 1.0)
        bg.inputs[1].default_value = 0.95

    cam_data = bpy.data.cameras.new("IconCam")
    cam_data.lens = 56
    cam = bpy.data.objects.new("IconCam", cam_data)
    scn.collection.objects.link(cam)
    scn.camera = cam
    cam.location = (2.3, -2.5, 1.85)
    cam.rotation_euler = (Vector((0, 0, 0.05)) - cam.location).to_track_quat('-Z', 'Y').to_euler()

    for name, loc, energy, hex_c in (
        ("Key", (3.0, -2.4, 3.2), 150, 0xffffff),
        ("Rim", (-2.8, 1.8, 2.0), 120, 0x2dd4bf),
        ("Fill", (1.8, 2.6, -1.0), 95, 0xfbbf24),
    ):
        ld = bpy.data.lights.new(name=name, type='AREA')
        ld.energy = energy
        ld.size = 2.0
        c = hex_rgba(hex_c)
        ld.color = (c[0], c[1], c[2])
        lo = bpy.data.objects.new(name, ld)
        scn.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0)) - lo.location).to_track_quat('-Z', 'Y').to_euler()

    root = bpy.data.objects.new("IconRoot", None)
    scn.collection.objects.link(root)

    m_obsidian = make_pbr_mat("IObs", 0x0f172a, 0.85, 0.22)
    m_gold = make_pbr_mat("IGold", 0xfbbf24, 0.92, 0.16, 0xf59e0b, 1.1)
    m_jade = make_pbr_mat("IJade", 0x2dd4bf, 0.25, 0.14, 0x14b8a6, 2.1)
    m_crimson = make_pbr_mat("ICrim", 0xf43f5e, 0.35, 0.16, 0xe11d48, 2.4)
    m_violet = make_pbr_mat("IVio", 0xc084fc, 0.3, 0.15, 0xa855f7, 2.5)
    m_ice = make_pbr_mat("IIce", 0x67e8f9, 0.18, 0.10, 0x38bdf8, 2.3)

    def clear_root():
        for ch in list(root.children):
            m = ch.data
            bpy.data.objects.remove(ch, do_unlink=True)
            if m and isinstance(m, bpy.types.Mesh):
                bpy.data.meshes.remove(m, do_unlink=True)

    def prim(kind, name, scale, mat, loc=(0, 0, 0), rot=(0, 0, 0), segs=12):
        bm = bmesh.new()
        if kind == 'box':
            bmesh.ops.create_cube(bm, size=1.0)
            bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.03, segments=2, affect='EDGES')
        elif kind == 'cone':
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=scale[0], radius2=scale[1], depth=scale[2])
        elif kind == 'sphere':
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
            bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        mesh = bpy.data.meshes.new(name + "_im")
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(mat)
        o = bpy.data.objects.new(name, mesh)
        o.parent = root
        o.location = loc
        o.rotation_euler = rot
        scn.collection.objects.link(o)

    def save(fname):
        scn.render.filepath = os.path.join(UI_DIR, fname)
        bpy.ops.render.render(write_still=True)
        print(f"Rendered icon: {fname}")

    # 1. card_sword_gold.png
    clear_root()
    prim('cone', 'Blade', (0.22, 0.015, 1.55), m_gold, loc=(0.08, 0, 0.18), rot=(0.35, -0.45, 0), segs=4)
    prim('box', 'Guard', (0.62, 0.14, 0.14), m_jade, loc=(-0.18, -0.14, -0.26), rot=(0.35, -0.45, 0))
    prim('cone', 'Grip', (0.08, 0.08, 0.42), m_obsidian, loc=(-0.34, -0.26, -0.50), rot=(0.35, -0.45, 0), segs=8)
    save("card_sword_gold.png")

    # 2. card_sword_crimson.png
    clear_root()
    prim('cone', 'BladeC', (0.28, 0.02, 1.58), m_crimson, loc=(0.06, 0, 0.18), rot=(0.32, -0.48, 0), segs=4)
    prim('box', 'GuardC', (0.68, 0.16, 0.16), m_gold, loc=(-0.20, -0.14, -0.26), rot=(0.32, -0.48, 0))
    save("card_sword_crimson.png")

    # 3. card_shield_jade.png
    clear_root()
    prim('cone', 'BaguaOuter', (0.86, 0.80, 0.18), m_gold, rot=(1.05, 0, -0.45), segs=8)
    prim('cone', 'BaguaInner', (0.66, 0.62, 0.22), m_jade, rot=(1.05, 0, -0.45), segs=8)
    prim('sphere', 'Core', (0.22, 0.22, 0.22), m_ice, loc=(-0.05, -0.12, 0.06))
    save("card_shield_jade.png")

    # 4. card_talisman_fire.png
    clear_root()
    prim('box', 'Paper', (0.72, 0.08, 1.32), m_gold, rot=(0.25, -0.25, 0.35))
    prim('box', 'Seal', (0.38, 0.11, 0.92), m_crimson, rot=(0.25, -0.25, 0.35))
    prim('sphere', 'Flame', (0.28, 0.28, 0.36), m_crimson, loc=(0.34, -0.26, 0.18))
    save("card_talisman_fire.png")

    # 5. card_thunder_orb.png
    clear_root()
    prim('sphere', 'Orb', (0.52, 0.52, 0.52), m_violet)
    for k in range(4):
        a = k * (math.pi / 2)
        prim('cone', f'Spk_{k}', (0.12, 0.01, 0.72), m_gold, loc=(math.cos(a) * 0.56, math.sin(a) * 0.56, 0), rot=(0.4, 0, a), segs=4)
    save("card_thunder_orb.png")

    # 6. card_lotus_ice.png
    clear_root()
    prim('sphere', 'Bud', (0.28, 0.28, 0.36), m_ice, loc=(0, 0, 0.12))
    for k in range(6):
        a = k * (math.tau / 6)
        prim('cone', f'Petal_{k}', (0.22, 0.02, 0.68), m_ice if k % 2 == 0 else m_jade, loc=(math.cos(a) * 0.44, math.sin(a) * 0.44, -0.05), rot=(0.55 * math.sin(a), -0.55 * math.cos(a), 0), segs=4)
    save("card_lotus_ice.png")

    # 7. card_gourd_jade.png
    clear_root()
    prim('sphere', 'Bot', (0.48, 0.48, 0.46), m_jade, loc=(0, 0, -0.22), rot=(0, 0.2, 0))
    prim('sphere', 'Top', (0.32, 0.32, 0.34), m_jade, loc=(0.06, 0, 0.32), rot=(0, 0.2, 0))
    prim('cone', 'Cord', (0.24, 0.24, 0.12), m_crimson, loc=(0.03, 0, 0.10), segs=12)
    prim('cone', 'Cork', (0.12, 0.09, 0.22), m_gold, loc=(0.10, 0, 0.66), segs=10)
    save("card_gourd_jade.png")

    # 8. card_bell_gold.png
    clear_root()
    prim('cone', 'BellBody', (0.68, 0.38, 0.96), m_gold, loc=(0, 0, -0.06), segs=14)
    prim('cone', 'BellRim', (0.76, 0.70, 0.16), m_obsidian, loc=(0, 0, -0.48), segs=14)
    prim('sphere', 'BellTop', (0.22, 0.22, 0.22), m_jade, loc=(0, 0, 0.52))
    save("card_bell_gold.png")

    # 9. relic_box.png
    clear_root()
    prim('box', 'Casket', (0.58, 0.38, 1.38), m_obsidian, rot=(0.25, 0.35, -0.25))
    prim('box', 'JadeInlay', (0.24, 0.42, 1.12), m_jade, rot=(0.25, 0.35, -0.25))
    prim('cone', 'HiltTop', (0.16, 0.04, 0.42), m_gold, loc=(0.24, 0.12, 0.68), rot=(0.25, 0.35, -0.25), segs=4)
    save("relic_box.png")

    # 10. relic_furnace.png
    clear_root()
    prim('sphere', 'Cauldron', (0.56, 0.56, 0.48), m_gold, loc=(0, 0, 0.02))
    prim('cone', 'Lid', (0.46, 0.12, 0.36), m_violet, loc=(0, 0, 0.48), segs=8)
    for k in range(3):
        a = k * (math.tau / 3)
        prim('cone', f'Leg_{k}', (0.12, 0.06, 0.48), m_obsidian, loc=(math.cos(a) * 0.42, math.sin(a) * 0.42, -0.42), segs=8)
    save("relic_furnace.png")

    # 11. relic_jade.png
    clear_root()
    prim('cone', 'Disc', (0.68, 0.68, 0.16), m_jade, rot=(1.1, 0, -0.4), segs=16)
    prim('cone', 'CenterGold', (0.28, 0.28, 0.20), m_gold, rot=(1.1, 0, -0.4), segs=12)
    save("relic_jade.png")


if __name__ == "__main__":
    build_xianxia_3d_glb()
    render_xianxia_card_icons()
    print("=== ALL XIANXIA 3D ACTORS, ARENA & 11 CYCLES ICONS COMPLETE ===")
