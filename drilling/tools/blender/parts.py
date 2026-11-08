# Shared parts library for the showroom rigs (generic, SIM). Blender 4.2, run headless via build.sh.
# Every exported node is named <bomAsset> (empty) with children <bomAsset>__<component> (meshes),
# so the game can map highlight/zoom to the BOM (bom_data.js RIG assets/components).
# Units: metres. Blender Z-up; the glTF exporter converts to Y-up.
import bpy, bmesh, math
from mathutils import Vector, Matrix

LOD = 2          # 0 = low (phone), 1 = medium, 2 = high. Set by build.py
def seg(lo, mid, hi): return (lo, mid, hi)[LOD]

# ---------- PBR materials (no textures: small files; AO is baked into vertex colour) ----------
MATS = {
 'paint_yellow': ((0.95, 0.68, 0.06), 0.25, 0.45), 'paint_red': ((0.78, 0.08, 0.07), 0.25, 0.45),
 'paint_blue': ((0.10, 0.30, 0.62), 0.25, 0.45), 'paint_green': ((0.13, 0.42, 0.20), 0.25, 0.5),
 'paint_white': ((0.88, 0.89, 0.90), 0.15, 0.5), 'paint_grey': ((0.36, 0.39, 0.43), 0.3, 0.55),
 'paint_orange': ((0.92, 0.42, 0.06), 0.25, 0.45), 'steel_dark': ((0.16, 0.17, 0.19), 0.7, 0.5),
 'galv': ((0.72, 0.74, 0.76), 1.0, 0.32), 'rubber': ((0.03, 0.03, 0.03), 0.0, 0.9),
 'hazard_y': ((0.98, 0.78, 0.05), 0.2, 0.5), 'hazard_k': ((0.02, 0.02, 0.02), 0.2, 0.6),
 'deck': ((0.30, 0.31, 0.30), 0.6, 0.7), 'hull': ((0.12, 0.17, 0.28), 0.3, 0.55),
 'hull_red': ((0.55, 0.08, 0.06), 0.2, 0.6), 'glass': ((0.25, 0.45, 0.6), 0.0, 0.08),
 'wire': ((0.45, 0.45, 0.45), 1.0, 0.4), 'pipe': ((0.35, 0.22, 0.12), 0.6, 0.6),
}
_mat_cache = {}
def mat(name):
    if name in _mat_cache: return _mat_cache[name]
    c, m, r = MATS[name]
    M = bpy.data.materials.new(name); M.use_nodes = True
    nt = M.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Metallic'].default_value = m; b.inputs['Roughness'].default_value = r
    if name == 'glass':
        b.inputs['Emission Color'].default_value = (1.0, 0.85, 0.55, 1); b.inputs['Emission Strength'].default_value = 0.0
    # Multiply base colour by the baked AO vertex colour (exporter writes COLOR_0; three.js multiplies it in)
    va = nt.nodes.new('ShaderNodeVertexColor'); va.layer_name = 'AO'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
    mix.inputs['A'].default_value = (*c, 1)
    nt.links.new(va.outputs['Color'], mix.inputs['B']); nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    _mat_cache[name] = M; return M

