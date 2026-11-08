# Coiled tubing unit: reel + injector head on a lift frame, no derrick. Generic SIM.
from parts import *
import math
def build():
    ground_pad(0, 0, 50, 34)
    comp('carrier', 'truck', truck(-10, 0, L=14, m='paint_white'))
    comp('mast', 'mast', lambda mb: lattice_mast(mb, 13, 4, 3, 0, 4, m='paint_red'))
    # reel (drawworks role) on the trailer
    def reel(mb):
        mb.cyl((-11, -1.6, 4.6), (-11, 1.6, 4.6), 2.8, 'paint_blue', n=seg(14, 24, 36))
        mb.cyl((-11, -1.3, 4.6), (-11, 1.3, 4.6), 2.85, 'galv', n=seg(14, 24, 36))
        for a in (-1, 1): mb.box((-11, a * 1.8, 3.0), (1, .3, 3.4), 'steel_dark')
    comp('drawworks', 'drum', reel)
    comp('drawworks', 'skid', lambda mb: mb.box((-11, 0, 1.7), (6, 4, .4), 'steel_dark'))
    # injector head (top drive role) + gooseneck arch
    comp('topdrive', 'motor', lambda mb: (mb.box((0, 0, 14.5), (2.2, 1.8, 3.0), 'paint_red'), mb.box((0, 0, 16.2), (2.6, 2.2, .3), 'hazard_y')))
    def goose(mb):
        n = seg(8, 16, 24)
        for k in range(n):
            a0, a1 = math.pi * k / n, math.pi * (k + 1) / n
            mb.cyl((-2.6 + 2.6 * math.cos(a0), 0, 16.3 + 2.6 * math.sin(a0)), (-2.6 + 2.6 * math.cos(a1), 0, 16.3 + 2.6 * math.sin(a1)), .12, 'galv', n=4)
        mb.cyl((-5.2, 0, 16.3), (-11, 0, 7.4), .05, 'galv', n=4)  # coil to reel
    comp('topdrive', 'pipehandler', goose)
    bop_stack(0, 0, 12.6, rams=4, s=.55)
    comp('bop', 'wellhead', lambda mb: (mb.cyl((0, 0, 0), (0, 0, 8.5), .35, 'galv'), mb.cyl((-.8, 0, 2), (.8, 0, 2), .15, 'galv')))
    comp('carrier', 'control', lambda mb: (mb.box((8, -7, 1.6), (5, 2.6, 3.2), 'paint_white'), mb.box((5.45, -7, 2.2), (.1, 2, .9), 'glass')))
    mud_pumps(8, 7, 0, 1, .75, axis='x')
    mud_tanks(-8, -10, 0, 1, .7)
    accumulator(8, 0, 0, .55); choke(14, 2, 0, .6)
