# Frac spread: pump trucks, blender, sand, data van, missile manifold, frac tree. Generic SIM (scene shows 8 of 16 pumps).
from parts import *
def build():
    ground_pad(0, 0, 90, 56)
    # pumps on trailers (BOM mudpumps role: quintuplex frac pumps)
    n = seg(4, 8, 8); P = []
    def trailers(mb):
        for k in range(n):
            for side in (-1, 1):
                x, y = -26 + k * 7.0, side * 9
                mb.box((x, y, 1.0), (2.8, 13, .4), 'steel_dark')
                mb.box((x, y + side * 5.2, 2.0), (2.6, 2.6, 2.4), 'paint_white')
                for c in (-1, 1):
                    for w in (-1, 1): mb.cyl((x + c * 1.1, y + w * 4, .55), (x + c * 1.45, y + w * 4, .55), .55, 'rubber', n=seg(8, 12, 16))
    comp('carrier', 'trailers', trailers)
    mud_pumps(-26, 9, 1.2, n, .8, axis='x', quint=True); 
    comp('mudpumps', 'fluidend2', lambda mb: [mb.box((-26 + k * 7.0, -9, 2.2), (2.4, 4.4, 1.8), 'paint_green') for k in range(n)])
    # blender + sand (mudtanks role)
    comp('mudtanks', 'tanks', lambda mb: [(mb.cyl((32, -18 + k * 6, 0), (32, -18 + k * 6, 14), 2.4, 'paint_white', n=seg(10, 16, 24)), mb.cyl((32, -18 + k * 6, 14), (32, -18 + k * 6, 15), 2.4, 'paint_grey', r2=.6, n=seg(10, 16, 24))) for k in range(4)])
    comp('mudtanks', 'solids', lambda mb: (mb.box((24, 0, 2.4), (6, 2.8, 3.2), 'paint_blue'), mb.cyl((24, 0, 4), (24, 0, 6.5), 1.0, 'paint_blue', r2=.3)))
    comp('mudtanks', 'degasser', lambda mb: [mb.box((-14 + k * 9, -24, 1.8), (8.5, 3, 3.6), 'paint_grey') for k in range(4)])
    # data van (generators role)
    comp('generators', 'vfd', lambda mb: (mb.box((18, 18, 2.0), (10, 3, 3.2), 'paint_white'), mb.box((13, 18, 2.4), (.1, 2, .9), 'glass')))
    comp('generators', 'gensets', lambda mb: mb.box((6, 18, 1.6), (8, 3, 3.0), 'paint_yellow'))
    # missile manifold + iron (choke role)
    def missile(mb):
        mb.box((0, 0, 1.0), (54, 2.4, .5), 'steel_dark')
        mb.cyl((-28, 0, 1.6), (28, 0, 1.6), .25, 'galv')
        for k in range(n):
            for side in (-1, 1): mb.cyl((-26 + k * 7.0, side * 1.2, 1.6), (-26 + k * 7.0, side * 6.5, 1.6), .1, 'paint_red', n=6)
        mb.cyl((28, 0, 1.6), (40, 0, 1.6), .2, 'paint_red')
    comp('choke', 'manifold', missile)
    # frac tree (bop role) on the wellhead
    bop_stack(42, 0, 6.5, rams=1, s=.6)
    comp('bop', 'tree', lambda mb: (mb.cyl((42, 0, 6.5), (42, 0, 9.5), .3, 'paint_red'), mb.cyl((41, 0, 8), (43, 0, 8), .25, 'paint_red'), mb.box((42, 0, 9.8), (1, 1, .6), 'paint_red')))