# ---------- mesh builder: accumulate many primitives into one bmesh per component ----------
class MB:
    def __init__(self): self.bm = bmesh.new(); self.mats = []
    def _mi(self, m):
        if m not in self.mats: self.mats.append(m)
        return self.mats.index(m)
    def _tag(self, geom, m):
        mi = self._mi(m)
        for f in [g for g in geom if isinstance(g, bmesh.types.BMFace)]: f.material_index = mi
    def box(self, c, s, m='paint_grey', rz=0.0, rx=0.0):
        r = bmesh.ops.create_cube(self.bm, size=1.0)
        M = Matrix.Translation(Vector(c)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Diagonal((*s, 1))
        bmesh.ops.transform(self.bm, matrix=M, verts=r['verts'])
        self._tag(set(f for v in r['verts'] for f in v.link_faces), m)
    def cyl(self, p0, p1, r, m='steel_dark', n=None, cap=True, r2=None):
        p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
        if L < 1e-6: return
        n = n or seg(4, 8, 12)
        res = bmesh.ops.create_cone(self.bm, cap_ends=cap, segments=n, radius1=r, radius2=r if r2 is None else r2, depth=L)
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        M = Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
        bmesh.ops.transform(self.bm, matrix=M, verts=res['verts'])
        self._tag(set(f for v in res['verts'] for f in v.link_faces), m)
    def member(self, p0, p1, w, m):
        """structural member: square tube on low LOD, round/angle on higher"""
        self.cyl(p0, p1, w, m, n=seg(4, 6, 8))
    def hazard(self, p0, p1, w, h, stripes=None):
        """hazard-striped bar (kick plate / guard) from p0 to p1, alternating yellow/black segments"""
        p0, p1 = Vector(p0), Vector(p1); n = stripes or max(2, int((p1 - p0).length / 0.6))
        n = n if LOD else max(2, n // 3)
        ang = math.atan2((p1 - p0).y, (p1 - p0).x); L = (p1 - p0).length / n
        for i in range(n):
            c = p0 + (p1 - p0) * ((i + .5) / n)
            self.box(c, (L, w, h), 'hazard_y' if i % 2 == 0 else 'hazard_k', rz=ang)
    def obj(self, name, parent):
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        for m in self.mats: me.materials.append(mat(m))
        o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.parent = parent
        for p in me.polygons: p.use_smooth = False
        return o

_nodes = {}
def asset(aid):
    if aid in _nodes: return _nodes[aid]
    e = bpy.data.objects.new(aid, None); bpy.context.scene.collection.objects.link(e); _nodes[aid] = e; return e
def comp(aid, cid, build):
    mb = MB(); build(mb)
    if not mb.bm.verts: mb.bm.free(); return None
    return mb.obj(f'{aid}__{cid}', asset(aid))

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); _mat_cache.clear(); _nodes.clear()

# =====================================================================================
# Parts. All take an origin (x, y, z) = well centre on the drill floor unless noted.
# =====================================================================================
def lattice_mast(mb, H, base, top, z0=0.0, legs=4, m='paint_yellow', open_front=False, leg_r=None):
    """Tapered lattice derrick/mast with real cross-bracing (X braces on each face + horizontals)."""
    leg_r = leg_r or max(.12, base * .025)
    bays = max(4, int(H / seg(6.0, 3.5, 2.6)))
    pts = [(-1, -1), (1, -1), (1, 1), (-1, 1)] if legs == 4 else [(-1, 0), (1, 0)]
    def P(i, k):
        f = k / bays; w = base + (top - base) * f; a, b = pts[i % len(pts)]
        dz = w / 2 if legs == 4 else w * .18
        return Vector((a * w / 2, b * dz if legs == 4 else b, z0 + H * f))
    if legs == 2:  # A-frame / mast: two ladder legs, each a 2-chord lattice
        for a in (-1, 1):
            for b in (-1, 1):
                mb.member(P(0 if a < 0 else 1, 0) + Vector((0, b * .45, 0)), P(0 if a < 0 else 1, bays) + Vector((0, b * .3, 0)), leg_r, m)
            for k in range(bays):
                p0, p1 = P(0 if a < 0 else 1, k), P(0 if a < 0 else 1, k + 1)
                mb.member(p0 + Vector((0, -.45, 0)), p1 + Vector((0, .3, 0)), leg_r * .5, m)
                mb.member(p0 + Vector((0, -.45, 0)), p0 + Vector((0, .45, 0)), leg_r * .5, m)
        for k in range(1, bays + 1, 1 if LOD else 2):
            mb.member(P(0, k), P(1, k), leg_r * .6, m)
            if k < bays and LOD: mb.member(P(0, k - 1), P(1, k), leg_r * .45, m)
        return
    for i in range(4): mb.member(P(i, 0), P(i, bays), leg_r, m)
    for k in range(bays):
        for i in range(4):
            j = (i + 1) % 4
            if open_front and i == 0 and k < 2: continue   # V-door opening
            mb.member(P(i, k + 1), P(j, k + 1), leg_r * .6, m)
            if LOD or k % 2 == 0:
                mb.member(P(i, k), P(j, k + 1), leg_r * .45, m)
                if LOD: mb.member(P(j, k), P(i, k + 1), leg_r * .45, m)

def crown(aid, x, y, z, w, sheaves=6):
    def b(mb):
        mb.box((x, y, z + .4), (w + .8, w + .8, .5), 'paint_yellow')
        for a, c in ((-1, -1), (1, -1), (1, 1), (-1, 1)): mb.cyl((x + a * (w + .6) / 2, y + c * (w + .6) / 2, z + .6), (x + a * (w + .6) / 2, y + c * (w + .6) / 2, z + 1.6), .04, 'hazard_y', n=4)
        mb.hazard((x - w / 2 - .4, y - w / 2 - .4, z + 1.6), (x + w / 2 + .4, y - w / 2 - .4, z + 1.6), .06, .08)
        for k in range(sheaves): mb.cyl((x - .9 + k * 1.8 / max(1, sheaves - 1), y - .5, z + 1.1), (x - .9 + k * 1.8 / max(1, sheaves - 1), y + .5, z + 1.1), .5, 'steel_dark', n=seg(8, 14, 20))
        mb.box((x, y, z + 1.65), (.25, .25, .25), 'paint_red')  # aviation beacon housing
    comp(aid, 'crown', b)

def travelling_block(aid, x, y, z, scale=1.0):
    def b(mb):
        s = scale
        mb.box((x, y, z), (1.1 * s, .8 * s, 1.8 * s), 'paint_yellow')
        for k in (-1, 1): mb.box((x, y + k * .42 * s, z), (1.0 * s, .06, 1.5 * s), 'hazard_k')
        mb.cyl((x, y, z - 1.0 * s), (x, y, z - 1.8 * s), .18 * s, 'steel_dark')  # hook shank
        mb.cyl((x - .3 * s, y, z - 1.9 * s), (x + .3 * s, y, z - 1.9 * s), .25 * s, 'steel_dark')
        for k in range(seg(4, 8, 10)): mb.cyl((x - .4 * s + k * .8 * s / max(1, seg(4, 8, 10) - 1), y, z + .9 * s), (x - .4 * s + k * .8 * s / max(1, seg(4, 8, 10) - 1), y, z + 30), .015, 'wire', n=3)
    comp(aid, 'travelling', b)

def drill_line(aid, x, y, ztop, zblk):
    def b(mb):
        for k in range(seg(2, 4, 6)): mb.cyl((x - .5 + k * .2, y, zblk + 1), (x - .5 + k * .2, y, ztop), .018, 'wire', n=3)
    comp(aid, 'hoisting', b)

def top_drive(x, y, z, s=1.0, rail_to=None):
    A = 'topdrive'
    comp(A, 'frame', lambda mb: (mb.box((x, y + .9 * s, (z + (rail_to or z + 8)) / 2), (.35, .25, (rail_to or z + 8) - z + 2), 'steel_dark'),
                                  mb.box((x, y + .55 * s, z), (1.2 * s, .4, 1.6 * s), 'paint_grey')))
    comp(A, 'motor', lambda mb: (mb.cyl((x, y, z + .6 * s), (x, y, z + 2.2 * s), .55 * s, 'paint_blue', n=seg(8, 16, 24)),
                                  mb.box((x, y - .55 * s, z + 1.4 * s), (.6 * s, .25 * s, 1.0 * s), 'steel_dark')))
    comp(A, 'gearbox', lambda mb: mb.box((x, y, z), (1.3 * s, 1.0 * s, 1.0 * s), 'paint_blue'))
    comp(A, 'swivel', lambda mb: (mb.cyl((x, y, z + 2.2 * s), (x, y, z + 3.0 * s), .3 * s, 'steel_dark'),
                                   mb.cyl((x - .3, y, z + 2.9 * s), (x - .3, y + 1.2, z + 3.6 * s), .08, 'rubber')))
    comp(A, 'ibop', lambda mb: (mb.cyl((x, y, z - .5 * s), (x, y, z - 1.5 * s), .14 * s, 'paint_red'),
                                 mb.box((x + .25 * s, y, z - 1.0 * s), (.2, .2, .3), 'steel_dark')))
    comp(A, 'pipehandler', lambda mb: ([mb.cyl((x + k * .4 * s, y, z - .4 * s), (x + k * .4 * s, y, z - 3.0 * s), .05 * s, 'galv') for k in (-1, 1)],
                                        mb.box((x, y, z - 3.1 * s), (1.0 * s, .35 * s, .3 * s), 'paint_yellow')))

def monkey_board(x, y, z, w):
    comp('mast', 'monkeyboard', lambda mb: (mb.box((x, y + w / 2 + .9, z), (w + .4, 1.6, .12), 'galv'),
             [mb.box((x - w / 2 + .3 + k * (w - .6) / 5, y + w / 2 + 1.0, z + .05), (.06, 1.4, .06), 'paint_yellow') for k in range(6)],
             mb.hazard((x - w / 2 - .2, y + w / 2 + 1.7, z + .5), (x + w / 2 + .2, y + w / 2 + 1.7, z + .5), .05, .06)))

def substructure(x, y, W, D, Hs, boxy=False):
    def b(mb):
        if boxy or LOD == 0:
            for a in (-1, 1): mb.box((x + a * (W / 2 - .8), y, Hs / 2), (1.6, D, Hs), 'paint_yellow')
            mb.box((x, y, .3), (W, D, .6), 'paint_yellow')
        else:
            for a in (-1, 1):
                for c in (-1, 1): mb.member((x + a * (W / 2 - .5), y + c * (D / 2 - .5), 0), (x + a * (W / 2 - .5), y + c * (D / 2 - .5), Hs), .22, 'paint_yellow')
                nb = max(2, int(Hs / 2.2))
                for k in range(nb):
                    z0, z1 = Hs * k / nb, Hs * (k + 1) / nb
                    mb.member((x + a * (W / 2 - .5), y - D / 2 + .5, z0), (x + a * (W / 2 - .5), y + D / 2 - .5, z1), .1, 'paint_yellow')
                    mb.member((x + a * (W / 2 - .5), y - D / 2 + .5, z1), (x + a * (W / 2 - .5), y + D / 2 - .5, z1), .12, 'paint_yellow')
                mb.box((x + a * (W / 2 - .5), y, .25), (1.2, D, .5), 'paint_yellow')
    comp('mast', 'substructure', b)
    def fl(mb):
        mb.box((x, y, Hs + .15), (W, D, .3), 'deck')
        mb.box((x, y, Hs + .32), (1.4, 1.4, .06), 'galv')  # rotary table
        for a in (-1, 1): mb.hazard((x - W / 2, y + a * D / 2, Hs + .4), (x + W / 2, y + a * D / 2, Hs + .4), .06, .16)
        mb.hazard((x - W / 2, y - D / 2, Hs + 1.1), (x - W / 2, y + D / 2, Hs + 1.1), .05, .06)
        for k in range(seg(3, 6, 8)): mb.cyl((x - W / 2, y - D / 2 + k * D / (seg(3, 6, 8) - 1), Hs + .3), (x - W / 2, y - D / 2 + k * D / (seg(3, 6, 8) - 1), Hs + 1.1), .03, 'paint_yellow', n=4)
    comp('mast', 'floor', fl)

def doghouse(x, y, z, w=5, d=2.6, h=2.6):
    def b(mb):
        mb.box((x, y, z + h / 2), (w, d, h), 'paint_white'); mb.box((x, y, z + h + .05), (w + .2, d + .2, .1), 'paint_grey')
        for k in range(2): mb.box((x - w / 4 + k * w / 2, y - d / 2 - .01, z + h * .62), (w * .3, .04, h * .3), 'glass')
    comp('mast', 'doghouse', b)

def drawworks(x, y, z, s=1.0):
    A = 'drawworks'
    comp(A, 'skid', lambda mb: mb.box((x, y, z + .2), (5.2 * s, 2.6 * s, .4), 'steel_dark'))
    comp(A, 'drum', lambda mb: (mb.cyl((x - 1.1 * s, y, z + 1.3 * s), (x + 1.1 * s, y, z + 1.3 * s), .62 * s, 'galv', n=seg(10, 18, 28)),
                                 [mb.cyl((x + a * 1.15 * s, y, z + 1.3 * s), (x + a * 1.25 * s, y, z + 1.3 * s), .9 * s, 'paint_blue', n=seg(10, 18, 28)) for a in (-1, 1)]))
    comp(A, 'motors', lambda mb: [mb.cyl((x + a * 2.0 * s, y - .4 * s, z + 1.0 * s), (x + a * 2.0 * s, y + .9 * s, z + 1.0 * s), .5 * s, 'paint_blue', n=seg(8, 14, 20)) for a in (-1, 1)])
    comp(A, 'transmission', lambda mb: mb.box((x + 1.7 * s, y - .6 * s, z + 1.0 * s), (.6 * s, .8 * s, 1.4 * s), 'paint_grey'))
    comp(A, 'brake', lambda mb: [mb.cyl((x + a * 1.45 * s, y, z + 1.3 * s), (x + a * 1.6 * s, y, z + 1.3 * s), 1.0 * s, 'paint_red', n=seg(10, 16, 24)) for a in (-1, 1)])
    comp(A, 'instr', lambda mb: mb.box((x - 2.2 * s, y - 1.0 * s, z + 1.1 * s), (.5, .3, .7), 'paint_white'))

def mud_pumps(x, y, z, n, s=1.0, axis='y', quint=False):
    A = 'mudpumps'; sp = 3.4 * s
    P = [(x + (k - (n - 1) / 2) * sp, y, z) if axis == 'x' else (x, y + (k - (n - 1) / 2) * sp, z) for k in range(n)]
    comp(A, 'powerend', lambda mb: [(mb.box((px, py, pz + .9 * s), (3.0 * s, 1.8 * s, 1.5 * s), 'paint_green'), mb.box((px, py, pz + .1), (4.6 * s, 2.2 * s, .2), 'steel_dark')) for px, py, pz in P])
    comp(A, 'fluidend', lambda mb: [[mb.cyl((px + 1.5 * s, py + (c - (2 if quint else 1)) * .5 * s, pz + .9 * s), (px + 2.3 * s, py + (c - (2 if quint else 1)) * .5 * s, pz + .9 * s), .22 * s, 'paint_red') for c in range(5 if quint else 3)] for px, py, pz in P])
    comp(A, 'dampener', lambda mb: [(mb.cyl((px + 2.0 * s, py, pz + 1.7 * s), (px + 2.0 * s, py, pz + 2.3 * s), .32 * s, 'paint_red', n=seg(8, 14, 20)), mb.cyl((px + 2.0 * s, py, pz + 2.3 * s), (px + 2.0 * s, py, pz + 2.45 * s), .18 * s, 'steel_dark')) for px, py, pz in P])
    comp(A, 'drive', lambda mb: [(mb.cyl((px - 2.0 * s, py - .7 * s, pz + 1.0 * s), (px - 2.0 * s, py + .7 * s, pz + 1.0 * s), .6 * s, 'paint_blue', n=seg(8, 14, 20)), mb.box((px - 1.6 * s, py + .9 * s, pz + 1.0 * s), (.5 * s, .15 * s, 1.2 * s), 'hazard_y')) for px, py, pz in P])
    return P

def bop_stack(x, y, ztop, rams=3, s=1.0, subsea=False):
    A = 'bop'; z = ztop
    comp(A, 'annular', lambda mb: (mb.cyl((x, y, z - 1.4 * s), (x, y, z), .85 * s, 'paint_red', n=seg(10, 18, 28), r2=.6 * s),
                                    mb.cyl((x, y, z), (x, y, z + .25 * s), .35 * s, 'steel_dark')))
    def rm(mb):
        for k in range(rams):
            zz = z - 1.6 * s - k * .9 * s
            mb.box((x, y, zz), (2.4 * s, .95 * s, .75 * s), 'paint_red')
            for a in (-1, 1): mb.cyl((x + a * 1.2 * s, y, zz), (x + a * 1.9 * s, y, zz), .28 * s, 'paint_red')
            if LOD: mb.box((x, y - .5 * s, zz), (2.0 * s, .04, .12 * s), 'hazard_y')
    comp(A, 'rams', rm)
    zs = z - 1.6 * s - rams * .9 * s
    comp(A, 'spool', lambda mb: (mb.cyl((x, y, zs), (x, y, zs + .5 * s), .45 * s, 'paint_grey'), mb.cyl((x - .5, y, zs + .25 * s), (x - 1.4 * s, y, zs + .25 * s), .1 * s, 'steel_dark')))
    comp(A, 'wellhead', lambda mb: (mb.cyl((x, y, zs - 1.0 * s), (x, y, zs), .5 * s, 'galv'), mb.cyl((x, y, zs - 1.6 * s), (x, y, zs - 1.0 * s), .3 * s, 'galv'),
                                     [mb.cyl((x, y, zs - 1.6 * s), (x, y, zs - 3.0 * s), .7 * s, 'paint_yellow')] if subsea else None))
    if subsea:
        comp(A, 'frame', lambda mb: [mb.member((x + a * 1.6 * s, y + c * 1.6 * s, zs - 3 * s), (x + a * 1.6 * s, y + c * 1.6 * s, z), .12 * s, 'paint_yellow') for a in (-1, 1) for c in (-1, 1)])

def pipe_handling(x, y, z, L=14, s=1.0, rack=True):
    A = 'pipehandling'
    comp(A, 'catwalk', lambda mb: (mb.box((x, y, z + .5), (L, 1.4, 1.0), 'paint_yellow'), mb.hazard((x - L / 2, y - .72, z + 1.02), (x + L / 2, y - .72, z + 1.02), .04, .06),
                                    mb.cyl((x - L / 2 + .5, y, z + 1.1), (x + L / 2 - .5, y, z + 1.1), .09, 'pipe')))
    if rack:
        def rk(mb):
            for a in (-1, 1): mb.box((x, y + a * 3.2, z + .4), (L * .8, .3, .8), 'steel_dark')
            for r in range(2):
                for k in range(seg(4, 8, 12)):
                    yy = y + (-1) ** r * (2.2 + k * .2)
                    mb.cyl((x - L * .45, yy, z + .9 + (k % 2) * .1), (x + L * .45, yy, z + .9 + (k % 2) * .1), .07, 'pipe', n=seg(4, 6, 8))
        comp(A, 'racker', rk)

def floor_tools(x, y, z):
    A = 'pipehandling'
    comp(A, 'roughneck', lambda mb: (mb.box((x + 2.4, y - 1.6, z + 1.0), (.8, .8, 2.0), 'paint_orange'), mb.box((x + 1.5, y - 1.0, z + 1.0), (1.4, .4, .4), 'paint_orange'),
                                      mb.box((x + .9, y - .6, z + 1.0), (.5, .5, .5), 'steel_dark')))
    comp(A, 'slips', lambda mb: [mb.box((x + .2 * math.cos(a), y + .2 * math.sin(a), z + .45), (.18, .18, .3), 'galv') for a in (0, 2.1, 4.2)])

def mud_tanks(x, y, z, n=3, s=1.0, along='x'):
    A = 'mudtanks'; L = 9 * s
    def tk(mb):
        for k in range(n):
            cx = x + (k - (n - 1) / 2) * (L + .3) if along == 'x' else x; cy = y if along == 'x' else y + (k - (n - 1) / 2) * 3.2 * s
            mb.box((cx, cy, z + 1.3 * s), (L if along == 'x' else 3 * s, 3 * s if along == 'x' else L, 2.6 * s), 'paint_grey')
            mb.box((cx, cy, z + 2.65 * s), (L if along == 'x' else 3 * s, 3 * s if along == 'x' else L, .1), 'galv')
            if LOD: [mb.cyl((cx + j * 2.5 * s, cy, z + 2.7 * s), (cx + j * 2.5 * s, cy, z + 3.5 * s), .25 * s, 'paint_blue') for j in (-1, 1)]  # agitators
            mb.hazard((cx - (L if along == 'x' else 3 * s) / 2, cy - (3 * s if along == 'x' else L) / 2, z + 3.6 * s), (cx + (L if along == 'x' else 3 * s) / 2, cy - (3 * s if along == 'x' else L) / 2, z + 3.6 * s), .04, .06)
    comp(A, 'tanks', tk)
    x0 = x - (n * (L + .3)) / 2 + 2 if along == 'x' else x
    comp(A, 'solids', lambda mb: [(mb.box((x0 + k * 2.2, y, z + 3.1 * s), (1.8 * s, 2.4 * s, .9 * s), 'paint_blue'), mb.box((x0 + k * 2.2, y, z + 3.65 * s), (1.6 * s, 2.0 * s, .1), 'galv', rx=.12)) for k in range(2)])
    comp(A, 'degasser', lambda mb: mb.cyl((x0 + 5, y + .6, z + 2.7 * s), (x0 + 5, y + .6, z + 5.0 * s), .5 * s, 'paint_white'))

def generators(x, y, z, n=3, s=1.0):
    A = 'generators'
    comp(A, 'gensets', lambda mb: [(mb.box((x + k * 3.2 * s, y, z + 1.4 * s), (2.8 * s, 6 * s, 2.8 * s), 'paint_yellow'),
                                     mb.cyl((x + k * 3.2 * s, y - 2 * s, z + 2.8 * s), (x + k * 3.2 * s, y - 2 * s, z + 4.0 * s), .2 * s, 'steel_dark')) for k in range(n)])
    comp(A, 'vfd', lambda mb: (mb.box((x + n * 3.2 * s + 2.0 * s, y, z + 1.5 * s), (3.4 * s, 8 * s, 3 * s), 'paint_white'), mb.box((x + n * 3.2 * s + .25 * s, y, z + 1.6 * s), (.05, 7 * s, .4), 'hazard_y')))
    comp(A, 'fuel', lambda mb: mb.cyl((x - 2.5 * s, y - 3 * s, z + 1.2 * s), (x - 2.5 * s, y + 3 * s, z + 1.2 * s), 1.2 * s, 'paint_white', n=seg(10, 16, 24)))

def accumulator(x, y, z, s=1.0):
    A = 'accumulator'
    def bt(mb):
        for i in range(seg(4, 8, 12)):
            for j in (-1, 1): mb.cyl((x - 1.4 * s + i * 2.8 * s / max(1, seg(4, 8, 12) - 1), y + j * .35 * s, z + .3), (x - 1.4 * s + i * 2.8 * s / max(1, seg(4, 8, 12) - 1), y + j * .35 * s, z + 1.6 * s), .14 * s, 'paint_red', n=seg(6, 10, 14))
    comp(A, 'bottles', bt)
    comp(A, 'pumps', lambda mb: mb.box((x + 2.2 * s, y, z + .6 * s), (1.0 * s, 1.2 * s, 1.0 * s), 'paint_blue'))
    comp(A, 'manifold', lambda mb: (mb.box((x, y, z + .15), (4.0 * s, 1.6 * s, .3), 'steel_dark'), mb.box((x, y - .9 * s, z + 1.0 * s), (3.0 * s, .2, .8 * s), 'paint_grey')))
    comp(A, 'remote', lambda mb: (mb.box((x - 3.0 * s, y, z + 1.2 * s), (.7, .4, 1.0), 'paint_red'), mb.cyl((x - 3.0 * s, y, z), (x - 3.0 * s, y, z + .8 * s), .06, 'steel_dark')))

def choke(x, y, z, s=1.0, mgs=True):
    A = 'choke'
    def mf(mb):
        mb.box((x, y, z + .2), (3.6 * s, 1.6 * s, .4), 'steel_dark')
        mb.cyl((x - 1.6 * s, y, z + 1.0 * s), (x + 1.6 * s, y, z + 1.0 * s), .12 * s, 'paint_orange')
        for k in range(4): mb.box((x - 1.2 * s + k * .8 * s, y, z + 1.0 * s), (.35 * s, .4 * s, .5 * s), 'paint_orange')
    comp(A, 'manifold', mf)
    comp(A, 'chokes', lambda mb: [mb.cyl((x + a * .9 * s, y + .5 * s, z + .8 * s), (x + a * .9 * s, y + .5 * s, z + 1.6 * s), .18 * s, 'paint_red') for a in (-1, 1)])
    if mgs: comp(A, 'mgs', lambda mb: (mb.cyl((x + 3.0 * s, y, z), (x + 3.0 * s, y, z + 5 * s), .55 * s, 'paint_white', n=seg(8, 14, 20)), mb.cyl((x + 3.0 * s, y, z + 5 * s), (x + 3.0 * s, y, z + 9 * s), .1 * s, 'steel_dark')))

def rig_floor_set(x, y, Hs, H, base, top, legs=4, sheaves=6, tdscale=1.0, open_front=True, boxy=False, W=None, D=None):
    """Complete drilling package on a substructure of height Hs at (x, y): mast, crown, block, top drive,
    monkey board, floor, doghouse, drill line, floor tools. z0 = 0 (ground or deck level)."""
    W = W or max(base + 3, 9); D = D or max(base + 2, 8)
    substructure(x, y, W, D, Hs, boxy)
    comp('mast', 'mast', lambda mb: lattice_mast(mb, H, base, top, Hs + .3, legs, open_front=open_front))
    crown('block', x, y, Hs + .3 + H, top, sheaves)
    zb = Hs + H * .62
    travelling_block('block', x, y, zb, tdscale)
    top_drive(x, y, zb - 3.2 * tdscale, tdscale, rail_to=Hs + H * .95)
    drill_line('mast', x, y, Hs + H, zb)
    monkey_board(x, y, Hs + H * .58, top + (base - top) * .42)
    doghouse(x - W / 2 - 2.8, y - D / 2 + 1.3, Hs)
    floor_tools(x, y, Hs + .3)

# ---------- carriers / hulls (non-BOM structure, named 'hull' / 'carrier') ----------
def truck(x, y, L=16, cab=True, m='paint_orange'):
    def b(mb):
        mb.box((x, y, 1.3), (L, 2.6, .5), 'steel_dark'); mb.box((x - 1, y, 2.0), (L - 4, 2.4, 1.0), m)
        if cab: mb.box((x + L / 2 - 1.5, y, 2.3), (3, 2.5, 2.4), 'paint_white'); mb.box((x + L / 2 - .05, y, 2.8), (.1, 2.2, .9), 'glass')
        for k in range(seg(3, 5, 5)):
            xx = x - L / 2 + 1.5 + k * (L - 3) / 4 if k < 4 else x + L / 2 - 1.5
            for c in (-1, 1): mb.cyl((xx, y + c * 1.1, .55), (xx, y + c * 1.45, .55), .55, 'rubber', n=seg(8, 14, 20))
    return b

def ground_pad(x, y, W, D):
    comp('site', 'pad', lambda mb: mb.box((x, y, -.15), (W, D, .3), 'deck'))
